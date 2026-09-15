import { config, unlocks, RESOURCE_IDS, activeTribe, type ResourceId } from '../data';
import type { GameState } from '../state/types';
import { log } from '../state/store';
import { buildingTier, hiddenPerResource } from '../village/storage';
import { homeMilitia } from './militia';
import { holderOf } from '../politics/posts';

export function defenceStrength(state: GameState): number {
  const r = config.raid;
  let d = buildingTier(state, 'castellum') * r.wallStrengthPerCastellumTier + homeMilitia(state) * r.militiaWeight;
  const g = holderOf(state, 'garrison');
  if (g) {
    const obstructed = (state.obstructed['defence'] ?? 0) > state.round;
    d += obstructed ? 0 : g.stats.discipline * r.garrisonDisciplineWeight;
  }
  for (const u of state.rome.unlocks) d += unlocks[u]?.defenceBonus ?? 0;
  return d;
}

export function raidStrength(state: GameState): number {
  const leaked = state.tribe.leakedUntilRound > state.round;
  return state.tribe.strength * activeTribe().raidAppetite * (leaked ? config.raid.leakedStrengthMultiplier : 1);
}

/** Probability the tribe raids this round. */
export function raidChance(state: GameState): number {
  const r = config.raid;
  const t = state.tribe;
  if (t.allied) return 0;
  if (t.hostagesUntilRound > state.round) return 0;
  if (state.round - t.lastRaidRound < r.minRoundsBetweenRaids) return 0;
  let p = r.baseChance + (100 - t.fear) * r.fearFactor - t.trust * r.trustFactor;
  if (t.leakedUntilRound > state.round) p += r.leakedChanceBonus;
  return Math.max(0, Math.min(1, p * activeTribe().raidAppetite));
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
}

export function resolveRaid(state: GameState): RaidResult {
  const raid = raidStrength(state);
  const defence = defenceStrength(state);
  const fraction = lossFraction(raid, defence);
  const hidden = hiddenPerResource(state);
  const lost: Partial<Record<ResourceId, number>> = {};
  for (const id of RESOURCE_IDS) {
    if (id === 'denarii') continue; // the treasury is not stores; raids take goods
    const exposed = Math.max(0, state.resources[id] - hidden);
    const take = Math.floor(exposed * fraction);
    if (take > 0) {
      state.resources[id] -= take;
      lost[id] = take;
    }
  }
  state.tribe.lastRaidRound = state.round;
  const name = activeTribe().name;
  if (fraction === 0) {
    state.tribe.fear = Math.min(100, state.tribe.fear + config.raid.fearGainOnRepulse);
    log(state, 'raid', `${name} raid the colony and are thrown back at the walls (${Math.round(raid)} against ${Math.round(defence)}).`);
  } else {
    state.tribe.fear = Math.max(0, state.tribe.fear - config.raid.fearLossOnSuccess);
    const summary = Object.entries(lost).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing they could find';
    log(state, 'raid', `${name} raid the colony (${Math.round(raid)} against ${Math.round(defence)}) and carry off ${summary}.`);
  }
  return { raid, defence, fraction, lost };
}
