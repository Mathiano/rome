// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createGround, createWall, wallDepthAt, wallLight } from '../src/render/environment';
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

  it('encloses every plot inside the wall, and stands the wall itself on it', () => {
    const env = createGround(VIEW);
    // The wall is an isometric circle, so on screen it is an axis-aligned
    // ellipse; every plot centre must sit inside it or the town has a building
    // standing in the fields.
    const RX = Math.SQRT2 * (layout.tile.w / 2) * 6.15;
    const RY = Math.SQRT2 * (layout.tile.h / 2) * 6.15;
    const reach = (s: { x: number; y: number }) => {
      const { sx, sy } = project(s.x, s.y);
      return (sx * sx) / (RX * RX) + (sy * sy) / (RY * RY);
    };
    for (const s of layout.slots.filter((s) => s.ring !== 'perimeter')) {
      expect(reach(s), `${s.id} is outside the wall`).toBeLessThan(1);
    }
    // The wall's own slot is the exception: it is not a plot in a ring, it is
    // the gate, and so it sits on the ring itself (DESIGN §4.4, §4.5).
    const perimeter = layout.slots.filter((s) => s.ring === 'perimeter');
    expect(perimeter).toHaveLength(1);
    expect(reach(perimeter[0]), 'the wall stands on its own circuit').toBeCloseTo(1, 1);
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

describe('the wall is its own building, and it sorts with the others', () => {
  it('rises through its tiers, from a bank to a crenellated circuit', () => {
    const towers = (t: number) => createWall(t).filter((p) => p.g.classList.contains('tower')).length;
    expect(towers(0), 'no wall raised, no towers').toBe(0);
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
    const plotDepths = layout.slots.filter((s) => s.ring !== 'perimeter').map((s) => s.x + s.y);
    // the ring reaches past the plots at both ends, or it could never occlude
    expect(Math.min(...depths)).toBeLessThan(Math.min(...plotDepths));
    expect(Math.max(...depths)).toBeGreaterThan(Math.max(...plotDepths));
    // and the gate is the nearest piece of the circuit
    expect(Math.max(...depths)).toBeCloseTo(wallDepthAt(Math.PI / 2) + 0.01, 5);
    // The wall's own slot is nearer still, by a whisker: it carries the hit
    // area the player clicks, and that has to paint over the gate it belongs to.
    const w1 = layout.slots.find((s) => s.ring === 'perimeter')!;
    expect(w1.x + w1.y).toBeGreaterThan(Math.max(...depths));
    expect(w1.x + w1.y - Math.max(...depths)).toBeLessThan(0.1);
  });

  it('paints wall pieces in depth order with the plots', () => {
    const view = createVillageView(() => {});
    const state = createInitialState(0, 4);
    state.slots.find((s) => s.id === 'w1')!.tier = 3;
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

  it('rebuilds the circuit when the wall tier moves, and not for the castellum', () => {
    const view = createVillageView(() => {});
    const state = createInitialState(0, 4);
    const w1 = state.slots.find((s) => s.id === 'w1')!;
    expect(w1.building, 'the perimeter slot is pinned to the wall').toBe('wall');
    w1.tier = 1;
    view.update(state, 0, null);
    const before = view.root.querySelectorAll('.tower').length;
    view.update(state, 1000, null);
    expect(view.root.querySelectorAll('.tower').length, 'no churn on an unchanged tier').toBe(before);
    // the castellum is a separate building now: raising it leaves the circuit alone
    const c2 = state.slots.find((s) => s.id === 'c2')!;
    c2.building = 'castellum'; c2.tier = 3;
    view.update(state, 1500, null);
    expect(view.root.querySelectorAll('.tower').length, 'the castellum is not the wall').toBe(before);
    w1.tier = 3;
    view.update(state, 2000, null);
    expect(view.root.querySelectorAll('.tower').length).toBeGreaterThan(before);
  });
});

describe('the wall is lit from the top left', () => {
  it('puts the north-west of the ring in light and the south-east in shade', () => {
    // screen angle: 0 = east, π/2 = south (nearest), π = west, 3π/2 = north
    const NW = (5 * Math.PI) / 4;
    const SE = Math.PI / 4;
    expect(wallLight(NW)).toBeGreaterThan(0.9);
    expect(wallLight(SE)).toBeLessThan(-0.9);
    // and the two halves are opposites, as a ring lit from one side must be
    for (let t = 0; t < Math.PI * 2; t += 0.3) {
      expect(wallLight(t) + wallLight(t + Math.PI)).toBeCloseTo(0, 6);
    }
    expect(Math.abs(wallLight(0))).toBeLessThanOrEqual(1);
  });

  it('shades each arc rather than painting one flat band', () => {
    const segs = createWall(3).filter((p) => p.g.classList.contains('wall-seg'));
    const faces = segs.map((p) => {
      const paths = p.g.querySelectorAll('path');
      return paths[2].getAttribute('stroke');
    });
    // a ribbon has one colour; a drum has many
    expect(new Set(faces).size).toBeGreaterThan(8);
  });

  it('courses the stone at II and III, and posts the palisade at I', () => {
    const dashed = (t: number) => createWall(t)
      .filter((p) => p.g.classList.contains('wall-seg'))
      .some((p) => Array.from(p.g.querySelectorAll('path')).some((n) => (n.getAttribute('stroke-dasharray') ?? '').startsWith('9 7')));
    expect(dashed(1), 'a palisade has no stone courses').toBe(false);
    expect(dashed(2)).toBe(true);
    expect(dashed(3)).toBe(true);
    const posts = (t: number) => createWall(t)
      .filter((p) => p.g.classList.contains('wall-seg'))
      .reduce((n, p) => n + p.g.querySelectorAll('line').length, 0);
    expect(posts(1), 'the palisade is posts').toBeGreaterThan(50);
    expect(posts(2), 'stone is not').toBe(0);
  });

  it('flies the standard over the gate only on a finished circuit', () => {
    for (const t of [0, 1, 2]) {
      expect(createWall(t).some((p) => p.g.querySelector('.gate-banner')), `tier ${t}`).toBe(false);
    }
    const banner = createWall(3).find((p) => p.g.querySelector('.gate-banner'))!;
    expect(banner).toBeTruthy();
    // it must use the same cloth the sprite overlays wave, not a second one
    const mast = banner.g.querySelector('.gate-banner')!;
    expect(mast.classList.contains('anim-flag')).toBe(true);
    expect(mast.querySelector('.cloth')).not.toBeNull();
    // and it rides on the gate, which is the nearest piece of the ring
    expect(banner.depth).toBeCloseTo(wallDepthAt(Math.PI / 2) + 0.01, 5);
  });
});
