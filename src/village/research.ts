/**
 * Research (DESIGN §4.6). Three inputs: denarii, research scrolls, and the
 * Library. Progress runs on wall-clock time like construction (§3.1) and can be
 * finished early for denarii at the same honest price (Pillar 3).
 *
 * Nothing here is ever undone. Pillar 7 is explicit that research survives a
 * collapse, a coup and Rome's intervention, so `state.research.completed` is
 * only ever appended to.
 */
import { researchConfig, researchNode, researchNodes, type Cost, type ResearchDef } from '../data';
import type { GameState, ResearchProgress } from '../state/types';
import { log } from '../state/store';
import { canAfford, outputValuePerHour, pay } from './economy';
import { researchEffect, sumEffect } from './storage';

/** The highest rank of node the Library opens. 0 means there is no Library. */
export function researchRank(state: GameState): number {
  return sumEffect(state, 'researchRank');
}

/** Copyists, better light, more hands: a fraction off every remaining hour. */
export function researchSpeed(state: GameState): number {
  return Math.max(0.1, 1 - sumEffect(state, 'researchSpeed'));
}

export function isResearched(state: GameState, id: string): boolean {
  return state.research.completed.includes(id);
}

export { researchEffect };

export function researchCost(node: ResearchDef): Cost & { scrolls: number } {
  return { ...node.cost, scrolls: node.cost.scrolls ?? 0 };
}

/** The part of a research cost the village store actually holds. */
export function resourcesOf(cost: Cost & { scrolls?: number }): Cost {
  const { scrolls: _scrolls, ...rest } = cost;
  return rest;
}

export function researchSeconds(state: GameState, node: ResearchDef): number {
  return Math.ceil(node.seconds * researchSpeed(state));
}

export interface ResearchCheck {
  ok: boolean;
  reason?: string;
  cost: Cost & { scrolls: number };
  seconds: number;
}

export function checkResearch(state: GameState, id: string): ResearchCheck {
  const node = researchNode(id);
  const cost = researchCost(node);
  const seconds = researchSeconds(state, node);
  const fail = (reason: string): ResearchCheck => ({ ok: false, reason, cost, seconds });
  if (isResearched(state, id)) return fail('Already known');
  if (state.research.active.length >= researchConfig.concurrent) return fail('The library is already at work');
  const rank = researchRank(state);
  if (rank < node.rank) return fail(rank ? `Needs a Library of tier ${node.rank}` : 'Needs a Library');
  const missing = node.requires.filter((r) => !isResearched(state, r));
  if (missing.length) return fail(`Needs ${missing.map((m) => researchNode(m).name).join(' and ')} first`);
  if (state.rome.scrolls < cost.scrolls) return fail(`Needs ${cost.scrolls} research scroll${cost.scrolls === 1 ? '' : 's'}`);
  // scrolls are Rome's, not the village store's, so they never reach canAfford
  if (!canAfford(state, resourcesOf(cost))) return fail('Not enough denarii');
  return { ok: true, cost, seconds };
}

export function startResearch(state: GameState, id: string, now: number): ResearchProgress {
  const check = checkResearch(state, id);
  if (!check.ok) throw new Error(check.reason);
  pay(state, resourcesOf(check.cost));
  state.rome.scrolls -= check.cost.scrolls;
  const p: ResearchProgress = { id, startedAt: now, finishAt: now + check.seconds * 1000 };
  state.research.active.push(p);
  log(state, 'village', `The library takes up ${researchNode(id).name}.`);
  return p;
}

/** Pillar 3 again: never more than the colony earns in the time saved. */
export function researchRushPrice(state: GameState, p: ResearchProgress, now: number): number {
  const hours = Math.max(0, p.finishAt - now) / 3_600_000;
  return Math.max(researchConfig.rushMinPrice, Math.ceil(outputValuePerHour(state) * hours));
}

export function rushResearch(state: GameState, id: string, now: number): void {
  const p = state.research.active.find((x) => x.id === id);
  if (!p) throw new Error('Nothing under study');
  const price = researchRushPrice(state, p, now);
  if (state.resources.denarii < price) throw new Error('Not enough denarii');
  state.resources.denarii -= price;
  state.stats.denariiSpentOnHaste += price;
  p.finishAt = now;
  log(state, 'village', `Copyists are hired and ${researchNode(id).name} is finished for ${price} denarii.`);
  completeResearch(state, now);
}

export function completeResearch(state: GameState, now: number): string[] {
  const done = state.research.active.filter((p) => p.finishAt <= now);
  for (const p of done) {
    if (!isResearched(state, p.id)) state.research.completed.push(p.id);
    state.stats.researchCompleted += 1;
    log(state, 'village', `${researchNode(p.id).name} is understood. It does not leave the colony again.`);
  }
  state.research.active = state.research.active.filter((p) => p.finishAt > now);
  return done.map((p) => p.id);
}

export function researchProgress(p: ResearchProgress, now: number): number {
  const total = p.finishAt - p.startedAt;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (now - p.startedAt) / total));
}

/** Everything the Library could take up next, best first. */
export function availableResearch(state: GameState): ResearchDef[] {
  return researchNodes
    .filter((nd) => !isResearched(state, nd.id))
    .sort((a, b) => a.rank - b.rank || a.cost.denarii! - b.cost.denarii!);
}
