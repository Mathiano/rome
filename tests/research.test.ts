// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { config, layout, researchNodes } from '../src/data';
import type { GameState } from '../src/state/types';
import {
  availableResearch, checkResearch, completeResearch, isResearched, researchEffect,
  researchRank, researchRushPrice, researchSpeed,
} from '../src/village/research';
import { sumEffect } from '../src/village/storage';
import { buildTimeMultiplier, productionPerHour } from '../src/village/economy';
import { defenceStrength } from '../src/combat/raids';
import { renderPanel, type Tab } from '../src/render/panel';

const H = 3_600_000;

/** A colony with a Library of `tier` standing and the means to use it. */
function withLibrary(tier: number, seed = 3): Game {
  const g = new Game(createInitialState(0, seed));
  const slot = g.state.slots.find((s) => s.id === 'i8')!;
  slot.building = 'library';
  slot.tier = tier;
  g.state.resources.denarii = 5000;
  g.state.rome.scrolls = 20;
  return g;
}

describe('research (DESIGN §4.6)', () => {
  it('needs a Library, and a better one for the later ranks', () => {
    const none = new Game(createInitialState(0, 1));
    none.state.resources.denarii = 5000;
    none.state.rome.scrolls = 20;
    expect(researchRank(none.state)).toBe(0);
    expect(checkResearch(none.state, 'groma').reason).toBe('Needs a Library');

    const one = withLibrary(1);
    expect(researchRank(one.state)).toBe(1);
    expect(checkResearch(one.state, 'groma').ok).toBe(true);
    expect(checkResearch(one.state, 'double_ledger').reason).toBe('Needs a Library of tier 2');

    expect(researchRank(withLibrary(3).state)).toBe(3);
  });

  it('spends denarii and scrolls, and runs on the village clock', () => {
    const g = withLibrary(1);
    const coin = g.state.resources.denarii;
    const scrolls = g.state.rome.scrolls;
    const check = checkResearch(g.state, 'groma');
    g.research('groma', 1);
    expect(g.state.resources.denarii).toBeCloseTo(coin - (check.cost.denarii ?? 0), 3);
    expect(g.state.rome.scrolls).toBe(scrolls - check.cost.scrolls);
    expect(g.state.research.active).toHaveLength(1);
    expect(isResearched(g.state, 'groma')).toBe(false);
    // no political round runs for a piece of village business (DESIGN §3.2)
    expect(g.state.round).toBe(0);
    g.tick(1 + check.seconds * 1000);
    expect(isResearched(g.state, 'groma')).toBe(true);
    expect(g.state.research.active).toHaveLength(0);
    expect(g.state.stats.researchCompleted).toBe(1);
  });

  it('studies one thing at a time, and never the same thing twice', () => {
    const g = withLibrary(1);
    g.research('groma', 1);
    expect(checkResearch(g.state, 'crop_rotation').reason).toBe('The library is already at work');
    g.tick(1 + 9 * H);
    expect(checkResearch(g.state, 'groma').reason).toBe('Already known');
    expect(() => g.research('groma', 1 + 9 * H)).toThrow(/Already known/);
  });

  it('holds a node back until what it stands on is known', () => {
    const g = withLibrary(2);
    const check = checkResearch(g.state, 'roman_concrete');
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/groma/);
    g.research('groma', 1);
    g.tick(1 + 9 * H);
    expect(checkResearch(g.state, 'roman_concrete').ok).toBe(true);
  });

  it('refuses what cannot be paid for, in either currency', () => {
    const g = withLibrary(1);
    g.state.rome.scrolls = 0;
    expect(checkResearch(g.state, 'groma').reason).toMatch(/scroll/);
    g.state.rome.scrolls = 20;
    g.state.resources.denarii = 0;
    expect(checkResearch(g.state, 'groma').reason).toBe('Not enough denarii');
  });

  it('a better Library reads faster', () => {
    const one = withLibrary(1);
    const three = withLibrary(3);
    expect(researchSpeed(three.state)).toBeLessThan(researchSpeed(one.state));
    expect(checkResearch(three.state, 'groma').seconds)
      .toBeLessThan(checkResearch(one.state, 'groma').seconds);
  });

  it('can be finished early, at a price that never exceeds what the colony earns (Pillar 3)', () => {
    const g = withLibrary(1);
    g.research('crop_rotation', 1);
    const p = g.state.research.active[0];
    const price = researchRushPrice(g.state, p, 1);
    const hoursLeft = (p.finishAt - 1) / H;
    // it is capped by the income of the time it buys back
    expect(price).toBeLessThanOrEqual(Math.ceil(hoursLeft * 60) + 5);
    const coin = g.state.resources.denarii;
    g.rushResearch('crop_rotation', 1);
    expect(g.state.resources.denarii).toBeCloseTo(coin - price, 3);
    expect(isResearched(g.state, 'crop_rotation')).toBe(true);
  });

  it('every effect a node names actually moves the colony', () => {
    const g = withLibrary(3);
    const s = g.state;
    const before = {
      build: buildTimeMultiplier(s),
      grain: productionPerHour(s).grain,
      material: productionPerHour(s).wood,
      defence: defenceStrength(s),
      pop: sumEffect(s, 'populationCap'),
    };
    s.research.completed = researchNodes.map((n) => n.id);
    expect(buildTimeMultiplier(s)).toBeLessThan(before.build);
    expect(productionPerHour(s).grain).toBeGreaterThan(before.grain);
    expect(productionPerHour(s).wood).toBeGreaterThan(before.material);
    expect(defenceStrength(s)).toBeGreaterThan(before.defence);
    expect(sumEffect(s, 'populationCap')).toBeGreaterThan(before.pop);
    // and a building effect and a research effect that share a name add up
    expect(sumEffect(s, 'gravitasPerRound')).toBe(
      researchEffect(s, 'gravitasPerRound') + sumEffect({ ...s, research: { active: [], completed: [] } } as GameState, 'gravitasPerRound'),
    );
  });

  it('survives everything: a save, a collapse and Rome taking over (Pillar 7)', () => {
    const g = withLibrary(1);
    g.research('groma', 1);
    g.tick(1 + 9 * H);
    const revived = deserialise(serialise(g.state));
    expect(isResearched(revived, 'groma')).toBe(true);
    // the harshest thing the game can do to a colony
    revived.corruption = config.collapse.corruptionCeiling;
    revived.population = config.collapse.populationFloor;
    const g2 = new Game(revived);
    g2.act({ type: 'convene' }, 2 + 9 * H);
    expect(isResearched(g2.state, 'groma')).toBe(true);
  });

  it('an old save gains the Library plot instead of losing its own', () => {
    const g = new Game(createInitialState(0, 2));
    const raw = JSON.parse(serialise(g.state));
    delete raw.research;
    raw.slots = raw.slots.filter((s: { id: string }) => s.id !== 'i8');
    const migrated = deserialise(JSON.stringify(raw));
    expect(migrated.research).toEqual({ active: [], completed: [] });
    expect(migrated.slots.map((s) => s.id).sort()).toEqual(layout.slots.map((s) => s.id).sort());
    expect(migrated.slots.find((s) => s.id === 'i8')!.building).toBeNull();
  });

  it('the tree is finishable, and finishing it takes real time', () => {
    const g = withLibrary(3);
    g.state.resources.denarii = 100_000;
    g.state.rome.scrolls = 100;
    let t = 1;
    for (let i = 0; i < researchNodes.length * 2 && availableResearch(g.state).length; i++) {
      const next = availableResearch(g.state).find((nd) => checkResearch(g.state, nd.id).ok);
      if (!next) break;
      g.research(next.id, t);
      t += g.state.research.active[0].finishAt - t + 1;
      g.tick(t);
      completeResearch(g.state, t);
    }
    expect(availableResearch(g.state)).toHaveLength(0);
    expect(g.state.research.completed.length).toBe(researchNodes.length);
    // the whole tree is a real commitment even at the fastest Library: ~18h
    expect((t - 1) / H).toBeGreaterThan(12);
    expect((t - 1) / H).toBeLessThan(40);
  });

  it('the library tab shows the tree, the gate and what is already known', () => {
    const none = new Game(createInitialState(0, 1));
    expect(renderPanel(none, 'library' as Tab, null, 2)).toContain('There is no library');

    const g = withLibrary(2);
    const html = renderPanel(g, 'library' as Tab, null, 2);
    expect(html).toContain('Opened by a Library of tier');
    for (const node of researchNodes) expect(html, node.id).toContain(node.name);
    const el = document.createElement('div');
    el.innerHTML = html;
    // rank 1 and 2 are open at a Library II, rank 3 is not
    const enabled = [...el.querySelectorAll<HTMLButtonElement>('button[data-research]')]
      .filter((b) => !b.disabled).map((b) => b.dataset.research!);
    expect(enabled.length).toBeGreaterThan(0);
    for (const id of enabled) expect(researchNodes.find((n) => n.id === id)!.rank).toBeLessThanOrEqual(2);

    g.research('groma', 1);
    const busy = renderPanel(g, 'library' as Tab, null, 2);
    expect(busy).toContain('under study');
    expect(busy).toContain('data-rush-research="groma"');
  });
});
