/**
 * The colony overview: the Village panel's landing screen, and the words the
 * plot card shares with it.
 *
 * Every building, its tier, the next tier's effect, cost, time and gate on one
 * screen — the informational half of a Tribal Wars headquarters page, without
 * the queue (DESIGN §4.4: one building and one field, nothing beyond that).
 * Placement stays on the map (§4.5): an open plot here only selects one.
 *
 * Nothing in this file is a rule. Every number comes from `checkBuild`,
 * `slotProductionPerHour` and the state; this file only says it in words.
 */
import { building, buildings, config, effectVocabulary, post as postDef, unlocks, RESOURCE_IDS, type BuildingDef, type Cost, type ResourceId, type Reward, type Ring } from '../data';
import type { ActiveRequest, GameState, Slot } from '../state/types';
import { checkBuild, openedByForumTier, progress, rushPrice, type BuildCheck } from '../village/construction';
import { denariiIncomePerHour, grainUpkeepPerHour, netPerHour, postBonus, slotProductionPerHour } from '../village/economy';
import { researchEffect, sumEffect } from '../village/storage';
import { holderOf } from '../politics/posts';
import { site as siteDef } from '../map/world';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const n = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());
export const ROMAN = ['', 'I', 'II', 'III'];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${n(Math.abs(v))}`;

/** §4.5 order: the centre, the inner ring, the outer ring, then the perimeter. */
const RING_ORDER: Ring[] = ['centre', 'inner', 'outer', 'perimeter'];
const RING_NAMES: Record<Ring, string> = { centre: 'The centre', inner: 'The inner ring', outer: 'The outer ring', perimeter: 'The perimeter' };

// ---------------------------------------------------------------------------
// Time in words (DESIGN §3.1, as amended 2026-09-20)

/**
 * A span of time in the plainest words that are true. Rounded, never to the
 * second: the village clock is still not a countdown, it just no longer hides
 * how long the wait is.
 */
function timeWords(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return 'less than a minute';
  const min = Math.round(sec / 60);
  if (min < 90) return `about ${min} minute${min === 1 ? '' : 's'}`;
  const h = sec / 3600;
  const whole = Math.floor(h);
  const half = h - whole >= 0.75 ? 1 : h - whole >= 0.25 ? 0.5 : 0;
  const shown = whole + half;
  return `about ${shown % 1 ? shown.toFixed(1) : shown} hour${shown === 1 ? '' : 's'}`;
}

/** Time left on a job under way: "about 40 minutes left". */
export function remainingText(ms: number): string {
  return `${timeWords(ms / 1000)} left`;
}

/** How long a job would take before it is started: "about 1.5 hours". Same rounding. */
export function durationText(sec: number): string {
  return timeWords(sec);
}

// ---------------------------------------------------------------------------
// Costs, effects and rewards in words

export function costTxt(cost: Cost, state: GameState): string {
  return Object.entries(cost)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="${state.resources[k as ResourceId] < (v ?? 0) ? 'neg' : ''}" style="${state.resources[k as ResourceId] < (v ?? 0) ? 'color:var(--terracotta)' : ''}">${v} ${k}</span>`)
    .join(', ');
}

/** One effect value with its unit from `data/effects.json`: 30 → "30/h", 0.15 → "15%". */
function effectValue(key: string, v: number, withUnit = true): string {
  const w = effectVocabulary[key];
  if (!w) return n(v);
  const num = w.percent ? Math.round(v * 100).toString() : n(v);
  return withUnit ? `${num}${w.unit}` : num;
}

/** The Library's additive prose; research adds to what stands. */
const EFFECT_WORDS: Record<string, (v: number) => string> = {
  buildSpeed: (v) => `building ${pct(v)} faster`,
  grainMultiplier: (v) => `${pct(v)} more grain`,
  materialMultiplier: (v) => `${pct(v)} more wood, clay and iron`,
  taxMultiplier: (v) => `${pct(v)} more tax`,
  tradeRate: (v) => `a better rate with the tribes (+${v.toFixed(2)})`,
  granaryCapacity: (v) => `${v} more grain kept`,
  warehouseCapacity: (v) => `${v} more of each material kept`,
  hiddenPerResource: (v) => `${v} more of each resource hidden from raiders`,
  populationCap: (v) => `room for ${v} more citizens`,
  militiaBonus: (v) => `${v} more men under arms`,
  defence: (v) => `${v} to the colony's defence`,
  gravitasPerRound: (v) => `${v} gravitas a round`,
  corruptionDrift: (v) => `corruption falls ${Math.abs(v)} a round`,
  romeRewardMultiplier: (v) => `${pct(v)} more from Rome's rewards`,
};

