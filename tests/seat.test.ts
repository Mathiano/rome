// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { building, buildings, config, layout, type BuildingDef } from '../src/data';
import { checkBuild, checkPlace, completeFinished, copyFactor, placeBuild, startBuild } from '../src/village/construction';
import { adjacencyGains, colonyTier, sumEffect } from '../src/village/storage';
import { anchors, cellsOf, centreOf, enclosure, enclosureOfSize, inRect, neighbours } from '../src/village/grid';
import { renderPanel } from '../src/render/panel';
import { spriteManifest } from '../src/render/sprites';
import type { GameState } from '../src/state/types';

const PLENTY = { wood: 99999, clay: 99999, iron: 99999, grain: 99999, denarii: 99999 };
const rich = (s: GameState) => { s.resources = { ...PLENTY }; return s; };
function stand(s: GameState, id: string, at = anchors(s, id)[0]): string {
  const c = placeBuild(s, id, at.x, at.y, 0);
  completeFinished(s, 1e12);
  return c.slotId;
}

describe('the praetorium is the seat (DESIGN §4.4, B.1 ✅)', () => {
  it('stands at the founding, unique and 2×2, and its tier is the colony\'s', () => {
    const s = createInitialState(0, 1);
    const seat = s.slots.find((x) => x.building === 'praetorium')!;
    expect(seat.tier).toBe(1);
    expect(building('praetorium')).toMatchObject({ unique: true, footprint: [2, 2], zone: 'town' });
    expect(colonyTier(s)).toBe(1);
    seat.tier = 3;
    expect(colonyTier(s)).toBe(3);
  });

  it('gates every other building on its tier, and is itself exempt', () => {
    const s = rich(createInitialState(0, 1));
    // Library II needs the colony at II
    const lib = stand(s, 'library');
    expect(checkBuild(s, lib, 'library').gates).toContain('colony');
    // the praetorium's own next tier is never gated on itself
    const seat = s.slots.find((x) => x.building === 'praetorium')!;
    expect(checkBuild(s, seat.id, 'praetorium').gates).not.toContain('colony');
    for (const b of buildings) for (const t of b.tiers) expect(typeof t.requiresColonyTier, b.id).toBe('number');
  });

  it('folds the market into the forum: no market building, and trade and tax are the forum\'s', () => {
    expect(buildings.some((b) => b.id === 'market')).toBe(false);
    const forum = building('forum');
    expect(forum).toMatchObject({ unique: true, footprint: [2, 2] });
    expect(forum.tiers[0].effects).toMatchObject({ taxMultiplier: expect.any(Number), tradeRate: expect.any(Number) });
    const s = rich(createInitialState(0, 1));
    const before = sumEffect(s, 'taxMultiplier');
    stand(s, 'forum');
    expect(sumEffect(s, 'taxMultiplier')).toBe(before + forum.tiers[0].effects.taxMultiplier);
    // no market sprite lingers once the building is gone
    expect(Object.keys(spriteManifest.sprites).some((k) => k.startsWith('market-'))).toBe(false);
    // the seat has a drawn placeholder for every tier until its still passes artgen
    for (const t of [1, 2, 3]) expect(spriteManifest.sprites[`praetorium-t${t}`], `praetorium-t${t}`).toBeDefined();
  });

  it('says the praetorium on the header and the summary, never the forum as the colony\'s tier', () => {
    const g = new Game(createInitialState(0, 1));
    const html = renderPanel(g, 'village', null, 1);
    expect(html).toContain('Praetorium I <span class="muted">— the colony\'s tier');
  });
});

describe('costs rise per copy (DESIGN §4.4, 🟡 _tuning)', () => {
  const k = config.repeatables.costGrowthPerCopy;

  it('prices each further copy of a repeatable building up, and never a unique one', () => {
    expect(copyFactor('warehouse', 0)).toBe(1);
    expect(copyFactor('warehouse', 2)).toBeCloseTo((1 + k) ** 2, 9);
    expect(copyFactor('temple', 5)).toBe(1);
    const s = rich(createInitialState(0, 1));
    const first = checkPlace(s, 'warehouse').cost.wood!;
    stand(s, 'warehouse');
    const second = checkPlace(s, 'warehouse').cost.wood!;
    expect(second).toBe(Math.ceil(building('warehouse').tiers[0].cost.wood! * (1 + k)));
    expect(second).toBeGreaterThan(first);
  });

  it('fixes a copy\'s number when it is first built, so a later copy never re-prices an earlier one', () => {
    const s = rich(createInitialState(0, 1));
    // the founding farm stands on grain1; a second farm goes on grain2
    const founding = s.slots.find((x) => x.building === 'farm')!;
    const upgradeBefore = checkBuild(s, founding.id, 'farm').cost.wood!;
    startBuild(s, 'grain2', 'farm', 0);
    completeFinished(s, 1e12);
    expect(s.slots.find((x) => x.id === 'grain2')!.copy).toBe(1);
    expect(checkBuild(s, founding.id, 'farm').cost.wood).toBe(upgradeBefore);
    expect(checkBuild(s, 'grain2', 'farm').cost.wood!).toBeGreaterThan(upgradeBefore);
  });

  it('says on the Place row how much dearer the next one is', () => {
    const g = new Game(rich(createInitialState(0, 1)));
    stand(g.state, 'warehouse');
    const html = renderPanel(g, 'village', null, 1);
    expect(html).toMatch(new RegExp(`data-unplaced="warehouse">[\\s\\S]*?1 standing, this one ${Math.round(k * 100)}% dearer`));
  });
});

