/**
 * Dev-only time control. Active only with `?dev=1` in the URL.
 *
 * The game clock is `now()`. In normal play it is the wall clock. In dev mode it
 * is a virtual clock that runs `multiplier` times faster than real time and can
 * be jumped forward. The virtual offset and multiplier live under their own
 * storage key, never inside the save, and dev mode plays in its own save slot so
 * a warped colony can never leak into the real one.
 */
export const DEV_SAVE_KEY = 'rome.save.dev.v1';
export const DEV_CLOCK_KEY = 'rome.dev.clock';
export const DEV_MULTIPLIERS = [1, 10, 60, 600];

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface DevClock {
  readonly enabled: boolean;
  readonly multiplier: number;
  now(): number;
  setMultiplier(m: number): void;
  skip(ms: number): void;
}

export function isDevRequested(search: string): boolean {
  return new URLSearchParams(search).get('dev') === '1';
}

export function createDevClock(enabled: boolean, real: () => number = () => Date.now(), storage: StorageLike | null = null): DevClock {
  if (!enabled) {
    return { enabled: false, multiplier: 1, now: real, setMultiplier() {}, skip() {} };
  }
  let multiplier = 1;
  let offset = 0; // virtual - real, at the last anchor
  let anchorReal = real();
  try {
    const saved = storage?.getItem(DEV_CLOCK_KEY);
    if (saved) {
      const p = JSON.parse(saved) as { offset?: number; multiplier?: number };
      if (typeof p.offset === 'number') offset = p.offset;
      if (typeof p.multiplier === 'number' && DEV_MULTIPLIERS.includes(p.multiplier)) multiplier = p.multiplier;
    }
  } catch {
    /* ignore */
  }
  const persist = () => {
    try {
      storage?.setItem(DEV_CLOCK_KEY, JSON.stringify({ offset, multiplier }));
    } catch {
      /* ignore */
    }
  };
  const now = () => {
    const r = real();
    return r + offset + (r - anchorReal) * (multiplier - 1);
  };
  // Re-anchor so a change of multiplier never moves the current virtual time.
  const reanchor = () => {
    const r = real();
    offset = now() - r;
    anchorReal = r;
  };
  return {
    enabled: true,
    get multiplier() {
      return multiplier;
    },
    now,
    setMultiplier(m: number) {
      reanchor();
      multiplier = m;
      persist();
    },
    skip(ms: number) {
      reanchor();
      offset += ms;
      persist();
    },
  };
}
