// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Game } from '../src/game';
import { distance, key, neighbours, parseKey } from '../src/map/grid';
import { mapConfig } from '../src/map/world';
import { claimSite, claimedProduction, dispatchScout, resolveScout, siteRaidChance } from '../src/map/sites';
import { checkRoad, connected, isConnected, roadRushPrice, roadTradeRate } from '../src/map/roads';
import { tradeRate } from '../src/tribes/envoys';
import { tick } from '../src/village/clock';
import { outputValuePerHour } from '../src/village/economy';
import { config } from '../src/data';
import { createMapView } from '../src/render/mapview';
import { renderPanel } from '../src/render/panel';
import { colonyWith, hexOf } from './helpers';
import type { GameState } from '../src/state/types';

const rich = (s: GameState) => { s.resources = { wood: 5000, clay: 5000, iron: 5000, grain: 5000, denarii: 5000 }; return s; };
const R = mapConfig.roads;

/** The hexes from the colonia to `k`, one step at a time, home left out. */
function pathTo(k: string): string[] {
  const goal = parseKey(k);
  let at = parseKey('0,0');
  const out: string[] = [];
  while (distance(at, goal) > 0) {
    at = neighbours(at).sort((a, b) => distance(a, goal) - distance(b, goal))[0];
    out.push(key(at));
  }
  return out;
}

/** Lay every segment along the path through the game, on the village clock. */
function layTo(g: Game, k: string, now: number): number {
  for (const step of pathTo(k)) {
    rich(g.state);
    g.buildRoad(step, now);
    now += R.segmentSeconds * 1000;
    tick(g.state, now);
  }
  return now;
}

function held(id: string): { g: Game; k: string } {
  const s = rich(colonyWith(id));
  const k = hexOf(s, id);
  dispatchScout(s, k); resolveScout(s);
  claimSite(s, k);
  return { g: new Game(s), k };
}

