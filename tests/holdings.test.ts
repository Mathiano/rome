// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Game } from '../src/game';
import { within } from '../src/map/grid';
import { generate, holdingTier, mapConfig, site } from '../src/map/world';
import {
  claimSite, claimedEffect, claimedProduction, dispatchScout, isKnown, isSpentTreasure, resolveScout, siteDefence, troopFieldMen,
} from '../src/map/sites';
import { checkHoldingWork, holdingRushPrice, rushHoldingWork, startHoldingWork } from '../src/map/holdings';
import { militiaPool } from '../src/combat/militia';
import { tick } from '../src/village/clock';
import { outputValuePerHour } from '../src/village/economy';
import { createMapView } from '../src/render/mapview';
import { renderPanel } from '../src/render/panel';
import { colonyWith, hexOf } from './helpers';
import type { GameState } from '../src/state/types';

const H = 3_600_000;
const rich = (s: GameState) => { s.resources = { wood: 5000, clay: 5000, iron: 5000, grain: 5000, denarii: 5000 }; return s; };
/** Scout a hex and let the report come in, as the next round would. */
function scout(s: GameState, k: string) { dispatchScout(s, k); resolveScout(s); }
function hold(s: GameState, id: string): string {
  const k = hexOf(s, id);
  scout(s, k);
  claimSite(s, k);
  return k;
}

describe('the map (DESIGN §5.1)', () => {
  it('is 21 hexes across', () => {
    expect(mapConfig.radius * 2 + 1).toBe(21);
    expect(generate(1).hexes).toHaveLength(within(10).length);
  });

  it('shows terrain from the start and a "?" where something stands unseen, nothing where nothing does', () => {
    const s = colonyWith('timber');
    const view = createMapView(() => {});
    view.update(s, null);
    const w = generate(s.map.seed);
    const marks = view.root.querySelectorAll('text.unknown');
    expect(marks.length).toBe(Object.keys(w.sites).length);
    // every hex carries its terrain class, known or not
    expect(view.root.querySelectorAll('polygon.ground[class*="t-"]').length).toBe(w.hexes.length);
    // nothing on the map is a painted image (§5.3: holdings are drawn in SVG)
    expect(view.root.querySelector('image')).toBeNull();
  });

  it('has every site kind of §5.2', () => {
    const ids = mapConfig.sites.map((x) => x.id);
    for (const id of ['timber', 'clay_bank', 'iron_seam', 'meadow', 'quarry', 'salt_spring', 'troop_field', 'watchtower', 'ford', 'shrine', 'ruins', 'treasure', 'camp']) {
      expect(ids, id).toContain(id);
    }
    expect(site('timber').name).toBe('Forest');
    expect(site('meadow').name).toBe('Farmland');
  });
});

describe('what a "?" turns out to be (§5.1)', () => {
  it('a hoard is carried home and leaves nothing to hold', () => {
    const s = rich(colonyWith('treasure'));
    const k = hexOf(s, 'treasure');
    const coin = s.resources.denarii;
    scout(s, k);
    expect(s.resources.denarii).toBe(coin - (mapConfig.scout.cost.denarii ?? 0) + site('treasure').reward!.denarii!);
    expect(isSpentTreasure(s, k)).toBe(true);
    expect(() => claimSite(s, k)).toThrow(/Nothing there/);
  });

  it('a site is left to be claimed, and a camp punishes the scouts', () => {
    const s = rich(colonyWith('camp'));
    const camp = hexOf(s, 'camp');
    const pop = s.population;
    scout(s, camp);
    expect(s.population).toBe(pop - mapConfig.scout.campCasualties);
    expect(() => claimSite(s, camp)).toThrow(/war band/);
  });
});

