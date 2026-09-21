// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createEnvironment } from '../src/render/environment';
import { createVillageView, project } from '../src/render/village';
import { createInitialState } from '../src/state/store';
import { layout } from '../src/data';

const VIEW = { x: -330, y: -190, w: 660, h: 360 };

describe('the colony environment (DESIGN §10)', () => {
  it('draws the wall, its towers, the gate and the roads over painted country', () => {
    const env = createEnvironment(VIEW);
    for (const cls of ['wall', 'towers', 'gate', 'roads']) {
      expect(env.querySelector('.' + cls), cls).not.toBeNull();
    }
    expect(env.querySelectorAll('.towers > g').length).toBeGreaterThanOrEqual(6);
    // The country is one painted image now; the grass, river, wood, fields and
    // rocks that used to be drawn are in it.
    const map = env.querySelector('image.base-map');
    expect(map).not.toBeNull();
    for (const cls of ['wood', 'fields', 'rocks', 'river']) {
      expect(env.querySelector('.' + cls), `${cls} should be painted, not drawn`).toBeNull();
    }
    // it must sit behind everything but the letterbox flood
    expect(env.firstElementChild!.tagName.toLowerCase()).toBe('rect');
    expect(env.children[1]).toBe(map);
  });

  it('lands the painting so the wall sits on its clearing', () => {
    const env = createEnvironment(VIEW);
    const map = env.querySelector('image.base-map')!;
    const x = Number(map.getAttribute('x'));
    const y = Number(map.getAttribute('y'));
    const w = Number(map.getAttribute('width'));
    const h = Number(map.getAttribute('height'));
    // The clearing's centre must land on the world origin, where the wall is
    // centred — within a viewBox unit.
    expect(x + w * 0.470).toBeCloseTo(0, 0);
    expect(y + h * 0.525).toBeCloseTo(0, 0);
    // and the clearing's half-height must equal the wall's
    const RY = Math.SQRT2 * (layout.tile.h / 2) * 6.15;
    expect(h * 0.325).toBeCloseTo(RY, 0);
    // the painting is larger than the frame, so the country is cropped, not tiled
    expect(w).toBeGreaterThan(VIEW.w);
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

  it('never emits a coordinate the renderer will silently drop', () => {
    const env = createEnvironment(VIEW);
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
