// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInitialState, serialise, deserialise } from '../src/state/store';
import { report, reportsOfRound, unreadReports } from '../src/state/reports';
import { Game } from '../src/game';
import { config, tribeDef, unlocks, RESOURCE_IDS } from '../src/data';
import { resolveRaid } from '../src/combat/raids';
import { appoint } from '../src/politics/posts';
import { claimSite, dispatchScout, mapTurn, resolveScout, setGarrison } from '../src/map/sites';
import { generate, mapConfig, site } from '../src/map/world';
import { dispatchEnvoy, resolveEnvoy } from '../src/tribes/envoys';
import { callChallenge, resolveChallenge } from '../src/politics/challenge';
import { checkCollapse, decline, deliver, romeTurn } from '../src/rome/requests';
import { bindPanel, pendingNews, renderNews, renderPanel, type PanelHandlers } from '../src/render/panel';
import { FILTERS, filterOfReport, renderReport, reportFilter, resetReportsView, reportsUnread, setReportFilter } from '../src/render/reports';
import { n } from '../src/render/overview';
import type { GameState, Report, ReportKind } from '../src/state/types';

const TRIBE_ID = 'chatti';
const CLOCK = /\d{1,2}:\d{2}/;

function findSite(s: GameState, pred: (id: string) => boolean): string {
  const w = generate(s.map.seed);
  const k = Object.keys(w.sites).find((x) => pred(w.sites[x]));
  if (!k) throw new Error('no such site in this world');
  return k;
}

/** The garrison post asks a rank of its holder; give him the standing and the post. */
function prefect(s: GameState, id: string) {
  s.characters[id].gravitas = 50;
  appoint(s, 'garrison', id);
}

function noHandlers(): PanelHandlers {
  return {
    onTab: () => {}, onChoice: () => {}, onScout: () => {}, onBuild: () => {}, onRush: () => {},
    onSelectSlot: () => {}, onAdoptNewMan: () => {}, onPolitical: () => {}, onEnvoy: () => {}, onTrade: () => {},
    onResearch: () => {}, onRushResearch: () => {}, onGuards: () => {},
    onExport: () => {}, onImport: () => {}, onReset: () => {},
    onSelectHex: () => {}, onDismissAdvisor: () => {},
  };
}

describe('the report writer', () => {
  it('writes the line and the record by one call, pointing at each other', () => {
    const s = createInitialState(0, 1);
    const r = report(s, 'collapse', { trigger: 'population', population: 3, corruption: 0, grant: {}, rounds: 4, untilRound: 4 }, 'Rome steps in.', 'rome');
    expect(s.log.at(-1)!.id).toBe(r.logId);
    expect(s.log.at(-1)!.text).toBe('Rome steps in.');
    expect(s.log.at(-1)!.kind).toBe('rome');
    expect(r.kind).toBe('collapse');
    expect(r.data.trigger).toBe('population');
    expect(s.reports).toEqual([r]);
    expect(r.round).toBe(s.round);
    expect(reportsOfRound(s, s.round)).toEqual([r]);
  });
  it('trims the oldest past config.reports.max', () => {
    const s = createInitialState(0, 1);
    for (let i = 0; i < config.reports.max + 5; i++) {
      report(s, 'collapse', { trigger: 'population', population: i, corruption: 0, grant: {}, rounds: 4, untilRound: 4 }, `n${i}`, 'rome');
    }
    expect(s.reports).toHaveLength(config.reports.max);
    expect(s.reports[0].kind === 'collapse' && s.reports[0].data.population).toBe(5);
    expect(s.reports.at(-1)!.id).toBe(config.reports.max + 5);
  });
  it('is unread until the log cursor passes it: no second cursor', () => {
    const s = createInitialState(0, 1);
    s.seenLogId = s.logSeq;
    const r = report(s, 'collapse', { trigger: 'population', population: 3, corruption: 0, grant: {}, rounds: 4, untilRound: 4 }, 'x', 'rome');
    expect(unreadReports(s)).toEqual([r]);
    expect(reportsUnread(s)).toBe(1);
    s.seenLogId = s.logSeq;
    expect(unreadReports(s)).toEqual([]);
  });
  it('round-trips through the save and migrates a save that predates it', () => {
    const g = new Game(createInitialState(0, 3));
    g.act({ type: 'convene' }, 1000);
    const s = g.state;
    expect(deserialise(serialise(s))).toEqual(s);
    const old = JSON.parse(serialise(createInitialState(7, 2))) as Record<string, unknown>;
    delete old.reports; delete old.reportSeq; delete old.history;
    const back = deserialise(JSON.stringify(old));
    expect(back.reports).toEqual([]);
    expect(back.reportSeq).toBe(0);
    expect(back.history).toEqual([]);
    expect(pendingNews({ ...back, seenLogId: back.logSeq, seenOpening: true })).toBeNull();
  });
});

