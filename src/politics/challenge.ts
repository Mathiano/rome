/**
 * The top office (DESIGN §9.5). There is no calendar election. A house that
 * judges itself strong enough calls a challenge and forces a vote of every
 * living member of every house, one vote each. Losing is a hard setback and
 * never an end (Pillar 7): the player continues out of power and must win it
 * back.
 */
import { config } from '../data';
import type { GameState, Challenge, Character } from '../state/types';
import { chance } from '../state/rng';
import { log } from '../state/store';
import { gainGravitas, gravitasRank, leaderOf, livingMembers, playerFamily, standing } from './characters';
import { clampAtt } from './posts';

export function officeHolder(state: GameState): Character | null {
  const c = state.office ? state.characters[state.office] : null;
  return c?.alive ? c : null;
}

export function officeFamilyId(state: GameState): string | null {
  return officeHolder(state)?.familyId ?? null;
}

export function playerHoldsOffice(state: GameState): boolean {
  return officeFamilyId(state) === playerFamily(state).id;
}

/** Council business needs the office. Out of power, the player can only scheme. */
export function requireOffice(state: GameState, what: string): void {
  if (!playerHoldsOffice(state)) {
    const holder = officeHolder(state);
    throw new Error(`${what} is the ${config.topOffice.title}'s to decide, and that is ${holder ? holder.name : 'nobody'}`);
  }
}

function candidateFor(state: GameState, familyId: string): Character | null {
  const leader = leaderOf(state, familyId);
  return leader && !leader.exiled ? leader : livingMembers(state, familyId)[0] ?? null;
}

/** Who stands. Weak houses put nobody up and vote for someone else's man. */
export function candidates(state: GameState, callerFamilyId: string): Record<string, string> {
  const out: Record<string, string> = {};
  const strongest = Math.max(1, ...Object.keys(state.families).map((id) => standing(state, id)));
  for (const fam of Object.values(state.families)) {
    const must = fam.id === callerFamilyId || fam.id === officeFamilyId(state) || fam.isPlayer;
    const strong = standing(state, fam.id) >= strongest * config.challenge.candidateStandingRatio;
    if (!must && !strong) continue;
    const who = candidateFor(state, fam.id);
    if (who) out[fam.id] = who.id;
  }
  return out;
}

/**
 * `heardInRound` is the round the council takes the call in. A rival calls
 * inside a round that has already begun, so the default is right for it. The
 * player's call is made before their own action runs the round, and passing
 * this round's number would let `resolveChallenge` vote in the very same round
 * — leaving nobody the round DESIGN §9.5 gives them to shore up support.
 */
export function callChallenge(state: GameState, callerFamilyId: string, heardInRound = state.round): void {
  if (state.challenge) throw new Error('A challenge is already before the council');
  const cand = candidates(state, callerFamilyId);
  if (Object.keys(cand).length < 2) throw new Error('Nobody else will stand');
  state.challenge = {
    callerFamilyId,
    calledRound: heardInRound,
    voteRound: heardInRound + config.challenge.roundsToVote,
    candidates: cand,
  };
  state.lastChallengeRound = heardInRound;
  const fam = state.families[callerFamilyId];
  log(state, 'council', `The ${fam.name} call a challenge for the office of ${config.topOffice.title}. The houses vote at round ${state.challenge.voteRound}.`);
}

/**
 * A rival decides whether to move (DESIGN §9.5). It counts the votes it would
 * get rather than comparing gravitas: the doc is explicit that the defence is
 * a bigger family and members who like you more than their peers, and gravitas
 * is dominated by whoever already holds the office.
 */
export function wouldWin(state: GameState, familyId: string): boolean {
  const cand = candidates(state, familyId);
  const mine = cand[familyId];
  if (!mine) return false;
  const votes = tally(state, { callerFamilyId: familyId, calledRound: state.round, voteRound: state.round, candidates: cand });
  const best = Math.max(...Object.values(votes));
  // A tie keeps the office where it is, so the caller needs to beat it outright.
  return votes[mine] === best && !Object.entries(votes).some(([id, v]) => id !== mine && v === best);
}

