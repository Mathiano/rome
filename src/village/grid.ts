/**
 * The town grid (DESIGN §4.5 C.1): a rectangle of cells inside a rectangular
 * wall, the Roman colonial plan. The player places any town building on free
 * cells that fit its footprint; the wall's tier sets how many cells there are.
 *
 * The enclosure grows away from the river. Its river edge is fixed at
 * `grid.riverEdge`, each larger size adds cells on the land side, and every
 * size contains the one before it — so raising the wall never strands a
 * building outside it, and the riverbank beyond that edge never moves.
 *
 * Nothing here draws; the village view reads these to draw the grid.
 */
import { building, layout, type BuildingDef } from '../data';
import type { GameState, Slot } from '../state/types';
import { buildingTier } from './storage';

export interface Rect { x0: number; x1: number; y0: number; y1: number }
export interface Cell { x: number; y: number }

const key = (x: number, y: number) => `${x},${y}`;

/** A cell's size in scene units: one sprite plate across, so a 1×1 building fills its cell. */
export function cellSize(): { w: number; h: number } {
  return { w: layout.tile.w * layout.cellTiles, h: layout.tile.h * layout.cellTiles };
}

/** The enclosure's side, in cells, at a wall tier. */
export function enclosureSize(wallTier: number): number {
  const sizes = layout.grid.sizeByWallTier;
  return sizes[Math.max(0, Math.min(sizes.length - 1, wallTier))];
}

/** The cells inside the wall at a given side length, inclusive bounds. */
export function enclosureOfSize(n: number): Rect {
  const x1 = layout.grid.riverEdge;
  return { x0: x1 - n + 1, x1, y0: -Math.floor((n - 1) / 2), y1: Math.ceil((n - 1) / 2) };
}

export function enclosure(state: GameState): Rect {
  return enclosureOfSize(enclosureSize(buildingTier(state, 'wall')));
}

/** The reserved strip beyond the river edge, outside the wall, as long as the enclosure is deep. */
export function riverbank(state: GameState): Rect {
  const e = enclosure(state);
  return { x0: e.x1 + 1, x1: e.x1 + layout.grid.riverbankDepth, y0: e.y0, y1: e.y1 };
}

export const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
export const cellCount = (r: Rect) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);

/**
 * A building's extent in cells, [along x, along y]. On the riverbank the
 * footprint reads [along the bank, away from it]; the bank runs along y.
 */
export function extentOf(def: BuildingDef): [number, number] {
  const [a, b] = def.footprint ?? [1, 1];
  return def.placement === 'riverbank' ? [b, a] : [a, b];
}

/** Every cell a town slot covers. Empty for a slot off the grid. */
export function cellsOf(slot: Slot): Cell[] {
  if (slot.zone !== 'town' || slot.x === undefined || slot.y === undefined || !slot.building) return [];
  const [w, h] = extentOf(building(slot.building));
  const out: Cell[] = [];
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push({ x: slot.x + dx, y: slot.y + dy });
  return out;
}

/** The footprint's centre in grid units, where its sprite's plate anchor goes. */
export function centreOf(slot: Slot): { x: number; y: number } {
  const [w, h] = slot.building ? extentOf(building(slot.building)) : [1, 1];
  return { x: (slot.x ?? 0) + w / 2, y: (slot.y ?? 0) + h / 2 };
}

export function occupied(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const s of state.slots) for (const c of cellsOf(s)) out.add(key(c.x, c.y));
  return out;
}

/** Cells inside the wall with nothing on them. */
export function freeCells(state: GameState): number {
  const e = enclosure(state);
  const taken = occupied(state);
  let n = 0;
  for (let x = e.x0; x <= e.x1; x++) for (let y = e.y0; y <= e.y1; y++) if (!taken.has(key(x, y))) n++;
  return n;
}

/** True when one of a unique building already stands or is rising. */
export function uniqueTaken(state: GameState, buildingId: string): boolean {
  return !!building(buildingId).unique && state.slots.some((s) => s.building === buildingId);
}

/** Why a building cannot go down with its anchor at (x, y), or null when it can. */
export function placeProblem(state: GameState, buildingId: string, x: number, y: number): string | null {
  const def = building(buildingId);
  if (def.zone !== 'town') return 'Not a building for the town grid';
  if (uniqueTaken(state, buildingId)) return `The colony has its ${def.name.toLowerCase()} already`;
  const area = def.placement === 'riverbank' ? riverbank(state) : enclosure(state);
  const [w, h] = extentOf(def);
  const taken = occupied(state);
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      if (!inRect(area, x + dx, y + dy)) return def.placement === 'riverbank' ? 'Only on the riverbank' : 'Outside the wall';
      if (taken.has(key(x + dx, y + dy))) return 'Those cells are taken';
    }
  }
  return null;
}

