import { activeTribe, building, config, envoys, lesserPosts as lesserDefs, posts as postDefs, unlocks, RESOURCE_IDS, type ResourceId } from '../data';
import type { GameState, LogEntry } from '../state/types';
import type { Game, Political } from '../game';
import { checkBuild, eligibleBuildings, rushPrice, slotById } from '../village/construction';
import { canAfford, netPerHour } from '../village/economy';
import { capacity, hiddenPerResource, populationCap, forumTier } from '../village/storage';
import { gravitasRank, leaderOf, livingMembers, playerFamily, rivalFamilies, standing } from '../politics/characters';
import { holderOf, lesserEffect, lesserHolderOf, meetsRank, postsHeldBy } from '../politics/posts';
import { militiaPool, homeMilitia } from '../combat/militia';
import { defenceStrength, raidChance, raidStrength } from '../combat/raids';
import { tradeRate } from '../tribes/envoys';
import { portraitSvg } from './portrait';
import { claimCost, claimOf, isScouted, ringOf, scoutCost, siteAt, siteDefence, siteRaidChance, upkeepPerRound } from '../map/sites';
import { site as siteDef } from '../map/world';
import { spareMilitia } from '../combat/militia';
import { backingCost } from '../politics/intrigue';
import { favourRewardMultiplier } from '../rome/requests';
import { appeasePrice } from '../tribes/turn';
import { pendingChoices } from '../politics/events';
import { roundsUntilIdle } from '../politics/rounds';

export type Tab = 'village' | 'map' | 'council' | 'family' | 'tribe' | 'rome' | 'log' | 'save';
const TABS: { id: Tab; name: string }[] = [
  { id: 'village', name: 'Village' },
  { id: 'map', name: 'Map' },
  { id: 'council', name: 'Council' },
  { id: 'family', name: 'Houses' },
  { id: 'tribe', name: 'Tribe' },
  { id: 'rome', name: 'Rome' },
  { id: 'log', name: 'Log' },
  { id: 'save', name: 'Save' },
];

export interface PanelHandlers {
  onTab(t: Tab): void;
  onChoice(id: string): void;
  onScout(hex: string): void;
  onBuild(slotId: string, buildingId: string): void;
  onRush(slotId: string): void;
  onPolitical(a: Political): void;
  onEnvoy(id: string): void;
  onTrade(amount: number): void;
  onExport(): void;
  onImport(json: string): void;
  onReset(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const n = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());
const ROMAN = ['', 'I', 'II', 'III'];

export interface News { title: string; subtitle: string; lines: LogEntry[] }

/**
 * Everything that has happened since the player last acknowledged the news:
 * the opening beat on a new colony, the report after a round, or the digest of
 * rounds that ran while the game was closed.
 */
export function pendingNews(state: GameState): News | null {
  const lines = state.log.filter((e) => e.id > state.seenLogId && !/^Round \d+\.$/.test(e.text));
  if (!lines.length && !state.pendingChoice) return null;
  if (state.awayRounds > 0) {
    return {
      title: 'While you were away',
      subtitle: `${state.awayRounds} round${state.awayRounds === 1 ? '' : 's'} ran without you. The council does not wait.`,
      lines,
    };
  }
  if (state.round === 0) {
    return { title: esc(config.townName), subtitle: 'A colonia in Germania, beyond the Rhine. Rome expects it to stand.', lines };
  }
  const r = state.lastReport;
  return {
    title: `Round ${state.round}`,
    subtitle: r ? `Population ${Math.floor(state.population)} · corruption ${n(state.corruption)}` : '',
    lines,
  };
}

export function renderNews(news: News, state: GameState): string {
  const items = news.lines.map((e) => `<li class="k-${e.kind}">${esc(e.text)}</li>`).join('');
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
  return `<div class="news-card"><h2>${news.title}</h2><p class="muted">${esc(news.subtitle)}</p>
    <ul>${items}</ul>${foot}</div>`;
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
  return `<h1>${esc(config.townName)}</h1><span class="muted">Round ${state.round} · Pop ${Math.floor(state.population)}/${populationCap(state)} · Forum ${ROMAN[forumTier(state)]}${admin}</span><div class="res">${res}</div>`;
}

export function renderPanel(game: Game, tab: Tab, selected: string | null, now: number, selectedHex: string | null = null): string {
  const s = game.state;
  const badge = (t: Tab) => {
    if (t === 'rome' && s.rome.activeRequest && !s.rome.activeRequest.fulfilled) return '<span class="badge">!</span>';
    return '';
  };
  const nav = TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === tab ? 'active' : ''}">${t.name}${badge(t.id)}</button>`).join('');
  let body = '';
  switch (tab) {
    case 'village': body = renderVillage(s, selected, now); break;
    case 'map': body = renderMap(s, selectedHex); break;
    case 'council': body = renderCouncil(s, now); break;
    case 'family': body = renderFamilies(s); break;
    case 'tribe': body = renderTribe(s); break;
    case 'rome': body = renderRome(s); break;
    case 'log': body = renderLog(s); break;
    case 'save': body = renderSave(s); break;
  }
  return `<nav>${nav}</nav><section>${body}</section>`;
}

