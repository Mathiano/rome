import { config, tribeDef } from '../data';
import type { GameState, TribeState } from '../state/types';
import { chance } from '../state/rng';
import { log } from '../state/store';
import { defenceStrength, raidChance, raidStrength, resolveRaid } from '../combat/raids';
import { propagateWeb, resolveEnvoy, tribeState } from './envoys';

/** What it costs to buy the tribe off once scouts have seen them massing. */
export function appeasePrice(state: GameState, tribeId: string): number {
  const c = config.tribe;
  return Math.ceil(c.appeaseBase + c.appeasePerStrength * tribeState(state, tribeId).strength);
}

/** Pay them to go home. Clears the massing before the tribe's step resolves. */
export function appease(state: GameState, tribeId: string): void {
  const t = tribeState(state, tribeId);
  if (t.massingForRound < state.round) throw new Error('Nobody is massing');
  const price = appeasePrice(state, tribeId);
  if (state.resources.denarii < price) throw new Error('Not enough denarii');
  state.resources.denarii -= price;
  t.massingForRound = -999;
  t.trust = Math.min(100, t.trust + config.tribe.appeaseTrust);
  t.fear = Math.max(0, t.fear + config.tribe.appeaseFear);
  propagateWeb(state, t.id, config.tribe.appeaseTrust);
  log(state, 'tribe', `${tribeDef(tribeId).name} accept ${price} denarii and turn back. They now know you will pay.`);
}

/**
 * The tribe's step (DESIGN §3.2 step 3). A raid is announced a round before it
 * lands, so the player can buy it off, reinforce, or stand and take it.
 */
export function tribeTurn(state: GameState): void {
  for (const t of Object.values(state.tribes)) oneTribe(state, t);
}

function oneTribe(state: GameState, t: TribeState): void {
  resolveEnvoy(state, t);
  const def = tribeDef(t.id);
  t.strength += def.strengthGrowthPerRound;
  t.trust = Math.max(0, t.trust - config.tribe.trustDecayPerRound);
  t.fear = Math.max(0, t.fear - config.tribe.fearDecayPerRound);

  if (t.massingForRound === state.round) {
    t.massingForRound = -999;
    resolveRaid(state, t);
    return;
  }
  if (t.massingForRound > state.round) return; // already warned, not yet landed
  if (chance(state, raidChance(state, t))) {
    t.massingForRound = state.round + config.tribe.warnRoundsBeforeRaid;
    log(state, 'raid', `Scouts report ${def.name} massing beyond the treeline: about ${Math.round(raidStrength(state, t))} against your ${Math.round(defenceStrength(state))}. They will come next round.`);
  }
}
