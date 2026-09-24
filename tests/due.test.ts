// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { building, config, envoys, posts, researchNode, tribeDef } from '../src/data';
import { startBuild } from '../src/village/construction';
import { dueItems, idleHoursOf, idleLine, renderDue } from '../src/render/due';
import { bindPanel, pendingNews, renderNews, renderPanel, type PanelHandlers } from '../src/render/panel';
import type { GameState } from '../src/state/types';

const H = 3_600_000;
const PLENTY = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** Every handler a no-op, so a test can override only the one it is watching. */
function noHandlers(): PanelHandlers {
  return {
    onTab: () => {}, onChoice: () => {}, onScout: () => {}, onBuild: () => {}, onRush: () => {},
    onSelectSlot: () => {}, onAdoptNewMan: () => {}, onPolitical: () => {}, onEnvoy: () => {}, onTrade: () => {},
    onResearch: () => {}, onRushResearch: () => {}, onGuards: () => {},
    onExport: () => {}, onImport: () => {}, onReset: () => {},
    onSelectHex: () => {}, onDismissAdvisor: () => {},
  };
}

/** A colony a few rounds in, with nothing pending, to hang things on. */
function settled(): GameState {
  const s = createInitialState(0, 5);
  s.round = 6;
  s.lastRoundAt = 0;
  return s;
}