export function considerChallenge(state: GameState, familyId: string): void {
  const ch = config.challenge;
  if (state.challenge) return;
  if (state.round - state.lastChallengeRound < ch.minRoundsBetween) return;
  const fam = state.families[familyId];
  if (fam.isPlayer) return;
  if (fam.attitude > ch.callerAttitudeCeiling) return;
  if (officeFamilyId(state) === familyId) return;
  if (!wouldWin(state, familyId)) return;
  if (!chance(state, ch.callChancePerRound)) return;
  callChallenge(state, familyId);
}

/**
 * Every living member votes once. A house with a candidate votes for its own.
 * A house without one would rather the player kept the office than see another
 * rival take it, unless it has come to loathe the player.
 */
export function tally(state: GameState, ch: Challenge): Record<string, number> {
  const votes: Record<string, number> = {};
  for (const id of Object.values(ch.candidates)) votes[id] = 0;
  const playerCandidate = ch.candidates[playerFamily(state).id];

  for (const fam of Object.values(state.families)) {
    const own = ch.candidates[fam.id];
    for (const member of livingMembers(state, fam.id)) {
      if (member.exiled) continue;
      let pick = own;
      if (!pick) {
        const loathes = !fam.isPlayer && fam.attitude <= config.challenge.loyalToPlayerAttitude;
        if (playerCandidate && !loathes) {
          pick = playerCandidate;
        } else {
          const rivals = Object.entries(ch.candidates)
            .filter(([fid]) => fid !== playerFamily(state).id)
            .sort((a, b) => standing(state, b[0]) - standing(state, a[0]));
          pick = rivals[0]?.[1] ?? playerCandidate;
        }
      }
      if (pick) votes[pick] += 1;
    }
  }
  return votes;
}

export function resolveChallenge(state: GameState): void {
  const ch = state.challenge;
  if (!ch || state.round < ch.voteRound) return;
  const votes = tally(state, ch);
  const incumbent = state.office;
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const tied = ranked.filter(([, v]) => v === top[1]);
  // A tie keeps the office where it is: nobody has carried the council.
  const winnerId = tied.length > 1 && incumbent && tied.some(([id]) => id === incumbent) ? incumbent : top[0];
  const winner = state.characters[winnerId];
  const held = winnerId === incumbent;

  ch.result = { winnerId, tally: votes, held };
  state.office = winnerId;
  state.challenge = null;
  state.stats.challengesFaced += 1;

  const board = Object.entries(votes)
    .map(([id, v]) => `${state.characters[id].name} ${v}`)
    .join(', ');
  if (winner) gainGravitas(winner, config.challenge.winnerGravitas);

  const playerWon = winner?.familyId === playerFamily(state).id;
  if (playerWon) state.stats.challengesWon += 1;
  log(state, 'council', `The houses vote: ${board}. ${winner ? winner.name : 'Nobody'} holds the office of ${config.topOffice.title}.`);
  if (!held) {
    const loser = incumbent ? state.characters[incumbent] : null;
    if (loser && !playerWon) {
      log(state, 'council', `${loser.name} is put out of office. The ${state.families[loser.familyId].name} are not finished.`);
    }
    for (const fam of Object.values(state.families)) {
      if (fam.isPlayer || fam.id === winner?.familyId) continue;
      fam.attitude = clampAtt(fam.attitude + config.challenge.loserAttitude);
    }
  }
}

/** The player forces a vote themselves, which is how the office is won back. */
export function playerCallChallenge(state: GameState): void {
  const ch = config.challenge;
  if (playerHoldsOffice(state)) throw new Error('You already hold it');
  if (state.round - state.lastChallengeRound < ch.minRoundsBetween) {
    throw new Error(`The council will not hear another challenge until round ${state.lastChallengeRound + ch.minRoundsBetween}`);
  }
  const leader = leaderOf(state, playerFamily(state).id);
  if (!leader) throw new Error('Your house has nobody to put up');
  if (gravitasRank(leader) < ch.playerCallMinRank) {
    throw new Error(`Calling a challenge needs gravitas rank ${ch.playerCallMinRank}; ${leader.name} is rank ${gravitasRank(leader)}`);
  }
  const cost = ch.playerCallCost.denarii ?? 0;
  if (state.resources.denarii < cost) throw new Error('Not enough denarii');
  state.resources.denarii -= cost;
  callChallenge(state, playerFamily(state).id, state.round + 1);
}
