import { config } from '../data';
import type { GameState, Family } from '../state/types';
import { log } from '../state/store';
import { aliveMembers, livingMembers } from './characters';
import { officeFamilyId } from './challenge';

/**
 * Secession (DESIGN §9.7): a house that has been slighted enough, and loathes
 * you enough, for long enough, leaves the colony and takes a share of the
 * citizens with it. It is a hard setback and not a terminal one (Pillar 7):
 * the house is away, not gone. Its regard is frozen while it is away and a
 * gift still reaches it; it hears terms again once that regard is mended,
 * and comes home regardless by a hard limit.
 *
 * A house in office never leaves. It has no reason to.
 */

/** Whether the house meets the terms for leaving this round. */
export function underPressure(state: GameState, fam: Family): boolean {
  const s = config.secession;
  if (fam.isPlayer || fam.departedRound !== null) return false;
  if (officeFamilyId(state) === fam.id) return false;
  return fam.grievances >= s.grievances && fam.attitude <= s.attitude;
}

/** The house leaves: its members go with it, its posts fall vacant, citizens follow. */
export function secede(state: GameState, fam: Family): void {
  const s = config.secession;
  for (const c of livingMembers(state, fam.id)) {
    c.departed = true;
    if (c.post) { state.posts[c.post] = null; c.post = null; }
    if (c.lesserPost) { state.lesserPosts[c.lesserPost] = null; c.lesserPost = null; }
    c.bodyguards = 0;
  }
  fam.departedRound = state.round;
  fam.sourRounds = 0;
  fam.demand = null;
  const gone = Math.floor(state.population * s.populationShare);
  state.population = Math.max(0, state.population - gone);
  state.rome.favour += s.romeFavour;
  state.stats.secessions += 1;
  log(state, 'council', `The ${fam.name} leave the colony. Their posts stand empty, their votes go with them, and ${gone} citizens follow them out of the gate. Rome will hear of it.`);
}

/** Whether a house away from the colony would come home this round. */
export function mayReturn(state: GameState, fam: Family): boolean {
  if (fam.departedRound === null) return false;
  const s = config.secession;
  const away = state.round - fam.departedRound;
  if (away >= s.maxAwayRounds) return true;
  return away >= s.awayRounds && fam.attitude >= s.returnAttitude;
}

/** The house comes home. Its grievances are forgotten; its regard is at least the floor it came home on. */
export function returnHome(state: GameState, fam: Family): void {
  for (const c of aliveMembers(state, fam.id)) c.departed = false;
  fam.departedRound = null;
  fam.sourRounds = 0;
  fam.grievances = 0;
  fam.attitude = Math.max(fam.attitude, config.secession.returnAttitude);
  log(state, 'council', `The ${fam.name} return to the colony. What was between you is set aside, for now.`);
}

/**
 * The secession step of a rival's turn. Returns true when the house is away,
 * or has just left, and the rest of its turn is not to run.
 */
export function secessionTurn(state: GameState, fam: Family): boolean {
  if (fam.departedRound !== null) {
    if (!mayReturn(state, fam)) return true;
    returnHome(state, fam);
    return false;
  }
  if (!underPressure(state, fam)) {
    fam.sourRounds = 0;
    return false;
  }
  fam.sourRounds += 1;
  const s = config.secession;
  if (fam.sourRounds >= s.rounds) {
    secede(state, fam);
    return true;
  }
  if (fam.sourRounds === s.rounds - 1) {
    log(state, 'council', `The ${fam.name} talk openly of leaving the colony. One more round like this and they will.`);
  }
  return false;
}