describe('the due collector', () => {
  it('a fresh colony has nothing due, and a full floor until the idle round', () => {
    const s = createInitialState(0, 5);
    const d = dueItems(s, 0);
    expect(d.village).toEqual([]);
    expect(d.nextRound).toEqual([]);
    expect(d.later).toEqual([]);
    expect(d.idleHours).toBe(config.calendarFloorHours);
    // whole hours, rounded up, as the Council tab prints them
    expect(idleHoursOf(s, 1.5 * H)).toBe(config.calendarFloorHours - 1);
    expect(idleLine(1)).toBe('If you stay away, the council meets without you in about 1 hour.');
  });

  it('a construction is a village item carrying its slot; a study points at the library', () => {
    const s = createInitialState(0, 5);
    s.resources = { ...PLENTY };
    startBuild(s, 'i1', 'warehouse', 0);
    s.research.active.push({ id: 'groma', startedAt: 0, finishAt: 40 * 60_000 });
    const d = dueItems(s, 0);
    expect(d.village).toHaveLength(2);
    expect(d.village[0].goto).toEqual({ tab: 'village', slot: 'i1' });
    expect(d.village[0].text).toMatch(/^Warehouse I: (about \d+ minutes?|less than a minute|about \d+(\.5)? hours?) left\.$/);
    expect(d.village[1]).toEqual({ text: `${researchNode('groma').name} under study: about 40 minutes left.`, goto: { tab: 'library' } });
  });

  it('what lands at the next round: scouts, an envoy, Rome, a raid, a house leaving, a demand, a vote', () => {
    const s = settled();
    s.map.pendingScout = '2,-1';
    const t = Object.values(s.tribes)[0];
    t.pendingEnvoy = 'offer_trade';
    t.massingForRound = s.round + 1;
    s.rome.activeRequest = { id: 'r', title: 't', text: '', kind: 'deliver', reward: {}, delivered: {}, fulfilled: true, issuedRound: s.round };
    s.families.cornelii.sourRounds = config.secession.rounds - 1;
    s.families.valerii.demand = { kind: 'denarii', denarii: 40, issuedRound: s.round, dueRound: s.round + 1 };
    s.challenge = { callerFamilyId: 'claudii', calledRound: s.round, voteRound: s.round + 1, candidates: {} };
    const d = dueItems(s, 0);
    const texts = d.nextRound.map((i) => i.text);
    expect(texts).toContain('Scouts report from 2,-1.');
    expect(texts).toContain(`${tribeDef(t.id).name} hear your envoy: ${envoys.find((e) => e.id === 'offer_trade')!.name.toLowerCase()}.`);
    expect(texts).toContain('Rome answers.');
    expect(texts.find((x) => x.includes('are massing'))).toMatch(new RegExp(`^${tribeDef(t.id).name} are massing, about \\d+ against your \\d+; the raid lands on round ${s.round + 1}\\. \\d+ denarii turns them back\\.$`));
    expect(texts).toContain('The Cornelii will leave the colony.');
    expect(texts).toContain(`The Valerii ask for 40 denarii; an answer is expected by round ${s.round + 1}.`);
    expect(texts).toContain(`The houses vote on the office of ${config.topOffice.title}.`);
    expect(d.later).toEqual([]);
    // each line lands somewhere
    const tabs = d.nextRound.map((i) => i.goto.tab);
    expect(tabs).toEqual(expect.arrayContaining(['map', 'tribe', 'rome', 'family', 'council']));
  });

  it('a named round is written as a round, never as a time, and is always ahead', () => {
    const s = settled();
    const t = Object.values(s.tribes)[0];
    t.massingForRound = s.round + 2;
    t.hostagesUntilRound = s.round + 3;
    t.leakedUntilRound = s.round + 2;
    s.rome.hostingUntilRound = s.round + 2;
    s.rome.administeringUntilRound = s.round + 4;
    s.families.valerii.demand = { kind: 'post', postId: 'works', issuedRound: s.round, dueRound: s.round + 3 };
    s.challenge = { callerFamilyId: 'claudii', calledRound: s.round, voteRound: s.round + 2, candidates: {} };
    s.families.cornelii.departedRound = s.round - 1;
    const d = dueItems(s, 0);
    expect(d.nextRound).toEqual([]);
    const texts = d.later.map((i) => i.text);
    expect(texts).toContain(`${tribeDef(t.id).name} have their hostages back at round ${s.round + 3}.`);
    expect(texts).toContain(`${tribeDef(t.id).name} forget the size of your stores at round ${s.round + 2}.`);
    expect(texts).toContain(`Rome's guest leaves at round ${s.round + 2}.`);
    expect(texts).toContain(`The procurator hands the colony back at round ${s.round + 4}.`);
    expect(texts).toContain(`The Valerii ask for the post of ${posts.find((p) => p.id === 'works')!.name}; an answer is expected by round ${s.round + 3}.`);
    expect(texts).toContain(`The houses vote on the office of ${config.topOffice.title} at round ${s.round + 2}.`);
    const sc = config.secession;
    expect(texts).toContain(`The Cornelii hear terms again at round ${s.round - 1 + sc.awayRounds}.`);
    expect(texts).toContain(`The Cornelii come home regardless at round ${s.round - 1 + sc.maxAwayRounds}.`);
    for (const x of [...d.nextRound, ...d.later]) {
      for (const m of x.text.matchAll(/round (\d+)/g)) expect(Number(m[1]), x.text).toBeGreaterThan(s.round);
      expect(x.text, x.text).not.toMatch(/\d+\s?(h|hours?|min|minutes?|s|sec)\b|\d{1,2}:\d{2}/);
    }
  });

  it('a house away long enough, and warm enough, is ready to come home', () => {
    const s = settled();
    const sc = config.secession;
    s.families.cornelii.departedRound = s.round - sc.awayRounds;
    s.families.cornelii.attitude = sc.returnAttitude;
    const d = dueItems(s, 0);
    expect(d.nextRound.map((i) => i.text)).toContain('The Cornelii are ready to come home.');
    expect(d.later).toEqual([]);
  });
});