/** Research effects, additive, as the Library card prints them. */
export function effectWords(effects: Record<string, number>): string {
  return Object.entries(effects)
    .map(([k, v]) => (EFFECT_WORDS[k] ? EFFECT_WORDS[k](v) : `${effectVocabulary[k]?.noun ?? k} ${signed(v)}${effectVocabulary[k]?.unit ?? ''}`))
    .join(', ');
}

/**
 * A building's effect as absolute now → next: "yield 30 → 80/h (+50)". A
 * building's tier replaces the one below it (`sumEffect` reads the standing
 * tier, not a running total), so "more" would be the wrong word here.
 */
export function effectNowNext(def: BuildingDef, fromTier: number, toTier: number): string {
  const next = def.tiers[toTier - 1]?.effects ?? {};
  const cur = fromTier > 0 ? def.tiers[fromTier - 1].effects : {};
  return Object.entries(next).map(([k, v]) => {
    const noun = effectVocabulary[k]?.noun ?? k;
    const now = cur[k];
    if (now === undefined) return `${noun} ${effectValue(k, v)}`;
    const delta = effectVocabulary[k]?.percent ? Math.round((v - now) * 100) : Math.round((v - now) * 100) / 100;
    return `${noun} ${effectValue(k, now, false)} → ${effectValue(k, v)} (${delta >= 0 ? '+' : '−'}${n(Math.abs(delta))})`;
  }).join(', ');
}

/** Rome's reward in words, as the Rome tab says it. */
export function rewardWords(r: Reward): string {
  return [
    r.denarii ? `${r.denarii} denarii` : '',
    r.scrolls ? `${r.scrolls} scroll${r.scrolls === 1 ? '' : 's'}` : '',
    r.gravitas ? `${r.gravitas} gravitas` : '',
    r.unlock ? unlocks[r.unlock]?.name : '',
  ].filter(Boolean).join(', ');
}

/** The build request Rome is waiting on, if it asks for this building. */
export function romeAsksFor(state: GameState, buildingId: string): ActiveRequest | null {
  const a = state.rome.activeRequest;
  if (!a || a.kind !== 'build' || a.fulfilled || a.build?.building !== buildingId) return null;
  return a;
}

// ---------------------------------------------------------------------------
// Locked, and why

/**
 * Every failing gate in words: the structural one first and greyed ("needs
 * Forum II"), then the transient ones as plain text ("lane busy · short 120
 * clay"), so the player can tell "not until the Forum" from "in a while".
 */
export function lockWords(check: BuildCheck): string {
  if (check.ok) return '';
  const structural: string[] = [];
  const transient: string[] = [];
  check.gates.forEach((g, i) => {
    switch (g) {
      case 'forum': structural.push(`needs Forum ${ROMAN[Number(check.reasons[i].replace(/\D/g, ''))] ?? check.reasons[i]}`); break;
      case 'lane': transient.push('lane busy'); break;
      case 'slot_busy': transient.push('under way'); break;
      case 'resources': transient.push(`short ${Object.entries(check.short).map(([k, v]) => `${v} ${k}`).join(', ')}`); break;
      default: structural.push(check.reasons[i].toLowerCase());
    }
  });
  const out: string[] = [];
  if (structural.length) out.push(`<span class="gate">${esc(structural.join(' · '))}</span>`);
  if (transient.length) out.push(`<span class="muted">${esc(transient.join(' · '))}</span>`);
  return out.join(' ');
}

// ---------------------------------------------------------------------------
// The two lanes

/**
 * One building and one field at a time (DESIGN §4.4), shown as two lane cards.
 * No next slot and no queue: the lanes are the literal budget of a session.
 */