describe('the raid report (DESIGN §8.2, trimmed form)', () => {
  function raided(seed = 1) {
    const s = createInitialState(0, seed);
    s.tribes[TRIBE_ID].strength = 100_000;
    s.resources.wood = 500;
    s.resources.clay = 120;
    prefect(s, 'c_nephew');
    s.seenLogId = s.logSeq;
    const result = resolveRaid(s, s.tribes[TRIBE_ID]);
    const r = s.reports.find((x) => x.kind === 'raid') as Extract<Report, { kind: 'raid' }>;
    return { s, result, r };
  }
  it('is written by the raid itself, carrying the terms, the goods and the fear as a change', () => {
    const { s, result, r } = raided();
    expect(r).toBeDefined();
    expect(s.reports.filter((x) => x.kind === 'raid')).toHaveLength(1);
    expect(s.log.find((e) => e.id === r.logId)!.text).toMatch(/raid the colony/);
    expect(r.data.tribeId).toBe(TRIBE_ID);
    expect(r.data.raid).toBe(result.raid);
    expect(r.data.defence.total).toBeCloseTo(result.defence, 9);
    // the goods carried off sum to what the prose says
    const lost = Object.values(r.data.goods).reduce((a, g) => a + g.lost, 0);
    const prose = s.log.find((e) => e.id === r.logId)!.text.match(/carry off (.*)\./)![1];
    const said = [...prose.matchAll(/(\d+) \w+/g)].reduce((a, m) => a + Number(m[1]), 0);
    expect(lost).toBe(said);
    expect(lost).toBe(Object.values(result.lost).reduce((a, b) => a + b, 0));
    for (const id of RESOURCE_IDS) {
      if (id === 'denarii') { expect(r.data.goods[id]).toBeUndefined(); continue; }
      const g = r.data.goods[id]!;
      expect(g.stored - g.hidden).toBe(g.exposed);
      expect(g.lost).toBeLessThanOrEqual(g.exposed);
    }
    expect(r.data.fear.after - r.data.fear.before).toBe(-config.raid.fearLossOnSuccess);
  });
  it('renders the four named terms against the raid and none of the tuning behind them', () => {
    const { s, r } = raided();
    const html = renderReport(r, s);
    expect(html).toContain(tribeDef(TRIBE_ID).name);
    expect(html).toContain('The ditch and bank');
    expect(html).toContain('The wall');
    expect(html).toContain('Home militia');
    expect(html).toContain(`${s.characters.c_nephew.name}'s discipline`);
    expect(html).toContain('carried off');
    expect(html).toContain('Their fear of you');
    for (const word of ['militiaWeight', 'garrisonDisciplineWeight', 'raidAppetite', 'leakedStrengthMultiplier', 'roll', 'fearLossOnSuccess', 'fearGainOnRepulse']) {
      expect(html, word).not.toContain(word);
    }
    // the terms shown sum to the defence shown, and the defence shown is the state's
    const terms = html.match(/<table class="terms">(.*?)<\/table>/)![1];
    const rows = [...terms.matchAll(/<tr(?: class="(total)")?><td>.*?<\/td><td>([^<]*)<\/td><\/tr>/g)];
    const parts = rows.filter((m) => !m[1]).map((m) => Number(m[2]));
    const totals = rows.filter((m) => m[1]).map((m) => Number(m[2]));
    expect(parts.length).toBeGreaterThanOrEqual(4);
    expect(totals).toHaveLength(2);
    for (const v of [...parts, ...totals]) expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(parts.reduce((a, b) => a + b, 0) - totals[0])).toBeLessThan(0.5);
    expect(totals[0]).toBe(Number(n(r.data.defence.total)));
    expect(totals[1]).toBe(Number(n(r.data.raid)));
    expect(html).not.toMatch(CLOCK);
  });
  it('names the prefect who fell with a way to the houses', () => {
    const { s, r } = (() => {
      const was = { ...config.raid };
      config.raid.holderDeathChance = 1;
      config.raid.holderDeathDisciplineRelief = 0;
      try { return raided(); } finally { Object.assign(config.raid, was); }
    })();
    expect(r.data.fellId).toBe('c_nephew');
    expect(s.characters.c_nephew.alive).toBe(false);
    expect(s.log.some((l) => /dies: on the wall/.test(l.text))).toBe(true);
    const html = renderReport(r, s);
    expect(html).toContain('fell on the wall');
    expect(html).toContain('data-tab="family"');
  });
  it('a repulsed raid says so and lists no goods', () => {
    const s = createInitialState(0, 1);
    s.tribes[TRIBE_ID].strength = 0;
    s.seenLogId = s.logSeq;
    resolveRaid(s, s.tribes[TRIBE_ID]);
    const r = s.reports[0] as Extract<Report, { kind: 'raid' }>;
    expect(r.data.fraction).toBe(0);
    const html = renderReport(r, s);
    expect(html).toContain('thrown back');
    expect(html).not.toContain('carried off');
    expect(r.data.fear.after - r.data.fear.before).toBe(config.raid.fearGainOnRepulse);
  });
});

