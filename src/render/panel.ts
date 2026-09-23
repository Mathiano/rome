import { activeTribes, advisor, building, config, envoys, researchNode, lesserPosts as lesserDefs, posts as postDefs, tribeDef, unlocks, RESOURCE_IDS } from '../data';
import type { GameState, LogEntry } from '../state/types';
import type { Game, Political } from '../game';
import { checkBuild, eligibleBuildings, progress, rushPrice, slotById } from '../village/construction';
import { canAfford, netPerHour } from '../village/economy';
import { capacity, hiddenPerResource, populationCap, forumTier, buildingTier } from '../village/storage';
import { gravitasRank, leaderOf, livingMembers, playerFamily, rivalFamilies, standing } from '../politics/characters';
import { holderOf, lesserEffect, lesserHolderOf, meetsRank, postsHeldBy } from '../politics/posts';
import { militiaPool, homeMilitia } from '../combat/militia';
import { defenceStrength, raidChance, raidStrength } from '../combat/raids';
import { tradeRate } from '../tribes/envoys';
import { portraitSvg } from './portrait';
import { claimCost, claimOf, isScouted, ringOf, scoutCost, siteAt, siteDefence, siteRaidChance, upkeepPerRound } from '../map/sites';
import { site as siteDef } from '../map/world';
import { spareMilitia } from '../combat/militia';
import { assassinationChance, backingCost, marriageCandidates, totalBodyguards } from '../politics/intrigue';
import { officeHolder, playerHoldsOffice, tally } from '../politics/challenge';
import { adoptionCandidates, houseConsent, newManCost } from '../politics/adoption';
import { mayReturn } from '../politics/secession';
import { favourRewardMultiplier } from '../rome/requests';
import { appeasePrice } from '../tribes/turn';
import { pendingChoices } from '../politics/events';
import {
  availableResearch, checkResearch, isResearched, researchProgress, researchRank,
  researchRushPrice, researchSpeed, resourcesOf,
} from '../village/research';
import { roundsUntilIdle } from '../politics/rounds';
import { costTxt, durationText, effectNowNext, effectWords, esc, lockWords, n, remainingText, renderOverview, ROMAN } from './overview';
import { blockedBy, currentAdvice, foundingParagraphs, resolveGoto } from './advisor';
import { rememberOpen, renderHistoryTable, renderNewsRecord, renderReports, reportsUnread, setReportFilter } from './reports';
import { dueItems, idleLine, overflowWords, renderDue, renderReturnStrip } from './due';
import { colonyLine, renderSummary } from './summary';

export { remainingText, durationText } from './overview';

export type Tab = 'village' | 'map' | 'library' | 'council' | 'family' | 'tribe' | 'rome' | 'log' | 'save';
const TABS: { id: Tab; name: string }[] = [
  { id: 'village', name: 'Village' },
  { id: 'map', name: 'Map' },
  { id: 'library', name: 'Library' },
  { id: 'council', name: 'Council' },
  { id: 'family', name: 'Houses' },
  { id: 'tribe', name: 'Tribe' },
  { id: 'rome', name: 'Rome' },
  { id: 'log', name: 'Reports' },
  { id: 'save', name: 'Save' },
];

