import { config, post as postDef, posts as postDefs } from '../data';
import { chance } from '../state/rng';
import type { GameState } from '../state/types';
import { log } from '../state/store';
import { gravitasRank, livingMembers, playerFamily, rivalFamilies } from './characters';

export function holderOf(state: GameState, postId: string) {
  const id = state.posts[postId];
  return id ? state.characters[id] : null;
}

export function postsHeldBy(state: GameState, familyId: string): string[] {
  return postDefs.filter((p) => holderOf(state, p.id)?.familyId === familyId).map((p) => p.id);
}

/** Gravitas rank a character must hold to take a post (DESIGN §9.2). */
export function meetsRank(state: GameState, postId: string, characterId: string): boolean {
  const c = state.characters[characterId];
  const p = postDef(postId);
  return !!c && c.alive && gravitasRank(c) >= p.minRank;
}

export function appoint(state: GameState, postId: string, characterId: string): void {
  const c = state.characters[characterId];
  if (!c || !c.alive) throw new Error('No such living character');
  const def = postDef(postId);
  if (gravitasRank(c) < def.minRank) {
    throw new Error(`${def.name} needs gravitas rank ${def.minRank}; ${c.name} is rank ${gravitasRank(c)}`);
  }
  if (c.post) state.posts[c.post] = null;
  const prev = holderOf(state, postId);
  if (prev) {
    prev.post = null;
    if (prev.familyId !== c.familyId && !state.families[prev.familyId].isPlayer) {
      state.families[prev.familyId].attitude = clampAtt(state.families[prev.familyId].attitude + config.posts.attitudeShiftOnDismiss);
    }
  }
  state.posts[postId] = characterId;
  c.post = postId;
  // Appointment effect (DESIGN §9.3): that family's standing rises via gravitas; the others' attitude shifts.
  c.gravitas += config.posts.standingShiftOnAppoint / 4;
  c.gravitasStock += config.posts.standingShiftOnAppoint / 4;
  const fam = state.families[c.familyId];
  if (!fam.isPlayer) fam.attitude = clampAtt(fam.attitude + config.posts.attitudeShiftOnAppoint);
  log(state, 'council', `${c.name} is appointed ${postDef(postId).name}.`);
}

export function dismiss(state: GameState, postId: string): void {
  const prev = holderOf(state, postId);
  if (!prev) throw new Error('Post is vacant');
  prev.post = null;
  state.posts[postId] = null;
  const fam = state.families[prev.familyId];
  if (!fam.isPlayer) fam.attitude = clampAtt(fam.attitude + config.posts.attitudeShiftOnDismiss);
  log(state, 'council', `${prev.name} is dismissed as ${postDef(postId).name}.`);
}

export function clampAtt(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

/** Rival families without posts grow angry; with posts they mellow (DESIGN §9.3). */
export function driftAttitudes(state: GameState): void {
  for (const f of rivalFamilies(state)) {
    const n = postsHeldBy(state, f.id).length;
    f.attitude = clampAtt(f.attitude + (n === 0 ? config.posts.attitudeDriftNoPosts : config.posts.attitudeDriftWithPosts));
  }
}

export function isDangerous(state: GameState, familyId: string): boolean {
  return postsHeldBy(state, familyId).length >= config.posts.dangerousPostCount;
}

/** Corruption (DESIGN §9.4): one colony-wide meter. */
export function updateCorruption(state: GameState): void {
  const c = config.corruption;
  let delta = 0;
  for (const f of rivalFamilies(state)) {
    const held = postsHeldBy(state, f.id).length;
    const disregard = Math.max(0, -f.attitude) * c.attitudeWeight; // 0 when attitude >= 0
    delta += held * c.risePerRivalPost * (0.5 + disregard);
    if (f.attitude > 0) delta -= c.fallWhenRivalContent;
  }
  const treasurer = holderOf(state, 'treasury');
  if (treasurer && treasurer.familyId === playerFamily(state).id) {
    delta -= c.fallWhenPlayerTreasury + treasurer.stats.discipline * c.fallPerTreasurerDiscipline;
  }
  state.corruption = Math.max(c.min, Math.min(c.max, state.corruption + delta));
}

/** Post-holders and office-holders gain gravitas each round scaled by authority. */
export function accrueGravitas(state: GameState, forumGravitas: number): void {
  for (const p of postDefs) {
    const h = holderOf(state, p.id);
    if (!h) continue;
    const gain = config.gravitas.gainPerRoundInPost * (1 + h.stats.authority * config.gravitas.authorityWeight);
    h.gravitas += gain;
    h.gravitasStock += gain;
    // Holding a post teaches its trade (DESIGN §9.2).
    if (h.stats[p.stat] < config.levelling.statMax && chance(state, config.levelling.chancePerRoundInPost)) {
      h.stats[p.stat] += 1;
      log(state, 'family', `${h.name} grows abler as ${p.name}: ${p.stat} ${h.stats[p.stat]}.`);
    }
  }
  if (state.office) {
    const o = state.characters[state.office];
    if (o?.alive) {
      const gain = (config.gravitas.gainForOffice + forumGravitas) * (1 + o.stats.authority * config.gravitas.authorityWeight);
      o.gravitas += gain;
      o.gravitasStock += gain;
      if (o.stats.authority < config.levelling.statMax && chance(state, config.levelling.officeAuthorityChance)) {
        o.stats.authority += 1;
        log(state, 'family', `${o.name} grows in authority: ${o.stats.authority}.`);
      }
    }
  }
}

export function candidatesFor(state: GameState, familyId: string) {
  return livingMembers(state, familyId);
}
