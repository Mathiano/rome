import { building, config, researchNodes, resources as resourceDefs, type ResourceId } from '../data';
import type { GameState, Slot } from '../state/types';
import { neighbours } from './grid';

/**
 * Everything the Library has finished, summed (DESIGN §4.6). It lives here
 * rather than in `village/research.ts` so that `sumEffect` can fold it in
 * without the two modules importing each other.
 */
export function researchEffect(state: GameState, key: string): number {
  let total = 0;
  for (const id of state.research?.completed ?? []) {
    total += researchNodes.find((n) => n.id === id)?.effects[key] ?? 0;
  }
  return total;
}

/**
 * Buildings and research speak the same vocabulary of effects, so anything that
 * already reads a building effect picks research up for free.
 */
export function sumEffect(state: GameState, key: string): number {
  let total = 0;
  for (const s of state.slots) {
    if (!s.building || s.tier <= 0) continue;
    total += building(s.building).tiers[s.tier - 1].effects[key] ?? 0;
    for (const g of adjacencyGains(state, s)) total += g.effects[key] ?? 0;
  }
  return total + researchEffect(state, key);
}

/** One adjacency rule as it stands for a slot: how many of `beside` are next to it, and what that gives. */
export interface AdjacencyGain { beside: string; count: number; effects: Record<string, number> }

/**
 * What a standing building gains from what stands beside it (DESIGN §4.5
 * C.3): every rule its data declares, with the neighbours that answer it
 * counted — standing ones only, as a building still rising gives nothing yet.
 * A rule nobody answers is listed with a count of 0, so the panel can say what
 * the building is waiting for.
 */
export function adjacencyGains(state: GameState, slot: Slot): AdjacencyGain[] {
  if (!slot.building) return [];
  const rules = building(slot.building).adjacency ?? [];
  if (!rules.length) return [];
  const beside = neighbours(state, slot).filter((n) => n.building && n.tier > 0);
  return rules.map((r) => {
    const count = beside.filter((n) => n.building === r.beside).length;
    const effects: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.effects)) effects[k] = slot.tier > 0 ? v * count : 0;
    return { beside: r.beside, count, effects };
  });
}

export function buildingTier(state: GameState, id: string): number {
  return Math.max(0, ...state.slots.filter((s) => s.building === id).map((s) => s.tier));
}

/** The colony's tier: the Praetorium's, the seat of the player's house (DESIGN §4.4). */
export function colonyTier(state: GameState): number {
  return buildingTier(state, 'praetorium');
}

export function storeOf(id: ResourceId): string {
  return resourceDefs.find((r) => r.id === id)!.store;
}

/** Capacity for a resource, or Infinity for the treasury. Base capacity comes from the granary/warehouse tier 0 = a small cap so the colony can start. */
export function capacity(state: GameState, id: ResourceId): number {
  const store = storeOf(id);
  if (store === 'treasury') return Infinity;
  const key = store === 'granary' ? 'granaryCapacity' : 'warehouseCapacity';
  const built = sumEffect(state, key);
  // With no store built, tier-1 capacity of the store acts as the open-air cap.
  const base = building(store).tiers[0].effects[key] ?? 0;
  return Math.max(built, base);
}

export function hiddenPerResource(state: GameState): number {
  return sumEffect(state, 'hiddenPerResource');
}

export function populationCap(state: GameState): number {
  return config.population.baseCap + sumEffect(state, 'populationCap');
}

export function clampToCapacity(state: GameState): void {
  for (const r of resourceDefs) {
    const cap = capacity(state, r.id);
    if (state.resources[r.id] > cap) state.resources[r.id] = cap;
    if (state.resources[r.id] < 0) state.resources[r.id] = 0;
  }
}
