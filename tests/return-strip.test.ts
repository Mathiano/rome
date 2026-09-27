import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { config } from '../src/data';
import { arrive, markSeen, returnReport } from '../src/village/away';
import { awayLines } from '../src/render/due';

/**
 * "Since you were last here" is anchored to when the player last saw the
 * colony (Mathias, 2026-09-25): `lastSeen` is stamped when the strip is put
 * away, and the strip shows only after a gap of config.returnStrip.minGapMinutes.
 */
const T0 = 1_000_000;
const MIN = 60_000;
const GAP = config.returnStrip.minGapMinutes * MIN;

/** Close the tab and open it again `ms` later: what main.ts does on load. */
function reload(json: string, at: number) {
  const g = new Game(deserialise(json));
  g.tick(at);
  return { g, report: returnReport(g.state, at) };
}

describe('the return strip', () => {
  it('the threshold is data, 30 minutes by default', () => {
    expect(config.returnStrip.minGapMinutes).toBe(30);
  });

  it('a reload a minute after putting the strip away shows nothing', () => {
    const g = new Game(createInitialState(T0, 3));
    g.tick(T0 + 5 * MIN);
    markSeen(g.state, T0 + 5 * MIN); // the strip put away
    const { report } = reload(serialise(g.state), T0 + 6 * MIN);
    expect(report).toBeNull();
  });

  it('nothing shows below the threshold, and the strip shows past it', () => {
    const g = new Game(createInitialState(T0, 3));
    markSeen(g.state, T0);
    const json = serialise(g.state);
    expect(reload(json, T0 + GAP - 1).report).toBeNull();
    const { report } = reload(json, T0 + GAP + MIN);
    expect(report).not.toBeNull();
    expect(awayLines(report!).join(' ')).toMatch(/\+\d+ wood/);
  });

  it('is anchored to when the colony was last seen, not to the last tick or save', () => {
    const g = new Game(createInitialState(T0, 3));
    markSeen(g.state, T0);
    const woodSeen = g.state.resources.wood;
    // the game stayed open with the strip up (not seen), ticking and saving for 20 minutes
    g.tick(T0 + 20 * MIN);
    const json = serialise(g.state);
    const { g: g2, report } = reload(json, T0 + 40 * MIN);
    // 40 minutes since seen: shown, and it counts all 40, not the 20 since the last save
    expect(report).not.toBeNull();
    expect(report!.resources.wood).toBe(Math.round(g2.state.resources.wood - woodSeen));
  });

  it('a strip never put away is still owed on the next reload', () => {
    const g = new Game(createInitialState(T0, 3));
    markSeen(g.state, T0);
    const first = reload(serialise(g.state), T0 + 2 * 60 * MIN);
    expect(first.report).not.toBeNull();
    // closed again without an action: lastSeen did not move
    const second = reload(serialise(first.g.state), T0 + 2 * 60 * MIN + MIN);
    expect(second.report).not.toBeNull();
    // put away this time: the next reload a minute later is silent
    markSeen(second.g.state, T0 + 2 * 60 * MIN + MIN);
    expect(reload(serialise(second.g.state), T0 + 2 * 60 * MIN + 2 * MIN).report).toBeNull();
  });

  it('past the threshold but with nothing changed, it stays quiet', () => {
    const s = createInitialState(T0, 3);
    for (const id of Object.keys(s.resources) as (keyof typeof s.resources)[]) s.resources[id] = 1_000_000; // every store full
    markSeen(s, T0);
    const json = serialise(s);
    const g = new Game(deserialise(json));
    // no clock passes for the colony (lastTick moved with lastSeen), only the stamp is old
    g.state.lastTick = T0 + 2 * GAP;
    expect(returnReport(g.state, T0 + 2 * GAP)).toBeNull();
  });

  it('the stamp survives export and import, and an imported colony is judged by its own stamp', () => {
    const g = new Game(createInitialState(T0, 3));
    markSeen(g.state, T0 + 7 * MIN);
    const exported = serialise(g.state); // what Export writes
    expect(JSON.parse(exported).lastSeen.at).toBe(T0 + 7 * MIN);
    const imported = deserialise(exported); // what Import reads
    expect(imported.lastSeen).toEqual(g.state.lastSeen);
    // imported two hours on: the strip it is owed is shown, and the stamp is not moved by arriving
    const g2 = new Game(imported);
    const at = T0 + 7 * MIN + 2 * 60 * MIN;
    g2.tick(at);
    expect(arrive(g2.state, at)).not.toBeNull();
    expect(g2.state.lastSeen!.at).toBe(T0 + 7 * MIN);
    // imported a minute on: nothing
    const g3 = new Game(deserialise(exported));
    g3.tick(T0 + 8 * MIN);
    expect(arrive(g3.state, T0 + 8 * MIN)).toBeNull();
  });

  it('an old save without a stamp defaults to the load time, not zero and not its last play', () => {
    const played = createInitialState(T0, 3);
    const old = JSON.parse(serialise(played));
    delete old.lastSeen;
    const back = deserialise(JSON.stringify(old));
    expect(back.lastSeen).toBeUndefined(); // the migration does not invent a time
    const load = T0 + 5 * 60 * MIN; // five hours after it was last played
    const g = new Game(back);
    g.tick(load);
    expect(arrive(g.state, load)).toBeNull(); // first load after the update: nothing
    expect(g.state.lastSeen!.at).toBe(load);
    expect(g.state.lastSeen!.at).not.toBe(0);
    expect(g.state.lastSeen!.at).not.toBe(played.lastTick);
    // from then on it behaves like any save
    const json = serialise(g.state);
    const soon = new Game(deserialise(json));
    soon.tick(load + MIN);
    expect(arrive(soon.state, load + MIN)).toBeNull();
    const later = new Game(deserialise(json));
    later.tick(load + GAP + MIN);
    expect(arrive(later.state, load + GAP + MIN)).not.toBeNull();
  });

  it('a damaged stamp is treated as missing and set to the load time', () => {
    for (const bad of [{ at: 0 }, { at: Number.NaN }, { at: T0 }, { snapshot: {} }, null]) {
      const raw = JSON.parse(serialise(createInitialState(T0, 3)));
      raw.lastSeen = bad && 'at' in bad && bad.at === T0 ? { at: T0 } : bad; // { at: T0 } lacks a snapshot
      const g = new Game(deserialise(JSON.stringify(raw)));
      const load = T0 + 3 * 60 * MIN;
      g.tick(load);
      expect(arrive(g.state, load), JSON.stringify(bad)).toBeNull();
      expect(g.state.lastSeen!.at).toBe(load);
      expect(g.state.lastSeen!.snapshot.resources).toBeTruthy();
    }
  });
});
