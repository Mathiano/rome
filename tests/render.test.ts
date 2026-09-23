// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { renderHeader, renderPanel, type Tab } from '../src/render/panel';
import { createVillageView, project } from '../src/render/village';
import { sprite, spriteCount, spriteManifest } from '../src/render/sprites';
import { config, layout, researchNodes } from '../src/data';
import { renderSummary, plotsRaised, sitesSeen } from '../src/render/summary';
import { mapConfig, site } from '../src/map/world';
import { nearestUnknown, claimSite } from '../src/map/sites';
import { playerHoldsOffice } from '../src/politics/challenge';

describe('render', () => {
  it('projects the grid isometrically', () => {
    expect(project(0, 0)).toEqual({ sx: 0, sy: 0 });
    expect(project(1, 0)).toEqual({ sx: layout.tile.w / 2, sy: layout.tile.h / 2 });
    expect(project(0, 1)).toEqual({ sx: -layout.tile.w / 2, sy: layout.tile.h / 2 });
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
      expect(renderPanel(g, t, 'i1', 2).length).toBeGreaterThan(50);
    }
  });
  it('renders a slot group per layout slot and an <image> only where art exists', () => {
    const g = new Game(createInitialState(0, 1));
    const view = createVillageView(() => {});
    view.update(g.state, 0, null);
    expect(view.root.querySelectorAll('.slot')).toHaveLength(layout.slots.length);
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

/** The colony at a glance (DESIGN §1, §4.4, §4.5, Pillar 6). Counts, never a score. */
describe('the colony at a glance', () => {
  const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('the header names the wall, the plots and the holdings; the wall is not a plot', () => {
    const g = new Game(createInitialState(0, 1));
    const head = renderHeader(g.state);
    expect(head).toContain('Forum I · no wall · 4 of 18 plots raised · no holdings');
    expect(plotsRaised(g.state)).toEqual({ raised: 4, total: layout.slots.filter((s) => s.ring !== 'perimeter').length });
    g.state.slots.find((s) => s.id === 'w1')!.tier = 2;
    expect(renderHeader(g.state)).toContain('Wall II · 4 of 18 plots raised');
  });

  it('a fresh colony reads as it stands, and carries no summed tier and no clock', () => {
    const g = new Game(createInitialState(0, 1));
    const html = renderPanel(g, 'village', null, 1);
    const card = strip(html.slice(html.indexOf('data-summary'), html.indexOf('One building and one field')));
    expect(html.indexOf('data-summary'), 'under the Due block, above the lanes').toBeGreaterThan(html.indexOf('data-menu="due"'));
    expect(html.indexOf('data-summary')).toBeLessThan(html.indexOf('<div class="lanes">'));
    expect(card).toContain('Forum I');
    expect(card).toContain('none raised');
    expect(card).toContain('4 of 18 raised');
    expect(card).not.toContain('and the wall');
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
    const card = renderSummary(s);
    expect(card).toContain('and the wall');
    const def = site(s.map.claimed[0].siteId);
    if (def.produces && Object.keys(def.produces).length) expect(card).toMatch(/Holdings<\/span><span>1, yielding [\d.]+ \w+\/h/);
    else expect(card).toContain('Holdings</span><span>1</span>');
    expect(renderHeader(s)).toContain('Wall I');
    expect(renderHeader(s)).toContain('1 holding');
  });
});