export interface PanelHandlers {
  onTab(t: Tab): void;
  onChoice(id: string): void;
  onScout(hex: string): void;
  onBuild(slotId: string, buildingId: string): void;
  onSelectSlot(slotId: string): void;
  /** Land on a hex of the map, the way onSelectSlot lands on a plot. */
  onSelectHex(hex: string): void;
  /** "Enough counsel": put the opening line away. Household business, no round. */
  onDismissAdvisor(): void;
  onRush(slotId: string): void;
  onPolitical(a: Political): void;
  onEnvoy(tribeId: string, envoyId: string): void;
  onTrade(tribeId: string, amount: number): void;
  onResearch(id: string): void;
  onRushResearch(id: string): void;
  onGuards(characterId: string, men: number): void;
  /** Raise a new man into the house: household business, no round (DESIGN §9.2). */
  onAdoptNewMan(): void;
  onExport(): void;
  onImport(json: string): void;
  onReset(): void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export interface News { kind: 'opening' | 'away' | 'report'; title: string; subtitle: string; lines: LogEntry[] }

/**
 * Everything that has happened since the player last acknowledged the news:
 * the opening beat on a new colony, the report after a round, or the digest of
 * rounds that ran while the game was closed.
 */
export function pendingNews(state: GameState): News | null {
  const lines = state.log.filter((e) => e.id > state.seenLogId && !/^Round \d+\.$/.test(e.text));
  if (state.pendingChoice) return report(state, lines);
  // Nothing unread is nothing to say, whatever else is true of the colony.
  if (!lines.length) return null;
  if (state.awayRounds > 0) {
    return {
      kind: 'away',
      title: 'While you were away',
      subtitle: `${state.awayRounds} round${state.awayRounds === 1 ? '' : 's'} ran without you. The council does not wait.`,
      lines,
    };
  }
  if (state.round === 0 && !state.seenOpening) {
    return { kind: 'opening', title: esc(config.townName), subtitle: advisor.founding.subtitle, lines };
  }
  // Village work is not news. Laying a foundation writes a log line, and while
  // any unseen line raised the overlay, starting a build at the founding put
  // the opening card back over the village.
  if (!lines.some((e) => e.kind !== 'village')) return null;
  return report(state, lines);
}

function report(state: GameState, lines: LogEntry[]): News | null {
  if (!lines.length && !state.pendingChoice) return null;
  const r = state.lastReport;
  return {
    kind: 'report',
    title: `Round ${state.round}`,
    subtitle: r ? `Population ${Math.floor(state.population)} · corruption ${n(state.corruption)}` : '',
    lines,
  };
}

export function renderNews(news: News, state: GameState, now: number = Date.now()): string {
  // The record (reports unit): the round's ledger and its report cards above
  // the lines; a line a card already carries is not read twice.
  const record = renderNewsRecord(state, news);
  const items = news.lines.filter((e) => !record.covered.has(e.id)).map((e) => `<li class="k-${e.kind}">${esc(e.text)}</li>`).join('');
  const choices = pendingChoices(state);
  let foot: string;
  if (state.pendingChoice && choices.length) {
    foot = `<p><b>${esc(state.pendingChoice.title)}</b></p><div class="choices">` + choices.map((c) => {
      const afford = !c.cost || canAfford(state, c.cost);
      return `<button class="act" data-choice="${c.id}" ${afford ? '' : 'disabled'}>${esc(c.label)}</button>`;
    }).join('') + `</div><p class="muted">This must be answered.</p>`;
  } else {
    foot = `<button class="act" data-news-ok>Continue</button>`;
  }
  // The founding says who you are (DESIGN §1) before the log says what happened,
  // and ends on the first counsel so the colony opens with somewhere to go.
  let premise = '';
  if (news.kind === 'opening') {
    premise = foundingParagraphs(state, config.townName).map((p) => `<p>${esc(p)}</p>`).join('');
    const step = currentAdvice(state);
    if (step) premise += `<p class="counsel-first"><b>${esc(advisor.title)}:</b> ${esc(step.text)}</p>`;
  }
  const leaving = news.kind === 'report' ? leavingCounsel(state, now) : '';
  // What full stores turned away since the player last looked (DESIGN §4.2):
  // the loss stated, and nothing else. The counter resets with Continue.
  const turnedAway = news.kind === 'opening' ? [] : overflowWords(state.overflowSinceSeen ?? {});
  const overflow = turnedAway.length ? `<p class="overflow" data-overflow>${turnedAway.map(esc).join(' ')}</p>` : '';
  return `<div class="news-card${state.round === 0 ? ' opening' : ''}"><h2>${news.title}</h2><p class="muted">${esc(news.subtitle)}</p>
    ${premise}${record.html}<ul>${items}</ul>${overflow}${leaving}${foot}</div>`;
}

/**
 * "Before you go" (DESIGN §12's last verb). What is coming, from the one
 * collector the Village tab's Due block reads (render/due.ts), each stated
 * once in rounded words (§3.1 as amended), and the hours until the council
 * meets without you. Nothing here counts down.
 */
export function leavingCounsel(s: GameState, now: number): string {
  const d = dueItems(s, now);
  const items = [...d.village, ...d.nextRound, ...d.later].map((i) => esc(i.text));
  items.push(esc(idleLine(d.idleHours)));
  return `<div class="leaving"><h3>Before you go</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
}

export function renderHeader(state: GameState): string {
  const net = netPerHour(state);
  const res = RESOURCE_IDS.map((id) => {
    const cap = capacity(state, id);
    const capTxt = cap === Infinity ? '' : ` / ${n(cap)}`;
    const rate = net[id];
    return `<span class="${rate < 0 ? 'neg' : ''}"><b>${n(state.resources[id])}${capTxt}</b><small>${id} ${rate >= 0 ? '+' : ''}${n(rate)}/h</small></span>`;
  }).join('');
  const admin = state.rome.administeringUntilRound > state.round ? ' · <em>Rome administers</em>' : '';
  return `<h1>${esc(config.townName)}</h1><span class="muted">Round ${state.round} · Pop ${Math.floor(state.population)}/${populationCap(state)} · Forum ${ROMAN[forumTier(state)]}${colonyLine(state)}${admin}</span><div class="res">${res}</div>`;
}

/**
 * A mark on a tab that is asking the player for an answer: a duty, never a
 * spend (a build, a study or a scout is a choice, so the Village, Library and
 * Map carry none). One condition per line, in order, so a unit can add one.
 * The Council lights for a vote before it, not for being out of office: that
 * would stay lit until the office was won back and read as a nag (§9.5).
 */
const BADGES: ((s: GameState, t: Tab) => boolean)[] = [
  (s, t) => t === 'rome' && !!s.rome.activeRequest && !s.rome.activeRequest.fulfilled,
  (s, t) => t === 'family' && Object.values(s.families).some((f) => !f.isPlayer && (!!f.demand || f.sourRounds > 0 || (f.departedRound !== null && mayReturn(s, f)))),
  (s, t) => t === 'tribe' && Object.values(s.tribes).some((x) => x.massingForRound >= s.round),
  (s, t) => t === 'council' && !!s.challenge,
  // The tab the opening counsel points at (unit: advisor).
  (s, t) => currentAdvice(s)?.goto.tab === t,
];

export function tabBadge(s: GameState, t: Tab): string {
  // The Reports tab carries its unread count (unit: reports); every other mark is one '!'.
  const unread = t === 'log' ? reportsUnread(s) : 0;
  if (unread > 0) return `<span class="badge">${unread}</span>`;
  return BADGES.some((lit) => lit(s, t)) ? '<span class="badge">!</span>' : '';
}

export function renderPanel(game: Game, tab: Tab, selected: string | null, now: number, selectedHex: string | null = null): string {
  const s = game.state;
  const badge = (t: Tab) => tabBadge(s, t);
  const nav = TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === tab ? 'active' : ''}">${t.name}${badge(t.id)}</button>`).join('');
  let body = '';
  switch (tab) {
    case 'village': body = renderVillage(s, selected, now); break;
    case 'map': body = renderMap(s, selectedHex); break;
    case 'library': body = renderLibrary(s, now); break;
    case 'council': body = renderCouncil(s, now); break;
    case 'family': body = renderFamilies(s); break;
    case 'tribe': body = renderTribe(s); break;
    case 'rome': body = renderRome(s); break;
    case 'log': body = renderReports(s); break;
    case 'save': body = renderSave(s); break;
  }
  return `<nav>${nav}</nav>${renderCounsel(s)}<section>${body}</section>`;
}

/**
 * The counsel card (DESIGN §12): one step at a time, between the tabs and the
 * tab body so it stays in view whichever tab the step sends the player to.
 * It points and it says what is short; it never acts (§3.2) and gives nothing.
 */
export function renderCounsel(s: GameState): string {
  const step = currentAdvice(s);
  if (!step) return '';
  const g = resolveGoto(s, step);
  const show = g.slot
    ? `<button class="act" data-select-slot="${g.slot}">${esc(advisor.showMe)}</button>`
    : g.hex
      ? `<button class="act" data-select-hex="${g.hex}">${esc(advisor.showMe)}</button>`
      : `<button class="act" data-tab="${g.tab}">${esc(advisor.showMe)}</button>`;
  const blocked = blockedBy(s, step);
  return `<aside class="counsel card" data-advisor-step="${step.id}"><b>${esc(advisor.title)}</b><p>${esc(step.text)}</p>`
    + (blocked ? `<p class="muted">Not yet: ${esc(blocked)}.</p>` : '')
    + `${show} <button class="act secondary" data-advisor-dismiss>${esc(advisor.dismiss)}</button></aside>`;
}

/**
 * The Village panel: the colony overview when nothing is selected (the HQ
 * page — every building, tier, next tier, cost, time and gate on one screen,
 * see render/overview.ts), or the plot card when a slot is. Placement stays
 * on the map (DESIGN §4.5): the card is where a new building is chosen.
 */
function renderVillage(s: GameState, selected: string | null, now: number): string {
  let out = `<h2>Village</h2>`;
  out += renderReturnStrip();
  out += renderDue(s, now, openMenus.has('due'));
  if (!selected) {
    out += renderSummary(s);
    out += `<p class="muted">One building and one field may be under construction at a time. Cellars hide ${hiddenPerResource(s)} of each resource from raiders.</p>`;
    return out + renderOverview(s, now);
  }
  out += `<p><button class="link" data-overview>← back to the colony</button></p>`;
  const slot = slotById(s, selected);
  const c = s.constructions.find((x) => x.slotId === slot.id);
  out += `<h3>${slot.building ? esc(building(slot.building).name) : slot.site ? esc(slot.site.replace('_', ' ')) : 'Empty plot'} ${slot.tier ? ROMAN[slot.tier] : ''}</h3>`;
  if (slot.building) out += `<p class="muted">${esc(building(slot.building).role)}</p>`;
  if (c) {
    const price = rushPrice(s, c, now);
    const pct = Math.round(progress(c, now) * 100);
    out += `<div class="card"><p>Work in progress on tier ${c.toTier} — <b>${esc(remainingText(c.finishAt - now))}</b></p>
      <div class="meter"><i style="width:${pct}%"></i></div>
      <p>Hire extra hands to finish now: <b>${price} denarii</b></p><button class="act" data-rush="${slot.id}" ${s.resources.denarii < price ? 'disabled' : ''}>Finish now</button></div>`;
    return out;
  }
  for (const bid of eligibleBuildings(s, slot)) {
    const def = building(bid);
    const check = checkBuild(s, slot.id, bid);
    if (check.toTier > def.tiers.length) {
      out += `<div class="card"><b>${esc(def.name)}</b> is at its top tier.</div>`;
      continue;
    }
    // What the tier buys, now → next, and how long it takes: the one choice of
    // a session (DESIGN §12) is not made blind.
    out += `<div class="card"><b>${esc(def.name)} ${ROMAN[check.toTier]}</b><p class="muted">${esc(def.role)}</p><p>${esc(effectNowNext(def, slot.tier, check.toTier))}</p><p>Cost: ${costTxt(check.cost, s)} · ${esc(durationText(check.seconds))}</p>`;
    out += `<button class="act" data-build="${slot.id}" data-building="${bid}" ${check.ok ? '' : 'disabled'}>${slot.tier ? 'Upgrade' : 'Build'}</button>`;
    if (!check.ok) out += ` ${lockWords(check)}`;
    out += `</div>`;
  }
  return out;
}