function costTxt(cost: Partial<Record<ResourceId, number>>, state: GameState): string {
  return Object.entries(cost)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="${state.resources[k as ResourceId] < (v ?? 0) ? 'neg' : ''}" style="${state.resources[k as ResourceId] < (v ?? 0) ? 'color:var(--terracotta)' : ''}">${v} ${k}</span>`)
    .join(', ');
}

function renderVillage(s: GameState, selected: string | null, now: number): string {
  const a = s.constructions.filter((c) => c.kind === 'building').length;
  const f = s.constructions.filter((c) => c.kind === 'field').length;
  let out = `<h2>Village</h2><p class="muted">One building and one field may be under construction at a time. Building ${a}/${config.concurrency.building}, field ${f}/${config.concurrency.field}. Cellars hide ${hiddenPerResource(s)} of each resource from raiders.</p>`;
  if (!selected) return out + `<p>Select a plot on the map.</p>`;
  const slot = slotById(s, selected);
  const c = s.constructions.find((x) => x.slotId === slot.id);
  out += `<h3>${slot.building ? esc(building(slot.building).name) : slot.site ? esc(slot.site.replace('_', ' ')) : 'Empty plot'} ${slot.tier ? ROMAN[slot.tier] : ''}</h3>`;
  if (slot.building) out += `<p class="muted">${esc(building(slot.building).role)}</p>`;
  if (c) {
    const price = rushPrice(s, c, now);
    out += `<div class="card"><p>Work in progress on tier ${c.toTier}.</p><p>Hire extra hands to finish now: <b>${price} denarii</b></p><button class="act" data-rush="${slot.id}" ${s.resources.denarii < price ? 'disabled' : ''}>Finish now</button></div>`;
    return out;
  }
  for (const bid of eligibleBuildings(s, slot)) {
    const def = building(bid);
    const check = checkBuild(s, slot.id, bid);
    if (check.toTier > def.tiers.length) {
      out += `<div class="card"><b>${esc(def.name)}</b> is at its top tier.</div>`;
      continue;
    }
    const tier = def.tiers[check.toTier - 1];
    const effects = Object.entries(tier.effects).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${v}`).join(', ');
    out += `<div class="card"><b>${esc(def.name)} ${ROMAN[check.toTier]}</b><p class="muted">${esc(def.role)}</p><p>${effects}</p><p>Cost: ${costTxt(check.cost, s)}</p>`;
    out += `<button class="act" data-build="${slot.id}" data-building="${bid}" ${check.ok ? '' : 'disabled'}>${slot.tier ? 'Upgrade' : 'Build'}</button>`;
    if (!check.ok && check.reason) out += ` <span class="muted">${esc(check.reason)}</span>`;
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
    const can = (s.resources.denarii ?? 0) >= (cost.denarii ?? 0);
    out += `<p>Claim for ${costTxt(cost, s)} · upkeep grows with distance</p>
      <button class="act" data-claim="${hex}" ${can ? '' : 'disabled'}>Claim it</button>`;
  }
  return out + `</div>`;
}

