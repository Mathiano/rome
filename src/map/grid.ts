/**
 * Axial hex grid (DESIGN §5.1). Pointy-top hexes: +q runs east, +r south-east.
 * The colonia sits at the origin, so a hex's ring is its distance from home and
 * that is what drives claim cost and raid exposure (§5.3).
 */
export interface Hex { q: number; r: number }

export function key(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function parseKey(k: string): Hex {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

export function ring(h: Hex): number {
  return (Math.abs(h.q) + Math.abs(h.r) + Math.abs(h.q + h.r)) / 2;
}

export function distance(a: Hex, b: Hex): number {
  return ring({ q: a.q - b.q, r: a.r - b.r });
}

const DIRS: Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function neighbours(h: Hex): Hex[] {
  return DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

/** Every hex within `radius` of the origin, in reading order. */
export function within(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      out.push({ q, r });
    }
  }
  return out.sort((a, b) => a.r - b.r || a.q - b.q);
}

/** Centre of a hex in pixels, for a pointy-top layout of the given size. */
export function centre(h: Hex, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (h.q + h.r / 2),
    y: size * 1.5 * h.r,
  };
}

/** The six corners of a hex, as an SVG points string. */
export function corners(h: Hex, size: number): string {
  const c = centre(h, size);
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(c.x + size * Math.cos(a)).toFixed(2)},${(c.y + size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
