import { describe, it, expect } from 'vitest';
import { createInitialState, serialise, deserialise } from '../src/state/store';
import { Game } from '../src/game';
import { pendingNews, renderNews } from '../src/render/panel';
import { appoint, meetsRank } from '../src/politics/posts';
import { gravitasRank } from '../src/politics/characters';
import { bribe, seekRomeBacking } from '../src/politics/intrigue';
import { config, post } from '../src/data';
import { runRound } from '../src/politics/rounds';
import { renderReports } from '../src/render/reports';

const H = 3_600_000;

describe('news', () => {
  it('opens on a new colony, then reports each round, then clears', () => {
    const g = new Game(createInitialState(0, 5));
    const opening = pendingNews(g.state)!;
    expect(opening.title).toBe(config.townName);
    expect(opening.lines.length).toBeGreaterThan(0);
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    expect(pendingNews(g.state)).toBeNull();
    g.act({ type: 'convene' }, 1000);
    const report = pendingNews(g.state);
    // a quiet round may produce nothing but the round marker, which is filtered out
    if (report) expect(report.title).toBe(`Round ${g.state.round}`);
    g.state.seenLogId = g.state.logSeq;
    // an unanswered event keeps the card up on purpose; otherwise it clears
    if (g.state.pendingChoice) expect(pendingNews(g.state)).not.toBeNull();
    else expect(pendingNews(g.state)).toBeNull();
  });

  it('laying a foundation is not news, and never re-raises the founding card', () => {
    const g = new Game(createInitialState(0, 5));
    // the founding shows once
    expect(pendingNews(g.state)).not.toBeNull();
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    expect(pendingNews(g.state)).toBeNull();
    // starting work writes a log line; it must not put the card back
    g.build('c2', 'castellum', 1);
    expect(g.state.log.some((e) => e.kind === 'village' && e.id > g.state.seenLogId)).toBe(true);
    expect(pendingNews(g.state), 'a build should not raise the news overlay').toBeNull();
    // but a round still reports, and carries the village lines it collected
    g.act({ type: 'convene' }, 2000);
    const news = pendingNews(g.state);
    if (news) expect(news.title).toBe(`Round ${g.state.round}`);
  });

  it('gives the founding its own entrance, and a round report the short one', () => {
    const g = new Game(createInitialState(0, 5));
    const opening = renderNews(pendingNews(g.state)!, g.state);
    // the opening beat is the first thing a colony shows and arrives slowly
    expect(opening).toContain('news-card opening');
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.act({ type: 'convene' }, 1000);
    const news = pendingNews(g.state);
    if (news) expect(renderNews(news, g.state)).not.toContain('opening');
  });

  it('time alone runs no round and raises no card: a week closed is a week of village work only', () => {
    const g = new Game(createInitialState(0, 11));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.tick(7 * 24 * H);
    expect(g.state.round).toBe(0);
    expect(g.state.history).toEqual([]);
    expect(pendingNews(g.state)).toBeNull();
  });

  it('a round report records the state it left behind', () => {
    const g = new Game(createInitialState(0, 3));
    g.act({ type: 'convene' }, 1000);
    const r = g.state.lastReport!;
    expect(r.round).toBe(1);
    expect(r.idle).toBeUndefined(); // no round is written as one that ran without the player
    expect(r.resources.wood).toBe(g.state.resources.wood);
  });

  it('survives a save round-trip and migrates a v1 save without log ids', () => {
    const s = createInitialState(7, 2);
    expect(deserialise(serialise(s))).toEqual(s);
    const old = JSON.parse(serialise(s)) as Record<string, unknown> & { log: { id?: number }[] };
    delete old.logSeq; delete old.seenLogId; delete old.lastReport; delete old.awayRounds;
    for (const e of old.log) delete e.id;
    const back = deserialise(JSON.stringify(old));
    expect(back.logSeq).toBe(back.log.length);
    expect(back.seenLogId).toBe(back.logSeq);
    expect(pendingNews(back)).toBeNull();
  });
});

