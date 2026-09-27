import { describe, it, expect } from 'vitest';
import { buildings, posts, tribes, requestProgression, layout, unlocks, RESOURCE_IDS, families, config, researchNodes, researchConfig, effectVocabulary } from '../src/data';

const KNOWN_EFFECTS = new Set(['gravitasPerRound', 'militiaBonus', 'warehouseCapacity', 'granaryCapacity', 'hiddenPerResource', 'populationCap', 'taxMultiplier', 'tradeRate', 'pietyBonus', 'romeRewardMultiplier', 'productionPerHour', 'researchSpeed', 'researchRank', 'defence']);
/** Research speaks the same vocabulary, plus the multipliers only it moves. */
const KNOWN_RESEARCH_EFFECTS = new Set([...KNOWN_EFFECTS, 'buildSpeed', 'grainMultiplier', 'materialMultiplier', 'corruptionDrift']);

describe('data integrity', () => {
  it('has 16 buildings with three tiers each (DESIGN §4.4)', () => {
    // 14, plus the wall — its own building since 2026-09-22, not the castellum's
    // tier — plus the barracks, the military counterpart to farms (2026-09-27).
    expect(buildings).toHaveLength(16);
    for (const b of buildings) expect(b.tiers, b.id).toHaveLength(3);
  });
  it('uses only effect keys the code reads', () => {
    for (const b of buildings) for (const t of b.tiers) for (const k of Object.keys(t.effects)) expect(KNOWN_EFFECTS.has(k), `${b.id}: ${k}`).toBe(true);
  });
  it('has words for every effect key a building or a study can carry (data/effects.json)', () => {
    const used = new Set<string>();
    for (const b of buildings) for (const t of b.tiers) for (const k of Object.keys(t.effects)) used.add(k);
    for (const n of researchNodes) for (const k of Object.keys(n.effects)) used.add(k);
    for (const k of used) {
      const w = effectVocabulary[k];
      expect(w, `${k} has no words`).toBeDefined();
      expect(typeof w.noun, k).toBe('string');
      expect(w.noun.length, k).toBeGreaterThan(0);
      expect(typeof w.unit, k).toBe('string');
    }
    // and nothing in the vocabulary is a key no data uses
    for (const k of Object.keys(effectVocabulary)) expect(used.has(k), `${k} is worded but never used`).toBe(true);
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

  it('fits one of every town building inside the smallest wall (§4.5 C.1)', () => {
    // C.1 says one of each costs about 23 cells and tier 0 leaves room for a
    // dozen more; a save moved off the ring layout must always find room.
    const town = buildings.filter((b) => b.zone === 'town');
    const cells = town.reduce((n, b) => n + (b.footprint ?? [1, 1])[0] * (b.footprint ?? [1, 1])[1], 0);
    const smallest = layout.grid.sizeByWallTier[0] ** 2;
    expect(cells).toBeLessThan(smallest);
    // the wall only ever grows the town
    const sizes = layout.grid.sizeByWallTier;
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    expect(sizes).toHaveLength(buildings.find((b) => b.id === 'wall')!.tiers.length + 1);
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
  it('layout: every site has a field building; every building knows where it stands', () => {
    for (const s of layout.sites) expect(buildings.some((b) => b.zone === 'site' && b.site === s.site), s.id).toBe(true);
    for (const b of buildings) {
      expect(['town', 'site', 'wall'], b.id).toContain(b.zone);
      if (b.zone === 'town') expect(b.footprint, b.id).toHaveLength(2);
      if (b.zone === 'site') expect(b.site, b.id).toBeDefined();
    }
    // the sprite plate is one cell across (CLAUDE.md, Sprites)
    expect(layout.cellTiles).toBeGreaterThan(0);
  });
  it('lifespan window is inside the proposed 120–200 range', () => {
    expect(config.lifespan.roundsMin).toBeGreaterThanOrEqual(120);
    expect(config.lifespan.roundsMax).toBeLessThanOrEqual(200);
  });
});
