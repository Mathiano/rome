// Deterministic PRNG (mulberry32). The seed lives in the save so a round is
// reproducible from a save file, which is what makes politics testable.
export function nextRandom(state: { seed: number }): number {
  let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function chance(state: { seed: number }, p: number): boolean {
  return nextRandom(state) < p;
}
export function pick<T>(state: { seed: number }, arr: T[]): T {
  return arr[Math.floor(nextRandom(state) * arr.length)];
}
export function weighted<T extends { weight: number }>(state: { seed: number }, arr: T[]): T {
  const total = arr.reduce((s, a) => s + a.weight, 0);
  let r = nextRandom(state) * total;
  for (const a of arr) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return arr[arr.length - 1];
}
