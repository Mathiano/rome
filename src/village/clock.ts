import { config } from '../data';
import type { GameState } from '../state/types';
import { accrue } from './economy';
import { completeFinished } from './construction';
import { clampToCapacity } from './storage';
import { runIdleRounds } from '../politics/rounds';

/**
 * The invisible village clock (DESIGN §3.1). Advances the economy by wall-clock
 * time since the last tick, completes finished constructions, and applies the
 * calendar floor (§3.3). Safe to call with any `now` >= lastTick; larger gaps
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
  const boundaries = state.constructions
    .map((c) => c.finishAt)
    .filter((f) => f > t && f <= now)
    .sort((a, b) => a - b);
  for (const b of boundaries) {
    accrue(state, b - t);
    completeFinished(state, b);
    t = b;
  }
  accrue(state, now - t);
  completeFinished(state, now);
  clampToCapacity(state);
  state.lastTick = now;
  runIdleRounds(state, now, config.calendarFloorHours * 3_600_000, config.idleRoundsMaxCatchUp);
}
