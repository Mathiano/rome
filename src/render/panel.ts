import { activeTribe, building, config, envoys, posts as postDefs, unlocks, RESOURCE_IDS, type ResourceId } from '../data';
import type { GameState } from '../state/types';
import type { Game, Political } from '../game';
import { checkBuild, eligibleBuildings, rushPrice, slotById } from '../village/construction';
import { netPerHour } from '../village/economy';
import { capacity, hiddenPerResource, populationCap, forumTier } from '../village/storage';
import { gravitasRank, leaderOf, livingMembers, playerFamily, rivalFamilies, standing } from '../politics/characters';
import { holderOf, postsHeldBy } from '../politics/posts';
import { militiaPool, homeMilitia } from '../combat/militia';
import { defenceStrength, raidChance, raidStrength } from '../combat/raids';
import { tradeRate } from '../tribes/envoys';
import { roundsUntilIdle } from '../politics/rounds';

export type Tab = 'village' | 'council' | 'family' | 'tribe' | 'rome' | 'log' | 'save';
const TABS: { id: Tab; name: string }[] = [
  { id: 'village', name: 'Village' },
  { id: 'council', name: 'Council' },
  { id: 'family', name: 'Houses' },
  { id: 'tribe', name: 'Tribe' },
  { id: 'rome', name: 'Rome' },
  { id: 'log', name: 'Log' },
  { id: 'save', name: 'Save' },
];

export interface PanelHandlers {
  onTab(t: Tab): void;
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

export function renderPanel(game: Game, tab: Tab, selected: string | null, now: number): string {
  const s = game.state;
  const badge = (t: Tab) => {
    if (t === 'rome' && s.rome.activeRequest && !s.rome.activeRequest.fulfilled) return '<span class="badge">!</span>';
    return '';
  };
  const nav = TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === tab ? 'active' : ''}">${t.name}${badge(t.id)}</button>`).join('');
  let body = '';
  switch (tab) {
    case 'village': body = renderVillage(s, selected, now); break;
    case 'council': body = renderCouncil(s); break;
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

function charOption(s: GameState, id: string, stat: keyof typeof s.characters[string]['stats']): string {
  const c = s.characters[id];
  const fam = s.families[c.familyId];
  return `<option value="${c.id}">${esc(c.name)} (${fam.name}, ${stat} ${c.stats[stat]})</option>`;
}

function renderCouncil(s: GameState): string {
  const office = s.office ? s.characters[s.office] : null;
  let out = `<h2>The council</h2>`;
  out += `<p><b>${config.topOffice.title}:</b> ${office ? esc(office.name) : 'vacant'}</p>`;
  out += `<p>Corruption <b>${n(s.corruption)}</b></p><div class="meter"><i style="width:${s.corruption}%"></i></div>`;
  out += `<p class="muted">Corruption raises building costs (+${Math.round(s.corruption * config.corruption.costMultiplierPerPoint * 100)}%) and drains denarii. Your own treasurer lowers it.</p>`;
  const living = Object.values(s.characters).filter((c) => c.alive);
  for (const p of postDefs) {
    const h = holderOf(s, p.id);
    const obstructed = (s.obstructed[p.domain] ?? 0) > s.round;
    out += `<div class="card ${h ? (s.families[h.familyId].isPlayer ? 'player' : 'rival') : ''}"><b>${esc(p.name)}</b> <span class="muted">(${p.stat})</span><p class="muted">${esc(p.description)}</p>`;
    out += `<p>${h ? `${esc(h.name)} of the ${s.families[h.familyId].name}, ${p.stat} ${h.stats[p.stat]}` : '<em>vacant</em>'}${obstructed ? ' · <span style="color:var(--terracotta)">obstructing</span>' : ''}</p>`;
    out += `<select data-select-post="${p.id}">${living.map((c) => charOption(s, c.id, p.stat)).join('')}</select> `;
    out += `<button class="act" data-appoint="${p.id}">Appoint</button>`;
    if (h) out += `<button class="act secondary" data-dismiss="${p.id}">Dismiss</button>`;
    out += `</div>`;
  }
  out += `<h3>Actions</h3>`;
  const leader = leaderOf(s, playerFamily(s).id);
  const g = config.gravitas;
  out += `<p>Your leader holds <b>${n(leader?.gravitasStock ?? 0)}</b> spendable gravitas (rank ${leader ? gravitasRank(leader) : 0}).</p>`;
  out += `<button class="act" data-political="rome_backing" ${(leader?.gravitasStock ?? 0) < g.romeBackingCost ? 'disabled' : ''}>Seek Rome's backing (${g.romeBackingCost} gravitas)</button> `;
  out += `<button class="act secondary" data-political="convene">Convene the council (pass)</button>`;
  out += `<p class="muted">Every action here runs a political round: the rival house, the tribe and Rome all act, and everyone ages. If you stay away ${config.calendarFloorHours} hours the council meets without you (${Math.ceil(roundsUntilIdle(s, Date.now()) / 3_600_000)}h left).</p>`;
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
      const b = config.intrigue.bribe;
      out += `<button class="act" data-political="bribe" data-family="${f.id}" ${s.resources.denarii < b.cost ? 'disabled' : ''}>Bribe (${b.cost} denarii, +${b.attitude})</button>`;
    }
    out += `<table><tr><th>Name</th><th>Age</th><th>Post</th><th>Gravitas</th></tr>`;
    for (const c of members) {
      const st = c.stats;
      out += `<tr class="${c.alive ? '' : 'dead'}"><td>${esc(c.name)}${c.isLeader ? ' ★' : ''}<div class="stats"><span>auth ${st.authority}</span><span>disc ${st.discipline}</span><span>craft ${st.craft}</span><span>conn ${st.connections}</span><span>piety ${st.piety}</span></div></td><td>${c.alive ? c.age : `† ${esc(c.causeOfDeath ?? '')}`}</td><td>${c.post ? esc(postDefs.find((p) => p.id === c.post)?.name ?? c.post) : ''}</td><td>${n(c.gravitas)} (r${gravitasRank(c)})</td></tr>`;
    }
    out += `</table></div>`;
  }
  out += `<p class="muted">Age is counted in rounds. Natural death begins after ${config.lifespan.roundsMin} and is certain by ${config.lifespan.roundsMax}. Marriage, heirs and adoption arrive in v0.2.</p>`;
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
  let out = `<h2>Rome</h2><p>Favour <b>${n(r.favour)}</b> · research scrolls <b>${r.scrolls}</b> · requests completed <b>${r.completedIds.length}</b></p>`;
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
  return `<h2>Save</h2><p class="muted">The game saves itself to this browser. Export to carry it to another device; import replaces the current game.</p>
  <button class="act" data-export>Export save</button>
  <h3>Import</h3><textarea data-import-text placeholder="Paste a save here"></textarea><br><button class="act secondary" data-import>Import</button>
  <h3>Start over</h3><button class="act secondary" data-reset>New colony</button>
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
    if (d.dismiss) return h.onPolitical({ type: 'dismiss', postId: d.dismiss });
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
