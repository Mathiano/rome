// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createGround, createWall, wallDepthAt } from '../src/render/environment';
import { createVillageView, project } from '../src/render/village';
import { createInitialState } from '../src/state/store';
import { layout } from '../src/data';

const VIEW = { x: -330, y: -190, w: 660, h: 360 };

describe('the colony environment (DESIGN §10)', () => {
  it('draws the wall, its towers, the gate and the roads over painted country', () => {
    const env = createGround(VIEW);
    expect(env.querySelector('.roads')).not.toBeNull();
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
    const env = createGround(VIEW);
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
    const env = createGround(VIEW);
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
    const env = createGround(VIEW);
    // nothing may carry a NaN coordinate: one bad number silently drops a shape
    for (const node of Array.from(env.querySelectorAll('*')) as Element[]) {
      for (const attr of Array.from(node.attributes) as Attr[]) {
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

describe('the wall is the castellum, and it sorts with the buildings', () => {
  it('rises through its tiers, from a bank to a crenellated circuit', () => {
    const towers = (t: number) => createWall(t).filter((p) => p.g.classList.contains('tower')).length;
    expect(towers(0), 'no castellum, no towers').toBe(0);
    expect(towers(1)).toBeGreaterThan(0);
    expect(towers(2)).toBeGreaterThan(towers(1));
    expect(towers(3)).toBeGreaterThan(towers(2));
    // only the finished circuit is crenellated
    const merloned = (t: number) => createWall(t).some((p) => p.g.innerHTML.includes('stroke-dasharray="7 7"'));
    expect(merloned(2)).toBe(false);
    expect(merloned(3)).toBe(true);
    // and a tier beyond the data does not throw
    expect(() => createWall(9)).not.toThrow();
    expect(() => createWall(-1)).not.toThrow();
  });

  it('spans the plots in depth, so some of it is in front and some behind', () => {
    const depths = createWall(3).map((p) => p.depth);
    const plotDepths = layout.slots.map((s) => s.x + s.y);
    // the ring reaches past the plots at both ends, or it could never occlude
    expect(Math.min(...depths)).toBeLessThan(Math.min(...plotDepths));
    expect(Math.max(...depths)).toBeGreaterThan(Math.max(...plotDepths));
    // and the gate is the nearest thing of all
    expect(Math.max(...depths)).toBeCloseTo(wallDepthAt(Math.PI / 2) + 0.01, 5);
  });

  it('paints wall pieces in depth order with the plots', () => {
    const view = createVillageView(() => {});
    const state = createInitialState(0, 4);
    const c2 = state.slots.find((s) => s.id === 'c2')!;
    c2.building = 'castellum'; c2.tier = 3;
    view.update(state, 0, null);
    const world = view.root.querySelector('g')!;
    const kids = Array.from(world.children);
    const nearGate = kids.findIndex((k) => k.classList.contains('gate'));
    // o1 sits at the far north (depth -7); the gate is the nearest point of
    // the ring, so the plot must be painted first and the gate over it.
    const farPlot = kids.findIndex((k) => k.getAttribute('data-slot') === 'o1');
    const nearPlot = kids.findIndex((k) => k.getAttribute('data-slot') === 'o6');
    expect(farPlot).toBeGreaterThan(-1);
    expect(nearGate).toBeGreaterThan(farPlot);
    expect(nearGate).toBeGreaterThan(nearPlot);
    // at least one wall segment is behind the northernmost plot
    const firstSeg = kids.findIndex((k) => k.classList.contains('wall-seg'));
    expect(firstSeg).toBeLessThan(farPlot);
  });

  it('rebuilds the wall only when the castellum tier moves', () => {
    const view = createVillageView(() => {});
    const state = createInitialState(0, 4);
    const c2 = state.slots.find((s) => s.id === 'c2')!;
    c2.building = 'castellum'; c2.tier = 1;
    view.update(state, 0, null);
    const before = view.root.querySelectorAll('.tower').length;
    view.update(state, 1000, null);
    expect(view.root.querySelectorAll('.tower').length, 'no churn on an unchanged tier').toBe(before);
    c2.tier = 3;
    view.update(state, 2000, null);
    expect(view.root.querySelectorAll('.tower').length).toBeGreaterThan(before);
  });
});
