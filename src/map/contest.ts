/**
 * The contest rule (DESIGN §5.5, which follows from §2.11: absence costs
 * opportunity, never assets).
 *
 * - An **unclaimed** site may be taken by a tribe at any time, including while
 *   the player is away. That is a missed opportunity and is permitted: it runs
 *   on the village clock, an hourly chance, never through a round.
 * - A site the player **holds** changes hands only in a round the player is
 *   present for. A tribe's move against it is declared in one round and decided
 *   in a later one — after the player's own move in that round, so the militia
 *   can be sent first. No round runs unattended (§3.3), so a holding is never
 *   lost while the player is away.
 */
import { tribeDef } from '../data';
import type { ClaimedSite, GameState, HoldingThreat } from '../state/types';
import { log } from '../state/store';
import { report } from '../state/reports';
import { chance, nextRandom } from '../state/rng';
import { distance, parseKey } from './grid';
import { claimOf, siteAggressor, siteDefence, siteRaidChance, world } from './sites';
import { mapConfig, site } from './world';

const H = 3_600_000;

/**
 * The clock's own dice, one throw per (hour, purpose): drawn from the map seed
 * and the hour's index, never from the game's RNG. The rounds' randomness is
 * not disturbed by how long the player was away, and the same hour always
 * throws the same, however often the clock is called across it.
 */
function hourRoll(mapSeed: number, hour: number, salt: number): number {
  let t = (mapSeed ^ Math.imul(hour, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) | 0;
  t = (t + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function tribeHolds(state: GameState, k: string) {
  return state.map.tribeHeld.find((t) => t.key === k);
}

/** Sites a tribe could take: any site worth holding that nobody holds yet. */
export function takeableSites(state: GameState): string[] {
  const w = world(state);
  return Object.keys(w.sites).filter((k) => {
    const def = site(w.sites[k]);
    return !def.hostile && !def.treasure && !claimOf(state, k) && !tribeHolds(state, k);
  }).sort();
}

/**
 * The village clock's share of the contest: for every whole real hour crossed
 * between `from` and `to`, a chance that one tribe takes one unclaimed site,
 * until tribes hold their share of the map. Hour boundaries, not ticks, so the
 * odds do not depend on how often the clock is called.
 */
export function tribesTakeUnclaimed(state: GameState, from: number, to: number): void {
  const c = mapConfig.contest;
  const first = Math.floor(from / H) + 1;
  const last = Math.floor(to / H);
  if (last < first) return;
  const siteCount = Object.keys(world(state).sites).length;
  const takers = Object.values(state.tribes).filter((t) => !t.allied).sort((a, b) => a.id.localeCompare(b.id));
  if (!takers.length) return;
  // A very long absence is bounded: sixty days of hours is far past the cap.
  for (let hour = Math.max(first, last - 24 * 60); hour <= last; hour++) {
    if (state.map.tribeHeld.length >= Math.floor(siteCount * c.maxTribeHeldShare)) return;
    if (hourRoll(state.map.seed, hour, 1) >= c.tribeTakeChancePerHour) continue;
    const open = takeableSites(state);
    if (!open.length) return;
    const k = open[Math.floor(hourRoll(state.map.seed, hour, 2) * open.length)];
    const t = takers[Math.floor(hourRoll(state.map.seed, hour, 3) * takers.length)];
    const id = world(state).sites[k];
    const at = hour * H;
    state.map.tribeHeld.push({ key: k, siteId: id, tribeId: t.id, at });
    // Named only if the player knew what stood there; an unseen "?" is simply gone when scouted.
    const known = state.map.scouted.includes(k) || state.map.seen.includes(k);
    if (known) log(state, 'map', `${tribeDef(t.id).name} have taken the ${site(id).name.toLowerCase()} at ${k} before the council could.`);
  }
}

/** A held watchtower that sees this hex gives a round's more warning (§5.2). */
export function towerSees(state: GameState, k: string): boolean {
  const at = parseKey(k);
  return state.map.claimed.some((c) => {
    const r = site(c.siteId).revealRadius;
    return !!r && c.key !== k && distance(parseKey(c.key), at) <= r;
  });
}

export function threatAgainst(state: GameState, k: string): HoldingThreat | undefined {
  return state.map.threats.find((t) => t.key === k);
}

/**
 * The round's share (step 3, beside the tribes'): moves already declared are
 * decided with the garrison as it stands now — the player's move this round has
 * been applied — and new moves are declared against holdings that are exposed.
 */
export function contestTurn(state: GameState): void {
  decideThreats(state);
  declareThreats(state);
}

function decideThreats(state: GameState): void {
  const due = state.map.threats.filter((t) => t.resolveRound <= state.round);
  state.map.threats = state.map.threats.filter((t) => t.resolveRound > state.round);
  for (const t of due) {
    const c = claimOf(state, t.key);
    if (!c) continue; // given up since: nothing to decide
    const tribe = state.tribes[t.tribeId];
    const name = site(c.siteId).name;
    const def = siteDefence(c);
    const held = def >= t.attack;
    const fearBefore = tribe?.fear ?? 0;
    let text: string;
    if (held) {
      if (tribe) tribe.fear = Math.min(100, tribe.fear + 3);
      state.stats.siteRaidsRepelled += 1;
      text = `${tribeDef(t.tribeId).name} come against ${name} at ${t.key} and are driven off.`;
    } else {
      state.map.claimed = state.map.claimed.filter((x) => x.key !== c.key);
      state.stats.sitesLost += 1;
      text = `${tribeDef(t.tribeId).name} overrun ${name} at ${t.key}. ${c.garrison} men are lost and the holding with them.`;
    }
    report(state, 'site_raid', {
      tribeId: t.tribeId, siteId: c.siteId, hex: t.key, garrison: c.garrison, defence: def, attack: t.attack, held,
      menLost: held ? 0 : c.garrison, fear: { before: fearBefore, after: tribe?.fear ?? 0 },
    }, text, 'raid');
  }
}

function declareThreats(state: GameState): void {
  const aggressor = siteAggressor(state);
  if (!aggressor) return;
  const c = mapConfig.contest;
  const share = mapConfig.hold.tribeShareAgainstSite;
  for (const h of state.map.claimed as ClaimedSite[]) {
    if (threatAgainst(state, h.key)) continue;
    if (!chance(state, siteRaidChance(state, h))) continue;
    const attack = Math.round(aggressor.strength * share * (0.75 + nextRandom(state) * 0.5));
    const warn = c.noticeRounds + (towerSees(state, h.key) ? c.watchtowerExtraRounds : 0);
    state.map.threats.push({ key: h.key, tribeId: aggressor.id, declaredRound: state.round, resolveRound: state.round + warn, attack });
    log(state, 'raid', `${tribeDef(aggressor.id).name} are moving on ${site(h.siteId).name} at ${h.key}: about ${attack} against its ${Math.round(siteDefence(h))}. It will be decided ${warn > 1 ? `in ${warn} rounds` : 'when the council next meets'}; men sent before then will count.`);
  }
}
