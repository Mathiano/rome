/**
 * The reports archive (reports unit): the record behind the log lines, in
 * words. One renderer per report kind, used by the Round card, the away
 * digest and the Reports tab alike, so the overlay and the archive never
 * disagree. Nothing in this file is a rule and nothing here is a time: a
 * report is placed by its round, never by the clock it was written at.
 */
import { config, envoys, post as postDef, tribeDef, unlocks, RESOURCE_IDS, type ResourceId } from '../data';
import type { GameState, LogEntry, Report, ReportKind, RoundReport } from '../state/types';
import { site as siteDef } from '../map/world';
import { esc, n, rewardWords, ROMAN } from './overview';
import type { News } from './panel';

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${n(Math.abs(v))}`;
/** A change, or nothing when there was none. */
const moved = (v: number) => (n(v) === '0' ? '' : `<span class="${cls(v)}">${signed(v)}</span>`);
const cls = (v: number) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const plural = (v: number, one: string, many = `${one}s`) => `${v} ${v === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// The kind filter, derived from Report.kind so the two never drift

export type ReportFilter = 'all' | 'raid' | 'map' | 'tribe' | 'council' | 'rome' | 'family';
export const FILTERS: { id: ReportFilter; name: string }[] = [
  { id: 'all', name: 'Everything' },
  { id: 'raid', name: 'Raids' },
  { id: 'map', name: 'The country' },
  { id: 'tribe', name: 'The tribes' },
  { id: 'council', name: 'The council' },
  { id: 'rome', name: 'Rome' },
  { id: 'family', name: 'The houses' },
];
/** Every report kind lands in exactly one folder; the type makes the table complete. */
const KIND_FILTER: Record<ReportKind, ReportFilter> = {
  raid: 'raid', site_raid: 'raid', scout: 'map', envoy: 'tribe', challenge: 'council', rome: 'rome', collapse: 'rome',
};
/** Prose lines follow the same folders; what has none shows under Everything only. */
const LINE_FILTER: Record<LogEntry['kind'], ReportFilter | null> = {
  raid: 'raid', map: 'map', tribe: 'tribe', council: 'council', rome: 'rome', family: 'family', village: null, event: null, system: null,
};
export const filterOfReport = (k: ReportKind): ReportFilter => KIND_FILTER[k];
export const filterOfLine = (k: LogEntry['kind']): ReportFilter | null => LINE_FILTER[k];

let filter: ReportFilter = 'all';
export function reportFilter(): ReportFilter { return filter; }
export function setReportFilter(f: string): void {
  filter = FILTERS.some((x) => x.id === f) ? (f as ReportFilter) : 'all';
}

/** Which rounds the player has opened or shut; the newest is open unless shut. */
const toggled = new Map<string, boolean>();
export function rememberOpen(id: string, open: boolean): void { toggled.set(id, open); }
export function resetReportsView(): void { toggled.clear(); filter = 'all'; }

/** Reports the player has not acknowledged, for the tab's badge. */
export function reportsUnread(state: GameState): number {
  return state.reports.filter((r) => r.logId > state.seenLogId).length;
}

// ---------------------------------------------------------------------------
// One report

function lineOf(state: GameState, r: Report): string {
  return state.log.find((e) => e.id === r.logId)?.text ?? '';
}

function card(r: Report, title: string, body: string): string {
  return `<div class="card report k-${r.kind}" data-report="${r.id}" data-report-kind="${r.kind}"><b>${title}</b>${body}</div>`;
}

export function renderReport(r: Report, state: GameState): string {
  switch (r.kind) {
    case 'raid': return renderRaidReport(r, state);
    case 'site_raid': return renderSiteRaidReport(r, state);
    case 'scout': return renderScoutReport(r, state);
    case 'envoy': return renderEnvoyReport(r, state);
    case 'challenge': return renderChallengeReport(r, state);
    case 'rome': return renderRomeReport(r, state);
    case 'collapse': return renderCollapseReport(r, state);
  }
}

/**
 * The raid in the terms of DESIGN §8.2: the ditch and bank, the wall, the
 * home militia and the prefect's discipline against the raid's strength,
 * each with its multiplier folded in; what was in store, hidden, exposed
 * and carried off; fear as the observed change; and who fell.
 */
export function renderRaidReport(r: Extract<Report, { kind: 'raid' }>, state: GameState): string {
  const d = r.data;
  const tribe = tribeDef(d.tribeId).name;
  const def = d.defence;
  const through = d.fraction > 0;
  const rows: string[] = [];
  rows.push(`<tr><td>The ditch and bank</td><td>${n(def.ditch)}</td></tr>`);
  rows.push(`<tr><td>The wall</td><td>${n(def.wall)}</td></tr>`);
  const elsewhere: string[] = [];
  if (def.men.garrisons) elsewhere.push(`${def.men.garrisons} in the far holdings`);
  if (def.men.bodyguards) elsewhere.push(`${def.men.bodyguards} standing guard`);
  rows.push(`<tr><td>Home militia, ${plural(def.men.home, 'man', 'men')}${elsewhere.length ? ` <span class="muted">(${elsewhere.join(', ')})</span>` : ''}</td><td>${n(def.militia)}</td></tr>`);
  const prefect = def.prefectId ? state.characters[def.prefectId] : null;
  const garrisonLabel = !prefect ? `${esc(postDef('garrison').name)} — vacant`
    : def.obstructed ? `${esc(prefect.name)} obstructs the garrison`
      : `${esc(prefect.name)}'s discipline`;
  rows.push(`<tr><td>${garrisonLabel}</td><td>${n(def.garrison)}</td></tr>`);
  if (def.engines) rows.push(`<tr><td>Rome's engines</td><td>${n(def.engines)}</td></tr>`);
  if (def.lesser) rows.push(`<tr><td>The lesser offices</td><td>${n(def.lesser)}</td></tr>`);
  rows.push(`<tr class="total"><td>Defence</td><td>${n(def.total)}</td></tr>`);
  rows.push(`<tr class="total"><td>${esc(tribe)}, raid strength</td><td>${n(d.raid)}</td></tr>`);
  let body = `<p>${esc(lineOf(state, r))}</p><table class="terms">${rows.join('')}</table>`;
  const goods = RESOURCE_IDS.filter((id) => d.goods[id] && d.goods[id]!.stored > 0);
  if (through && goods.length) {
    body += `<table class="goods"><tr><th></th><th>in store</th><th>hidden</th><th>exposed</th><th>carried off</th></tr>`;
    for (const id of goods) {
      const g = d.goods[id]!;
      body += `<tr><td>${id}</td><td>${n(g.stored)}</td><td>${n(g.hidden)}</td><td>${n(g.exposed)}</td><td class="${g.lost ? 'neg' : ''}">${n(g.lost)}</td></tr>`;
    }
    body += `</table>`;
  }
  body += `<p class="muted">Their fear of you: ${n(d.fear.before)} → ${n(d.fear.after)} (${signed(d.fear.after - d.fear.before)}).</p>`;
  if (d.fellId) {
    const c = state.characters[d.fellId];
    if (c) body += `<p class="fell">${esc(c.name)} of the ${esc(state.families[c.familyId].name)} fell on the wall. <button class="link" data-tab="family">The houses</button></p>`;
  }
  return card(r, `${esc(tribe)} raid the colony — ${through ? 'they get through' : 'thrown back'}`, body);
}

export function renderSiteRaidReport(r: Extract<Report, { kind: 'site_raid' }>, state: GameState): string {
  const d = r.data;
  const tribe = tribeDef(d.tribeId).name;
  const site = siteDef(d.siteId).name;
  let body = `<p>${esc(lineOf(state, r))}</p><table class="terms">
    <tr><td>Garrison, ${plural(d.garrison, 'man', 'men')}</td><td>${n(d.defence)}</td></tr>
    <tr class="total"><td>${esc(tribe)}, against the holding</td><td>${n(d.attack)}</td></tr></table>`;
  body += d.held ? `<p>The holding is held.</p>` : `<p class="neg">${plural(d.menLost, 'man', 'men')} lost, and ${esc(site)} with them.</p>`;
  body += `<p class="muted">Their fear of you: ${n(d.fear.before)} → ${n(d.fear.after)} (${signed(d.fear.after - d.fear.before)}).</p>`;
  return card(r, `${esc(tribe)} against ${esc(site)} at ${esc(d.hex)} — ${d.held ? 'held' : 'overrun'}`, body);
}

export function renderScoutReport(r: Extract<Report, { kind: 'scout' }>, state: GameState): string {
  const d = r.data;
  const def = d.siteId ? siteDef(d.siteId) : null;
  const where = `${esc(d.hex)}, ${d.ring} rings out`;
  let body = `<p>${esc(lineOf(state, r))}</p>`;
  if (d.hostile) {
    body += `<table class="terms"><tr><td>Men who did not come back</td><td class="neg">${d.casualties}</td></tr>`;
    if (d.denarii) body += `<tr><td>Denarii lost with them</td><td class="neg">${n(Math.abs(d.denarii))}</td></tr>`;
    body += `<tr><td>Every tribe's fear of you</td><td class="${cls(d.fearShift)}">${signed(d.fearShift)}</td></tr></table>`;
    body += `<p class="muted">Population ${Math.floor(d.population.before)} → ${Math.floor(d.population.after)}.</p>`;
    return card(r, `Scouts ambushed at ${where}`, body);
  }
  if (!def) return card(r, `Scouts: empty country at ${where}`, body);
  if (def.produces) body += `<p>Yields ${Object.entries(def.produces).map(([k, v]) => `${v} ${k}/h`).join(', ')} if held.</p>`;
  if (def.effect) body += `<p>${Object.entries(def.effect).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')} if held.</p>`;
  if (d.scrolls) body += `<p>${plural(d.scrolls, 'research scroll')} brought back to the Library.</p>`;
  if (d.claimable) body += `<p><button class="link" data-select-hex="${esc(d.hex)}">Claim it on the map</button></p>`;
  return card(r, `Scouts: ${esc(def.name)} at ${where}`, body);
}

const OUTCOME_WORDS: Record<Extract<Report, { kind: 'envoy' }>['data']['outcome'], string> = {
  accepted: '',
  refused_fear: 'They do not fear you enough.',
  refused_feared: 'They fear you too much to ally.',
  refused_trust: 'They do not trust you enough.',
  no_market: 'There is no market to trade at.',
};

export function renderEnvoyReport(r: Extract<Report, { kind: 'envoy' }>, state: GameState): string {
  const d = r.data;
  const tribe = tribeDef(d.tribeId).name;
  const envoy = envoys.find((e) => e.id === d.envoyId)?.name ?? d.envoyId;
  let body = `<p>${esc(lineOf(state, r))}${OUTCOME_WORDS[d.outcome] ? ` ${OUTCOME_WORDS[d.outcome]}` : ''}</p>`;
  body += `<table class="terms">
    <tr><td>Fear</td><td>${n(d.fear.before)} → ${n(d.fear.after)} ${moved(d.fear.after - d.fear.before)}</td></tr>
    <tr><td>Trust</td><td>${n(d.trust.before)} → ${n(d.trust.after)} ${moved(d.trust.after - d.trust.before)}</td></tr>`;
  for (const [oid, w] of Object.entries(d.web)) {
    if (!w.trust && !w.fear) continue;
    const parts = [w.trust ? `trust ${signed(w.trust)}` : '', w.fear ? `fear ${signed(w.fear)}` : ''].filter(Boolean).join(', ');
    body += `<tr><td>${esc(tribeDef(oid).name)} notice</td><td>${parts}</td></tr>`;
  }
  body += `</table>`;
  return card(r, `${esc(envoy)} — ${esc(tribe)}`, body);
}

export function renderChallengeReport(r: Extract<Report, { kind: 'challenge' }>, state: GameState): string {
  const d = r.data;
  const caller = state.families[d.callerFamilyId]?.name ?? d.callerFamilyId;
  const who = (cid: string) => state.characters[cid]?.name ?? cid;
  const house = (cid: string) => state.families[state.characters[cid]?.familyId]?.name ?? '';
  let body = `<p>${esc(lineOf(state, r))}</p><table class="terms">`;
  for (const [cid, v] of Object.entries(d.tally).sort((a, b) => b[1] - a[1])) {
    body += `<tr class="${cid === d.winnerId ? 'total' : ''}"><td>${esc(who(cid))} <span class="muted">${esc(house(cid))}</span></td><td>${v}</td></tr>`;
  }
  body += `</table><p class="muted">By house: ${Object.entries(d.byHouse).map(([fid, votes]) => {
    const parts = Object.entries(votes).map(([cid, v]) => `${v} for ${esc(who(cid))}`).join(', ');
    return `the ${esc(state.families[fid]?.name ?? fid)} ${parts || 'cast nothing'}`;
  }).join('; ')}.</p>`;
  if (d.phase === 'called') {
    return card(r, `The ${esc(caller)} call a challenge — the houses vote at round ${d.voteRound}`, body);
  }
  const winner = d.winnerId ? who(d.winnerId) : 'Nobody';
  if (d.winnerId && d.winnerGravitas) body += `<p>${esc(winner)} ${d.held ? 'keeps' : 'takes'} the office and gains ${d.winnerGravitas} gravitas.</p>`;
  if (!d.held && d.loserAttitude) body += `<p class="muted">The other houses' regard for you moves ${signed(d.loserAttitude)}.</p>`;
  return card(r, `The houses vote — ${esc(winner)} ${d.held ? 'holds' : 'takes'} the office`, body);
}

export function renderRomeReport(r: Extract<Report, { kind: 'rome' }>, state: GameState): string {
  const d = r.data;
  let body = `<p>${esc(lineOf(state, r))}</p>`;
  if (d.phase === 'issued') {
    body += `<p class="muted">Promised: ${esc(rewardWords(d.reward) || 'its thanks')}.</p>`;
    return card(r, `Rome asks: ${esc(d.title)}`, body);
  }
  if (d.phase === 'declined') {
    // DESIGN §6: Rome does not punish. The card says what the colony gave up
    // and whose regard fell; favour is not on it because favour did not move.
    const forgone = rewardWords(d.reward);
    body += `<p data-forgone>You forgo ${esc(forgone || "Rome's thanks")}.</p>`;
    if (d.loyalistAttitudeDelta) {
      const house = d.loyalistId ? state.families[d.loyalistId]?.name : undefined;
      body += `<table class="terms"><tr><td>${house ? `The ${esc(house)}'s regard for you` : "The loyalist house's regard"}</td><td class="${cls(d.loyalistAttitudeDelta)}">${signed(d.loyalistAttitudeDelta)}</td></tr></table>`;
    }
    return card(r, `Rome unanswered: ${esc(d.title)}`, body);
  }
  const m = d.multiplier ?? { research: 0, favour: 1 };
  const p = d.paid ?? { denarii: 0, scrolls: 0, gravitas: 0, unlock: null };
  body += `<table class="terms">`;
  if (d.reward.denarii) {
    const working = [m.research ? `the Library's ${Math.round(m.research * 100)}%` : '', `favour at ${Math.round(m.favour * 100)}%`].filter(Boolean).join(', ');
    body += `<tr><td>Denarii: ${d.reward.denarii} promised, ${working}</td><td class="pos">${p.denarii}</td></tr>`;
  }
  if (p.scrolls) body += `<tr><td>Research scrolls</td><td class="pos">${p.scrolls}</td></tr>`;
  if (p.gravitas) body += `<tr><td>Gravitas to your leader</td><td class="pos">${p.gravitas}</td></tr>`;
  if (p.unlock) body += `<tr><td>${esc(unlocks[p.unlock]?.name ?? p.unlock)}</td><td>sent</td></tr>`;
  if (d.withheld) body += `<tr><td>${esc(unlocks[d.withheld.unlock]?.name ?? d.withheld.unlock)}</td><td class="neg">withheld until favour ${d.withheld.minFavour}</td></tr>`;
  body += `<tr><td>Rome's favour</td><td class="${cls(d.favourDelta ?? 0)}">${signed(d.favourDelta ?? 0)}</td></tr>`;
  if (d.loyalistAttitudeDelta) body += `<tr><td>The loyalist house's regard</td><td class="${cls(d.loyalistAttitudeDelta)}">${signed(d.loyalistAttitudeDelta)}</td></tr>`;
  body += `</table>`;
  return card(r, `Rome pays for ${esc(d.title)}`, body);
}

export function renderCollapseReport(r: Extract<Report, { kind: 'collapse' }>, state: GameState): string {
  const d = r.data;
  const c = config.collapse;
  const why = d.trigger === 'population'
    ? `Population fell to ${Math.floor(d.population)}; the floor is ${c.populationFloor}.`
    : `Corruption reached ${n(d.corruption)}; the ceiling is ${c.corruptionCeiling}.`;
  let body = `<p>${esc(lineOf(state, r))}</p><p>${why}</p>`;
  const grant = Object.entries(d.grant).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ');
  if (grant) body += `<p>Rome's grant: ${grant}.</p>`;
  body += `<p class="muted">A procurator administers until round ${d.untilRound} (${plural(d.rounds, 'round')}). The council is cleared; research and your house stand.</p>`;
  return card(r, 'Rome steps in', body);
}

// ---------------------------------------------------------------------------
// The round ledger: before → after

/** The colony's numbers as the round found and left them. Nothing here is a clock. */
export function renderRoundLedger(r: RoundReport): string {
  if (!r.before) return '';
  const row = (label: string, a: number, b: number) =>
    `<tr><td>${label}</td><td>${n(a)}</td><td>${n(b)}</td><td class="${cls(b - a)}">${b === a ? '' : signed(b - a)}</td></tr>`;
  let out = `<table class="ledger-round" data-round="${r.round}"><tr><th></th><th>before</th><th>after</th><th></th></tr>`;
  for (const id of RESOURCE_IDS) out += row(id, r.before.resources[id as ResourceId], r.resources[id as ResourceId]);
  out += row('population', r.before.population, r.population);
  out += row('corruption', r.before.corruption, r.corruption);
  return out + `</table>`;
}

/** The player's own step-1 action is applied before the round, so it is outside the window. */
const LEDGER_NOTE = `<p class="muted">What the round took and gave. Your own move before it is not counted here.</p>`;

// ---------------------------------------------------------------------------
// The news card: one round, or the digest of the rounds that ran away

/**
 * What the Round card shows above its lines: the ledger, then the round's
 * reports as cards. Lines a card already carries are handed back as `covered`
 * so the card is not read twice.
 */
export function renderNewsRecord(state: GameState, news: News): { html: string; covered: Set<number> } {
  const covered = new Set<number>();
  if (news.kind === 'report') {
    const r = state.lastReport;
    if (!r) return { html: '', covered };
    // The ledger is the round's own news; a card raised by a later line (an
    // envoy sent, a request declined) does not repeat a round already read.
    const fresh = r.toLogId === undefined || r.toLogId > state.seenLogId;
    let html = fresh ? renderRoundLedger(r) : '';
    if (html) html += LEDGER_NOTE;
    for (const rep of state.reports) {
      if (rep.logId <= state.seenLogId) continue;
      html += renderReport(rep, state);
      covered.add(rep.logId);
    }
    return { html, covered };
  }
  if (news.kind === 'away') return renderAwayDigest(state, covered);
  return { html: '', covered };
}

/**
 * The digest (DESIGN §3.3): one summary of the whole absence — a line of
 * tally, one ledger across every idle round, and the rounds' lines as one list
 * under it (renderNews prints them). Up to seven rounds, never a stack of them.
 */
function renderAwayDigest(state: GameState, covered: Set<number>): { html: string; covered: Set<number> } {
  const rounds = state.history.slice(-state.awayRounds).filter((r) => r.idle);
  if (!rounds.length) return { html: '', covered };
  const raids = state.reports.filter((r) => rounds.some((h) => h.round === r.round) && (r.kind === 'raid' || r.kind === 'site_raid'));
  const through = raids.filter((r) => (r.kind === 'raid' && r.data.fraction > 0) || (r.kind === 'site_raid' && !r.data.held)).length;
  const tally: string[] = [];
  tally.push(raids.length ? `${plural(raids.length, 'raid')}, ${through} got through` : 'no raids');
  const demands = Object.values(state.families).filter((f) => f.demand).length;
  if (demands) tally.push(`${plural(demands, 'demand')} waiting`);
  if (state.challenge) tally.push('a vote pending');
  if (state.rome.activeRequest && !state.rome.activeRequest.fulfilled) tally.push(`Rome asks for ${esc(state.rome.activeRequest.title)}`);
  let html = `<p class="tally-line">${tally.join(' · ')}.</p>`;
  // One summary for the whole absence (Mathias, 2026-09-24), not a folder and a
  // ledger per round stacked one above the other: one ledger from before the
  // first idle round to after the last, then the rounds' lines as one list.
  // Each round, with its report cards, stays under Reports.
  const first = rounds[0];
  const last = rounds[rounds.length - 1];
  if (first.before) {
    const span = first.round === last.round ? `Round ${last.round}` : `Rounds ${first.round}–${last.round}`;
    html += renderRoundLedger({ ...last, before: first.before })
      + `<p class="muted">What ${esc(span.toLowerCase())} took and gave, together. Each round is under Reports.</p>`;
  }
  // The idle markers say only that a round ran; the subtitle already counts them.
  for (const r of rounds) {
    const { from, to } = rangeOfRound(state, r);
    for (const e of state.log) if (e.id > from && e.id <= to && /^Round \d+: the council meets without you\.$/.test(e.text)) covered.add(e.id);
  }
  return { html, covered };
}

// ---------------------------------------------------------------------------
// The Reports tab

/**
 * The lines a round wrote, from the end of the round before it to its own
 * end, so what the player did between the two (a build, the move that called
 * the round) sits with the round it led to. The first round takes the
 * founding with it.
 */
function rangeOfRound(state: GameState, r: RoundReport): { from: number; to: number } {
  const i = state.history.indexOf(r);
  const prev = i > 0 ? state.history[i - 1] : null;
  const from = prev ? prev.toLogId ?? prev.fromLogId : r.round === 1 ? 0 : r.fromLogId;
  return { from, to: r.toLogId ?? Infinity };
}

function linesOfRound(state: GameState, r: RoundReport): LogEntry[] {
  const { from, to } = rangeOfRound(state, r);
  return state.log.filter((e) => e.id > from && e.id <= to && !/^Round \d+[.:]/.test(e.text));
}

function passes(kind: ReportFilter | null): boolean {
  return filter === 'all' || kind === filter;
}

function renderRound(state: GameState, title: string, id: string, ledger: string, reps: Report[], lines: LogEntry[], defaultOpen: boolean): string {
  const shownReps = reps.filter((r) => passes(filterOfReport(r.kind)));
  const shownLines = lines.filter((e) => passes(filterOfLine(e.kind)));
  if (filter !== 'all' && !shownReps.length && !shownLines.length) return '';
  const open = toggled.get(id) ?? defaultOpen;
  const counts = reps.length ? ` <span class="muted">${plural(reps.length, 'report')}</span>` : '';
  let out = `<details class="round" data-menu="${id}" ${open ? 'open' : ''}><summary>${title}${counts}</summary>`;
  if (filter === 'all') out += ledger;
  out += shownReps.map((r) => renderReport(r, state)).join('');
  if (shownLines.length) {
    const logOpen = toggled.get(`${id}-log`) ?? (filter !== 'all');
    out += `<details class="log" data-menu="${id}-log" ${logOpen ? 'open' : ''}><summary>The log</summary><ul>${shownLines.map((e) => `<li class="k-${e.kind}">${esc(e.text)}</li>`).join('')}</ul></details>`;
  }
  return out + `</details>`;
}

export function renderReports(state: GameState): string {
  let out = `<h2>Reports</h2><p class="muted">What every round did to the colony, newest first: the ledger, then each raid, scout, envoy, vote and letter from Rome with its numbers. The log lines stay inside each round.</p>`;
  out += `<div class="filters">` + FILTERS.map((f) => `<button class="act tiny ${f.id === filter ? '' : 'secondary'}" data-report-filter="${f.id}" ${f.id === filter ? 'aria-pressed="true"' : ''}>${f.name}</button>`).join('') + `</div>`;
  const last = state.history[state.history.length - 1];
  const sinceId = last?.toLogId ?? 0;
  const since = state.log.filter((e) => e.id > sinceId && !/^Round \d+[.:]/.test(e.text));
  const sinceReps = state.reports.filter((r) => r.logId > sinceId);
  if (since.length || sinceReps.length) {
    out += renderRound(state, `Since round ${state.round}`, 'round-since', '', sinceReps, since, true);
  }
  for (let i = state.history.length - 1; i >= 0; i--) {
    const r = state.history[i];
    const reps = state.reports.filter((x) => x.round === r.round);
    const title = `Round ${r.round}${r.idle ? ' <span class="muted">— without you</span>' : ''}`;
    out += renderRound(state, title, `round-${r.round}`, renderRoundLedger(r) + (r.before ? LEDGER_NOTE : ''), reps, linesOfRound(state, r), i === state.history.length - 1 && !since.length);
  }
  if (!state.history.length && !since.length) out += `<p class="muted">Nothing yet. The first round will write here.</p>`;
  return out;
}

// ---------------------------------------------------------------------------
// The Save tab: a row every few rounds

/** The colony every `config.history.tableEvery`-th round, from the history the save keeps. */
export function renderHistoryTable(state: GameState): string {
  const every = config.history.tableEvery;
  const rows = state.history.filter((r) => r.round % every === 0 && r.before);
  if (!rows.length) return '';
  let out = `<h3>Round by round</h3><table class="history"><tr><th>round</th><th>population</th><th>standing</th><th>forum</th><th>buildings</th><th>holdings</th></tr>`;
  for (const r of rows) {
    out += `<tr><td>${r.round}</td><td>${r.population}</td><td>${n(r.standing ?? 0)}</td><td>${ROMAN[r.forumTier ?? 0]}</td><td>${r.buildingsRaised ?? ''}</td><td>${r.claimed ?? ''}</td></tr>`;
  }
  return out + `</table>`;
}
