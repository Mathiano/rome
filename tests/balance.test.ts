import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { defenceStrength, raidStrength } from '../src/combat/raids';
import { grainUpkeepPerHour, netPerHour, outputValuePerHour, productionPerHour } from '../src/village/economy';
import { checkBuild, rushPrice } from '../src/village/construction';
import { config } from '../src/data';
import type { GameState } from '../src/state/types';
/** v0.1 woke the other two tribes; these tests speak to the raider. */
const TRIBE_ID = 'chatti';
const TRIBE = (s: GameState) => s.tribes[TRIBE_ID];

const H = 3_600_000;
const SEEDS = 12;
const ROUNDS = 40;

const WANTED = [['w1', 'wall'], ['c2', 'castellum'], ['o5', 'iron_mine'], ['i1', 'warehouse']] as const;

/** Raise the first affordable thing on the list. */
function buildSomething(g: Game, t: number) {
  for (const [slot, want] of WANTED) {
    if (checkBuild(g.state, slot, want).ok) { g.build(slot, want, t); return; }
  }
}

/**
 * Grant a standing demand, or else fill a vacant post with a rival's kin —
 * the two things DESIGN §9.5 says keep a house voting for you.
 */
function keepTheHouses(g: Game, t: number): boolean {
  const st = g.state;
  for (const f of Object.values(st.families)) {
    if (f.isPlayer || !f.demand) continue;
    const can = f.demand.kind === 'denarii' ? st.resources.denarii >= (f.demand.denarii ?? 0) : true;
    if (!can) break;
    try { g.act({ type: 'accept_demand', familyId: f.id }, t); return true; } catch { return false; }
  }
  for (const p of ['works', 'granary', 'market', 'garrison', 'treasury']) {
    if (st.posts[p]) continue;
    const who = Object.values(st.characters).find((c) => c.alive && !c.post && !st.families[c.familyId].isPlayer);
    if (!who) break;
    try { g.act({ type: 'appoint', postId: p, characterId: who.id }, t); return true; } catch { return false; }
  }
  return false;
}

/** One colony played for ROUNDS rounds under a fixed policy. */
function colony(seed: number, policy: { build?: boolean; houses?: boolean }) {
  const g = new Game(createInitialState(0, seed));
  let firstRaid = -1;
  let t = 1;
  for (let i = 0; i < ROUNDS; i++) {
    t += H;
    g.tick(t);
    if (policy.build) buildSomething(g, t);
    let acted = false;
    if (policy.houses) acted = keepTheHouses(g, t);
    if (!acted) g.act({ type: 'convene' }, t);
    if (g.state.pendingChoice) g.state.pendingChoice = null;
    if (firstRaid < 0 && g.state.stats.raidsSuffered > 0) firstRaid = g.state.round;
  }
  return { g, firstRaid };
}

/** Convenes the council and nothing else. */
const idleColony = (seed: number) => colony(seed, {});
/** Raises the wall and the castellum, ignores the houses — and so loses the office and is obstructed. */
const buildingColony = (seed: number) => colony(seed, { build: true }).g;
/** Keeps the houses in office, never raises a wall. */
const politicColony = (seed: number) => colony(seed, { houses: true }).g;
/** Does both: the shape the game is balanced to reward. */
const competentColony = (seed: number) => colony(seed, { build: true, houses: true }).g;

const repelRate = (g: Game) => g.state.stats.raidsSuffered
  ? g.state.stats.raidsRepelled / g.state.stats.raidsSuffered : 1;

/**
 * These are balance guards, not unit tests. They exist because the telemetry
 * added in this session immediately showed the opening was unsurvivable: every
 * colony was raided by round 4 and not one raid was ever thrown back. If a
 * future tuning pass breaks the shape below, that is worth knowing.
 *
 * The shape, re-measured over 12 seeds × 40 rounds once the wall became a
 * building of its own (2026-09-22): idle repels 3%, walls alone 34%, politics
 * alone 16%, both 86%. Walls are the lever; holding the office is the
 * multiplier, because a colony that loses it is obstructed by its rivals. The
 * walls arm fell from 42% because the circuit and the castellum now compete
 * for the same one-building-at-a-time slot.
 */
