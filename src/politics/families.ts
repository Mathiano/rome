import { config, post as postDef, posts as postDefs } from '../data';
import type { GameState, Family } from '../state/types';
import { chance, pick } from '../state/rng';
import { log } from '../state/store';
import { isDangerous, postsHeldBy } from './posts';

/** A rival family's step (DESIGN §3.2 step 2, §9.4): leverage if unhappy and in post; otherwise pass. */
export function rivalTurn(state: GameState, fam: Family): void {
  const held = postsHeldBy(state, fam.id);
  const unhappy = fam.attitude <= config.posts.unhappyThreshold;
  if (!unhappy || held.length === 0) return;
  const dangerous = isDangerous(state, fam.id);
  const actChance = config.leverage.actChance * (dangerous ? 1.5 : 1);
  if (!chance(state, actChance)) return;
  const options: ('obstruct' | 'skim' | 'leak')[] = ['obstruct', 'skim', 'leak'];
  const action = pick(state, options);
  const postId = pick(state, held);
  const domain = postDef(postId).domain;
  switch (action) {
    case 'obstruct':
      state.obstructed[domain] = state.round + 1 + (dangerous ? 1 : 0);
      log(state, 'council', `The ${fam.name} drag their feet: the ${postDef(postId).name} obstructs the ${domain}.`);
      break;
    case 'skim':
      state.corruption = Math.min(config.corruption.max, state.corruption + config.leverage.skimCorruption * (dangerous ? 1.5 : 1));
      log(state, 'council', `Denarii go missing under the ${fam.name}'s ${postDef(postId).name}. Corruption rises.`);
      break;
    case 'leak':
      state.tribe.leakedUntilRound = state.round + config.leverage.leakRounds;
      log(state, 'council', `Word of the size of your stores reaches the tribes. The ${fam.name} deny everything.`);
      break;
  }
}

export function vacantPosts(state: GameState): string[] {
  return postDefs.filter((p) => !state.posts[p.id]).map((p) => p.id);
}