describe('the site raid report', () => {
  it('records the garrison against the tribe, held or lost, without the roll', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 5000;
    s.round = mapConfig.hold.graceRounds + 1;
    const target = findSite(s, (id) => !site(id).hostile);
    dispatchScout(s, target);
    resolveScout(s);
    claimSite(s, target);
    setGarrison(s, target, 2, 10);
    const was = mapConfig.hold.raidChanceBase;
    mapConfig.hold.raidChanceBase = 1;
    try {
      for (let i = 0; i < 6 && !s.reports.some((r) => r.kind === 'site_raid'); i++) mapTurn(s);
    } finally { mapConfig.hold.raidChanceBase = was; }
    const r = s.reports.find((x) => x.kind === 'site_raid') as Extract<Report, { kind: 'site_raid' }>;
    expect(r).toBeDefined();
    expect(r.data.hex).toBe(target);
    expect(r.data.garrison).toBe(2);
    expect(r.data.defence).toBeCloseTo(2 * mapConfig.hold.garrisonStrengthPerMan, 9);
    expect(r.data.held).toBe(r.data.defence >= r.data.attack);
    expect(r.data.menLost).toBe(r.data.held ? 0 : 2);
    const html = renderReport(r, s);
    expect(html).toContain(site(r.data.siteId).name);
    expect(html).toContain(r.data.held ? 'held' : 'overrun');
    expect(html).not.toContain('roll');
    expect(html).not.toContain('tribeShareAgainstSite');
  });
});