describe('levelling and gravitas gates', () => {
  it('a post gates on gravitas rank and says so', () => {
    const s = createInitialState(0, 1);
    expect(post('treasury').minRank).toBe(1);
    expect(meetsRank(s, 'treasury', 'p_leader')).toBe(false);
    expect(() => appoint(s, 'treasury', 'p_leader')).toThrow(/rank 1/);
    expect(meetsRank(s, 'works', 'p_leader')).toBe(true);
    appoint(s, 'works', 'p_leader');
    s.characters.p_leader.gravitas = config.gravitas.rankThresholds[1];
    expect(gravitasRank(s.characters.p_leader)).toBe(1);
    appoint(s, 'treasury', 'p_leader');
  });

  it('holding a post raises its stat over time, capped', () => {
    const g = new Game(createInitialState(0, 21));
    g.act({ type: 'appoint', postId: 'works', characterId: 'p_son' }, 1);
    const before = g.state.characters.p_son.stats.craft;
    for (let i = 0; i < 60; i++) g.act({ type: 'convene' }, i + 2);
    const after = g.state.characters.p_son.stats.craft;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(config.levelling.statMax);
  });

  it('intrigue is gated on rank too', () => {
    const s = createInitialState(0, 1);
    s.resources.denarii = 1000;
    expect(() => bribe(s, 'cornelii')).toThrow(/rank 1/);
    s.characters.p_leader.gravitas = config.gravitas.rankThresholds[1];
    bribe(s, 'cornelii');
    s.characters.p_leader.gravitasStock = 999;
    expect(() => seekRomeBacking(s)).toThrow(/rank 2/);
    s.characters.p_leader.gravitas = config.gravitas.rankThresholds[2];
    seekRomeBacking(s);
  });
});

describe('the round ledger and the history (reports unit)', () => {
  it('records the colony as the round found it and as it left it', () => {
    const g = new Game(createInitialState(0, 3));
    g.state.resources.wood = 321;
    const before = { ...g.state.resources };
    const pop = Math.floor(g.state.population);
    runRound(g.state, 1000);
    const r = g.state.lastReport!;
    expect(r.before!.resources).toEqual(before);
    expect(r.before!.population).toBe(pop);
    expect(r.resources).toEqual(g.state.resources);
    expect(r.toLogId).toBe(g.state.logSeq);
    expect(r.toLogId).toBeGreaterThan(r.fromLogId);
    expect(r.forumTier).toBe(1);
    expect(typeof r.standing).toBe('number');
    expect(r.buildingsRaised).toBe(g.state.slots.filter((s) => s.tier > 0).length);
    expect(r.claimed).toBe(0);
  });
  it('the history grows one a round the player calls, never with time alone, and trims past config.history.max', () => {
    const g = new Game(createInitialState(0, 11));
    g.state.seenLogId = g.state.logSeq;
    g.act({ type: 'convene' }, 1000);
    expect(g.state.history).toHaveLength(1);
    g.tick(3 * 24 * H + 1000);
    expect(g.state.history).toHaveLength(1);
    expect(g.state.history.at(-1)).toBe(g.state.lastReport);
    const was = config.history.max;
    config.history.max = 5;
    try {
      for (let i = 0; i < 4; i++) g.act({ type: 'convene' }, 10_000 + i);
      expect(g.state.history).toHaveLength(5);
      expect(g.state.history[0].round).toBe(g.state.round - 4);
    } finally { config.history.max = was; }
  });
  it('an old lastReport without a ledger still renders, and a save without history migrates to none', () => {
    const g = new Game(createInitialState(0, 3));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.act({ type: 'convene' }, 1000);
    const raw = JSON.parse(serialise(g.state)) as Record<string, unknown> & { lastReport: Record<string, unknown> };
    delete raw.history;
    delete raw.lastReport.before;
    delete raw.lastReport.toLogId;
    const back = deserialise(JSON.stringify(raw));
    expect(back.history).toEqual([]);
    expect(back.lastReport!.before).toBeUndefined();
    const news = pendingNews(back);
    if (news) {
      const html = renderNews(news, back, 1000);
      expect(html).toContain('Continue');
      expect(html).not.toContain('ledger-round');
    }
    expect(renderReports(back)).toContain('Reports');
  });
  it('never prints the clock: the card and the tab show rounds, not times', () => {
    const g = new Game(createInitialState(0, 3));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    const at = 987_654_321;
    g.act({ type: 'convene' }, at);
    expect(g.state.lastReport!.at).toBe(at);
    const news = pendingNews(g.state);
    const card = news ? renderNews(news, g.state, at) : '';
    const tab = renderReports(g.state);
    for (const html of [card, tab]) {
      expect(html).not.toMatch(/\d{1,2}:\d{2}/);
      expect(html).not.toContain(String(at));
    }
  });
  it('an old save with idle rounds unread is read as one round report, not a digest', () => {
    // a save from before 2026-09-25: three rounds ran without the player and wait unread
    const g = new Game(createInitialState(0, 11));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    for (let i = 0; i < 3; i++) g.act({ type: 'convene' }, 1000 + i);
    const old = JSON.parse(serialise(g.state)) as Record<string, unknown> & { log: { text: string }[]; stats: Record<string, unknown> };
    for (const e of old.log) e.text = e.text.replace(/^Round (\d+)\.$/, 'Round $1: the council meets without you.');
    old.awayRounds = 3;
    old.lastRoundAt = 0;
    old.stats.idleRounds = 3;
    const back = deserialise(JSON.stringify(old));
    expect('awayRounds' in back).toBe(false);
    expect('lastRoundAt' in back).toBe(false);
    expect('idleRounds' in back.stats).toBe(false);
    const news = pendingNews(back)!;
    expect(news.kind).toBe('report');
    expect(renderNews(news, back, 2000).match(/class="news-card/g)).toHaveLength(1);
  });
});

/** What full stores turned away (DESIGN §4.2), on the card and nowhere it should not be. */
describe('the overflow line on the round card', () => {
  it('is on the round card when the counter is non-zero, and not otherwise', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.act({ type: 'convene' }, 1000);
    const news = pendingNews(g.state) ?? { kind: 'report' as const, title: 'Round 1', subtitle: '', lines: [] };
    expect(renderNews(news, g.state, 1000)).not.toContain('data-overflow');
    g.state.overflowSinceSeen = { wood: 130.4, clay: 0.2, grain: 20 };
    const html = renderNews(news, g.state, 1000);
    expect(html).toContain('data-overflow');
    expect(html).toContain('The Warehouse stood full: 130 wood went to waste.');
    expect(html).toContain('The Granary stood full: 20 grain went to waste.');
    // a fraction of a unit is not a loss; the round ledger beside it still names every resource
    const line = html.match(/<p class="overflow" data-overflow>(.*?)<\/p>/)![1];
    expect(line).not.toContain('clay');
  });

  it('the founding card never carries it', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.overflowSinceSeen = { wood: 50 };
    const html = renderNews(pendingNews(g.state)!, g.state, 0);
    expect(html).not.toContain('data-overflow');
  });

  it('migrates a save without the counter to an empty one', () => {
    const old = JSON.parse(serialise(createInitialState(0, 5)));
    delete old.overflowSinceSeen;
    expect(deserialise(JSON.stringify(old)).overflowSinceSeen).toEqual({});
  });
});

