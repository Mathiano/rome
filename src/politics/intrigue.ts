import { config, tribeDef } from '../data';
import type { GameState } from '../state/types';
import { log } from '../state/store';
import { gainGravitas, gravitasRank, kill, leaderOf, livingMembers, playerFamily } from './characters';
import { chance } from '../state/rng';
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


// ----------------------------------------------------------------- the rest of §9.6
function playerLeader(state: GameState) {
  const l = leaderOf(state, playerFamily(state).id);
  if (!l) throw new Error('Your house has no head');
  return l;
}

function requireRank(state: GameState, minRank: number, what: string) {
  const l = playerLeader(state);
  if (gravitasRank(l) < minRank) {
    throw new Error(`${what} needs gravitas rank ${minRank}; ${l.name} is rank ${gravitasRank(l)}`);
  }
  return l;
}

function spend(state: GameState, denarii: number) {
  if (state.resources.denarii < denarii) throw new Error('Not enough denarii');
  state.resources.denarii -= denarii;
}

/** Put a house's skimming in front of the council. Corruption falls; they seethe. */
export function expose(state: GameState, familyId: string): void {
  const fam = state.families[familyId];
  if (!fam || fam.isPlayer) throw new Error('Expose which house?');
  const c = config.intrigue.expose;
  requireRank(state, c.minRank, 'An exposure');
  spend(state, c.cost);
  state.corruption = Math.max(config.corruption.min, state.corruption - c.corruptionDrop);
  fam.attitude = clampAtt(fam.attitude + c.attitude);
  fam.grievances += c.grievance;
  log(state, 'council', `The ${fam.name}'s accounts are read out in the forum. Corruption falls and so does their regard for you.`);
}

/** Send one man away for good. Expensive, and every house watches it happen. */
export function exile(state: GameState, characterId: string): void {
  const target = state.characters[characterId];
  if (!target?.alive) throw new Error('No such living character');
  const fam = state.families[target.familyId];
  if (fam.isPlayer) throw new Error('Exile your own? The council would enjoy that too much');
  const c = config.intrigue.exile;
  requireRank(state, c.minRank, 'An exile');
  spend(state, c.cost);
  target.exiled = true;
  target.alive = false;
  target.causeOfDeath = 'exiled from the colony';
  if (target.post) { state.posts[target.post] = null; target.post = null; }
  if (target.lesserPost) { state.lesserPosts[target.lesserPost] = null; target.lesserPost = null; }
  target.bodyguards = 0;
  fam.attitude = clampAtt(fam.attitude + c.attitude);
  fam.grievances += c.grievance;
  for (const other of Object.values(state.families)) {
    if (other.isPlayer || other.id === fam.id) continue;
    other.attitude = clampAtt(other.attitude + c.allAttitude);
  }
  state.stats.exiles += 1;
  log(state, 'council', `${target.name} is put out of the colony. The ${fam.name} will not forget it, and the others took note.`);
}

/** Write to Rome about a rival. Costs your own standing; Rome listens. */
export function denounce(state: GameState, familyId: string): void {
  const fam = state.families[familyId];
  if (!fam || fam.isPlayer) throw new Error('Denounce which house?');
  const c = config.intrigue.denounce;
  const leader = requireRank(state, c.minRank, 'A denunciation');
  if (leader.gravitasStock < c.gravitasCost) throw new Error('Not enough gravitas');
  leader.gravitasStock -= c.gravitasCost;
  state.rome.favour += c.romeFavour;
  fam.attitude = clampAtt(fam.attitude + c.attitude);
  fam.grievances += c.grievance;
  log(state, 'council', `A letter goes west about the ${fam.name}. Rome thanks you; they do not.`);
}

export function marriageCandidates(state: GameState, familyId: string) {
  const mine = livingMembers(state, playerFamily(state).id).filter((c) => !c.spouseId);
  const theirs = livingMembers(state, familyId).filter((c) => !c.spouseId);
  const pairs: { a: string; b: string; label: string }[] = [];
  for (const a of mine) {
    for (const b of theirs) {
      if (a.sex === b.sex) continue;
      pairs.push({ a: a.id, b: b.id, label: `${a.name} and ${b.name}` });
    }
  }
  return pairs;
}

/**
 * A marriage between houses (DESIGN §9.6). It binds the houses now; children
 * by birth wait on §15.7, which is still Mathias's to answer.
 */
