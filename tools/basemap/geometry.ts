/**
 * Where everything the base map must respect lies, in the painting's own
 * pixels (docs/BASEMAP-V2-SPEC.md). Every figure is computed here from
 * data/layout.json and the village's projection, so the spec and its guide
 * cannot drift from the game.
 */
import { biomes, building, layout } from '../../src/data';
import { enclosureOfSize, type Rect } from '../../src/village/grid';
import { gateAt, project } from '../../src/render/environment';
import { sceneBounds } from '../../src/render/village';

/** Pixels per scene unit: a cell is then 224 × 112 px. */
export const K = 2;
/** The painting's aspect. */
export const ASPECT = 1.6;
/** The stage aspects the painting must fill at the widest zoom, letterboxing included. */
export const STAGE_ASPECTS = { min: 1.3, max: 2.2 };
/** The clearing's organic edge runs this many cells beyond the tier-III wall: never nearer, never further. */
export const CLEARING = { inner: 0.5, outer: 1.5 };

/**
 * The frame, in scene units: centred on the scene, 16:10, and large enough
 * that any stage aspect in STAGE_ASPECTS shows painting, not flood, when the
 * view shows the whole scene.
 */
export function frame(): { x: number; y: number; w: number; h: number } {
  const s = sceneBounds();
  const h = Math.ceil(Math.max(s.w / STAGE_ASPECTS.min, (s.h * STAGE_ASPECTS.max) / ASPECT, s.h) / 10) * 10;
  const w = h * ASPECT;
  return { x: Math.round(s.x + s.w / 2 - w / 2), y: Math.round(s.y + s.h / 2 - h / 2), w, h };
}

export const FRAME = frame();
export const W = FRAME.w * K;
export const H = FRAME.h * K;

/** Scene units → image pixels. */
export function toPx(sx: number, sy: number): [number, number] {
  return [Math.round((sx - FRAME.x) * K), Math.round((sy - FRAME.y) * K)];
}
/** Grid units → image pixels. */
export function px(x: number, y: number): [number, number] {
  return toPx(...project(x, y));
}
export const fmt = ([a, b]: [number, number]) => `(${a}, ${b})`;

/** A rectangle of grid space as its four screen corners: top, right, bottom, left. */
export function corners(r: { x0: number; y0: number; x1: number; y1: number }): [number, number][] {
  return [px(r.x0, r.y0), px(r.x1, r.y0), px(r.x1, r.y1), px(r.x0, r.y1)];
}

export const sizes = layout.grid.sizeByWallTier;
export const big: Rect = enclosureOfSize(Math.max(...sizes));
/** The grid x where the water starts: beyond the bank strip. */
export const riverX = big.x1 + 1 + layout.grid.riverbankDepth;

/** The enclosure at each wall tier, as the diamond its wall runs on, and its gate. */
export function tiers() {
  return sizes.map((n, t) => {
    const e = enclosureOfSize(n);
    const g = gateAt(e);
    return { tier: t, n, rect: { x0: e.x0, y0: e.y0, x1: e.x1 + 1, y1: e.y1 + 1 }, gate: [px(g.x - 0.5, g.y), px(g.x + 0.5, g.y)] as [number, number][] };
  });
}

/** The riverbank strip at each tier: outside the river wall, as long as the enclosure. */
export function banks() {
  return sizes.map((n, t) => {
    const e = enclosureOfSize(n);
    return { tier: t, rect: { x0: e.x1 + 1, y0: e.y0, x1: e.x1 + 1 + layout.grid.riverbankDepth, y1: e.y1 + 1 } };
  });
}

/** The band the clearing's edge must lie in: beyond the tier-III wall by CLEARING cells, running to the water on the river side. */
export function clearing() {
  const t3 = { x0: big.x0, y0: big.y0, x1: big.x1 + 1, y1: big.y1 + 1 };
  const grow = (d: number) => ({ x0: t3.x0 - d, y0: t3.y0 - d, x1: riverX, y1: t3.y1 + d });
  return { inner: grow(CLEARING.inner), outer: grow(CLEARING.outer) };
}

/** The praetorium's cells, fixed by the layout (§4.4): drawn, never painted. */
export function seat() {
  const f = layout.startBuilt.find((b) => 'id' in b && b.building === 'praetorium') as { x: number; y: number };
  const [w, h] = building('praetorium').footprint ?? [1, 1];
  return { x0: f.x, y0: f.y, x1: f.x + w, y1: f.y + h };
}

/** Where the grid line x = c enters and leaves the frame, as the water runs down it. */
export function lineThroughFrame(c: number): [[number, number], [number, number]] {
  // px(c, y) is linear in y: find where it meets each edge and keep the two on the frame
  const [ax, ay] = project(c, 0).map((v, i) => (v - (i ? FRAME.y : FRAME.x)) * K);
  const [bx, by] = project(c, 1).map((v, i) => (v - (i ? FRAME.y : FRAME.x)) * K);
  const dx = bx - ax;
  const dy = by - ay;
  const at = (t: number): [number, number] => [ax + dx * t, ay + dy * t];
  const onFrame = ([x, y]: [number, number]) => x >= -0.5 && x <= W + 0.5 && y >= -0.5 && y <= H + 0.5;
  const ts = [-ax / dx, (W - ax) / dx, -ay / dy, (H - ay) / dy].filter((t) => onFrame(at(t))).sort((m, n) => m - n);
  const round = ([x, y]: [number, number]): [number, number] => [Math.round(x), Math.round(y)];
  return [round(at(ts[0])), round(at(ts[ts.length - 1]))];
}

/** The biomes with their slots' plates, in order. */
export function biomeSlots() {
  return Object.entries(biomes).map(([id, b]) => ({
    id, site: b.site, where: b.where,
    slots: b.slots.map((s) => ({ id: s.id, x: s.x, y: s.y, centre: px(s.x + 0.5, s.y + 0.5), plate: corners({ x0: s.x, y0: s.y, x1: s.x + 1, y1: s.y + 1 }) })),
  }));
}

/** The whole scene the view can show at its widest, in px. */
export function scenePx() {
  const s = sceneBounds();
  const a = toPx(s.x, s.y);
  const b = toPx(s.x + s.w, s.y + s.h);
  return { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1], aspects: { min: s.w / FRAME.h, max: FRAME.w / s.h } };
}
