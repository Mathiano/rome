/**
 * Holding tiers (DESIGN §5.3): camp, station, fort, built in place on the
 * village clock like a building, each tier raising yield and defence. One
 * holding may be under construction at a time, beside the one building and the
 * one field (§4.4) — a third lane, never a queue. Finishing early is priced as
 * every other timer is (Pillar 3).
 */
import type { Cost } from '../data';
import { config } from '../data';
import type { GameState, HoldingWork } from '../state/types';
import { log } from '../state/store';
import { canAfford, outputValuePerHour, pay } from '../village/economy';
import { claimOf } from './sites';
import { holdingTier, mapConfig, site } from './world';

export interface HoldingCheck { ok: boolean; reason?: string; cost: Cost; seconds: number; toTier: number }

export function checkHoldingWork(state: GameState, k: string): HoldingCheck {
  const c = claimOf(state, k);
  const toTier = (c?.tier ?? 1) + 1;
  const def = mapConfig.tiers.list[toTier - 1];
  const cost = (def?.cost ?? {}) as Cost;
  const seconds = def?.buildSeconds ?? 0;
  const fail = (reason: string) => ({ ok: false, reason, cost, seconds, toTier });
  if (!c) return fail('Not held');
  if (!def) return fail('A fort already');
  if (state.map.works) return fail(state.map.works.key === k ? 'Already rising' : 'Another holding is already rising');
  if (!canAfford(state, cost)) return fail('Not enough resources');
  return { ok: true, cost, seconds, toTier };
}

export function startHoldingWork(state: GameState, k: string, now: number): HoldingWork {
  const check = checkHoldingWork(state, k);
  if (!check.ok) throw new Error(check.reason);
  pay(state, check.cost);
  state.map.works = { key: k, toTier: check.toTier, startedAt: now, finishAt: now + check.seconds * 1000 };
  log(state, 'map', `${site(claimOf(state, k)!.siteId).name} at ${k}: work begins on the ${holdingTier(check.toTier).name.toLowerCase()}.`);
  return state.map.works;
}

/** Called by the village clock: a holding whose work is done takes its new tier. */
export function completeHoldingWork(state: GameState, now: number): void {
  const w = state.map.works;
  if (!w || w.finishAt > now) return;
  state.map.works = null;
  const c = claimOf(state, w.key);
  // Lost while it rose (§5.5: only ever in a round the player was present for): the work is simply gone.
  if (!c) return;
  c.tier = w.toTier;
  log(state, 'map', `${site(c.siteId).name} at ${w.key} is a ${holdingTier(c.tier).name.toLowerCase()} now.`);
}

/** Pillar 3: never more than the colony earns in the time that is left. */
export function holdingRushPrice(state: GameState, now: number): number {
  const w = state.map.works;
  if (!w) return 0;
  const hours = Math.max(0, w.finishAt - now) / 3_600_000;
  return Math.max(config.rush.minPrice, Math.ceil(outputValuePerHour(state) * hours));
}

export function rushHoldingWork(state: GameState, now: number): void {
  const w = state.map.works;
  if (!w) throw new Error('Nothing is rising');
  const price = holdingRushPrice(state, now);
  if (state.resources.denarii < price) throw new Error('Not enough denarii');
  state.resources.denarii -= price;
  state.stats.denariiSpentOnHaste += price;
  w.finishAt = now;
  completeHoldingWork(state, now);
}

