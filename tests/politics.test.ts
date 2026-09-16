import { describe, it, expect } from 'vitest';
import { createInitialState, serialise, deserialise } from '../src/state/store';
import { Game } from '../src/game';
import { runRound } from '../src/politics/rounds';
import { appoint, holderOf, updateCorruption, postsHeldBy } from '../src/politics/posts';
import { deathChance, kill, livingMembers, leaderOf, gravitasRank } from '../src/politics/characters';
import { bribe, seekRomeBacking } from '../src/politics/intrigue';
import { config } from '../src/data';

describe('rounds', () => {
  it('a political action runs exactly one round and ages everyone', () => {
    const g = new Game(createInitialState(0, 7));
    const ages = Object.values(g.state.characters).map((c) => c.age);
    g.act({ type: 'convene' }, 1000);
    expect(g.state.round).toBe(1);
    Object.values(g.state.characters).forEach((c, i) => expect(c.age).toBe(ages[i] + 1));
  });
  it('is deterministic from a save (same seed, same outcome)', () => {
    const a = new Game(createInitialState(0, 42));
    const b = new Game(deserialise(serialise(a.state)));
    for (let i = 0; i < 30; i++) {
      a.act({ type: 'convene' }, i * 1000 + 1);
      b.act({ type: 'convene' }, i * 1000 + 1);
    }
    expect(serialise(a.state)).toBe(serialise(b.state));
  });
  it('the game is never over: a dead family gets a new man (Pillar 7)', () => {
    const s = createInitialState(0, 3);
    for (const c of livingMembers(s, 'player')) kill(s, c, 'test');
    const living = livingMembers(s, 'player');
    expect(living).toHaveLength(1);
    expect(living[0].isLeader).toBe(true);
    expect(s.office).toBe(living[0].id);
  });
  it('death chance ramps from lifespan min to max', () => {
    expect(deathChance(config.lifespan.roundsMin - 1)).toBe(0);
    expect(deathChance(config.lifespan.roundsMax)).toBe(1);
    expect(deathChance((config.lifespan.roundsMin + config.lifespan.roundsMax) / 2)).toBeCloseTo(0.5);
  });
});

describe('posts and corruption', () => {
  it('appointing a rival raises their attitude; dismissing lowers it', () => {
    const s = createInitialState(0, 1);
    const before = s.families.cornelii.attitude;
    appoint(s, 'market', 'c_leader');
    expect(s.families.cornelii.attitude).toBe(before + config.posts.attitudeShiftOnAppoint);
    expect(holderOf(s, 'market')!.id).toBe('c_leader');
    appoint(s, 'market', 'p_leader');
    expect(s.families.cornelii.attitude).toBe(before + config.posts.attitudeShiftOnAppoint + config.posts.attitudeShiftOnDismiss);
    expect(postsHeldBy(s, 'cornelii')).toHaveLength(0);
  });
  it('a character holds at most one post', () => {
    const s = createInitialState(0, 1);
    appoint(s, 'market', 'p_son');
    appoint(s, 'works', 'p_son');
    expect(holderOf(s, 'market')).toBeNull();
    expect(holderOf(s, 'works')!.id).toBe('p_son');
  });
  it('corruption rises with unhappy rival post-holders and falls with your own treasurer', () => {
    const s = createInitialState(0, 1);
    appoint(s, 'market', 'c_leader');
    appoint(s, 'works', 'c_son');
    s.families.cornelii.attitude = -60;
    updateCorruption(s);
    expect(s.corruption).toBeGreaterThan(0);
    const high = s.corruption;
    appoint(s, 'treasury', 'p_brother');
    s.families.cornelii.attitude = 40;
    updateCorruption(s);
    expect(s.corruption).toBeLessThan(high);
  });
  it('gravitas accrues for post-holders and rank derives from thresholds', () => {
    const g = new Game(createInitialState(0, 5));
    g.act({ type: 'appoint', postId: 'works', characterId: 'p_son' }, 1);
    for (let i = 0; i < 5; i++) g.act({ type: 'convene' }, i + 2);
    expect(g.state.characters.p_son.gravitas).toBeGreaterThan(0);
    expect(gravitasRank(g.state.characters.p_leader)).toBeGreaterThanOrEqual(0);
  });
});

describe('intrigue', () => {
  it('bribe costs denarii and raises attitude', () => {
    const s = createInitialState(0, 1);
    s.resources.denarii = 1000;
    const before = s.families.cornelii.attitude;
    bribe(s, 'cornelii');
    expect(s.resources.denarii).toBe(1000 - config.intrigue.bribe.cost);
    expect(s.families.cornelii.attitude).toBe(before + config.intrigue.bribe.attitude);
    expect(() => bribe(s, 'player')).toThrow();
  });
  it("Rome's backing spends gravitas stock, not rank", () => {
    const s = createInitialState(0, 1);
    const leader = leaderOf(s, 'player')!;
    expect(() => seekRomeBacking(s)).toThrow();
    leader.gravitas = 50;
    leader.gravitasStock = 20;
    seekRomeBacking(s);
    expect(leader.gravitasStock).toBe(20 - config.gravitas.romeBackingCost);
    expect(leader.gravitas).toBe(50);
  });
});

describe('save', () => {
  it('round-trips through JSON and localStorage-less environments', () => {
    const s = createInitialState(123, 9);
    runRound(s, 200);
    const json = serialise(s);
    const back = deserialise(json);
    expect(back).toEqual(s);
    expect(() => deserialise('{"nope":1}')).toThrow();
  });
});
