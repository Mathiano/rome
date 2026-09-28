// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { renderHeader, renderPanel, tabBadge, type Tab } from '../src/render/panel';
import { createVillageView, project } from '../src/render/village';
import { sprite, spriteCount, spriteManifest } from '../src/render/sprites';
import { config, layout, researchNodes } from '../src/data';
import { renderSummary, cellsUsed, sitesSeen } from '../src/render/summary';
import { mapConfig, site } from '../src/map/world';
import { nearestUnknown, claimSite } from '../src/map/sites';
import { playerHoldsOffice } from '../src/politics/challenge';
import { defenceStrength } from '../src/combat/raids';
import { n } from '../src/render/overview';

describe('render', () => {
  it('projects the grid isometrically, one sprite plate to a cell', () => {
    const w = layout.tile.w * layout.cellTiles;
    const h = layout.tile.h * layout.cellTiles;
    expect(project(0, 0)).toEqual({ sx: 0, sy: 0 });
    expect(project(1, 0)).toEqual({ sx: w / 2, sy: h / 2 });
    expect(project(0, 1)).toEqual({ sx: -w / 2, sy: h / 2 });
    // a cell is exactly as wide as a sprite's ground plate (CLAUDE.md, Sprites)
    expect(w).toBe(spriteManifest.tileWidth);
  });
  it('places a sprite from the manifest by its anchor and ignores unknown ones', () => {
    const m = { tileWidth: 64, ppu: 4, sprites: { 'lumber-camp-t1': { file: 'lumber-camp-t1.png', width: 400, height: 300, ax: 200, ay: 220, ppu: 4, plateWidth: 64 } } };
    const urls = { '../../assets/buildings/lumber-camp-t1.png': '/x/lumber-camp-t1.png' };
    const p = sprite('lumber_camp', 1, m, urls)!;
    expect(p).toMatchObject({ url: '/x/lumber-camp-t1.png', x: -50, y: -55, width: 100, height: 75, ax: 50, ay: 55 });
    expect(sprite('forum', 1, m, urls)).toBeNull();
    expect(spriteCount()).toBe(Object.keys(spriteManifest.sprites).length);
  });
  it('renders every tab and the header without throwing', () => {
    const g = new Game(createInitialState(0, 1));
    g.act({ type: 'convene' }, 1);
    expect(renderHeader(g.state)).toContain('Round 1');
    for (const t of ['village', 'council', 'family', 'tribe', 'rome', 'log', 'save'] as Tab[]) {
      expect(renderPanel(g, t, 'o2', 2).length).toBeGreaterThan(50);
    }
  });
  it('renders a slot group per slot the colony has and an <image> only where art exists', () => {
    const g = new Game(createInitialState(0, 1));
    const view = createVillageView(() => {});
    view.update(g.state, 0, null);
    expect(view.root.querySelectorAll('.slot')).toHaveLength(g.state.slots.length);
    // The painted country is an <image> as well, and is not anchored on a plate.
    const images = [...view.root.querySelectorAll('image')].filter((i) => !i.classList.contains('base-map'));
    for (const img of images) {
      const ax = Number(img.getAttribute('data-ax'));
      const ay = Number(img.getAttribute('data-ay'));
      expect(Number(img.getAttribute('x'))).toBeCloseTo(-ax, 6);
      expect(Number(img.getAttribute('y'))).toBeCloseTo(-ay, 6);
    }
    const built = g.state.slots.filter((s) => s.building && s.tier > 0 && spriteManifest.sprites[`${s.building.replace(/_/g, '-')}-t${s.tier}`]);
    expect(images).toHaveLength(built.length);
  });
});

describe('the Reports tab (reports unit)', () => {
  it('the bar reads Reports on the log tab, nine tabs, and the tab renders with no clock in it', () => {
    const g = new Game(createInitialState(0, 1));
    g.act({ type: 'convene' }, 7_654_321);
    const html = renderPanel(g, 'log', null, 7_654_322);
    const nav = html.match(/<nav>(.*?)<\/nav>/)![1];
    expect(nav).toMatch(/data-tab="log"[^>]*>Reports/);
    expect(nav).not.toContain('>Log<');
    expect(nav.match(/<button/g)).toHaveLength(9);
    expect(html).toContain('<h2>Reports</h2>');
    expect(html).toContain('data-menu="round-1"');
    expect(html).not.toMatch(/\d{1,2}:\d{2}/);
    expect(html).not.toContain(String(g.state.lastReport!.at));
  });
});

