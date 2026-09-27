// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, deserialise, KEPT_MIGRATION, loadFromLocalStorage, retiredKey, SaveTooOld, serialise } from '../src/state/store';
import { config } from '../src/data';

/** The save rule (CLAUDE.md): older formats reset, bar the one kept migration. */
describe('the save rule', () => {
  beforeEach(() => localStorage.clear());

  it('loads a save of the current format', () => {
    const s = createInitialState(0, 1);
    expect(s.version).toBe(config.saveVersion);
    expect(deserialise(serialise(s)).slots).toEqual(s.slots);
  });

  it('carries only the ring-to-grid one-off forward, and only while it is current', () => {
    expect(KEPT_MIGRATION).toEqual({ from: 1, to: 2 });
    const old = { ...JSON.parse(serialise(createInitialState(0, 1))), version: KEPT_MIGRATION.from };
    if (config.saveVersion === KEPT_MIGRATION.to) expect(() => deserialise(JSON.stringify(old))).not.toThrow();
    else expect(() => deserialise(JSON.stringify(old))).toThrow(SaveTooOld);
  });

  it('refuses any other older format, and a newer one', () => {
    const raw = JSON.parse(serialise(createInitialState(0, 1)));
    expect(() => deserialise(JSON.stringify({ ...raw, version: 0 }))).toThrow(SaveTooOld);
    expect(() => deserialise(JSON.stringify({ ...raw, version: config.saveVersion + 1 }))).toThrow(/newer version/);
  });

  it('sets an old save aside rather than letting the new colony overwrite it', () => {
    const json = JSON.stringify({ ...JSON.parse(serialise(createInitialState(0, 1))), version: 0 });
    localStorage.setItem('k', json);
    const heard: number[] = [];
    expect(loadFromLocalStorage('k', (v) => heard.push(v))).toBeNull();
    expect(heard).toEqual([0]);
    expect(localStorage.getItem(retiredKey('k', 0))).toBe(json);
  });
});
