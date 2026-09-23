// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { advisor, building, layout, posts } from '../src/data';
import { blockedBy, CONDITION_WORDS, currentAdvice, foundingParagraphs, holds, nextStep, resolveGoto, stepDone } from '../src/render/advisor';
import { capacity } from '../src/village/storage';
import { checkBuild, startBuild } from '../src/village/construction';
import { isScouted, nearestUnknown, ringOf, scoutCost, siteAt } from '../src/map/sites';
import { bindPanel, leavingCounsel, pendingNews, renderNews, renderPanel, type PanelHandlers, type Tab } from '../src/render/panel';
import { createVillageView } from '../src/render/village';
import { config } from '../src/data';

const TABS: Tab[] = ['village', 'map', 'library', 'council', 'family', 'tribe', 'rome', 'log', 'save'];

describe('the counsel line as data', () => {
  it('is a finite line of steps the code can read, pointing at real places', () => {
    expect(advisor.steps.length).toBeGreaterThanOrEqual(3);
    expect(new Set(advisor.steps.map((s) => s.id)).size).toBe(advisor.steps.length);
    for (const step of advisor.steps) {
      expect(step.text.length, step.id).toBeGreaterThan(20);
      expect(TABS, step.id).toContain(step.goto.tab);
      if (step.goto.slot) expect(layout.slots.some((s) => s.id === step.goto.slot), `${step.id} slot`).toBe(true);
      if (step.goto.hex) expect(step.goto.hex).toBe('nearestUnknown');
      if (step.action?.build) {
        expect(() => building(step.action!.build!.building), step.id).not.toThrow();
        expect(layout.slots.some((s) => s.id === step.action!.build!.slot), `${step.id} action slot`).toBe(true);
      }
      expect(step.done.length, step.id).toBeGreaterThan(0);
      for (const c of step.done) {
        const words = Object.keys(c);
        expect(words, step.id).toHaveLength(1);
        expect(CONDITION_WORDS, `${step.id}: ${words[0]}`).toContain(words[0]);
      }
    }
    // the step that names a post names a real one the founding leader may hold
    for (const step of advisor.steps) for (const c of step.done) {
      const p = (c as { postHeld?: { postId: string } }).postHeld;
      if (p) expect(posts.find((x) => x.id === p.postId)?.minRank, p.postId).toBe(0);
    }
  });

  it('an unknown word is a data bug, not a silent pass', () => {
    const s = createInitialState(0, 1);
    expect(() => stepDone(s, { id: 'x', text: 'x', goto: { tab: 'village' }, done: [{ nonsense: true }] })).toThrow(/unknown counsel condition/);
    expect(() => stepDone(s, { id: 'x', text: 'x', goto: { tab: 'village' }, done: [{}] })).toThrow(/one word/);
  });
});