/** The colony at a glance (DESIGN §1, §4.4, §4.5, Pillar 6). Counts, never a score. */
describe('the colony at a glance', () => {
  const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('the header names the wall, the cells built on and the holdings; the wall is not counted', () => {
    const g = new Game(createInitialState(0, 1));
    const head = renderHeader(g.state);
    // the praetorium stands on 2×2 of the ditch-and-bank's 6×6 (DESIGN §4.5 C.1)
    const size = (t: number) => layout.grid.sizeByWallTier[t] ** 2;
    expect(head).toContain(`Praetorium I · no wall · 4 of ${size(0)} cells built on · no holdings`);
    expect(cellsUsed(g.state)).toEqual({ used: 4, total: size(0) });
    g.state.slots.find((s) => s.id === 'w1')!.tier = 2;
    expect(renderHeader(g.state)).toContain(`Wall II · 4 of ${size(2)} cells built on`);
  });

  it('a fresh colony reads as it stands, and carries no summed tier and no clock', () => {
    const g = new Game(createInitialState(0, 1));
    const html = renderPanel(g, 'village', null, 1);
    const card = strip(html.slice(html.indexOf('data-summary'), html.indexOf('One building and one field')));
    expect(html.indexOf('data-summary'), 'under the Due block, above the lanes').toBeGreaterThan(html.indexOf('data-menu="due"'));
    expect(html.indexOf('data-summary')).toBeLessThan(html.indexOf('<div class="lanes">'));
    expect(card).toContain('Praetorium I');
    expect(card).toContain('none raised');
    expect(card).toContain(`4 of ${layout.grid.sizeByWallTier[0] ** 2} cells built on, inside the ditch and bank`);
    expect(card).toContain(`Population ${config.population.start} → ${config.population.start} of`);
    expect(card).toContain(`0 of ${mapConfig.siteCount} sites seen`);
    expect(card).toContain(`0 of ${researchNodes.length} studies known`);
    expect(card).toContain('Aurelii 0 (yours)');
    expect(card).toContain('Cornelii 0');
    expect(card).toContain('favour 20 · 0 requests completed');
    expect(card).toMatch(/Walls [\d.]+ against the \w+'s [\d.]+ · \d+ of \d+ men at home/);
    expect(card).not.toMatch(/\d+ of \d+ tiers/);
    expect(card).not.toMatch(/\d{1,2}:\d{2}/);
    expect(card).not.toMatch(/growth stalled/);
    expect(html).not.toContain('<svg');
  });

  it('says growth has stalled without grain, and never says starving (Pillar 6)', () => {
    const g = new Game(createInitialState(0, 1));
    g.state.resources.grain = 0;
    const card = renderSummary(g.state);
    expect(card).toContain('growth stalled, no grain');
    expect(card).not.toMatch(/starv/i);
  });

  it('counts the wall, holdings with their yield, and sites seen', () => {
    const g = new Game(createInitialState(0, 1));
    const s = g.state;
    s.slots.find((x) => x.id === 'w1')!.tier = 1;
    s.resources.denarii = 9999;
    // scout marks until one that can be held is found, then hold it
    for (let i = 0; i < 40 && !s.map.claimed.length; i++) {
      const k = nearestUnknown(s)!;
      s.map.scouted.push(k);
      try { claimSite(s, k); } catch { /* hostile or empty: move on */ }
    }
    expect(playerHoldsOffice(s)).toBe(true);
    expect(s.map.claimed.length).toBe(1);
    expect(sitesSeen(s)).toBe(s.map.scouted.length);
    // a scouted hex with nothing on it is not a site seen
    s.map.scouted.push('1,0');
    expect(sitesSeen(s)).toBe(s.map.scouted.length - 1);
    const card = renderSummary(s);
    expect(card).toContain('inside a wall of tier I');
    const def = site(s.map.claimed[0].siteId);
    if (def.produces && Object.keys(def.produces).length) expect(card).toMatch(/Holdings<\/span><span>1, yielding [\d.]+ \w+\/h/);
    else expect(card).toContain('Holdings</span><span>1</span>');
    expect(renderHeader(s)).toContain('Wall I');
    expect(renderHeader(s)).toContain('1 holding');
  });

  it('the walls row prints the live defence figure, with the Library and an obstruction folded in', () => {
    const g = new Game(createInitialState(0, 1));
    const s = g.state;
    s.round = 6;
    const withDefence = researchNodes.find((r) => r.effects['defence'])!;
    s.research.completed.push(withDefence.id);
    s.obstructed['defence'] = s.round + 2;
    const plain = renderSummary(s).match(/Walls<\/span><span>([\d.]+) against/)![1];
    expect(plain).toBe(n(defenceStrength(s)));
    s.research.completed.pop();
    expect(renderSummary(s).match(/Walls<\/span><span>([\d.]+) against/)![1]).toBe(n(defenceStrength(s)));
  });
});

/** A mark on a tab that is asking for an answer: a duty, never a spend. */
describe('tab badges', () => {
  const TABS: Tab[] = ['village', 'map', 'library', 'council', 'family', 'tribe', 'rome', 'log', 'save'];
  const lit = (s: Parameters<typeof tabBadge>[0]) => TABS.filter((t) => tabBadge(s, t));
  /** A settled colony with the counsel put away, so only duties can light a tab. */
  function quiet() {
    const g = new Game(createInitialState(0, 1));
    g.state.advisorDismissed = true;
    g.state.round = 6;
    // the founding card read, and Rome's founding letter answered
    g.state.seenLogId = g.state.logSeq;
    g.state.rome.activeRequest = null;
    g.state.rome.activeRequestId = null;
    return g.state;
  }

  it("a fresh colony lights the counsel's tab, Rome's founding letter, and its unread report", () => {
    const g = new Game(createInitialState(0, 1));
    expect(lit(g.state)).toEqual(['village', 'rome', 'log']);
    g.state.seenLogId = g.state.logSeq; // the founding card read
    expect(lit(g.state)).toEqual(['village', 'rome']);
    g.state.advisorDismissed = true;
    expect(lit(g.state)).toEqual(['rome']);
  });

  it('a demand, a house talking of leaving, or a house ready to return lights Houses', () => {
    const s = quiet();
    s.families.cornelii.demand = { kind: 'denarii', denarii: 40, issuedRound: s.round, dueRound: s.round + 2 };
    expect(lit(s)).toEqual(['family']);
    s.families.cornelii.demand = null;
    s.families.valerii.sourRounds = 1;
    expect(lit(s)).toEqual(['family']);
    s.families.valerii.sourRounds = 0;
    s.families.claudii.departedRound = s.round - config.secession.maxAwayRounds;
    expect(lit(s)).toEqual(['family']);
    s.families.claudii.departedRound = s.round - 1;
    s.families.claudii.attitude = -100;
    expect(lit(s), 'away but not yet due home').toEqual([]);
  });

  it('a tribe massing lights Tribe', () => {
    const s = quiet();
    Object.values(s.tribes)[0].massingForRound = s.round;
    expect(lit(s)).toEqual(['tribe']);
    Object.values(s.tribes)[0].massingForRound = s.round - 1;
    expect(lit(s)).toEqual([]);
  });

  it('a vote before the council lights Council; being out of office alone does not', () => {
    const s = quiet();
    s.office = Object.values(s.characters).find((c) => !s.families[c.familyId].isPlayer)!.id;
    expect(playerHoldsOffice(s)).toBe(false);
    expect(lit(s)).toEqual([]);
    s.challenge = { callerFamilyId: 'claudii', calledRound: s.round, voteRound: s.round + 1, candidates: {} };
    expect(lit(s)).toEqual(['council']);
  });

  it("Rome's letter lights Rome until it is answered", () => {
    const s = quiet();
    s.rome.activeRequest = { id: 'r', title: 't', text: '', kind: 'deliver', reward: {}, delivered: {}, fulfilled: false, issuedRound: s.round };
    expect(lit(s)).toEqual(['rome']);
    s.rome.activeRequest.fulfilled = true;
    expect(lit(s)).toEqual([]);
    // and the nav carries the mark
    s.rome.activeRequest.fulfilled = false;
    const nav = renderPanel(new Game(s), 'village', null, 1);
    expect(nav).toContain('data-tab="rome" class="">Rome<span class="badge">!</span>');
    expect(nav).not.toContain('Tribe<span class="badge">');
  });
});
