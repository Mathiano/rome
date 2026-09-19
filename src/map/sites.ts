/**
 * Claiming and holding map sites (DESIGN §5.3). A claim is a council action
 * plus denarii; holding costs upkeep that rises with distance; defending it
 * draws on the militia pool, which is the point — §8.1 wants the player forced
 * to choose which sites get real protection.
 */
import type { GameState, ClaimedSite } from '../state/types';
import type { Cost, ResourceId } from '../data';
import { config, activeTribe } from '../data';
import { log } from '../state/store';
import { chance, nextRandom } from '../state/rng';
import { key as hexKey, parseKey, ring } from './grid';
import { generate, mapConfig, site } from './world';

export function world(state: GameState) {
  return generate(state.map.seed);
}

export function siteAt(state: GameState, k: string): string | null {
  return world(state).sites[k] ?? null;
}

export function isScouted(state: GameState, k: string): boolean {
  return state.map.scouted.includes(k);
}

export function claimOf(state: GameState, k: string): ClaimedSite | undefined {
  return state.map.claimed.find((c) => c.key === k);
}

export function ringOf(k: string): number {
  return ring(parseKey(k));
}

// ------------------------------------------------------------------ scouting
export function scoutCost(): Cost {
  return mapConfig.scout.cost as Cost;
}

export function dispatchScout(state: GameState, k: string): void {
  if (state.map.pendingScout) throw new Error('Scouts are already out');
  if (ringOf(k) > mapConfig.radius) throw new Error('Beyond the known country');
  if (isScouted(state, k)) throw new Error('Already scouted');
  const cost = scoutCost();
  for (const [res, v] of Object.entries(cost)) {
    if (state.resources[res as ResourceId] < (v ?? 0)) throw new Error(`Not enough ${res}`);
  }
  for (const [res, v] of Object.entries(cost)) state.resources[res as ResourceId] -= v ?? 0;
  state.map.pendingScout = k;
  log(state, 'map', `Scouts set out toward ${k}.`);
}

/** Resolves at the tribe's step of the next round, like an envoy. */
export function resolveScout(state: GameState): void {
  const k = state.map.pendingScout;
  if (!k) return;
  state.map.pendingScout = null;
  if (!state.map.scouted.includes(k)) state.map.scouted.push(k);

  const id = siteAt(state, k);
  if (!id) {
    log(state, 'map', `The scouts find nothing worth the walk at ${k}.`);
    return;
  }
  const def = site(id);
  if (def.hostile) {
    const sc = mapConfig.scout;
    state.population = Math.max(1, state.population - sc.campCasualties);
    state.resources.denarii = Math.max(0, state.resources.denarii + sc.campDenarii);
    state.tribe.fear = Math.max(0, Math.min(100, state.tribe.fear + sc.campFear));
    state.stats.scoutsLost += 1;
    log(state, 'map', `${def.name} at ${k}: the scouts are ambushed. ${sc.campCasualties} men do not come back.`);
    return;
  }
  if (def.reward?.scrolls) {
    state.rome.scrolls += def.reward.scrolls;
    log(state, 'map', `${def.name} at ${k}: the scouts bring back ${def.reward.scrolls} research scroll(s).`);
    return;
  }
  log(state, 'map', `${def.name} at ${k}. ${def.description}`);
}

// ------------------------------------------------------------------ claiming
export function claimCost(k: string): Cost {
  const c = mapConfig.claim;
  const r = ringOf(k);
  const out: Cost = {};
  for (const [res, v] of Object.entries(c.costBase)) out[res as ResourceId] = (v ?? 0);
  for (const [res, v] of Object.entries(c.costPerRing)) {
    out[res as ResourceId] = (out[res as ResourceId] ?? 0) + (v ?? 0) * r;
  }
  return out;
}

