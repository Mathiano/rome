/**
 * What the village clock did while the game was closed (DESIGN §3.1: accrual
 * runs offline, capped by storage per §4.2), told as amounts and never as a
 * duration. The gap `tick` already computes from `lastTick` is not printed:
 * §3.1 sanctions the time left on a job and the hours to the idle round, and
 * nothing else about the clock.
 *
 * Pure: a snapshot before the first tick and a snapshot after. The overflow
 * counter `accrue` keeps is part of each snapshot, so the report carries only
 * what the stores turned away during the gap, not what they turned away while
 * the player was watching. Words are the renderer's business (render/due.ts).
 */
import type { GameState, Resources } from '../state/types';
import { RESOURCE_IDS } from '../data';

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