describe('the scout report', () => {
  it('a bonus site: what stands there from data, and a way to claim it while in office', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 500;
    const target = findSite(s, (id) => !site(id).hostile && !!site(id).produces);
    dispatchScout(s, target);
    resolveScout(s);
    const r = s.reports.find((x) => x.kind === 'scout') as Extract<Report, { kind: 'scout' }>;
    expect(r.data.siteId).toBe(generate(s.map.seed).sites[target]);
    expect(r.data.hex).toBe(target);
    expect(r.data.claimable).toBe(true);
    const html = renderReport(r, s);
    expect(html).toContain(site(r.data.siteId!).name);
    expect(html).toContain('Yields');
    expect(html).toContain(`data-select-hex="${target}"`);
    expect(html).not.toMatch(CLOCK);
  });
  it('an ambush: the men, the coin and the fear shift on every tribe', () => {
    const s = createInitialState(0, 5);
    s.resources.denarii = 500;
    const camp = findSite(s, (id) => !!site(id).hostile);
    const fears = Object.fromEntries(Object.values(s.tribes).map((t) => [t.id, t.fear]));
    dispatchScout(s, camp);
    resolveScout(s);
    const r = s.reports.find((x) => x.kind === 'scout') as Extract<Report, { kind: 'scout' }>;
    expect(r.data.hostile).toBe(true);
    expect(r.data.casualties).toBe(mapConfig.scout.campCasualties);
    expect(r.data.denarii).toBe(mapConfig.scout.campDenarii);
    expect(r.data.fearShift).toBe(mapConfig.scout.campFear);
    for (const t of Object.values(s.tribes)) expect(t.fear).toBe(fears[t.id] + r.data.fearShift);
    expect(r.data.population.before - r.data.population.after).toBe(mapConfig.scout.campCasualties);
    const html = renderReport(r, s);
    expect(html).toContain('ambushed');
    expect(html).toContain("Every tribe's fear");
    expect(html).not.toContain('Claim it');
  });
});

describe('the envoy report', () => {
  it('carries fear and trust before and after, and what the web did as deltas', () => {
    const s = createInitialState(0, 1);
    s.tribes.chatti.trust = 100;
    s.tribes.chatti.fear = 0;
    dispatchEnvoy(s, 'chatti', 'propose_alliance');
    const before = Object.fromEntries(Object.values(s.tribes).map((t) => [t.id, { fear: t.fear, trust: t.trust }]));
    resolveEnvoy(s, s.tribes.chatti);
    const r = s.reports.find((x) => x.kind === 'envoy') as Extract<Report, { kind: 'envoy' }>;
    expect(r.data.envoyId).toBe('propose_alliance');
    expect(r.data.outcome).toBe('accepted');
    expect(r.data.trust.before).toBe(before.chatti.trust);
    expect(r.data.trust.after).toBe(s.tribes.chatti.trust);
    expect(r.data.fear.before).toBe(before.chatti.fear);
    expect(Object.keys(r.data.web).sort()).toEqual(['cherusci', 'sugambri']);
    for (const [oid, w] of Object.entries(r.data.web)) {
      expect(s.tribes[oid].trust).toBeCloseTo(before[oid].trust + w.trust, 9);
      expect(s.tribes[oid].fear).toBeCloseTo(before[oid].fear + w.fear, 9);
    }
    expect(r.data.web.cherusci.trust).toBeLessThan(0);
    const html = renderReport(r, s);
    expect(html).toContain('Propose alliance');
    expect(html).toContain('notice');
    for (const key of ['tributeFearThreshold', 'allianceTrustThreshold', 'allianceFearThreshold', 'hostageFearThreshold', 'webShare']) expect(html).not.toContain(key);
  });
  it('a refusal names the axis that fell short, never the threshold', () => {
    const s = createInitialState(0, 1);
    s.tribes.chatti.fear = 0;
    dispatchEnvoy(s, 'chatti', 'demand_tribute');
    resolveEnvoy(s, s.tribes.chatti);
    const r = s.reports.find((x) => x.kind === 'envoy') as Extract<Report, { kind: 'envoy' }>;
    expect(r.data.outcome).toBe('refused_fear');
    const html = renderReport(r, s);
    expect(html).toContain('They do not fear you enough.');
    expect(html).not.toContain(String(config.tribe.tributeFearThreshold));
  });
  it('an alliance refused names the axis on the side it failed: too much fear, or too little trust', () => {
    const feared = createInitialState(0, 1);
    feared.tribes.chatti.trust = 100;
    feared.tribes.chatti.fear = 100;
    dispatchEnvoy(feared, 'chatti', 'propose_alliance');
    resolveEnvoy(feared, feared.tribes.chatti);
    const a = feared.reports.find((x) => x.kind === 'envoy') as Extract<Report, { kind: 'envoy' }>;
    expect(a.data.outcome).toBe('refused_feared');
    expect(renderReport(a, feared)).toContain('They fear you too much');
    expect(renderReport(a, feared)).not.toContain('do not fear you enough');
    const distrusted = createInitialState(0, 1);
    distrusted.tribes.chatti.trust = 0;
    distrusted.tribes.chatti.fear = 0;
    dispatchEnvoy(distrusted, 'chatti', 'propose_alliance');
    resolveEnvoy(distrusted, distrusted.tribes.chatti);
    const b = distrusted.reports.find((x) => x.kind === 'envoy') as Extract<Report, { kind: 'envoy' }>;
    expect(b.data.outcome).toBe('refused_trust');
    expect(renderReport(b, distrusted)).toContain('They do not trust you enough.');
    for (const html of [renderReport(a, feared), renderReport(b, distrusted)]) {
      expect(html).not.toContain(String(config.tribe.allianceTrustThreshold));
      expect(html).not.toContain(String(config.tribe.allianceFearThreshold));
    }
  });
});

