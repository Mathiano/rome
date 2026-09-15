// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { renderHeader, renderPanel, type Tab } from '../src/render/panel';
import { createVillageView, project } from '../src/render/village';
import { sprite, spriteCount } from '../src/render/sprites';
import { layout } from '../src/data';

describe('render', () => {
  it('projects the grid isometrically', () => {
    expect(project(0, 0)).toEqual({ sx: 0, sy: 0 });
    expect(project(1, 0)).toEqual({ sx: layout.tile.w / 2, sy: layout.tile.h / 2 });
    expect(project(0, 1)).toEqual({ sx: -layout.tile.w / 2, sy: layout.tile.h / 2 });
  });
  it('inlines every sprite with its anchor', () => {
    expect(spriteCount()).toBe(39);
    const s = sprite('forum', 3)!;
    expect(s.ax).toBe(32);
    expect(s.ay).toBe(48);
    expect(s.inner).toContain('@keyframes');
    expect(s.inner).not.toContain('<svg');
  });
  it('renders every tab and the header without throwing', () => {
    const g = new Game(createInitialState(0, 1));
    g.act({ type: 'convene' }, 1);
    expect(renderHeader(g.state)).toContain('Round 1');
    for (const t of ['village', 'council', 'family', 'tribe', 'rome', 'log', 'save'] as Tab[]) {
      expect(renderPanel(g, t, 'i1', 2).length).toBeGreaterThan(50);
    }
  });
  it('places the anchor of each built slot on its tile', () => {
    const g = new Game(createInitialState(0, 1));
    const view = createVillageView(() => {});
    view.update(g.state, 0, null);
    const forum = view.root.querySelector('[data-slot="c1"] .sprite')!;
    expect(forum.getAttribute('transform')).toBe('translate(-32,-48)');
    expect(forum.innerHTML).toContain('<polygon');
    expect(view.root.querySelectorAll('.slot')).toHaveLength(layout.slots.length);
  });
});
