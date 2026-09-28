import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { layout } from '../src/data';
import { enclosureOfSize } from '../src/village/grid';
import { gateAt, project } from '../src/render/environment';
import { FRAME as GUIDE_FRAME, renderGuide } from '../tools/basemap/guide';

/**
 * docs/BASEMAP-V2-SPEC.md gives the painter pixel positions computed from the
 * layout. If the layout moves and the spec does not, the painting comes back
 * wrong: recompute every figure and find it in the spec.
 */
const FRAME = { x: -908, y: -542, k: 2, w: 3520, h: 2200 };
const px = (x: number, y: number) => {
  const [sx, sy] = project(x, y);
  return `(${Math.round((sx - FRAME.x) * FRAME.k)}, ${Math.round((sy - FRAME.y) * FRAME.k)})`;
};
const spec = readFileSync('docs/BASEMAP-V2-SPEC.md', 'utf8');
const svg = readFileSync('docs/basemap-v2-geometry.svg', 'utf8');

describe('the base map v2 geometry spec matches the layout', () => {
  it('states the frame and the projection the game uses', () => {
    expect(spec).toContain(`Image: ${FRAME.w} × ${FRAME.h} px`);
    expect(FRAME.w / FRAME.h).toBe(1.6);
    expect(spec).toContain(`Grid origin:** cell corner (0, 0) is at **${px(0, 0)}**`);
    expect(project(1, 0)).toEqual([layout.tile.w * layout.cellTiles / 2, layout.tile.h * layout.cellTiles / 2]);
  });

  it('gives each wall tier\'s enclosure and gate where the grid puts them', () => {
    for (const [t, n] of layout.grid.sizeByWallTier.entries()) {
      const e = enclosureOfSize(n);
      const g = gateAt(e);
      const row = `| ${t} | ${n}×${n} | ${px(e.x0, e.y0)} | ${px(e.x1 + 1, e.y0)} | ${px(e.x1 + 1, e.y1 + 1)} | ${px(e.x0, e.y1 + 1)} | ${px(g.x - 0.5, g.y)}–${px(g.x + 0.5, g.y)} |`;
      expect(spec, `tier ${t}`).toContain(row);
    }
  });

  it('gives the riverbank strip and the river\'s near bank', () => {
    const d = layout.grid.riverbankDepth;
    for (const [t, n] of layout.grid.sizeByWallTier.entries()) {
      const e = enclosureOfSize(n);
      expect(spec, `bank ${t}`).toContain(`| ${t} | ${px(e.x1 + 1, e.y0)} | ${px(e.x1 + 1 + d, e.y0)} | ${px(e.x1 + 1 + d, e.y1 + 1)} | ${px(e.x1 + 1, e.y1 + 1)} |`);
    }
    const bankX = layout.grid.riverEdge + 1 + d;
    expect(spec).toContain(`near bank** (grid x = ${bankX}`.replace('near', 'Near'));
    expect(spec).toContain(`passes **${px(bankX, 0)}**`);
  });

  it('places every resource site\'s plate', () => {
    for (const s of layout.sites) {
      expect(spec, s.id).toContain(`| ${s.id} | ${s.site} | ${s.x}, ${s.y} | ${px(s.x + 0.5, s.y + 0.5)} | ${px(s.x, s.y)} ${px(s.x + 1, s.y)} ${px(s.x + 1, s.y + 1)} ${px(s.x, s.y + 1)} |`);
    }
  });

  it('is the guide the committed generator draws (npm run basemap:guide)', () => {
    expect(GUIDE_FRAME).toEqual(FRAME);
    expect(svg).toBe(renderGuide());
  });

  it('draws the same geometry in the guide diagram', () => {
    expect(svg).toContain(`viewBox="0 0 ${FRAME.w} ${FRAME.h}"`);
    const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
    const pts = [px(big.x0, big.y0), px(big.x1 + 1, big.y0), px(big.x1 + 1, big.y1 + 1), px(big.x0, big.y1 + 1)].map((p) => p.replace(/[() ]/g, '')).join(' ');
    expect(svg).toContain(`points="${pts}"`);
    for (const s of layout.sites) expect(svg).toContain(`data-site="${s.id}"`);
  });
});
