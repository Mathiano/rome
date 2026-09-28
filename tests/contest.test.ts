// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { Game } from '../src/game';
import { mapConfig, site } from '../src/map/world';
import { claimOf, claimSite, dispatchScout, resolveScout, siteDefence, world } from '../src/map/sites';
import { takeableSites, towerSees, tribeHolds, tribesTakeUnclaimed } from '../src/map/contest';
import { militiaPool, homeMilitia } from '../src/combat/militia';
import { totalGarrisoned } from '../src/map/sites';
import { totalBodyguards } from '../src/politics/intrigue';
import { tick } from '../src/village/clock';
import { markSeen, returnReport } from '../src/village/away';
import { awayLines } from '../src/render/due';
import { colonyWith, hexOf } from './helpers';
import type { GameState } from '../src/state/types';

const H = 3_600_000;
const WEEK = 7 * 24 * H;
const rich = (s: GameState) => { s.resources = { wood: 5000, clay: 5000, iron: 5000, grain: 5000, denarii: 50000 }; return s; };
function hold(s: GameState, id: string): string {
  const k = hexOf(s, id);
  dispatchScout(s, k); resolveScout(s); claimSite(s, k);
  return k;
}
const chanceWas = mapConfig.contest.tribeTakeChancePerHour;
afterEach(() => { mapConfig.contest.tribeTakeChancePerHour = chanceWas; });

describe('an unclaimed site may be taken by a tribe at any time, the player away or not (§5.5, §2.11)', () => {
  it('a simulated week away: tribes take unclaimed sites, up to their share, and no round runs', () => {
    mapConfig.contest.tribeTakeChancePerHour = 1;
    const s = rich(colonyWith('timber'));
    const mine = hold(s, 'timber');
    const round = s.round;
    tick(s, s.lastTick + WEEK);
    const cap = Math.floor(Object.keys(world(s).sites).length * mapConfig.contest.maxTribeHeldShare);
    expect(s.map.tribeHeld.length).toBe(cap);
    expect(s.round, 'nothing ran a round').toBe(round);
    // never a site the player holds, never a war band or a hoard
    expect(tribeHolds(s, mine)).toBeUndefined();
    for (const t of s.map.tribeHeld) {
      expect(claimOf(s, t.key)).toBeUndefined();
      expect(site(t.siteId).hostile || site(t.siteId).treasure).toBeFalsy();
    }
    // and one they took is no longer the player's to claim
    const theirs = s.map.tribeHeld[0];
    s.map.scouted.push(theirs.key);
    expect(() => claimSite(s, theirs.key)).toThrow(/took it first/);
  });

  it('happens by the hour, not by the tick: one long step and many short ones take the same sites', () => {
    const a = rich(colonyWith('timber'));
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    mapConfig.contest.tribeTakeChancePerHour = 0.2;
    tick(a, a.lastTick + 48 * H);
    const end = b.lastTick + 48 * H;
    for (let t = b.lastTick; t < end;) { t = Math.min(t + 17 * 60_000, end); tribesTakeUnclaimed(b, b.lastTick, t); b.lastTick = t; }
    expect(b.map.tribeHeld.map((x) => x.key)).toEqual(a.map.tribeHeld.map((x) => x.key));
    expect(a.map.tribeHeld.length).toBeGreaterThan(0);
  });

  it('tells the player on return which known sites closed while they were away', () => {
    mapConfig.contest.tribeTakeChancePerHour = 1;
    const s = rich(colonyWith('timber'));
    // the player has seen everything, so every taking is named
    s.map.scouted.push(...takeableSites(s));
    s.lastTick = 1_000_000; // a real moment; a stamp at 0 reads as never seen
    markSeen(s, s.lastTick);
    tick(s, s.lastTick + 3 * H);
    const r = returnReport(s, s.lastTick)!;
    expect(r.taken.length).toBe(3);
    expect(awayLines(r).filter((l) => /before the council could\.$/.test(l))).toHaveLength(3);
  });
});

