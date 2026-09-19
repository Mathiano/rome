import { describe, it, expect } from 'vitest';
import { createInitialState, serialise, deserialise } from '../src/state/store';
import { Game } from '../src/game';
import { centre, corners, distance, key, neighbours, parseKey, ring, within } from '../src/map/grid';
import { generate, mapConfig, site } from '../src/map/world';
import {
  claimCost, claimOf, claimSite, claimedEffect, claimedProduction, dispatchScout, isScouted,
  mapTurn, releaseSite, resolveScout, setGarrison, siteAt, siteDefence, siteRaidChance,
  totalGarrisoned, upkeepPerRound,
} from '../src/map/sites';
import { homeMilitia, militiaPool } from '../src/combat/militia';
import { productionPerHour } from '../src/village/economy';

describe('hex grid', () => {
  it('rings, distance and neighbours agree', () => {
    expect(ring({ q: 0, r: 0 })).toBe(0);
    for (const n of neighbours({ q: 0, r: 0 })) expect(ring(n)).toBe(1);
    expect(distance({ q: 2, r: -1 }, { q: 0, r: 0 })).toBe(2);
    expect(key(parseKey('3,-2'))).toBe('3,-2');
  });
  it('covers exactly the hexes inside the radius', () => {
    for (const radius of [1, 3, 12]) {
      const hexes = within(radius);
      expect(hexes.length).toBe(1 + 3 * radius * (radius + 1));
      expect(hexes.every((h) => ring(h) <= radius)).toBe(true);
      expect(new Set(hexes.map(key)).size).toBe(hexes.length);
    }
  });
  it('lays hexes out without gaps or overlaps', () => {
    const size = 20;
    const c0 = centre({ q: 0, r: 0 }, size);
    for (const n of neighbours({ q: 0, r: 0 })) {
      const c = centre(n, size);
      const d = Math.hypot(c.x - c0.x, c.y - c0.y);
      expect(d).toBeCloseTo(size * Math.sqrt(3), 6); // touching, not overlapping
    }
    expect(corners({ q: 0, r: 0 }, size).split(' ')).toHaveLength(6);
  });
});

describe('world generation', () => {
  it('is deterministic and derived only from the map seed', () => {
    const a = generate(1234);
    const b = generate(1234);
    expect(a.terrain).toEqual(b.terrain);
    expect(a.sites).toEqual(b.sites);
    expect(generate(99).sites).not.toEqual(a.sites);
  });
  it('places the asked-for number of sites, none on the colony, each on terrain that suits it', () => {
    const w = generate(7);
    const keys = Object.keys(w.sites);
    expect(keys.length).toBe(mapConfig.siteCount);
    expect(w.sites['0,0']).toBeUndefined();
    for (const k of keys) {
      expect(ring(parseKey(k))).toBeGreaterThanOrEqual(mapConfig.minSiteDistance);
      const def = site(w.sites[k]);
      if (def.terrain) expect(def.terrain).toContain(w.terrain[k]);
    }
  });
  it('the colony stands on open ground', () => {
    expect(generate(42).terrain['0,0']).toBe('plain');
  });
  it('the save carries no terrain: only the seed and what the player did', () => {
    const s = createInitialState(0, 5);
    const json = serialise(s);
    expect(json).not.toContain('"terrain"');
    expect(deserialise(json).map.seed).toBe(s.map.seed);
  });
});

/** The first site of a kind in this world, for tests that need a known target. */
function findSite(s: ReturnType<typeof createInitialState>, pred: (id: string) => boolean): string {
  const w = generate(s.map.seed);
  const k = Object.keys(w.sites).find((x) => pred(w.sites[x]));
  if (!k) throw new Error('no such site in this world');
  return k;
}

describe('scouting', () => {
  it('is prepared now and reports at the next round', () => {
    const g = new Game(createInitialState(0, 5));
    const target = findSite(g.state, (id) => !site(id).hostile);
    g.state.resources.denarii = 500;
    g.scout(target, 1);
    expect(g.state.map.pendingScout).toBe(target);
    expect(isScouted(g.state, target)).toBe(false);
    expect(() => g.scout(target, 2)).toThrow(/already out/i);
    g.act({ type: 'convene' }, 3);
    expect(g.state.map.pendingScout).toBeNull();
    expect(isScouted(g.state, target)).toBe(true);
  });
  it('a camp punishes the scouting party', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 500;
    const camp = findSite(s, (id) => !!site(id).hostile);
    const pop = s.population;
    dispatchScout(s, camp);
    resolveScout(s);
    expect(s.population).toBe(pop - mapConfig.scout.campCasualties);
    expect(s.stats.scoutsLost).toBe(1);
    expect(isScouted(s, camp)).toBe(true);
  });
  it('ruins pay in scrolls', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 500;
    const ruins = findSite(s, (id) => id === 'ruins');
    dispatchScout(s, ruins);
    resolveScout(s);
    expect(s.rome.scrolls).toBe(1);
  });
  it('costs denarii and refuses what is out of reach or already known', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 500;
    const target = findSite(s, () => true);
    dispatchScout(s, target);
    expect(s.resources.denarii).toBe(500 - (mapConfig.scout.cost.denarii ?? 0));
    resolveScout(s);
    expect(() => dispatchScout(s, target)).toThrow(/already scouted/i);
    expect(() => dispatchScout(s, '99,99')).toThrow(/known country/i);
    s.resources.denarii = 0;
    const other = findSite(s, (id) => id !== siteAt(s, target));
    expect(() => dispatchScout(s, other)).toThrow(/not enough/i);
  });
});

