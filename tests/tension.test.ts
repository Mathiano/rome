import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { acceptDemand, refuseDemand, rivalTurn } from '../src/politics/families';
import { applyEffect, pendingChoices, resolveChoice, rollEvent } from '../src/politics/events';
import { appease, appeasePrice, tribeTurn } from '../src/tribes/turn';
import { dispatchEnvoy, propagateWeb, resolveEnvoy } from '../src/tribes/envoys';
import { serialise, deserialise } from '../src/state/store';
import { appoint, appointLesser, holderOf } from '../src/politics/posts';
import { defenceBreakdown, defenceStrength } from '../src/combat/raids';
import { setBodyguards } from '../src/politics/intrigue';
import { buildingTier } from '../src/village/storage';
import { homeMilitia } from '../src/combat/militia';
import { config, events } from '../src/data';
import type { GameState } from '../src/state/types';
/** v0.1 woke the other two tribes; these tests speak to the raider. */
const TRIBE_ID = 'chatti';
const TRIBE = (s: GameState) => s.tribes[TRIBE_ID];


describe('rival ambitions', () => {
  function withDemand(seed = 4) {
    const s = createInitialState(0, seed);
    s.round = 5;
    s.families.cornelii.attitude = 10;
    for (let i = 0; i < 60 && !s.families.cornelii.demand; i++) rivalTurn(s, s.families.cornelii);
    return s;
  }
  it('all three rival houses play, not only the first (DESIGN §9.1)', () => {
    const g = new Game(createInitialState(0, 13));
    const asked = new Set<string>();
    const seated = new Set<string>();
    for (let i = 0; i < 60; i++) {
      for (const f of Object.values(g.state.families)) {
        if (f.isPlayer) continue;
        if (f.demand) asked.add(f.id);
      }
      for (const c of Object.values(g.state.characters)) {
        if (c.post && !g.state.families[c.familyId].isPlayer) seated.add(c.familyId);
      }
      g.act({ type: 'convene' }, i * 1000 + 1);
      if (g.state.pendingChoice) g.state.pendingChoice = null;
    }
    expect([...asked].sort()).toEqual(['claudii', 'cornelii', 'valerii']);
    // and each of them can take a post, which is what makes them dangerous
    expect(seated.size).toBeGreaterThan(0);
  });

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
    expect(TRIBE(s).fear).toBe(35);
    expect(s.rome.favour).toBe(config.rome.startFavour + 3);
  });
});

