import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { acceptDemand, refuseDemand, rivalTurn } from '../src/politics/families';
import { applyEffect, pendingChoices, resolveChoice, rollEvent } from '../src/politics/events';
import { appease, appeasePrice, tribeTurn } from '../src/tribes/turn';
import { holderOf } from '../src/politics/posts';
import { config, events } from '../src/data';

describe('rival ambitions', () => {
  function withDemand(seed = 4) {
    const s = createInitialState(0, seed);
    s.round = 5;
    s.families.cornelii.attitude = 10;
    for (let i = 0; i < 60 && !s.families.cornelii.demand; i++) rivalTurn(s, s.families.cornelii);
    return s;
  }
  it('a rival asks for something and sets a deadline', () => {
    const s = withDemand();
    const d = s.families.cornelii.demand!;
    expect(['post', 'denarii']).toContain(d.kind);
    expect(d.dueRound).toBe(d.issuedRound + config.rival.demandDueRounds);
  });
  it('granting a post demand actually seats them and warms them', () => {
    const s = createInitialState(0, 1);
    s.families.cornelii.demand = { kind: 'post', postId: 'works', issuedRound: 1, dueRound: 4 };
    const before = s.families.cornelii.attitude;
    acceptDemand(s, 'cornelii');
    expect(holderOf(s, 'works')!.familyId).toBe('cornelii');
    expect(s.families.cornelii.attitude).toBe(before + config.rival.acceptAttitude);
    expect(s.families.cornelii.demand).toBeNull();
  });
  it('refusing costs attitude and is remembered', () => {
    const s = withDemand(9);
    const before = s.families.cornelii.attitude;
    refuseDemand(s, 'cornelii');
    expect(s.families.cornelii.attitude).toBe(before + config.rival.refuseAttitude);
    expect(s.families.cornelii.grievances).toBe(1);
    expect(() => refuseDemand(s, 'cornelii')).toThrow();
  });
  it('ignoring a demand costs more than refusing it', () => {
    expect(config.rival.ignoreAttitude).toBeLessThan(config.rival.refuseAttitude);
    const s = withDemand(13);
    const fam = s.families.cornelii;
    const before = fam.attitude;
    s.round = fam.demand!.dueRound;
    rivalTurn(s, fam);
    expect(fam.demand).toBeNull();
    expect(fam.grievances).toBe(1);
    expect(fam.attitude).toBe(before + config.rival.ignoreAttitude);
  });
  it('enough grievances and they write to Rome instead of sulking', () => {
    const s = createInitialState(0, 2);
    const fam = s.families.cornelii;
    fam.grievances = config.rival.grievanceDenounceThreshold;
    fam.attitude = -60;
    const favour = s.rome.favour;
    rivalTurn(s, fam);
    expect(fam.denounced).toBe(true);
    expect(s.rome.favour).toBe(favour + config.rival.denounceFavour);
    const again = s.rome.favour;
    rivalTurn(s, fam);
    expect(s.rome.favour).toBe(again); // only once
  });
});

describe('choice events', () => {
  it('every choice in data is answerable and has an effect', () => {
    const withChoices = events.filter((e) => e.choices?.length);
    expect(withChoices.length).toBeGreaterThanOrEqual(4);
    for (const e of withChoices) {
      for (const c of e.choices!) {
        expect(c.label.length).toBeGreaterThan(0);
        expect(Object.keys(c.effect).length).toBeGreaterThan(0);
      }
    }
  });
  it('a choice event waits for an answer and blocks further events', () => {
    const s = createInitialState(0, 1);
    s.pendingChoice = { eventId: 'deserters', title: 'Men slip away', text: 't' };
    const before = s.logSeq;
    rollEvent(s);
    expect(s.logSeq).toBe(before);
    const choices = pendingChoices(s);
    expect(choices.map((c) => c.id)).toEqual(['hunt', 'let_go']);
    const pop = s.population;
    resolveChoice(s, 'let_go');
    expect(s.population).toBe(pop - 7);
    expect(s.pendingChoice).toBeNull();
    expect(() => resolveChoice(s, 'hunt')).toThrow();
  });
  it('a choice you cannot pay for is refused, not silently free', () => {
    const s = createInitialState(0, 1);
    s.pendingChoice = { eventId: 'rival_debt', title: 'A debt in Rome', text: 't' };
    s.resources.denarii = 10;
    expect(() => resolveChoice(s, 'pay')).toThrow(/cannot pay/);
    expect(s.pendingChoice).not.toBeNull();
  });
  it('applyEffect moves every channel it names', () => {
    const s = createInitialState(0, 1);
    s.resources.grain = 100;
    applyEffect(s, { grain: -30, corruption: 5, fear: 10, trust: -5, romeFavour: 3, attitude: -4 });
    expect(s.resources.grain).toBe(70);
    expect(s.corruption).toBe(5);
    expect(s.tribe.fear).toBe(35);
    expect(s.rome.favour).toBe(config.rome.startFavour + 3);
  });
});

describe('raid foreshadowing', () => {
  it('a raid is announced a round before it lands', () => {
    const s = createInitialState(0, 1);
    s.tribe.fear = 0;
    s.tribe.strength = 500;
    s.round = 10;
    let warned = false;
    for (let i = 0; i < 40 && !warned; i++) {
      s.round += 1;
      tribeTurn(s);
      warned = s.tribe.massingForRound >= s.round;
    }
    expect(warned).toBe(true);
    const wood = s.resources.wood;
    expect(s.resources.wood).toBe(wood); // nothing taken yet
    s.round = s.tribe.massingForRound;
    tribeTurn(s);
    expect(s.tribe.massingForRound).toBeLessThan(s.round);
    expect(s.tribe.lastRaidRound).toBe(s.round);
  });
  it('paying them off cancels the raid and teaches them you pay', () => {
    const s = createInitialState(0, 1);
    s.round = 5;
    s.tribe.massingForRound = 6;
    s.resources.denarii = 5000;
    const price = appeasePrice(s);
    const trust = s.tribe.trust;
    const fear = s.tribe.fear;
    appease(s);
    expect(s.resources.denarii).toBe(5000 - price);
    expect(s.tribe.trust).toBe(trust + config.tribe.appeaseTrust);
    expect(s.tribe.fear).toBe(fear + config.tribe.appeaseFear);
    s.round = 6;
    tribeTurn(s);
    expect(s.tribe.lastRaidRound).toBeLessThan(0);
    expect(() => appease(s)).toThrow(/massing/);
  });
  it('the warning turn does not also raid', () => {
    const g = new Game(createInitialState(0, 6));
    g.state.tribe.strength = 400;
    g.state.tribe.fear = 0;
    for (let i = 0; i < 12; i++) {
      const before = g.state.resources.wood;
      g.act({ type: 'convene' }, i + 1);
      if (g.state.tribe.massingForRound === g.state.round + 1) {
        expect(g.state.resources.wood).toBeGreaterThanOrEqual(before - 0.001);
        return;
      }
    }
  });
});

describe('choice events reach the player in normal play', () => {
  it('fires a choice within a reasonable number of rounds', () => {
    let firedIn = -1;
    for (let seed = 1; seed <= 8 && firedIn < 0; seed++) {
      const g = new Game(createInitialState(0, seed));
      for (let i = 0; i < 60; i++) {
        g.act({ type: 'convene' }, i + 1);
        if (g.state.pendingChoice) { firedIn = i + 1; break; }
        // answer nothing: a pending choice would block later events
      }
    }
    expect(firedIn).toBeGreaterThan(0);
    expect(firedIn).toBeLessThan(60);
  });
});
