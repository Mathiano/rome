/**
 * The base map's layout guide (docs/BASEMAP-V2-SPEC.md): a wireframe of where
 * things are, at the painting's own size. Not art — it goes to the image model
 * as a layout guide beside the spec. Written by `npm run basemap:spec`;
 * tests/basemap-spec.test.ts fails if the committed file differs.
 */
import { layout } from '../../src/data';
import { biomeSlots, clearing, corners, H, px, riverX, scenePx, seat, tiers, W } from './geometry';

type P = [number, number];
const pts = (ps: P[]) => ps.map((p) => p.join(',')).join(' ');
const mid = (ps: P[]): P => [Math.round(ps.reduce((a, p) => a + p[0], 0) / ps.length), Math.round(ps.reduce((a, p) => a + p[1], 0) / ps.length)];
/** The slope of a line running along grid y on screen, for labels laid along the river. */
const RIVER_ANGLE = (Math.atan2(28, -56) * 180) / Math.PI - 180;

/** The convex hull of a set of points (monotone chain). */
function hull(ps: P[]): P[] {
  const s = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P[] = [];
  for (const p of s) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: P[] = [];
  for (const p of [...s].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** How each biome is shown on the guide: a tint and the terrain in a few words. */
export const BIOME_LOOK: Record<string, { fill: string; terrain: string }> = {
  wood: { fill: '#6e7d48', terrain: 'forest, with stumps and log piles' },
  clay: { fill: '#a8553a', terrain: 'a red clay excavation' },
  iron: { fill: '#8a8580', terrain: 'rocky cliffs above the river' },
  grain: { fill: '#d9b969', terrain: 'open field strips' },
};

export function renderGuide(): string {
  const o: string[] = [];
  const text = (x: number, y: number, size: number, fill: string, body: string, extra = '') => o.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"${extra}>${body}</text>`);
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif">`);
  o.push(`<!-- Base map v2 layout guide: docs/BASEMAP-V2-SPEC.md. A wireframe of where things are, not art. Written by tools/basemap (npm run basemap:spec) from data/layout.json and the village projection. -->`);
  o.push(`<defs><pattern id="hatch" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="24" stroke="#b5563a" stroke-width="6" opacity="0.35"/></pattern><clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath></defs>`);
  o.push(`<rect width="${W}" height="${H}" fill="#e9e4d4"/>`);
  o.push(`<rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="#999" stroke-dasharray="12 10" stroke-width="3"/>`);
  const sc = scenePx();
  o.push(`<rect data-scene="1" x="${sc.x}" y="${sc.y}" width="${sc.w}" height="${sc.h}" fill="none" stroke="#555" stroke-dasharray="30 12" stroke-width="3"/>`);
  text(sc.x + 12, sc.y + sc.h + 44, 34, '#555', 'the whole scene at widest zoom');

  // the biomes' ground, under everything else
  for (const b of biomeSlots()) {
    const ps: P[] = b.slots.flatMap((s) => [px(s.x - 1, s.y - 1), px(s.x + 2, s.y - 1), px(s.x + 2, s.y + 2), px(s.x - 1, s.y + 2)]);
    const h = hull(ps);
    o.push(`<polygon data-biome="${b.id}" points="${pts(h)}" fill="${BIOME_LOOK[b.id].fill}" opacity="0.35" stroke="${BIOME_LOOK[b.id].fill}" stroke-width="4"/>`);
  }

  // the river, clipped to the frame
  o.push(`<g clip-path="url(#frame)"><polygon points="${pts([px(riverX, -60), px(riverX + 2.4, -60), px(riverX + 2.4, 60), px(riverX, 60)])}" fill="#7d94a0"/><polygon points="${pts([px(riverX + 0.7, -60), px(riverX + 1.7, -60), px(riverX + 1.7, 60), px(riverX + 0.7, 60)])}" fill="#5d7682" opacity="0.6"/></g>`);
  const [rlx, rly] = px(riverX + 1.2, 1);
  text(rlx, rly, 44, '#fff', `river: near bank grid x = ${riverX}, 2.4 cells wide`, ` text-anchor="middle" transform="rotate(${RIVER_ANGLE.toFixed(2)} ${rlx} ${rly})"`);

  // the clearing: its edge wanders anywhere in the band, never inside it
  const c = clearing();
  o.push(`<polygon data-clearing="outer" points="${pts(corners(c.outer))}" fill="#dcc9a4" stroke="#8f6f4f" stroke-width="3" stroke-dasharray="18 10"/>`);
  o.push(`<polygon data-clearing="inner" points="${pts(corners(c.inner))}" fill="#cfa278" stroke="#8f6f4f" stroke-width="3" stroke-dasharray="18 10"/>`);
  // along the north-east side of the band, between the wall and the clay
  const [ctx, cty] = px((c.outer.x0 + c.outer.x1) / 2, (c.outer.y0 + c.inner.y0) / 2);
  text(ctx, cty + 10, 32, '#4a3b2c', 'the clearing’s organic edge lies in this band', ` text-anchor="middle" transform="rotate(${(-RIVER_ANGLE).toFixed(2)} ${ctx} ${cty})"`);

  // nothing tall below the tier-III wall's lower sides
  const t3 = tiers()[tiers().length - 1].rect;
  o.push(`<polygon points="${pts(corners({ x0: t3.x0, y0: t3.y1, x1: t3.x1, y1: t3.y1 + 1 }))}" fill="url(#hatch)"/>`);

  // the wall lines, largest first: the tier-III line may be hinted, the rest are the drawn wall's alone
  const ts = tiers();
  for (const t of [...ts].reverse()) {
    const last = t.tier === ts.length - 1;
    o.push(`<polygon data-tier="${t.tier}" points="${pts(corners(t.rect))}" fill="none" stroke="#4a3b2c" stroke-width="${last ? 5 : 2}" stroke-dasharray="${last ? '4 10' : '14 10'}"/>`);
    o.push(`<line data-gate="${t.tier}" x1="${t.gate[0][0]}" y1="${t.gate[0][1]}" x2="${t.gate[1][0]}" y2="${t.gate[1][1]}" stroke="#b5563a" stroke-width="12"/>`);
    const [tx, ty] = corners(t.rect)[0];
    text(tx, ty + 34, 26, '#4a3b2c', `wall ${t.tier}: ${t.n}×${t.n}`, ' text-anchor="middle"');
  }
  // the riverbank at tier III
  const bank = { x0: t3.x1, y0: t3.y0, x1: t3.x1 + layout.grid.riverbankDepth, y1: t3.y1 };
  o.push(`<polygon data-bank="${ts.length - 1}" points="${pts(corners(bank))}" fill="#d7b791" stroke="#4a3b2c" stroke-width="3"/>`);
  const [bx, by] = px(bank.x0 + 0.5, (bank.y0 + bank.y1) / 2);
  text(bx, by + 10, 28, '#4a3b2c', 'riverbank (harbour)', ` text-anchor="middle" transform="rotate(${RIVER_ANGLE.toFixed(2)} ${bx} ${by})"`);

  // the praetorium's cells: the drawn seat, nothing painted
  const st = corners(seat());
  o.push(`<polygon data-seat="praetorium" points="${pts(st)}" fill="url(#hatch)" stroke="#b5563a" stroke-width="4"/>`);
  const [sx, sy] = mid(st);
  text(sx, sy + 10, 28, '#7a2e1c', 'praetorium: drawn — paint only ground', ' text-anchor="middle"');

  // the slots, three to a biome
  for (const b of biomeSlots()) {
    for (const s of b.slots) {
      o.push(`<polygon points="${pts(corners({ x0: s.x, y0: s.y + 1, x1: s.x + 1, y1: s.y + 2 }))}" fill="url(#hatch)"/>`);
      o.push(`<polygon data-slot="${s.id}" points="${pts(s.plate)}" fill="#fff" stroke="#2a2118" stroke-width="4"/>`);
      text(s.centre[0], s.centre[1] + 11, 32, '#2a2118', s.id, ' text-anchor="middle" font-weight="bold"');
    }
    const top = b.slots.map((s) => s.plate[0]).sort((p, q) => p[1] - q[1])[0];
    const [lx, ly] = mid(b.slots.map((s) => s.centre));
    text(lx, Math.min(top[1] - 30, ly - 90), 34, '#2a2118', `${b.id}: ${BIOME_LOOK[b.id].terrain}`, ' text-anchor="middle"');
  }

  const [ox, oy] = px(0, 0);
  o.push(`<circle cx="${ox}" cy="${oy}" r="8" fill="#2a2118"/>`);
  text(ox + 14, oy - 10, 24, '#2a2118', 'grid (0,0)');
  // the legend, top left, clear of the scene
  const legend = [
    'white diamond: a slot’s ground plate (224 × 112 px), flat ground',
    'red hatch: nothing tall painted here (drawn in front of it)',
    'dotted: the tier-III wall line — at most a low bank or scattered stones',
    'dashed: the wall at lower tiers, drawn only; red bar: its gate',
    'no buildings, no central building, no fence ring, anywhere',
    'outer dashes: keep ~60 px of plain country at the edge',
  ];
  o.push(`<g font-size="30" fill="#2a2118"><rect x="90" y="90" width="1130" height="${legend.length * 42 + 30}" fill="#fff" opacity="0.88"/>`
    + legend.map((l, i) => `<text x="110" y="${135 + i * 42}">${l}</text>`).join('') + '</g>');
  o.push('</svg>');
  return o.join('\n') + '\n';
}
