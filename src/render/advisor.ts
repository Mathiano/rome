/**
 * The opening counsel (DESIGN §12): an ordered line of steps in
 * data/advisor.json, the first unfinished one shown. Nothing about progress is
 * stored — every condition is read off the colony as it stands, so the counsel
 * can never disagree with the village. It reads state and changes nothing; the
 * player acts, the counsel only points (§3.2).
 */
import { advisor, type AdvisorCondition, type AdvisorStep, type ResourceId } from '../data';
import type { GameState, PlaytestStats } from '../state/types';
import { checkBuild } from '../village/construction';
import { buildingTier, capacity } from '../village/storage';
import { holderOf } from '../politics/posts';
import { nearestUnknown, scoutCost } from '../map/sites';

type Reader = (state: GameState, arg: never) => boolean;

/**
 * The condition vocabulary. Each word is backed by a reader that already
 * exists elsewhere; this table only names them for the data file.
 */
const READERS: Record<string, Reader> = {
  buildingTier: (s, a: { id: string; atLeast: number }) => buildingTier(s, a.id) >= a.atLeast,
  underWay: (s, a: { building: string }) => s.constructions.some((c) => c.buildingId === a.building),
  affordable: (s, a: { slot: string; building: string }) => checkBuild(s, a.slot, a.building).ok,
  roundAtLeast: (s, n: number) => s.round >= n,
  postHeld: (s, a: { postId: string; byPlayer?: boolean }) => {
    const h = holderOf(s, a.postId);
    if (!h) return false;
    return a.byPlayer ? s.families[h.familyId].isPlayer : true;
  },
  envoyOut: (s) => Object.values(s.tribes).some((t) => t.pendingEnvoy !== null),
  scoutOut: (s) => s.map.pendingScout !== null,
  scoutedAtLeast: (s, n: number) => s.map.scouted.length >= n,
  romeRequestOpen: (s) => s.rome.activeRequest !== null,
  /** Durable where romeRequestOpen is not: a request completed or declined stays counted. */
  romeAnswered: (s) => s.rome.completedIds.length + s.rome.declinedIds.length > 0,
  storeAtCap: (s, a: { resource: ResourceId }) => s.resources[a.resource] >= capacity(s, a.resource),
  researchStarted: (s) => s.research.active.length > 0 || s.research.completed.length > 0,
  statAtLeast: (s, a: { key: keyof PlaytestStats; n: number }) => s.stats[a.key] >= a.n,
};

export const CONDITION_WORDS = Object.keys(READERS);

/** True when the one word in `cond` holds. An unknown word is a data bug and throws. */
export function holds(state: GameState, cond: AdvisorCondition): boolean {
  const words = Object.keys(cond);
  if (words.length !== 1) throw new Error(`a counsel condition names one word, got ${words.length}`);
  const word = words[0];
  const reader = READERS[word];
  if (!reader) throw new Error(`unknown counsel condition ${word}`);
  return reader(state, cond[word] as never);
}

export function stepDone(state: GameState, step: AdvisorStep): boolean {
  return step.done.some((c) => holds(state, c));
}

/** The first step the colony has not met, dismissal ignored. */
export function nextStep(state: GameState): AdvisorStep | null {
  return advisor.steps.find((step) => !stepDone(state, step)) ?? null;
}

/** What the counsel says now, or nothing: the line is finished or was put away. */
export function currentAdvice(state: GameState): AdvisorStep | null {
  if (state.advisorDismissed) return null;
  return nextStep(state);
}

export interface Goto { tab: AdvisorStep['goto']['tab']; slot?: string; hex?: string }

/** Where the step points, with the map's named rule resolved against this colony. */
export function resolveGoto(state: GameState, step: AdvisorStep): Goto {
  const g = step.goto;
  const out: Goto = { tab: g.tab };
  if (g.slot) out.slot = g.slot;
  if (g.hex === 'nearestUnknown') {
    const hex = nearestUnknown(state);
    if (hex) out.hex = hex;
  }
  return out;
}

/**
 * Why the step's action cannot be taken yet, or null when it can. A shortfall
 * is stated in units — "40 more wood" — never as a time until affordable.
 */
export function blockedBy(state: GameState, step: AdvisorStep): string | null {
  const a = step.action;
  if (!a) return null;
  if (a.build) {
    const check = checkBuild(state, a.build.slot, a.build.building);
    if (check.ok) return null;
    if (check.reason !== 'Not enough resources') return check.reason ?? null;
    return shortfall(state, check.cost);
  }
  if (a.scout) {
    if (state.map.pendingScout) return null;
    if (!nearestUnknown(state)) return 'Every mark on the map has been seen';
    return shortfall(state, scoutCost());
  }
  return null;
}

function shortfall(state: GameState, cost: Partial<Record<ResourceId, number>>): string | null {
  const short = Object.entries(cost)
    .map(([k, v]) => [k, Math.ceil((v ?? 0) - state.resources[k as ResourceId])] as const)
    .filter(([, d]) => d > 0)
    .map(([k, d]) => `${d} more ${k}`);
  return short.length ? short.join(', ') : null;
}

/** The founding prose with its names filled in from the colony (never from the copy). */
export function foundingParagraphs(state: GameState, town: string): string[] {
  const fams = Object.values(state.families);
  const player = fams.find((f) => f.isPlayer);
  const rivals = fams.filter((f) => !f.isPlayer).map((f) => f.name);
  const houses = rivals.length > 1 ? `${rivals.slice(0, -1).join(', ')} and ${rivals[rivals.length - 1]}` : rivals.join('');
  return advisor.founding.paragraphs.map((p) => p
    .replace(/\{gens\}/g, player?.gensName ?? '')
    .replace(/\{houses\}/g, houses)
    .replace(/\{town\}/g, town));
}