describe('balance: raids answer to the wall', () => {
  it('nobody is raided before they could have built anything', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { firstRaid } = idleColony(seed);
      if (firstRaid > 0) expect(firstRaid, `seed ${seed}`).toBeGreaterThanOrEqual(config.raid.graceRounds);
    }
  });

  it('a colony that ignores its walls is stripped, but never collapses beyond recovery', () => {
    let raids = 0, repelled = 0, lost = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { g } = idleColony(seed);
      raids += g.state.stats.raidsSuffered;
      repelled += g.state.stats.raidsRepelled;
      lost += g.state.stats.goodsLostToRaids;
      expect(g.state.population, `seed ${seed}`).toBeGreaterThan(0);          // Pillar 7
      expect(Object.keys(g.state.characters).length).toBeGreaterThan(0);
    }
    expect(raids / SEEDS).toBeGreaterThan(1);
    // Three tribes raid on their own account, so pressure is roughly triple a
    // single tribe's. Managing them apart is the answer, not out-walling all three.
    expect(raids / SEEDS).toBeLessThan(18);
    expect(repelled / raids).toBeLessThan(0.25);
    expect(lost).toBeGreaterThan(0);
  });

  it('a colony that both walls and governs throws most raids back, but is never safe', () => {
    let raids = 0, repelled = 0, lost = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = competentColony(seed);
      raids += g.state.stats.raidsSuffered;
      repelled += g.state.stats.raidsRepelled;
      lost += g.state.stats.goodsLostToRaids;
      // the tribe keeps pace, so walls stay a race rather than a solved problem
      expect(raidStrength(g.state, TRIBE(g.state)), `seed ${seed}`).toBeGreaterThan(config.raid.baseDefence * 2);
    }
    const rate = repelled / raids;
    expect(rate, `repelled ${repelled}/${raids}`).toBeGreaterThan(0.7);
    expect(rate).toBeLessThan(1);
    expect(lost).toBeGreaterThan(0);
  });

  it('walls alone still beat nothing by a wide margin, even out of office', () => {
    let idleRepelled = 0, builtRepelled = 0, idleRaids = 0, builtRaids = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const idle = idleColony(seed).g;
      const built = buildingColony(seed);
      idleRaids += idle.state.stats.raidsSuffered;
      builtRaids += built.state.stats.raidsSuffered;
      idleRepelled += idle.state.stats.raidsRepelled;
      builtRepelled += built.state.stats.raidsRepelled;
      // An idle colony sits at a flat 17 on every seed: the ditch and bank plus
      // the militia it grows anyway. One wall tier doubles that; the seeds
      // whose economy reached tier 2 more than triple it.
      expect(defenceStrength(built.state), `seed ${seed}`)
        .toBeGreaterThanOrEqual(defenceStrength(idle.state) * 2);
    }
    // Goods lost in absolute terms flatters a colony too poor to own anything.
    // The honest comparison is the share of raids thrown back. Walls without
    // politics cost you the office and the rivals then obstruct you, so this
    // arm sits well below competentColony's 86% — but far above idle's 3%.
    const idleRate = idleRepelled / idleRaids;
    const builtRate = builtRepelled / builtRaids;
    expect(builtRate, `walls ${builtRate.toFixed(2)} vs idle ${idleRate.toFixed(2)}`)
      .toBeGreaterThan(idleRate + 0.25);
    expect(builtRate).toBeLessThan(repelRate(competentColony(1)));
  });

  it('a colony that ignores its houses loses the office; one that keeps them in it does not', () => {
    let ignoredLost = 0;
    let engagedLost = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const ignored = idleColony(seed).g;
      if (ignored.state.stats.roundsOutOfOffice > 0) ignoredLost += 1;
      // Pillar 7: out of power is a setback, never an end
      expect(Object.values(ignored.state.characters).some((c) => c.alive)).toBe(true);
      expect(ignored.state.office).not.toBeNull();

      const engaged = politicColony(seed);
      if (engaged.state.stats.roundsOutOfOffice > 0) engagedLost += 1;
    }
    expect(ignoredLost, 'ignoring every house should cost the office').toBeGreaterThan(SEEDS / 2);
    expect(engagedLost, 'keeping the houses in office should hold it').toBeLessThan(SEEDS / 3);
  });
});

/**
 * The first playtest found both of these by feel; the numbers agreed.
 */
describe('balance: haste and hunger', () => {
  it('haste is priced against everything the colony makes, not just its tax', () => {
    const g = new Game(createInitialState(0, 3));
    const s = g.state;
    // the tax take alone is a small fraction of what an hour is actually worth
    expect(outputValuePerHour(s)).toBeGreaterThan(netPerHour(s).denarii * 4);

    const quotes: number[] = [];
    for (const [slot, b] of [['c2', 'castellum'], ['i1', 'warehouse'], ['c1', 'forum']] as const) {
      const c = checkBuild(s, slot, b);
      const work = { slotId: slot, buildingId: b, toTier: c.toTier, kind: 'building' as const, startedAt: 0, finishAt: c.seconds * 1000 };
      const price = rushPrice(s, work, 0);
      quotes.push(price);
      // Pillar 3, the ceiling: never more than the colony produces in that time
      expect(price, b).toBeLessThanOrEqual(Math.ceil(outputValuePerHour(s) * (c.seconds / 3600)) + config.rush.minPrice);
    }
    // and the floor: a short job may be cheap, but never free
    for (const q of quotes) expect(q).toBeGreaterThanOrEqual(config.rush.minPrice);
    // an hour-long job is a real decision against a starting purse of 80
    expect(quotes[2]).toBeGreaterThan(30);
  });

  it('a colony that grows must feed itself', () => {
    const g = new Game(createInitialState(0, 3));
    const s = g.state;
    // at the founding, one farm comfortably feeds twenty
    expect(netPerHour(s).grain).toBeGreaterThan(0);
    // but the granary has to guard something: upkeep is a real share of yield
    expect(grainUpkeepPerHour(s)).toBeGreaterThan(productionPerHour(s).grain * 0.1);
    // and growing past what insulae allow outruns a single farm
    s.population = config.population.baseCap * 4;
    expect(netPerHour(s).grain, 'a large colony on one farm should starve').toBeLessThan(0);
  });

  it('hunger stalls growth and never kills (Pillar 6)', () => {
    const g = new Game(createInitialState(0, 3));
    // An empty granary is not hunger while a farm still stands: the store
    // refills within the hour. Hunger is having nothing that grows grain.
    for (const slot of g.state.slots) {
      if (slot.building === 'farm') { slot.building = null; slot.tier = 0; }
    }
    g.state.resources.grain = 0;
    expect(netPerHour(g.state).grain).toBeLessThan(0);
    const before = g.state.population;
    g.tick(1 + 6 * H);
    expect(g.state.population, 'nobody starves to death').toBeGreaterThanOrEqual(before);
    expect(g.state.population, 'but nobody arrives either').toBeLessThanOrEqual(before + 0.001);
    expect(Object.values(g.state.characters).some((c) => c.alive)).toBe(true);
  });
});