function charOption(s: GameState, id: string, stat: keyof typeof s.characters[string]['stats'], postId: string): string {
  const c = s.characters[id];
  const fam = s.families[c.familyId];
  const ok = meetsRank(s, postId, c.id);
  return `<option value="${c.id}">${ok ? '' : '✗ '}${esc(c.name)} — ${fam.name}, ${stat} ${c.stats[stat]}, rank ${gravitasRank(c)}</option>`;
}

function renderMap(s: GameState, hex: string | null): string {
  const claimed = s.map.claimed;
  const spare = spareMilitia(s);
  let out = `<h2>The country</h2>`;
  out += `<p class="muted">Terrain is known; what stands on it is not. A <b>?</b> is something worth a look. Scouts are dispatched now and report at the next round.</p>`;
  out += `<p>Scouted <b>${s.map.scouted.length}</b> · held <b>${claimed.length}</b> · upkeep <b>${upkeepPerRound(s)}</b> denarii a round · <b>${spare}</b> men uncommitted</p>`;
  if (s.map.pendingScout) out += `<p class="muted">Scouts are out toward ${esc(s.map.pendingScout)}.</p>`;

  if (claimed.length) {
    out += `<h3>Held</h3>`;
    for (const c of claimed) {
      const def = siteDef(c.siteId);
      const r = ringOf(c.key);
      out += `<div class="card"><b>${esc(def.name)}</b> <span class="muted">${c.key}, ${r} rings out</span>
        <p class="muted">Raid chance ${Math.round(siteRaidChance(s, c) * 100)}% a round · garrison ${c.garrison} (${Math.round(siteDefence(c))} strength)</p>
        <button class="act" data-garrison="${c.key}" data-men="${c.garrison + 1}" ${spare < 1 ? 'disabled' : ''}>Send a man</button>
        <button class="act secondary" data-garrison="${c.key}" data-men="${Math.max(0, c.garrison - 1)}" ${c.garrison < 1 ? 'disabled' : ''}>Recall one</button>
        <button class="act secondary" data-release="${c.key}">Give it up</button></div>`;
    }
  }

  if (!hex) return out + `<p>Select a hex.</p>`;
  const id = siteAt(s, hex);
  const scouted = isScouted(s, hex);
  const held = claimOf(s, hex);
  out += `<h3>${esc(hex)} <span class="muted">— ${ringOf(hex)} rings out</span></h3>`;
  if (hex === '0,0') return out + `<p>${esc(config.townName)} stands here.</p>`;
  if (!scouted) {
    const cost = scoutCost();
    const can = !s.map.pendingScout && (s.resources.denarii >= (cost.denarii ?? 0));
    out += id ? `<p>Something stands here. Nobody has been close enough to say what.</p>` : `<p class="muted">Nothing has been reported here.</p>`;
    out += `<button class="act" data-scout="${hex}" ${can ? '' : 'disabled'}>Send scouts (${cost.denarii} denarii)</button>`;
    return out;
  }
  if (!id) return out + `<p class="muted">Scouted. Empty country.</p>`;
  const def = siteDef(id);
  out += `<div class="card"><b>${esc(def.name)}</b><p class="muted">${esc(def.description)}</p>`;
  if (def.produces) out += `<p>Yields ${Object.entries(def.produces).map(([k, v]) => `${v} ${k}/h`).join(', ')}</p>`;
  if (def.effect) out += `<p>${Object.entries(def.effect).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}</p>`;
  if (def.hostile) out += `<p style="color:var(--terracotta)">A war band. There is nothing here to hold.</p>`;
  else if (held) out += `<p>Held since round ${held.claimedRound}.</p>`;
  else {
    const cost = claimCost(hex);
    const inPower = playerHoldsOffice(s);
    const can = (s.resources.denarii ?? 0) >= (cost.denarii ?? 0) && inPower;
    out += `<p>Claim for ${costTxt(cost, s)} · upkeep grows with distance</p>
      <button class="act" data-claim="${hex}" ${can ? '' : 'disabled'}>Claim it</button>`;
    if (!inPower) out += ` <span class="muted">A claim is the ${config.topOffice.title}'s to make.</span>`;
  }
  return out + `</div>`;
}

/**
 * The Library (DESIGN §4.6). Research runs on the village clock like a
 * construction, costs denarii and scrolls, and can be finished early at the
 * same honest price. Nothing here is ever lost again (Pillar 7).
 */
function renderLibrary(s: GameState, now: number): string {
  const tier = buildingTier(s, 'library');
  const rank = researchRank(s);
  let out = `<h2>The library</h2>`;
  out += `<p>Scrolls <b>${s.rome.scrolls}</b> · Library ${tier ? ROMAN[tier] : '<em>none</em>'} · ${
    tier ? `studies run ${pct(1 - researchSpeed(s))} faster` : 'no study is possible'} · known <b>${s.research.completed.length}</b>/${availableResearch(s).length + s.research.completed.length}</p>`;
  out += `<p class="muted">Scrolls come from Rome's rewards, from ruins on the map and from trade. What is learned here is never lost: it survives a raid, a coup and Rome's intervention alike.</p>`;
  if (!tier) {
    out += `<div class="card"><b>There is no library.</b><p class="muted">Raise one on an inner plot. Until then the scrolls sit in a chest and nothing is read.</p></div>`;
  }

  for (const p of s.research.active) {
    const node = researchNode(p.id);
    const price = researchRushPrice(s, p, now);
    const pr = Math.round(researchProgress(p, now) * 100);
    out += `<div class="card player"><b>${esc(node.name)}</b> <span class="muted">under study — ${esc(remainingText(p.finishAt - now))}</span>
      <div class="meter"><i style="width:${pr}%"></i></div>
      <p class="muted">${esc(node.description)}</p>
      <p>Hire copyists to finish now: <b>${price} denarii</b></p>
      <button class="act" data-rush-research="${p.id}" ${s.resources.denarii < price ? 'disabled' : ''}>Finish now</button></div>`;
  }

  let lastRank = 0;
  for (const node of availableResearch(s)) {
    if (node.rank !== lastRank) {
      lastRank = node.rank;
      out += `<h3>Opened by a Library of tier ${ROMAN[node.rank]}</h3>`;
    }
    const check = checkResearch(s, node.id);
    const locked = rank < node.rank;
    out += `<div class="card ${locked ? 'lesser' : ''}"><b>${esc(node.name)}</b>
      <p class="muted">${esc(node.description)}</p>
      <p>${esc(effectWords(node.effects))}</p>
      <p>Cost: ${costTxt(resourcesOf(node.cost), s)}${check.cost.scrolls ? `, <span class="${s.rome.scrolls < check.cost.scrolls ? 'neg' : ''}">${check.cost.scrolls} scroll${check.cost.scrolls === 1 ? '' : 's'}</span>` : ''} · ${esc(durationText(check.seconds))}</p>
      <button class="act" data-research="${node.id}" ${check.ok ? '' : 'disabled'}>Take it up</button>`;
    if (!check.ok && check.reason) out += ` <span class="muted">${esc(check.reason)}</span>`;
    out += `</div>`;
  }

  if (s.research.completed.length) {
    out += `<h3>Known</h3><ul class="known">`;
    for (const id of s.research.completed) {
      const node = researchNode(id);
      out += `<li><b>${esc(node.name)}</b> <span class="muted">${esc(effectWords(node.effects))}</span></li>`;
    }
    out += `</ul>`;
  }
  void isResearched;
  return out;
}

