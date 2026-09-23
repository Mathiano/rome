// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { accrue, netPerHour } from '../src/village/economy';
import { capacity } from '../src/village/storage';
import { startBuild, completeFinished } from '../src/village/construction';
import { awayReport, isQuiet, takeSnapshot } from '../src/village/away';
import { awayLines, overflowWords, renderReturnStrip, setReturnStrip } from '../src/render/due';
import { renderPanel } from '../src/render/panel';
import { building, researchNode } from '../src/data';

const H = 3_600_000;
/** Any printed duration: hours, minutes, seconds, a clock stamp. The strip states amounts only. */
const DURATION = /\d+\s?(h|hours?|min|minutes?|s|sec)\b|\d{1,2}:\d{2}/;

describe('what full stores turn away (DESIGN §4.2)', () => {
  it("an hour against a full warehouse leaves wood at cap and counts the hour's net wood", () => {
    const s = createInitialState(0, 1);
    s.resources.wood = capacity(s, 'wood');
    const net = netPerHour(s);
    expect(net.wood).toBeGreaterThan(0);
    accrue(s, H);
    expect(s.resources.wood).toBe(capacity(s, 'wood'));
    expect(s.overflowSinceSeen.wood).toBeCloseTo(net.wood, 6);
    // and a second hour adds to it
    accrue(s, H);
    expect(s.overflowSinceSeen.wood).toBeCloseTo(2 * net.wood, 6);
  });

  it('grain clamped at nothing is not overflow, and the treasury never overflows', () => {
    const s = createInitialState(0, 1);
    s.resources.grain = 0;
    s.population = 1000; // upkeep far above the farm's yield
    expect(netPerHour(s).grain).toBeLessThan(0);
    accrue(s, H);
    expect(s.resources.grain).toBe(0);
    expect(s.overflowSinceSeen.grain).toBeUndefined();
    expect(s.overflowSinceSeen.denarii).toBeUndefined();
  });

  it('a store already over its cap loses the excess to the clamp, not to the counter', () => {
    const s = createInitialState(0, 1);
    s.resources.wood = capacity(s, 'wood') + 100; // a grant landed on a full store
    const net = netPerHour(s);
    accrue(s, H);
    expect(s.overflowSinceSeen.wood).toBeCloseTo(net.wood, 6);
  });

  it('a store below cap counts only what found no room', () => {
    const s = createInitialState(0, 1);
    const cap = capacity(s, 'wood');
    const net = netPerHour(s);
    s.resources.wood = cap - net.wood / 2;
    accrue(s, H);
    expect(s.resources.wood).toBe(cap);
    expect(s.overflowSinceSeen.wood).toBeCloseTo(net.wood / 2, 6);
  });

  it('starts empty on a new colony and survives a save round-trip', () => {
    const s = createInitialState(0, 1);
    expect(s.overflowSinceSeen).toEqual({});
    s.overflowSinceSeen = { wood: 12 };
    expect(deserialise(serialise(s)).overflowSinceSeen).toEqual({ wood: 12 });
  });
});