function renderCouncil(s: GameState, now: number): string {
  const office = s.office ? s.characters[s.office] : null;
  let out = `<h2>The council</h2>`;
  out += `<p><b>${config.topOffice.title}:</b> ${office ? esc(office.name) : 'vacant'}</p>`;
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
    out += `<button class="act" data-appoint="${p.id}">Appoint</button>`;
    if (h) out += `<button class="act secondary" data-dismiss="${p.id}">Dismiss</button>`;
    out += `</div>`;
  }
  out += `<h3>Lesser offices</h3><p class="muted">Outside the council: a little standing, no leverage. Somewhere to keep a house content without handing it anything to obstruct with.</p>`;
  for (const p of lesserDefs) {
    const h = lesserHolderOf(s, p.id);
    out += `<div class="card lesser ${h ? (s.families[h.familyId].isPlayer ? 'player' : 'rival') : ''}"><b>${esc(p.name)}</b> <span class="muted">(${p.stat})</span>
      <p class="muted">${esc(p.description)}</p>
      <p>${h ? `${esc(h.name)} of the ${s.families[h.familyId].name}` : '<em>vacant</em>'}</p>
      <select data-select-lesser="${p.id}">${living.filter((c) => !c.post).map((c) => `<option value="${c.id}">${esc(c.name)} — ${s.families[c.familyId].name}, ${p.stat} ${c.stats[p.stat]}</option>`).join('')}</select>
      <button class="act" data-appoint-lesser="${p.id}">Appoint</button>${h ? `<button class="act secondary" data-dismiss-lesser="${p.id}">Dismiss</button>` : ''}</div>`;
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

function renderFamilies(s: GameState): string {
  let out = `<h2>The houses</h2>`;
  const fams = [playerFamily(s), ...rivalFamilies(s)];
  for (const f of fams) {
    const members = f.memberIds.map((id) => s.characters[id]);
    const held = postsHeldBy(s, f.id);
    out += `<div class="card ${f.isPlayer ? 'player' : 'rival'}"><b>${esc(f.gensName)}</b> — standing ${n(standing(s, f.id))}, ${livingMembers(s, f.id).length} living, ${held.length} post${held.length === 1 ? '' : 's'}${f.loyalist ? ', loyal to Rome' : ''}`;
    if (!f.isPlayer) {
      out += `<p>Attitude toward you: <b>${n(f.attitude)}</b></p><div class="meter att"><i style="width:${(f.attitude + 100) / 2}%"></i></div>`;
      if (f.attitude <= config.posts.unhappyThreshold && held.length) out += `<p style="color:var(--terracotta)">Unhappy and in office: expect obstruction, skimming or leaks.</p>`;
      if (held.length === 0) out += `<p class="muted">Without a post their regard for you falls each round.</p>`;
      if (held.length >= config.posts.dangerousPostCount) out += `<p style="color:var(--terracotta)">They hold too many posts. Dangerous.</p>`;
      if (f.grievances > 0) out += `<p class="muted">Grievances remembered: <b>${f.grievances}</b>${f.denounced ? ' · they have written to Rome' : ''}</p>`;
      if (f.demand) {
        const d = f.demand;
        const what = d.kind === 'post' ? `the post of ${esc(postDefs.find((p) => p.id === d.postId)?.name ?? d.postId!)}` : `${d.denarii} denarii`;
        const can = d.kind === 'denarii' ? s.resources.denarii >= (d.denarii ?? 0) : true;
        out += `<div class="card demand"><b>They ask for ${what}.</b><p class="muted">An answer is expected by round ${d.dueRound}. Silence counts as refusal, and costs more.</p>
          <button class="act" data-accept="${f.id}" ${can ? '' : 'disabled'}>Grant it</button>
          <button class="act secondary" data-refuse="${f.id}">Refuse</button></div>`;
      }
      const b = config.intrigue.bribe;
      const pl = leaderOf(s, playerFamily(s).id);
      const canBribe = s.resources.denarii >= b.cost && !!pl && gravitasRank(pl) >= b.minRank;
      out += `<button class="act" data-political="bribe" data-family="${f.id}" ${canBribe ? '' : 'disabled'}>Bribe (${b.cost} denarii, +${b.attitude}${b.minRank ? `, rank ${b.minRank}` : ''})</button>`;
    }
    out += `<div class="roster">`;
    for (const c of members) {
      const st = c.stats;
      const postName = c.post ? esc(postDefs.find((p) => p.id === c.post)?.name ?? c.post) : '';
      out += `<div class="member${c.alive ? '' : ' dead'}">${portraitSvg(c, f, { dead: !c.alive })}
        <div class="who"><b>${esc(c.name)}</b>${c.isLeader ? ' <span title="head of the house">★</span>' : ''}
          <div class="muted">${c.alive ? `age ${c.age}` : `† ${esc(c.causeOfDeath ?? '')}`} · gravitas ${n(c.gravitas)}, rank ${gravitasRank(c)}${postName ? ` · ${postName}` : ''}</div>
          <div class="stats"><span>auth ${st.authority}</span><span>disc ${st.discipline}</span><span>craft ${st.craft}</span><span>conn ${st.connections}</span><span>piety ${st.piety}</span></div>
        </div></div>`;
    }
    out += `</div></div>`;
  }
  out += `<p class="muted">A post teaches its trade: its holder's stat grows while he serves. Gravitas rank gates the greater posts. Age is counted in rounds. Natural death begins after ${config.lifespan.roundsMin} and is certain by ${config.lifespan.roundsMax}. Marriage, heirs and adoption arrive in v0.2.</p>`;
  return out;
}

function renderTribe(s: GameState): string {
  const t = s.tribe;
  const def = activeTribe();
  let out = `<h2>${esc(def.name)}</h2><p class="muted">${esc(def.description)}</p>`;
  out += `<p>Fear <b>${n(t.fear)}</b></p><div class="meter fear"><i style="width:${t.fear}%"></i></div>`;
  out += `<p>Trust <b>${n(t.trust)}</b></p><div class="meter trust"><i style="width:${t.trust}%"></i></div>`;
  out += `<p>Their strength ${n(raidStrength(s))} against your defence <b>${n(defenceStrength(s))}</b> (walls, ${homeMilitia(s)} of ${militiaPool(s)} militia at home, the garrison prefect). Raid chance this round: <b>${Math.round(raidChance(s) * 100)}%</b>.</p>`;
  if (t.allied) out += `<p style="color:var(--moss)">Allied. They do not raid.</p>`;
  if (t.hostagesUntilRound > s.round) out += `<p>Hostages held: no raids until round ${t.hostagesUntilRound}.</p>`;
  if (t.leakedUntilRound > s.round) out += `<p style="color:var(--terracotta)">They know the size of your stores (until round ${t.leakedUntilRound}).</p>`;
  if (t.massingForRound >= s.round) {
    const price = appeasePrice(s);
    const odds = raidStrength(s) > defenceStrength(s) ? 'Your walls will not hold them.' : 'Your walls should hold.';
    out += `<div class="card demand"><b>They are massing. The raid lands on round ${t.massingForRound}.</b>
      <p>${odds}</p><p class="muted">Buying them off raises trust and lowers their fear of you: they learn that you pay.</p>
      <button class="act" data-political="appease" ${s.resources.denarii < price ? 'disabled' : ''}>Pay ${price} denarii to turn them back</button></div>`;
  }
  out += `<h3>Envoys</h3>`;
  if (t.pendingEnvoy) out += `<p>An envoy is on the road: <b>${esc(envoys.find((e) => e.id === t.pendingEnvoy)?.name ?? t.pendingEnvoy)}</b>. It resolves at the next round.</p>`;
  for (const e of envoys) {
    out += `<div class="card"><b>${esc(e.name)}</b><p class="muted">${esc(e.description)}</p><button class="act" data-envoy="${e.id}" ${t.pendingEnvoy ? 'disabled' : ''}>Send</button></div>`;
  }
  out += `<h3>Trade</h3>`;
  if (t.tradeOpen) {
    const rate = tradeRate(s);
    out += `<p>They give ${def.trade.gives} for ${def.trade.wants} at ${n(rate)} : 1.</p>`;
    for (const amt of [20, 50, 100]) {
      out += `<button class="act" data-trade="${amt}" ${s.resources[def.trade.wants] < amt * rate ? 'disabled' : ''}>${amt} ${def.trade.gives} for ${Math.ceil(amt * rate)} ${def.trade.wants}</button> `;
    }
  } else {
    out += `<p class="muted">No trade agreement. Send an envoy to offer trade (needs a market).</p>`;
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

function renderLog(s: GameState): string {
  const items = [...s.log].reverse().slice(0, 80).map((e) => `<li class="k-${e.kind}"><span class="muted">r${e.round}</span> ${esc(e.text)}</li>`).join('');
  return `<h2>Log</h2><div class="log"><ul>${items}</ul></div>`;
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
  <p class="muted">Founded ${new Date(s.createdAt).toLocaleDateString()} · save version ${s.version}</p>`;
}

/** Wire delegated events once on the panel element. */
export function bindPanel(panel: HTMLElement, h: PanelHandlers): void {
  panel.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.tab) return h.onTab(d.tab as Tab);
    if (d.build && d.building) return h.onBuild(d.build, d.building);
    if (d.rush) return h.onRush(d.rush);
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
    if (d.political === 'bribe' && d.family) return h.onPolitical({ type: 'bribe', familyId: d.family });
    if (d.political) return h.onPolitical({ type: d.political as Exclude<Political['type'], 'appoint' | 'dismiss' | 'bribe'> } as Political);
    if (d.envoy) return h.onEnvoy(d.envoy);
    if (d.trade) return h.onTrade(Number(d.trade));
    if ('export' in d) return h.onExport();
    if ('import' in d) {
      const ta = panel.querySelector<HTMLTextAreaElement>('textarea[data-import-text]');
      return h.onImport(ta?.value ?? '');
    }
    if ('reset' in d) return h.onReset();
  });
}
