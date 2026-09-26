import { Game } from './game';
import { config, RESOURCE_IDS } from './data';
import { createInitialState, deserialise, loadFromLocalStorage, saveToLocalStorage, serialise, clearLocalStorage, SAVE_KEY } from './state/store';
import { createDevClock, isDevRequested, DEV_SAVE_KEY, DEV_MULTIPLIERS } from './dev';
import { createVillageView } from './render/village';
import { progress as progressOf } from './village/construction';
import { createMapView } from './render/mapview';
import { bindPanel, renderHeader, renderPanel, type Tab } from './render/panel';
import { currentAdvice } from './render/advisor';
import { markSeen, returnReport } from './village/away';
import { awayLines, returnStripShowing, setReturnStrip } from './render/due';
import { resetReportsView } from './render/reports';
import { acknowledgeNews, createNewsOverlay } from './render/newsOverlay';
import { patchHtml } from './render/patch';

const dev = createDevClock(isDevRequested(location.search), () => Date.now(), (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })());
const saveKey = dev.enabled ? DEV_SAVE_KEY : SAVE_KEY;

const app = document.getElementById('app')!;
app.innerHTML = `<header></header><div id="stage"><div id="village"></div><div id="map"></div></div><div id="panel"></div>`;
const header = app.querySelector('header')!;
const villageEl = document.getElementById('village')!;
const mapEl = document.getElementById('map')!;
const panelEl = document.getElementById('panel')!;

let game = new Game(loadFromLocalStorage(saveKey) ?? createInitialState(dev.now()));
let tab: Tab = 'village';
let selected: string | null = null;
let selectedHex: string | null = null;
let lastPanelHtml = '';
let lastPanelKey = '';
let lastTab: Tab | null = null;
/** Matches the #stage transition in render/style.css. */
const STAGE_FADE_MS = 280;
let fadingUntil = 0;

const view = createVillageView((id) => {
  selected = id;
  tab = 'village';
  render(true);
});
villageEl.appendChild(view.root);

const mapView = createMapView((hex) => {
  selectedHex = hex;
  tab = 'map';
  render(true);
});
mapEl.appendChild(mapView.root);

function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  villageEl.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/** The first action or tab change puts the return strip away, and the colony has been seen. */
function putStripAway(): void {
  if (!returnStripShowing()) return;
  setReturnStrip([]);
  markSeen(game.state, dev.now());
}

function guard(fn: () => void): void {
  putStripAway();
  try {
    fn();
  } catch (e) {
    toast((e as Error).message);
  }
  persist();
  render(true);
}

function persist(): void {
  // While the player is here with no strip up, they are seeing the colony:
  // the next strip is anchored to now, so a reload a minute later says nothing.
  if (!returnStripShowing()) markSeen(game.state, dev.now());
  if (!saveToLocalStorage(game.state, saveKey)) toast('Could not save to this browser. Export your game.');
}

const newsOverlay = createNewsOverlay(villageEl, {
  onChoice: (id) => guard(() => game.choose(id, dev.now())),
  onTab: (t) => { tab = t as Tab; render(true); },
  onSelectHex: (hex) => { selectedHex = hex; tab = 'map'; render(true); },
  onContinue: () => {
    acknowledgeNews(game.state);
    // Leaving the founding card lands on the colony overview with nothing
    // selected; the counsel card above it says where to go, and the plot it
    // names is already marked on the village.
    persist();
    render(true);
  },
});
function renderNewsOverlay(): void {
  newsOverlay.update(game.state, dev.now());
}

/**
 * A fingerprint of everything the panel actually shows. The panel used to be
 * rebuilt as a string every tick and usually thrown away unchanged; now the
 * string is only built when one of these has moved.
 */
function panelKey(now: number): string {
  const st = game.state;
  const res = RESOURCE_IDS.map((id) => Math.round(st.resources[id])).join(',');
  // The minute bucket is in the key as well as the progress step: the panel now
  // prints the time left, and a long build's bar moves more slowly than its
  // wording does.
  const mins = (finishAt: number) => Math.ceil(Math.max(0, finishAt - now) / 60_000);
  const work = [
    ...st.constructions.map((c) => `${c.slotId}:${Math.round(progressOf(c, now) * 40)}:${mins(c.finishAt)}`),
    ...st.research.active.map((r) => `${r.id}:${mins(r.finishAt)}`),
    `r${st.research.completed.length}`, `s${st.rome.scrolls}`,
  ].join(',');
  return [tab, selected, selectedHex, st.round, st.logSeq, res, work, Math.floor(st.population),
    Math.round(st.corruption), st.map.claimed.length, st.map.scouted.length, st.map.pendingScout,
    Object.values(st.tribes).map((t) => `${t.pendingEnvoy}${t.massingForRound}${Math.round(t.trust)}${Math.round(t.fear)}`).join(''),
    st.rome.activeRequestId, st.office, st.challenge?.voteRound ?? '',
    currentAdvice(st)?.id ?? '',
    Object.values(st.characters).map((c) => c.bodyguards).join(''),
    st.reports.length,
    // The Due block (render/due.ts): every named round it prints.
    Object.values(st.families).map((f) => `${f.demand?.dueRound ?? ''}:${f.sourRounds}`).join(','),
    st.rome.hostingUntilRound, st.rome.administeringUntilRound, st.rome.activeRequest?.fulfilled ?? '',
    Object.values(st.tribes).map((t) => `${t.hostagesUntilRound}:${t.leakedUntilRound}`).join(','),
  ].join('|');
}

