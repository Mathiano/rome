// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createEnvironment } from '../src/render/environment';
import { createVillageView, project } from '../src/render/village';
import { createInitialState } from '../src/state/store';
import { layout } from '../src/data';

const VIEW = { x: -330, y: -190, w: 660, h: 360 };

describe('the colony environment (DESIGN §10)', () => {
  it('draws the wall, its towers, the gate and the country around them', () => {
    const env = createEnvironment(VIEW);
    for (const cls of ['wall', 'towers', 'gate', 'roads', 'wood', 'fields', 'rocks', 'river']) {
      expect(env.querySelector('.' + cls), cls).not.toBeNull();
    }
    expect(env.querySelectorAll('.towers > g').length).toBeGreaterThanOrEqual(6);
    // a wood is trees standing close, not one dark blob
    expect(env.querySelectorAll('.wood > g').length).toBeGreaterThan(40);
  });

  it('encloses every plot inside the wall', () => {
    const env = createEnvironment(VIEW);
    // The wall is an isometric circle, so on screen it is an axis-aligned
    // ellipse; every plot centre must sit inside it or the town has a building
    // standing in the fields.
    const RX = Math.SQRT2 * (layout.tile.w / 2) * 6.15;
    const RY = Math.SQRT2 * (layout.tile.h / 2) * 6.15;
    for (const s of layout.slots) {
      const { sx, sy } = project(s.x, s.y);
      const d = (sx * sx) / (RX * RX) + (sy * sy) / (RY * RY);
      expect(d, `${s.id} is outside the wall`).toBeLessThan(1);
    }
    expect(env).toBeTruthy();
  });

  it('stays inside the frame it is given', () => {
    const env = createEnvironment(VIEW);
    const ground = env.querySelector('rect')!;
    expect(Number(ground.getAttribute('width'))).toBe(VIEW.w);
    expect(Number(ground.getAttribute('height'))).toBe(VIEW.h);
    // nothing may carry a NaN coordinate: one bad number silently drops a shape
    for (const node of Array.from(env.querySelectorAll('*'))) {
      for (const attr of Array.from(node.attributes)) {
        expect(attr.value, `${node.nodeName}@${attr.name}`).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('is built once and sits behind every plot', () => {
    const view = createVillageView(() => {});
    view.update(createInitialState(0, 1), 0, null);
    const envs = view.root.querySelectorAll('.env');
    expect(envs).toHaveLength(1);
    // the first child of the world group, so every sprite paints over it
    const world = view.root.querySelector('g')!;
    expect(world.firstElementChild!.getAttribute('class')).toBe('env');
    view.update(createInitialState(0, 1), 1000, null);
    expect(view.root.querySelectorAll('.env')).toHaveLength(1);
  });
});

describe('the village answers the pointer without waiting for a tick', () => {
  it('names a plot the moment it is hovered', () => {
    const view = createVillageView(() => {});
    const state = createInitialState(0, 4);
    view.update(state, 0, null);
    const label = () => view.root.querySelector('.labels .label')!.textContent ?? '';
    expect(label()).toBe('');
    const plot = view.root.querySelector('.slot[data-slot="o1"]')! as SVGGElement;
    plot.dispatchEvent(new Event('mouseenter'));
    // no second update() call: the label must already be right
    expect(label().length).toBeGreaterThan(0);
    plot.dispatchEvent(new Event('mouseleave'));
    expect(label()).toBe('');
  });

  it('says nothing before the first update, rather than throwing', () => {
    const view = createVillageView(() => {});
    const plot = view.root.querySelector('.slot[data-slot="o1"]')! as SVGGElement;
    expect(() => plot.dispatchEvent(new Event('mouseenter'))).not.toThrow();
  });
});
