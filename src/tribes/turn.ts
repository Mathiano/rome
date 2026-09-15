import { config, activeTribe } from '../data';
import type { GameState } from '../state/types';
import { chance } from '../state/rng';
import { raidChance, resolveRaid } from '../combat/raids';
import { resolveEnvoy } from './envoys';

/** The tribe's step (DESIGN §3.2 step 3): answer envoys, then act or pass. */
export function tribeTurn(state: GameState): void {
  resolveEnvoy(state);
  const t = state.tribe;
  const def = activeTribe();
  t.strength += def.strengthGrowthPerRound;
  t.trust = Math.max(0, t.trust - config.tribe.trustDecayPerRound);
  t.fear = Math.max(0, t.fear - config.tribe.fearDecayPerRound);
  if (chance(state, raidChance(state))) resolveRaid(state);
}