let lastHeaderHtml = '';
/**
 * Draw what changed. Called by the player's actions (force) and by the village
 * tick. Nothing here rewrites a node that did not change: the header, the dev
 * bar and the panel are patched in place (render/patch.ts), and the news card
 * redraws only when its news does (render/newsOverlay.ts). A tick moves the
 * numbers; it never replaces the element under the pointer, the button being
 * clicked, or the section being scrolled (Mathias, 2026-09-25).
 */
function render(force = false): void {
  const now = dev.now();
  const headerHtml = renderHeader(game.state);
  if (headerHtml !== lastHeaderHtml) {
    patchHtml(header, headerHtml);
    lastHeaderHtml = headerHtml;
  }
  renderNewsOverlay();
  if (dev.enabled) renderDevBar(now);

  const onMap = tab === 'map';
  if (villageEl.dataset.hidden !== String(onMap)) {
    villageEl.dataset.hidden = String(onMap);
    mapEl.dataset.hidden = String(!onMap);
    // Keep the outgoing stage live for the length of the cross-fade, or it
    // freezes half-faded. Outside that window only the visible one is drawn:
    // the map is 469 hexes and has no business updating behind the village.
    fadingUntil = Date.now() + STAGE_FADE_MS;
  }
  const crossFading = Date.now() < fadingUntil;
  if (onMap || crossFading) mapView.update(game.state, selectedHex);
  if (!onMap || crossFading) view.update(game.state, now, selected);

  const pk = panelKey(now);
  if (!force && pk === lastPanelKey) return;
  lastPanelKey = pk;

  const html = renderPanel(game, tab, selected, now, selectedHex);
  if (force || html !== lastPanelHtml) {
    // Never clobber a select or textarea the player is using mid-interaction.
    const active = document.activeElement;
    if (!force && active && panelEl.contains(active) && (active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return;
    lastPanelHtml = html;
    if (tab !== lastTab) {
      // A new tab is a new page: drawn whole, with its entrance.
      panelEl.innerHTML = html;
      lastTab = tab;
      panelEl.querySelector('section')?.classList.add('swap');
    } else {
      patchHtml(panelEl, html);
    }
  }
}

bindPanel(panelEl, {
  onTab: (t) => { tab = t; putStripAway(); render(true); },
  onSelectSlot: (id) => { selected = id; tab = 'village'; render(true); },
  onSelectHex: (hex) => { selectedHex = hex; tab = 'map'; render(true); },
  onDismissAdvisor: () => guard(() => game.dismissAdvisor()),
  onChoice: (id) => guard(() => game.choose(id, dev.now())),
  onAdoptNewMan: () => guard(() => game.adoptNewMan(dev.now())),
  onScout: (hex) => guard(() => game.scout(hex, dev.now())),
  onBuild: (slot, b) => guard(() => game.build(slot, b, dev.now())),
  onRush: (slot) => guard(() => game.rush(slot, dev.now())),
  onPolitical: (a) => guard(() => game.act(a, dev.now())),
  onEnvoy: (tribeId, envoyId) => guard(() => game.dispatchEnvoy(tribeId, envoyId, dev.now())),
  onTrade: (tribeId, amt) => guard(() => game.trade(tribeId, amt, dev.now())),
  onGuards: (id, men) => guard(() => game.guards(id, men, dev.now())),
  onResearch: (id) => guard(() => game.research(id, dev.now())),
  onRushResearch: (id) => guard(() => game.rushResearch(id, dev.now())),
  onExport: () => {
    const json = serialise(game.state);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rome-save-round${game.state.round}.json`;
    a.click();
    navigator.clipboard?.writeText(json).then(() => toast('Save exported and copied to the clipboard.')).catch(() => toast('Save exported.'));
  },
  onImport: (json) => guard(() => {
    game = new Game(deserialise(json));
    game.tick(dev.now());
    // Another colony's rounds: the folders it shut and the filter it chose do not carry over.
    resetReportsView();
    toast('Save imported.');
  }),
  onReset: () => {
    if (!confirm('Abandon this colony and found a new one? Export first if you want to keep it.')) return;
    clearLocalStorage(saveKey);
    game = new Game(createInitialState(dev.now()));
    selected = null;
    resetReportsView();
    guard(() => {});
  },
});

// Dev bar: only exists with ?dev=1. Nothing here touches the save.
let devBar: HTMLDivElement | null = null;
function renderDevBar(now: number): void {
  if (!devBar) {
    devBar = document.createElement('div');
    devBar.className = 'devbar';
    villageEl.appendChild(devBar);
    devBar.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.mult) dev.setMultiplier(Number(b.dataset.mult));
      if (b.dataset.skip) dev.skip(Number(b.dataset.skip) * 3_600_000);
      game.tick(dev.now());
      persist();
      render(true);
    });
  }
  const mults = DEV_MULTIPLIERS.map((m) => `<button data-mult="${m}" class="${m === dev.multiplier ? 'on' : ''}">${m}×</button>`).join('');
  patchHtml(devBar, `<b>DEV</b> separate save slot · clock ${mults} · skip <button data-skip="1">1h</button><button data-skip="6">6h</button><button data-skip="24">24h</button><button data-skip="168">7d</button> · virtual ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')}`);
}

// What the village clock did since the player last saw the colony, told once
// as amounts on the Village tab (village/away.ts) — only if that was longer
// ago than config.returnStrip.minGapMinutes.
game.tick(dev.now());
const sinceSeen = returnReport(game.state, dev.now());
if (sinceSeen) setReturnStrip(awayLines(sinceSeen));
persist();
render(true);
// The village tick: the economy advances (never a round, §3.3), then only
// what changed is drawn. It never forces a redraw of what the player is using.
setInterval(() => {
  game.tick(dev.now());
  render();
}, config.tickMs);
setInterval(persist, 15_000);
window.addEventListener('beforeunload', persist);
