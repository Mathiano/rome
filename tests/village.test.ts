import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { accrue, denariiIncomePerHour, netPerHour } from '../src/village/economy';
import { capacity, populationCap } from '../src/village/storage';
import { checkBuild, startBuild, rushPrice, rush, completeFinished } from '../src/village/construction';
import { tick } from '../src/village/clock';
import { building, config } from '../src/data';

const H = 3_600_000;

describe('economy', () => {
  it('accrues linearly and caps at storage (Pillar: Travian storage)', () => {
    const s = createInitialState(0, 1);
    const cap = capacity(s, 'wood');
    accrue(s, 1000 * H);
    expect(s.resources.wood).toBe(cap);
    expect(s.resources.clay).toBe(capacity(s, 'clay'));
    expect(s.resources.grain).toBeLessThanOrEqual(capacity(s, 'grain'));
  });
  it('treasury is uncapped', () => {
    const s = createInitialState(0, 1);
    expect(capacity(s, 'denarii')).toBe(Infinity);
    const before = s.resources.denarii;
    const income = denariiIncomePerHour(s);
    accrue(s, 10 * H);
    expect(s.resources.denarii).toBeCloseTo(before + income * 10, 3);
  });
  it('population grows toward the cap and never exceeds it', () => {
    const s = createInitialState(0, 1);
    accrue(s, 100 * H);
    expect(s.population).toBe(populationCap(s));
  });
  it('grain net accounts for upkeep', () => {
    const s = createInitialState(0, 1);
    const net = netPerHour(s);
    expect(net.grain).toBeCloseTo(building('farm').tiers[0].effects.productionPerHour - s.population * config.population.grainUpkeepPerHeadPerHour, 6);
  });
});

describe('construction', () => {
  it('starts, charges cost and completes at finishAt', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 1000, clay: 1000, iron: 1000, grain: 1000, denarii: 1000 };
    const check = checkBuild(s, 'i1', 'warehouse');
    expect(check.ok).toBe(true);
    const c = startBuild(s, 'i1', 'warehouse', 0);
    expect(s.resources.wood).toBe(1000 - check.cost.wood!);
    expect(completeFinished(s, c.finishAt - 1)).toHaveLength(0);
    expect(completeFinished(s, c.finishAt)).toHaveLength(1);
    expect(s.slots.find((x) => x.id === 'i1')!.tier).toBe(1);
  });
  it('allows one building and one field concurrently, no more (DESIGN §4.4)', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    startBuild(s, 'i1', 'warehouse', 0);
    expect(checkBuild(s, 'i2', 'granary').ok).toBe(false);
    expect(checkBuild(s, 'o2', 'lumber_camp').ok).toBe(true);
    startBuild(s, 'o2', 'lumber_camp', 0);
    expect(checkBuild(s, 'o4', 'clay_works').ok).toBe(false);
  });
  it('rejects a building on the wrong site and duplicates of inner buildings', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    expect(checkBuild(s, 'o2', 'farm').ok).toBe(false);
    startBuild(s, 'i1', 'warehouse', 0);
    completeFinished(s, 1e9);
    expect(checkBuild(s, 'i2', 'warehouse').ok).toBe(false);
  });
  it('gates tiers on the forum tier', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    startBuild(s, 'i1', 'warehouse', 0);
    completeFinished(s, 1e9);
    startBuild(s, 'i1', 'warehouse', 0);
    completeFinished(s, 1e9);
    expect(checkBuild(s, 'i1', 'warehouse').reason).toMatch(/forum tier 2/);
  });
  it('rush price never exceeds what the colony earns in the remaining time (Pillar 3)', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    const c = startBuild(s, 'i1', 'insulae', 0);
    for (const now of [0, c.finishAt / 3, c.finishAt - 1000]) {
      const remainingHours = (c.finishAt - now) / H;
      const earns = denariiIncomePerHour(s) * remainingHours;
      expect(rushPrice(s, c, now)).toBeLessThanOrEqual(Math.max(config.rush.minPrice, Math.ceil(earns)));
    }
    const price = rushPrice(s, c, 0);
    rush(s, 'i1', 0);
    expect(s.resources.denarii).toBe(9999 - price);
    expect(s.slots.find((x) => x.id === 'i1')!.tier).toBe(1);
  });
});

describe('clock', () => {
  it('handles a long offline gap with a construction boundary inside it', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 500, clay: 500, iron: 500, grain: 500, denarii: 500 };
    const c = startBuild(s, 'o2', 'lumber_camp', 0);
    const woodBefore = s.resources.wood;
    tick(s, c.finishAt + H);
    // one hour at the new (higher) rate after completion, plus the pre-completion accrual
    const t1 = building('lumber_camp').tiers[0].effects.productionPerHour;
    const expected = woodBefore + t1 * (c.finishAt / H) + 2 * t1 * 1;
    expect(s.resources.wood).toBeCloseTo(Math.min(expected, capacity(s, 'wood')), 3);
    expect(s.constructions).toHaveLength(0);
  });
  it('never moves the clock backwards into a penalty', () => {
    const s = createInitialState(1000, 1);
    tick(s, 500);
    expect(s.lastTick).toBe(500);
  });
  it('runs idle rounds after the calendar floor, capped', () => {
    const s = createInitialState(0, 1);
    const floor = config.calendarFloorHours * H;
    tick(s, floor - 1);
    expect(s.round).toBe(0);
    tick(s, floor);
    expect(s.round).toBe(1);
    tick(s, floor * 100);
    expect(s.round).toBe(1 + config.idleRoundsMaxCatchUp);
  });
});
