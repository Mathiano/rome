import { building, buildings, config } from '../data';
import type { GameState, Construction, Slot } from '../state/types';
import { canAfford, pay, buildTimeMultiplier, corruptionCostMultiplier, outputValuePerHour } from './economy';
import { colonyTier } from './storage';
import { anchors, nextTownSlotId, placeProblem, uniqueTaken } from './grid';
import { log } from '../state/store';
import type { BuildingDef, Cost } from '../data';

export function slotById(state: GameState, id: string): Slot {
  const s = state.slots.find((x) => x.id === id);
  if (!s) throw new Error(`unknown slot ${id}`);
  return s;
}

/**
 * What a copy of a building costs against the first (DESIGN §4.4, 🟡 "costs
 * may rise per copy"): 1 for a unique building, and for a repeatable one
 * (1 + config.repeatables.costGrowthPerCopy) to the power of its copy number.
 */
export function copyFactor(buildingId: string, copy: number): number {
  if (building(buildingId).unique) return 1;
  return (1 + config.repeatables.costGrowthPerCopy) ** Math.max(0, copy);
}

/** The copy number a building would take if one more were started now. */
export function nextCopy(state: GameState, buildingId: string): number {
  return state.slots.filter((s) => s.building === buildingId).length;
}

/** The copy a slot is or would be: its own once built, the next one while it is open ground. */
export function copyOf(state: GameState, slot: Slot, buildingId: string): number {
  if (slot.building === buildingId && slot.copy !== undefined) return slot.copy;
  if (slot.building === buildingId) return state.slots.filter((s) => s.building === buildingId && s.id !== slot.id).length;
  return nextCopy(state, buildingId);
}

export function scaledCost(state: GameState, base: Cost, copy = 1): Cost {
  const m = corruptionCostMultiplier(state) * copy;
  const out: Cost = {};
  for (const [k, v] of Object.entries(base)) out[k as keyof Cost] = Math.ceil((v ?? 0) * m);
  return out;
}

/**
 * What may rise on a slot. A town slot exists only once something is placed
 * on it, so it only ever holds its own building; a site takes the building of
 * its resource, as many sites as there are (§4.4, repeatable); the wall slot
 * takes the wall.
 */
export function eligibleBuildings(_state: GameState, slot: Slot): string[] {
  if (slot.building) return [slot.building];
  if (slot.zone === 'wall') return ['wall'];
  if (slot.zone === 'site') return buildings.filter((b) => b.zone === 'site' && b.site === slot.site).map((b) => b.id);
  return [];
}

/** Which rule a build fails on. `reason` is the same gate in words. */
export type BuildGate = 'top' | 'occupied' | 'ineligible' | 'slot_busy' | 'unique' | 'room' | 'lane' | 'colony' | 'resources';