/**
 * The vote on the top office (DESIGN §9.5). The player sees the count as it
 * stands, which is the point: the one round before the vote is spent buying the
 * regard of the men who will cast it.
 */
function renderChallenge(s: GameState): string {
  const ch = s.challenge;
  if (!ch) return '';
  const caller = s.families[ch.callerFamilyId];
  const votes = tally(s, ch);
  const mine = ch.candidates[playerFamily(s).id];
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const leadTie = ranked.filter(([, v]) => v === ranked[0][1]).length > 1;
  const rounds = ch.voteRound - s.round;
  let out = `<div class="card challenge"><b>A challenge stands before the council.</b>
    <p>The ${esc(caller.name)} have called a vote for the office of ${config.topOffice.title}. The houses vote ${rounds <= 0 ? '<b>at the next round</b>' : `at round ${ch.voteRound} — ${rounds} round${rounds === 1 ? '' : 's'} to move`}.</p>
    <div class="tally">`;
  for (const [cid, v] of ranked) {
    const c = s.characters[cid];
    const fam = s.families[c.familyId];
    const width = Math.round((v / Math.max(1, ranked[0][1])) * 100);
    out += `<div class="row ${fam.isPlayer ? 'player' : 'rival'}"><span>${esc(c.name)} <small class="muted">${esc(fam.name)}</small></span>
      <div class="meter"><i style="width:${width}%"></i></div><b>${v}</b></div>`;
  }
  out += `</div>`;
  const winner = ranked[0][0];
  if (leadTie) {
    out += `<p>As it stands the council is split, and a split vote leaves the office where it is.</p>`;
  } else if (winner === mine) {
    out += `<p style="color:var(--moss)">As it stands you carry it by ${ranked[0][1] - (ranked[1]?.[1] ?? 0)} vote${ranked[0][1] - (ranked[1]?.[1] ?? 0) === 1 ? '' : 's'}.</p>`;
  } else {
    out += `<p style="color:var(--terracotta)">As it stands ${esc(s.characters[winner].name)} of the ${esc(s.families[s.characters[winner].familyId].name)} carries it.</p>`;
  }
  out += `<p class="muted">Every living member of every house casts one vote, and a house votes for its own man first. A house with nobody standing would rather you kept the office than watch another rival take it — unless it has come to loathe you. Grant what a house asks, give it a post, or pay for its regard: each of those is a vote.</p></div>`;
  return out;
}

function renderCouncil(s: GameState, now: number): string {
  const office = officeHolder(s);
  const inPower = playerHoldsOffice(s);
  let out = `<h2>The council</h2>`;
  out += renderChallenge(s);
  out += `<p><b>${config.topOffice.title}:</b> ${office ? `${esc(office.name)} of the ${esc(s.families[office.familyId].name)}` : 'vacant'}</p>`;
  if (!inPower) {
    const ch = config.challenge;
    const pLeader = leaderOf(s, playerFamily(s).id);
    const wait = s.lastChallengeRound + ch.minRoundsBetween - s.round;
    const price = ch.playerCallCost.denarii ?? 0;
    const rankOk = !!pLeader && gravitasRank(pLeader) >= ch.playerCallMinRank;
    const canCall = !s.challenge && wait <= 0 && rankOk && s.resources.denarii >= price;
    out += `<div class="card rival"><b>Your house is out of office.</b>
      <p>Appointments, dismissals and claims on the country are the ${config.topOffice.title}'s to make, and that is not you. ${s.stats.roundsOutOfOffice} round${s.stats.roundsOutOfOffice === 1 ? '' : 's'} out. What is left to you is the houses, the tribes, Rome — and a challenge of your own.</p>
      <button class="act" data-political="call_challenge" ${canCall ? '' : 'disabled'}>Call a challenge (${price} denarii, rank ${ch.playerCallMinRank})</button>`;
    if (s.challenge) out += ` <span class="muted">A vote is already before the council.</span>`;
    else if (wait > 0) out += ` <span class="muted">The council will hear no other challenge for ${wait} round${wait === 1 ? '' : 's'}.</span>`;
    else if (!rankOk) out += ` <span class="muted">${pLeader ? `${esc(pLeader.name)} is rank ${gravitasRank(pLeader)}` : 'Your house has nobody to put up'}.</span>`;
    else if (s.resources.denarii < price) out += ` <span class="muted">Not enough denarii.</span>`;
    out += `</div>`;
  }
  out += `<p>Corruption <b>${n(s.corruption)}</b></p><div class="meter"><i style="width:${s.corruption}%"></i></div>`;
  out += `<p class="muted">Corruption raises building costs (+${Math.round(s.corruption * config.corruption.costMultiplierPerPoint * 100)}%) and drains denarii. Your own treasurer lowers it.</p>`;
  const living = Object.values(s.characters).filter((c) => c.alive);
  for (const p of postDefs) {
    const h = holderOf(s, p.id);
    const obstructed = (s.obstructed[p.domain] ?? 0) > s.round;
    out += `<div class="card ${h ? (s.families[h.familyId].isPlayer ? 'player' : 'rival') : ''}"><b>${esc(p.name)}</b> <span class="muted">(${p.stat}${p.minRank ? `, needs rank ${p.minRank}` : ''})</span><p class="muted">${esc(p.description)}</p>`;
    out += `<p>${h ? `${esc(h.name)} of the ${s.families[h.familyId].name}, ${p.stat} ${h.stats[p.stat]}` : '<em>vacant</em>'}${obstructed ? ' · <span style="color:var(--terracotta)">obstructing</span>' : ''}</p>`;
    const eligible = living.filter((c) => meetsRank(s, p.id, c.id));
    const options = (eligible.length ? eligible : living).map((c) => charOption(s, c.id, p.stat, p.id)).join('');
    out += `<select data-select-post="${p.id}">${options}</select> `;
    out += `<button class="act" data-appoint="${p.id}" ${inPower ? '' : 'disabled'}>Appoint</button>`;
    if (h) out += `<button class="act secondary" data-dismiss="${p.id}" ${inPower ? '' : 'disabled'}>Dismiss</button>`;
    out += `</div>`;
  }
  out += `<h3>Lesser offices</h3><p class="muted">Outside the council: a little standing, no leverage. Somewhere to keep a house content without handing it anything to obstruct with.</p>`;
  for (const p of lesserDefs) {
    const h = lesserHolderOf(s, p.id);
    out += `<div class="card lesser ${h ? (s.families[h.familyId].isPlayer ? 'player' : 'rival') : ''}"><b>${esc(p.name)}</b> <span class="muted">(${p.stat})</span>
      <p class="muted">${esc(p.description)}</p>
      <p>${h ? `${esc(h.name)} of the ${s.families[h.familyId].name}` : '<em>vacant</em>'}</p>
      <select data-select-lesser="${p.id}">${living.filter((c) => !c.post).map((c) => `<option value="${c.id}">${esc(c.name)} — ${s.families[c.familyId].name}, ${p.stat} ${c.stats[p.stat]}</option>`).join('')}</select>
      <button class="act" data-appoint-lesser="${p.id}" ${inPower ? '' : 'disabled'}>Appoint</button>${h ? `<button class="act secondary" data-dismiss-lesser="${p.id}" ${inPower ? '' : 'disabled'}>Dismiss</button>` : ''}</div>`;
  }
  out += `<h3>Actions</h3>`;
  const leader = leaderOf(s, playerFamily(s).id);
  const g = config.gravitas;
  out += `<p>Your leader holds <b>${n(leader?.gravitasStock ?? 0)}</b> spendable gravitas (rank ${leader ? gravitasRank(leader) : 0}).</p>`;
  const backingOk = !!leader && gravitasRank(leader) >= g.romeBackingMinRank && leader.gravitasStock >= backingCost(s);
  const cost = backingCost(s);
  const backingOk2 = backingOk && s.rome.favour >= config.rome.backingMinFavour;
  out += `<button class="act" data-political="rome_backing" ${backingOk2 ? '' : 'disabled'}>Seek Rome's backing (${cost} gravitas, rank ${g.romeBackingMinRank}, favour ${config.rome.backingMinFavour})</button> `;
  out += `<button class="act secondary" data-political="convene">Convene the council (pass)</button>`;
  out += `<p class="muted">Every action here runs a political round: the rival house, the tribe and Rome all act, and everyone ages. If you stay away ${config.calendarFloorHours} hours the council meets without you (${Math.ceil(roundsUntilIdle(s, now) / 3_600_000)}h left).</p>`;
  return out;
}

