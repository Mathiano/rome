/**
 * The base map's layout guide (docs/BASEMAP-V2-SPEC.md): a wireframe of where
 * things are, at the painting's own size, drawn from data/layout.json and the
 * village projection. Not art — it goes to the image model as a layout guide.
 *
 *   npm run basemap:guide    (tools/basemap/write.ts writes docs/basemap-v2-geometry.svg)
 *
 * tests/basemap-spec.test.ts renders it again and fails if the committed file
 * differs, so a layout change cannot leave the guide behind.
 */
import { layout } from '../../src/data';
import { enclosureOfSize } from '../../src/village/grid';
import { gateAt, project } from '../../src/render/environment';

/** The painting's frame: scene units → image pixels. */
export const FRAME = { x: -908, y: -542, k: 2, w: 3520, h: 2200 };

/** Grid units → image pixels, rounded. */
export function px(x: number, y: number): [number, number] {
  const [sx, sy] = project(x, y);
  return [Math.round((sx - FRAME.x) * FRAME.k), Math.round((sy - FRAME.y) * FRAME.k)];
}

const pp = (...c: [number, number][]) => c.map(([x, y]) => px(x, y).join(',')).join(' ');
const diamond = (x0: number, y0: number, x1: number, y1: number) => pp([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

export function renderGuide(): string {
  const W = FRAME.w;
  const H = FRAME.h;
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif">`);
  o.push(`<!-- Base map v2 layout guide: docs/BASEMAP-V2-SPEC.md. A wireframe of where things are, not art. Computed from data/layout.json and the projection in src/render/environment.ts on 2026-09-28; tests/basemap-spec.test.ts checks its outline, gates and sites against the layout. -->`);
  o.push(`<defs><pattern id="hatch" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="24" stroke="#b5563a" stroke-width="6" opacity="0.35"/></pattern><clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath></defs>`);
  o.push(`<rect width="${W}" height="${H}" fill="#e9e4d4"/>`);
  o.push(`<rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="#999" stroke-dasharray="12 10" stroke-width="3"/>`);
  o.push(`<rect x="338" y="309" width="${3182 - 338}" height="${1893 - 309}" fill="none" stroke="#555" stroke-dasharray="30 12" stroke-width="3"/>`);
  o.push(`<text x="350" y="298" font-size="34" fill="#555">the whole scene at widest zoom</text>`);
  // the river band, clipped to the frame
  const big = enclosureOfSize(9);
  const bx = big.x1 + 1 + layout.grid.riverbankDepth;
  o.push(`<g clip-path="url(#frame)"><polygon points="${pp([bx, -40], [bx + 2.4, -40], [bx + 2.4, 40], [bx, 40])}" fill="#7d94a0"/><polygon points="${pp([bx + 0.7, -40], [bx + 1.7, -40], [bx + 1.7, 40], [bx + 0.7, 40])}" fill="#5d7682" opacity="0.6"/></g>`);
  o.push(`<text x="2398" y="1600" font-size="44" text-anchor="middle" fill="#fff" transform="rotate(-26.57 2398 1600)">river: near bank grid x = ${bx}, 2.4 cells wide</text>`);
  // nothing tall below the tier-III wall's lower sides
  o.push(`<polygon points="${pp([big.x0, big.y1 + 1], [big.x1 + 1, big.y1 + 1], [big.x1 + 1, big.y1 + 2], [big.x0, big.y1 + 2])}" fill="url(#hatch)"/>`);
  // the enclosures, largest first
  const sizes = layout.grid.sizeByWallTier;
  for (let t = sizes.length - 1; t >= 0; t--) {
    const e = enclosureOfSize(sizes[t]);
    const edge = t === 0 || t === sizes.length - 1;
    const fill = t === 0 ? '#cfa278' : t === sizes.length - 1 ? '#c9cf9f' : 'none';
    o.push(`<polygon data-tier="${t}" points="${diamond(e.x0, e.y0, e.x1 + 1, e.y1 + 1)}" fill="${fill}" stroke="#4a3b2c" stroke-width="${edge ? 5 : 3}" stroke-dasharray="${edge ? '' : '16 10'}"/>`);
    const g = gateAt(e);
    const [a, b] = [px(g.x - 0.5, g.y), px(g.x + 0.5, g.y)];
    o.push(`<line data-gate="${t}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#b5563a" stroke-width="14"/>`);
    const [lx, ly] = px(g.x, g.y + 0.35);
    o.push(`<text x="${lx - 40}" y="${ly + 14}" font-size="30" fill="#b5563a">gate ${t}</text>`);
    const [tx, ty] = px(e.x0, e.y0);
    o.push(`<text x="${tx + 10}" y="${ty - 10}" font-size="30" fill="#4a3b2c">wall tier ${t}: ${sizes[t]}×${sizes[t]}</text>`);
  }
  // the riverbank at the largest tier
  o.push(`<polygon data-bank="3" points="${diamond(big.x1 + 1, big.y0, big.x1 + 1 + layout.grid.riverbankDepth, big.y1 + 1)}" fill="#d7b791" stroke="#4a3b2c" stroke-width="3"/>`);
  const [rx, ry] = px(big.x1 + 1.5, 0);
  o.push(`<text x="${rx - 80}" y="${ry}" font-size="30" fill="#4a3b2c" transform="rotate(-26.57 ${rx} ${ry})">riverbank (harbour)</text>`);
  const [ix, iy] = px(1, 1);
  o.push(`<text x="${ix - 170}" y="${iy}" font-size="34" fill="#4a3b2c">flat packed earth (always floored)</text>`);
  o.push(`<text x="1424" y="944" font-size="30" text-anchor="middle" fill="#4a3b2c">cleared ground, low contrast</text>`);
  for (const s of layout.sites) {
    o.push(`<polygon points="${pp([s.x, s.y + 1], [s.x + 1, s.y + 1], [s.x + 1, s.y + 2], [s.x, s.y + 2])}" fill="url(#hatch)"/>`);
    o.push(`<polygon data-site="${s.id}" points="${diamond(s.x, s.y, s.x + 1, s.y + 1)}" fill="#fff" stroke="#2a2118" stroke-width="4"/>`);
    const [sx, sy] = px(s.x + 0.5, s.y + 0.5);
    o.push(`<text x="${sx}" y="${sy + 10}" font-size="30" text-anchor="middle" fill="#2a2118">${s.id} ${s.site}</text>`);
  }
  const [ox, oy] = px(0, 0);
  o.push(`<circle cx="${ox}" cy="${oy}" r="8" fill="#2a2118"/><text x="${ox + 14}" y="${oy - 10}" font-size="26" fill="#2a2118">grid (0,0)</text>`);
  o.push(`<g font-size="32" fill="#2a2118"><rect x="90" y="1900" width="1000" height="210" fill="#fff" opacity="0.85"/><text x="110" y="1945">white diamond: a site's ground plate (224 × 112 px)</text><text x="110" y="1990">red hatch: nothing tall painted here (drawn in front)</text><text x="110" y="2035">red bar: the gate at that wall tier (drawn, not painted)</text><text x="110" y="2080">outer dashes: keep ~60 px of plain country at the edge</text></g>`);
  o.push('</svg>');
  return o.join('\n') + '\n';
}