describe('the challenge report (DESIGN §9.5)', () => {
  it('is written when called with the count as it stood, and when resolved before the result is dropped', () => {
    const g = new Game(createInitialState(0, 5));
    callChallenge(g.state, 'cornelii');
    const called = g.state.reports.find((r) => r.kind === 'challenge') as Extract<Report, { kind: 'challenge' }>;
    expect(called.data.phase).toBe('called');
    expect(called.data.callerFamilyId).toBe('cornelii');
    const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
    expect(sum(called.data.tally)).toBe(Object.values(called.data.byHouse).reduce((a, h) => a + sum(h), 0));
    g.state.round = called.data.voteRound;
    resolveChallenge(g.state);
    expect(g.state.challenge).toBeNull();
    const resolved = g.state.reports.filter((r) => r.kind === 'challenge').at(-1) as Extract<Report, { kind: 'challenge' }>;
    expect(resolved.data.phase).toBe('resolved');
    expect(resolved.data.winnerId).toBe(g.state.office);
    expect(resolved.data.winnerGravitas).toBe(config.challenge.winnerGravitas);
    const html = renderReport(resolved, g.state);
    expect(html).toContain('The houses vote');
    expect(html).toContain('By house');
    expect(html).toContain(g.state.characters[g.state.office!].name);
    expect(renderReport(called, g.state)).toContain(`vote at round ${called.data.voteRound}`);
  });
});