function spouseTxt(s: GameState, c: { spouseId?: string }): string {
  if (!c.spouseId) return '';
  if (c.spouseId.startsWith('tribe:')) return ` · married into ${esc(tribeDef(c.spouseId.slice(6)).name)}`;
  const sp = s.characters[c.spouseId];
  return sp ? ` · married to ${esc(sp.name)} of the ${esc(s.families[sp.familyId].name)}` : '';
}

/** Men standing over one of your own. Arranging the household runs no round. */
function renderGuards(s: GameState, id: string, isPlayer: boolean): string {
  const c = s.characters[id];
  if (!isPlayer) {
    return c.bodyguards
      ? `<div class="guards muted">${c.bodyguards} guard${c.bodyguards === 1 ? '' : 's'}</div>`
      : '';
  }
  const spare = spareMilitia(s);
  const max = config.bodyguard.maxPerCharacter;
  return `<div class="guards">guards <b>${c.bodyguards}</b>/${max}
    <button class="act tiny" data-guards="${id}" data-men="${c.bodyguards + 1}" ${c.bodyguards >= max || spare < 1 ? 'disabled' : ''}>+</button>
    <button class="act tiny secondary" data-guards="${id}" data-men="${c.bodyguards - 1}" ${c.bodyguards < 1 ? 'disabled' : ''}>−</button></div>`;
}

/**
 * Which menus the player has open: the houses' intrigue menus, and the Village
 * tab's Due block, which starts open. The panel is rebuilt as a string
 * whenever anything moves, so without this every round would slam the menu shut
 * under the player's hand.
 */
const openMenus = new Set<string>(['due']);

/**
 * The full intrigue menu (DESIGN §9.6). Each of these is a move against another
 * house, so each runs a round, and every one of them is remembered: a grievance
 * outlives the attitude it cost.
 */
function renderIntrigue(s: GameState, familyId: string, bribeOnly = false): string {
  const f = s.families[familyId];
  const c = config.intrigue;
  const pl = leaderOf(s, playerFamily(s).id);
  const rank = pl ? gravitasRank(pl) : 0;
  const coin = s.resources.denarii;
  const gate = (minRank: number, cost: number) => rank >= minRank && coin >= cost;
  const why = (minRank: number, cost: number) => rank < minRank ? `rank ${minRank} needed` : coin < cost ? 'not enough denarii' : '';

  let out = `<details class="intrigue" data-intrigue="${familyId}" ${openMenus.has(familyId) ? 'open' : ''}><summary>Move against the ${esc(f.name)}</summary>`;

  const b = c.bribe;
  out += `<div class="row"><button class="act" data-political="bribe" data-family="${familyId}" ${gate(b.minRank, b.cost) ? '' : 'disabled'}>Bribe</button>
    <span class="muted">${b.cost} denarii, rank ${b.minRank} · their regard for you rises ${b.attitude}, your own standing slips ${b.gravitasLoss}. ${why(b.minRank, b.cost)}</span></div>`;

  // A house away from the colony can be reached with a gift and nothing else.
  if (bribeOnly) return out + `</details>`;

  const e = c.expose;
  out += `<div class="row"><button class="act" data-political="expose" data-family="${familyId}" ${gate(e.minRank, e.cost) ? '' : 'disabled'}>Expose their skimming</button>
    <span class="muted">${e.cost} denarii, rank ${e.minRank} · corruption ${-e.corruptionDrop}, their regard ${e.attitude}, and they remember it. ${why(e.minRank, e.cost)}</span></div>`;

  const d = c.denounce;
  const denounceOk = rank >= d.minRank && (pl?.gravitasStock ?? 0) >= d.gravitasCost;
  out += `<div class="row"><button class="act" data-political="denounce" data-family="${familyId}" ${denounceOk ? '' : 'disabled'}>Write to Rome about them</button>
    <span class="muted">${d.gravitasCost} gravitas, rank ${d.minRank} · Rome's favour +${d.romeFavour}, their regard ${d.attitude}. ${rank < d.minRank ? `rank ${d.minRank} needed` : denounceOk ? '' : 'not enough gravitas'}</span></div>`;

  const m = c.marry;
  const pairs = marriageCandidates(s, familyId);
  out += `<div class="row"><button class="act" data-marry="${familyId}" ${pairs.length && gate(m.minRank, m.cost) ? '' : 'disabled'}>Marry into the house</button>
    <select data-select-marry="${familyId}" ${pairs.length ? '' : 'disabled'}>${pairs.length
      ? pairs.map((pr) => `<option value="${pr.a}|${pr.b}">${esc(pr.label)}</option>`).join('')
      : '<option>nobody unwed on both sides</option>'}</select>
    <span class="muted">${m.cost} denarii, rank ${m.minRank} · their regard +${m.attitude} and one grievance forgotten. ${why(m.minRank, m.cost)}</span></div>`;

  const ad = config.adoption;
  const consent = houseConsent(s, familyId);
  const wards = adoptionCandidates(s, familyId);
  const adoptOk = consent.ok && gate(ad.minRank, ad.houseCost);
  out += `<div class="row"><button class="act" data-adopt="${familyId}" ${adoptOk ? '' : 'disabled'}>Adopt one of their men</button>
    <select data-select-adopt="${familyId}" ${wards.length ? '' : 'disabled'}>${wards.length
      ? wards.map((w) => `<option value="${w.id}">${esc(w.name)}, age ${w.age}, rank ${gravitasRank(w)}</option>`).join('')
      : '<option>nobody they could spare</option>'}</select>
    <span class="muted">${ad.houseCost} denarii, rank ${ad.minRank} · he takes your name and his vote comes with him; their regard +${ad.houseAttitude}. ${consent.ok ? why(ad.minRank, ad.houseCost) : esc(consent.reason ?? '')}</span></div>`;

  const living = livingMembers(s, familyId).filter((x) => !x.exiled);
  const x = c.exile;
  const a = c.assassinate;
  const cool = s.lastAssassinationRound + a.cooldownRounds - s.round;
  if (living.length) {
    const opts = living.map((t) => `<option value="${t.id}">${esc(t.name)}${t.isLeader ? ' ★' : ''} — ${t.bodyguards} guard${t.bodyguards === 1 ? '' : 's'}, ${pct(assassinationChance(s, t.id))} if it is tried</option>`).join('');
    out += `<div class="row"><select data-select-target="${familyId}">${opts}</select></div>
      <div class="row"><button class="act" data-exile="${familyId}" ${gate(x.minRank, x.cost) ? '' : 'disabled'}>Put him out of the colony</button>
        <span class="muted">${x.cost} denarii, rank ${x.minRank} · their regard ${x.attitude}, every other house ${x.allAttitude}. ${why(x.minRank, x.cost)}</span></div>
      <div class="row"><button class="act danger" data-assassinate="${familyId}" ${gate(a.minRank, a.cost) && cool <= 0 ? '' : 'disabled'}>A knife in the dark</button>
        <span class="muted">${a.cost} denarii, rank ${a.minRank} · guards block it, half of these are traced back, and every house in the colony turns colder. ${cool > 0 ? `the last one is still talked about — ${cool} round${cool === 1 ? '' : 's'}` : why(a.minRank, a.cost)}</span></div>`;
  }
  out += `</details>`;
  return out;
}

