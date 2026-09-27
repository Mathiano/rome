/**
 * Due: everything that lands next, in one place (DESIGN §12's last verb,
 * "leave", and its first, "collect"). One collector, `dueItems`, read off the
 * state through functions that already exist, rendered twice: the block at
 * the top of the Village tab and the round card's "Before you go" footer.
 *
 * Time is stated the way §3.1 (as amended) allows and no other way: a job's
 * time left in rounded words. A round runs only when the player acts (§3.2,
 * §3.3), so it is named — "at round 14" — never timed. The
 * village clock itself is not shown, and nothing here counts down.
 *
 * The return strip lives here too: what the village clock did while the game
 * was closed, as amounts (village/away.ts), never as a duration.
 */
import { building, config, envoys, posts as postDefs, researchNode, tribeDef, type ResourceId } from '../data';
import type { GameState, Resources } from '../state/types';
import { mayReturn } from '../politics/secession';
import { defenceStrength, raidStrength } from '../combat/raids';
import { appeasePrice } from '../tribes/turn';
import { storeOf } from '../village/storage';
import type { AwayReport } from '../village/away';
import { esc, remainingText, ROMAN } from './overview';
import type { Tab } from './panel';

export interface DueItem {
  text: string;
  /** Where the line lands: a tab, and on the Village tab a plot. */
  goto: { tab: Tab; slot?: string };
}

