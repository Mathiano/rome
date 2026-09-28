/**
 * Roads (DESIGN §5.4): the colony's long project across the country, built
 * segment by segment, hex to hex, outward from the colonia. One segment is
 * under construction at a time, on the village clock like a building, and can
 * be finished early at the Pillar 3 price. A holding joined to the colonia by
 * an unbroken road is harder to raid, yields more, and makes trade easier.
 */
import { config } from '../data';
import type { Cost } from '../data';
import type { GameState } from '../state/types';
import { log } from '../state/store';
import { canAfford, outputValuePerHour, pay } from '../village/economy';
import { key as hexKey, neighbours, parseKey, ring } from './grid';
import { mapConfig } from './world';

const HOME = '0,0';

export function hasRoad(state: GameState, k: string): boolean {
  return k === HOME || state.map.roads.includes(k);
}

/** Every hex the road network reaches from the colonia without a gap. */
export function connected(state: GameState): Set<string> {
  const seen = new Set<string>([HOME]);
  const queue = [HOME];
  while (queue.length) {
    const k = queue.shift()!;
    for (const n of neighbours(parseKey(k))) {
      const nk = hexKey(n);
      if (!seen.has(nk) && state.map.roads.includes(nk)) { seen.add(nk); queue.push(nk); }
    }
  }
  return seen;
}

/** A holding on the network: its own hex has a road, and that road reaches home. */
export function isConnected(state: GameState, k: string): boolean {
  return k !== HOME && connected(state).has(k);
}

export interface RoadCheck { ok: boolean; reason?: string; cost: Cost; seconds: number }

/** A segment goes on a hex beside the network — the colonia or a road that reaches it — never a gap. */
export function checkRoad(state: GameState, k: string): RoadCheck {
  const r = mapConfig.roads;
  const cost = r.segmentCost as Cost;
  const seconds = r.segmentSeconds;
  const fail = (reason: string) => ({ ok: false, reason, cost, seconds });
  if (k === HOME || hasRoad(state, k)) return fail('A road runs here already');
  if (ring(parseKey(k)) > mapConfig.radius) return fail('Beyond the known country');
  const net = connected(state);
  if (!neighbours(parseKey(k)).some((n) => net.has(hexKey(n)))) return fail('Roads are built outward from the colonia, hex by hex');
  if (state.map.roadWork) return fail('A segment is already being laid');
  if (!canAfford(state, cost)) return fail('Not enough resources');
  return { ok: true, cost, seconds };
}

export function startRoad(state: GameState, k: string, now: number): void {
  const check = checkRoad(state, k);
  if (!check.ok) throw new Error(check.reason);
  pay(state, check.cost);
  state.map.roadWork = { key: k, startedAt: now, finishAt: now + check.seconds * 1000 };
  log(state, 'map', `Road-builders set out to lay a segment to ${k}.`);
}

/** Called by the village clock: a finished segment joins the network. */
export function completeRoad(state: GameState, now: number): void {
  const w = state.map.roadWork;
  if (!w || w.finishAt > now) return;
  state.map.roadWork = null;
  if (!state.map.roads.includes(w.key)) state.map.roads.push(w.key);
  log(state, 'map', `The road reaches ${w.key}.`);
}

/** Pillar 3: never more than the colony earns in the time that is left. */
export function roadRushPrice(state: GameState, now: number): number {
  const w = state.map.roadWork;
  if (!w) return 0;
  const hours = Math.max(0, w.finishAt - now) / 3_600_000;
  return Math.max(config.rush.minPrice, Math.ceil(outputValuePerHour(state) * hours));
}

export function rushRoad(state: GameState, now: number): void {
  const w = state.map.roadWork;
  if (!w) throw new Error('No road is being laid');
  const price = roadRushPrice(state, now);
  if (state.resources.denarii < price) throw new Error('Not enough denarii');
  state.resources.denarii -= price;
  state.stats.denariiSpentOnHaste += price;
  w.finishAt = now;
  completeRoad(state, now);
}

/** The trade rate's road term (§5.4): sharper while any holding is on the network. */
export function roadTradeRate(state: GameState): number {
  return state.map.claimed.some((c) => isConnected(state, c.key)) ? mapConfig.roads.tradeRate : 0;
}