describe("Rome's reports (DESIGN §6)", () => {
  function withRequest() {
    const s = createInitialState(0, 1);
    s.round = 1;
    s.seenLogId = s.logSeq;
    romeTurn(s);
    return s;
  }
  it('an issued request is a report with what is asked and what is promised', () => {
    const s = withRequest();
    const r = s.reports.find((x) => x.kind === 'rome') as Extract<Report, { kind: 'rome' }>;
    expect(r.data.phase).toBe('issued');
    expect(r.data.requestId).toBe('r01');
    expect(r.data.reward).toEqual({ denarii: 60 });
    expect(renderReport(r, s)).toContain('60 denarii');
  });
  it('a completed request: paid equals the treasury delta and favour moves by the data value', () => {
    const s = withRequest();
    s.resources.wood = 500;
    deliver(s);
    const coin = s.resources.denarii;
    const favour = s.rome.favour;
    const loy = Object.values(s.families).find((f) => f.loyalist && !f.isPlayer)!;
    const att = loy.attitude;
    romeTurn(s);
    const r = s.reports.filter((x) => x.kind === 'rome').at(-1) as Extract<Report, { kind: 'rome' }>;
    expect(r.data.phase).toBe('rewarded');
    expect(r.data.paid!.denarii).toBe(s.resources.denarii - coin);
    expect(r.data.paid!.denarii).toBe(Math.round(60 * r.data.multiplier!.favour * (1 + r.data.multiplier!.research)));
    expect(r.data.favourDelta).toBe(config.rome.completeFavour);
    expect(s.rome.favour - favour).toBe(config.rome.completeFavour);
    expect(r.data.loyalistAttitudeDelta).toBe(config.rome.completeLoyalistAttitude);
    expect(loy.attitude - att).toBe(config.rome.completeLoyalistAttitude);
    const html = renderReport(r, s);
    expect(html).toContain('Rome pays for');
    expect(html).toContain(`+${config.rome.completeFavour}`);
  });
  it('a declined request carries the favour it cost', () => {
    const s = withRequest();
    decline(s);
    const r = s.reports.filter((x) => x.kind === 'rome').at(-1) as Extract<Report, { kind: 'rome' }>;
    expect(r.data.phase).toBe('declined');
    expect(r.data.favourDelta).toBe(config.rome.declineFavour);
    expect(renderReport(r, s)).toContain('unanswered');
  });
  it('a withheld gift is named with the favour it waits on', () => {
    const s = createInitialState(0, 1);
    s.rome.favour = 0;
    s.rome.activeRequest = {
      id: 'x', title: 'A gift', text: '', kind: 'deliver', deliver: { wood: 1 },
      reward: { unlock: 'catapult' }, delivered: {}, fulfilled: true, issuedRound: 0,
    };
    romeTurn(s);
    const r = s.reports.filter((x) => x.kind === 'rome').at(-1) as Extract<Report, { kind: 'rome' }>;
    expect(r.data.withheld).toEqual({ unlock: 'catapult', minFavour: config.rome.unlockMinFavour });
    expect(renderReport(r, s)).toContain(`${unlocks.catapult.name}</td><td class="neg">withheld until favour ${config.rome.unlockMinFavour}`);
  });
  it('the favour and regard a completed request earns live in data, not in the code', () => {
    const src = readFileSync(join(process.cwd(), 'src/rome/requests.ts'), 'utf8');
    expect(src).not.toMatch(/favour \+= \d/);
    expect(src).not.toMatch(/attitude \+ \d/);
    expect(config.rome.completeFavour).toBe(5);
    expect(config.rome.completeLoyalistAttitude).toBe(3);
  });
  it('a collapse names its trigger, the grant and the rounds administered', () => {
    const s = createInitialState(0, 1);
    s.population = config.collapse.populationFloor;
    expect(checkCollapse(s)).toBe(true);
    const r = s.reports.find((x) => x.kind === 'collapse') as Extract<Report, { kind: 'collapse' }>;
    expect(r.data.trigger).toBe('population');
    expect(r.data.grant).toEqual(config.collapse.grant);
    expect(r.data.rounds).toBe(config.collapse.administrationRounds);
    const html = renderReport(r, s);
    expect(html).toContain('Population fell to');
    expect(html).toContain(`until round ${r.data.untilRound}`);
    const c = createInitialState(0, 1);
    c.corruption = config.collapse.corruptionCeiling;
    checkCollapse(c);
    expect((c.reports[0] as Extract<Report, { kind: 'collapse' }>).data.trigger).toBe('corruption');
  });
});

