import { Game } from './game';
import { config } from './data';
import { createInitialState, deserialise, loadFromLocalStorage, saveToLocalStorage, serialise, clearLocalStorage, SAVE_KEY } from './state/store';
import { createDevClock, isDevRequested, DEV_SAVE_KEY, DEV_MULTIPLIERS } from './dev';
import { createVillageView } from './render/village';
import { bindPanel, pendingNews, renderHeader, renderNews, renderPanel, type Tab } from './render/panel';

const dev = createDevClock(isDevRequested(location.search), () => Date.now(), (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })());
const saveKey = dev.enabled ? DEV_SAVE_KEY : SAVE_KEY;

const app = document.getElementById('app')!;
app.innerHTML = `<header></header><div id="village"></div><div id="panel"></div>`;
const header = app.querySelector('header')!;
const villageEl = document.getElementById('village')!;
const panelEl = document.getElementById('panel')!;

let game = new Game(loadFromLocalStorage(saveKey) ?? createInitialState(dev.now()));
let tab: Tab = 'village';
let selected: string | null = null;
let lastPanelHtml = '';

const view = createVillageView((id) => {
  selected = id;
  tab = 'village';
  render(true);
});
villageEl.appendChild(view.root);

function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  villageEl.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function guard(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    toast((e as Error).message);
  }
  persist();
  render(true);
}

function persist(): void {
  if (!saveToLocalStorage(game.state, saveKey)) toast('Could not save to this browser. Export your game.');
}

let newsEl: HTMLDivElement | null = null;
function renderNewsOverlay(): void {
  const news = pendingNews(game.state);
  if (!news) {
    newsEl?.remove();
    newsEl = null;
    return;
  }
  if (!newsEl) {
    newsEl = document.createElement('div');
    newsEl.className = 'news';
    newsEl.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      if (btn.dataset.choice) return guard(() => game.choose(btn.dataset.choice!, dev.now()));
      if (!btn.hasAttribute('data-news-ok')) return;
      game.state.seenLogId = game.state.logSeq;
      game.state.awayRounds = 0;
      persist();
      render(true);
    });
    villageEl.appendChild(newsEl);
  }
  newsEl.innerHTML = renderNews(news, game.state);
}

function render(force = false): void {
  const now = dev.now();
  header.innerHTML = renderHeader(game.state);
  renderNewsOverlay();
  if (dev.enabled) renderDevBar(now);
  view.update(game.state, now, selected);
  const html = renderPanel(game, tab, selected, now);
  // Avoid clobbering the select/textarea the player is using unless something changed.
  if (force || html !== lastPanelHtml) {
    const active = document.activeElement;
    if (!force && active && panelEl.contains(active) && (active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return;
    panelEl.innerHTML = html;
    lastPanelHtml = html;
  }
}

bindPanel(panelEl, {
  onTab: (t) => { tab = t; render(true); },
  onChoice: (id) => guard(() => game.choose(id, dev.now())),
  onBuild: (slot, b) => guard(() => game.build(slot, b, dev.now())),
  onRush: (slot) => guard(() => game.rush(slot, dev.now())),
  onPolitical: (a) => guard(() => game.act(a, dev.now())),
  onEnvoy: (id) => guard(() => game.dispatchEnvoy(id, dev.now())),
  onTrade: (amt) => guard(() => game.trade(amt, dev.now())),
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
    toast('Save imported.');
  }),
  onReset: () => {
    if (!confirm('Abandon this colony and found a new one? Export first if you want to keep it.')) return;
    clearLocalStorage(saveKey);
    game = new Game(createInitialState(dev.now()));
    selected = null;
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
  devBar.innerHTML = `<b>DEV</b> separate save slot · clock ${mults} · skip <button data-skip="1">1h</button><button data-skip="6">6h</button><button data-skip="24">24h</button><button data-skip="168">7d</button> · virtual ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')}`;
}

game.tick(dev.now());
persist();
render(true);
setInterval(() => {
  game.tick(dev.now());
  render();
}, config.tickMs);
setInterval(persist, 15_000);
window.addEventListener('beforeunload', persist);
