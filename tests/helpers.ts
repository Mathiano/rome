import type { GameState } from '../src/state/types';
import { anchors, nextTownSlotId } from '../src/village/grid';

/**
 * Put a town slot for `buildingId` on the grid, on the first place it fits,
 * and return its id — what `placeBuild` does before it starts the work. The
 * slot holds its building at tier 0; the test raises or starts it.
 */
export function plot(state: GameState, buildingId: string, id?: string): string {
  const a = anchors(state, buildingId)[0];
  if (!a) throw new Error(`no room for ${buildingId}`);
  const slotId = id ?? nextTownSlotId(state);
  state.slots.push({ id: slotId, zone: 'town', x: a.x, y: a.y, building: buildingId, tier: 0 });
  return slotId;
}

/** A town building standing at a tier, put on the grid if it is not there already. */
export function raise(state: GameState, buildingId: string, tier: number): string {
  const have = state.slots.find((s) => s.building === buildingId);
  const id = have?.id ?? plot(state, buildingId);
  state.slots.find((s) => s.id === id)!.tier = tier;
  return id;
}