export interface Due {
  /** On the village clock: jobs under way, each with its time left. */
  village: DueItem[];
  /** At the next round, whenever the player convenes it. */
  nextRound: DueItem[];
  /** At a named round further out. */
  later: DueItem[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function dueItems(s: GameState, now: number): Due {
  const village: DueItem[] = [];
  const nextRound: DueItem[] = [];
  const later: DueItem[] = [];
  /** A thing that happens at round `r`: next round if that is next, else named. */
  const at = (r: number, text: string, goto: DueItem['goto']) => {
    if (r <= s.round + 1) nextRound.push({ text: `${text}.`, goto });
    else later.push({ text: `${text} at round ${r}.`, goto });
  };

  for (const c of s.constructions) {
    village.push({ text: `${building(c.buildingId).name} ${ROMAN[c.toTier]}: ${remainingText(c.finishAt - now)}.`, goto: { tab: 'village', slot: c.slotId } });
  }
  for (const p of s.research.active) {
    village.push({ text: `${researchNode(p.id).name} under study: ${remainingText(p.finishAt - now)}.`, goto: { tab: 'library' } });
  }

  if (s.map.pendingScout) nextRound.push({ text: `Scouts report from ${s.map.pendingScout}.`, goto: { tab: 'map' } });
  for (const t of Object.values(s.tribes)) {
    const name = tribeDef(t.id).name;
    if (t.pendingEnvoy) {
      const e = envoys.find((x) => x.id === t.pendingEnvoy)?.name ?? t.pendingEnvoy;
      nextRound.push({ text: `${name} hear your envoy: ${e.toLowerCase()}.`, goto: { tab: 'tribe' } });
    }
    if (t.massingForRound >= s.round) {
      const text = `${name} are massing, about ${Math.round(raidStrength(s, t))} against your ${Math.round(defenceStrength(s))}; the raid lands on round ${t.massingForRound}. ${appeasePrice(s, t.id)} denarii turns them back.`;
      (t.massingForRound <= s.round + 1 ? nextRound : later).push({ text, goto: { tab: 'tribe' } });
    }
    if (t.hostagesUntilRound > s.round) at(t.hostagesUntilRound, `${name} have their hostages back`, { tab: 'tribe' });
    if (t.leakedUntilRound > s.round) at(t.leakedUntilRound, `${name} forget the size of your stores`, { tab: 'tribe' });
  }
  if (s.rome.activeRequest?.fulfilled) nextRound.push({ text: 'Rome answers.', goto: { tab: 'rome' } });
  if (s.rome.hostingUntilRound > s.round) at(s.rome.hostingUntilRound, "Rome's guest leaves", { tab: 'rome' });
  if (s.rome.administeringUntilRound > s.round) at(s.rome.administeringUntilRound, 'The procurator hands the colony back', { tab: 'rome' });

  const sc = config.secession;
  for (const f of Object.values(s.families)) {
    if (f.isPlayer) continue;
    if (f.departedRound !== null) {
      if (mayReturn(s, f)) nextRound.push({ text: `The ${f.name} are ready to come home.`, goto: { tab: 'family' } });
      else {
        const away = s.round - f.departedRound;
        if (away < sc.awayRounds) at(f.departedRound + sc.awayRounds, `The ${f.name} hear terms again`, { tab: 'family' });
        if (away < sc.maxAwayRounds) at(f.departedRound + sc.maxAwayRounds, `The ${f.name} come home regardless`, { tab: 'family' });
      }
      continue;
    }
    if (f.sourRounds === sc.rounds - 1) nextRound.push({ text: `The ${f.name} will leave the colony.`, goto: { tab: 'family' } });
    if (f.demand) {
      const d = f.demand;
      const what = d.kind === 'post' ? `the post of ${postDefs.find((p) => p.id === d.postId)?.name ?? d.postId!}` : `${d.denarii} denarii`;
      const text = `The ${f.name} ask for ${what}; an answer is expected by round ${d.dueRound}.`;
      (d.dueRound <= s.round + 1 ? nextRound : later).push({ text, goto: { tab: 'family' } });
    }
  }
  if (s.challenge) at(s.challenge.voteRound, `The houses vote on the office of ${config.topOffice.title}`, { tab: 'council' });

  return { village, nextRound, later };
}

function dueLine(i: DueItem): string {
  const target = i.goto.slot ? `data-select-slot="${i.goto.slot}"` : `data-tab="${i.goto.tab}"`;
  return `<li><button class="link" ${target}>${esc(i.text)}</button></li>`;
}

function dueGroup(title: string, items: DueItem[]): string {
  if (!items.length) return '';
  return `<h4>${title}</h4><ul>${items.map(dueLine).join('')}</ul>`;
}

/**
 * The Village block. `open` is the remembered state: the panel is rebuilt as a
 * string whenever anything moves, and the block must not slam shut under the
 * player's hand when a plot is selected.
 */
export function renderDue(s: GameState, now: number, open: boolean): string {
  const d = dueItems(s, now);
  const empty = !d.village.length && !d.nextRound.length && !d.later.length;
  let body = empty ? `<p class="muted">Nothing under way.</p>` : '';
  body += dueGroup('Under way', d.village) + dueGroup('At the next round', d.nextRound) + dueGroup('Later', d.later);
  return `<details class="due" data-menu="due" ${open ? 'open' : ''}><summary>Due</summary>${body}</details>`;
}

// ---------------------------------------------------------------------------
// Since you were last here

/** One line per store: what it turned away, in amounts. */
export function overflowWords(overflow: Partial<Resources>): string[] {
  const byStore = new Map<string, string[]>();
  for (const [id, v] of Object.entries(overflow) as [ResourceId, number][]) {
    const amount = Math.round(v ?? 0);
    if (amount < 1) continue;
    // The treasury has no cap and no building; `accrue` never counts it.
    if (storeOf(id) === 'treasury') continue;
    const store = building(storeOf(id)).name;
    byStore.set(store, [...(byStore.get(store) ?? []), `${amount} ${id}`]);
  }
  return [...byStore.entries()].map(([store, parts]) => {
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
    return `The ${store} stood full: ${list} went to waste.`;
  });
}

/** The strip's lines from the report: amounts, tiers, studies, citizens. No duration. */
export function awayLines(r: AwayReport): string[] {
  const lines: string[] = [];
  const moved = (Object.entries(r.resources) as [ResourceId, number][]).map(([id, d]) => `${d > 0 ? '+' : '−'}${Math.abs(d)} ${id}`);
  if (moved.length) lines.push(`${moved.join(', ')}.`);
  lines.push(...overflowWords(r.overflow));
  for (const x of r.raised) lines.push(`${building(x.building).name} ${ROMAN[x.tier]} now stands.`);
  for (const id of r.learned) lines.push(`${researchNode(id).name} is known.`);
  if (r.citizens > 0) lines.push(`${plural(r.citizens, 'more citizen')}.`);
  if (r.citizens < 0) lines.push(`${plural(-r.citizens, 'fewer citizen')}.`);
  return lines;
}

/**
 * The lines on screen are held here; when the player last saw the colony is in
 * the save (`lastSeen`, village/away.ts). The strip is put away by the first
 * action or tab change, which stamps `lastSeen`.
 */
let returnStrip: string[] = [];

export function returnStripShowing(): boolean {
  return returnStrip.length > 0;
}

export function setReturnStrip(lines: string[]): void {
  returnStrip = lines;
}

export function renderReturnStrip(): string {
  if (!returnStrip.length) return '';
  return `<div class="card away" data-away><b>Since you were last here</b><ul>${returnStrip.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
}