describe('the condition vocabulary', () => {
  it('every word reads the colony, and answers differently once the colony moves', () => {
    const g = new Game(createInitialState(0, 5));
    const s = g.state;
    const t = (c: Record<string, unknown>) => holds(s, c);
    // a fresh colony, word by word
    expect(t({ buildingTier: { id: 'forum', atLeast: 1 } })).toBe(true);
    expect(t({ buildingTier: { id: 'forum', atLeast: 2 } })).toBe(false);
    expect(t({ underWay: { building: 'iron_mine' } })).toBe(false);
    expect(t({ affordable: { slot: 'o5', building: 'iron_mine' } })).toBe(true);
    expect(t({ roundAtLeast: 1 })).toBe(false);
    expect(t({ postHeld: { postId: 'works' } })).toBe(false);
    expect(t({ envoyOut: true })).toBe(false);
    expect(t({ scoutOut: true })).toBe(false);
    expect(t({ scoutedAtLeast: 1 })).toBe(false);
    expect(t({ romeRequestOpen: true })).toBe(false);
    expect(t({ romeAnswered: true })).toBe(false);
    expect(t({ storeAtCap: { resource: 'wood' } })).toBe(false);
    expect(t({ researchStarted: true })).toBe(false);
    expect(t({ statAtLeast: { key: 'rounds', n: 1 } })).toBe(false);
    // and each turns with the colony
    g.build('o5', 'iron_mine', 1000);
    expect(t({ underWay: { building: 'iron_mine' } })).toBe(true);
    s.resources.wood = 0;
    expect(t({ affordable: { slot: 'c2', building: 'castellum' } })).toBe(false);
    s.resources.wood = capacity(s, 'wood');
    expect(t({ storeAtCap: { resource: 'wood' } })).toBe(true);
    Object.values(s.tribes)[0].pendingEnvoy = 'trade';
    expect(t({ envoyOut: true })).toBe(true);
    s.map.pendingScout = nearestUnknown(s);
    expect(t({ scoutOut: true })).toBe(true);
    s.map.scouted.push(s.map.pendingScout!);
    expect(t({ scoutedAtLeast: 1 })).toBe(true);
    s.research.active.push({ id: 'x', startedAt: 0, finishAt: 1 });
    expect(t({ researchStarted: true })).toBe(true);
    const rival = Object.values(s.characters).find((c) => !s.families[c.familyId].isPlayer)!;
    s.posts.works = rival.id;
    expect(t({ postHeld: { postId: 'works' } })).toBe(true);
    expect(t({ postHeld: { postId: 'works', byPlayer: true } })).toBe(false);
    s.posts.works = 'p_leader';
    expect(t({ postHeld: { postId: 'works', byPlayer: true } })).toBe(true);
    s.round = 1;
    s.stats.rounds = 1;
    expect(t({ roundAtLeast: 1 })).toBe(true);
    expect(t({ statAtLeast: { key: 'rounds', n: 1 } })).toBe(true);
    expect(CONDITION_WORDS).toHaveLength(13);
  });

  it("Rome's two words tell an open letter from an answered one", () => {
    const g = new Game(createInitialState(0, 5));
    g.act({ type: 'convene' }, 1000);
    expect(holds(g.state, { romeRequestOpen: true })).toBe(true);
    expect(holds(g.state, { romeAnswered: true })).toBe(false);
    g.act({ type: 'rome_decline' }, 2000);
    // Rome may write again in the very round that answers it, so an open
    // letter says nothing about whether one was answered; the line ends on
    // the word that does.
    expect(holds(g.state, { romeAnswered: true })).toBe(true);
    expect(g.state.rome.declinedIds).toHaveLength(1);
  });
});

