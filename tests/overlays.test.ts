// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { place, type AnimPlacement, type LoopPlacement, type ManifestEntry } from '../src/render/sprites';
import { animOverlay, loopOverlay } from '../src/render/village';

const OVERLAYS = join(__dirname, '..', 'assets', 'overlays');

function pngHeader(buf: Buffer) {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colourType: buf[25] };
}

describe('tier-3 animation overlays', () => {
  it('every tier-3 sprite carries at least one animated feature, and no other tier does', () => {
    const m = JSON.parse(readFileSync(join(__dirname, '..', 'assets', 'buildings', 'manifest.json'), 'utf8')) as
      { sprites: Record<string, { overlays?: { type: string; kind?: string; x: number; y: number; scale: number }[] }> };
    const kinds = new Set(['smoke', 'flag', 'glow', 'swing']);
    let t3 = 0;
    for (const [key, e] of Object.entries(m.sprites)) {
      const anims = (e.overlays ?? []).filter((o) => o.type === 'anim');
      if (key.endsWith('-t3')) {
        t3 += 1;
        expect(anims.length, key).toBeGreaterThan(0);
        for (const a of anims) {
          expect(kinds.has(a.kind!), `${key}: ${a.kind}`).toBe(true);
          expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
          expect(a.scale).toBeGreaterThan(0);
        }
      } else {
        expect(anims.length, `${key} should not animate`).toBe(0);
      }
    }
    expect(t3).toBe(14);
  });

  it('renders each animation kind as a driven group in scene units', () => {
    const entry: ManifestEntry = {
      file: 'x.png', width: 400, height: 300, ax: 200, ay: 220, ppu: 4, plateWidth: 112,
      overlays: [
        { type: 'anim', kind: 'smoke', x: 40, y: -300, scale: 1 },
        { type: 'anim', kind: 'flag', x: -20, y: -100, scale: 0.8 },
        { type: 'anim', kind: 'glow', x: 0, y: 0, scale: 1 },
        { type: 'anim', kind: 'swing', x: 8, y: -40, scale: 1 },
      ],
    };
    const p = place(entry, '/x.png', {});
    expect(p.overlays).toHaveLength(4);
    const smoke = p.overlays[0] as AnimPlacement;
    expect(smoke).toMatchObject({ kind: 'anim', anim: 'smoke', x: 10, y: -75, scale: 1 });
    for (const o of p.overlays) {
      const g = animOverlay(o as AnimPlacement);
      expect(g.getAttribute('class')).toContain('anim-');
      expect(g.getAttribute('transform')).toMatch(/^translate\(/);
      expect(g.childNodes.length).toBeGreaterThan(0);
    }
  });
});

describe('loop overlays', () => {
  it('places an overlay relative to the sprite anchor in scene units and renders a stepped sheet', () => {
    const entry: ManifestEntry = {
      file: 'x.png', width: 400, height: 300, ax: 200, ay: 220, ppu: 4, plateWidth: 64,
      overlays: [{ type: 'loop', file: 'smoke.png', x: 40, y: -300, width: 80, height: 120, frames: 12, fps: 12, frameWidth: 160, frameHeight: 240 }],
    };
    const p = place(entry, '/x.png', { '../../assets/overlays/smoke.png': '/o/smoke.png' });
    expect(p.overlays).toHaveLength(1);
    const o = p.overlays[0] as LoopPlacement;
    expect(o).toMatchObject({ kind: 'loop', url: '/o/smoke.png', x: 10, y: -75, width: 20, height: 30, frames: 12, fps: 12 });
    const el = loopOverlay(o);
    expect(el.getAttribute('viewBox')).toBe('0 0 160 240');
    const sheet = el.querySelector('image')!;
    expect(Number(sheet.getAttribute('width'))).toBe(160 * 12);
    expect(sheet.style.animation).toContain('steps(12)');
    expect(sheet.style.animation).toContain('1s');
    // an overlay whose sheet is missing is skipped, never thrown
    expect(place(entry, '/x.png', {}).overlays).toHaveLength(0);
  });

  it('standalone overlay manifest entries (no sprite yet) match their sheets and carry a licence', () => {
    const mpath = join(OVERLAYS, 'manifest.json');
    if (!existsSync(mpath)) return;
    const m = JSON.parse(readFileSync(mpath, 'utf8')) as { overlays: Record<string, { file: string; frames: number; fps: number; frameWidth: number; frameHeight: number; licence: string; movingArea: number; type: string }> };
    for (const [name, o] of Object.entries(m.overlays)) {
      expect(o.type, name).toBe('loop');
      expect(o.frames).toBeGreaterThan(0);
      expect(o.frames).toBeLessThanOrEqual(16);
      expect(o.frameHeight).toBeLessThanOrEqual(256);
      expect(o.movingArea).toBeLessThanOrEqual(0.4);
      expect(o.licence.length).toBeGreaterThan(0);
      const h = pngHeader(readFileSync(join(OVERLAYS, o.file)));
      expect(h.colourType).toBe(6);
      expect(h.width).toBe(o.frameWidth * o.frames);
      expect(h.height).toBe(o.frameHeight);
    }
  });
});