describe('the kinds that are not a yield (§5.2)', () => {
  it('a troop field adds men to the pool without taking them from the people, more at each tier', () => {
    const s = rich(colonyWith('troop_field'));
    const pool = militiaPool(s);
    const pop = s.population;
    const k = hold(s, 'troop_field');
    const per = site('troop_field').militiaPerTier!;
    expect(troopFieldMen(s)).toBe(per[0]);
    expect(militiaPool(s)).toBe(pool + per[0]);
    expect(s.population).toBe(pop);
    s.map.claimed.find((c) => c.key === k)!.tier = 3;
    expect(militiaPool(s)).toBe(pool + per[2]);
  });

  it('a watchtower shows the country round it: seen without a scout, and a seen war band is never walked into', () => {
    const s = rich(colonyWith('watchtower'));
    const k = hold(s, 'watchtower');
    const r = site('watchtower').revealRadius!;
    expect(isKnown(s, k)).toBe(true);
    expect(s.map.seen.length).toBeGreaterThan(0);
    const w = generate(s.map.seed);
    for (const h of s.map.seen) expect(isKnown(s, h)).toBe(true);
    const seenCamp = s.map.seen.find((h) => w.sites[h] === 'camp');
    if (seenCamp) expect(() => dispatchScout(s, seenCamp)).toThrow(/war band/);
    const seenSite = s.map.seen.find((h) => w.sites[h] && !site(w.sites[h]).hostile && !site(w.sites[h]).treasure);
    if (seenSite) expect(() => claimSite(s, seenSite)).not.toThrow();
    expect(r).toBeGreaterThan(0);
  });

  it('a quarry and a salt spring can be held and yield nothing until their resource exists', () => {
    for (const id of ['quarry', 'salt_spring']) {
      const s = rich(colonyWith(id));
      hold(s, id);
      expect(site(id).idle, id).toBeTruthy();
      expect(claimedProduction(s), id).toEqual({});
    }
  });

  it('a shrine gives gravitas and a ford sharpens the trade rate', () => {
    const s = rich(colonyWith('ford'));
    hold(s, 'ford');
    expect(claimedEffect(s, 'tradeRate')).toBe(site('ford').effect!.tradeRate);
    const t = rich(colonyWith('shrine'));
    hold(t, 'shrine');
    expect(claimedEffect(t, 'gravitasPerRound')).toBe(site('shrine').effect!.gravitasPerRound);
  });
});

describe('holding tiers: camp, station, fort (§5.3)', () => {
  it('starts as a camp and rises in place on the village clock, one holding at a time', () => {
    const s = rich(colonyWith('timber'));
    const k = hold(s, 'timber');
    const c = s.map.claimed.find((x) => x.key === k)!;
    expect(c.tier).toBe(1);
    const yieldCamp = claimedProduction(s).wood!;
    const defCamp = siteDefence(c);
    const w = startHoldingWork(s, k, 0);
    expect(w.toTier).toBe(2);
    expect(checkHoldingWork(s, k).reason).toBe('Already rising');
    tick(s, w.finishAt - 1);
    expect(c.tier).toBe(1);
    tick(s, w.finishAt);
    expect(c.tier).toBe(2);
    expect(claimedProduction(s).wood).toBe(yieldCamp * holdingTier(2).yieldMultiplier);
    expect(siteDefence(c)).toBe(defCamp + holdingTier(2).defence - holdingTier(1).defence);
  });

  it('is its own lane: a building and a field can rise beside it', () => {
    const g = new Game(rich(colonyWith('timber')));
    const k = hold(g.state, 'timber');
    g.raiseHolding(k, 0);
    expect(() => g.build('wood2', 'lumber_camp', 0)).not.toThrow();
    expect(g.state.constructions).toHaveLength(1);
    expect(g.state.map.works).not.toBeNull();
  });

  it('can be finished early for denarii, never above what the colony earns in the time left (Pillar 3)', () => {
    const s = rich(colonyWith('timber'));
    const k = hold(s, 'timber');
    const w = startHoldingWork(s, k, 0);
    const price = holdingRushPrice(s, 0);
    expect(price).toBeLessThanOrEqual(Math.max(1, Math.ceil(outputValuePerHour(s) * (w.finishAt / H))) + 1);
    rushHoldingWork(s, 0);
    expect(s.map.claimed.find((x) => x.key === k)!.tier).toBe(2);
  });

  it('draws each tier in SVG on the map: a mark, a walled mark, a walled mark with a tower', () => {
    const s = rich(colonyWith('timber'));
    const k = hold(s, 'timber');
    const view = createMapView(() => {});
    const c = s.map.claimed.find((x) => x.key === k)!;
    for (const t of [1, 2, 3]) {
      c.tier = t;
      view.update(s, null);
      const mark = view.root.querySelector(`[data-hex="${k}"] .holding`)!;
      expect(mark.classList.contains(`tier-${t}`)).toBe(true);
      expect(mark.querySelectorAll('.h-wall').length).toBe(t >= 2 ? 1 : 0);
      expect(mark.querySelectorAll('.h-tower').length).toBe(t >= 3 ? 1 : 0);
    }
  });

  it('shows the tier, what the next one gives and the lane on the country panel', () => {
    const g = new Game(rich(colonyWith('timber')));
    const k = hold(g.state, 'timber');
    let html = renderPanel(g, 'map', k, 0);
    expect(html).toContain(`data-raise-holding="${k}"`);
    expect(html).toMatch(/Station: yield ×1\.5, defence 8/);
    g.raiseHolding(k, 0);
    html = renderPanel(g, 'map', k, 60_000);
    expect(html).toContain('data-lane="holding"');
    expect(html).toContain('data-rush-holding');
  });
});
