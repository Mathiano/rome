// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { config } from '../src/data';
import { pendingNews, renderNews } from '../src/render/panel';
import { pendingChoices } from '../src/politics/events';
import { canAfford } from '../src/village/economy';

/**
 * Coming back after days away (DESIGN §3.3; Mathias, 2026-09-24): the load
 * runs at most `idleRoundsMaxCatchUp` idle rounds, and the player is told about
 * all of them on exactly one card — never a stack of round cards.
 */
const H = 3_600_000;
const WEEK = 7 * 24 * H;
const T0 = 1_000_000;

/** A colony played for one round, read, and saved — as the tab closes. */
function savedAfterPlay(seed: number): string {
  const g = new Game(createInitialState(T0, seed));
  g.act({ type: 'convene' }, T0 + 1000);
  const s = g.state;
  s.seenLogId = s.logSeq;
  s.seenOpening = true;
  s.awayRounds = 0;
  return serialise(s);
}

/** What main.ts does on load: read the save, then tick to the present. */
function load(json: string, awayMs: number): { g: Game; now: number } {
  const g = new Game(deserialise(json));
  const now = g.state.lastTick + awayMs;
  g.tick(now);
  return { g, now };
}

/**
 * Read every card the overlay raises, as the player would: answer any choice on
 * the card it appears on (the card stays), then Continue (main.ts). Returns one
 * entry per card shown.
 */
function readCards(g: Game, now: number): { kinds: string[]; html: string[]; chose: boolean } {
  const kinds: string[] = [];
  const html: string[] = [];
  let chose = false;
  let news = pendingNews(g.state);
  while (news && kinds.length < 10) {
    kinds.push(news.kind);
    html.push(renderNews(news, g.state, now));
    for (let i = 0; i < 5 && g.state.pendingChoice; i++) {
      const c = pendingChoices(g.state).find((x) => !x.cost || canAfford(g.state, x.cost));
      if (!c) break;
      g.choose(c.id, now);
      chose = true;
      // answering does not raise a card of its own: the same summary, now with Continue
      expect(pendingNews(g.state)?.kind).toBe(news.kind);
    }
    g.state.seenLogId = g.state.logSeq;
    g.state.awayRounds = 0;
    g.state.seenOpening = true;
    g.state.overflowSinceSeen = {};
    news = pendingNews(g.state);
  }
  return { kinds, html, chose };
}

describe('several days away', () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

  it('a week-old save runs its seven idle rounds on load, and no more after', () => {
    for (const seed of SEEDS) {
      const json = savedAfterPlay(seed);
      const before = deserialise(json);
      const { g, now } = load(json, WEEK);
      const cap = config.idleRoundsMaxCatchUp;
      expect(g.state.round, `seed ${seed}`).toBe(before.round + Math.min(cap, Math.floor(WEEK / (config.calendarFloorHours * H))));
      expect(g.state.round - before.round).toBeLessThanOrEqual(cap);
      expect(g.state.awayRounds).toBe(g.state.round - before.round);
      // the ticks that follow the load run nothing more
      g.tick(now + 60_000);
      g.tick(now + H);
      expect(g.state.awayRounds).toBe(g.state.round - before.round);
      expect(g.state.round - before.round).toBeLessThanOrEqual(cap);
    }
  });

  it('an absence longer than the cap is held to it on load, and the rest is forgiven, not queued', () => {
    const cap = config.idleRoundsMaxCatchUp;
    for (const days of [10, 30]) {
      const away = days * 24 * H;
      // uncapped, the calendar floor alone would run this many rounds
      expect(Math.floor(away / (config.calendarFloorHours * H))).toBeGreaterThan(cap);
      for (const seed of SEEDS) {
        const json = savedAfterPlay(seed);
        const before = deserialise(json);
        const { g, now } = load(json, away);
        expect(g.state.round, `${days} days, seed ${seed}`).toBe(before.round + cap);
        expect(g.state.stats.idleRounds - before.stats.idleRounds).toBe(cap);
        expect(g.state.awayRounds).toBe(cap);
        expect(g.state.lastRoundAt).toBe(now);
        g.tick(now + 60_000);
        expect(g.state.round).toBe(before.round + cap);
      }
    }
  });

  it('the return raises exactly one card, the summary, whatever the rounds raised', () => {
    let sawChoice = 0;
    for (const seed of SEEDS) {
      const { g, now } = load(savedAfterPlay(seed), WEEK);
      const { kinds, html, chose } = readCards(g, now);
      if (chose) sawChoice += 1;
      expect(kinds, `seed ${seed}`).toEqual(['away']);
      const doc = new DOMParser().parseFromString(html[0], 'text/html');
      expect(doc.querySelectorAll('.news-card')).toHaveLength(1);
      expect(doc.querySelector('h2')!.textContent).toBe('While you were away');
      expect(doc.body.textContent).toContain(`${config.idleRoundsMaxCatchUp} rounds ran without you`);
      // one summary: one tally, one ledger, no folder or report card per round
      expect(doc.querySelectorAll('.tally-line')).toHaveLength(1);
      expect(doc.querySelectorAll('.ledger-round')).toHaveLength(1);
      expect(doc.querySelectorAll('details.round')).toHaveLength(0);
      expect(doc.querySelectorAll('[data-report]')).toHaveLength(0);
      // and then the game continues: nothing left to show
      expect(pendingNews(g.state), `seed ${seed}`).toBeNull();
    }
    // the path that used to stack a Round card in front of the summary was exercised
    expect(sawChoice).toBeGreaterThan(0);
  });

  it('a choice raised while away is asked on the summary card itself', () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => load(savedAfterPlay(s), WEEK).g.state.pendingChoice)!;
    expect(seed).toBeDefined();
    const { g, now } = load(savedAfterPlay(seed), WEEK);
    const news = pendingNews(g.state)!;
    expect(news.kind).toBe('away');
    const card = renderNews(news, g.state, now);
    expect(card).toContain('data-choice=');
    expect(card).not.toContain('data-news-ok');
  });
});
