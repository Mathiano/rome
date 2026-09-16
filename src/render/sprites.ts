// Building sprites: PNG with alpha, described by assets/buildings/manifest.json
// (written by tools/artgen/). Scene units: the plate width equals the tile
// width; the PNG holds `ppu` pixels per unit. Anchor = plate centre.
import manifest from '../../assets/buildings/manifest.json';

const urls = import.meta.glob('../../assets/buildings/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export interface ManifestEntry {
  file: string;
  width: number;
  height: number;
  ax: number;
  ay: number;
  ppu: number;
  plateWidth: number;
}
export interface Manifest { tileWidth: number; ppu: number; sprites: Record<string, ManifestEntry> }

/** Placement of a sprite in scene units relative to its anchor. */
export interface Placement { url: string; x: number; y: number; width: number; height: number; ax: number; ay: number }

export const spriteManifest = manifest as Manifest;

/** Manifest key for a building tier: `lumber_camp` tier 1 → `lumber-camp-t1`. */
export function spriteKey(buildingId: string, tier: number): string {
  return `${buildingId.replace(/_/g, '-')}-t${tier}`;
}

export function place(entry: ManifestEntry, url: string): Placement {
  const s = 1 / entry.ppu;
  const ax = entry.ax * s;
  const ay = entry.ay * s;
  return { url, x: -ax, y: -ay, width: entry.width * s, height: entry.height * s, ax, ay };
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
