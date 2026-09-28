/**
 * World generation (DESIGN §5). Terrain and site placement are a pure function
 * of the colony's map seed, so the save records only what the player has done:
 * where scouts have been, what is claimed, and who garrisons it. The seed is
 * separate from the game RNG, which advances every round.
 */
import mapJson from '../../data/map.json';
import { key, ring, within, type Hex } from './grid';

export interface TerrainDef { id: string; name: string; weight: number }
export interface SiteDef {
  id: string;
  name: string;
  weight: number;
  terrain?: string[];
  hostile?: boolean;
  produces?: Record<string, number>;
  effect?: Record<string, number>;
  /** Paid when the scouts reach it (a treasure). */
  reward?: Record<string, number>;
  /** Paid once, when it is first held (a ruin, §5.2). */
  claimReward?: Record<string, number>;
  /** Claimable but idle until this resource exists (§4.1: a quarry waits for stone). */
  idle?: string;
  /** A one-time find the scouts carry home, leaving nothing to hold. */
  treasure?: boolean;
  /** Men added to the militia pool at each tier, not drawn from the population (§5.2, troop field). */
  militiaPerTier?: number[];
  /** Hexes within this distance are shown once it is held (§5.2, watchtower). */
  revealRadius?: number;
  /** Rounds an envoy's road is shortened while it is held (§5.2, ford). */
  envoyRoundsSaved?: number;
  description: string;
}
export interface HoldingTierDef { name: string; yieldMultiplier: number; defence: number; cost?: Record<string, number>; buildSeconds?: number }

export const mapConfig = mapJson as unknown as {
  radius: number;
  hexSize: number;
  siteCount: number;
  minSiteDistance: number;
  terrain: TerrainDef[];
  sites: SiteDef[];
  scout: { cost: Record<string, number>; campCasualties: number; campFear: number; campDenarii: number };
  claim: { costBase: Record<string, number>; costPerRing: Record<string, number>; upkeepPerRound: number; upkeepPerRing: number; garrisonMax: number };
  hold: { raidChanceBase: number; raidChancePerRing: number; garrisonStrengthPerMan: number; tribeShareAgainstSite: number; graceRounds: number };
  tiers: { list: HoldingTierDef[] };
  contest: { tribeTakeChancePerHour: number; maxTribeHeldShare: number; noticeRounds: number; watchtowerExtraRounds: number };
};

/** A holding tier's definition: 1 camp, 2 station, 3 fort (§5.3). */
export function holdingTier(tier: number): HoldingTierDef {
  const list = mapConfig.tiers.list;
  return list[Math.max(1, Math.min(list.length, tier)) - 1];
}

export function site(id: string): SiteDef {
  const s = mapConfig.sites.find((x) => x.id === id);
  if (!s) throw new Error(`unknown site ${id}`);
  return s;
}

/** A local PRNG so generation never disturbs the game's own seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T extends { weight: number }>(rand: () => number, arr: T[]): T {
  let r = rand() * arr.reduce((s, a) => s + a.weight, 0);
  for (const a of arr) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return arr[arr.length - 1];
}

export interface World {
  hexes: Hex[];
  terrain: Record<string, string>;
  sites: Record<string, string>;
}

const cache = new Map<number, World>();

export function generate(mapSeed: number): World {
  const hit = cache.get(mapSeed);
  if (hit) return hit;

  const rand = rng(mapSeed);
  const hexes = within(mapConfig.radius);
  const terrain: Record<string, string> = {};

  // Terrain in patches rather than noise: often inherit a neighbour's terrain so
  // forests and marshes read as regions instead of confetti.
  for (const h of hexes) {
    const near = [{ q: h.q - 1, r: h.r }, { q: h.q, r: h.r - 1 }]
      .map((n) => terrain[key(n)])
      .filter(Boolean);
    terrain[key(h)] = near.length && rand() < 0.55
      ? near[Math.floor(rand() * near.length)]
      : weighted(rand, mapConfig.terrain).id;
  }
  terrain[key({ q: 0, r: 0 })] = 'plain'; // the colonia's own ground

  const sites: Record<string, string> = {};
  const candidates = hexes.filter((h) => ring(h) >= mapConfig.minSiteDistance);
  let placed = 0;
  let guard = 0;
  while (placed < mapConfig.siteCount && guard++ < mapConfig.siteCount * 60) {
    const h = candidates[Math.floor(rand() * candidates.length)];
    const k = key(h);
    if (sites[k]) continue;
    const fits = mapConfig.sites.filter((s) => !s.terrain || s.terrain.includes(terrain[k]));
    if (!fits.length) continue;
    sites[k] = weighted(rand, fits).id;
    placed += 1;
  }

  const world = { hexes, terrain, sites };
  cache.set(mapSeed, world);
  return world;
}
