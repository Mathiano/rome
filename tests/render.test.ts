// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { renderHeader, renderPanel, type Tab } from '../src/render/panel';
import { createVillageView, project } from '../src/render/village';
import { sprite, spriteCount, spriteManifest } from '../src/render/sprites';
import { layout } from '../src/data';

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
