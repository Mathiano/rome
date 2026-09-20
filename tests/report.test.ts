import { describe, it, expect } from 'vitest';
import { createInitialState, serialise, deserialise } from '../src/state/store';
import { Game } from '../src/game';
import { pendingNews, renderNews } from '../src/render/panel';
import { appoint, meetsRank } from '../src/politics/posts';
import { gravitasRank } from '../src/politics/characters';
import { bribe, seekRomeBacking } from '../src/politics/intrigue';
import { config, post } from '../src/data';

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

  it('digests the rounds that ran while the game was closed', () => {
    const g = new Game(createInitialState(0, 11));
    g.state.seenLogId = g.state.logSeq;
    g.tick(config.calendarFloorHours * H * 4);
    expect(g.state.awayRounds).toBe(4);
    const news = pendingNews(g.state)!;
    expect(news.title).toBe('While you were away');
    expect(news.subtitle).toContain('4 rounds');
  });

  it('a round report records the state it left behind', () => {
    const g = new Game(createInitialState(0, 3));
    g.act({ type: 'convene' }, 1000);
    const r = g.state.lastReport!;
    expect(r.round).toBe(1);
    expect(r.idle).toBe(false);
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
