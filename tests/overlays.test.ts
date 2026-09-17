// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { place, type ManifestEntry } from '../src/render/sprites';
import { loopOverlay } from '../src/render/village';

const OVERLAYS = join(__dirname, '..', 'assets', 'overlays');

function pngHeader(buf: Buffer) {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colourType: buf[25] };
}

describe('loop overlays', () => {
  it('places an overlay relative to the sprite anchor in scene units and renders a stepped sheet', () => {
    const entry: ManifestEntry = {
      file: 'x.png', width: 400, height: 300, ax: 200, ay: 220, ppu: 4, plateWidth: 64,
      overlays: [{ type: 'loop', file: 'smoke.png', x: 40, y: -300, width: 80, height: 120, frames: 12, fps: 12, frameWidth: 160, frameHeight: 240 }],
    };
    const p = place(entry, '/x.png', { '../../assets/overlays/smoke.png': '/o/smoke.png' });
    expect(p.overlays).toHaveLength(1);
    const o = p.overlays[0];
    expect(o).toMatchObject({ url: '/o/smoke.png', x: 10, y: -75, width: 20, height: 30, frames: 12, fps: 12 });
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
