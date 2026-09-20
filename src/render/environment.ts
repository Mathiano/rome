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

/** The same palette the sprites are drawn from (tools/artgen/palette.json). */
const PAL = {
  ink: '#1e0702',
  grass: '#8d9a5f',
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

/**
 * A fixed-seed generator. The country is the same on every load and in every
 * colony — it is scenery, not content, and a tree that jumps between frames
 * would read as a bug.
 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function path(d: string, fill: string, stroke = 'none', width = 0): SVGPathElement {
  const p = el('path', { d, fill });
  if (stroke !== 'none') { p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', String(width)); p.setAttribute('stroke-linejoin', 'round'); }
  return p;
}

/** One conifer, drawn small: these are country, not the sprites' own trees. */
function tree(x: number, y: number, s: number, rand: () => number): SVGGElement {
  const g = el('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
  const h = 13 * s;
  const w = 5.2 * s;
  g.appendChild(el('rect', { x: -0.9 * s, y: -1.5 * s, width: 1.8 * s, height: 4 * s, fill: PAL.timberDark }));
  const tiers = rand() > 0.45 ? 3 : 2;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const top = -h * (0.42 + 0.58 * t) - 1.5 * s;
    const half = w * (1 - t * 0.34);
    g.appendChild(el('polygon', {
      points: `0,${top.toFixed(1)} ${half.toFixed(1)},${(top + h * 0.42).toFixed(1)} ${(-half).toFixed(1)},${(top + h * 0.42).toFixed(1)}`,
      fill: i === tiers - 1 ? PAL.leafMid : PAL.leafDark,
      stroke: PAL.ink,
      'stroke-width': 0.6,
      'stroke-linejoin': 'round',
    }));
  }
  return g;
}

/** A broadleaf, for variety at the wood's edge. */
function bush(x: number, y: number, s: number): SVGGElement {
  const g = el('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
  g.appendChild(el('ellipse', { cx: 0, cy: -3 * s, rx: 5 * s, ry: 3.6 * s, fill: PAL.leafMid, stroke: PAL.ink, 'stroke-width': 0.6 }));
  g.appendChild(el('ellipse', { cx: -1.6 * s, cy: -4.6 * s, rx: 3 * s, ry: 2.2 * s, fill: PAL.leafLight }));
  return g;
}

function rock(x: number, y: number, s: number): SVGGElement {
  const g = el('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
  g.appendChild(el('polygon', {
    points: `${-6 * s},${1.5 * s} ${-3.4 * s},${-4 * s} ${2 * s},${-5 * s} ${6 * s},${0.5 * s} ${1.5 * s},${2.5 * s}`,
    fill: PAL.stoneMid, stroke: PAL.ink, 'stroke-width': 0.7, 'stroke-linejoin': 'round',
  }));
  g.appendChild(el('polygon', {
    points: `${-3.4 * s},${-4 * s} ${2 * s},${-5 * s} ${1 * s},${-1 * s} ${-2.4 * s},${-0.6 * s}`,
    fill: PAL.stoneLight,
  }));
  return g;
}

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
  const rand = rng(0x52_4f_4d_45); // "ROME"

  // --- the country, filling the frame behind everything
  root.appendChild(el('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: PAL.grass }));

  // a few darker sweeps so the grass is not one flat field
  for (let i = 0; i < 5; i++) {
    const cx = view.x + rand() * view.w;
    const cy = view.y + rand() * view.h;
    root.appendChild(el('ellipse', { cx: cx.toFixed(1), cy: cy.toFixed(1), rx: (70 + rand() * 90).toFixed(1), ry: (26 + rand() * 30).toFixed(1), fill: PAL.grassDark, opacity: 0.35 }));
  }

  // --- the river, east and south-east, where the clay banks are
  const river = el('g', { class: 'river' });
  const rp = 'M 355,-190 C 320,-120 330,-40 300,30 C 275,92 300,140 288,180';
  river.appendChild(el('path', { d: rp, fill: 'none', stroke: PAL.waterDeep, 'stroke-width': 54, 'stroke-linecap': 'round' }));
  river.appendChild(el('path', { d: rp, fill: 'none', stroke: PAL.water, 'stroke-width': 44, 'stroke-linecap': 'round' }));
  river.appendChild(el('path', { d: 'M 348,-180 C 316,-112 326,-38 296,32 C 272,92 296,138 284,176', fill: 'none', stroke: '#9fb2ba', 'stroke-width': 3, opacity: 0.7 }));
  root.appendChild(river);

  // --- the wood, north and north-east, behind the forest plots
  const wood = el('g', { class: 'wood' });
  // no blob under it: a flat dark ellipse read as a shadow. The mass comes
  // from the trees themselves, standing close.
  const woodTrees: [number, number, number][] = [];
  for (let i = 0; i < 90; i++) {
    const x = -330 + rand() * 430;
    const y = -192 + rand() * 74 + Math.abs(x + 90) * 0.04;
    woodTrees.push([x, y, 0.8 + rand() * 0.75]);
  }
  woodTrees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s] of woodTrees) wood.appendChild(tree(x, y, s, rand));
  root.appendChild(wood);

  // --- ploughed strips, south and west, beyond the farms
  // Strips lie along the same isometric grid as everything else; axis-aligned
  // rectangles read as labels stuck on the grass.
  const fields = el('g', { class: 'fields' });
  for (const [gx0, gy0, wTiles, hTiles] of [[-9.5, 1.5, 4, 2.6], [-7.5, 5.5, 4.5, 2.4], [-1.5, 8.5, 5, 2.6]] as const) {
    const corners: [number, number][] = [
      project(gx0, gy0), project(gx0 + wTiles, gy0),
      project(gx0 + wTiles, gy0 + hTiles), project(gx0, gy0 + hTiles),
    ];
    const pts = corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    fields.appendChild(el('polygon', { points: pts, fill: PAL.grain, opacity: 0.42, stroke: PAL.earthDark, 'stroke-width': 1 }));
    for (let i = 1; i < 7; i++) {
      const a = project(gx0 + (wTiles * i) / 7, gy0);
      const b = project(gx0 + (wTiles * i) / 7, gy0 + hTiles);
      fields.appendChild(el('line', { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1), stroke: PAL.earthDark, 'stroke-width': 1.2, opacity: 0.45 }));
    }
  }
  root.appendChild(fields);

  // --- rock, south-east, where the iron is
  const rocks = el('g', { class: 'rocks' });
  for (const [x, y, s] of [[236, 128, 1.9], [268, 148, 1.3], [212, 152, 1.1], [-292, 22, 1.6], [-300, 58, 1.1]] as const) {
    rocks.appendChild(rock(x, y, s));
  }
  root.appendChild(rocks);

  // --- the town ground: one continuous floor inside the wall
  const groundPts: [number, number][] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const [x, y] = ring(WALL_R * 0.995, t);
    groundPts.push([x, y]);
  }
  let gd = `M ${groundPts[0][0].toFixed(1)},${groundPts[0][1].toFixed(1)}`;
  for (const [x, y] of groundPts.slice(1)) gd += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
  root.appendChild(el('ellipse', { cx: 0, cy: 14, rx: (RING_X * WALL_R * 1.02).toFixed(1), ry: (RING_Y * WALL_R * 1.02).toFixed(1), fill: PAL.ink, opacity: 0.13 }));
  root.appendChild(path(gd + ' Z', PAL.earthLight, PAL.ink, 1.2));

  // worn patches, so the floor is not flat colour
  for (let i = 0; i < 14; i++) {
    const t = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * WALL_R * 0.88;
    const [x, y] = ring(r, t);
    root.appendChild(el('ellipse', { cx: x.toFixed(1), cy: y.toFixed(1), rx: (18 + rand() * 34).toFixed(1), ry: (9 + rand() * 15).toFixed(1), fill: PAL.earthMid, opacity: 0.16 }));
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

  // --- a handful of trees and bushes inside the wall, for softness
  const inside = el('g', { class: 'inside-green' });
  for (const [t, r, s] of [[2.5, 5.3, 0.85], [3.5, 5.4, 0.7], [4.4, 5.2, 0.9], [5.4, 5.3, 0.75], [0.35, 5.35, 0.8]] as const) {
    const [x, y] = ring(r, t);
    inside.appendChild(rand() > 0.5 ? tree(x, y, s, rand) : bush(x, y, s));
  }
  root.appendChild(inside);

  return root;
}
