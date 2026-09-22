/**
 * The colony the buildings stand in (DESIGN §10).
 *
 * Seventeen plots on a gradient read as a catalogue of buildings on a lawn.
 * A town reads as a town because something encloses it: a wall with a gate, one
 * continuous ground inside, roads that meet at a square, and country outside
 * that explains where the resources come from — the river at the clay banks,
 * the forest behind the wood sites, ploughed strips beyond the farms.
 *
 * All of it is drawn once at construction and never touched again: nothing here
 * depends on game state, so it costs one pass at startup and nothing per tick.
 */
import { layout } from '../data';

const NS = 'http://www.w3.org/2000/svg';

/**
 * The painted country (assets/src/base-map-v1.jpg), generated against the spec
 * in assets/style/PROMPTS.md. Loaded the same way the sprites are, so it is
 * absent rather than fatal if the file is ever removed.
 */
const baseMapUrls = import.meta.glob('../../assets/src/base-map-*.jpg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const BASE_MAP: string | undefined = Object.entries(baseMapUrls).sort().pop()?.[1];

/**
 * How the painting lands on the wall.
 *
 * The clearing it was generated with is 2.42:1 and the wall is exactly 2:1, so
 * the two cannot both be honoured. The scale is uniform — stretching terrain
 * would show on the trees — and it matches the clearing's *height*: painted
 * earth spilling outside the wall reads as cleared approach, where grass inside
 * the wall would read as a bug. Measured off the source, not guessed
 * (tools: the fit check in the session capsule).
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

function project(x: number, y: number): [number, number] {
  const { w, h } = layout.tile;
  return [((x - y) * w) / 2, ((x + y) * h) / 2];
}

/**
 * An isometric circle of radius r in tile units. On this projection it comes
 * out as an axis-aligned ellipse, which is why the wall can be drawn as one.
 */
const RING_X = Math.SQRT2 * (layout.tile.w / 2);
const RING_Y = Math.SQRT2 * (layout.tile.h / 2);
function ring(r: number, t: number): [number, number] {
  return [RING_X * r * Math.cos(t), RING_Y * r * Math.sin(t)];
}

/** Far enough out to clear the outer ring of plots, close enough to enclose. */
const WALL_R = 6.15;
/** Where the gate sits on the ring, in radians: due south, facing the viewer. */
const GATE_AT = Math.PI / 2;
const GATE_HALF = 0.2;

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

/**
 * Depth on this projection. A tile at (x,y) sits at x+y; the wall ring is
 * parameterised by screen angle t, and works out to WALL_R·√2·sin(t) — due
 * south (t = π/2) is nearest the viewer, due north is furthest.
 */
export const wallDepthAt = (t: number) => WALL_R * Math.SQRT2 * Math.sin(t);

/**
 * How lit a stretch of wall is, from -1 (full shade) to +1 (full light), for
 * the ring's screen angle t.
 *
 * Light comes from the top left, as it does on every sprite. The ring's
 * outward normal at tile angle θ is (cos θ, sin θ), and θ = t − 45° on this
 * parameterisation; a screen direction of (−1,−1) works back to (−3,−1) in
 * tile space, so the dot product of the two reduces to the line below. It puts
 * the north-west of the ring in light and the south-east in shade, which is
 * what the eye expects of a drum lit from that corner.
 */
export function wallLight(t: number): number {
  return -(0.448 * Math.cos(t) + 0.894 * Math.sin(t));
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
  { h: 7, foot: '#6b5a44', face: '#8a7357', top: '#a68a68', merlons: false, towers: 0, stakes: false, courses: 0 },
  // 1 — a timber palisade on that bank: posts, each with a shadow side
  { h: 12, foot: '#4a3b2c', face: '#6d4d3d', top: '#9b7c68', merlons: false, towers: 3, stakes: true, courses: 0 },
  // 2 — stone, coped, with towers and coursed blocks
  { h: 15, foot: '#564f45', face: '#a19683', top: '#cfc3ab', merlons: false, towers: 5, stakes: false, courses: 3 },
  // 3 — the full circuit, crenellated, and the standard over the gate
  { h: 17, foot: '#564f45', face: '#a19683', top: '#cfc3ab', merlons: true, towers: 8, stakes: false, courses: 4 },
];

export interface ScenePiece { depth: number; g: SVGGElement }

/**
 * The gate's span, for the perimeter slot's hit area (`layout.json` w1).
 * Derived from the same ring the gate is drawn on, so the two cannot drift:
 * the leaves run from `GATE_AT - GATE_HALF` to `GATE_AT + GATE_HALF`, and the
 * finished circuit's gate stands `WALL_TIERS[3].h * 0.8` high. It is the gate's
 * own span and no more: any taller and the marker reads as a plot standing in
 * the fields rather than as the way into the colony.
 */
export const GATE_HIT = {
  w: 2 * Math.abs(ring(WALL_R, GATE_AT + GATE_HALF)[0]),
  h: WALL_TIERS[WALL_TIERS.length - 1].h * 0.8,
};

/**
 * The flat ground: the painting, the roads and the square.
 *
 * Everything here lies on the ground and belongs behind every building, so it
 * needs no depth of its own. The wall does — see `createWall`.
 */
export function createGround(view: { x: number; y: number; w: number; h: number }): SVGGElement {
  const root = el('g', { class: 'env' });

  // --- the country: one painted image, fitted so the wall lands on its clearing
  if (BASE_MAP) {
    // The painting is wider than the frame but not always taller than the
    // letterbox a tall window leaves, so the frame is flooded first with the
    // painting's own edge colour. Sampled from its outer 12px, not guessed.
    root.appendChild(el('rect', { x: view.x - view.w, y: view.y - view.h, width: view.w * 3, height: view.h * 3, fill: PAL.mapEdge }));
    const k = (RING_Y * WALL_R) / (MAP_FIT.semiH * MAP_FIT.height);
    root.appendChild(el('image', {
      href: BASE_MAP,
      x: (-MAP_FIT.cx * MAP_FIT.width * k).toFixed(1),
      y: (-MAP_FIT.cy * MAP_FIT.height * k).toFixed(1),
      width: (MAP_FIT.width * k).toFixed(1),
      height: (MAP_FIT.height * k).toFixed(1),
      preserveAspectRatio: 'none',
      class: 'base-map',
    }));
  } else {
    // No painting: fall back to plain ground rather than a blank frame.
    root.appendChild(el('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: PAL.grass }));
    root.appendChild(el('ellipse', { cx: 0, cy: 0, rx: (RING_X * WALL_R).toFixed(1), ry: (RING_Y * WALL_R).toFixed(1), fill: PAL.earthLight }));
  }

  // --- roads: one way in from the gate, and a ring inside the wall. Spurs to
  // every plot made a star that swallowed the town, so the plots meet the ring
  // road instead of the centre.
  const roadEdges = el('g', { class: 'road-edges', opacity: 0.4 });
  const roads = el('g', { class: 'roads' });
  const [gx, gy] = ring(WALL_R, GATE_AT);
  const [cx0, cy0] = project(0.5, 0); // the forum and castellum stand here
  // Every lane used to carry a semi-transparent darker underlay. Where the ring
  // road, the gate road and the cross street met at the square, three of those
  // compounded into a dark blot that read as a mud pit. The edge is opaque and
  // painted once, under all of them.
  const lane = (d: string, w: number) => {
    roadEdges.appendChild(el('path', { d, fill: 'none', stroke: PAL.roadEdge, 'stroke-width': w + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    roads.appendChild(el('path', { d, fill: 'none', stroke: PAL.road, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  };
  // the ring road, just inside the wall
  let rd = '';
  for (let i = 0; i <= 56; i++) {
    const [x, y] = ring(WALL_R * 0.82, (i / 56) * Math.PI * 2);
    rd += `${i ? ' L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)}`;
  }
  lane(rd + ' Z', 11);
  // the gate road, meeting the ring road and running on to the square
  const [rgx, rgy] = ring(WALL_R * 0.82, GATE_AT);
  lane(`M ${gx.toFixed(1)},${gy.toFixed(1)} L ${rgx.toFixed(1)},${rgy.toFixed(1)} L ${cx0.toFixed(1)},${cy0.toFixed(1)}`, 13);
  // one cross street, so the square is not only reachable from the south
  const [ax, ay] = ring(WALL_R * 0.82, GATE_AT + Math.PI);
  lane(`M ${ax.toFixed(1)},${ay.toFixed(1)} L ${cx0.toFixed(1)},${cy0.toFixed(1)}`, 11);
  root.appendChild(roadEdges);
  root.appendChild(roads);

  // the square: paved, with a well at its centre
  root.appendChild(el('ellipse', { cx: cx0.toFixed(1), cy: cy0.toFixed(1), rx: 62, ry: 31, fill: PAL.square, stroke: PAL.roadEdge, 'stroke-width': 1.2, opacity: 0.95 }));
  // flagstones, as light rings rather than dark patches
  for (let i = 0; i < 3; i++) {
    root.appendChild(el('ellipse', {
      cx: cx0.toFixed(1), cy: cy0.toFixed(1), rx: 20 + i * 14, ry: 10 + i * 7,
      fill: 'none', stroke: PAL.squareLine, 'stroke-width': 0.9, opacity: 0.5,
    }));
  }

  return root;
}



/**
 * The wall, as pieces that sort with the buildings.
 *
 * It used to be one ring painted behind every plot, so a building on the south
 * edge was drawn *through* the near wall. On this projection the ring's depth
 * runs from -8.7 due north to +8.7 due south, and the plots' from -7 to +7, so
 * the two interleave: the far arc belongs behind them and the near arc in
 * front. Each arc carries its own depth and the village merges them into the
 * same sort as the plots.
 *
 * `tier` is the wall building's own (DESIGN §4.4, ✅ 2026-09-22). The wall is
 * not the castellum: the castellum garrisons the colony from the centre, and
 * the circuit is raised separately, on the perimeter slot at the gate.
 */
export function createWall(tier: number): ScenePiece[] {
  const T = WALL_TIERS[Math.max(0, Math.min(WALL_TIERS.length - 1, tier))];
  const pieces: ScenePiece[] = [];
  const from = GATE_AT + GATE_HALF;
  const to = GATE_AT + Math.PI * 2 - GATE_HALF;
  const SEGMENTS = 24;

  const arcPath = (a: number, b: number, lift: number) => {
    const steps = 6;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const [x, y] = ring(WALL_R, a + ((b - a) * i) / steps);
      d += `${i ? ' L' : 'M'} ${x.toFixed(1)},${(y - lift).toFixed(1)}`;
    }
    return d;
  };

  for (let i = 0; i < SEGMENTS; i++) {
    // a sliver of overlap, so the bands join without a visible seam
    const a = from + ((to - from) * i) / SEGMENTS - (i ? 0.012 : 0);
    const b = from + ((to - from) * (i + 1)) / SEGMENTS + 0.012;
    const g = el('g', { class: 'wall-seg' });
    // One tone per arc, from its own facing: the circuit is a drum, and a flat
    // band of stone all the way round is what made it read as a ribbon.
    const lit = wallLight((a + b) / 2);
    const face = shade(T.face, lit * 0.26);
    const foot = shade(T.foot, lit * 0.16);
    g.appendChild(el('path', { d: arcPath(a, b, 0), fill: 'none', stroke: PAL.ink, 'stroke-width': T.h + 3 }));
    g.appendChild(el('path', { d: arcPath(a, b, 1.5), fill: 'none', stroke: foot, 'stroke-width': T.h }));
    g.appendChild(el('path', { d: arcPath(a, b, T.h * 0.33), fill: 'none', stroke: face, 'stroke-width': T.h * 0.76 }));
    for (let c = 1; c <= T.courses; c++) {
      // Courses, staggered segment to segment so the joints do not line up
      // into one continuous seam around the ring.
      const lift = T.h * (0.12 + (c / (T.courses + 1)) * 0.6);
      g.appendChild(el('path', {
        d: arcPath(a, b, lift), fill: 'none', stroke: shade(T.foot, lit * 0.16),
        'stroke-width': 0.9, opacity: 0.45,
        'stroke-dasharray': c % 2 ? '9 7' : '7 9', 'stroke-dashoffset': (i % 2) * 8,
      }));
    }
    if (T.stakes) {
      // a palisade reads by its posts, and each post has a lit and a dark side
      for (let k = 0; k <= 6; k++) {
        const [x, y] = ring(WALL_R, a + ((b - a) * k) / 6);
        g.appendChild(el('line', { x1: (x + 0.7).toFixed(1), y1: (y - 1).toFixed(1), x2: (x + 0.7).toFixed(1), y2: (y - T.h * 0.95).toFixed(1), stroke: shade(T.face, -0.3), 'stroke-width': 1.4, opacity: 0.75 }));
        g.appendChild(el('line', { x1: (x - 0.6).toFixed(1), y1: (y - 1).toFixed(1), x2: (x - 0.6).toFixed(1), y2: (y - T.h * 0.95).toFixed(1), stroke: shade(T.face, 0.24), 'stroke-width': 1, opacity: 0.6 }));
      }
    }
    g.appendChild(el('path', { d: arcPath(a, b, T.h * 0.78), fill: 'none', stroke: shade(T.top, lit * 0.1), 'stroke-width': T.h * 0.27 }));
    if (T.merlons) {
      g.appendChild(el('path', { d: arcPath(a, b, T.h), fill: 'none', stroke: shade(T.top, lit * 0.12), 'stroke-width': 5, 'stroke-dasharray': '7 7' }));
      g.appendChild(el('path', { d: arcPath(a, b, T.h), fill: 'none', stroke: PAL.ink, 'stroke-width': 5, 'stroke-dasharray': '0.9 13.1', opacity: 0.55 }));
    }
    pieces.push({ depth: wallDepthAt((a + b) / 2), g });
  }

  for (let i = 0; i < T.towers; i++) {
    const span = Math.PI * 2 - GATE_HALF * 2 - 0.44;
    const t = from + 0.22 + (T.towers === 1 ? span / 2 : (span * i) / (T.towers - 1));
    const [x, y] = ring(WALL_R, t);
    const g = tower(x, y, { ...T, face: shade(T.face, wallLight(t) * 0.22), foot: shade(T.foot, wallLight(t) * 0.14) });
    g.setAttribute('class', 'tower');
    pieces.push({ depth: wallDepthAt(t), g });
  }

  // the gate, at the nearest point of the ring, so it is always in front
  const gate = el('g', { class: 'gate' });
  const [gxl, gyl] = ring(WALL_R, GATE_AT - GATE_HALF);
  const [gxr, gyr] = ring(WALL_R, GATE_AT + GATE_HALF);
  const gh = T.h * 0.8;
  gate.appendChild(el('path', {
    d: `M ${gxl.toFixed(1)},${gyl.toFixed(1)} L ${gxr.toFixed(1)},${gyr.toFixed(1)} L ${gxr.toFixed(1)},${(gyr - gh).toFixed(1)} L ${gxl.toFixed(1)},${(gyl - gh).toFixed(1)} Z`,
    fill: PAL.timberDark, stroke: PAL.ink, 'stroke-width': 1.2,
  }));
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const x = gxl + (gxr - gxl) * t;
    const y = gyl + (gyr - gyl) * t;
    gate.appendChild(el('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: x.toFixed(1), y2: (y - gh).toFixed(1), stroke: PAL.timberMid, 'stroke-width': 1.6 }));
  }
  if (T.merlons) {
    // A finished circuit flies the colony's standard over its gate. This is
    // the wall's tier-3 animated feature (DESIGN §10): drawn here, waved by
    // the same `cloth-wave` keyframes the sprite overlays use, so there is one
    // flag in the game and not two.
    const [bx, by] = ring(WALL_R, GATE_AT);
    const mast = el('g', { class: 'anim-flag gate-banner', transform: `translate(${bx.toFixed(1)},${(by - T.h).toFixed(1)})` });
    mast.appendChild(el('line', { x1: 0, y1: 2, x2: 0, y2: -26, stroke: PAL.ink, 'stroke-width': 1.6 }));
    const cloth = el('polygon', { class: 'cloth', points: '0,-25 13,-22.2 11,-15.5 0,-14' });
    mast.appendChild(cloth);
    gate.appendChild(mast);
  }
  pieces.push({ depth: wallDepthAt(GATE_AT) + 0.01, g: gate });

  return pieces;
}