/** A round the player calls always answers (Mathias, 2026-09-24). */
describe('the quiet round card', () => {
  function readColony(seed = 5) {
    const g = new Game(createInitialState(0, seed));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    return g;
  }

  it('a convene that brings no news raises a short card saying the council met', () => {
    const g = readColony();
    g.act({ type: 'convene' }, 1000);
    const news = pendingNews(g.state)!;
    expect(news).not.toBeNull();
    expect(news.kind).toBe('report');
    expect(news.quiet).toBe(true);
    expect(news.title).toBe(`Round ${g.state.round}`);
    const html = renderNews(news, g.state, 1000);
    expect(html).toContain(config.quietRound.text);
    expect(html).not.toContain('without you');
    expect(html).toContain('Continue');
    // short: no ledger of a round that moved nothing, no report cards
    expect(html).not.toContain('ledger-round');
    expect(html).not.toContain('data-report=');
    // Continue reads it
    g.state.seenLogId = g.state.logSeq;
    expect(pendingNews(g.state)).toBeNull();
  });

  it('a round with news is an ordinary card, not a quiet one', () => {
    const g = readColony();
    g.state.rome.activeRequest = null; // Rome writes at this round
    g.state.rome.activeRequestId = null;
    g.act({ type: 'convene' }, 1000);
    const news = pendingNews(g.state)!;
    expect(news.quiet).toBeFalsy();
    expect(renderNews(news, g.state, 1000)).not.toContain(config.quietRound.text);
  });

  it('time away raises no card at all, quiet or otherwise: no round ran', () => {
    const g = readColony();
    g.tick(7 * 24 * H);
    expect(g.state.round).toBe(0);
    expect(pendingNews(g.state)).toBeNull();
  });

  it('the founding card is never the quiet card', () => {
    const s = createInitialState(0, 5);
    expect(pendingNews(s)!.kind).toBe('opening');
    expect(pendingNews(s)!.quiet).toBeFalsy();
  });
});
