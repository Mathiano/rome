import { config } from '../data';
import type { GameState } from '../state/types';
import { log } from '../state/store';
import { rivalFamilies } from './characters';
import { rivalTurn } from './families';
import { considerChallenge, playerHoldsOffice, resolveChallenge } from './challenge';
import { tribeTurn } from '../tribes/turn';
import { claimedEffect, mapTurn } from '../map/sites';
import { romeTurn, checkCollapse } from '../rome/requests';
import { ageAll } from './characters';
import { rollEvent } from './events';
import { accrueGravitas, driftAttitudes, updateCorruption } from './posts';
import { sumEffect } from '../village/storage';

/**
 * One political round (DESIGN §3.2). The player's own action has already been
 * applied by the caller; this runs steps 2–5. `idle` means the player did not
 * act (calendar floor, §3.3).
 */
export function runRound(state: GameState, now: number, idle = false): void {
  const fromLogId = state.logSeq;
  state.round += 1;
  state.lastRoundAt = now;
  state.stats.rounds += 1;
  if (idle) state.stats.idleRounds += 1;
  state.stats.peakPopulation = Math.max(state.stats.peakPopulation, Math.floor(state.population));
  if (idle) log(state, 'system', `Round ${state.round}: the council meets without you.`);
  else log(state, 'system', `Round ${state.round}.`);
  for (const f of rivalFamilies(state)) rivalTurn(state, f);
  for (const f of rivalFamilies(state)) considerChallenge(state, f.id);
  resolveChallenge(state);
  if (!playerHoldsOffice(state)) state.stats.roundsOutOfOffice += 1;
  tribeTurn(state);
  mapTurn(state);
  romeTurn(state);
  ageAll(state);
  rollEvent(state);
  accrueGravitas(state, sumEffect(state, 'gravitasPerRound') + claimedEffect(state, 'gravitasPerRound'));
  driftAttitudes(state);
  updateCorruption(state);
  checkCollapse(state);
  state.lastReport = {
    round: state.round,
    at: now,
    idle,
    fromLogId,
    population: Math.floor(state.population),
    corruption: state.corruption,
    resources: { ...state.resources },
  };
  if (idle) state.awayRounds += 1;
}

/** Calendar floor: if no round has run in `floorMs`, opponents act without the player. */
export function runIdleRounds(state: GameState, now: number, floorMs: number, maxCatchUp: number): number {
  let n = 0;
  while (now - state.lastRoundAt >= floorMs && n < maxCatchUp) {
    runRound(state, state.lastRoundAt + floorMs, true);
    n += 1;
  }
  if (n >= maxCatchUp && now - state.lastRoundAt >= floorMs) state.lastRoundAt = now;
  return n;
}

export function roundsUntilIdle(state: GameState, now: number): number {
  return Math.max(0, config.calendarFloorHours * 3_600_000 - (now - state.lastRoundAt));
}
