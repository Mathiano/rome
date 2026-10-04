// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { layout } from '../src/data';
import { enclosureOfSize, inRect } from '../src/village/grid';
import { project } from '../src/render/environment';
import { sceneBounds } from '../src/render/village';
import { renderGuide } from '../tools/basemap/guide';
import { renderSpec } from '../tools/basemap/spec';
import { CLEARING, clearing, FRAME, H, K, STAGE_ASPECTS, W } from '../tools/basemap/geometry';

/**
 * docs/BASEMAP-V2-SPEC.md and docs/basemap-v2-geometry.svg are what
 * tools/basemap writes from the layout (npm run basemap:spec). If the layout
 * moves and they do not, the painting comes back wrong.
 */
const spec = readFileSync('docs/BASEMAP-V2-SPEC.md', 'utf8');
const svg = readFileSync('docs/basemap-v2-geometry.svg', 'utf8');

describe('the base map v2 spec and guide', () => {
  it('are exactly what the committed generator writes from the layout', () => {
    expect(spec).toBe(renderSpec());
    expect(svg).toBe(renderGuide());
  });

  it('frame the whole scene at 16:10 with bleed for every stage aspect the spec promises', () => {
    const s = sceneBounds();
    expect(W / H).toBe(1.6);
    expect(W).toBe(FRAME.w * K);
    expect(FRAME.x).toBeLessThanOrEqual(s.x);
    expect(FRAME.y).toBeLessThanOrEqual(s.y);
    expect(FRAME.x + FRAME.w).toBeGreaterThanOrEqual(s.x + s.w);
    expect(FRAME.y + FRAME.h).toBeGreaterThanOrEqual(s.y + s.h);
    // a stage at either limit, showing the whole scene letterboxed, still falls on the painting
    expect(s.w / STAGE_ASPECTS.min).toBeLessThanOrEqual(FRAME.h);
    expect(s.h * STAGE_ASPECTS.max).toBeLessThanOrEqual(FRAME.w);
    expect(spec).toContain(`Image: ${W} × ${H} px`);
  });

  it('state pixels the projection agrees with', () => {
    const px = (x: number, y: number) => { const [sx, sy] = project(x, y); return `(${Math.round((sx - FRAME.x) * K)}, ${Math.round((sy - FRAME.y) * K)})`; };
    expect(spec).toContain(`cell corner (0, 0) is at **${px(0, 0)}**`);
    for (const [t, n] of layout.grid.sizeByWallTier.entries()) {
      const e = enclosureOfSize(n);
      expect(spec, `tier ${t}`).toContain(`| ${t} | ${n}×${n} | ${px(e.x0, e.y0)} | ${px(e.x1 + 1, e.y0)} | ${px(e.x1 + 1, e.y1 + 1)} | ${px(e.x0, e.y1 + 1)} |`);
    }
    for (const s of layout.sites) expect(spec, s.id).toContain(`| ${s.id} | ${s.x}, ${s.y} | ${px(s.x + 0.5, s.y + 0.5)} |`);
  });

  it('hold the tier-III enclosure inside the clearing with margin, and mark every slot on the guide', () => {
    const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
    const { inner } = clearing();
    expect(CLEARING.inner).toBeGreaterThan(0);
    expect(inner.x0).toBeLessThan(big.x0);
    expect(inner.y0).toBeLessThan(big.y0);
    expect(inner.y1).toBeGreaterThan(big.y1 + 1);
    expect(inRect({ x0: inner.x0, x1: inner.x1 - 1, y0: inner.y0, y1: inner.y1 - 1 }, big.x0, big.y0)).toBe(true);
    for (const s of layout.sites) expect(svg, s.id).toContain(`data-slot="${s.id}"`);
    for (const b of ['wood', 'clay', 'iron', 'grain']) expect(svg).toContain(`data-biome="${b}"`);
    expect(svg).toContain('data-seat="praetorium"');
  });

  it('forbid anything built, and hint the wall at most', () => {
    expect(spec).toMatch(/\*\*No buildings anywhere in the painting\.\*\* No central building/);
    expect(spec).toContain('no fence ring');
    expect(spec).toContain('**Never paint it as a structure.**');
    expect(spec).toContain('organic, irregular edge');
    for (const t of ['forest, with stumps and log piles', 'a red clay excavation', 'rocky cliffs', 'open field strips']) expect(spec).toContain(t);
  });
});
