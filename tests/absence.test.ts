import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { config, RESOURCE_IDS } from '../src/data';
import { createDevClock, type StorageLike } from '../src/dev';
import { pendingNews } from '../src/render/panel';
import type { GameState } from '../src/state/types';

/**
 * No round runs unattended (DESIGN §3.2, §3.3 as ruled 2026-09-25). Rounds
 * advance only when the player acts; time — real, or the dev clock's — moves
 * the village alone.
 */
const H = 3_600_000;
const T0 = 1_000_000;

/** Everything a round would move: its number, every age and life, the houses, the tribes, Rome, the log. */
function politics(s: GameState) {
  return {
    round: s.round,
    ages: Object.fromEntries(Object.values(s.characters).map((c) => [c.id, c.age])),
    alive: Object.values(s.characters).filter((c) => c.alive).length,
    families: Object.fromEntries(Object.values(s.families).map((f) => [f.id, { attitude: f.attitude, demand: f.demand, sour: f.sourRounds }])),
    tribes: Object.fromEntries(Object.values(s.tribes).map((t) => [t.id ?? '', { fear: t.fear, trust: t.trust, massing: t.massingForRound }])),
    rome: { favour: s.rome.favour, request: s.rome.activeRequestId },
    office: s.office,
    politicalLines: s.log.filter((e) => e.kind !== 'village').length,
    history: s.history.length,
  };
}

/** A colony with some play in it, saved as the tab closes. */
function played(seed: number): string {
  const g = new Game(createInitialState(T0, seed));
  g.act({ type: 'convene' }, T0 + 1000);
  g.act({ type: 'convene' }, T0 + 2000);
  // read, as a player closing the tab would have
  g.state.seenLogId = g.state.logSeq;
  g.state.seenOpening = true;
  return serialise(g.state);
}

describe('a week away', () => {
  it('a save loaded a week later is at the same round with every age unchanged, and the village has worked', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const json = played(seed);
      const before = deserialise(json);
      const g = new Game(deserialise(json));
      g.tick(before.lastTick + 7 * 24 * H); // what main.ts does on load
      expect(politics(g.state), `seed ${seed}`).toEqual(politics(before));
      // the village clock ran: stores filled toward capacity
      const gained = RESOURCE_IDS.some((id) => g.state.resources[id] > before.resources[id]);
      expect(gained, `seed ${seed}`).toBe(true);
      // and nothing new is waiting to be told: no round ran. A choice already
      // unanswered when the tab closed still waits, on its own round's card.
      const news = pendingNews(g.state);
      if (before.pendingChoice) {
        expect(news?.title, `seed ${seed}`).toBe(`Round ${before.round}`);
        expect(news?.lines, `seed ${seed}`).toEqual([]);
      } else {
        expect(news, `seed ${seed}`).toBeNull();
      }
    }
  });

  it('a year away is no different', () => {
    const json = played(3);
    const before = deserialise(json);
    const g = new Game(deserialise(json));
    g.tick(before.lastTick + 365 * 24 * H);
    expect(politics(g.state)).toEqual(politics(before));
  });

  it('only the player moves the round: one act, one round', () => {
    const g = new Game(deserialise(played(5)));
    const r = g.state.round;
    g.tick(g.state.lastTick + 30 * 24 * H);
    expect(g.state.round).toBe(r);
    g.act({ type: 'convene' }, g.state.lastTick + 1);
    expect(g.state.round).toBe(r + 1);
  });
});

describe('the dev clock', () => {
  function memoryStorage(): StorageLike {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  }

  it('at 600× it advances production but never a round', () => {
    let real = T0;
    const dev = createDevClock(true, () => real, memoryStorage());
    dev.setMultiplier(600);
    const g = new Game(createInitialState(dev.now(), 4));
    const before = politics(g.state);
    const woodBefore = g.state.resources.wood;
    // ten real minutes of village ticks: a hundred virtual hours
    for (let i = 0; i < 600; i++) {
      real += config.tickMs;
      g.tick(dev.now());
    }
    expect(dev.now() - T0).toBeGreaterThanOrEqual(100 * H);
    expect(g.state.resources.wood).toBeGreaterThan(woodBefore);
    expect(politics(g.state)).toEqual(before);
    expect(g.state.round).toBe(0);
  });

  it("its skip buttons move the village clock only, a week at a time", () => {
    let real = T0;
    const dev = createDevClock(true, () => real, memoryStorage());
    const g = new Game(createInitialState(dev.now(), 4));
    const before = politics(g.state);
    for (let i = 0; i < 4; i++) {
      dev.skip(168 * H);
      real += config.tickMs;
      g.tick(dev.now());
    }
    expect(politics(g.state)).toEqual(before);
  });

  it('a brand-new save starts at round 0', () => {
    expect(createInitialState(T0, 1).round).toBe(0);
  });
});

describe('the idle round is gone', () => {
  it('from the config', () => {
    const raw = readFileSync(join(process.cwd(), 'data/config.json'), 'utf8');
    expect(raw).not.toMatch(/calendarFloorHours|idleRoundsMaxCatchUp/);
  });

  it('from the code: nothing but the player act calls a round', () => {
    const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
    expect(src('src/politics/rounds.ts')).not.toMatch(/runIdleRounds|roundsUntilIdle|awayRounds|lastRoundAt/);
    expect(src('src/village/clock.ts')).not.toMatch(/runRound|runIdleRounds/);
    expect(src('src/dev.ts')).not.toMatch(/runRound|act\(/);
    // the one caller of runRound is Game.act, the player's political move
    const callers = ['src/game.ts', 'src/main.ts', 'src/village/clock.ts', 'src/politics/rounds.ts']
      .filter((f) => /\brunRound\(/.test(src(f).replace(/export function runRound\(/, '')));
    expect(callers).toEqual(['src/game.ts']);
  });

  it('from old saves: the bookkeeping is dropped on load', () => {
    const old = JSON.parse(serialise(createInitialState(T0, 2))) as Record<string, unknown> & { stats: Record<string, unknown> };
    old.awayRounds = 4;
    old.lastRoundAt = 0;
    old.stats.idleRounds = 4;
    const back = deserialise(JSON.stringify(old)) as unknown as Record<string, unknown> & { stats: Record<string, unknown> };
    expect('awayRounds' in back).toBe(false);
    expect('lastRoundAt' in back).toBe(false);
    expect('idleRounds' in back.stats).toBe(false);
  });
});