describe('the counsel line against a fresh colony', () => {
  it.each([1, 2, 3, 5, 8, 13])('every step can be taken in order from the founding, and the line then ends (seed %i)', (seed) => {
    const g = new Game(createInitialState(0, seed));
    const s = g.state;
    const ids = advisor.steps.map((x) => x.id);
    expect(ids).toEqual(['iron', 'castellum', 'scouts', 'works', 'rome']);

    // 1: the iron seam is open ground the colony can afford to work
    expect(currentAdvice(s)!.id).toBe('iron');
    expect(blockedBy(s, currentAdvice(s)!)).toBeNull();
    expect(checkBuild(s, 'o5', 'iron_mine').ok).toBe(true);
    g.build('o5', 'iron_mine', 1000);
    expect(currentAdvice(s)!.id).toBe('castellum');

    // 2: the castellum is affordable with the mine still being dug — a field
    // and a building at once (DESIGN §4.4), and it takes the last of the wood
    expect(blockedBy(s, currentAdvice(s)!)).toBeNull();
    expect(checkBuild(s, 'c2', 'castellum').ok).toBe(true);
    g.build('c2', 'castellum', 1000);
    expect(s.resources.wood).toBeGreaterThanOrEqual(0);
    expect(s.constructions).toHaveLength(2);
    expect(currentAdvice(s)!.id).toBe('scouts');

    // 3: there is a mark to scout and the purse covers it
    const step3 = currentAdvice(s)!;
    const go = resolveGoto(s, step3);
    expect(go.tab).toBe('map');
    expect(go.hex).toBeTruthy();
    expect(siteAt(s, go.hex!)).not.toBeNull();
    expect(s.resources.denarii).toBeGreaterThanOrEqual(scoutCost().denarii!);
    expect(blockedBy(s, step3)).toBeNull();
    g.scout(go.hex!, 1000);
    expect(currentAdvice(s)!.id).toBe('works');
    expect(s.round).toBe(0);

    // 4: the appointment is the first round; the scouts report and Rome writes
    g.act({ type: 'appoint', postId: 'works', characterId: 'p_leader' }, 2000);
    expect(s.round).toBe(1);
    expect(isScouted(s, go.hex!)).toBe(true);
    expect(s.rome.activeRequest).not.toBeNull();
    expect(currentAdvice(s)!.id).toBe('rome');

    // 5: the line ends once Rome has been answered, and stays ended between letters
    g.act({ type: 'rome_decline' }, 3000);
    expect(currentAdvice(s)).toBeNull();
    for (let i = 0; i < 3; i++) g.act({ type: 'convene' }, 4000 + i);
    expect(currentAdvice(s)).toBeNull();
  });

  it('stores nothing: the step is read off the colony, so a save round-trip agrees', () => {
    const g = new Game(createInitialState(0, 5));
    g.build('o5', 'iron_mine', 1000);
    const back = deserialise(serialise(g.state));
    expect(currentAdvice(back)!.id).toBe(currentAdvice(g.state)!.id);
    expect(back.advisorDismissed).toBe(false);
  });

  it('says what is short in units, or why else the step must wait', () => {
    const s = createInitialState(0, 5);
    const step = nextStep(s)!;
    s.resources.wood = 10;
    s.resources.clay = 5;
    const cost = checkBuild(s, 'o5', 'iron_mine').cost;
    expect(blockedBy(s, step)).toBe(`${cost.wood! - 10} more wood, ${cost.clay! - 5} more clay`);
    // a field already being worked is the reason, not a number
    const t = createInitialState(0, 5);
    startBuild(t, 'o2', 'lumber_camp', 0);
    expect(blockedBy(t, nextStep(t)!)).toMatch(/field is already being worked/);
    // scouts: the purse
    const u = createInitialState(0, 5);
    u.resources.denarii = 0;
    expect(blockedBy(u, advisor.steps.find((x) => x.id === 'scouts')!)).toBe(`${scoutCost().denarii} more denarii`);
  });
});

describe('the nearest unknown mark', () => {
  it('is the closest unscouted site, and moves on once that one is seen', () => {
    const s = createInitialState(0, 5);
    const first = nearestUnknown(s)!;
    expect(siteAt(s, first)).not.toBeNull();
    const r = ringOf(first);
    // nothing with a site sits closer
    for (let q = -r; q <= r; q++) for (let p = -r; p <= r; p++) {
      const k = `${q},${p}`;
      if (ringOf(k) < r && siteAt(s, k)) throw new Error(`${k} is closer than ${first}`);
    }
    s.map.scouted.push(first);
    const second = nearestUnknown(s)!;
    expect(second).not.toBe(first);
    expect(ringOf(second)).toBeGreaterThanOrEqual(r);
  });
  it('is nothing once every mark has been seen', () => {
    const s = createInitialState(0, 5);
    for (let i = 0; i < 200; i++) {
      const k = nearestUnknown(s);
      if (!k) break;
      s.map.scouted.push(k);
    }
    expect(nearestUnknown(s)).toBeNull();
    expect(blockedBy(s, advisor.steps.find((x) => x.id === 'scouts')!)).toMatch(/every mark/i);
  });
});