describe('since you were last here', () => {
  it('names every changed resource with its sign, every tier reached and every study finished', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 500, clay: 500, iron: 500, grain: 500, denarii: 500 };
    const before = takeSnapshot(s);
    const c = startBuild(s, 'i1', 'warehouse', 0);
    completeFinished(s, c.finishAt);
    s.resources.wood = 740;
    s.resources.grain = 488;
    s.research.completed.push('crop_rotation');
    s.population += 12;
    s.overflowSinceSeen = { wood: 130, clay: 0.4 };
    const r = awayReport(before, takeSnapshot(s));
    const clay = building('warehouse').tiers[0].cost.clay!;
    expect(r.resources).toEqual({ wood: 240, clay: -clay, grain: -12 });
    expect(r.overflow).toEqual({ wood: 130 });
    expect(r.raised).toEqual([{ slotId: 'i1', building: 'warehouse', tier: 1 }]);
    expect(r.learned).toEqual(['crop_rotation']);
    expect(r.citizens).toBe(12);
    expect(isQuiet(r)).toBe(false);
    const lines = awayLines(r);
    expect(lines[0]).toBe(`+240 wood, −${clay} clay, −12 grain.`);
    expect(lines).toContain('The Warehouse stood full: 130 wood went to waste.');
    expect(lines).toContain('Warehouse I now stands.');
    expect(lines).toContain(`${researchNode('crop_rotation').name} is known.`);
    expect(lines).toContain('12 more citizens.');
    for (const l of lines) expect(l, l).not.toMatch(DURATION);
  });

  it('identical before and after is quiet, and nothing is said', () => {
    const s = createInitialState(0, 1);
    const snap = takeSnapshot(s);
    const r = awayReport(snap, takeSnapshot(s));
    expect(isQuiet(r)).toBe(true);
    expect(awayLines(r)).toEqual([]);
  });

  it('fractions that round to nothing do not count as a change', () => {
    const s = createInitialState(0, 1);
    const before = takeSnapshot(s);
    s.resources.wood += 0.3;
    s.overflowSinceSeen = { clay: 0.4 };
    expect(isQuiet(awayReport(before, takeSnapshot(s)))).toBe(true);
  });

  it('reports only what the stores turned away during the gap, not what they turned away while the player watched', () => {
    const s = createInitialState(0, 1);
    s.overflowSinceSeen = { wood: 130 }; // counted before the game was closed, not yet acknowledged
    const before = takeSnapshot(s);
    expect(isQuiet(awayReport(before, takeSnapshot(s))), 'a stale counter alone is not a change').toBe(true);
    s.overflowSinceSeen.wood = 160;
    const r = awayReport(before, takeSnapshot(s));
    expect(r.overflow).toEqual({ wood: 30 });
    expect(awayLines(r)).toEqual(['The Warehouse stood full: 30 wood went to waste.']);
  });

  it('never names a store for the treasury', () => {
    expect(overflowWords({ denarii: 40 })).toEqual([]);
  });

  it('groups the loss by store and lists the resources of each', () => {
    expect(overflowWords({ wood: 130, clay: 40, iron: 0.2, grain: 20 })).toEqual([
      'The Warehouse stood full: 130 wood and 40 clay went to waste.',
      'The Granary stood full: 20 grain went to waste.',
    ]);
    expect(overflowWords({})).toEqual([]);
  });

  it('is a strip at the top of the Village tab until put away, never a clock', () => {
    const g = new Game(createInitialState(0, 1));
    setReturnStrip([]);
    expect(renderReturnStrip()).toBe('');
    expect(renderPanel(g, 'village', null, 1)).not.toContain('data-away');
    setReturnStrip(['+240 wood.', 'Warehouse I now stands.']);
    const html = renderPanel(g, 'village', null, 1);
    expect(html).toContain('data-away');
    expect(html).toContain('Since you were last here');
    expect(html.indexOf('data-away')).toBeLessThan(html.indexOf('data-menu="due"'));
    const strip = html.slice(html.indexOf('data-away'), html.indexOf('data-menu="due"'));
    expect(strip).not.toMatch(DURATION);
    // the plot card carries it too: the strip is about the colony, not the overview
    expect(renderPanel(g, 'village', 'i1', 1)).toContain('data-away');
    setReturnStrip([]);
    expect(renderPanel(g, 'village', null, 1)).not.toContain('data-away');
  });

  it('a tick over a real gap fills the report from the counter and the stores', () => {
    const g = new Game(createInitialState(0, 1));
    g.state.resources.wood = capacity(g.state, 'wood');
    const before = takeSnapshot(g.state);
    g.tick(3 * H);
    const r = awayReport(before, takeSnapshot(g.state));
    expect(r.overflow.wood).toBe(Math.round(netPerHour(g.state).wood * 3));
    expect(r.resources.clay).toBeGreaterThan(0);
    expect(r.resources.wood).toBeUndefined();
  });
});
