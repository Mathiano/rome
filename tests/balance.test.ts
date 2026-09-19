import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { checkBuild } from '../src/village/construction';
import { defenceStrength, raidStrength } from '../src/combat/raids';
import { config } from '../src/data';

const H = 3_600_000;
const SEEDS = 12;
const ROUNDS = 40;

/** A colony that only convenes the council and never builds anything. */
function idleColony(seed: number) {
  const g = new Game(createInitialState(0, seed));
  let firstRaid = -1;
  for (let i = 0; i < ROUNDS; i++) {
    g.act({ type: 'convene' }, i + 1);
    if (g.state.pendingChoice) g.state.pendingChoice = null;
    if (firstRaid < 0 && g.state.stats.raidsSuffered > 0) firstRaid = g.state.round;
  }
  return { g, firstRaid };
}

/** A colony that raises its castellum as soon as it can pay for it. */
function buildingColony(seed: number) {
  const g = new Game(createInitialState(0, seed));
  let t = 1;
  for (let i = 0; i < ROUNDS; i++) {
    t += H;
    g.tick(t);
    for (const [slot, want] of [['c2', 'castellum'], ['o5', 'iron_mine'], ['i1', 'warehouse']] as const) {
      if (checkBuild(g.state, slot, want).ok) { g.build(slot, want, t); break; }
    }
    g.act({ type: 'convene' }, t);
    if (g.state.pendingChoice) g.state.pendingChoice = null;
  }
  return g;
}

/**
 * These are balance guards, not unit tests. They exist because the telemetry
 * added in this session immediately showed the opening was unsurvivable: every
 * colony was raided by round 4 and not one raid was ever thrown back. If a
 * future tuning pass breaks the shape below, that is worth knowing.
 */
describe('balance: raids answer to the castellum', () => {
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
    expect(raids / SEEDS).toBeLessThan(9);
    expect(repelled / raids).toBeLessThan(0.25);
    expect(lost).toBeGreaterThan(0);
  });

  it('a colony that raises its castellum throws most raids back, but is never safe', () => {
    let raids = 0, repelled = 0, lost = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = buildingColony(seed);
      raids += g.state.stats.raidsSuffered;
      repelled += g.state.stats.raidsRepelled;
      lost += g.state.stats.goodsLostToRaids;
      // the tribe keeps pace, so walls stay a race rather than a solved problem
      expect(raidStrength(g.state), `seed ${seed}`).toBeGreaterThan(config.raid.baseDefence * 2);
    }
    const rate = repelled / raids;
    expect(rate, `repelled ${repelled}/${raids}`).toBeGreaterThan(0.5);
    expect(rate).toBeLessThan(1);
    expect(lost).toBeGreaterThan(0);
  });

  it('walls are worth more than doing nothing, by a wide margin', () => {
    const idle = idleColony(1).g;
    const built = buildingColony(1);
    expect(defenceStrength(built.state)).toBeGreaterThan(defenceStrength(idle.state) * 2);
    expect(built.state.stats.goodsLostToRaids).toBeLessThan(idle.state.stats.goodsLostToRaids);
  });
});
