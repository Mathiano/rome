import { config, post as postDef, posts as postDefs } from '../data';
import type { GameState, Family, Demand } from '../state/types';
import { chance, pick } from '../state/rng';
import { log } from '../state/store';
import { clampAtt, isDangerous, postsHeldBy } from './posts';
import { gravitasRank, livingMembers } from './characters';

/**
 * A rival house's step (DESIGN §3.2 step 2, §9.4). It pursues its own ends: it
 * asks for what it wants, it remembers being refused, and what it does with a
 * post it holds gets worse the longer the grievance list runs.
 */
export function rivalTurn(state: GameState, fam: Family): void {
  // A house that has just been ignored does not ask again in the same breath.
  if (!expireDemand(state, fam)) maybeDemand(state, fam);
  useLeverage(state, fam);
}

/** An unanswered demand is a refusal, and is remembered as one. */
function expireDemand(state: GameState, fam: Family): boolean {
  const d = fam.demand;
  if (!d || state.round < d.dueRound) return false;
  fam.demand = null;
  fam.grievances += 1;
  fam.attitude = clampAtt(fam.attitude + config.rival.ignoreAttitude);
  log(state, 'council', `The ${fam.name} waited on your answer and got none. They will not ask again.`);
  return true;
}

function maybeDemand(state: GameState, fam: Family): void {
  const r = config.rival;
  if (fam.demand || fam.attitude > r.demandAttitudeCeiling) return;
  if (state.round < r.postDemandMinRound) return;
  if (!chance(state, r.demandChancePerRound)) return;

  const held = new Set(postsHeldBy(state, fam.id));
  const wanted = postDefs.filter((p) => !held.has(p.id) && livingMembers(state, fam.id).some((c) => gravitasRank(c) >= p.minRank));
  let demand: Demand;
  if (wanted.length && chance(state, 0.65)) {
    const p = pick(state, wanted);
    demand = { kind: 'post', postId: p.id, issuedRound: state.round, dueRound: state.round + r.demandDueRounds };
    log(state, 'council', `The ${fam.name} want the post of ${p.name}. They expect an answer within ${r.demandDueRounds} rounds.`);
  } else {
    const amount = Math.round(r.denariiDemandBase + r.denariiDemandPerRound * state.round);
    demand = { kind: 'denarii', denarii: amount, issuedRound: state.round, dueRound: state.round + r.demandDueRounds };
    log(state, 'council', `The ${fam.name} ask ${amount} denarii toward their house. They expect an answer within ${r.demandDueRounds} rounds.`);
  }
  fam.demand = demand;
}

function useLeverage(state: GameState, fam: Family): void {
  const held = postsHeldBy(state, fam.id);
  const unhappy = fam.attitude <= config.posts.unhappyThreshold;
  const r = config.rival;

  // With enough grievances a house stops obstructing and goes to Rome (§9.7).
  if (fam.grievances >= r.grievanceDenounceThreshold && !fam.denounced && unhappy) {
    fam.denounced = true;
    state.rome.favour += r.denounceFavour;
    state.corruption = Math.min(config.corruption.max, state.corruption + r.denounceCorruption);
    log(state, 'council', `The ${fam.name} have written to Rome about your conduct. The legate's reply is cool.`);
    return;
  }
  if (!unhappy || held.length === 0) return;

  const dangerous = isDangerous(state, fam.id);
  const actChance = Math.min(0.95, config.leverage.actChance * (dangerous ? 1.5 : 1) + fam.grievances * r.grievanceLeverageStep);
  if (!chance(state, actChance)) return;

  const action = pick(state, ['obstruct', 'skim', 'leak'] as const);
  const postId = pick(state, held);
  const domain = postDef(postId).domain;
  const bite = 1 + fam.grievances * 0.3;
  switch (action) {
    case 'obstruct':
      state.obstructed[domain] = state.round + 1 + (dangerous ? 1 : 0);
      log(state, 'council', `The ${fam.name} drag their feet: the ${postDef(postId).name} obstructs the ${domain}.`);
      break;
    case 'skim':
      state.corruption = Math.min(config.corruption.max,
        state.corruption + config.leverage.skimCorruption * (dangerous ? 1.5 : 1) * bite);
      log(state, 'council', `Denarii go missing under the ${fam.name}'s ${postDef(postId).name}. Corruption rises.`);
      break;
    case 'leak':
      state.tribe.leakedUntilRound = state.round + config.leverage.leakRounds;
      log(state, 'council', `Word of the size of your stores reaches the tribes. The ${fam.name} deny everything.`);
      break;
  }
}

/** The player yields to a demand. Costs what was asked; buys real goodwill. */
export function acceptDemand(state: GameState, familyId: string): void {
  const fam = state.families[familyId];
  const d = fam?.demand;
  if (!d) throw new Error('They have asked for nothing');
  if (d.kind === 'denarii') {
    if (state.resources.denarii < (d.denarii ?? 0)) throw new Error('Not enough denarii');
    state.resources.denarii -= d.denarii ?? 0;
    log(state, 'council', `You send ${d.denarii} denarii to the ${fam.name}.`);
  } else {
    const p = postDef(d.postId!);
    const candidates = livingMembers(state, fam.id).filter((c) => gravitasRank(c) >= p.minRank && !c.post);
    const who = candidates.sort((a, b) => b.stats[p.stat] - a.stats[p.stat])[0]
      ?? livingMembers(state, fam.id).find((c) => gravitasRank(c) >= p.minRank);
    if (!who) throw new Error('They have nobody fit to hold it');
    const prev = state.posts[d.postId!];
    if (prev) {
      state.characters[prev].post = null;
      state.posts[d.postId!] = null;
    }
    if (who.post) state.posts[who.post] = null;
    state.posts[d.postId!] = who.id;
    who.post = d.postId!;
    log(state, 'council', `${who.name} of the ${fam.name} takes the post of ${p.name}, as they asked.`);
  }
  fam.demand = null;
  state.stats.demandsGranted += 1;
  fam.grievances = Math.max(0, fam.grievances - 1);
  fam.attitude = clampAtt(fam.attitude + config.rival.acceptAttitude);
}

export function refuseDemand(state: GameState, familyId: string): void {
  const fam = state.families[familyId];
  if (!fam?.demand) throw new Error('They have asked for nothing');
  fam.demand = null;
  fam.grievances += 1;
  state.stats.demandsRefused += 1;
  fam.attitude = clampAtt(fam.attitude + config.rival.refuseAttitude);
  log(state, 'council', `You refuse the ${fam.name}. It is noted.`);
}

export function vacantPosts(state: GameState): string[] {
  return postDefs.filter((p) => !state.posts[p.id]).map((p) => p.id);
}
