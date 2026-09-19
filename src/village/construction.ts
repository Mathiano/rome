import { building, buildings, config, layout } from '../data';
import type { GameState, Construction, Slot } from '../state/types';
import { canAfford, pay, buildTimeMultiplier, corruptionCostMultiplier, denariiIncomePerHour } from './economy';
import { forumTier } from './storage';
import { log } from '../state/store';
import type { Cost } from '../data';

export function slotById(state: GameState, id: string): Slot {
  const s = state.slots.find((x) => x.id === id);
  if (!s) throw new Error(`unknown slot ${id}`);
  return s;
}

export function scaledCost(state: GameState, base: Cost): Cost {
  const m = corruptionCostMultiplier(state);
  const out: Cost = {};
  for (const [k, v] of Object.entries(base)) out[k as keyof Cost] = Math.ceil((v ?? 0) * m);
  return out;
}

export function eligibleBuildings(state: GameState, slot: Slot): string[] {
  if (slot.building) return [slot.building];
  const def = layout.slots.find((s) => s.id === slot.id)!;
  if (def.fixedBuilding) return [def.fixedBuilding];
  const taken = new Set(state.slots.filter((s) => s.building).map((s) => s.building));
  return buildings
    .filter((b) => b.ring === slot.ring)
    .filter((b) => (slot.ring === 'outer' ? b.site === slot.site : !taken.has(b.id)))
    .map((b) => b.id);
}

export interface BuildCheck {
  ok: boolean;
  reason?: string;
  cost: Cost;
  seconds: number;
  toTier: number;
}

export function checkBuild(state: GameState, slotId: string, buildingId: string): BuildCheck {
  const slot = slotById(state, slotId);
  const def = building(buildingId);
  const toTier = slot.tier + 1;
  if (toTier > def.tiers.length) return { ok: false, reason: 'Already at the top tier', cost: {}, seconds: 0, toTier };
  const tier = def.tiers[toTier - 1];
  const cost = scaledCost(state, tier.cost);
  const seconds = Math.ceil(tier.buildSeconds * buildTimeMultiplier(state));
  const fail = (reason: string): BuildCheck => ({ ok: false, reason, cost, seconds, toTier });
  if (slot.building && slot.building !== buildingId) return fail('Slot holds another building');
  if (!eligibleBuildings(state, slot).includes(buildingId)) return fail('Cannot build that here');
  if (state.constructions.some((c) => c.slotId === slotId)) return fail('Already under construction');
  const concurrent = state.constructions.filter((c) => c.kind === def.kind).length;
  const limit = def.kind === 'field' ? config.concurrency.field : config.concurrency.building;
  if (concurrent >= limit) return fail(def.kind === 'field' ? 'A field is already being worked' : 'A building is already under construction');
  if (forumTier(state) < tier.requiresForumTier && buildingId !== 'forum') return fail(`Needs forum tier ${tier.requiresForumTier}`);
  if (!canAfford(state, cost)) return fail('Not enough resources');
  return { ok: true, cost, seconds, toTier };
}

export function startBuild(state: GameState, slotId: string, buildingId: string, now: number): Construction {
  const check = checkBuild(state, slotId, buildingId);
  if (!check.ok) throw new Error(check.reason);
  pay(state, check.cost);
  const slot = slotById(state, slotId);
  slot.building = buildingId;
  const c: Construction = {
    slotId,
    buildingId,
    toTier: check.toTier,
    kind: building(buildingId).kind,
    startedAt: now,
    finishAt: now + check.seconds * 1000,
  };
  state.constructions.push(c);
  log(state, 'village', `${building(buildingId).name}: work begins on tier ${check.toTier}.`);
  return c;
}

/** Pillar 3: the price never exceeds what the colony earns in the remaining time. */
export function rushPrice(state: GameState, c: Construction, now: number): number {
  const remainingHours = Math.max(0, c.finishAt - now) / 3_600_000;
  const earns = denariiIncomePerHour(state) * remainingHours;
  return Math.max(config.rush.minPrice, Math.ceil(earns));
}

export function rush(state: GameState, slotId: string, now: number): void {
  const c = state.constructions.find((x) => x.slotId === slotId);
  if (!c) throw new Error('Nothing under construction');
  const price = rushPrice(state, c, now);
  if (state.resources.denarii < price) throw new Error('Not enough denarii');
  state.resources.denarii -= price;
  state.stats.denariiSpentOnHaste += price;
  c.finishAt = now;
  log(state, 'village', `Hired hands finish the ${building(c.buildingId).name} for ${price} denarii.`);
  completeFinished(state, now);
}

export function completeFinished(state: GameState, now: number): Construction[] {
  const done = state.constructions.filter((c) => c.finishAt <= now);
  for (const c of done) {
    const slot = slotById(state, c.slotId);
    slot.building = c.buildingId;
    slot.tier = c.toTier;
    log(state, 'village', `${building(c.buildingId).name} reaches tier ${c.toTier}.`);
  }
  state.constructions = state.constructions.filter((c) => c.finishAt > now);
  return done;
}

export function progress(c: Construction, now: number): number {
  const total = c.finishAt - c.startedAt;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (now - c.startedAt) / total));
}