describe('the Due block on the Village tab', () => {
  it('is open by default, says when nothing is under way, and states no clock', () => {
    const g = new Game(createInitialState(0, 5));
    const html = renderPanel(g, 'village', null, 0);
    const start = html.indexOf('<details class="due"');
    const block = html.slice(start, html.indexOf('</details>', start));
    expect(block).toContain('data-menu="due" open');
    expect(block).toContain('Nothing under way.');
    expect(block).toContain(`in about ${config.calendarFloorHours} hours.`);
    expect(block).not.toMatch(/\d{1,2}:\d{2}/);
    expect(block).not.toMatch(/second/);
    // above the overview's lanes, and on the plot card too
    expect(start).toBeLessThan(html.indexOf('<div class="lanes">'));
    expect(renderPanel(g, 'village', 'i1', 0)).toContain('data-menu="due"');
  });

  it('each line is a link to where it lands, grouped and each stated once', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.resources = { ...PLENTY };
    g.build('i1', 'warehouse', 0);
    const t = Object.values(g.state.tribes)[0];
    t.massingForRound = g.state.round + 1;
    g.state.rome.hostingUntilRound = g.state.round + 3;
    const html = renderDue(g.state, 0, true);
    expect(html).toContain('<h4>Under way</h4>');
    expect(html).toContain('<h4>At the next round</h4>');
    expect(html).toContain('<h4>Later</h4>');
    expect(html).toMatch(/<button class="link" data-select-slot="i1">Warehouse I: /);
    expect(html).toMatch(/<button class="link" data-tab="tribe">The \w+ are massing/);
    expect(html).toContain(`<button class="link" data-tab="rome">Rome's guest leaves at round ${g.state.round + 3}.`);
    expect(html).not.toContain('Nothing under way');
    expect(html.match(/council meets without you/g)).toHaveLength(1);
    expect(strip(html).match(/Warehouse I/g)).toHaveLength(1);
    expect(renderDue(g.state, 0, false)).not.toContain(' open>');
  });

  it('keeps its open state across rebuilds after a toggle', () => {
    const g = new Game(createInitialState(0, 5));
    const panel = document.createElement('div');
    bindPanel(panel, noHandlers());
    panel.innerHTML = renderPanel(g, 'village', null, 0);
    const details = () => panel.querySelector<HTMLDetailsElement>('details[data-menu="due"]')!;
    expect(details().open).toBe(true);
    details().open = false;
    details().dispatchEvent(new Event('toggle'));
    panel.innerHTML = renderPanel(g, 'village', 'i1', 0);
    expect(details().open, 'closed stays closed when a plot is selected').toBe(false);
    panel.innerHTML = renderPanel(g, 'village', null, 0);
    expect(details().open).toBe(false);
    details().open = true;
    details().dispatchEvent(new Event('toggle'));
    panel.innerHTML = renderPanel(g, 'village', null, 0);
    expect(details().open).toBe(true);
  });

  it('a line routes to its tab or its plot through the existing handlers', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.resources = { ...PLENTY };
    g.build('i1', 'warehouse', 0);
    Object.values(g.state.tribes)[0].massingForRound = g.state.round + 1;
    const panel = document.createElement('div');
    const tabs: string[] = [];
    const slots: string[] = [];
    bindPanel(panel, { ...noHandlers(), onTab: (t) => tabs.push(t), onSelectSlot: (id) => slots.push(id) });
    panel.innerHTML = renderPanel(g, 'village', null, 0);
    panel.querySelector<HTMLButtonElement>('details.due button[data-tab="tribe"]')!.click();
    panel.querySelector<HTMLButtonElement>('details.due button[data-select-slot="i1"]')!.click();
    expect(tabs).toEqual(['tribe']);
    expect(slots).toEqual(['i1']);
  });
});

describe('before you go, from the same collector', () => {
  it('the round card lists the job under way by name; the founding card lists nothing', () => {
    const g = new Game(createInitialState(0, 5));
    expect(renderNews(pendingNews(g.state)!, g.state, 0)).not.toContain('Before you go');
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.build('o5', 'iron_mine', 1000);
    g.act({ type: 'convene' }, 2000);
    const html = renderNews(pendingNews(g.state)!, g.state, 2000);
    expect(html).toContain('Before you go');
    expect(html).toContain(building('iron_mine').name);
    // the same words the Village block prints
    const due = strip(renderDue(g.state, 2000, true));
    expect(due).toContain(strip(html.match(/<li>(Iron mine I: [^<]+)<\/li>/)![1]));
  });
});
