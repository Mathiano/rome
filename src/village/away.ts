/**
 * What the village clock did while the game was closed (DESIGN §3.1: accrual
 * runs offline, capped by storage per §4.2), told as amounts and never as a
 * duration. The gap `tick` already computes from `lastTick` is not printed:
 * §3.1 sanctions the time left on a job and nothing else about the clock.
 *
 * Pure: a snapshot before the first tick and a snapshot after. The overflow
 * counter `accrue` keeps is part of each snapshot, so the report carries only
 * what the stores turned away during the gap, not what they turned away while
 * the player was watching. Words are the renderer's business (render/due.ts).
 */
import type { GameState, Resources } from '../state/types';
import { config, RESOURCE_IDS } from '../data';

export interface AwaySnapshot {
  resources: Resources;
  population: number;
  slots: Record<string, { building: string | null; tier: number }>;
  research: string[];
  /** The `overflowSinceSeen` counter as it stood. */
  overflow: Partial<Resources>;
  /** Sites tribes held (§5.5), by hex. Absent in a snapshot taken before the contest rule. */
  tribeHeld?: string[];
}

export interface AwayReport {
  /** Rounded change per resource; only those that moved. */
  resources: Partial<Resources>;
  /** What full stores turned away, rounded; only those of a whole unit or more. */
  overflow: Partial<Resources>;
  /** Slots whose tier rose. */
  raised: { slotId: string; building: string; tier: number }[];
  /** Studies finished, by node id. */
  learned: string[];
  /** Whole citizens gained (or lost, negative). */
  citizens: number;
  /** Sites a tribe took first while the player was away (§5.5, §3.3: which opportunities have closed). */
  taken: { key: string; siteId: string; tribeId: string }[];
}

export function takeSnapshot(state: GameState): AwaySnapshot {
  return {
    resources: { ...state.resources },
    population: state.population,
    slots: Object.fromEntries(state.slots.map((s) => [s.id, { building: s.building, tier: s.tier }])),
    research: [...state.research.completed],
    overflow: { ...(state.overflowSinceSeen ?? {}) },
    tribeHeld: state.map.tribeHeld.map((t) => t.key),
  };
}

/**
 * The sites tribes took between two snapshots that the player knew of —
 * scouted, or seen from a tower. An unseen "?" taken is simply gone when the
 * scouts get there; there is nothing to name.
 */
export function sitesTaken(state: GameState, before: AwaySnapshot): AwayReport['taken'] {
  const had = new Set(before.tribeHeld ?? []);
  return state.map.tribeHeld
    .filter((t) => !had.has(t.key) && (state.map.scouted.includes(t.key) || state.map.seen.includes(t.key)))
    .map((t) => ({ key: t.key, siteId: t.siteId, tribeId: t.tribeId }));
}

export function awayReport(before: AwaySnapshot, after: AwaySnapshot): AwayReport {
  const resources: Partial<Resources> = {};
  for (const id of RESOURCE_IDS) {
    const d = Math.round(after.resources[id] - before.resources[id]);
    if (d !== 0) resources[id] = d;
  }
  const lost: Partial<Resources> = {};
  for (const id of RESOURCE_IDS) {
    const v = Math.round((after.overflow[id] ?? 0) - (before.overflow[id] ?? 0));
    if (v >= 1) lost[id] = v;
  }
  const raised: AwayReport['raised'] = [];
  for (const [slotId, now] of Object.entries(after.slots)) {
    const was = before.slots[slotId];
    if (now.building && now.tier > (was?.tier ?? 0)) raised.push({ slotId, building: now.building, tier: now.tier });
  }
  const learned = after.research.filter((id) => !before.research.includes(id));
  const citizens = Math.floor(after.population) - Math.floor(before.population);
  return { resources, overflow: lost, raised, learned, citizens, taken: [] };
}

/** Nothing moved: the strip has nothing to say (the threshold is zero). */
export function isQuiet(r: AwayReport): boolean {
  return !Object.keys(r.resources).length && !Object.keys(r.overflow).length && !r.raised.length && !r.learned.length && r.citizens === 0 && !(r.taken ?? []).length;
}

/**
 * When the player last saw the colony, and what it looked like then (Mathias,
 * 2026-09-25). Stamped when the strip is put away, and kept current while the
 * player is in the game with no strip up, so the next strip is anchored to
 * the last time they looked, not to the last tick or the last reload.
 */
export interface LastSeen {
  at: number;
  snapshot: AwaySnapshot;
}

export function markSeen(state: GameState, now: number): void {
  state.lastSeen = { at: now, snapshot: takeSnapshot(state) };
}

/**
 * On load, after the village clock has caught up: what changed since the
 * player last saw the colony — or nothing, if they looked less than
 * `config.returnStrip.minGapMinutes` ago. A reload a minute after putting the
 * strip away shows nothing.
 */
export function returnReport(state: GameState, now: number): AwayReport | null {
  const seen = state.lastSeen;
  if (!hasSeen(state) || !seen) return null;
  if (now - seen.at < config.returnStrip.minGapMinutes * 60_000) return null;
  const r = { ...awayReport(seen.snapshot, takeSnapshot(state)), taken: sitesTaken(state, seen.snapshot) };
  return isQuiet(r) ? null : r;
}

/** A stamp the strip can be anchored to: a real time and a snapshot, not zero, not missing. */
export function hasSeen(state: GameState): boolean {
  const seen = state.lastSeen;
  return !!seen && typeof seen.at === 'number' && Number.isFinite(seen.at) && seen.at > 0
    && !!seen.snapshot && typeof seen.snapshot === 'object' && !!seen.snapshot.resources;
}

/**
 * Opening a colony — a load from the browser or an import from a file — after
 * the village clock has caught up (Mathias, 2026-09-26). A save that carries a
 * stamp keeps it, so an export and import changes nothing about the strip. A
 * save without one (older than 2026-09-25, or damaged) is stamped now: it
 * defaults to the load time, never to zero, so it shows no strip this time.
 */
export function arrive(state: GameState, now: number): AwayReport | null {
  if (!hasSeen(state)) {
    markSeen(state, now);
    return null;
  }
  return returnReport(state, now);
}