/** Every anchor cell where the building fits, nearest the enclosure's centre first. */
export function anchors(state: GameState, buildingId: string): Cell[] {
  const def = building(buildingId);
  const area = def.placement === 'riverbank' ? riverbank(state) : enclosure(state);
  const e = enclosure(state);
  const cx = (e.x0 + e.x1 + 1) / 2;
  const cy = (e.y0 + e.y1 + 1) / 2;
  const [w, h] = extentOf(def);
  const out: Cell[] = [];
  for (let x = area.x0; x <= area.x1; x++) {
    for (let y = area.y0; y <= area.y1; y++) if (!placeProblem(state, buildingId, x, y)) out.push({ x, y });
  }
  const d = (c: Cell) => Math.abs(c.x + w / 2 - cx) + Math.abs(c.y + h / 2 - cy);
  return out.sort((a, b) => d(a) - d(b) || a.y - b.y || a.x - b.x);
}

/** A fresh id for a town slot: t1, t2, … never reusing one a save already holds. */
export function nextTownSlotId(state: GameState): string {
  let n = 1;
  const ids = new Set(state.slots.map((s) => s.id));
  while (ids.has(`t${n}`)) n++;
  return `t${n}`;
}

/** The slots the layout fixes: every resource site outside the wall, and the wall at its gate. */
export function fixedSlots(): Slot[] {
  return [
    ...layout.sites.map((d): Slot => ({ id: d.id, zone: 'site', site: d.site, x: d.x, y: d.y, building: null, tier: 0 })),
    { id: layout.wall.id, zone: 'wall', building: 'wall', tier: 0 },
  ];
}

/**
 * Bring a save from the ring layout onto the grid.
 *
 * Its sites and its wall keep their slots, ids and tiers. Every building that
 * stood or was rising in the centre or the inner ring keeps its slot id —
 * a construction under way names it — and is set down on the grid: the forum
 * on its founding cells, then the largest first, each on the free cells
 * nearest the centre. An empty plot, or a castellum the ring layout pinned to
 * its slot but nobody raised, holds nothing and is dropped. Nothing held is
 * lost (§2.11): a building that found no room inside the wall is set down
 * just beyond its landward edge rather than removed.
 */
export function migrateRingsToGrid(state: GameState): void {
  type Legacy = Slot & { ring?: string };
  const legacy = state.slots as Legacy[];
  if (!legacy.some((s) => s.ring !== undefined)) return;
  const byId = new Map(legacy.map((s) => [s.id, s]));
  const kept: Slot[] = [];
  for (const f of fixedSlots()) {
    const old = byId.get(f.id);
    kept.push(old ? { ...f, building: old.building ?? f.building, tier: old.tier } : f);
  }
  const toPlace: Slot[] = [];
  for (const s of legacy) {
    if (s.ring !== 'centre' && s.ring !== 'inner') continue;
    const rising = state.constructions.some((c) => c.slotId === s.id);
    if (s.building && (s.tier > 0 || rising)) toPlace.push({ id: s.id, zone: 'town', building: s.building, tier: s.tier });
  }
  state.slots = kept;
  const area = (s: Slot) => { const [w, h] = extentOf(building(s.building!)); return w * h; };
  toPlace.sort((a, b) => Number(b.building === 'forum') - Number(a.building === 'forum') || area(b) - area(a) || a.id.localeCompare(b.id));
  for (const s of toPlace) {
    const founding = layout.startBuilt.find((b): b is { id: string; building: string; x: number; y: number; tier: number } => 'id' in b && b.building === s.building);
    const spot = founding && !placeProblem(state, s.building!, founding.x, founding.y)
      ? { x: founding.x, y: founding.y }
      : anchors(state, s.building!)[0] ?? beyondTheWall(state, s.building!);
    state.slots.push({ ...s, x: spot.x, y: spot.y });
  }
}

/** The first free cells landward of the wall, for a building the enclosure has no room for. */
function beyondTheWall(state: GameState, buildingId: string): Cell {
  const e = enclosure(state);
  const [w, h] = extentOf(building(buildingId));
  const taken = occupied(state);
  for (let x = e.x0 - w - 1; ; x -= w + 1) {
    for (let y = e.y0; y <= e.y1 - h + 1; y++) {
      let free = true;
      for (let dx = 0; dx < w && free; dx++) for (let dy = 0; dy < h && free; dy++) if (taken.has(key(x + dx, y + dy))) free = false;
      if (free) return { x, y };
    }
  }
}
