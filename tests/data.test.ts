import { describe, it, expect } from 'vitest';
import { buildings, posts, tribes, requestProgression, layout, unlocks, RESOURCE_IDS, families, config, researchNodes, researchConfig } from '../src/data';

const KNOWN_EFFECTS = new Set(['gravitasPerRound', 'militiaBonus', 'warehouseCapacity', 'granaryCapacity', 'hiddenPerResource', 'populationCap', 'taxMultiplier', 'tradeRate', 'pietyBonus', 'romeRewardMultiplier', 'productionPerHour', 'researchSpeed', 'researchRank']);
/** Research speaks the same vocabulary, plus the multipliers only it moves. */
const KNOWN_RESEARCH_EFFECTS = new Set([...KNOWN_EFFECTS, 'buildSpeed', 'grainMultiplier', 'materialMultiplier', 'defence', 'corruptionDrift']);

describe('data integrity', () => {
  it('has 14 buildings with three tiers each (DESIGN §4.4)', () => {
    expect(buildings).toHaveLength(14);
    for (const b of buildings) expect(b.tiers, b.id).toHaveLength(3);
  });
  it('uses only effect keys the code reads', () => {
    for (const b of buildings) for (const t of b.tiers) for (const k of Object.keys(t.effects)) expect(KNOWN_EFFECTS.has(k), `${b.id}: ${k}`).toBe(true);
  });
  it('tier costs and times rise', () => {
    for (const b of buildings) for (let i = 1; i < b.tiers.length; i++) {
      expect(b.tiers[i].buildSeconds).toBeGreaterThan(b.tiers[i - 1].buildSeconds);
      const sum = (c: Record<string, number | undefined>) => Object.values(c).reduce<number>((acc, v) => acc + (v ?? 0), 0);
      expect(sum(b.tiers[i].cost)).toBeGreaterThan(sum(b.tiers[i - 1].cost));
    }
  });
  it('has a research tree the code can actually read (DESIGN §4.6)', () => {
    expect(researchNodes.length).toBeGreaterThanOrEqual(8);
    expect(researchConfig.concurrent).toBeGreaterThanOrEqual(1);
    const ids = new Set(researchNodes.map((n) => n.id));
    expect(ids.size).toBe(researchNodes.length);
    const ranks = new Set<number>();
    for (const n of researchNodes) {
      ranks.add(n.rank);
      expect(n.rank, n.id).toBeGreaterThanOrEqual(1);
      expect(n.seconds, n.id).toBeGreaterThan(0);
      expect(Object.keys(n.effects).length, n.id).toBeGreaterThan(0);
      expect(n.description.length, n.id).toBeGreaterThan(10);
      for (const k of Object.keys(n.effects)) expect(KNOWN_RESEARCH_EFFECTS.has(k), `${n.id}: ${k}`).toBe(true);
      for (const r of n.requires) {
        expect(ids.has(r), `${n.id} requires ${r}`).toBe(true);
        // a prerequisite must be reachable before the node that needs it
        expect(researchNodes.find((x) => x.id === r)!.rank, `${n.id} < ${r}`).toBeLessThanOrEqual(n.rank);
      }
    }
    // one rank per Library tier, and the Library must open all of them
    expect([...ranks].sort()).toEqual([1, 2, 3]);
    const library = buildings.find((b) => b.id === 'library')!;
    expect(library.tiers.map((t) => t.effects.researchRank)).toEqual([1, 2, 3]);
    // every node must be affordable in principle: cost rises with rank
    const byRank = (r: number) => researchNodes.filter((n) => n.rank === r).map((n) => n.cost.denarii ?? 0);
    expect(Math.min(...byRank(2))).toBeGreaterThan(Math.max(...byRank(1)));
    expect(Math.min(...byRank(3))).toBeGreaterThan(Math.max(...byRank(2)));
  });

  it('gives the Library a plot to stand on', () => {
    const inner = layout.slots.filter((s) => s.ring === 'inner');
    const innerBuildings = buildings.filter((b) => b.ring === 'inner');
    expect(inner.length).toBeGreaterThanOrEqual(innerBuildings.length);
    // and no two plots may sit on top of each other once projected. The forum
    // and the castellum are the one deliberately tight pair, at 36px; the inner
    // ring never comes closer to itself than 58, which is where i8 sits too.
    const seen: { sx: number; sy: number; id: string; ring: string }[] = [];
    for (const s of layout.slots) {
      const sx = ((s.x - s.y) * layout.tile.w) / 2;
      const sy = ((s.x + s.y) * layout.tile.h) / 2;
      for (const o of seen) {
        const d = Math.hypot(sx - o.sx, sy - o.sy);
        const floor = s.ring === 'inner' && o.ring === 'inner' ? 55 : 35;
        expect(d, `${s.id} and ${o.id}`).toBeGreaterThanOrEqual(floor);
      }
      seen.push({ sx, sy, id: s.id, ring: s.ring });
    }
  });

  it('has five council posts in v0 (DESIGN §13)', () => {
    expect(posts).toHaveLength(5);
  });
  it('has three tribes, all awake, with a coherent like and hate web (DESIGN §7)', () => {
    expect(tribes).toHaveLength(3);
    expect(tribes.filter((t) => t.active)).toHaveLength(3);
    const ids = new Set(tribes.map((t) => t.id));
    for (const t of tribes) {
      for (const other of [...t.likes, ...t.hates]) {
        expect(ids.has(other), `${t.id} names ${other}`).toBe(true);
        expect(other).not.toBe(t.id);
      }
      expect(t.likes.filter((x) => t.hates.includes(x)), `${t.id} both likes and hates`).toHaveLength(0);
    }
    // the web has to actually connect, or warming to one cools nobody
    expect(tribes.some((t) => t.hates.length > 0)).toBe(true);
    expect(tribes.some((t) => t.likes.length > 0)).toBe(true);
    expect(new Set(tribes.map((t) => t.archetype)).size).toBe(3);
  });
  it('has four houses awake, exactly one of them the player\'s (DESIGN §9.1)', () => {
    const active = families.filter((f) => f.active);
    expect(active).toHaveLength(4);
    expect(active.filter((f) => f.isPlayer)).toHaveLength(1);
    for (const f of active) {
      expect(f.members.length, f.id).toBeGreaterThanOrEqual(3);
      expect(f.members.filter((m) => m.isLeader), f.id).toHaveLength(1);
      expect(new Set(f.members.map((m) => m.id)).size).toBe(f.members.length);
    }
    // every id unique across houses, or posts and portraits collide
    const ids = active.flatMap((f) => f.members.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('requests reference real buildings and unlocks', () => {
    expect(requestProgression.length).toBeGreaterThanOrEqual(15);
    for (const r of requestProgression) {
      if (r.build) expect(buildings.some((b) => b.id === r.build!.building), r.id).toBe(true);
      if (r.reward.unlock) expect(unlocks[r.reward.unlock], r.id).toBeDefined();
      if (r.deliver) for (const k of Object.keys(r.deliver)) expect(RESOURCE_IDS).toContain(k);
    }
  });
  it('layout: every outer slot has a site matching a field building; centre slots are pinned', () => {
    for (const s of layout.slots) {
      if (s.ring === 'outer') expect(buildings.some((b) => b.site === s.site), s.id).toBe(true);
      if (s.ring === 'centre') expect(s.fixedBuilding).toBeDefined();
    }
    expect(layout.slots.filter((s) => s.ring === 'inner').length).toBe(buildings.filter((b) => b.ring === 'inner').length);
  });
  it('lifespan window is inside the proposed 120–200 range', () => {
    expect(config.lifespan.roundsMin).toBeGreaterThanOrEqual(120);
    expect(config.lifespan.roundsMax).toBeLessThanOrEqual(200);
  });
});