describe('putting the counsel away', () => {
  it('is household business: no round runs, and the card is gone', () => {
    const g = new Game(createInitialState(0, 5));
    expect(currentAdvice(g.state)).not.toBeNull();
    g.dismissAdvisor();
    expect(g.state.round).toBe(0);
    expect(g.state.advisorDismissed).toBe(true);
    expect(currentAdvice(g.state)).toBeNull();
    expect(nextStep(g.state), 'the line itself is untouched').not.toBeNull();
    expect(renderPanel(g, 'village', null, 1)).not.toContain('data-advisor-step');
  });
  it('a save that predates the field keeps its place: a colony past its first round has no use for it', () => {
    const fresh = JSON.parse(serialise(createInitialState(0, 5)));
    delete fresh.advisorDismissed;
    expect(deserialise(JSON.stringify(fresh)).advisorDismissed).toBe(false);
    const g = new Game(createInitialState(0, 5));
    g.act({ type: 'convene' }, 1000);
    const old = JSON.parse(serialise(g.state));
    delete old.advisorDismissed;
    expect(deserialise(JSON.stringify(old)).advisorDismissed).toBe(true);
  });
  it('a new colony starts the line afresh', () => {
    expect(createInitialState(0, 9).advisorDismissed).toBe(false);
  });
});

function noHandlers(): PanelHandlers {
  return {
    onTab: () => {}, onChoice: () => {}, onScout: () => {}, onBuild: () => {}, onRush: () => {},
    onSelectSlot: () => {}, onAdoptNewMan: () => {}, onPolitical: () => {}, onEnvoy: () => {}, onTrade: () => {},
    onResearch: () => {}, onRushResearch: () => {}, onGuards: () => {},
    onExport: () => {}, onImport: () => {}, onReset: () => {},
    onSelectHex: () => {}, onDismissAdvisor: () => {},
  };
}

describe('the counsel card', () => {
  it('shows on every tab, titled from data, and badges the tab the step points at', () => {
    const g = new Game(createInitialState(0, 5));
    for (const t of TABS) {
      const html = renderPanel(g, t, null, 1);
      expect(html, t).toContain('data-advisor-step="iron"');
      expect(html, t).toContain(`<b>${advisor.title}</b>`);
      expect(html, t).toContain('data-select-slot="o5"');
      expect(html, t).toContain('data-advisor-dismiss');
      // the village tab carries the mark; the card sits between the nav and the body
      expect(html, t).toMatch(/data-tab="village"[^>]*>Village<span class="badge">!<\/span>/);
      expect(html.indexOf('</nav>'), t).toBeLessThan(html.indexOf('data-advisor-step'));
      expect(html.indexOf('data-advisor-step'), t).toBeLessThan(html.indexOf('<section>'));
    }
    expect(renderPanel(g, 'village', null, 1)).not.toMatch(/Council<span class="badge">/);
  });

  it('the Show-me button lands on the plot, the hex or the tab the step names', () => {
    const g = new Game(createInitialState(0, 5));
    g.build('o5', 'iron_mine', 1000);
    g.build('c2', 'castellum', 1000);
    const hex = nearestUnknown(g.state)!;
    let html = renderPanel(g, 'village', null, 1);
    expect(html).toContain('data-advisor-step="scouts"');
    expect(html).toContain(`data-select-hex="${hex}"`);
    expect(html).toMatch(/data-tab="map"[^>]*>Map<span class="badge">/);
    g.scout(hex, 1000);
    html = renderPanel(g, 'village', null, 1);
    expect(html).toContain('data-advisor-step="works"');
    expect(html).toContain('data-tab="council">Show me</button>');
    expect(html).toMatch(/data-tab="council"[^>]*>Council<span class="badge">/);
  });

  it('states the shortfall in units when the step cannot be taken yet', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.resources.wood = 0;
    const cost = checkBuild(g.state, 'o5', 'iron_mine').cost;
    expect(renderPanel(g, 'village', null, 1)).toContain(`Not yet: ${cost.wood} more wood.`);
  });

  it('routes its clicks: Show me selects, Enough counsel dismisses, a hex lands on the map', () => {
    const g = new Game(createInitialState(0, 5));
    const panel = document.createElement('div');
    const slots: string[] = [];
    const hexes: string[] = [];
    let dismissed = 0;
    bindPanel(panel, { ...noHandlers(), onSelectSlot: (id) => slots.push(id), onSelectHex: (h) => hexes.push(h), onDismissAdvisor: () => { dismissed += 1; } });
    panel.innerHTML = renderPanel(g, 'rome', null, 1);
    panel.querySelector<HTMLButtonElement>('aside.counsel [data-select-slot]')!.click();
    expect(slots).toEqual(['o5']);
    panel.querySelector<HTMLButtonElement>('aside.counsel [data-advisor-dismiss]')!.click();
    expect(dismissed).toBe(1);
    g.build('o5', 'iron_mine', 1000);
    g.build('c2', 'castellum', 1000);
    panel.innerHTML = renderPanel(g, 'village', null, 1);
    panel.querySelector<HTMLButtonElement>('aside.counsel [data-select-hex]')!.click();
    expect(hexes).toEqual([nearestUnknown(g.state)]);
  });

  it('marks the plot the step names on the village, and only that one', () => {
    const g = new Game(createInitialState(0, 5));
    const view = createVillageView(() => {});
    view.update(g.state, 0, null);
    const marked = [...view.root.querySelectorAll('.slot.counsel')].map((e) => e.getAttribute('data-slot'));
    expect(marked).toEqual(['o5']);
    g.build('o5', 'iron_mine', 1000);
    view.update(g.state, 1000, null);
    expect([...view.root.querySelectorAll('.slot.counsel')].map((e) => e.getAttribute('data-slot'))).toEqual(['c2']);
    g.dismissAdvisor();
    view.update(g.state, 1000, null);
    expect(view.root.querySelectorAll('.slot.counsel')).toHaveLength(0);
  });
});

