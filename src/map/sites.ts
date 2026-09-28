/**
 * Claiming and holding map sites (DESIGN §5.3). A claim is a council action
 * plus denarii; holding costs upkeep that rises with distance; defending it
 * draws on the militia pool, which is the point — §8.1 wants the player forced
 * to choose which sites get real protection.
 */
import type { GameState, ClaimedSite } from '../state/types';
import type { Cost, ResourceId } from '../data';
import { tribeDef } from '../data';
import { log } from '../state/store';
import { report } from '../state/reports';
import { distance, key as hexKey, parseKey, ring, within } from './grid';
import { generate, holdingTier, mapConfig, site } from './world';
import { playerHoldsOffice, requireOffice } from '../politics/challenge';
import { contestTurn, tribeHolds } from './contest';
import { isConnected } from './roads';

export function world(state: GameState) {
  return generate(state.map.seed);
}

export function siteAt(state: GameState, k: string): string | null {
  return world(state).sites[k] ?? null;
}

export function isScouted(state: GameState, k: string): boolean {
  return state.map.scouted.includes(k);
}

/** Whether the player knows what stands there: scouted, or seen from a held watchtower (§5.2). */
export function isKnown(state: GameState, k: string): boolean {
  return isScouted(state, k) || (state.map.seen ?? []).includes(k);
}

/** A treasure the scouts have carried home leaves nothing behind it. */
export function isSpentTreasure(state: GameState, k: string): boolean {
  const id = siteAt(state, k);
  return !!id && !!site(id).treasure && isScouted(state, k);
}

/**
 * Show every hex within `radius` of a held watchtower (§5.2): their sites are
 * known without a scout. What a scout would have fired — an ambush, a hoard
 * carried home — does not: the tower only looks.
 */
export function revealAround(state: GameState, k: string, radius: number): string[] {
  const at = parseKey(k);
  const shown: string[] = [];
  for (const h of within(mapConfig.radius)) {
    const hk = hexKey(h);
    if (hk === k || distance(h, at) > radius || isKnown(state, hk)) continue;
    state.map.seen.push(hk);
    shown.push(hk);
  }
  return shown;
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
  const seenId = (state.map.seen ?? []).includes(k) ? siteAt(state, k) : null;
  if ((state.map.seen ?? []).includes(k) && !(seenId && site(seenId).treasure)) {
    // The tower has already said what is there; only a hoard is worth the walk.
    throw new Error(seenId && site(seenId).hostile ? 'The tower has seen a war band there' : 'The tower has already seen it');
  }
  const cost = scoutCost();
  for (const [res, v] of Object.entries(cost)) {
    if (state.resources[res as ResourceId] < (v ?? 0)) throw new Error(`Not enough ${res}`);
  }
  for (const [res, v] of Object.entries(cost)) state.resources[res as ResourceId] -= v ?? 0;
  state.map.pendingScout = k;
  log(state, 'map', `Scouts set out toward ${k}.`);
}

/**
 * The closest mark on the map nobody has been to: a hex that holds a site and
 * is not yet scouted, nearest by ring, ties broken in the map's reading order
 * (north to south, west to east). Null once every mark has been seen. The
 * opening counsel points its scouts here; the rule is here so it is named.
 */
export function nearestUnknown(state: GameState): string | null {
  const w = world(state);
  let best: string | null = null;
  let bestRing = Infinity;
  for (const h of w.hexes) {
    const k = hexKey(h);
    if (!w.sites[k] || isKnown(state, k)) continue;
    const r = ring(h);
    if (r < bestRing) { best = k; bestRing = r; }
  }
  return best;
}