describe('every kind renders, and the folders cover every kind', () => {
  it('renderReport returns a card for every kind that reaches the log', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.resources.denarii = 5000;
    g.state.tribes.chatti.strength = 100_000;
    g.state.tribes.chatti.massingForRound = 1;
    // distinctive clock values, so the card can be checked for never printing them
    g.scout(findSite(g.state, () => true), 7_654_001);
    g.dispatchEnvoy('cherusci', 'warn_of_raid', 7_654_002);
    callChallenge(g.state, 'cornelii');
    g.act({ type: 'convene' }, 7_654_003);
    g.state.population = 1;
    g.act({ type: 'convene' }, 7_654_004);
    const kinds = new Set(g.state.reports.map((r) => r.kind));
    for (const k of ['raid', 'scout', 'envoy', 'challenge', 'rome', 'collapse'] as ReportKind[]) expect(kinds.has(k), k).toBe(true);
    for (const r of g.state.reports) {
      const html = renderReport(r, g.state);
      expect(html.length, r.kind).toBeGreaterThan(40);
      expect(html).toContain(`data-report-kind="${r.kind}"`);
      expect(html).not.toMatch(CLOCK);
      expect(html).not.toContain(String(r.at));
    }
  });
  it('the filter folders are derived from Report.kind, one folder per kind', () => {
    const ids = FILTERS.map((f) => f.id);
    for (const k of ['raid', 'site_raid', 'scout', 'envoy', 'challenge', 'rome', 'collapse'] as ReportKind[]) {
      expect(ids).toContain(filterOfReport(k));
    }
    setReportFilter('nonsense');
    expect(reportFilter()).toBe('all');
    resetReportsView();
  });
});

describe('the Reports tab', () => {
  function played() {
    const g = new Game(createInitialState(0, 5));
    g.state.resources.denarii = 5000;
    g.state.tribes.chatti.strength = 100_000;
    g.state.tribes.chatti.massingForRound = 1;
    g.act({ type: 'convene' }, 7_654_001);
    g.act({ type: 'convene' }, 7_654_002);
    g.act({ type: 'convene' }, 7_654_003);
    resetReportsView();
    return g;
  }
  it('lists the rounds newest first with the ledger, the cards and the log inside', () => {
    const g = played();
    const html = renderPanel(g, 'log', null, 4000);
    expect(html).toContain('<h2>Reports</h2>');
    const rounds = [...html.matchAll(/data-menu="round-(\d+)"/g)].map((m) => Number(m[1]));
    expect(rounds).toEqual([3, 2, 1]);
    expect(html.indexOf('data-menu="round-3"')).toBeLessThan(html.indexOf('data-menu="round-1"'));
    expect(html).toContain('class="ledger-round" data-round="3"');
    expect(html).toContain('data-report-kind="raid"');
    expect(html).toContain('<summary>The log</summary>');
    expect(html).toContain('is founded');
    expect(html).not.toMatch(CLOCK);
    for (const r of g.state.history) expect(html).not.toContain(String(r.at));
    // the newest round is open, older ones shut
    expect(html).toMatch(/data-menu="round-3" open/);
    expect(html).not.toMatch(/data-menu="round-1" open/);
  });
  it('a folder shows only its own kind and skips rounds with nothing in it', () => {
    const g = played();
    setReportFilter('raid');
    const html = renderPanel(g, 'log', null, 4000);
    expect(html).toContain('data-report-kind="raid"');
    expect(html).not.toContain('data-report-kind="rome"');
    expect(html).not.toContain('k-council');
    expect(html).not.toContain('ledger-round');
    setReportFilter('council');
    const council = renderPanel(g, 'log', null, 4000);
    expect(council).not.toContain('data-report-kind="raid"');
    resetReportsView();
  });
  it('the tab keeps its id and the bar its count, and the badge is the unread reports', () => {
    const g = played();
    g.state.seenLogId = 0;
    const html = renderPanel(g, 'village', null, 4000);
    expect(html).toContain('data-tab="log"');
    expect(html).toMatch(/data-tab="log"[^>]*>Reports<span class="badge">\d+<\/span>/);
    expect(html).toContain(`>Reports<span class="badge">${reportsUnread(g.state)}</span>`);
    expect(reportsUnread(g.state)).toBe(g.state.reports.length);
    g.state.seenLogId = g.state.logSeq;
    expect(renderPanel(g, 'village', null, 4000)).not.toMatch(/Reports<span class="badge"/);
    expect(html.match(/<nav>(.*?)<\/nav>/)![1].match(/<button/g)).toHaveLength(9);
  });
  it('the folder buttons route through the tab, and an opened round stays open across re-renders', () => {
    const g = played();
    const tabs: string[] = [];
    const el = document.createElement('div');
    el.innerHTML = renderPanel(g, 'log', null, 4000);
    document.body.appendChild(el);
    bindPanel(el, { ...noHandlers(), onTab: (t) => tabs.push(t) });
    el.querySelector<HTMLButtonElement>('[data-report-filter="rome"]')!.click();
    expect(tabs).toEqual(['log']);
    expect(reportFilter()).toBe('rome');
    resetReportsView();
    const d = el.querySelector<HTMLDetailsElement>('details[data-menu="round-1"]')!;
    expect(d.open).toBe(false);
    d.open = true;
    d.dispatchEvent(new Event('toggle'));
    el.innerHTML = renderPanel(g, 'log', null, 5000);
    expect(el.querySelector<HTMLDetailsElement>('details[data-menu="round-1"]')!.open).toBe(true);
    const top = el.querySelector<HTMLDetailsElement>('details[data-menu="round-3"]')!;
    top.open = false;
    top.dispatchEvent(new Event('toggle'));
    el.innerHTML = renderPanel(g, 'log', null, 6000);
    expect(el.querySelector<HTMLDetailsElement>('details[data-menu="round-3"]')!.open).toBe(false);
    resetReportsView();
    el.remove();
  });
  it('lines written after the last round sit in a group of their own at the top', () => {
    const g = played();
    g.dispatchEnvoy('chatti', 'warn_of_raid', 4000);
    const html = renderPanel(g, 'log', null, 4000);
    expect(html).toContain(`data-menu="round-since"`);
    expect(html.indexOf('round-since')).toBeLessThan(html.indexOf('data-menu="round-3"'));
    expect(html).toContain(`Since round ${g.state.round}`);
  });
});