function renderFamilies(s: GameState): string {
  let out = `<h2>The houses</h2>`;
  const fams = [playerFamily(s), ...rivalFamilies(s)];
  for (const f of fams) {
    const members = f.memberIds.map((id) => s.characters[id]);
    const held = postsHeldBy(s, f.id);
    out += `<div class="card ${f.isPlayer ? 'player' : 'rival'}"><b>${esc(f.gensName)}</b> — standing ${n(standing(s, f.id))}, ${livingMembers(s, f.id).length} living, ${held.length} post${held.length === 1 ? '' : 's'}${f.loyalist ? ', loyal to Rome' : ''}`;
    if (!f.isPlayer && f.departedRound !== null) {
      const sc = config.secession;
      const away = s.round - f.departedRound;
      out += `<p>Attitude toward you: <b>${n(f.attitude)}</b></p><div class="meter att"><i style="width:${(f.attitude + 100) / 2}%"></i></div>`;
      out += `<p style="color:var(--terracotta)">They left the colony at round ${f.departedRound} and took a share of the citizens with them.</p>
        <p class="muted">${mayReturn(s, f) ? 'They are ready to come home.' : away < sc.awayRounds
          ? `They will hear terms from round ${f.departedRound + sc.awayRounds} if their regard for you reaches ${sc.returnAttitude}`
          : `They will come home once their regard for you reaches ${sc.returnAttitude}`}${away < sc.maxAwayRounds ? `, and by round ${f.departedRound + sc.maxAwayRounds} regardless.` : '.'} A gift still reaches them.</p>`;
      out += renderIntrigue(s, f.id, true);
    } else if (!f.isPlayer) {
      out += `<p>Attitude toward you: <b>${n(f.attitude)}</b></p><div class="meter att"><i style="width:${(f.attitude + 100) / 2}%"></i></div>`;
      if (f.attitude <= config.posts.unhappyThreshold && held.length) out += `<p style="color:var(--terracotta)">Unhappy and in office: expect obstruction, skimming or leaks.</p>`;
      if (held.length === 0) out += `<p class="muted">Without a post their regard for you falls each round.</p>`;
      if (held.length >= config.posts.dangerousPostCount) out += `<p style="color:var(--terracotta)">They hold too many posts. Dangerous.</p>`;
      if (f.grievances > 0) out += `<p class="muted">Grievances remembered: <b>${f.grievances}</b>${f.denounced ? ' · they have written to Rome' : ''}</p>`;
      if (f.sourRounds > 0) out += `<p style="color:var(--terracotta)">They talk of leaving the colony. ${config.secession.rounds - f.sourRounds} more round${config.secession.rounds - f.sourRounds === 1 ? '' : 's'} like this and they will.</p>`;
      if (f.demand) {
        const d = f.demand;
        const what = d.kind === 'post' ? `the post of ${esc(postDefs.find((p) => p.id === d.postId)?.name ?? d.postId!)}` : `${d.denarii} denarii`;
        const can = d.kind === 'denarii' ? s.resources.denarii >= (d.denarii ?? 0) : true;
        out += `<div class="card demand"><b>They ask for ${what}.</b><p class="muted">An answer is expected by round ${d.dueRound}. Silence counts as refusal, and costs more.</p>
          <button class="act" data-accept="${f.id}" ${can ? '' : 'disabled'}>Grant it</button>
          <button class="act secondary" data-refuse="${f.id}">Refuse</button></div>`;
      }
      out += renderIntrigue(s, f.id);
    }
    if (f.isPlayer) {
      const ad = config.adoption;
      const cost = newManCost(s);
      const pl = leaderOf(s, f.id);
      const rank = pl ? gravitasRank(pl) : 0;
      const ok = rank >= ad.minRank && s.resources.denarii >= cost;
      out += `<div class="row"><button class="act" data-adopt-new ${ok ? '' : 'disabled'}>Raise a new man into the house</button>
        <span class="muted">${cost} denarii, rank ${ad.minRank} · a veteran, a freedman or a tribal noble, grown and yours. The price rises with the household. Runs no round. ${rank < ad.minRank ? `rank ${ad.minRank} needed` : s.resources.denarii < cost ? 'not enough denarii' : ''}</span></div>`;
    }
    out += `<div class="roster">`;
    for (const c of members) {
      const st = c.stats;
      const postName = c.post ? esc(postDefs.find((p) => p.id === c.post)?.name ?? c.post) : '';
      out += `<div class="member${c.alive ? '' : ' dead'}">${portraitSvg(c, f, { dead: !c.alive })}
        <div class="who"><b>${esc(c.name)}</b>${c.isLeader ? ' <span title="head of the house">★</span>' : ''}
          <div class="muted">${c.alive ? (c.departed ? `age ${c.age} · gone with the house` : `age ${c.age}`) : `† ${esc(c.causeOfDeath ?? '')}`} · gravitas ${n(c.gravitas)}, rank ${gravitasRank(c)}${postName ? ` · ${postName}` : ''}${spouseTxt(s, c)}</div>
          <div class="stats"><span>auth ${st.authority}</span><span>disc ${st.discipline}</span><span>craft ${st.craft}</span><span>conn ${st.connections}</span><span>piety ${st.piety}</span></div>
          ${c.alive ? renderGuards(s, c.id, f.isPlayer) : ''}
        </div></div>`;
    }
    out += `</div></div>`;
  }
  out += `<p class="muted">A post teaches its trade: its holder's stat grows while he serves. Gravitas rank gates the greater posts. Age is counted in rounds. Natural death begins after ${config.lifespan.roundsMin} and is certain by ${config.lifespan.roundsMax}. Guards are drawn from the same militia pool as the walls and the far holdings: ${spareMilitia(s)} men are uncommitted, and standing ${totalBodyguards(s)} of them over your kin leaves that many fewer behind the ditch. Heirs by birth wait on DESIGN §15.7; adoption does not, and is Roman practice.</p>`;
  return out;
}

