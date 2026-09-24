import { config } from '../data';
import type { GameState, Character, Family } from '../state/types';
import { chance } from '../state/rng';
import { log } from '../state/store';
import { gravitasRank, leaderOf, livingMembers, playerFamily, raiseNewMan } from './characters';
import { clampAtt } from './posts';

/**
 * Heirs by adoption (DESIGN §9.2). Two routes, both Roman practice:
 *
 * - **A new man.** A veteran, a freedman or a tribal noble raised into the
 *   house. Nobody else is party to it, so it runs no round (DESIGN §3.2), the
 *   same footing as standing guards over your kin. It is priced by the size of
 *   the household, because a house is its voting weight (§9.5) and a purse
 *   should not be able to buy the council outright.
 * - **From another house.** A grown man given over by a house that thinks
 *   well enough of you. That house is an actor, so it runs a round. He keeps
 *   his post and his marriage, but his vote and his standing go with him, and
 *   Rome would have recorded the new name.
 *
 * Birth is the third route and still waits on §15.7, which is not ours to
 * answer; an adopted adult needs no such number.
 */

/** What a new man costs this house today: the base, plus a share per living member. */
export function newManCost(state: GameState): number {
  const a = config.adoption;
  const size = livingMembers(state, playerFamily(state).id).length;
  return Math.round(a.newManCost * (1 + a.newManCostPerMember * size));
}

function requireRank(state: GameState, what: string): Character {
  const l = leaderOf(state, playerFamily(state).id);
  if (!l) throw new Error('Your house has no head');
  const min = config.adoption.minRank;
  if (gravitasRank(l) < min) throw new Error(`${what} needs gravitas rank ${min}; ${l.name} is rank ${gravitasRank(l)}`);
  return l;
}

/** Raise one of the new men into the player's house. Household business: no round. */
export function adoptNewMan(state: GameState): Character {
  requireRank(state, 'An adoption');
  const cost = newManCost(state);
  if (state.resources.denarii < cost) throw new Error('Not enough denarii');
  state.resources.denarii -= cost;
  const c = raiseNewMan(state, playerFamily(state).id);
  state.stats.adoptions += 1;
  return c;
}

/**
 * The Roman form of an adopted name: the adopter's nomen replaces the birth
 * nomen, and the birth nomen survives as a cognomen in -anus. Gaius Octavius,
 * adopted by Gaius Julius Caesar, became Gaius Julius Caesar Octavianus.
 */
export function adoptedName(name: string, gensName: string): string {
  const parts = name.split(' ');
  const newNomen = nomenOf(gensName);
  if (parts.length < 2) return `${newNomen} ${parts[0]}`;
  const [praenomen, oldNomen, ...rest] = parts;
  // Octavius → Octavianus, Cornelius → Cornelianus; a nomen not in -ius just takes -anus.
  const agnomen = /ius$/.test(oldNomen) ? oldNomen.replace(/ius$/, 'ianus') : `${oldNomen}anus`;
  return [praenomen, newNomen, ...rest, agnomen].join(' ');
}

/** "gens Aurelia" → "Aurelius", the masculine nomen a man of the house carries. */
function nomenOf(gensName: string): string {
  return gensName.replace(/^gens\s+/, '').replace(/a$/, 'us');
}

/** The men another house could give up: grown, alive, not its head, not put out already. */
export function adoptionCandidates(state: GameState, familyId: string): Character[] {
  return livingMembers(state, familyId).filter((c) => c.sex === 'm' && !c.isLeader && !c.exiled);
}

/** Whether a house would give a man up at all, and if not, why. */
export function houseConsent(state: GameState, familyId: string): { ok: boolean; reason?: string } {
  const fam = state.families[familyId];
  if (!fam || fam.isPlayer) return { ok: false, reason: 'not another house' };
  const a = config.adoption;
  if (fam.attitude < a.houseConsentAttitude) return { ok: false, reason: `they think too little of you (regard ${a.houseConsentAttitude} needed)` };
  if (livingMembers(state, familyId).length - 1 < a.houseMinSizeAfter) return { ok: false, reason: 'they will not be left with nobody' };
  if (!adoptionCandidates(state, familyId).length) return { ok: false, reason: 'no man of theirs could be spared' };
  return { ok: true };
}

/** Take a grown man from another house into your own. A move that house is party to: it runs a round. */
export function adoptFromHouse(state: GameState, characterId: string): Character {
  const c = state.characters[characterId];
  if (!c?.alive) throw new Error('No such living character');
  const from = state.families[c.familyId];
  const mine = playerFamily(state);
  if (from.isPlayer) throw new Error('He is yours already');
  if (c.isLeader) throw new Error('A house does not give up its head');
  if (c.sex !== 'm') throw new Error('Not an adoption Rome would record');
  const consent = houseConsent(state, from.id);
  if (!consent.ok) throw new Error(`The ${from.name} refuse: ${consent.reason}`);
  requireRank(state, 'An adoption');
  const a = config.adoption;
  if (state.resources.denarii < a.houseCost) throw new Error('Not enough denarii');
  state.resources.denarii -= a.houseCost;

  const born = c.name;
  from.memberIds = from.memberIds.filter((id) => id !== c.id);
  mine.memberIds.push(c.id);
  c.familyId = mine.id;
  c.name = adoptedName(c.name, mine.gensName);
  // He arrives as a son of the house, not its head: the office and the
  // headship stay where they were, whatever his years.
  c.isLeader = false;
  from.attitude = clampAtt(from.attitude + a.houseAttitude);
  from.grievances = Math.max(0, from.grievances - a.houseGrievanceRelief);
  state.stats.adoptions += 1;
  log(state, 'family', `${born} of the ${from.name} is adopted into the ${mine.name}, and is ${c.name} now. The ${from.name} count him a bond between the houses.`);
  return c;
}

/**
 * A rival house keeps its numbers up the same way (DESIGN §9.1: all four run
 * on identical rules). Below `rivalMinSize` living members it raises a new man
 * from time to time, rather than dwindling to the last of its line.
 */
export function maybeAdopt(state: GameState, fam: Family): void {
  const a = config.adoption;
  if (fam.isPlayer) return;
  if (livingMembers(state, fam.id).length >= a.rivalMinSize) return;
  if (!chance(state, a.rivalChancePerRound)) return;
  raiseNewMan(state, fam.id);
}