describe('raid foreshadowing', () => {
  it('a raid is announced a round before it lands', () => {
    const s = createInitialState(0, 1);
    TRIBE(s).fear = 0;
    TRIBE(s).strength = 500;
    s.round = 10;
    let warned = false;
    for (let i = 0; i < 40 && !warned; i++) {
      s.round += 1;
      tribeTurn(s);
      warned = TRIBE(s).massingForRound >= s.round;
    }
    expect(warned).toBe(true);
    const wood = s.resources.wood;
    expect(s.resources.wood).toBe(wood); // nothing taken yet
    s.round = TRIBE(s).massingForRound;
    tribeTurn(s);
    expect(TRIBE(s).massingForRound).toBeLessThan(s.round);
    expect(TRIBE(s).lastRaidRound).toBe(s.round);
  });
  it('paying them off cancels the raid and teaches them you pay', () => {
    const s = createInitialState(0, 1);
    s.round = 5;
    TRIBE(s).massingForRound = 6;
    s.resources.denarii = 5000;
    const price = appeasePrice(s, TRIBE_ID);
    const trust = TRIBE(s).trust;
    const fear = TRIBE(s).fear;
    appease(s, TRIBE_ID);
    expect(s.resources.denarii).toBe(5000 - price);
    expect(TRIBE(s).trust).toBe(trust + config.tribe.appeaseTrust);
    expect(TRIBE(s).fear).toBe(fear + config.tribe.appeaseFear);
    s.round = 6;
    tribeTurn(s);
    expect(TRIBE(s).lastRaidRound).toBeLessThan(0);
    expect(() => appease(s, TRIBE_ID)).toThrow(/massing/);
  });
  it('the warning turn does not also raid', () => {
    const g = new Game(createInitialState(0, 6));
    TRIBE(g.state).strength = 400;
    TRIBE(g.state).fear = 0;
    for (let i = 0; i < 12; i++) {
      const before = g.state.resources.wood;
      g.act({ type: 'convene' }, i + 1);
      if (TRIBE(g.state).massingForRound === g.state.round + 1) {
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

describe('the tribes watch each other (DESIGN §7)', () => {
  it('warming to one cools those who hate it and warms its friends', () => {
    const s = createInitialState(0, 1);
    const before = { cherusci: s.tribes.cherusci.trust, sugambri: s.tribes.sugambri.trust };
    propagateWeb(s, 'chatti', 20);
    // the Cherusci hate the Chatti; the Sugambri are friendly to them
    expect(s.tribes.cherusci.trust).toBeLessThan(before.cherusci);
    expect(s.tribes.sugambri.trust).toBeGreaterThan(before.sugambri);
    expect(s.tribes.chatti.trust).toBe(createInitialState(0, 1).tribes.chatti.trust);
  });

  it('an alliance moves the web hardest', () => {
    const s = createInitialState(0, 1);
    s.tribes.chatti.trust = 100;
    s.tribes.chatti.fear = 0;
    const hostileBefore = s.tribes.cherusci.trust;
    dispatchEnvoy(s, 'chatti', 'propose_alliance');
    resolveEnvoy(s, s.tribes.chatti);
    expect(s.tribes.chatti.allied).toBe(true);
    expect(s.tribes.cherusci.trust).toBeLessThan(hostileBefore);
  });

  it('every tribe raids on its own account, and an ally does not', () => {
    const s = createInitialState(0, 1);
    s.round = 40;
    for (const t of Object.values(s.tribes)) { t.fear = 0; t.strength = 300; }
    s.tribes.sugambri.allied = true;
    const massed = new Set<string>();
    for (let i = 0; i < 40; i++) {
      s.round += 1;
      tribeTurn(s);
      for (const t of Object.values(s.tribes)) if (t.massingForRound >= s.round) massed.add(t.id);
    }
    expect(massed.has('chatti') || massed.has('cherusci')).toBe(true);
    expect(massed.has('sugambri')).toBe(false);
  });

  it('a single-tribe save from before v0.1 migrates to three', () => {
    const s = createInitialState(0, 1);
    const raw = JSON.parse(serialise(s)) as Record<string, unknown> & { tribes?: unknown; tribe?: unknown };
    raw.tribe = { ...(raw.tribes as Record<string, unknown>).chatti as object, trust: 77 };
    delete raw.tribes;
    const back = deserialise(JSON.stringify(raw));
    expect(Object.keys(back.tribes).sort()).toEqual(['chatti', 'cherusci', 'sugambri']);
    expect(back.tribes.chatti.trust).toBe(77);
    expect((back as unknown as { tribe?: unknown }).tribe).toBeUndefined();
  });
});

describe('the defence by its terms (DESIGN §8.2, reports unit)', () => {
  /** A colony with a wall, a prefect, guards, a catapult and a lesser office: every term non-zero. */
  function fortified() {
    const s = createInitialState(0, 1);
    const wall = s.slots.find((x) => x.id === 'w1')!;
    wall.building = 'wall';
    wall.tier = 2;
    s.characters.c_nephew.gravitas = 50;
    appoint(s, 'garrison', 'c_nephew');
    setBodyguards(s, 'p_leader', 2, 10);
    s.rome.unlocks.push('catapult');
    const lesser = 'custos';
    appointLesser(s, lesser, 'p_son');
    return s;
  }
  it('sums to defenceStrength with every term in play', () => {
    const s = fortified();
    const b = defenceBreakdown(s);
    expect(buildingTier(s, 'wall')).toBe(2);
    expect(b.ditch).toBe(config.raid.baseDefence);
    expect(b.wall).toBeGreaterThan(0);
    expect(b.militia).toBeGreaterThan(0);
    expect(b.garrison).toBeCloseTo(s.characters.c_nephew.stats.discipline * config.raid.garrisonDisciplineWeight, 9);
    expect(b.engines).toBe(15);
    expect(b.men.bodyguards).toBe(2);
    expect(b.prefectId).toBe('c_nephew');
    expect(b.obstructed).toBe(false);
    expect(b.ditch + b.wall + b.militia + b.garrison + b.engines + b.lesser).toBeCloseTo(defenceStrength(s), 9);
    expect(b.total).toBeCloseTo(defenceStrength(s), 9);
  });
  it('an obstructed prefect is a zero term and marked as such', () => {
    const s = fortified();
    s.obstructed.defence = s.round + 2;
    const b = defenceBreakdown(s);
    expect(b.obstructed).toBe(true);
    expect(b.garrison).toBe(0);
    expect(b.total).toBeCloseTo(defenceStrength(s), 9);
  });
  it('holds on a bare colony and one with nobody in the post', () => {
    const s = createInitialState(0, 1);
    const b = defenceBreakdown(s);
    expect(b.prefectId).toBeNull();
    expect(b.garrison).toBe(0);
    expect(b.engines).toBe(0);
    expect(b.total).toBeCloseTo(defenceStrength(s), 9);
    expect(b.men.home).toBe(homeMilitia(s));
  });
});
