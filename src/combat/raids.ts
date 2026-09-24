import { config, unlocks, RESOURCE_IDS, tribeDef, type ResourceId } from '../data';
import type { DefenceBreakdown, GameState, GoodsLine, TribeState } from '../state/types';
import { report } from '../state/reports';
import { hiddenPerResource, sumEffect } from '../village/storage';
import { homeMilitia } from './militia';
import { holderOf, lesserEffect } from '../politics/posts';
import { kill } from '../politics/characters';
import { totalBodyguards } from '../politics/intrigue';
import { totalGarrisoned } from '../map/sites';
import { chance } from '../state/rng';
import type { Character } from '../state/types';

export function defenceStrength(state: GameState): number {
  const r = config.raid;
  // Before any wall is raised, a colonia sits behind its own ditch and bank.
  // Above that the walls term of DESIGN §8.2 is the wall building's tier, which
  // it carries as a `defence` effect in data/buildings.json. `sumEffect` folds
  // the Library's completed studies in with it.
  let d = r.baseDefence + sumEffect(state, 'defence') + homeMilitia(state) * r.militiaWeight;
  const g = holderOf(state, 'garrison');
  if (g) {
    const obstructed = (state.obstructed['defence'] ?? 0) > state.round;
    d += obstructed ? 0 : g.stats.discipline * r.garrisonDisciplineWeight;
  }
  for (const u of state.rome.unlocks) d += unlocks[u]?.defenceBonus ?? 0;
  d += lesserEffect(state, 'defence');
  return d;
}

/**
 * The same sum as `defenceStrength`, kept apart by term so a raid report can
 * name them (DESIGN §8.2: the ditch and bank, the wall, the home militia, the
 * garrison prefect's discipline; then Rome's engines and the lesser office).
 * Every multiplier is folded into its term's value — the report shows what
 * each contributed, never the tuning behind it. A test holds the parts to the
 * total; a new source of defence must be added here as well as there.
 */
export function defenceBreakdown(state: GameState): DefenceBreakdown {
  const r = config.raid;
  const home = homeMilitia(state);
  const g = holderOf(state, 'garrison');
  const obstructed = !!g && (state.obstructed['defence'] ?? 0) > state.round;
  let engines = 0;
  for (const u of state.rome.unlocks) engines += unlocks[u]?.defenceBonus ?? 0;
  const b = {
    ditch: r.baseDefence,
    wall: sumEffect(state, 'defence'),
    militia: home * r.militiaWeight,
    garrison: g && !obstructed ? g.stats.discipline * r.garrisonDisciplineWeight : 0,
    engines,
    lesser: lesserEffect(state, 'defence'),
  };
  return {
    ...b,
    total: b.ditch + b.wall + b.militia + b.garrison + b.engines + b.lesser,
    men: { home, garrisons: totalGarrisoned(state), bodyguards: totalBodyguards(state) },
    prefectId: g?.id ?? null,
    obstructed,
  };
}

export function raidStrength(state: GameState, t: TribeState): number {
  const leaked = t.leakedUntilRound > state.round;
  return t.strength * tribeDef(t.id).raidAppetite * (leaked ? config.raid.leakedStrengthMultiplier : 1);
}

/** Probability the tribe raids this round. */
export function raidChance(state: GameState, t: TribeState): number {
  const r = config.raid;
  if (t.allied) return 0;
  if (state.round < r.graceRounds) return 0;
  if (t.hostagesUntilRound > state.round) return 0;
  if (state.round - t.lastRaidRound < r.minRoundsBetweenRaids) return 0;
  let p = r.baseChance + (100 - t.fear) * r.fearFactor - t.trust * r.trustFactor;
  if (t.leakedUntilRound > state.round) p += r.leakedChanceBonus;
  return Math.max(0, Math.min(1, p * tribeDef(t.id).raidAppetite));
}

/** Loss fraction from strength against strength (DESIGN §8.2). 0 when defence >= raid. */
export function lossFraction(raid: number, defence: number): number {
  if (raid <= defence) return 0;
  const ratio = (raid - defence) / raid;
  return Math.min(config.raid.maxLossFraction, ratio * config.raid.maxLossFraction * 2);
}

export interface RaidResult {
  raid: number;
  defence: number;
  fraction: number;
  lost: Partial<Record<ResourceId, number>>;
  /** The garrison prefect, if a raid that got through killed him on the wall. */
  fell?: Character;
  /** The defence by its §8.2 terms, as it stood when the raid landed. */
  breakdown: DefenceBreakdown;
  /** Per resource: in store, hidden by the cellars, exposed, carried off. */
  goods: Partial<Record<ResourceId, GoodsLine>>;
  fear: { before: number; after: number };
}

/**
 * The garrison prefect's chance of dying when a raid gets through (DESIGN
 * §9.2: death by raid). He is the one man the fiction puts on the rampart.
 * Discipline eases it; bodyguards do not, since they stand over a man in his
 * house and not on the wall.
 */
export function holderDeathChance(prefect: Character): number {
  const r = config.raid;
  return Math.max(0, r.holderDeathChance * (1 - prefect.stats.discipline * r.holderDeathDisciplineRelief));
}

export function resolveRaid(state: GameState, t: TribeState): RaidResult {
  const raid = raidStrength(state, t);
  const breakdown = defenceBreakdown(state);
  const defence = defenceStrength(state);
  const fraction = lossFraction(raid, defence);
  const hidden = hiddenPerResource(state);
  const lost: Partial<Record<ResourceId, number>> = {};
  const goods: Partial<Record<ResourceId, GoodsLine>> = {};
  for (const id of RESOURCE_IDS) {
    if (id === 'denarii') continue; // the treasury is not stores; raids take goods
    const stored = state.resources[id];
    const exposed = Math.max(0, stored - hidden);
    const take = Math.floor(exposed * fraction);
    goods[id] = { stored, hidden: stored - exposed, exposed, lost: take };
    if (take > 0) {
      state.resources[id] -= take;
      lost[id] = take;
    }
  }
  t.lastRaidRound = state.round;
  state.stats.raidsSuffered += 1;
  state.stats.goodsLostToRaids += Object.values(lost).reduce((a, b) => a + b, 0);
  if (fraction === 0) state.stats.raidsRepelled += 1;
  const name = tribeDef(t.id).name;
  const fearBefore = t.fear;
  let text: string;
  let fell: Character | undefined;
  if (fraction === 0) {
    t.fear = Math.min(100, t.fear + config.raid.fearGainOnRepulse);
    text = `${name} raid the colony and are thrown back at the walls (${Math.round(raid)} against ${Math.round(defence)}).`;
  } else {
    t.fear = Math.max(0, t.fear - config.raid.fearLossOnSuccess);
    const summary = Object.entries(lost).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing they could find';
    text = `${name} raid the colony (${Math.round(raid)} against ${Math.round(defence)}) and carry off ${summary}.`;
    // A raid that reaches the stores has crossed the wall, and the prefect was on it.
    const prefect = holderOf(state, 'garrison');
    if (prefect && chance(state, holderDeathChance(prefect))) fell = prefect;
  }
  const fear = { before: fearBefore, after: t.fear };
  // The record is written by the same call as the line, so the two never drift.
  report(state, 'raid', { tribeId: t.id, raid, defence: breakdown, fraction, goods, fear, fellId: fell?.id ?? null }, text, 'raid');
  if (fell) kill(state, fell, `on the wall against the ${name}`);
  return { raid, defence, fraction, lost, fell, breakdown, goods, fear };
}
