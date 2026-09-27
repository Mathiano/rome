// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { requestProgression } from '../src/data';
import { renderHeader, renderPanel, type Tab } from '../src/render/panel';
import { acknowledgeNews } from '../src/render/newsOverlay';
import { patchHtml } from '../src/render/patch';

/**
 * No village tick re-renders or re-raises what the player is using (Mathias,
 * 2026-09-25). The tick draws through patchHtml: the numbers move, and the
 * element under the pointer, its tooltip, the button being clicked and the
 * section being scrolled stay the same nodes.
 */
const T0 = 1_000_000;
const MIN = 60_000;
const FORUM_SLOT = 'c1';

/** A colony at work: the mine going up, Rome asking for a waystation, the founding read. */
function busy(): Game {
  const g = new Game(createInitialState(T0, 5));
  acknowledgeNews(g.state);
  g.state.resources.wood = 590;
  g.state.resources.clay = 590;
  g.state.resources.iron = 590;
  g.state.resources.grain = 590;
  g.build(FORUM_SLOT, 'forum', T0); // Forum II: about an hour, longer than ten ticks

  const r02 = requestProgression.find((r) => r.kind === 'build')!;
  g.state.rome.activeRequest = { ...r02, delivered: {}, fulfilled: false, issuedRound: 0 };
  g.state.rome.activeRequestId = r02.id;
  return g;
}

/** What main.ts does: the tab is drawn whole once, then every tick patches it. */
function mount(g: Game, tab: Tab) {
  const header = document.createElement('header');
  const panel = document.createElement('div');
  document.body.append(header, panel);
  header.innerHTML = renderHeader(g.state);
  panel.innerHTML = renderPanel(g, tab, null, T0);
  const tick = (now: number) => {
    g.tick(now);
    patchHtml(header, renderHeader(g.state));
    patchHtml(panel, renderPanel(g, tab, null, now));
  };
  return { header, panel, tick };
}

describe('a hovered tooltip survives ten ticks', () => {
  it("on the village tab: Rome's mark and its title, the job's link, the counsel's button, the header's figures", () => {
    const g = busy();
    const { header, panel, tick } = mount(g, 'village');
    const mark = panel.querySelector('.rome-mark[title]')!;
    const job = panel.querySelector(`details.due button[data-select-slot="${FORUM_SLOT}"]`)!;
    const dismiss = panel.querySelector('aside.counsel [data-advisor-dismiss]')!;
    const section = panel.querySelector('section')!;
    const wood = header.querySelector('.res span b')!;
    expect([mark, job, dismiss, section, wood].every(Boolean)).toBe(true);
    const title = mark.getAttribute('title');
    const jobText0 = job.textContent;
    const wood0 = wood.textContent;
    for (let i = 1; i <= 10; i++) {
      tick(T0 + i * MIN); // a minute of village time a tick, so the words and figures do move
      expect(panel.querySelector('.rome-mark[title]'), `tick ${i}`).toBe(mark);
      expect(mark.getAttribute('title')).toBe(title);
      expect(panel.querySelector(`details.due button[data-select-slot="${FORUM_SLOT}"]`), `tick ${i}`).toBe(job);
      expect(panel.querySelector('aside.counsel [data-advisor-dismiss]'), `tick ${i}`).toBe(dismiss);
      expect(panel.querySelector('section'), `tick ${i}`).toBe(section); // the scrolled element stays, so its scroll does
      expect(header.querySelector('.res span b'), `tick ${i}`).toBe(wood);
      expect(mark.isConnected && job.isConnected && dismiss.isConnected && wood.isConnected).toBe(true);
    }
    // and the tick did draw: the numbers and the words moved in place
    expect(wood.textContent).not.toBe(wood0);
    expect(job.textContent).not.toBe(jobText0);
  });

  it("on the Houses tab: the head of house's title stays on the same node", () => {
    const g = busy();
    const { panel, tick } = mount(g, 'family');
    const star = panel.querySelector('span[title="head of the house"]')!;
    expect(star).toBeTruthy();
    for (let i = 1; i <= 10; i++) {
      tick(T0 + i * MIN);
      expect(panel.querySelector('span[title="head of the house"]'), `tick ${i}`).toBe(star);
    }
  });

  it('an open <details> and a chosen <select> are left as the player set them', () => {
    const g = busy();
    const { panel, tick } = mount(g, 'council');
    const select = panel.querySelector('select') as HTMLSelectElement | null;
    if (select && select.options.length > 1) select.selectedIndex = select.options.length - 1;
    const chosen = select?.selectedIndex;
    for (let i = 1; i <= 10; i++) tick(T0 + i * MIN);
    if (select) {
      expect(panel.querySelector('select')).toBe(select);
      expect(select.selectedIndex).toBe(chosen);
    }
  });
});

describe('patchHtml', () => {
  it('changes text and attributes in place, and replaces only a node that became a different thing', () => {
    const host = document.createElement('div');
    host.innerHTML = '<p id="a" class="x">one</p><button data-build="o5">Build</button><i>gone</i>';
    const p = host.querySelector('#a')!;
    const b = host.querySelector('button')!;
    patchHtml(host, '<p id="a" class="y">two</p><button data-build="o6">Build</button>');
    expect(host.querySelector('#a')).toBe(p);
    expect(p.className).toBe('y');
    expect(p.textContent).toBe('two');
    expect(host.querySelector('button')).not.toBe(b); // a different plot's button is a different button
    expect(host.querySelector('i')).toBeNull();
  });

  it('follows the markup on disabled, which the player cannot set', () => {
    const host = document.createElement('div');
    host.innerHTML = '<button>Go</button>';
    const b = host.querySelector('button')!;
    patchHtml(host, '<button disabled>Go</button>');
    expect(b.disabled).toBe(true);
    patchHtml(host, '<button>Go</button>');
    expect(b.disabled).toBe(false);
  });
});

describe('the render path', () => {
  it('main.ts rewrites the panel whole only on a change of tab, and nowhere else', () => {
    const src = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8');
    const writes = src.split('\n').filter((l) => /\.innerHTML\s*=/.test(l)).map((l) => l.trim());
    // the app shell at boot, and a new tab's page
    expect(writes).toEqual([
      'app.innerHTML = `<header></header><div id="stage"><div id="village"></div><div id="map"></div></div><div id="panel"></div>`;',
      'panelEl.innerHTML = html;',
    ]);
    const tabSwitch = src.slice(src.indexOf('if (tab !== lastTab) {'), src.indexOf('patchHtml(panelEl, html);'));
    expect(tabSwitch).toContain('panelEl.innerHTML = html;');
  });

  it('the tick loop only ticks the economy and draws; it never forces a redraw', () => {
    const src = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8');
    const loop = src.slice(src.indexOf('setInterval(() => {'), src.indexOf('}, config.tickMs);'));
    expect(loop).toContain('game.tick(dev.now());');
    expect(loop).toContain('render();');
    expect(loop).not.toContain('render(true)');
  });
});
