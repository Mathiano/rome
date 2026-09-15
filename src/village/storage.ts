import { building, config, resources as resourceDefs, type ResourceId } from '../data';
import type { GameState } from '../state/types';

export function sumEffect(state: GameState, key: string): number {
  let total = 0;
  for (const s of state.slots) {
    if (!s.building || s.tier <= 0) continue;
    total += building(s.building).tiers[s.tier - 1].effects[key] ?? 0;
  }
  return total;
}

export function buildingTier(state: GameState, id: string): number {
  return Math.max(0, ...state.slots.filter((s) => s.building === id).map((s) => s.tier));
}

export function forumTier(state: GameState): number {
  return buildingTier(state, 'forum');
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
