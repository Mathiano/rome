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

/** A tower on the wall: a drum of stone with a tiled cap. */
function tower(x: number, y: number): SVGGElement {
  const g = el('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
  g.appendChild(el('ellipse', { cx: 0, cy: 0, rx: 9, ry: 4.5, fill: PAL.wallFoot, stroke: PAL.ink, 'stroke-width': 1 }));
  g.appendChild(el('path', { d: 'M -9,0 L -9,-20 A 9,4.5 0 0 1 9,-20 L 9,0 A 9,4.5 0 0 1 -9,0 Z', fill: PAL.wallMid, stroke: PAL.ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  g.appendChild(el('path', { d: 'M -9,-3 L -9,-20 A 9,4.5 0 0 1 0,-24.5 L 0,-7.5 A 9,4.5 0 0 0 -9,-3 Z', fill: PAL.wallDark, opacity: 0.45 }));
  g.appendChild(el('path', { d: 'M -9,-20 A 9,4.5 0 0 1 9,-20 A 9,4.5 0 0 1 -9,-20 Z', fill: PAL.wallLight, stroke: PAL.ink, 'stroke-width': 1 }));
  for (let i = -1; i <= 1; i++) {
    g.appendChild(el('rect', { x: i * 5.6 - 2.1, y: -25.5, width: 4.2, height: 5.8, fill: PAL.wallLight, stroke: PAL.ink, 'stroke-width': 0.8 }));
  }
  g.appendChild(el('polygon', { points: '-10,-25 10,-25 0,-34', fill: PAL.roofMid, stroke: PAL.ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  g.appendChild(el('polygon', { points: '0,-25 10,-25 0,-34', fill: PAL.roofDark }));
  return g;
}

/**
 * The whole environment, as one group to sit behind every plot.
 * `viewBox` is the village view's own, so the country fills it edge to edge.
 */
export function createEnvironment(view: { x: number; y: number; w: number; h: number }): SVGGElement {
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

  // --- the wall: a banded ring, broken where the gate stands. Stroking the
  // ring three times — footing, face, coping — gives it mass without needing a
  // separate polygon for the near and far halves.
  const wall = el('g', { class: 'wall' });
  const arcPath = (from: number, to: number, lift: number) => {
    const steps = Math.max(8, Math.round(((to - from) / (Math.PI * 2)) * 96));
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const [x, y] = ring(WALL_R, from + ((to - from) * i) / steps);
      d += `${i ? ' L' : 'M'} ${x.toFixed(1)},${(y - lift).toFixed(1)}`;
    }
    return d;
  };
  const from = GATE_AT + GATE_HALF;
  const to = GATE_AT + Math.PI * 2 - GATE_HALF;
  wall.appendChild(el('path', { d: arcPath(from, to, 0), fill: 'none', stroke: PAL.ink, 'stroke-width': 20, 'stroke-linecap': 'butt' }));
  wall.appendChild(el('path', { d: arcPath(from, to, 1.5), fill: 'none', stroke: PAL.wallFoot, 'stroke-width': 17, 'stroke-linecap': 'butt' }));
  wall.appendChild(el('path', { d: arcPath(from, to, 5), fill: 'none', stroke: PAL.wallDark, 'stroke-width': 13, 'stroke-linecap': 'butt' }));
  wall.appendChild(el('path', { d: arcPath(from, to, 9), fill: 'none', stroke: PAL.wallMid, 'stroke-width': 9, 'stroke-linecap': 'butt' }));
  // Coping and merlons in one stroke: a dashed line along the top is a row of
  // teeth, where seventy little rectangles read as scattered debris.
  wall.appendChild(el('path', { d: arcPath(from, to, 13.5), fill: 'none', stroke: PAL.wallLight, 'stroke-width': 4, 'stroke-linecap': 'butt' }));
  wall.appendChild(el('path', { d: arcPath(from, to, 17), fill: 'none', stroke: PAL.wallLight, 'stroke-width': 5, 'stroke-linecap': 'butt', 'stroke-dasharray': '7 7' }));
  wall.appendChild(el('path', { d: arcPath(from, to, 17), fill: 'none', stroke: PAL.ink, 'stroke-width': 5, 'stroke-linecap': 'butt', 'stroke-dasharray': '0.9 13.1', opacity: 0.55 }));
  root.appendChild(wall);

  // towers around the ring, and two flanking the gate
  const towers = el('g', { class: 'towers' });
  for (let i = 0; i < 8; i++) {
    const t = GATE_AT + GATE_HALF + 0.22 + ((Math.PI * 2 - GATE_HALF * 2 - 0.44) * i) / 7;
    const [x, y] = ring(WALL_R, t);
    towers.appendChild(tower(x, y));
  }
  root.appendChild(towers);

  // --- the gate itself, drawn last of the wall so it reads as the way in
  const gate = el('g', { class: 'gate' });
  const [gxl, gyl] = ring(WALL_R, GATE_AT - GATE_HALF);
  const [gxr, gyr] = ring(WALL_R, GATE_AT + GATE_HALF);
  gate.appendChild(el('path', {
    d: `M ${gxl.toFixed(1)},${gyl.toFixed(1)} L ${gxr.toFixed(1)},${gyr.toFixed(1)} L ${gxr.toFixed(1)},${(gyr - 13).toFixed(1)} L ${gxl.toFixed(1)},${(gyl - 13).toFixed(1)} Z`,
    fill: PAL.timberDark, stroke: PAL.ink, 'stroke-width': 1.2,
  }));
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const x = gxl + (gxr - gxl) * t;
    const y = gyl + (gyr - gyl) * t;
    gate.appendChild(el('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: x.toFixed(1), y2: (y - 13).toFixed(1), stroke: PAL.timberMid, 'stroke-width': 1.6 }));
  }
  root.appendChild(gate);

  return root;
}
