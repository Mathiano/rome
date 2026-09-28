import { config, unlocks } from '../data';
import type { GameState } from '../state/types';
import { sumEffect } from '../village/storage';
import { ringOf, totalGarrisoned, troopFieldMen } from '../map/sites';
import { log } from '../state/store';
import { totalBodyguards } from '../politics/intrigue';

/** One pool of men-at-arms (DESIGN §8.1). */
export function militiaPool(state: GameState): number {
  let pool = Math.floor(state.population * config.population.militiaRatio) + sumEffect(state, 'militiaBonus') + troopFieldMen(state);
  for (const u of state.rome.unlocks) pool += unlocks[u]?.militiaBonus ?? 0;
  // A cohort quartered under a Rome request stands the militia down (data/requests.json r08).
  if (state.rome.hostingUntilRound > state.round && state.rome.activeRequest?.kind === 'host') pool = Math.floor(pool / 2);
  return Math.max(0, pool);
}

/** What is left at home once the far holdings and bodyguards have taken theirs. */
export function homeMilitia(state: GameState): number {
  return Math.max(0, militiaPool(state) - totalGarrisoned(state) - totalBodyguards(state));
}

/**
 * Garrisons and bodyguards never ask for more men than the pool has (§5.5,
 * §8.1). The pool can shrink under them — citizens lost, a troop field given
 * up — and when it does the farthest garrisons come home first, then the
 * guards. Run at the end of every round, which is the only place it shrinks.
 */
export function keepCommitmentsWithinPool(state: GameState): void {
  let over = totalGarrisoned(state) + totalBodyguards(state) - militiaPool(state);
  if (over <= 0) return;
  for (const c of [...state.map.claimed].sort((a, b) => ringOf(b.key) - ringOf(a.key) || a.key.localeCompare(b.key))) {
    if (over <= 0) break;
    const back = Math.min(c.garrison, over);
    if (!back) continue;
    c.garrison -= back;
    over -= back;
    log(state, 'map', `There are not men enough: ${back} come home from the garrison at ${c.key}.`);
  }
  for (const ch of Object.values(state.characters).filter((x) => x.alive && x.bodyguards > 0).sort((a, b) => a.id.localeCompare(b.id))) {
    if (over <= 0) break;
    const back = Math.min(ch.bodyguards, over);
    ch.bodyguards -= back;
    over -= back;
    log(state, 'council', `There are not men enough: ${back} of ${ch.name}'s guards return to the ranks.`);
  }
}

/** Men not yet committed anywhere. */
export function spareMilitia(state: GameState): number {
  return homeMilitia(state);
}
