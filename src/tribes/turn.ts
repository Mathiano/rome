import { config, activeTribe } from '../data';
import type { GameState } from '../state/types';
import { chance } from '../state/rng';
import { log } from '../state/store';
import { defenceStrength, raidChance, raidStrength, resolveRaid } from '../combat/raids';
import { resolveEnvoy } from './envoys';

/** What it costs to buy the tribe off once scouts have seen them massing. */
export function appeasePrice(state: GameState): number {
  const c = config.tribe;
  return Math.ceil(c.appeaseBase + c.appeasePerStrength * state.tribe.strength);
}

/** Pay them to go home. Clears the massing before the tribe's step resolves. */
export function appease(state: GameState): void {
  if (state.tribe.massingForRound < state.round) throw new Error('Nobody is massing');
  const price = appeasePrice(state);
  if (state.resources.denarii < price) throw new Error('Not enough denarii');
  state.resources.denarii -= price;
  state.tribe.massingForRound = -999;
  state.tribe.trust = Math.min(100, state.tribe.trust + config.tribe.appeaseTrust);
  state.tribe.fear = Math.max(0, state.tribe.fear + config.tribe.appeaseFear);
  log(state, 'tribe', `${activeTribe().name} accept ${price} denarii and turn back. They now know you will pay.`);
}

/**
 * The tribe's step (DESIGN §3.2 step 3). A raid is announced a round before it
 * lands, so the player can buy it off, reinforce, or stand and take it.
 */
export function tribeTurn(state: GameState): void {
  resolveEnvoy(state);
  const t = state.tribe;
  const def = activeTribe();
  t.strength += def.strengthGrowthPerRound;
  t.trust = Math.max(0, t.trust - config.tribe.trustDecayPerRound);
  t.fear = Math.max(0, t.fear - config.tribe.fearDecayPerRound);

  if (t.massingForRound === state.round) {
    t.massingForRound = -999;
    resolveRaid(state);
    return;
  }
  if (t.massingForRound > state.round) return; // already warned, not yet landed
  if (chance(state, raidChance(state))) {
    t.massingForRound = state.round + config.tribe.warnRoundsBeforeRaid;
    log(state, 'raid', `Scouts report ${def.name} massing beyond the treeline: about ${Math.round(raidStrength(state))} against your ${Math.round(defenceStrength(state))}. They will come next round.`);
  }
}
