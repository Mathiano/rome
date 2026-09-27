/**
 * The colony the buildings stand in (DESIGN §4.5, §10).
 *
 * The town is a rectangle of cells inside a rectangular wall — the Roman
 * colonial plan. The wall and the grid are drawn in code (§4.5 C.4); the
 * buildings are painted sprites. The river runs along one edge of the town,
 * beyond a strip of bank kept for the harbour.
 *
 * The country and the river are drawn once. The town's floor, its grid and
 * the wall depend on the wall's tier, so they are rebuilt when it is raised
 * and at no other time.
 */
import { layout } from '../data';
import { cellSize, enclosureOfSize, type Rect } from '../village/grid';

const NS = 'http://www.w3.org/2000/svg';

/**
 * The painted country (assets/src/base-map-v1.jpg), generated against the spec
 * in assets/style/PROMPTS.md for the old round wall. It is invalidated by the
 * grid (DESIGN §10: regenerated after the grid exists) and kept until then as
 * country, laid so its clearing sits under the largest enclosure. Loaded the
 * same way the sprites are, so it is absent rather than fatal.
 */
const baseMapUrls = import.meta.glob('../../assets/src/base-map-*.jpg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const BASE_MAP: string | undefined = Object.entries(baseMapUrls).sort().pop()?.[1];

/**
 * Where the painting's clearing is, measured off the source. The scale is
 * uniform and matches the clearing's height to the largest enclosure's.
 */
const MAP_FIT = {
  /** Where the clearing's centre sits in the source image, as a fraction. */
  cx: 0.470,
  cy: 0.525,
  /** Half the clearing's height, as a fraction of the source. */
  semiH: 0.325,
  width: 3168,
  height: 1344,
};

/** The same palette the sprites are drawn from (tools/artgen/palette.json). */
const PAL = {
  ink: '#1e0702',
  grass: '#8d9a5f',
  /** The median colour of base-map-v1's outer edge, for the letterbox. */
  mapEdge: '#7e804e',
  grassDark: '#78854f',
  leafLight: '#8a9a5c',
  leafMid: '#6e7d48',
  leafDark: '#4d5a36',
  earthLight: '#cfa278',
  earthMid: '#ad8c75',
  earthDark: '#846859',
  stoneLight: '#d7b791',
  stoneMid: '#ad8c75',
  stoneDark: '#846859',
  timberMid: '#6d4d3d',
  timberDark: '#593627',
  roofMid: '#c4724c',
  roofDark: '#95583e',
  water: '#7d94a0',
  waterDeep: '#5d7682',
  grain: '#d9b969',
  iron: '#6b6258',
  road: '#c2996f',
  roadEdge: '#8f6f4f',
  square: '#d3ad84',
  squareLine: '#b08a63',
  wallLight: '#cfc3ab',
  wallMid: '#a19683',
  wallDark: '#726a5c',
  wallFoot: '#564f45',
};

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** A tower on the wall, in whatever the wall is made of at this tier. */
function tower(x: number, y: number, T: { h: number; foot: string; face: string; top: string }): SVGGElement {
  const g = el('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
  g.appendChild(el('ellipse', { cx: 0, cy: 0, rx: 9, ry: 4.5, fill: T.foot, stroke: PAL.ink, 'stroke-width': 1 }));
  g.appendChild(el('path', { d: 'M -9,0 L -9,-20 A 9,4.5 0 0 1 9,-20 L 9,0 A 9,4.5 0 0 1 -9,0 Z', fill: T.face, stroke: PAL.ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  g.appendChild(el('path', { d: 'M -9,-3 L -9,-20 A 9,4.5 0 0 1 0,-24.5 L 0,-7.5 A 9,4.5 0 0 0 -9,-3 Z', fill: T.foot, opacity: 0.35 }));
  g.appendChild(el('path', { d: 'M -9,-20 A 9,4.5 0 0 1 9,-20 A 9,4.5 0 0 1 -9,-20 Z', fill: T.top, stroke: PAL.ink, 'stroke-width': 1 }));
  for (let i = -1; i <= 1; i++) {
    g.appendChild(el('rect', { x: i * 5.6 - 2.1, y: -25.5, width: 4.2, height: 5.8, fill: T.top, stroke: PAL.ink, 'stroke-width': 0.8 }));
  }
  g.appendChild(el('polygon', { points: '-10,-25 10,-25 0,-34', fill: PAL.roofMid, stroke: PAL.ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  g.appendChild(el('polygon', { points: '0,-25 10,-25 0,-34', fill: PAL.roofDark }));
  return g;
}

/** Grid units to scene units: +x runs down-right, +y down-left. */
export function project(x: number, y: number): [number, number] {
  const { w, h } = cellSize();
  return [((x - y) * w) / 2, ((x + y) * h) / 2];
}

/** How lit a stretch of wall is: light comes from the top left, as on every sprite. */
export type WallEdge = 'north-west' | 'north-east' | 'south-east' | 'south-west';

/**
 * The face the viewer sees of a wall running along y (the north-west and
 * south-east edges) faces +x, down and to the right: away from the light.
 * The face of one running along x faces +y, down and to the left: toward it.
 * The same split the sprites' boxes use — left faces lit, right faces dark.
 */
export function wallLight(edge: WallEdge): number {
  return edge === 'north-east' || edge === 'south-west' ? 0.5 : -0.5;
}

/** Darken or lift a hex by a fraction, for that shading. */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => Math.max(0, Math.min(255, Math.round(c * (1 + f)))));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** What the circuit is made of at each tier of the wall building (DESIGN §4.4). */
const WALL_TIERS = [
  // 0 — no wall raised yet: the ditch and bank a colonia throws up on day one
  { h: 7, foot: '#6b5a44', face: '#8a7357', top: '#a68a68', merlons: false, stakes: false, courses: 0 },
  // 1 — a timber palisade on that bank: posts, each with a shadow side
  { h: 12, foot: '#4a3b2c', face: '#6d4d3d', top: '#9b7c68', merlons: false, stakes: true, courses: 0 },
  // 2 — stone, coped, with towers and coursed blocks
  { h: 15, foot: '#564f45', face: '#a19683', top: '#cfc3ab', merlons: false, stakes: false, courses: 3 },
  // 3 — the full circuit, crenellated, and the standard over the gate
  { h: 17, foot: '#564f45', face: '#a19683', top: '#cfc3ab', merlons: true, stakes: false, courses: 4 },
];

export interface ScenePiece { depth: number; g: SVGGElement }

/** The gate: the middle cell of the south-west edge, facing the viewer's left, where the road comes in. */
export function gateCell(e: Rect): number {
  return Math.floor((e.x0 + e.x1 + 1) / 2);
}

/** The gate's centre in grid units, for the wall slot's position and hit area. */
export function gateAt(e: Rect): { x: number; y: number } {
  return { x: gateCell(e) + 0.5, y: e.y1 + 1 };
}

/** The gate's hit area, in scene units around its centre. */
export const GATE_HIT = { w: cellSize().w / 2, h: WALL_TIERS[WALL_TIERS.length - 1].h * 0.8 };

const pt = (x: number, y: number) => project(x, y).map((v) => v.toFixed(1)).join(',');
const poly = (cells: [number, number][]) => cells.map(([x, y]) => pt(x, y)).join(' ');

/**
 * The country: the painting, the river and its far bank. Drawn once; nothing
 * here depends on the colony.
 */
export function createGround(view: { x: number; y: number; w: number; h: number }): SVGGElement {
  const root = el('g', { class: 'env' });
  const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
  if (BASE_MAP) {
    // Flood first with the painting's own edge colour, for the letterbox.
    root.appendChild(el('rect', { x: view.x - view.w, y: view.y - view.h, width: view.w * 3, height: view.h * 3, fill: PAL.mapEdge }));
    const [cx, cy] = project((big.x0 + big.x1 + 1) / 2, (big.y0 + big.y1 + 1) / 2);
    const semiH = ((big.x1 - big.x0 + 1 + big.y1 - big.y0 + 1) * cellSize().h) / 4;
    // The clearing under the largest town, and never smaller than the frame:
    // with the clearing's centre pinned there, each edge of the painting must
    // still reach the frame's. A window of another shape than the frame shows
    // past it, onto the edge-colour flood above.
    const W = MAP_FIT.width;
    const H = MAP_FIT.height;
    const k = Math.max(
      semiH / (MAP_FIT.semiH * H),
      (cx - view.x) / (MAP_FIT.cx * W), (view.x + view.w - cx) / ((1 - MAP_FIT.cx) * W),
      (cy - view.y) / (MAP_FIT.cy * H), (view.y + view.h - cy) / ((1 - MAP_FIT.cy) * H),
    );
    root.appendChild(el('image', {
      href: BASE_MAP,
      x: (cx - MAP_FIT.cx * MAP_FIT.width * k).toFixed(1),
      y: (cy - MAP_FIT.cy * MAP_FIT.height * k).toFixed(1),
      width: (MAP_FIT.width * k).toFixed(1),
      height: (MAP_FIT.height * k).toFixed(1),
      preserveAspectRatio: 'none',
      class: 'base-map',
    }));
  } else {
    root.appendChild(el('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: PAL.grass }));
  }
  // The river, beyond the bank: it runs the whole length of the country so
  // the enclosure can grow along it without the water ending.
  const bankX = big.x1 + 1 + layout.grid.riverbankDepth;
  const Y0 = big.y0 - 8;
  const Y1 = big.y1 + 9;
  const river = el('g', { class: 'river' });
  // The river ends where the painting does, not out across the flood.
  const painting = root.querySelector('image.base-map');
  if (painting) {
    const clip = el('clipPath', { id: 'country-clip' });
    clip.appendChild(el('rect', { x: painting.getAttribute('x')!, y: painting.getAttribute('y')!, width: painting.getAttribute('width')!, height: painting.getAttribute('height')! }));
    root.appendChild(clip);
    river.setAttribute('clip-path', 'url(#country-clip)');
  }
  river.appendChild(el('polygon', { points: poly([[bankX, Y0], [bankX + 2.4, Y0], [bankX + 2.4, Y1], [bankX, Y1]]), fill: PAL.water, stroke: PAL.ink, 'stroke-width': 1 }));
  river.appendChild(el('polygon', { points: poly([[bankX + 0.7, Y0], [bankX + 1.7, Y0], [bankX + 1.7, Y1], [bankX + 0.7, Y1]]), fill: PAL.waterDeep, opacity: 0.6 }));
  root.appendChild(river);
  return root;
}

/**
 * The town floor for an enclosure: packed earth inside the wall, a line for
 * every cell so placement can be read, and the riverbank strip in its own tone.
 * Flat, so it lies under every building and needs no depth.
 */
export function createTownFloor(e: Rect, bank: Rect): SVGGElement {
  const root = el('g', { class: 'town-floor' });
  root.appendChild(el('polygon', {
    class: 'floor',
    points: poly([[e.x0, e.y0], [e.x1 + 1, e.y0], [e.x1 + 1, e.y1 + 1], [e.x0, e.y1 + 1]]),
    fill: PAL.earthLight, stroke: PAL.roadEdge, 'stroke-width': 1, opacity: 0.92,
  }));
  root.appendChild(el('polygon', {
    class: 'riverbank',
    points: poly([[bank.x0, bank.y0], [bank.x1 + 1, bank.y0], [bank.x1 + 1, bank.y1 + 1], [bank.x0, bank.y1 + 1]]),
    fill: PAL.stoneLight, stroke: PAL.roadEdge, 'stroke-width': 1, opacity: 0.85,
  }));
  const lines = el('g', { class: 'cell-lines' });
  for (let x = e.x0 + 1; x <= e.x1; x++) lines.appendChild(el('line', { x1: project(x, e.y0)[0], y1: project(x, e.y0)[1], x2: project(x, e.y1 + 1)[0], y2: project(x, e.y1 + 1)[1] }));
  for (let y = e.y0 + 1; y <= e.y1; y++) lines.appendChild(el('line', { x1: project(e.x0, y)[0], y1: project(e.x0, y)[1], x2: project(e.x1 + 1, y)[0], y2: project(e.x1 + 1, y)[1] }));
  for (let y = bank.y0 + 1; y <= bank.y1; y++) lines.appendChild(el('line', { x1: project(bank.x0, y)[0], y1: project(bank.x0, y)[1], x2: project(bank.x1 + 1, y)[0], y2: project(bank.x1 + 1, y)[1] }));
  root.appendChild(lines);
  return root;
}

/**
 * The wall, as pieces that sort with the buildings.
 *
 * It runs on the grid lines round the enclosure, one piece per cell of edge,
 * each carrying its own depth — the midpoint of its stretch, x + y, the same
 * measure a building's centre sorts by. The far edges (north-west, north-east)
 * then fall behind every cell beside them and the near edges (south-east on
 * the river, south-west with the gate) in front: SVG paints in document
 * order, and the village appends in depth order.
 *
 * `tier` is the wall building's own (DESIGN §4.4); the enclosure is the one
 * that tier gives (§4.5 C.1).
 */
export function createWall(tier: number, e: Rect): ScenePiece[] {
  const T = WALL_TIERS[Math.max(0, Math.min(WALL_TIERS.length - 1, tier))];
  const pieces: ScenePiece[] = [];
  const gx = gateCell(e);
  const run = (edge: WallEdge, a: [number, number], b: [number, number]) => {
    const g = el('g', { class: 'wall-seg', 'data-edge': edge });
    const lit = wallLight(edge);
    const [ax, ay] = project(...a);
    const [bx, by] = project(...b);
    const face = shade(T.face, lit * 0.26);
    const foot = shade(T.foot, lit * 0.16);
    const quad = (lo: number, hi: number) => `${ax.toFixed(1)},${(ay - lo).toFixed(1)} ${bx.toFixed(1)},${(by - lo).toFixed(1)} ${bx.toFixed(1)},${(by - hi).toFixed(1)} ${ax.toFixed(1)},${(ay - hi).toFixed(1)}`;
    g.appendChild(el('polygon', { points: quad(0, T.h), fill: face, stroke: PAL.ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    g.appendChild(el('polygon', { points: quad(0, T.h * 0.18), fill: foot }));
    for (let c = 1; c <= T.courses; c++) {
      const lift = T.h * (0.18 + (c / (T.courses + 1)) * 0.7);
      g.appendChild(el('line', { x1: ax, y1: ay - lift, x2: bx, y2: by - lift, stroke: foot, 'stroke-width': 0.9, opacity: 0.5, 'stroke-dasharray': c % 2 ? '9 7' : '7 9' }));
    }
    if (T.stakes) {
      for (let k = 0; k <= 5; k++) {
        const x = ax + ((bx - ax) * k) / 5;
        const y = ay + ((by - ay) * k) / 5;
        g.appendChild(el('line', { x1: x.toFixed(1), y1: (y - 1).toFixed(1), x2: x.toFixed(1), y2: (y - T.h * 0.95).toFixed(1), stroke: shade(T.face, -0.3), 'stroke-width': 1.4, opacity: 0.75 }));
      }
    }
    g.appendChild(el('line', { x1: ax, y1: ay - T.h, x2: bx, y2: by - T.h, stroke: shade(T.top, lit * 0.1), 'stroke-width': 3, 'stroke-linecap': 'round' }));
    if (T.merlons) {
      g.appendChild(el('line', { x1: ax, y1: ay - T.h - 2, x2: bx, y2: by - T.h - 2, stroke: shade(T.top, lit * 0.12), 'stroke-width': 4, 'stroke-dasharray': '7 7' }));
    }
    pieces.push({ depth: (a[0] + a[1] + b[0] + b[1]) / 2, g });
  };
  for (let x = e.x0; x <= e.x1; x++) run('north-east', [x, e.y0], [x + 1, e.y0]);
  for (let y = e.y0; y <= e.y1; y++) run('north-west', [e.x0, y], [e.x0, y + 1]);
  for (let y = e.y0; y <= e.y1; y++) run('south-east', [e.x1 + 1, y], [e.x1 + 1, y + 1]);
  for (let x = e.x0; x <= e.x1; x++) if (x !== gx) run('south-west', [x, e.y1 + 1], [x + 1, e.y1 + 1]);

  // Towers: the corners from the palisade on, the gate's flanks from stone,
  // and the middle of each far edge on the finished circuit.
  const towersAt: [number, number][] = [];
  if (tier >= 1) towersAt.push([e.x0, e.y0], [e.x1 + 1, e.y0], [e.x0, e.y1 + 1], [e.x1 + 1, e.y1 + 1]);
  if (tier >= 2) towersAt.push([gx, e.y1 + 1], [gx + 1, e.y1 + 1]);
  if (tier >= 3) towersAt.push([(e.x0 + e.x1 + 1) / 2, e.y0], [e.x0, (e.y0 + e.y1 + 1) / 2]);
  for (const [x, y] of towersAt) {
    const [sx, sy] = project(x, y);
    const g = tower(sx, sy, { ...T, face: T.face, foot: T.foot });
    g.setAttribute('class', 'tower');
    pieces.push({ depth: x + y + 0.02, g });
  }

  // the gate, on the south-west edge where the road comes in
  const gate = el('g', { class: 'gate' });
  const [gxl, gyl] = project(gx + 0.25, e.y1 + 1);
  const [gxr, gyr] = project(gx + 0.75, e.y1 + 1);
  const [sxl, syl] = project(gx, e.y1 + 1);
  const [sxr, syr] = project(gx + 1, e.y1 + 1);
  const gh = T.h * 0.8;
  // the wall either side of the leaves, so the gate cell is not a gap
  for (const [x0, y0, x1, y1] of [[sxl, syl, gxl, gyl], [gxr, gyr, sxr, syr]]) {
    gate.appendChild(el('polygon', { points: `${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${(y1 - T.h).toFixed(1)} ${x0.toFixed(1)},${(y0 - T.h).toFixed(1)}`, fill: shade(T.face, wallLight('south-west') * 0.26), stroke: PAL.ink, 'stroke-width': 1 }));
  }
  gate.appendChild(el('path', {
    d: `M ${gxl.toFixed(1)},${gyl.toFixed(1)} L ${gxr.toFixed(1)},${gyr.toFixed(1)} L ${gxr.toFixed(1)},${(gyr - gh).toFixed(1)} L ${gxl.toFixed(1)},${(gyl - gh).toFixed(1)} Z`,
    fill: PAL.timberDark, stroke: PAL.ink, 'stroke-width': 1.2,
  }));
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const x = gxl + (gxr - gxl) * t;
    const y = gyl + (gyr - gyl) * t;
    gate.appendChild(el('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: x.toFixed(1), y2: (y - gh).toFixed(1), stroke: PAL.timberMid, 'stroke-width': 1.6 }));
  }
  if (T.merlons) {
    // A finished circuit flies the colony's standard over its gate: the wall's
    // tier-3 animated feature (DESIGN §10), waved by the sprites' keyframes.
    const [bx, by] = project(gx + 0.5, e.y1 + 1);
    const mast = el('g', { class: 'anim-flag gate-banner', transform: `translate(${bx.toFixed(1)},${(by - T.h).toFixed(1)})` });
    mast.appendChild(el('line', { x1: 0, y1: 2, x2: 0, y2: -26, stroke: PAL.ink, 'stroke-width': 1.6 }));
    mast.appendChild(el('polygon', { class: 'cloth', points: '0,-25 13,-22.2 11,-15.5 0,-14' }));
    gate.appendChild(mast);
  }
  pieces.push({ depth: gx + 0.5 + e.y1 + 1 + 0.01, g: gate });
  return pieces;
}
