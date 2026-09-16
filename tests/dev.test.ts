import { describe, it, expect } from 'vitest';
import { createDevClock, isDevRequested, DEV_CLOCK_KEY, DEV_SAVE_KEY } from '../src/dev';
import { createInitialState, serialise, SAVE_KEY } from '../src/state/store';

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m };
}

describe('dev clock', () => {
  it('is only requested by ?dev=1', () => {
    expect(isDevRequested('?dev=1')).toBe(true);
    expect(isDevRequested('?dev=true')).toBe(false);
    expect(isDevRequested('')).toBe(false);
  });
  it('disabled: is the real clock and ignores controls', () => {
    let t = 1000;
    const c = createDevClock(false, () => t);
    c.setMultiplier(600);
    c.skip(1e9);
    t = 2000;
    expect(c.now()).toBe(2000);
    expect(c.enabled).toBe(false);
  });
  it('enabled: runs multiplier times faster, skips, and never jumps when the multiplier changes', () => {
    let t = 0;
    const st = fakeStorage();
    const c = createDevClock(true, () => t, st);
    expect(c.now()).toBe(0);
    c.setMultiplier(10);
    t = 100;
    expect(c.now()).toBe(1000);
    c.setMultiplier(1); // virtual time must stay at 1000
    expect(c.now()).toBe(1000);
    t = 200;
    expect(c.now()).toBe(1100);
    c.skip(3_600_000);
    expect(c.now()).toBe(1100 + 3_600_000);
    // offset and multiplier persist under the dev key only
    expect(st.map.has(DEV_CLOCK_KEY)).toBe(true);
    expect(st.map.has(SAVE_KEY)).toBe(false);
    expect(st.map.has(DEV_SAVE_KEY)).toBe(false);
    const again = createDevClock(true, () => t, st);
    expect(again.now()).toBe(c.now());
  });
  it('leaves no trace in the save format', () => {
    const json = serialise(createInitialState(0, 1));
    expect(json).not.toMatch(/dev|multiplier|offset/i);
    expect(DEV_SAVE_KEY).not.toBe(SAVE_KEY);
  });
});