function renderTribe(s: GameState): string {
  let out = `<h2>The tribes</h2><p class="muted">Three peoples, and they watch each other. Warming to one cools those who hate it (DESIGN §7).</p>`;
  out += `<p>Your walls hold at <b>${n(defenceStrength(s))}</b> with ${homeMilitia(s)} of ${militiaPool(s)} men at home.</p>`;
  for (const def of activeTribes()) {
    const t = s.tribes[def.id];
    if (!t) continue;
    const rel = [
      ...def.likes.map((o) => `friendly to ${esc(tribeDef(o).name)}`),
      ...def.hates.map((o) => `hostile to ${esc(tribeDef(o).name)}`),
    ].join(', ');
    out += `<div class="card ${t.allied ? 'player' : 'rival'}"><b>${esc(def.name)}</b> <span class="muted">${esc(def.archetype)}${rel ? ` · ${rel}` : ''}</span>
      <p class="muted">${esc(def.description)}</p>
      <p>Fear <b>${n(t.fear)}</b></p><div class="meter fear"><i style="width:${t.fear}%"></i></div>
      <p>Trust <b>${n(t.trust)}</b></p><div class="meter trust"><i style="width:${t.trust}%"></i></div>
      <p class="muted">Strength ${n(raidStrength(s, t))} · raid chance ${Math.round(raidChance(s, t) * 100)}% a round</p>`;
    if (t.allied) out += `<p style="color:var(--moss)">Allied. They do not raid.</p>`;
    if (t.hostagesUntilRound > s.round) out += `<p>Hostages held: no raids until round ${t.hostagesUntilRound}.</p>`;
    if (t.leakedUntilRound > s.round) out += `<p style="color:var(--terracotta)">They know the size of your stores (until round ${t.leakedUntilRound}).</p>`;
    if (t.massingForRound >= s.round) {
      const price = appeasePrice(s, def.id);
      const odds = raidStrength(s, t) > defenceStrength(s) ? 'Your walls will not hold them.' : 'Your walls should hold.';
      out += `<div class="card demand"><b>Massing. The raid lands on round ${t.massingForRound}.</b><p>${odds}</p>
        <button class="act" data-political="appease" data-tribe="${def.id}" ${s.resources.denarii < price ? 'disabled' : ''}>Pay ${price} denarii to turn them back</button></div>`;
    }
    if (t.pendingEnvoy) {
      out += `<p>An envoy is on the road: <b>${esc(envoys.find((e) => e.id === t.pendingEnvoy)?.name ?? t.pendingEnvoy)}</b>.</p>`;
    } else {
      out += `<select data-select-envoy="${def.id}">${envoys.map((e) => `<option value="${e.id}">${esc(e.name)} — ${esc(e.description)}</option>`).join('')}</select>
        <button class="act" data-envoy="${def.id}">Send an envoy</button>`;
    }
    if (t.tradeOpen) {
      const rate = tradeRate(s, def.id);
      out += `<p class="muted">Trades ${def.trade.gives} for ${def.trade.wants} at ${n(rate)} : 1.</p>`;
      for (const amt of [20, 50]) {
        out += `<button class="act secondary" data-trade="${amt}" data-tribe="${def.id}" ${s.resources[def.trade.wants] < amt * rate ? 'disabled' : ''}>${amt} ${def.trade.gives} for ${Math.ceil(amt * rate)} ${def.trade.wants}</button> `;
      }
    }
    out += `</div>`;
  }
  return out;
}

function renderRome(s: GameState): string {
  const r = s.rome;
  const mult = favourRewardMultiplier(s);
  let out = `<h2>Rome</h2><p>Favour <b>${n(r.favour)}</b> · research scrolls <b>${r.scrolls}</b> · requests completed <b>${r.completedIds.length}</b></p>`;
  out += `<p class="muted">Favour pays: rewards at <b>${Math.round(mult * 100)}%</b>. Unique gifts need favour ${config.rome.unlockMinFavour}; Rome's backing needs ${config.rome.backingMinFavour} and costs less the better you stand.</p>`;
  if (r.withheldUnlocks.length) {
    out += `<div class="card demand"><b>Rome is holding back ${r.withheldUnlocks.map((u) => esc(unlocks[u]?.name ?? u)).join(', ')}.</b><p class="muted">It will be sent once favour reaches ${config.rome.unlockMinFavour}.</p></div>`;
  }
  if (r.administeringUntilRound > s.round) out += `<p style="color:var(--river)">A procurator administers the colony until round ${r.administeringUntilRound}.</p>`;
  const a = r.activeRequest;
  if (a) {
    out += `<div class="card"><b>${esc(a.title)}</b><p>${esc(a.text)}</p>`;
    const reward = [a.reward.denarii ? `${a.reward.denarii} denarii` : '', a.reward.scrolls ? `${a.reward.scrolls} scrolls` : '', a.reward.gravitas ? `${a.reward.gravitas} gravitas` : '', a.reward.unlock ? unlocks[a.reward.unlock]?.name : ''].filter(Boolean).join(', ');
    out += `<p class="muted">Reward: ${esc(reward)}</p>`;
    if (a.fulfilled) out += `<p style="color:var(--moss)">Done. Rome answers at the next round.</p>`;
    else {
      switch (a.kind) {
        case 'deliver':
          out += `<p>Deliver: ${costTxt(a.deliver ?? {}, s)}</p><button class="act" data-political="rome_deliver">Deliver</button>`;
          break;
        case 'build':
          out += `<p>Raise the ${esc(building(a.build!.building).name)} to tier ${a.build!.tier}. Rome will notice on its next turn once it stands.</p>`;
          break;
        case 'recruits':
          out += `<p>Send ${a.recruits} men (militia pool ${militiaPool(s)}, population ${Math.floor(s.population)}).</p><button class="act" data-political="rome_recruits">Send recruits</button>`;
          break;
        case 'host':
          if (r.hostingUntilRound > 0) out += `<p>Hosting until round ${r.hostingUntilRound}.</p>`;
          else out += `<p>Costs ${a.hostCost} denarii; the guest stays ${config.rome.hostOfficialRounds} rounds.</p><button class="act" data-political="rome_host" ${s.resources.denarii < (a.hostCost ?? 0) ? 'disabled' : ''}>Receive them</button>`;
          break;
      }
      out += ` <button class="act secondary" data-political="rome_decline">Decline</button>`;
    }
    out += `</div>`;
  } else {
    out += `<p class="muted">No request outstanding. Rome will write after the next round.</p>`;
  }
  if (r.unlocks.length) {
    out += `<h3>Rome's gifts</h3>`;
    for (const u of r.unlocks) out += `<div class="card"><b>${esc(unlocks[u]?.name ?? u)}</b><p class="muted">${esc(unlocks[u]?.description ?? '')}</p></div>`;
  }
  out += `<p class="muted">Ignoring Rome costs nothing but the aid you forgo, and the loyalist house's regard.</p>`;
  return out;
}

