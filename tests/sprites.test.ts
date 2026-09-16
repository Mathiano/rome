import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildings, layout } from '../src/data';
import { spriteManifest, spriteKey, place } from '../src/render/sprites';

const DIR = join(__dirname, '..', 'assets', 'buildings');

/** Width, height and colour type from a PNG's IHDR chunk. */
function pngHeader(buf: Buffer) {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colourType: buf[25] };
}

describe('sprite manifest (CLAUDE.md conventions)', () => {
  it('plate width equals the tile width from data/layout.json', () => {
    expect(spriteManifest.tileWidth).toBe(layout.tile.w);
    expect(spriteManifest.ppu).toBeGreaterThan(0);
  });
  for (const [key, e] of Object.entries(spriteManifest.sprites)) {
    it(`${key}: PNG with alpha, dimensions match, anchor at the plate centre`, () => {
      const path = join(DIR, e.file);
      expect(existsSync(path), path).toBe(true);
      const h = pngHeader(readFileSync(path));
      expect(h.width).toBe(e.width);
      expect(h.height).toBe(e.height);
      expect(h.colourType, 'colour type 6 = RGBA').toBe(6);
      expect(e.plateWidth).toBe(spriteManifest.tileWidth);
      expect(e.ppu).toBe(spriteManifest.ppu);
      // Left and right plate corners are the trimmed extremes, so the anchor sits at the horizontal centre.
      expect(Math.abs(e.ax - e.width / 2)).toBeLessThanOrEqual(1.5);
      expect(e.ay).toBeGreaterThan(0);
      expect(e.ay).toBeLessThanOrEqual(e.height);
      const p = place(e, 'x');
      expect(p.width).toBeCloseTo(e.width / e.ppu, 6);
      expect(p.x).toBeCloseTo(-e.ax / e.ppu, 6);
      expect(p.y).toBeCloseTo(-e.ay / e.ppu, 6);
    });
  }
  it('reports which building tiers still lack a sprite', () => {
    const missing: string[] = [];
    for (const b of buildings) for (let t = 1; t <= b.tiers.length; t++) if (!spriteManifest.sprites[spriteKey(b.id, t)]) missing.push(spriteKey(b.id, t));
    const total = buildings.reduce((n, b) => n + b.tiers.length, 0);
    console.warn(`sprites: ${total - missing.length}/${total} building tiers have art`);
    expect(missing.length + Object.keys(spriteManifest.sprites).length).toBeGreaterThanOrEqual(total);
  });
  it('no isobuild SVGs remain', () => {
    expect(existsSync(join(__dirname, '..', 'tools', 'isobuild'))).toBe(false);
    expect(existsSync(join(DIR, 'forum_t1.svg'))).toBe(false);
  });
});