export interface BuildCheck {
  ok: boolean;
  /** The first failing gate, in words. Unchanged: the plot card and `startBuild` read it. */
  reason?: string;
  /** Every failing gate, in the order `checkBuild` tests them. `reason` is `reasons[0]`. */
  reasons: string[];
  /** The same gates as codes, parallel to `reasons`, so a panel can tell the Praetorium from the lane. */
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
 * hide that it also needs the Praetorium, or that it is 120 clay short.
 */
export function checkBuild(state: GameState, slotId: string, buildingId: string): BuildCheck {
  const slot = slotById(state, slotId);
  const def = building(buildingId);
  const toTier = slot.tier + 1;
  if (toTier > def.tiers.length) {
    const reason = 'Already at the top tier';
    return { ok: false, reason, reasons: [reason], gates: ['top'], short: {}, cost: {}, seconds: 0, toTier };
  }
  const reasons: string[] = [];
  const gates: BuildGate[] = [];
  const fail = (gate: BuildGate, reason: string) => { gates.push(gate); reasons.push(reason); };
  if (slot.building && slot.building !== buildingId) fail('occupied', 'Slot holds another building');
  if (!eligibleBuildings(state, slot).includes(buildingId)) fail('ineligible', 'Cannot build that here');
  if (state.constructions.some((c) => c.slotId === slotId)) fail('slot_busy', 'Already under construction');
  return commonGates(state, def, toTier, fail, reasons, gates, copyFactor(buildingId, copyOf(state, slot, buildingId)));
}

/**
 * A town building not yet on the grid (§4.5 C.1): the same gates as any
 * build, plus one of a unique building and room to put it down. With a cell
 * named, room means that cell; without, anywhere inside the wall.
 */
export function checkPlace(state: GameState, buildingId: string, at?: { x: number; y: number }): BuildCheck {
  const def = building(buildingId);
  const reasons: string[] = [];
  const gates: BuildGate[] = [];
  const fail = (gate: BuildGate, reason: string) => { gates.push(gate); reasons.push(reason); };
  if (def.zone !== 'town') fail('ineligible', 'Not a building for the town grid');
  else if (uniqueTaken(state, buildingId)) fail('unique', `The colony has its ${def.name.toLowerCase()} already`);
  else if (at) {
    const problem = placeProblem(state, buildingId, at.x, at.y);
    if (problem) fail('room', problem);
  } else if (!anchors(state, buildingId).length) {
    fail('room', def.placement === 'riverbank' ? 'No room on the riverbank' : 'No room inside the wall');
  }
  return commonGates(state, def, 1, fail, reasons, gates, copyFactor(buildingId, nextCopy(state, buildingId)));
}

function commonGates(
  state: GameState, def: BuildingDef, toTier: number,
  fail: (gate: BuildGate, reason: string) => void, reasons: string[], gates: BuildGate[], copy: number,
): BuildCheck {
  const buildingId = def.id;
  const tier = def.tiers[toTier - 1];
  const cost = scaledCost(state, tier.cost, copy);
  const seconds = Math.ceil(tier.buildSeconds * buildTimeMultiplier(state));
  const concurrent = state.constructions.filter((c) => c.kind === def.kind).length;
  const limit = def.kind === 'field' ? config.concurrency.field : config.concurrency.building;
  if (concurrent >= limit) fail('lane', def.kind === 'field' ? 'A field is already being worked' : 'A building is already under construction');
  // The seat is exempt: it is what raises the colony's tier.
  if (colonyTier(state) < tier.requiresColonyTier && buildingId !== 'praetorium') fail('colony', `Needs praetorium tier ${tier.requiresColonyTier}`);
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
 * What a Praetorium of tier `t` opens: every building tier gated on it, read
 * from `requiresColonyTier` in data/buildings.json and never authored (DESIGN
 * §4.4, "its tier is the colony's tier"). The praetorium itself is skipped, as
 * `checkBuild` exempts it.
 */
export function openedByColonyTier(t: number): { building: BuildingDef; tier: number }[] {
  const out: { building: BuildingDef; tier: number }[] = [];
  for (const b of buildings) {
    if (b.id === 'praetorium') continue;
    b.tiers.forEach((tier, i) => { if (tier.requiresColonyTier === t) out.push({ building: b, tier: i + 1 }); });
  }
  return out;
}

export function startBuild(state: GameState, slotId: string, buildingId: string, now: number): Construction {
  const check = checkBuild(state, slotId, buildingId);
  if (!check.ok) throw new Error(check.reason);
  pay(state, check.cost);
  const slot = slotById(state, slotId);
  if (slot.copy === undefined) slot.copy = copyOf(state, slot, buildingId);
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

/**
 * Put a town building down on the grid and start its first tier (§4.5 C.1).
 * The slot is made here, holding its building from the start, so the cells
 * are taken while it rises and nothing else can be placed across it.
 */
export function placeBuild(state: GameState, buildingId: string, x: number, y: number, now: number): Construction {
  const check = checkPlace(state, buildingId, { x, y });
  if (!check.ok) throw new Error(check.reason);
  const slot: Slot = { id: nextTownSlotId(state), zone: 'town', x, y, building: buildingId, tier: 0 };
  state.slots.push(slot);
  return startBuild(state, slot.id, buildingId, now);
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