describe('the round card carries the record', () => {
  it('shows the ledger and the cards above the lines, and does not read a card twice', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.state.tribes.chatti.strength = 100_000;
    g.state.tribes.chatti.massingForRound = 1;
    g.act({ type: 'convene' }, 1000);
    const news = pendingNews(g.state)!;
    expect(news.kind).toBe('report');
    const html = renderNews(news, g.state, 1000);
    expect(html).toContain('ledger-round');
    expect(html).toContain('data-report-kind="raid"');
    const raid = g.state.reports.find((r) => r.kind === 'raid')!;
    const line = g.state.log.find((e) => e.id === raid.logId)!.text;
    expect(html.split(line).length - 1, 'the raid line appears once, in its card').toBe(1);
    expect(html.indexOf('ledger-round')).toBeLessThan(html.indexOf('<ul>'));
    expect(html).not.toMatch(CLOCK);
    expect(html).toContain('Continue');
  });
  it('a card raised by a later line does not repeat the ledger of a round already read', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.seenLogId = g.state.logSeq;
    g.state.seenOpening = true;
    g.act({ type: 'convene' }, 1000);
    expect(renderNews(pendingNews(g.state)!, g.state, 1000)).toContain('ledger-round');
    g.state.seenLogId = g.state.logSeq; // Continue
    g.dispatchEnvoy('chatti', 'warn_of_raid', 2000);
    const news = pendingNews(g.state)!;
    expect(news.kind).toBe('report');
    const html = renderNews(news, g.state, 2000);
    expect(html).not.toContain('ledger-round');
    expect(html).toContain('An envoy sets out');
  });
});
