import { Game } from './game';
import { config } from './data';
import { createInitialState, deserialise, loadFromLocalStorage, saveToLocalStorage, serialise, clearLocalStorage } from './state/store';
import { createVillageView } from './render/village';
import { bindPanel, renderHeader, renderPanel, type Tab } from './render/panel';

const app = document.getElementById('app')!;
app.innerHTML = `<header></header><div id="village"></div><div id="panel"></div>`;
const header = app.querySelector('header')!;
const villageEl = document.getElementById('village')!;
const panelEl = document.getElementById('panel')!;

let game = new Game(loadFromLocalStorage() ?? createInitialState());
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
  if (!saveToLocalStorage(game.state)) toast('Could not save to this browser. Export your game.');
}

function render(force = false): void {
  const now = Date.now();
  header.innerHTML = renderHeader(game.state);
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
  onBuild: (slot, b) => guard(() => game.build(slot, b)),
  onRush: (slot) => guard(() => game.rush(slot)),
  onPolitical: (a) => guard(() => game.act(a)),
  onEnvoy: (id) => guard(() => game.dispatchEnvoy(id)),
  onTrade: (amt) => guard(() => game.trade(amt)),
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
    game.tick();
    toast('Save imported.');
  }),
  onReset: () => {
    if (!confirm('Abandon this colony and found a new one? Export first if you want to keep it.')) return;
    clearLocalStorage();
    game = new Game(createInitialState());
    selected = null;
    guard(() => {});
  },
});

game.tick();
persist();
render(true);
setInterval(() => {
  game.tick();
  render();
}, config.tickMs);
setInterval(persist, 15_000);
window.addEventListener('beforeunload', persist);