describe('a held site changes hands only in a round the player is present for (§5.5, §2.11)', () => {
  function threatened(): { g: Game; k: string } {
    const g = new Game(rich(colonyWith('timber')));
    const k = hold(g.state, 'timber');
    g.state.map.threats.push({ key: k, tribeId: Object.keys(g.state.tribes)[0], declaredRound: g.state.round, resolveRound: g.state.round + 1, attack: 10 });
    return { g, k };
  }

  it('a simulated week away decides nothing: the holding stands and the threat waits', () => {
    const { g, k } = threatened();
    const round = g.state.round;
    g.tick(g.state.lastTick + WEEK);
    expect(g.state.round).toBe(round);
    expect(claimOf(g.state, k)).toBeDefined();
    expect(g.state.map.threats).toHaveLength(1);
  });

  it('is decided at the next round the player convenes: unguarded, it is lost', () => {
    const { g, k } = threatened();
    g.tick(g.state.lastTick + WEEK);
    g.act({ type: 'convene' }, g.state.lastTick + 1);
    expect(claimOf(g.state, k)).toBeUndefined();
    expect(g.state.map.threats.find((t) => t.key === k)).toBeUndefined();
  });

  it('the militia sent in that same round counts: the player moves first, then it is decided', () => {
    const { g, k } = threatened();
    g.tick(g.state.lastTick + WEEK);
    const men = Math.ceil(11 / mapConfig.hold.garrisonStrengthPerMan);
    expect(homeMilitia(g.state)).toBeGreaterThanOrEqual(men);
    g.act({ type: 'garrison', hex: k, men }, g.state.lastTick + 1);
    const c = claimOf(g.state, k)!;
    expect(c).toBeDefined();
    expect(siteDefence(c)).toBeGreaterThanOrEqual(10);
    expect(g.state.map.threats.find((t) => t.key === k)).toBeUndefined();
  });

  it('a move is declared in one round and never decided in that same round', () => {
    const g = new Game(rich(colonyWith('timber')));
    const k = hold(g.state, 'timber');
    g.state.round = mapConfig.hold.graceRounds + 1;
    const was = mapConfig.hold.raidChanceBase;
    mapConfig.hold.raidChanceBase = 1;
    try { g.act({ type: 'convene' }, 1); } finally { mapConfig.hold.raidChanceBase = was; }
    const t = g.state.map.threats.find((x) => x.key === k)!;
    expect(t).toBeDefined();
    expect(t.resolveRound).toBe(g.state.round + mapConfig.contest.noticeRounds);
    expect(claimOf(g.state, k)).toBeDefined();
  });

  it('a held watchtower in sight gives a round more warning, for a holding and for the colony', () => {
    const s = rich(colonyWith('watchtower'));
    const tower = hold(s, 'watchtower');
    const seen = s.map.seen.find((h) => world(s).sites[h] && !site(world(s).sites[h]).hostile && !site(world(s).sites[h]).treasure);
    if (seen) expect(towerSees(s, seen)).toBe(true);
    expect(towerSees(s, tower)).toBe(false); // a tower does not watch itself
    expect(towerSees(s, '0,0')).toBe(Math.max(...tower.split(',').map((n) => Math.abs(Number(n))), Math.abs(tower.split(',').map(Number).reduce((a, b) => a + b, 0))) <= site('watchtower').revealRadius!);
  });
});

describe('garrisons are drawn from the militia pool and never over-allocated (§5.5, §8.1)', () => {
  it('trims the farthest garrisons when the pool shrinks under them, at the end of the round', () => {
    const g = new Game(rich(colonyWith('timber')));
    const k = hold(g.state, 'timber');
    g.act({ type: 'garrison', hex: k, men: homeMilitia(g.state) }, 1);
    expect(totalGarrisoned(g.state)).toBeGreaterThan(0);
    // citizens lost: the pool falls under what is committed
    g.state.population = 4;
    g.act({ type: 'convene' }, 2);
    expect(totalGarrisoned(g.state) + totalBodyguards(g.state)).toBeLessThanOrEqual(militiaPool(g.state));
  });

  it('refuses to send more than are spare', () => {
    const g = new Game(rich(colonyWith('timber')));
    const k = hold(g.state, 'timber');
    expect(() => g.act({ type: 'garrison', hex: k, men: homeMilitia(g.state) + 1 }, 1)).toThrow(/to spare/);
  });
});