function renderSave(s: GameState): string {
  const st = s.stats;
  return `<h2>Save</h2><p class="muted">The game saves itself to this browser. Export to carry it to another device; import replaces the current game.</p>
  <button class="act" data-export>Export save</button>
  <h3>Import</h3><textarea data-import-text placeholder="Paste a save here"></textarea><br><button class="act secondary" data-import>Import</button>
  <h3>Start over</h3><button class="act secondary" data-reset>New colony</button>
  <h3>This colony so far</h3>
  <table>
    <tr><td>Rounds</td><td>${st.rounds}${st.idleRounds ? ` (${st.idleRounds} without you)` : ''}</td></tr>
    <tr><td>Raids</td><td>${st.raidsSuffered} suffered, ${st.raidsRepelled} thrown back, ${Math.round(st.goodsLostToRaids)} goods carried off</td></tr>
    <tr><td>Demands</td><td>${st.demandsGranted} granted, ${st.demandsRefused} refused</td></tr>
    <tr><td>Decisions</td><td>${st.choicesAnswered} answered</td></tr>
    <tr><td>Rome</td><td>${st.romeRequestsCompleted} completed, ${st.romeRequestsDeclined} declined</td></tr>
    <tr><td>Deaths</td><td>${st.deaths}</td></tr>
    <tr><td>Peak population</td><td>${st.peakPopulation}</td></tr>
    <tr><td>Country</td><td>${st.sitesClaimed} claimed, ${st.sitesLost} overrun, ${st.siteRaidsRepelled} held, ${st.scoutsLost} scouting parties lost</td></tr>
    <tr><td>Denarii spent on haste</td><td>${Math.round(st.denariiSpentOnHaste)}</td></tr>
    <tr><td>Lesser offices</td><td>corruption ${n(lesserEffect(s, 'corruptionFall'))}/round, build ${Math.round(lesserEffect(s, 'buildSpeed') * 100)}% faster, defence +${n(lesserEffect(s, 'defence'))}</td></tr>
  </table>
  ${renderHistoryTable(s)}
  <p class="muted">Founded ${new Date(s.createdAt).toLocaleDateString()} · save version ${s.version}</p>`;
}

/** Wire delegated events once on the panel element. */
export function bindPanel(panel: HTMLElement, h: PanelHandlers): void {
  // `toggle` does not bubble, so it is caught on the way down instead.
  panel.addEventListener('toggle', (ev) => {
    const d = (ev.target as HTMLElement).closest('details') as HTMLDetailsElement | null;
    if (d?.dataset.menu) rememberOpen(d.dataset.menu, d.open);
    const id = d?.dataset.intrigue ?? d?.dataset.menu;
    if (!id) return;
    if (d!.open) openMenus.add(id);
    else openMenus.delete(id);
  }, true);
  panel.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.tab) return h.onTab(d.tab as Tab);
    // The Reports folder: panel-module state, re-rendered through the tab.
    if (d.reportFilter) { setReportFilter(d.reportFilter); return h.onTab('log'); }
    if (d.build && d.building) return h.onBuild(d.build, d.building);
    if (d.selectSlot) return h.onSelectSlot(d.selectSlot);
    // The plot card's way back: no slot selected is the overview.
    if ('overview' in d) return h.onSelectSlot('');
    if (d.selectHex) return h.onSelectHex(d.selectHex);
    if ('advisorDismiss' in d) return h.onDismissAdvisor();
    if (d.rush) return h.onRush(d.rush);
    if (d.research) return h.onResearch(d.research);
    if (d.rushResearch) return h.onRushResearch(d.rushResearch);
    if (d.appoint) {
      const sel = panel.querySelector<HTMLSelectElement>(`select[data-select-post="${d.appoint}"]`);
      if (sel) return h.onPolitical({ type: 'appoint', postId: d.appoint, characterId: sel.value });
      return;
    }
    if (d.appointLesser) {
      const sel = panel.querySelector<HTMLSelectElement>(`select[data-select-lesser="${d.appointLesser}"]`);
      if (sel) return h.onPolitical({ type: 'appoint_lesser', postId: d.appointLesser, characterId: sel.value });
      return;
    }
    if (d.dismissLesser) return h.onPolitical({ type: 'dismiss_lesser', postId: d.dismissLesser });
    if (d.dismiss) return h.onPolitical({ type: 'dismiss', postId: d.dismiss });
    if (d.choice) return h.onChoice(d.choice);
    if (d.scout) return h.onScout(d.scout);
    if (d.claim) return h.onPolitical({ type: 'claim', hex: d.claim });
    if (d.release) return h.onPolitical({ type: 'release', hex: d.release });
    if (d.garrison) return h.onPolitical({ type: 'garrison', hex: d.garrison, men: Number(d.men) });
    if (d.accept) return h.onPolitical({ type: 'accept_demand', familyId: d.accept });
    if (d.refuse) return h.onPolitical({ type: 'refuse_demand', familyId: d.refuse });
    if (d.guards) return h.onGuards(d.guards, Number(d.men));
    if ('adoptNew' in d) return h.onAdoptNewMan();
    if (d.adopt) {
      const id = panel.querySelector<HTMLSelectElement>(`select[data-select-adopt="${d.adopt}"]`)?.value ?? '';
      return id ? h.onPolitical({ type: 'adopt', characterId: id }) : undefined;
    }
    if (d.marry) {
      const sel = panel.querySelector<HTMLSelectElement>(`select[data-select-marry="${d.marry}"]`);
      const [aId, bId] = (sel?.value ?? '').split('|');
      if (aId && bId) return h.onPolitical({ type: 'marry', aId, bId });
      return;
    }
    // Both of these read the one target select their house's menu carries.
    const target = (familyId: string) =>
      panel.querySelector<HTMLSelectElement>(`select[data-select-target="${familyId}"]`)?.value ?? '';
    if (d.exile) {
      const id = target(d.exile);
      return id ? h.onPolitical({ type: 'exile', characterId: id }) : undefined;
    }
    if (d.assassinate) {
      const id = target(d.assassinate);
      return id ? h.onPolitical({ type: 'assassinate', targetId: id }) : undefined;
    }
    if (d.envoy) {
      const sel = panel.querySelector<HTMLSelectElement>(`select[data-select-envoy="${d.envoy}"]`);
      if (sel) return h.onEnvoy(d.envoy, sel.value);
      return;
    }
    if (d.trade && d.tribe) return h.onTrade(d.tribe, Number(d.trade));
    // Every action that carries an id must be matched before the bare catch-all
    // below, or it reaches the store with its id stripped off.
    if (d.political === 'appease' && d.tribe) return h.onPolitical({ type: 'appease', tribeId: d.tribe });
    if (d.political && d.family) {
      const kind = d.political as 'bribe' | 'expose' | 'denounce';
      return h.onPolitical({ type: kind, familyId: d.family });
    }
    if (d.political) return h.onPolitical({ type: d.political as Exclude<Political['type'], 'appoint' | 'dismiss' | 'bribe'> } as Political);
    if ('export' in d) return h.onExport();
    if ('import' in d) {
      const ta = panel.querySelector<HTMLTextAreaElement>('textarea[data-import-text]');
      return h.onImport(ta?.value ?? '');
    }
    if ('reset' in d) return h.onReset();
  });
}