describe('the founding card', () => {
  it('says who you are from data, names the houses from the colony, and ends on the first counsel', () => {
    const g = new Game(createInitialState(0, 5));
    const news = pendingNews(g.state)!;
    expect(news.kind).toBe('opening');
    expect(news.subtitle).toBe(advisor.founding.subtitle);
    const html = renderNews(news, g.state, 0);
    expect(html).toContain('news-card opening');
    const paras = foundingParagraphs(g.state, config.townName);
    expect(paras).toHaveLength(advisor.founding.paragraphs.length);
    expect(paras.join(' ')).toContain('gens Aurelia');
    expect(paras.join(' ')).toContain('Cornelii, Valerii and Claudii');
    expect(paras.join(' ')).not.toMatch(/\{\w+\}/);
    for (const p of paras) expect(html).toContain(p);
    expect(html).toContain('counsel-first');
    expect(html).toContain(advisor.steps[0].text);
    // the founding line from the log still stands beneath it
    expect(html).toContain('is founded');
    expect(html).not.toContain('Before you go');
  });
});

describe('before you go', () => {
  it('lists the jobs under way, the idle hours, and nothing that is not coming', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.build('o5', 'iron_mine', 1000);
    g.act({ type: 'convene' }, 2000);
    const news = pendingNews(g.state)!;
    expect(news.kind).toBe('report');
    const html = renderNews(news, g.state, 2000);
    expect(html).toContain('Before you go');
    expect(html).toContain('Iron mine I: about 2 minutes left.');
    expect(html).toContain(`council meets without you in about ${config.calendarFloorHours} hours.`);
    expect(html).not.toContain('massing');
    expect(html).not.toContain('ask for');
  });
  it('names a tribe massing with its price, and a demand with its due round', () => {
    const g = new Game(createInitialState(0, 5));
    g.act({ type: 'convene' }, 2000);
    const s = g.state;
    const tribeId = Object.keys(s.tribes)[0];
    s.tribes[tribeId].massingForRound = s.round + 1;
    s.families.cornelii.demand = { kind: 'denarii', denarii: 40, issuedRound: s.round, dueRound: s.round + 2 };
    const html = leavingCounsel(s, 2000);
    expect(html).toMatch(/are massing; the raid lands on round \d+\. \d+ denarii turns them back\./);
    expect(html).toContain(`The Cornelii ask for 40 denarii; an answer is expected by round ${s.round + 2}.`);
    // each once
    expect(html.match(/Before you go/g)).toHaveLength(1);
    expect(html.match(/council meets without you/g)).toHaveLength(1);
  });
});
