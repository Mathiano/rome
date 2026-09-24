import type { GameState } from '../state/types';
import { pendingNews, renderNews, type News } from './panel';

/**
 * The news card over the village: the founding, a round's report, the return
 * after an absence.
 *
 * It is drawn once per piece of news and then left alone. The game renders on
 * every village tick, and the card used to be rewritten each time: the node
 * under the pointer was replaced between press and release, so Continue
 * rarely took, and the entrance animation replayed every second, so the card
 * seemed to raise itself again (Mathias, 2026-09-24). A card now changes only
 * when its news does; time-left words and the like are as of when it opened.
 */
export interface NewsOverlayHandlers {
  onChoice(choiceId: string): void;
  onTab(tab: string): void;
  onSelectHex(hex: string): void;
  onContinue(): void;
}

/** What makes one card different from another: new lines, a choice, an absence, reading it. */
export function newsKey(state: GameState, news: News): string {
  return [news.kind, news.title, news.quiet ? 'q' : '', state.logSeq, state.seenLogId, state.awayRounds,
    state.pendingChoice?.eventId ?? ''].join('|');
}

/** Continue: the news is read, an absence acknowledged, the founding seen, and the waste count restarts. */
export function acknowledgeNews(state: GameState): void {
  state.seenLogId = state.logSeq;
  state.awayRounds = 0;
  state.seenOpening = true;
  state.overflowSinceSeen = {};
}

export function createNewsOverlay(host: HTMLElement, h: NewsOverlayHandlers) {
  let el: HTMLDivElement | null = null;
  let key = '';
  function update(state: GameState, now: number): void {
    const news = pendingNews(state);
    if (!news) {
      el?.remove();
      el = null;
      key = '';
      return;
    }
    const k = newsKey(state, news);
    if (el && k === key) return; // the same news: leave the card, and the button under the pointer, alone
    if (!el) {
      el = document.createElement('div');
      el.className = 'news';
      el.addEventListener('click', (ev) => {
        const btn = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
        if (!btn || btn.disabled) return;
        if (btn.dataset.choice) return h.onChoice(btn.dataset.choice);
        // A report card's way onward (the houses, the hex to claim) moves the panel; the card stays.
        if (btn.dataset.tab) return h.onTab(btn.dataset.tab);
        if (btn.dataset.selectHex) return h.onSelectHex(btn.dataset.selectHex);
        if (btn.hasAttribute('data-news-ok')) h.onContinue();
      });
      host.appendChild(el);
    } else {
      // New news on a card already up (a choice answered, a line arrived): it
      // has arrived once, so it does not make its entrance again.
      el.classList.add('settled');
    }
    el.innerHTML = renderNews(news, state, now);
    key = k;
  }
  return { update, element: () => el };
}
