// Inlines the generated building SVGs so tier-3 CSS animations run.
const raw = import.meta.glob('../../assets/buildings/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface Sprite { ax: number; ay: number; inner: string; }

const cache = new Map<string, Sprite>();

export function sprite(buildingId: string, tier: number): Sprite | null {
  const key = `${buildingId}_t${tier}`;
  if (cache.has(key)) return cache.get(key)!;
  const entry = Object.entries(raw).find(([p]) => p.endsWith(`/${key}.svg`));
  if (!entry) return null;
  const svg = entry[1];
  const ax = Number(/data-ax="([\d.]+)"/.exec(svg)?.[1] ?? 32);
  const ay = Number(/data-ay="([\d.]+)"/.exec(svg)?.[1] ?? 48);
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const s = { ax, ay, inner };
  cache.set(key, s);
  return s;
}

export function spriteCount(): number {
  return Object.keys(raw).length;
}