export function renderLanes(state: GameState, now: number): string {
  const lanes: { kind: 'building' | 'field'; name: string; limit: number }[] = [
    { kind: 'building', name: 'Building lane', limit: config.concurrency.building },
    { kind: 'field', name: 'Field lane', limit: config.concurrency.field },
  ];
  return `<div class="lanes">` + lanes.map((lane) => {
    const work = state.constructions.filter((c) => c.kind === lane.kind);
    const spare = lane.limit - work.length;
    let body = '';
    for (const c of work) {
      const price = rushPrice(state, c, now);
      const p = Math.round(progress(c, now) * 100);
      body += `<p>${esc(building(c.buildingId).name)} ${ROMAN[c.toTier]}, ${esc(remainingText(c.finishAt - now))}</p>
        <div class="meter"><i style="width:${p}%"></i></div>
        <p>Finish now: <b>${price} denarii</b> <button class="act tiny" data-rush="${c.slotId}" ${state.resources.denarii < price ? 'disabled' : ''}>Finish now</button></p>`;
    }
    if (spare > 0) body += `<p class="muted">${work.length ? `${spare} more free` : 'free'}</p>`;
    return `<div class="card lane ${spare > 0 ? 'free' : 'busy'}" data-lane="${lane.kind}"><b>${lane.name}</b>${body}</div>`;
  }).join('') + `</div>`;
}

// ---------------------------------------------------------------------------
// The rows

