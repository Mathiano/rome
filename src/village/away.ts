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
}

export function takeSnapshot(state: GameState): AwaySnapshot {
  return {
    resources: { ...state.resources },
    population: state.population,
    slots: Object.fromEntries(state.slots.map((s) => [s.id, { building: s.building, tier: s.tier }])),
    research: [...state.research.completed],
    overflow: { ...(state.overflowSinceSeen ?? {}) },
  };
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
  return { resources, overflow: lost, raised, learned, citizens };
}

/** Nothing moved: the strip has nothing to say (the threshold is zero). */
export function isQuiet(r: AwayReport): boolean {
  return !Object.keys(r.resources).length && !Object.keys(r.overflow).length && !r.raised.length && !r.learned.length && r.citizens === 0;
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
  if (!seen) return null;
  if (now - seen.at < config.returnStrip.minGapMinutes * 60_000) return null;
  const r = awayReport(seen.snapshot, takeSnapshot(state));
  return isQuiet(r) ? null : r;
}
