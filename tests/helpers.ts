import type { GameState } from '../src/state/types';
import { createInitialState } from '../src/state/store';
import { generate } from '../src/map/world';
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

/** A colony whose world holds a site of this kind: the seed is searched, not assumed. */
export function colonyWith(id: string): GameState {
  for (let seed = 1; seed < 500; seed++) {
    const s = createInitialState(0, seed);
    if (Object.values(generate(s.map.seed).sites).includes(id)) return s;
  }
  throw new Error(`no world in 500 seeds holds a ${id}`);
}

/** The first hex in this colony's world that holds a site of this kind. */
export function hexOf(s: GameState, id: string): string {
  const w = generate(s.map.seed);
  const k = Object.keys(w.sites).find((x) => w.sites[x] === id);
  if (!k) throw new Error(`no ${id} in this world`);
  return k;
}
