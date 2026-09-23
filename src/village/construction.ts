import { building, buildings, config, layout } from '../data';
import type { GameState, Construction, Slot } from '../state/types';
import { canAfford, pay, buildTimeMultiplier, corruptionCostMultiplier, outputValuePerHour } from './economy';
import { forumTier } from './storage';
import { log } from '../state/store';
import type { BuildingDef, Cost } from '../data';

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

/** Which rule a build fails on. `reason` is the same gate in words. */
export type BuildGate = 'top' | 'occupied' | 'ineligible' | 'slot_busy' | 'lane' | 'forum' | 'resources';

export interface BuildCheck {
  ok: boolean;
  /** The first failing gate, in words. Unchanged: the plot card and `startBuild` read it. */
  reason?: string;
  /** Every failing gate, in the order `checkBuild` tests them. `reason` is `reasons[0]`. */
  reasons: string[];
  /** The same gates as codes, parallel to `reasons`, so a panel can tell the Forum from the lane. */
  gates: BuildGate[];
  /** What is missing of each resource, by resource. Empty when the cost is covered. */
  short: Cost;
  cost: Cost;
  seconds: number;
  toTier: number;
}

/**
 * Every gate a build would fail on, not only the first (DESIGN §4.4). While
 * anything is under way every other row would otherwise read "lane busy" and
 * hide that it also needs the Forum, or that it is 120 clay short.
 */
export function checkBuild(state: GameState, slotId: string, buildingId: string): BuildCheck {
  const slot = slotById(state, slotId);
  const def = building(buildingId);
  const toTier = slot.tier + 1;
  if (toTier > def.tiers.length) {
    const reason = 'Already at the top tier';
    return { ok: false, reason, reasons: [reason], gates: ['top'], short: {}, cost: {}, seconds: 0, toTier };
  }
  const tier = def.tiers[toTier - 1];
  const cost = scaledCost(state, tier.cost);
  const seconds = Math.ceil(tier.buildSeconds * buildTimeMultiplier(state));
  const reasons: string[] = [];
  const gates: BuildGate[] = [];
  const fail = (gate: BuildGate, reason: string) => { gates.push(gate); reasons.push(reason); };
  if (slot.building && slot.building !== buildingId) fail('occupied', 'Slot holds another building');
  if (!eligibleBuildings(state, slot).includes(buildingId)) fail('ineligible', 'Cannot build that here');
  if (state.constructions.some((c) => c.slotId === slotId)) fail('slot_busy', 'Already under construction');
  const concurrent = state.constructions.filter((c) => c.kind === def.kind).length;
  const limit = def.kind === 'field' ? config.concurrency.field : config.concurrency.building;
  if (concurrent >= limit) fail('lane', def.kind === 'field' ? 'A field is already being worked' : 'A building is already under construction');
  if (forumTier(state) < tier.requiresForumTier && buildingId !== 'forum') fail('forum', `Needs forum tier ${tier.requiresForumTier}`);
  const short: Cost = {};
  for (const [k, v] of Object.entries(cost)) {
    const have = state.resources[k as keyof Cost];
    if (have < (v ?? 0)) short[k as keyof Cost] = Math.ceil((v ?? 0) - have);
  }
  if (!canAfford(state, cost)) fail('resources', 'Not enough resources');
  if (reasons.length) return { ok: false, reason: reasons[0], reasons, gates, short, cost, seconds, toTier };
  return { ok: true, reasons, gates, short, cost, seconds, toTier };
}

/**
 * What a Forum of tier `t` opens: every building tier gated on it, read from
 * `requiresForumTier` in data/buildings.json and never authored (DESIGN §4.4,
 * "its tier is the colony's tier"). The forum itself is skipped, as
 * `checkBuild` exempts it.
 */
export function openedByForumTier(t: number): { building: BuildingDef; tier: number }[] {
  const out: { building: BuildingDef; tier: number }[] = [];
  for (const b of buildings) {
    if (b.id === 'forum') continue;
    b.tiers.forEach((tier, i) => { if (tier.requiresForumTier === t) out.push({ building: b, tier: i + 1 }); });
  }
  return out;
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
  const earns = outputValuePerHour(state) * remainingHours;
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
