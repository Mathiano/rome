import { config, unlocks } from '../data';
import type { GameState } from '../state/types';
import { sumEffect } from '../village/storage';
import { totalGarrisoned } from '../map/sites';
import { totalBodyguards } from '../politics/intrigue';

/** One pool of men-at-arms (DESIGN §8.1). */
export function militiaPool(state: GameState): number {
  let pool = Math.floor(state.population * config.population.militiaRatio) + sumEffect(state, 'militiaBonus');
  for (const u of state.rome.unlocks) pool += unlocks[u]?.militiaBonus ?? 0;
  // A cohort quartered under a Rome request stands the militia down (data/requests.json r08).
  if (state.rome.hostingUntilRound > state.round && state.rome.activeRequest?.kind === 'host') pool = Math.floor(pool / 2);
  return Math.max(0, pool);
}

/** What is left at home once the far holdings and bodyguards have taken theirs. */
export function homeMilitia(state: GameState): number {
  return Math.max(0, militiaPool(state) - totalGarrisoned(state) - totalBodyguards(state));
}

/** Men not yet committed anywhere. */
export function spareMilitia(state: GameState): number {
  return homeMilitia(state);
}