/** What the Forum's next tier opens, grouped so thirteen names do not scroll. */
export function forumOpensWords(t: number): string {
  const opened = openedByForumTier(t);
  if (!opened.length) return '';
  const others = buildings.filter((b) => b.id !== 'forum');
  const byTier = new Map<number, BuildingDef[]>();
  for (const o of opened) byTier.set(o.tier, [...(byTier.get(o.tier) ?? []), o.building]);
  const parts: string[] = [];
  for (const [tier, list] of [...byTier.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const missing = others.filter((b) => !list.includes(b));
    if (!missing.length) parts.push(`tier ${ROMAN[tier]} of everything`);
    else if (missing.length <= 2 && list.length > 2) parts.push(`tier ${ROMAN[tier]} of everything but the ${missing.map((b) => b.name).join(' and the ')}`);
    else parts.push(list.map((b) => `${b.name} ${ROMAN[tier]}`).join(', '));
  }
  return parts.join(', and ');
}

function romeMark(state: GameState, buildingId: string): string {
  const a = romeAsksFor(state, buildingId);
  if (!a) return '';
  return ` <span class="rome-mark" data-rome-asks="${buildingId}" title="${esc(a.title)}">Rome asks for this — ${esc(rewardWords(a.reward))}</span>`;
}

/** A row for a slot that carries a building, raised or not. */
function buildingRow(state: GameState, slot: Slot, now: number): string {
  const def = building(slot.building!);
  const work = state.constructions.find((c) => c.slotId === slot.id);
  const name = `<button class="link" data-select-slot="${slot.id}">${esc(def.name)}</button>`;
  const yieldNow = def.produces ? ` <span class="muted">${n(slotProductionPerHour(state, slot))} ${def.produces}/h</span>` : '';
  if (work) {
    const price = rushPrice(state, work, now);
    return `<li data-slot="${slot.id}"><div class="l1">${name} <b>${slot.tier ? ROMAN[slot.tier] : ''}</b>${yieldNow}${romeMark(state, def.id)}</div>
      <div class="l2"><span>tier ${ROMAN[work.toTier]} under way — ${esc(remainingText(work.finishAt - now))}</span>
      <button class="act tiny" data-rush="${slot.id}" ${state.resources.denarii < price ? 'disabled' : ''}>Finish now, ${price} denarii</button></div></li>`;
  }
  const check = checkBuild(state, slot.id, def.id);
  if (check.gates.includes('top')) {
    return `<li data-slot="${slot.id}"><div class="l1">${name} <b>${ROMAN[slot.tier]}</b>${yieldNow}${romeMark(state, def.id)}</div>
      <div class="l2"><span class="muted">at its height</span></div></li>`;
  }
  const state1 = slot.tier ? `<b>${ROMAN[slot.tier]}</b>` : `<span class="muted">not yet raised</span>`;
  let effect = effectNowNext(def, slot.tier, check.toTier);
  if (def.produces) {
    const nowYield = slotProductionPerHour(state, slot);
    const nextYield = slotProductionPerHour(state, slot, check.toTier);
    effect = slot.tier
      ? `${n(nowYield)} ${def.produces}/h now → ${n(nextYield)}/h at ${ROMAN[check.toTier]} (+${n(nextYield - nowYield)})`
      : `+${n(nextYield)} ${def.produces}/h`;
  }
  if (def.id === 'forum') {
    const opens = forumOpensWords(check.toTier);
    if (opens) effect += `; opens ${opens}`;
  }
  const action = check.ok
    ? `<button class="act tiny" data-build="${slot.id}" data-building="${def.id}">${slot.tier ? 'Upgrade' : 'Build'}</button>`
    : lockWords(check);
  return `<li data-slot="${slot.id}"><div class="l1">${name} ${state1}${yieldNow}${romeMark(state, def.id)}</div>
    <div class="l2"><span class="effect">${ROMAN[check.toTier]}: ${esc(effect)}</span> <span>${costTxt(check.cost, state)}</span> <span>${esc(durationText(check.seconds))}</span> ${action}</div></li>`;
}

/** A row for a building nobody has placed yet: cost, time and effect at tier I, and a link to a plot. */
function unplacedRow(state: GameState, def: BuildingDef, plot: Slot, count = 1): string {
  const check = checkBuild(state, plot.id, def.id);
  let effect = effectNowNext(def, 0, 1);
  if (def.produces) effect = `+${n(slotProductionPerHour(state, plot, 1, def.id))} ${def.produces}/h`;
  const where = plot.site ? `${esc(plot.site.replace('_', ' '))} ×${count}: ` : '';
  return `<li data-unplaced="${def.id}"><div class="l1">${where}<b>${esc(def.name)} I</b>${romeMark(state, def.id)}</div>
    <div class="l2"><span class="effect">${esc(effect)}</span> <span>${costTxt(check.cost, state)}</span> <span>${esc(durationText(check.seconds))}</span>
    ${lockWords({ ...check, gates: check.gates.filter((g) => g !== 'resources'), reasons: check.reasons.filter((_, i) => check.gates[i] !== 'resources') })}
    <button class="link" data-select-slot="${plot.id}">choose a plot</button></div></li>`;
}

export function renderOverview(state: GameState, now: number): string {
  let out = renderLanes(state, now);
  out += `<h3>In the colony</h3><ul class="index overview">`;
  for (const ring of RING_ORDER) {
    const rows = state.slots.filter((s) => s.ring === ring && s.building);
    if (!rows.length) continue;
    out += `<li class="ring">${RING_NAMES[ring]}</li>` + rows.map((s) => buildingRow(state, s, now)).join('');
  }
  out += `</ul>`;

  // The inner buildings not yet placed: eight slots, eight buildings, so the
  // set is exactly the complement of what stands. Rome's ask goes first.
  const taken = new Set(state.slots.filter((s) => s.building).map((s) => s.building));
  const openInner = state.slots.find((s) => s.ring === 'inner' && !s.building);
  const unplaced = buildings.filter((b) => b.ring === 'inner' && !taken.has(b.id))
    .sort((a, b) => Number(!!romeAsksFor(state, b.id)) - Number(!!romeAsksFor(state, a.id)));
  const openOuter = state.slots.filter((s) => s.ring === 'outer' && !s.building);
  if ((unplaced.length && openInner) || openOuter.length) {
    out += `<h3>Not yet placed</h3><p class="muted">Choose a plot on the map, or through the link, and raise it from the plot's card.</p><ul class="index overview">`;
    if (openInner) out += unplaced.map((b) => unplacedRow(state, b, openInner)).join('');
    const bySite = new Map<string, Slot[]>();
    for (const s of openOuter) bySite.set(s.site!, [...(bySite.get(s.site!) ?? []), s]);
    for (const [site, slots] of bySite) {
      const def = buildings.find((b) => b.site === site);
      if (def) out += unplacedRow(state, def, slots[0], slots.length);
    }
    out += `</ul>`;
  }
  out += renderLedger(state);
  return out;
}

// ---------------------------------------------------------------------------
// The ledger: the working behind the header's per-hour figures

export interface LedgerLine { label: string; value: number }

/** Named holder and stat for a post's bonus line, or the reason it is nothing. */
function postLine(state: GameState, postId: string): string {
  const p = postDef(postId);
  const holder = holderOf(state, postId);
  if (!holder || !holder.alive) return `${p.name} — vacant`;
  const bonus = postBonus(state, postId);
  if (bonus < 0) return `${p.name} — ${holder.name} obstructs`;
  return `${p.name} — ${holder.name}, ${p.stat} ${holder.stats[p.stat]}`;
}

/**
 * Every line that makes up one resource's hour, summing exactly to
 * `netPerHour`. Each is a value the game already computes; this only shows
 * the working.
 */
export function ledgerFor(state: GameState, id: ResourceId): LedgerLine[] {
  const lines: LedgerLine[] = [];
  if (id === 'denarii') {
    const tax = state.population * config.population.taxPerHeadPerHour;
    lines.push({ label: `tax: ${Math.floor(state.population)} heads × ${config.population.taxPerHeadPerHour}`, value: tax });
    const market = sumEffect(state, 'taxMultiplier') - researchEffect(state, 'taxMultiplier');
    if (market) lines.push({ label: `market: ${pct(market)}`, value: tax * market });
    const research = researchEffect(state, 'taxMultiplier');
    if (research) lines.push({ label: `research: ${pct(research)}`, value: tax * research });
    const aedile = postBonus(state, 'market');
    if (aedile) lines.push({ label: `${postLine(state, 'market')}: ${signed(Math.round(aedile * 100))}%`, value: tax * aedile });
    const drain = state.corruption * config.corruption.denariiDrainPerPointPerHour;
    if (drain) lines.push({ label: `corruption: ${n(state.corruption)} × ${config.corruption.denariiDrainPerPointPerHour}`, value: -drain });
    const sum = lines.reduce((a, l) => a + l.value, 0);
    const floored = denariiIncomePerHour(state);
    if (Math.abs(sum - floored) > 1e-9) lines.push({ label: 'the treasury takes nothing below nothing', value: floored - sum });
    return lines;
  }
  let base = 0;
  for (const s of state.slots) {
    if (!s.building || s.tier <= 0) continue;
    const def = building(s.building);
    if (def.produces !== id) continue;
    const v = def.tiers[s.tier - 1].effects.productionPerHour ?? 0;
    base += v;
    lines.push({ label: `${def.name} ${ROMAN[s.tier]}`, value: v });
  }
  for (const c of state.map.claimed) {
    const v = siteDef(c.siteId).produces?.[id] ?? 0;
    if (!v) continue;
    base += v;
    lines.push({ label: `${siteDef(c.siteId).name}, held`, value: v });
  }
  const postId = id === 'grain' ? 'granary' : 'works';
  const bonus = postBonus(state, postId);
  if (bonus) lines.push({ label: `${postLine(state, postId)}: ${signed(Math.round(bonus * 100))}%`, value: base * bonus });
  const research = researchEffect(state, id === 'grain' ? 'grainMultiplier' : 'materialMultiplier');
  if (research) lines.push({ label: `research: ${signed(Math.round(research * 100))}%`, value: base * research });
  if (id === 'grain') {
    lines.push({ label: `upkeep: ${Math.floor(state.population)} heads × ${config.population.grainUpkeepPerHeadPerHour}`, value: -grainUpkeepPerHour(state) });
  }
  return lines;
}

export function renderLedger(state: GameState): string {
  const net = netPerHour(state);
  let out = `<h3>The ledger</h3><p class="muted">Where each hour comes from, and where it goes.</p><div class="ledger">`;
  for (const id of RESOURCE_IDS) {
    const lines = ledgerFor(state, id);
    out += `<div class="res" data-ledger="${id}"><div class="l1"><b>${id}</b> <span class="${net[id] < 0 ? 'neg' : ''}">${net[id] >= 0 ? '+' : ''}${n(net[id])}/h</span></div>`;
    if (!lines.length) out += `<div class="line muted"><span>nothing yet</span></div>`;
    for (const l of lines) out += `<div class="line"><span>${esc(l.label)}</span><span class="${l.value < 0 ? 'neg' : ''}">${signed(l.value)}</span></div>`;
    out += `</div>`;
  }
  return out + `</div>`;
}
