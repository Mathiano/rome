import { building, config, post as postDef, unlocks, RESOURCE_IDS, type ResourceId } from '../data';
import { lesserEffect } from '../politics/posts';
import { claimedProduction } from '../map/sites';
import type { GameState, Resources } from '../state/types';
import { capacity, populationCap, sumEffect } from './storage';

/** Bonus multiplier for a domain from the post-holder's relevant stat, e.g. 0.15 = +15%. Obstruction zeroes it and applies a penalty. */
export function postBonus(state: GameState, postId: string): number {
  const holderId = state.posts[postId];
  if (!holderId) return 0;
  const holder = state.characters[holderId];
  if (!holder || !holder.alive) return 0;
  const p = postDef(postId);
  const obstructedUntil = state.obstructed[p.domain] ?? 0;
  if (obstructedUntil > state.round) return -config.leverage.obstructPenalty;
  return holder.stats[p.stat] * config.posts.bonusPerStatPoint;
}

export function corruptionCostMultiplier(state: GameState): number {
  return 1 + state.corruption * config.corruption.costMultiplierPerPoint;
}

export function productionPerHour(state: GameState): Resources {
  const out: Resources = { wood: 0, clay: 0, iron: 0, grain: 0, denarii: 0 };
  for (const s of state.slots) {
    if (!s.building || s.tier <= 0) continue;
    const def = building(s.building);
    if (!def.produces) continue;
    out[def.produces] += def.tiers[s.tier - 1].effects.productionPerHour ?? 0;
  }
  // Held sites add their yield before the post bonuses lift it.
  for (const [res, v] of Object.entries(claimedProduction(state))) {
    out[res as ResourceId] += v ?? 0;
  }
  out.grain *= 1 + postBonus(state, 'granary');
  const works = postBonus(state, 'works');
  for (const id of ['wood', 'clay', 'iron'] as ResourceId[]) out[id] *= 1 + works;
  return out;
}

export function grainUpkeepPerHour(state: GameState): number {
  return state.population * config.population.grainUpkeepPerHeadPerHour;
}

export function denariiIncomePerHour(state: GameState): number {
  const tax = state.population * config.population.taxPerHeadPerHour;
  const mult = 1 + sumEffect(state, 'taxMultiplier') + postBonus(state, 'market');
  const drain = state.corruption * config.corruption.denariiDrainPerPointPerHour;
  return Math.max(0, tax * mult - drain);
}

/** Net change per hour for every resource. Grain can be negative. */
export function netPerHour(state: GameState): Resources {
  const p = productionPerHour(state);
  p.grain -= grainUpkeepPerHour(state);
  p.denarii = denariiIncomePerHour(state);
  return p;
}

export function buildTimeMultiplier(state: GameState): number {
  let m = 1 - postBonus(state, 'works') - lesserEffect(state, 'buildSpeed');
  for (const u of state.rome.unlocks) m *= unlocks[u]?.buildTimeMultiplier ?? 1;
  return Math.max(0.2, m);
}

/** Advance the village economy by `ms` of wall-clock time. Accrual is capped by storage (DESIGN §3.1, §4.2). */
export function accrue(state: GameState, ms: number): void {
  if (ms <= 0) return;
  const hours = ms / 3_600_000;
  const net = netPerHour(state);
  for (const id of RESOURCE_IDS) {
    const cap = capacity(state, id);
    const next = state.resources[id] + net[id] * hours;
    state.resources[id] = Math.max(0, Math.min(cap, next));
  }
  // Population grows toward cap while there is grain; it never dies of hunger (Pillar 6) but stalls.
  const cap = populationCap(state);
  if (state.resources.grain > 0 && state.population < cap) {
    state.population = Math.min(cap, state.population + config.population.growthPerHour * hours);
  }
}

export function canAfford(state: GameState, cost: Partial<Resources>): boolean {
  return (Object.keys(cost) as ResourceId[]).every((k) => state.resources[k] >= (cost[k] ?? 0));
}

export function pay(state: GameState, cost: Partial<Resources>): void {
  for (const k of Object.keys(cost) as ResourceId[]) state.resources[k] -= cost[k] ?? 0;
}