/** Resolves at the tribe's step of the next round, like an envoy. */
export function resolveScout(state: GameState): void {
  const k = state.map.pendingScout;
  if (!k) return;
  state.map.pendingScout = null;
  if (!state.map.scouted.includes(k)) state.map.scouted.push(k);

  const id = siteAt(state, k);
  // The scout report (reports unit): what stood there and what it cost, with
  // the prose line written by the same call.
  const popBefore = state.population;
  const base = { hex: k, ring: ringOf(k), siteId: id, hostile: false, casualties: 0, denarii: 0, fearShift: 0, scrolls: 0, claimable: false };
  if (!id) {
    report(state, 'scout', { ...base, population: { before: popBefore, after: state.population } }, `The scouts find nothing worth the walk at ${k}.`, 'map');
    return;
  }
  const def = site(id);
  if (def.hostile) {
    const sc = mapConfig.scout;
    const coin = state.resources.denarii;
    state.population = Math.max(1, state.population - sc.campCasualties);
    state.resources.denarii = Math.max(0, state.resources.denarii + sc.campDenarii);
    for (const t of Object.values(state.tribes)) t.fear = Math.max(0, Math.min(100, t.fear + sc.campFear));
    state.stats.scoutsLost += 1;
    report(state, 'scout', {
      ...base, hostile: true, casualties: popBefore - state.population, denarii: state.resources.denarii - coin, fearShift: sc.campFear,
      population: { before: popBefore, after: state.population },
    }, `${def.name} at ${k}: the scouts are ambushed. ${sc.campCasualties} men do not come back.`, 'map');
    return;
  }
  if (def.treasure) {
    // A "?" can be a hoard (§5.1): paid now, and nothing is left to hold.
    const coin = def.reward?.denarii ?? 0;
    state.resources.denarii += coin;
    report(state, 'scout', { ...base, denarii: coin, population: { before: popBefore, after: state.population } },
      `${def.name} at ${k}: the scouts carry home ${coin} denarii.`, 'map');
    return;
  }
  const claimable = playerHoldsOffice(state);
  report(state, 'scout', { ...base, claimable, population: { before: popBefore, after: state.population } }, `${def.name} at ${k}. ${def.description}`, 'map');
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
  requireOffice(state, 'A claim');
  if (!isKnown(state, k)) throw new Error('Nobody has been there');
  if (claimOf(state, k)) throw new Error('Already held');
  const id = siteAt(state, k);
  if (!id || isSpentTreasure(state, k)) throw new Error('Nothing there to claim');
  const def = site(id);
  if (def.hostile) throw new Error('That is a war band, not a holding');
  if (def.treasure) throw new Error('Send scouts for the hoard; there is nothing to hold');
  const theirs = tribeHolds(state, k);
  if (theirs) throw new Error(`${tribeDef(theirs.tribeId).name} took it first`);
  const cost = claimCost(k);
  for (const [res, v] of Object.entries(cost)) {
    if (state.resources[res as ResourceId] < (v ?? 0)) throw new Error(`Not enough ${res}`);
  }
  for (const [res, v] of Object.entries(cost)) state.resources[res as ResourceId] -= v ?? 0;
  state.map.claimed.push({ key: k, siteId: id, garrison: 0, claimedRound: state.round, tier: 1 });
  state.stats.sitesClaimed += 1;
  log(state, 'map', `The council claims ${def.name} at ${k}, ${ringOf(k)} rings out.`);
  holdTaken(state, k, id);
}

/** What a holding does the moment it is taken: a ruin pays once, a watchtower looks out (§5.2). */
export function holdTaken(state: GameState, k: string, id: string): void {
  const def = site(id);
  if (def.claimReward?.scrolls && !state.map.ruinsSpent.includes(k)) {
    state.map.ruinsSpent.push(k);
    state.rome.scrolls += def.claimReward.scrolls;
    log(state, 'map', `${def.name} at ${k} is searched: ${def.claimReward.scrolls} research scrolls. It will give nothing more.`);
  }
  if (def.revealRadius) {
    const shown = revealAround(state, k, def.revealRadius);
    if (shown.length) log(state, 'map', `From ${def.name} at ${k} the country shows for ${def.revealRadius} hexes round: ${shown.filter((h) => siteAt(state, h)).length} marks among ${shown.length} hexes.`);
  }
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

/** A garrison's men, and the holding's own works at its tier (§5.3). */
export function siteDefence(c: ClaimedSite): number {
  return c.garrison * mapConfig.hold.garrisonStrengthPerMan + holdingTier(c.tier ?? 1).defence;
}

/** Men the troop fields add to the militia pool, not drawn from the population (§5.2). */
export function troopFieldMen(state: GameState): number {
  let men = 0;
  for (const c of state.map.claimed) {
    const per = site(c.siteId).militiaPerTier;
    if (per) men += per[Math.max(1, Math.min(per.length, c.tier ?? 1)) - 1] ?? 0;
  }
  return men;
}

/** Whoever is strongest and not sworn to you is who comes for the far holdings. */
export function siteAggressor(state: GameState) {
  const hostile = Object.values(state.tribes).filter((t) => !t.allied);
  return hostile.sort((a, b) => b.strength - a.strength)[0] ?? null;
}

export function siteRaidChance(state: GameState, c: ClaimedSite): number {
  const h = mapConfig.hold;
  if (state.round < h.graceRounds) return 0;
  if (!siteAggressor(state)) return 0;
  const base = h.raidChanceBase + h.raidChancePerRing * ringOf(c.key);
  // a holding on the road is harder to reach unseen (§5.4)
  const road = isConnected(state, c.key) ? 1 - mapConfig.roads.exposureCut : 1;
  return Math.max(0, Math.min(0.9, base * road));
}

// ------------------------------------------------------------------ economics
export function claimedProduction(state: GameState): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const c of state.map.claimed) {
    const def = site(c.siteId);
    if (def.idle) continue; // a quarry with no stone worked yields nothing (§5.2)
    // the tier's multiplier, and the road's bonus if the holding is on the network (§5.4)
    const m = holdingTier(c.tier ?? 1).yieldMultiplier * (isConnected(state, c.key) ? 1 + mapConfig.roads.yieldBonus : 1);
    for (const [res, v] of Object.entries(def.produces ?? {})) {
      out[res as ResourceId] = (out[res as ResourceId] ?? 0) + (v ?? 0) * m;
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
/** Scouts report, upkeep is paid, and the contest over the holdings is decided and declared (§5.5). */
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

  // The far holdings' raids are the contest rule's now (map/contest.ts): declared
  // in one round, decided in a later one after the player's move.
  contestTurn(state);
  void hexKey;
}