export function claimSite(state: GameState, k: string): void {
  if (!isScouted(state, k)) throw new Error('Nobody has been there');
  if (claimOf(state, k)) throw new Error('Already held');
  const id = siteAt(state, k);
  if (!id) throw new Error('Nothing there to claim');
  const def = site(id);
  if (def.hostile) throw new Error('That is a war band, not a holding');
  const cost = claimCost(k);
  for (const [res, v] of Object.entries(cost)) {
    if (state.resources[res as ResourceId] < (v ?? 0)) throw new Error(`Not enough ${res}`);
  }
  for (const [res, v] of Object.entries(cost)) state.resources[res as ResourceId] -= v ?? 0;
  state.map.claimed.push({ key: k, siteId: id, garrison: 0, claimedRound: state.round });
  state.stats.sitesClaimed += 1;
  log(state, 'map', `The council claims ${def.name} at ${k}, ${ringOf(k)} rings out.`);
}

export function releaseSite(state: GameState, k: string): void {
  const c = claimOf(state, k);
  if (!c) throw new Error('Not held');
  state.map.claimed = state.map.claimed.filter((x) => x.key !== k);
  log(state, 'map', `${site(c.siteId).name} at ${k} is given up.`);
}

// ----------------------------------------------------------------- garrisons
export function totalGarrisoned(state: GameState): number {
  return state.map.claimed.reduce((n, c) => n + c.garrison, 0);
}

export function setGarrison(state: GameState, k: string, n: number, available: number): void {
  const c = claimOf(state, k);
  if (!c) throw new Error('Not held');
  const want = Math.max(0, Math.min(mapConfig.claim.garrisonMax, Math.round(n)));
  const spare = available + c.garrison;
  if (want > spare) throw new Error(`Only ${spare} men to spare`);
  c.garrison = want;
}

export function siteDefence(c: ClaimedSite): number {
  return c.garrison * mapConfig.hold.garrisonStrengthPerMan;
}

export function siteRaidChance(state: GameState, c: ClaimedSite): number {
  const h = mapConfig.hold;
  if (state.round < h.graceRounds) return 0;
  if (state.tribe.allied) return 0;
  return Math.max(0, Math.min(0.9, h.raidChanceBase + h.raidChancePerRing * ringOf(c.key)));
}

// ------------------------------------------------------------------ economics
export function claimedProduction(state: GameState): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const c of state.map.claimed) {
    const def = site(c.siteId);
    for (const [res, v] of Object.entries(def.produces ?? {})) {
      out[res as ResourceId] = (out[res as ResourceId] ?? 0) + (v ?? 0);
    }
  }
  return out;
}

export function claimedEffect(state: GameState, name: string): number {
  let total = 0;
  for (const c of state.map.claimed) {
    total += site(c.siteId).effect?.[name] ?? 0;
  }
  return total;
}

export function upkeepPerRound(state: GameState): number {
  const c = mapConfig.claim;
  return state.map.claimed.reduce((n, s) => n + c.upkeepPerRound + c.upkeepPerRing * ringOf(s.key), 0);
}

// ---------------------------------------------------------------- round step
/** Scouts report, upkeep is paid, and the far holdings take their chances. */
export function mapTurn(state: GameState): void {
  resolveScout(state);

  const upkeep = upkeepPerRound(state);
  if (upkeep > 0) {
    if (state.resources.denarii >= upkeep) {
      state.resources.denarii -= upkeep;
    } else {
      const given = state.map.claimed[state.map.claimed.length - 1];
      state.resources.denarii = 0;
      if (given) {
        state.map.claimed.pop();
        log(state, 'map', `There is nothing to pay the men at ${site(given.siteId).name}. The holding is abandoned.`);
      }
    }
  }

  const tribeStrength = state.tribe.strength * mapConfig.hold.tribeShareAgainstSite;
  for (const c of [...state.map.claimed]) {
    if (!chance(state, siteRaidChance(state, c))) continue;
    const def = siteDefence(c);
    const attack = tribeStrength * (0.75 + nextRandom(state) * 0.5);
    const name = site(c.siteId).name;
    if (def >= attack) {
      log(state, 'raid', `${activeTribe().name} test the garrison at ${name} and are driven off.`);
      state.tribe.fear = Math.min(100, state.tribe.fear + config.raid.fearGainOnRepulse / 2);
      state.stats.siteRaidsRepelled += 1;
    } else {
      state.map.claimed = state.map.claimed.filter((x) => x.key !== c.key);
      state.stats.sitesLost += 1;
      log(state, 'raid', `${activeTribe().name} overrun ${name} at ${c.key}. ${c.garrison} men are lost and the holding with them.`);
    }
  }
  void hexKey;
}
