// Building sprites: PNG with alpha, described by assets/buildings/manifest.json
// (written by tools/artgen/). Scene units: the plate width equals the tile
// width; the PNG holds `ppu` pixels per unit. Anchor = plate centre.
import manifest from '../../assets/buildings/manifest.json';

const urls = import.meta.glob('../../assets/buildings/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export interface LoopOverlay {
  type: 'loop';
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frames: number;
  fps: number;
  frameWidth: number;
  frameHeight: number;
  licence?: string;
}
export interface ManifestEntry {
  file: string;
  width: number;
  height: number;
  ax: number;
  ay: number;
  ppu: number;
  plateWidth: number;
  overlays?: LoopOverlay[];
}
export interface Manifest { tileWidth: number; ppu: number; sprites: Record<string, ManifestEntry> }

/** Placement of a sprite in scene units relative to its anchor. */
export interface Placement { url: string; x: number; y: number; width: number; height: number; ax: number; ay: number; overlays: OverlayPlacement[] }
/** A loop overlay in scene units relative to the same anchor. */
export interface OverlayPlacement { url: string; x: number; y: number; width: number; height: number; frames: number; fps: number; frameWidth: number; frameHeight: number }

const overlayUrls = import.meta.glob('../../assets/overlays/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export const spriteManifest = manifest as Manifest;

/** Manifest key for a building tier: `lumber_camp` tier 1 → `lumber-camp-t1`. */
export function spriteKey(buildingId: string, tier: number): string {
  return `${buildingId.replace(/_/g, '-')}-t${tier}`;
}

export function place(entry: ManifestEntry, url: string, overlayUrlMap: Record<string, string> = overlayUrls): Placement {
  const s = 1 / entry.ppu;
  const ax = entry.ax * s;
  const ay = entry.ay * s;
  const overlays: OverlayPlacement[] = [];
  for (const o of entry.overlays ?? []) {
    if (o.type !== 'loop') continue;
    const ourl = Object.entries(overlayUrlMap).find(([p]) => p.endsWith(`/${o.file}`))?.[1];
    if (!ourl) continue;
    overlays.push({ url: ourl, x: o.x * s, y: o.y * s, width: o.width * s, height: o.height * s, frames: o.frames, fps: o.fps, frameWidth: o.frameWidth, frameHeight: o.frameHeight });
  }
  return { url, x: -ax, y: -ay, width: entry.width * s, height: entry.height * s, ax, ay, overlays };
}

export function sprite(buildingId: string, tier: number, m: Manifest = spriteManifest, urlMap: Record<string, string> = urls): Placement | null {
  const entry = m.sprites[spriteKey(buildingId, tier)];
  if (!entry) return null;
  const url = Object.entries(urlMap).find(([p]) => p.endsWith(`/${entry.file}`))?.[1];
  if (!url) return null;
  return place(entry, url);
}

export function spriteCount(): number {
  return Object.keys(spriteManifest.sprites).length;
}
