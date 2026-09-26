import type { GameState } from '../state/types';
import { accrue } from './economy';
import { completeFinished } from './construction';
import { completeResearch } from './research';
import { clampToCapacity } from './storage';

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
  const boundaries = [...state.constructions.map((c) => c.finishAt), ...(state.research?.active ?? []).map((r) => r.finishAt)]
    .filter((f) => f > t && f <= now)
    .sort((a, b) => a - b);
  for (const b of boundaries) {
    accrue(state, b - t);
    completeFinished(state, b);
    completeResearch(state, b);
    t = b;
  }
  accrue(state, now - t);
  completeFinished(state, now);
  completeResearch(state, now);
  clampToCapacity(state);
  state.lastTick = now;
}
