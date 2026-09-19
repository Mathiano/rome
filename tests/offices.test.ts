import { describe, it, expect } from 'vitest';
import { createInitialState, serialise, deserialise, emptyStats } from '../src/state/store';
import { Game } from '../src/game';
import { appoint, appointLesser, dismissLesser, driftAttitudes, lesserEffect, lesserHolderOf, updateCorruption } from '../src/politics/posts';
import { buildTimeMultiplier } from '../src/village/economy';
import { defenceStrength } from '../src/combat/raids';
import { favourRewardMultiplier, releaseWithheld, romeTurn, deliver } from '../src/rome/requests';
import { backingCost, seekRomeBacking } from '../src/politics/intrigue';
import { config, lesserPosts, unlocks } from '../src/data';

describe('lesser offices', () => {
  it('needs no rank, cannot be held alongside a council post, and seats one man', () => {
    const s = createInitialState(0, 1);
    appointLesser(s, 'scriba', 'p_son');
    expect(lesserHolderOf(s, 'scriba')!.id).toBe('p_son');
    expect(s.characters.p_son.lesserPost).toBe('scriba');
    appointLesser(s, 'praeco', 'p_son');
    expect(lesserHolderOf(s, 'scriba')).toBeNull();
    appoint(s, 'works', 'p_brother');
    expect(() => appointLesser(s, 'scriba', 'p_brother')).toThrow(/council/);
    dismissLesser(s, 'praeco');
    expect(s.characters.p_son.lesserPost).toBeNull();
  });

  it('keeps a house from souring without giving it anything to obstruct with', () => {
    const bare = createInitialState(0, 1);
    driftAttitudes(bare);
    const sour = bare.families.cornelii.attitude;

    const parked = createInitialState(0, 1);
    appointLesser(parked, 'scriba', 'c_nephew');
    driftAttitudes(parked);
    expect(parked.families.cornelii.attitude).toBeGreaterThan(sour);
    // it is not a council post, so it grants no leverage and no danger
    expect(parked.posts.treasury).toBeNull();
    const held = Object.values(parked.posts).filter(Boolean);
    expect(held).toHaveLength(0);
  });

  it('each lesser office feeds the channel it claims', () => {
    for (const p of lesserPosts) {
      const s = createInitialState(0, 1);
      const before = {
        corruptionFall: lesserEffect(s, 'corruptionFall'),
        buildSpeed: buildTimeMultiplier(s),
        defence: defenceStrength(s),
      };
      appointLesser(s, p.id, 'p_leader');
      if (p.effect === 'corruptionFall') expect(lesserEffect(s, 'corruptionFall')).toBeGreaterThan(before.corruptionFall);
      if (p.effect === 'buildSpeed') expect(buildTimeMultiplier(s)).toBeLessThan(before.buildSpeed);
      if (p.effect === 'defence') expect(defenceStrength(s)).toBeGreaterThan(before.defence);
      expect(lesserEffect(s, p.effect)).toBeCloseTo(s.characters.p_leader.stats[p.stat] * p.perStat, 6);
    }
  });

  it('a scribe pulls corruption down', () => {
    const s = createInitialState(0, 1);
    s.corruption = 40;
    updateCorruption(s);
    const without = s.corruption;
    s.corruption = 40;
    appointLesser(s, 'scriba', 'p_brother');
    updateCorruption(s);
    expect(s.corruption).toBeLessThan(without);
  });
});

describe('Rome favour does something', () => {
  it('scales rewards, within bounds', () => {
    const s = createInitialState(0, 1);
    s.rome.favour = 0;
    expect(favourRewardMultiplier(s)).toBe(1);
    s.rome.favour = 1000;
    expect(favourRewardMultiplier(s)).toBeCloseTo(1 + config.rome.rewardFavourCeiling);
    s.rome.favour = -1000;
    expect(favourRewardMultiplier(s)).toBeCloseTo(1 + config.rome.rewardFavourFloor);
  });

  it('withholds a unique gift at low favour and sends it when favour recovers', () => {
    const s = createInitialState(0, 1);
    s.rome.favour = 0;
    s.rome.activeRequest = {
      id: 'x', title: 'A gift', text: '', kind: 'deliver', deliver: { wood: 1 },
      reward: { unlock: 'catapult' }, delivered: {}, fulfilled: true, issuedRound: 0,
    };
    romeTurn(s);
    expect(s.rome.unlocks).not.toContain('catapult');
    expect(s.rome.withheldUnlocks).toContain('catapult');
    expect(unlocks.catapult).toBeDefined();
    s.rome.favour = config.rome.unlockMinFavour;
    releaseWithheld(s);
    expect(s.rome.unlocks).toContain('catapult');
    expect(s.rome.withheldUnlocks).toHaveLength(0);
  });

  it('gates and discounts Rome\'s backing', () => {
    const s = createInitialState(0, 1);
    const leader = s.characters.p_leader;
    leader.gravitas = config.gravitas.rankThresholds[config.gravitas.romeBackingMinRank];
    leader.gravitasStock = 999;
    s.rome.favour = config.rome.backingMinFavour - 1;
    expect(() => seekRomeBacking(s)).toThrow(/favour/);
    s.rome.favour = 0 + config.rome.backingMinFavour;
    const dear = backingCost(s);
    s.rome.favour = 500;
    const cheap = backingCost(s);
    expect(cheap).toBeLessThan(dear);
    expect(cheap).toBeGreaterThanOrEqual(Math.ceil(config.gravitas.romeBackingCost * config.gravitas.romeBackingMinCostFraction));
  });
});

describe('playtest telemetry', () => {
  it('counts rounds, decisions and haste, and survives a save', () => {
    const g = new Game(createInitialState(0, 3));
    expect(g.state.stats).toEqual(emptyStats());
    for (let i = 0; i < 5; i++) g.act({ type: 'convene' }, i + 1);
    expect(g.state.stats.rounds).toBe(5);
    expect(g.state.stats.peakPopulation).toBeGreaterThan(0);
    const back = deserialise(serialise(g.state));
    expect(back.stats).toEqual(g.state.stats);
  });

  it('records what Rome was told', () => {
    const s = createInitialState(0, 1);
    romeTurn(s);
    s.resources.wood = 1000;
    deliver(s);
    romeTurn(s);
    expect(s.stats.romeRequestsCompleted).toBe(1);
  });

  it('a v1 save without stats or lesser offices migrates', () => {
    const s = createInitialState(0, 1);
    const raw = JSON.parse(serialise(s)) as Record<string, unknown>;
    delete raw.stats; delete raw.lesserPosts;
    const back = deserialise(JSON.stringify(raw));
    expect(back.stats).toEqual(emptyStats());
    expect(Object.keys(back.lesserPosts)).toHaveLength(lesserPosts.length);
  });
});
