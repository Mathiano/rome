import type { GameState } from '../state/types';
import { accrue } from './economy';
import { completeFinished } from './construction';
import { completeResearch } from './research';
import { clampToCapacity } from './storage';
import { completeHoldingWork } from '../map/holdings';
import { tribesTakeUnclaimed } from '../map/contest';
import { completeRoad } from '../map/roads';

/**
 * The invisible village clock (DESIGN §3.1). Advances the economy by wall-clock
 * time since the last tick and completes finished constructions and studies.
 * It never runs a political round: rounds advance only when the player acts
 * (§3.2, §3.3 as ruled 2026-09-25), however long the gap and whatever the dev
 * clock's multiplier. Safe to call with any `now` >= lastTick; larger gaps
 * (the game was closed) are handled in one step because accrual is linear and
 * capped by storage.
 */
export function tick(state: GameState, now: number): void {
  if (now < state.lastTick) {
    // Clock went backwards (device change, clock reset). Never punish: just resync.
    state.lastTick = now;
    return;
  }
  // Constructions that finished during the gap change production; step at each boundary.
  let t = state.lastTick;
  const boundaries = [...state.constructions.map((c) => c.finishAt), ...(state.research?.active ?? []).map((r) => r.finishAt), ...(state.map.works ? [state.map.works.finishAt] : []), ...(state.map.roadWork ? [state.map.roadWork.finishAt] : [])]
    .filter((f) => f > t && f <= now)
    .sort((a, b) => a - b);
  for (const b of boundaries) {
    accrue(state, b - t);
    completeFinished(state, b);
    completeResearch(state, b);
    completeHoldingWork(state, b);
    completeRoad(state, b);
    t = b;
  }
  accrue(state, now - t);
  completeFinished(state, now);
  completeResearch(state, now);
  completeHoldingWork(state, now);
  completeRoad(state, now);
  clampToCapacity(state);
  // Tribes take unclaimed sites on the clock, present or away (§5.5): an
  // opportunity missed. Nothing the player holds is touched here.
  tribesTakeUnclaimed(state, state.lastTick, now);
  state.lastTick = now;
}