export function marry(state: GameState, aId: string, bId: string): void {
  const a = state.characters[aId];
  const b = state.characters[bId];
  if (!a?.alive || !b?.alive) throw new Error('One of them is not available');
  if (a.sex === b.sex) throw new Error('Not a marriage Rome would record');
  if (a.spouseId || b.spouseId) throw new Error('Already married');
  if (a.familyId === b.familyId) throw new Error('Marry outside the house');
  const c = config.intrigue.marry;
  requireRank(state, c.minRank, 'A marriage');
  spend(state, c.cost);
  a.spouseId = b.id;
  b.spouseId = a.id;
  const other = state.families[a.familyId].isPlayer ? state.families[b.familyId] : state.families[a.familyId];
  other.attitude = clampAtt(other.attitude + c.attitude);
  other.grievances = Math.max(0, other.grievances - c.grievanceRelief);
  state.stats.marriages += 1;
  log(state, 'family', `${a.name} marries ${b.name}. The ${other.name} and your house are bound by more than the council now.`);
}

/** Marriage to a tribal noble, which moves that tribe rather than a house. */
export function marryTribe(state: GameState, characterId: string, tribeId: string): void {
  const who = state.characters[characterId];
  const t = state.tribes[tribeId];
  if (!who?.alive) throw new Error('No such living character');
  if (who.spouseId) throw new Error('Already married');
  if (!t) throw new Error('No such tribe');
  const c = config.intrigue.marry;
  requireRank(state, c.minRank, 'A marriage');
  spend(state, c.cost);
  who.spouseId = `tribe:${tribeId}`;
  t.trust = Math.min(100, t.trust + c.tribeTrust);
  state.stats.marriages += 1;
  log(state, 'family', `${who.name} marries into ${tribeDef(tribeId).name}. Their chiefs count you kin, for now.`);
}

export function assassinationChance(state: GameState, targetId: string): number {
  const c = config.intrigue.assassinate;
  const target = state.characters[targetId];
  const leader = leaderOf(state, playerFamily(state).id);
  if (!target || !leader) return 0;
  const skill = leader.stats.connections * c.connectionsWeight;
  const ward = target.bodyguards * config.bodyguard.blockPerGuard + target.stats.discipline * c.disciplineWeight;
  return Math.max(0.02, Math.min(0.95, c.baseChance + skill - ward));
}

/**
 * Assassination (DESIGN §9.6). It is in, the player can order it, bodyguards
 * block it, and it angers every house — not only the victim's.
 */
export function assassinate(state: GameState, targetId: string): boolean {
  const c = config.intrigue.assassinate;
  const target = state.characters[targetId];
  if (!target?.alive) throw new Error('No such living character');
  if (state.families[target.familyId].isPlayer) throw new Error('Not your own house');
  requireRank(state, c.minRank, 'An assassination');
  if (state.round - state.lastAssassinationRound < c.cooldownRounds) {
    throw new Error(`Too soon. The last one is still being talked about (round ${state.lastAssassinationRound + c.cooldownRounds})`);
  }
  spend(state, c.cost);
  state.lastAssassinationRound = state.round;
  state.stats.assassinationsOrdered += 1;

  const succeeded = chance(state, assassinationChance(state, targetId));
  const discovered = chance(state, c.discoveryChance);
  if (succeeded) {
    state.stats.assassinationsSucceeded += 1;
    kill(state, target, 'a knife in the dark');
  } else {
    log(state, 'council', `The attempt on ${target.name} fails. ${target.bodyguards ? 'His guards were awake.' : 'He was lucky.'}`);
  }
  for (const fam of Object.values(state.families)) {
    if (fam.isPlayer) continue;
    const own = fam.id === target.familyId ? 1.6 : 1;
    fam.attitude = clampAtt(fam.attitude + c.allAttitude * own + (discovered ? c.discoveredExtra : 0));
    fam.grievances += c.allGrievance;
  }
  log(state, 'council', discovered
    ? 'Everyone knows who paid for it. Every house in the colony is colder to you.'
    : 'Nobody can prove who paid for it, and every house has its suspicion.');
  void gainGravitas;
  return succeeded;
}

// ----------------------------------------------------------------- bodyguards
export function totalBodyguards(state: GameState): number {
  return Object.values(state.characters).reduce((n, c) => n + (c.alive ? c.bodyguards : 0), 0);
}

export function setBodyguards(state: GameState, characterId: string, men: number, available: number): void {
  const c = state.characters[characterId];
  if (!c?.alive) throw new Error('No such living character');
  if (!state.families[c.familyId].isPlayer) throw new Error('Guard your own house');
  const want = Math.max(0, Math.min(config.bodyguard.maxPerCharacter, Math.round(men)));
  const spare = available + c.bodyguards;
  if (want > spare) throw new Error(`Only ${spare} men to spare`);
  c.bodyguards = want;
}
