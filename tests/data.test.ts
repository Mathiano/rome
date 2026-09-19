import { describe, it, expect } from 'vitest';
import { buildings, posts, tribes, requestProgression, layout, unlocks, RESOURCE_IDS, families, config } from '../src/data';

const KNOWN_EFFECTS = new Set(['gravitasPerRound', 'militiaBonus', 'warehouseCapacity', 'granaryCapacity', 'hiddenPerResource', 'populationCap', 'taxMultiplier', 'tradeRate', 'pietyBonus', 'romeRewardMultiplier', 'productionPerHour']);

describe('data integrity', () => {
  it('has 13 buildings with three tiers each (DESIGN §4.4)', () => {
    expect(buildings).toHaveLength(13);
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
  it('has two active families in v0', () => {
    expect(families.filter((f) => f.active)).toHaveLength(2);
    expect(families.filter((f) => f.active && f.isPlayer)).toHaveLength(1);
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