describe('adjacency, scaffolding only (DESIGN §4.5 C.3 ❓)', () => {
  it('ships with no rule defined', () => {
    expect(buildings.filter((b) => b.adjacency?.length)).toEqual([]);
  });

  it('counts only edge neighbours, standing ones, and adds each rule once per neighbour', () => {
    const def = building('granary') as BuildingDef;
    def.adjacency = [{ beside: 'warehouse', effects: { granaryCapacity: 50 } }];
    try {
      const s = rich(createInitialState(0, 1));
      const gid = stand(s, 'granary', { x: 2, y: 1 });
      const g = s.slots.find((x) => x.id === gid)!;
      const base = sumEffect(s, 'granaryCapacity');
      // a warehouse on each side, one on a diagonal, one still rising
      stand(s, 'warehouse', { x: 3, y: 1 });
      stand(s, 'warehouse', { x: 2, y: 2 });
      stand(s, 'warehouse', { x: 3, y: 2 });
      placeBuild(s, 'warehouse', 2, 0, 0);
      // the praetorium (anchored 0,0, 2×2) touches it from the left; the diagonal warehouse does not
      expect(neighbours(s, g).map((n) => `${n.building}@${n.x},${n.y}`).sort()).toEqual(['praetorium@0,0', 'warehouse@2,0', 'warehouse@2,2', 'warehouse@3,1']);
      expect(adjacencyGains(s, g)).toEqual([{ beside: 'warehouse', count: 2, effects: { granaryCapacity: 100 } }]);
      expect(sumEffect(s, 'granaryCapacity')).toBe(base + 100);
      // and the plot card says so
      const html = renderPanel(new Game(s), 'village', g.id, 1);
      expect(html).toContain('data-adjacency="granary"');
      expect(html).toMatch(/beside Warehouse: grain kept 50 for each — 2 beside it now, grain kept 100/);
      // the placing card states the rule alone
      expect(renderPanel(new Game(s), 'village', null, 1, null, 'granary')).toMatch(/beside Warehouse: grain kept 50 for each<\/li>/);
    } finally {
      delete def.adjacency;
    }
  });

  it('shows nothing for a building with no rule', () => {
    const s = createInitialState(0, 1);
    const seat = s.slots.find((x) => x.building === 'praetorium')!;
    expect(renderPanel(new Game(s), 'village', seat.id, 1)).not.toContain('data-adjacency');
  });
});

describe('the praetorium is fixed at the centre (Mathias, 2026-09-28)', () => {
  it('stands at the founding on the centre of the tier-III grid, as near as a 2×2 can', () => {
    const s = createInitialState(0, 1);
    const seat = s.slots.find((x) => x.building === 'praetorium')!;
    const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
    const centre = centreOf(seat);
    expect({ x: seat.x, y: seat.y }).toEqual({ x: 0, y: 0 });
    // the 9×9 grid's centre is a cell's centre; a 2×2's is a corner, half a cell off at most
    expect(Math.abs(centre.x - (big.x0 + big.x1 + 1) / 2)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(centre.y - (big.y0 + big.y1 + 1) / 2)).toBeLessThanOrEqual(0.5);
    // and inside the founding wall
    for (const c of cellsOf(seat)) expect(inRect(enclosure(s), c.x, c.y)).toBe(true);
  });

  it('is never placed or moved by the player', () => {
    const s = rich(createInitialState(0, 1));
    expect(building('praetorium').placement).toBe('fixed');
    expect(checkPlace(s, 'praetorium').gates).toContain('ineligible');
    // even with the founding one gone, no cell takes it
    s.slots = s.slots.filter((x) => x.building !== 'praetorium');
    expect(checkPlace(s, 'praetorium').gates).toContain('ineligible');
    expect(checkPlace(s, 'praetorium', { x: 0, y: 0 }).ok).toBe(false);
    // no cell but its founding one could ever hold it
    expect(anchors(s, 'praetorium')).toEqual([{ x: 0, y: 0 }]);
    expect(renderPanel(new Game(s), 'village', null, 1)).not.toContain('data-unplaced="praetorium"');
  });
});