describe('roads (DESIGN §5.4)', () => {
  it('are laid outward from the colonia, hex by hex, never across a gap', () => {
    const g = new Game(rich(colonyWith('timber')));
    expect(checkRoad(g.state, '0,0').ok).toBe(false);
    // two rings out, with nothing between it and home
    const far = pathTo('2,0').at(-1)!;
    expect(checkRoad(g.state, far)).toMatchObject({ ok: false, reason: 'Roads are built outward from the colonia, hex by hex' });
    const [first] = pathTo('2,0');
    expect(checkRoad(g.state, first).ok).toBe(true);
    layTo(g, first, 1000);
    expect(checkRoad(g.state, far).ok).toBe(true);
  });

  it('lays one segment at a time, for denarii and wood, on the village clock and never on a round', () => {
    const g = new Game(rich(colonyWith('timber')));
    const s = g.state;
    const round = s.round;
    tick(s, 1000);
    const before = { ...s.resources };
    const [a] = pathTo('0,2');
    const other = neighbours(parseKey('0,0')).map(key).find((x) => x !== a)!;
    g.buildRoad(a, 1000);
    expect(s.resources.denarii).toBe(before.denarii - R.segmentCost.denarii);
    expect(s.resources.wood).toBe(before.wood - R.segmentCost.wood);
    expect(Object.keys(R.segmentCost).sort()).toEqual(['denarii', 'wood']);
    expect(checkRoad(s, other)).toMatchObject({ ok: false, reason: 'A segment is already being laid' });
    tick(s, 1000 + R.segmentSeconds * 1000 - 1);
    expect(s.map.roads).not.toContain(a);
    tick(s, 1000 + R.segmentSeconds * 1000);
    expect(s.map.roads).toContain(a);
    expect(s.map.roadWork).toBeNull();
    expect(s.round).toBe(round);
    expect(checkRoad(s, other).ok).toBe(true);
  });

  it('can be finished early for no more than the colony earns in the time left (Pillar 3)', () => {
    const g = new Game(rich(colonyWith('timber')));
    const [a] = pathTo('1,0');
    g.buildRoad(a, 0);
    const now = 60_000;
    const left = (R.segmentSeconds * 1000 - now) / 3_600_000;
    const price = roadRushPrice(g.state, now);
    expect(price).toBeLessThanOrEqual(Math.max(config.rush.minPrice, Math.ceil(outputValuePerHour(g.state) * left)));
    tick(g.state, now);
    const d = g.state.resources.denarii;
    g.rushRoad(now);
    expect(g.state.resources.denarii).toBe(d - price);
    expect(g.state.map.roads).toContain(a);
  });

  it('gives a holding joined by an unbroken road lower raid exposure and higher yield', () => {
    const { g, k } = held('timber');
    const s = g.state;
    s.round = mapConfig.hold.graceRounds + 5;
    const c = s.map.claimed.find((x) => x.key === k)!;
    const chance = siteRaidChance(s, c);
    const wood = claimedProduction(s).wood!;
    expect(chance).toBeGreaterThan(0);
    layTo(g, k, 1000);
    expect(isConnected(s, k)).toBe(true);
    expect(siteRaidChance(s, c)).toBeCloseTo(chance * (1 - R.exposureCut), 9);
    expect(claimedProduction(s).wood).toBeCloseTo(wood * (1 + R.yieldBonus), 9);
  });

  it('counts for nothing once the chain is broken', () => {
    const { g, k } = held('timber');
    const s = g.state;
    layTo(g, k, 1000);
    const path = pathTo(k);
    expect(path.length).toBeGreaterThan(1);
    s.map.roads = s.map.roads.filter((x) => x !== path[0]);
    expect(connected(s).has(k)).toBe(false);
    expect(isConnected(s, k)).toBe(false);
  });

  it('eases trade while any holding is on the network', () => {
    const { g, k } = held('timber');
    const s = g.state;
    expect(roadTradeRate(s)).toBe(0);
    const tribe = Object.keys(s.tribes)[0];
    const before = tradeRate(s, tribe);
    layTo(g, k, 1000);
    expect(roadTradeRate(s)).toBe(R.tradeRate);
    expect(tradeRate(s, tribe)).toBe(Math.max(1, before + R.tradeRate));
  });

  it('is drawn as a growing network: solid where laid, dashed where a segment is going in', () => {
    const g = new Game(rich(colonyWith('timber')));
    const [a, b] = pathTo('2,0');
    const view = createMapView(() => {});
    view.update(g.state, null);
    expect(view.root.querySelectorAll('.road line')).toHaveLength(0);
    g.buildRoad(a, 0);
    view.update(g.state, null);
    // home's half and the new hex's half, both dashed
    expect(view.root.querySelectorAll('.road .road-laying')).toHaveLength(2);
    tick(g.state, R.segmentSeconds * 1000);
    rich(g.state);
    g.buildRoad(b, R.segmentSeconds * 1000);
    view.update(g.state, null);
    expect(view.root.querySelectorAll('.road .road-built')).toHaveLength(2);
    expect(view.root.querySelectorAll('.road .road-laying')).toHaveLength(2);
    expect(view.root.querySelector(`[data-hex="${a}"] .road-built`)).not.toBeNull();
  });

  it('offers the next segment on the panel and shows the lane while one is laid', () => {
    const g = new Game(rich(colonyWith('timber')));
    const [a] = pathTo('1,0');
    expect(renderPanel(g, 'map', null, 0, a)).toContain(`data-build-road="${a}"`);
    g.buildRoad(a, 0);
    const html = renderPanel(g, 'map', null, 0, a);
    expect(html).toContain('data-lane="road"');
    expect(html).toContain('data-rush-road');
    expect(html).toContain('Road-builders are laying a segment here.');
    expect(html).not.toContain(`data-build-road="${a}"`);
  });
});
