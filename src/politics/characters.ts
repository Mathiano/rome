import { config, newMen, STAT_IDS, type StatId } from '../data';
import type { GameState, Character, Family } from '../state/types';
import { chance, nextRandom, pick } from '../state/rng';
import { log } from '../state/store';

export function livingMembers(state: GameState, familyId: string): Character[] {
  return state.families[familyId].memberIds.map((id) => state.characters[id]).filter((c) => c.alive);
}

export function leaderOf(state: GameState, familyId: string): Character | null {
  return livingMembers(state, familyId).find((c) => c.isLeader) ?? null;
}

export function playerFamily(state: GameState): Family {
  return Object.values(state.families).find((f) => f.isPlayer)!;
}

export function rivalFamilies(state: GameState): Family[] {
  return Object.values(state.families).filter((f) => !f.isPlayer);
}

/** Gravitas rank from cumulative gravitas via data thresholds. */
export function gravitasRank(c: Character): number {
  const t = config.gravitas.rankThresholds;
  let rank = 0;
  for (let i = 0; i < t.length; i++) if (c.gravitas >= t[i]) rank = i;
  return rank;
}

/** Family standing = sum of members' gravitas (DESIGN §9.1). */
export function standing(state: GameState, familyId: string): number {
  return livingMembers(state, familyId).reduce((s, c) => s + c.gravitas, 0);
}

export function gainGravitas(c: Character, amount: number): void {
  c.gravitas += amount;
  c.gravitasStock += amount;
}

/** Death probability per round: 0 below roundsMin, ramping linearly to 1 at roundsMax. */
export function deathChance(age: number): number {
  const { roundsMin, roundsMax } = config.lifespan;
  if (age < roundsMin) return 0;
  if (age >= roundsMax) return 1;
  return (age - roundsMin) / (roundsMax - roundsMin);
}

export function kill(state: GameState, c: Character, cause: string): void {
  c.alive = false;
  c.causeOfDeath = cause;
  if (c.post) {
    state.posts[c.post] = null;
    c.post = null;
  }
  if (c.lesserPost) {
    state.lesserPosts[c.lesserPost] = null;
    c.lesserPost = null;
  }
  c.bodyguards = 0;
  state.stats.deaths += 1;
  log(state, 'family', `${c.name} of the ${state.families[c.familyId].name} dies: ${cause}.`);
  if (c.isLeader) succeed(state, c.familyId);
  if (state.office === c.id) state.office = leaderOf(state, c.familyId)?.id ?? null;
}

/** Ages every living character one round and rolls natural death (DESIGN §9.2). */
export function ageAll(state: GameState): void {
  for (const c of Object.values(state.characters)) {
    if (!c.alive) continue;
    c.age += 1;
    if (chance(state, deathChance(c.age))) kill(state, c, 'old age');
  }
}

/** The eldest living member leads. With none, a new man is raised (Pillar 7). */
export function succeed(state: GameState, familyId: string): void {
  for (const c of livingMembers(state, familyId)) c.isLeader = false;
  const living = livingMembers(state, familyId).sort((a, b) => b.age - a.age);
  let heir = living[0];
  if (!heir) heir = raiseNewMan(state, familyId);
  heir.isLeader = true;
  log(state, 'family', `${heir.name} now leads the ${state.families[familyId].name}.`);
}

export function raiseNewMan(state: GameState, familyId: string): Character {
  const fam = state.families[familyId];
  const praenomen = pick(state, newMen.praenomina);
  const cognomen = pick(state, newMen.cognomina);
  const origin = pick(state, newMen.origins);
  const nomen = fam.gensName.replace('gens ', '').replace(/a$/, 'us');
  const stats = Object.fromEntries(STAT_IDS.map((s) => [s, 2 + Math.floor(nextRandom(state) * 5)])) as Record<StatId, number>;
  const c: Character = {
    id: `${familyId}_nm_${state.round}_${Math.floor(nextRandom(state) * 1e6)}`,
    name: `${praenomen} ${nomen} ${cognomen}`,
    familyId,
    sex: 'm',
    age: 25 + Math.floor(nextRandom(state) * 15),
    alive: true,
    isLeader: false,
    stats,
    gravitas: 0,
    gravitasStock: 0,
    post: null,
    lesserPost: null,
    bodyguards: 0,
  };
  state.characters[c.id] = c;
  fam.memberIds.push(c.id);
  log(state, 'family', `${c.name}, ${origin}, is raised into the ${fam.name}.`);
  return c;
}
