import { describe, it, expect } from 'vitest';
import { biomes, buildings, layout } from '../src/data';
import { createInitialState } from '../src/state/store';
import { checkBuild, eligibleBuildings } from '../src/village/construction';
import { enclosureOfSize, inRect } from '../src/village/grid';
import { project } from '../src/render/environment';

const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
const riverX = big.x1 + 1 + layout.grid.riverbankDepth;
/** A slot's compass bearing from the largest town's centre, on screen: 0 is up (north), 90 right (east). */
function bearing(x: number, y: number): number {
  const [cx, cy] = project((big.x0 + big.x1 + 1) / 2, (big.y0 + big.y1 + 1) / 2);
  const [sx, sy] = project(x + 0.5, y + 0.5);
  return (Math.atan2(sx - cx, -(sy - cy)) * 180 / Math.PI + 360) % 360;
}
const within = (b: number, from: number, to: number) => (from <= to ? b >= from && b <= to : b >= from || b <= to);

describe('resource biomes (DESIGN §4.5 C.2, ✅ Mathias 2026-09-28)', () => {
  it('are four, one resource building each, with three slots apiece', () => {
    expect(Object.keys(biomes).sort()).toEqual(['clay', 'grain', 'iron', 'wood']);
    const siteOf = { wood: 'forest', clay: 'clay_bank', iron: 'iron_seam', grain: 'farmland' } as const;
    for (const [id, b] of Object.entries(biomes)) {
      expect(b.site, id).toBe(siteOf[id as keyof typeof siteOf]);
      expect(b.slots, id).toHaveLength(3);
      expect(buildings.filter((d) => d.zone === 'site' && d.site === b.site), id).toHaveLength(1);
    }
    expect(layout.sites).toHaveLength(12);
    expect(new Set(layout.sites.map((s) => s.id)).size).toBe(12);
  });

  it('lie where Mathias put them: wood north and north-west, clay north-east, iron at the south end by the river, grain south-west', () => {
    const sector = { wood: [280, 15], clay: [20, 90], iron: [170, 230], grain: [225, 275] } as const;
    for (const s of layout.sites) {
      const [from, to] = sector[s.biome as keyof typeof sector];
      expect(within(bearing(s.x, s.y), from, to), `${s.id} at bearing ${bearing(s.x, s.y).toFixed(0)}`).toBe(true);
    }
    // wood reaches both north and north-west
    const wood = layout.sites.filter((s) => s.biome === 'wood').map((s) => bearing(s.x, s.y));
    expect(wood.some((b) => within(b, 345, 15))).toBe(true);
    expect(wood.some((b) => within(b, 280, 330))).toBe(true);
    // the iron cliffs stand by the water
    for (const s of layout.sites.filter((x) => x.biome === 'iron')) expect(riverX - (s.x + 1), s.id).toBeLessThanOrEqual(2);
  });

  it('stand outside the largest wall with a cell to spare, off the bank, out of the river, and never side by side', () => {
    const margin = { x0: big.x0 - 1, x1: big.x1 + 1, y0: big.y0 - 1, y1: big.y1 + 1 };
    const cells = new Set(layout.sites.map((s) => `${s.x},${s.y}`));
    for (const s of layout.sites) {
      expect(inRect(margin, s.x, s.y), s.id).toBe(false);
      expect(s.x, `${s.id} in the river`).toBeLessThan(riverX);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(cells.has(`${s.x + dx},${s.y + dy}`), `${s.id} has a neighbour`).toBe(false);
    }
  });

  it('take their own resource building and no other, so a repeatable one is bounded by its biome', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    for (const slot of s.slots.filter((x) => x.zone === 'site' && !x.building)) {
      const own = buildings.find((d) => d.zone === 'site' && d.site === biomes[layout.sites.find((l) => l.id === slot.id)!.biome].site)!;
      expect(eligibleBuildings(s, slot), slot.id).toEqual([own.id]);
      for (const other of buildings.filter((d) => d.zone === 'site' && d.id !== own.id)) {
        expect(checkBuild(s, slot.id, other.id).gates, `${other.id} on ${slot.id}`).toContain('ineligible');
      }
    }
    // three farms at most: the grain biome's slots are all there is
    expect(s.slots.filter((x) => x.zone === 'site' && x.site === 'farmland')).toHaveLength(3);
  });
});