describe('claiming and holding', () => {
  function held(seed = 5) {
    const s = createInitialState(0, seed);
    s.resources.denarii = 5000;
    const k = findSite(s, (id) => !!site(id).produces);
    dispatchScout(s, k);
    resolveScout(s);
    claimSite(s, k);
    return { s, k };
  }
  it('needs scouting first, costs more further out, and refuses a war band', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 5000;
    const k = findSite(s, (id) => !!site(id).produces);
    expect(() => claimSite(s, k)).toThrow(/nobody has been/i);
    dispatchScout(s, k);
    resolveScout(s);
    const near = claimCost('1,0');
    const far = claimCost('9,0');
    expect(far.denarii!).toBeGreaterThan(near.denarii!);
    claimSite(s, k);
    expect(claimOf(s, k)).toBeDefined();
    expect(() => claimSite(s, k)).toThrow(/already held/i);

    const camp = findSite(s, (id) => !!site(id).hostile);
    s.map.scouted.push(camp);
    expect(() => claimSite(s, camp)).toThrow(/war band/i);
  });
  it('a held site adds its yield to production', () => {
    const { s, k } = held();
    const def = site(siteAt(s, k)!);
    const res = Object.keys(def.produces!)[0] as 'wood';
    const withIt = productionPerHour(s)[res];
    releaseSite(s, k);
    expect(productionPerHour(s)[res]).toBeLessThan(withIt);
    expect(claimedProduction(s)).toEqual({});
  });
  it('garrisons draw on the militia pool and cannot exceed what is spare', () => {
    const { s, k } = held();
    const pool = militiaPool(s);
    expect(homeMilitia(s)).toBe(pool);
    setGarrison(s, k, 3, homeMilitia(s));
    expect(totalGarrisoned(s)).toBe(3);
    expect(homeMilitia(s)).toBe(pool - 3);
    expect(siteDefence(claimOf(s, k)!)).toBeCloseTo(3 * mapConfig.hold.garrisonStrengthPerMan);
    expect(() => setGarrison(s, k, 999, homeMilitia(s))).toThrow(/to spare/i);
    setGarrison(s, k, 0, homeMilitia(s));
    expect(homeMilitia(s)).toBe(pool);
  });
  it('upkeep is charged each round and an unpayable holding is abandoned', () => {
    const { s, k } = held();
    expect(upkeepPerRound(s)).toBeGreaterThan(0);
    const before = s.resources.denarii;
    s.round = 1;
    mapTurn(s);
    expect(s.resources.denarii).toBe(before - upkeepPerRound(s));
    s.resources.denarii = 0;
    mapTurn(s);
    expect(claimOf(s, k)).toBeUndefined();
  });
  it('exposure rises with distance and a garrison answers it', () => {
    const { s } = held();
    const near = { key: '2,0', siteId: 'timber', garrison: 0, claimedRound: 0 };
    const far = { key: '10,0', siteId: 'timber', garrison: 0, claimedRound: 0 };
    s.round = mapConfig.hold.graceRounds + 1;
    expect(siteRaidChance(s, far)).toBeGreaterThan(siteRaidChance(s, near));
    s.round = 0;
    expect(siteRaidChance(s, far)).toBe(0); // grace
  });
  it('an ungarrisoned holding is eventually overrun, a strong one is not', () => {
    const { s, k } = held(5);
    s.resources.denarii = 100000;
    s.round = mapConfig.hold.graceRounds + 1;
    s.tribe.strength = 200;
    for (let i = 0; i < 80 && claimOf(s, k); i++) { s.round += 1; mapTurn(s); }
    expect(claimOf(s, k)).toBeUndefined();
    expect(s.stats.sitesLost).toBeGreaterThan(0);

    const { s: s2, k: k2 } = held(5);
    s2.resources.denarii = 100000;
    s2.round = mapConfig.hold.graceRounds + 1;
    s2.tribe.strength = 10;
    s2.population = 400;
    setGarrison(s2, k2, mapConfig.claim.garrisonMax, homeMilitia(s2));
    for (let i = 0; i < 40; i++) { s2.round += 1; mapTurn(s2); }
    expect(claimOf(s2, k2)).toBeDefined();
  });
  it('a shrine or ford contributes its effect', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 5000;
    const shrine = findSite(s, (id) => id === 'shrine');
    dispatchScout(s, shrine);
    resolveScout(s);
    claimSite(s, shrine);
    expect(claimedEffect(s, 'gravitasPerRound')).toBe(1);
  });
});
