// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { config } from '../src/data';
import { pendingNews } from '../src/render/panel';
import { acknowledgeNews, createNewsOverlay } from '../src/render/newsOverlay';
import { pendingChoices } from '../src/politics/events';

/**
 * The founding card re-raised itself on every village tick (Mathias,
 * 2026-09-24): the overlay was rewritten each second, replacing the button
 * under the pointer and replaying the card's entrance. These tests hold the
 * card still while its news is unchanged, and hold a dismissal across a tick,
 * a reload and an idle-round catch-up.
 */
const H = 3_600_000;
const T0 = 1_000_000;

function mount(g: Game) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let continued = 0;
  const overlay = createNewsOverlay(host, {
    onChoice: (id) => g.choose(id, T0),
    onTab: () => {},
    onSelectHex: () => {},
    onContinue: () => { acknowledgeNews(g.state); continued += 1; },
  });
  return { host, overlay, continued: () => continued };
}

describe('the news card holds still', () => {
  it('the founding card is one node across many village ticks: not rewritten, not re-raised', () => {
    const g = new Game(createInitialState(T0, 5));
    const { host, overlay } = mount(g);
    overlay.update(g.state, T0);
    const card = host.querySelector('.news-card');
    const button = host.querySelector('[data-news-ok]');
    expect(card?.classList.contains('opening')).toBe(true);
    for (let s = 1; s <= 60; s++) {
      g.tick(T0 + s * config.tickMs);
      overlay.update(g.state, T0 + s * config.tickMs);
    }
    expect(host.querySelector('.news-card')).toBe(card);
    expect(host.querySelector('[data-news-ok]')).toBe(button);
    expect(host.querySelectorAll('.news-card')).toHaveLength(1);
    expect(overlay.element()!.classList.contains('settled')).toBe(false);
  });

  it('a click on Continue lands, and the card is gone at the next render', () => {
    const g = new Game(createInitialState(T0, 5));
    const { host, overlay, continued } = mount(g);
    overlay.update(g.state, T0);
    g.tick(T0 + config.tickMs);
    overlay.update(g.state, T0 + config.tickMs); // a tick between press and release
    (host.querySelector('[data-news-ok]') as HTMLButtonElement).click();
    expect(continued()).toBe(1);
    overlay.update(g.state, T0 + 2 * config.tickMs);
    expect(host.querySelector('.news-card')).toBeNull();
  });

  it('news that changes while a card is up changes it in place, without a second entrance', () => {
    // convene until a round raises a choice: the player's own rounds, one after another
    function untilChoice(seed: number): Game | null {
      const g = new Game(createInitialState(T0, seed));
      for (let i = 1; i <= 12; i++) {
        acknowledgeNews(g.state);
        g.act({ type: 'convene' }, T0 + i * 1000);
        if (g.state.pendingChoice) return g;
      }
      return null;
    }
    const g = [1, 2, 3, 4, 5, 6, 7, 8].map(untilChoice).find(Boolean)!;
    expect(g).toBeTruthy();
    const now = T0 + 20_000;
    const { host, overlay } = mount(g);
    overlay.update(g.state, now);
    expect(host.querySelector('[data-choice]')).not.toBeNull();
    const c = pendingChoices(g.state)[0];
    g.choose(c.id, now);
    overlay.update(g.state, now);
    expect(host.querySelector('[data-news-ok]')).not.toBeNull();
    expect(host.querySelectorAll('.news-card')).toHaveLength(1);
    expect(overlay.element()!.classList.contains('settled')).toBe(true);
  });
});

describe('a dismissed founding card stays dismissed', () => {
  function dismissed() {
    const g = new Game(createInitialState(T0, 5));
    expect(pendingNews(g.state)!.kind).toBe('opening');
    acknowledgeNews(g.state);
    expect(g.state.seenOpening).toBe(true);
    return g;
  }

  it('across a village tick', () => {
    const g = dismissed();
    const { host, overlay } = mount(g);
    for (let s = 1; s <= 10; s++) {
      g.tick(T0 + s * config.tickMs);
      overlay.update(g.state, T0 + s * config.tickMs);
      expect(pendingNews(g.state)).toBeNull();
      expect(host.querySelector('.news-card')).toBeNull();
    }
  });

  it('across a reload', () => {
    const g = dismissed();
    const back = deserialise(serialise(g.state));
    expect(back.seenOpening).toBe(true);
    const g2 = new Game(back);
    g2.tick(T0 + 5_000); // what main.ts does on load
    expect(pendingNews(g2.state)).toBeNull();
  });

  it('across a catch-up: a week of the village clock run on load raises nothing, least of all the founding', () => {
    const g = dismissed();
    const g2 = new Game(deserialise(serialise(g.state)));
    const woodBefore = g2.state.resources.wood;
    g2.tick(T0 + 7 * 24 * H);
    expect(g2.state.resources.wood).toBeGreaterThan(woodBefore); // the catch-up happened
    expect(g2.state.round).toBe(0); // and it was the village's alone
    expect(pendingNews(g2.state)).toBeNull();
    g2.tick(T0 + 7 * 24 * H + config.tickMs);
    expect(pendingNews(g2.state)).toBeNull();
    expect(g2.state.seenOpening).toBe(true);
  });

  it('a line written later at round 0 raises a report, not the founding card', () => {
    const g = dismissed();
    g.dispatchEnvoy('chatti', 'warn_of_raid', T0 + 1000);
    const news = pendingNews(g.state);
    expect(news?.kind).not.toBe('opening');
  });
});
