import { config } from '../data';
import type { GameState } from '../state/types';
import { log } from '../state/store';
import { gravitasRank, leaderOf, playerFamily } from './characters';
import { clampAtt } from './posts';

/** Bribe (DESIGN §9.6 basic intrigue): denarii for attitude. Costs a sliver of the briber's gravitas. */
export function bribe(state: GameState, familyId: string): void {
  const fam = state.families[familyId];
  if (!fam || fam.isPlayer) throw new Error('Cannot bribe that family');
  const { cost, attitude, gravitasLoss, minRank } = config.intrigue.bribe;
  const briber = leaderOf(state, playerFamily(state).id);
  if (briber && gravitasRank(briber) < minRank) {
    throw new Error(`A bribe needs gravitas rank ${minRank}; ${briber.name} is rank ${gravitasRank(briber)}`);
  }
  if (state.resources.denarii < cost) throw new Error('Not enough denarii');
  state.resources.denarii -= cost;
  fam.attitude = clampAtt(fam.attitude + attitude);
  if (briber) briber.gravitas = Math.max(0, briber.gravitas - gravitasLoss);
  log(state, 'council', `${cost} denarii find their way to the ${fam.name}. Their regard for you rises.`);
}

/** Standing well with Rome makes its backing cheaper to call on. */
export function backingCost(state: GameState): number {
  const g = config.gravitas;
  const discount = Math.max(0, state.rome.favour) * g.romeBackingFavourDiscount;
  const floor = Math.ceil(g.romeBackingCost * g.romeBackingMinCostFraction);
  return Math.max(floor, Math.round(g.romeBackingCost - discount));
}

/** Spend gravitas stock to buy Rome's backing (DESIGN §6, §9.2). Rome leans on the rival houses. */
export function seekRomeBacking(state: GameState): void {
  const leader = leaderOf(state, playerFamily(state).id);
  if (!leader) throw new Error('No leader');
  const g = config.gravitas;
  if (state.rome.favour < config.rome.backingMinFavour) {
    throw new Error(`Rome will not back a colony it thinks little of (favour ${config.rome.backingMinFavour} needed, you have ${Math.round(state.rome.favour)})`);
  }
  if (gravitasRank(leader) < g.romeBackingMinRank) {
    throw new Error(`Rome listens from gravitas rank ${g.romeBackingMinRank}; ${leader.name} is rank ${gravitasRank(leader)}`);
  }
  const cost = backingCost(state);
  if (leader.gravitasStock < cost) throw new Error('Not enough gravitas');
  leader.gravitasStock -= cost;
  state.rome.favour += g.romeBackingFavour;
  for (const f of Object.values(state.families)) {
    if (!f.isPlayer) f.attitude = clampAtt(f.attitude + g.romeBackingAttitude);
  }
  log(state, 'council', `${leader.name} spends ${cost} gravitas and Rome's letters arrive in your favour.`);
}
