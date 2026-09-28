// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createGround, createTownFloor, createWall, gateAt, wallLight } from '../src/render/environment';
import { createVillageView } from '../src/render/village';
import { createInitialState } from '../src/state/store';
import { layout } from '../src/data';
import { enclosure, enclosureOfSize, inRect, riverbank } from '../src/village/grid';
import { plot } from './helpers';

const VIEW = { x: -900, y: -500, w: 1800, h: 1000 };
const E0 = enclosureOfSize(layout.grid.sizeByWallTier[0]);

describe('the colony environment (DESIGN §4.5, §10)', () => {
  it('lays the country under everything: the painting and the river', () => {
    const env = createGround(VIEW);
    const map = env.querySelector('image.base-map');
    expect(map).not.toBeNull();
    // behind everything but the letterbox flood
    expect(env.firstElementChild!.tagName.toLowerCase()).toBe('rect');
    expect(env.children[1]).toBe(map);
    expect(env.querySelector('.river')).not.toBeNull();
  });

  it('never emits a coordinate the renderer will silently drop', () => {
    const nodes = [createGround(VIEW), createTownFloor(E0, riverbank(createInitialState(0, 1))), ...createWall(3, E0).map((p) => p.g)];
    for (const root of nodes) {
      for (const node of [root, ...Array.from(root.querySelectorAll('*'))] as Element[]) {
        for (const attr of Array.from(node.attributes) as Attr[]) {
          expect(attr.value, `${node.nodeName}@${attr.name}`).not.toMatch(/NaN|undefined/);
        }
      }
    }
  });

  it('draws the floor of the enclosure with a line between every cell, and the bank beyond it', () => {
    const s = createInitialState(0, 1);
    const e = enclosure(s);
    const floor = createTownFloor(e, riverbank(s));
    const n = e.x1 - e.x0 + 1;
    // (n − 1) lines each way inside the wall, and the bank's own divisions
    expect(floor.querySelectorAll('.cell-lines line')).toHaveLength(2 * (n - 1) + (e.y1 - e.y0));
    expect(floor.querySelector('.floor')).not.toBeNull();
    expect(floor.querySelector('.riverbank')).not.toBeNull();
  });

  it('keeps every resource site outside the largest wall, off the bank, and apart (§4.5 C.2)', () => {
    const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
    const bank = { x0: big.x1 + 1, x1: big.x1 + layout.grid.riverbankDepth, y0: big.y0 - 1, y1: big.y1 + 1 };
    const seen = new Set<string>();
    for (const s of layout.sites) {
      expect(inRect({ x0: big.x0 - 1, x1: big.x1 + 1, y0: big.y0 - 1, y1: big.y1 + 1 }, s.x, s.y), `${s.id} stands against the wall`).toBe(false);
      expect(inRect(bank, s.x, s.y), `${s.id} is on the riverbank`).toBe(false);
      // the river starts beyond the bank's depth; past the bank's ends that column is dry land
      expect(s.x, `${s.id} is in the river`).toBeLessThanOrEqual(big.x1 + layout.grid.riverbankDepth);
      const k = `${s.x},${s.y}`;
      expect(seen.has(k), `${s.id} shares a cell`).toBe(false);
      seen.add(k);
    }
  });

  it('is built once and sits behind every plot', () => {
    const view = createVillageView(() => {});
    view.update(createInitialState(0, 1), 0, null);
    expect(view.root.querySelectorAll('.env')).toHaveLength(1);
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
    const site = view.root.querySelector('.slot[data-slot="wood1"]')! as SVGGElement;
    site.dispatchEvent(new Event('mouseenter'));
    // no second update() call: the label must already be right
    expect(label().length).toBeGreaterThan(0);
    site.dispatchEvent(new Event('mouseleave'));
    expect(label()).toBe('');
  });

  it('draws nothing to hover before the first update, rather than throwing', () => {
    const view = createVillageView(() => {});
    expect(view.root.querySelector('.slot')).toBeNull();
  });
});

describe('the wall is its own building, and it sorts with the others', () => {
  it('rises through its tiers, from a bank to a crenellated circuit', () => {
    const towers = (t: number) => createWall(t, E0).filter((p) => p.g.classList.contains('tower')).length;
    expect(towers(0), 'no wall raised, no towers').toBe(0);
    expect(towers(1)).toBeGreaterThan(0);
    expect(towers(2)).toBeGreaterThan(towers(1));
    expect(towers(3)).toBeGreaterThan(towers(2));
    const merloned = (t: number) => createWall(t, E0).some((p) => p.g.innerHTML.includes('stroke-dasharray="7 7"'));
    expect(merloned(2)).toBe(false);
    expect(merloned(3)).toBe(true);
    expect(() => createWall(9, E0)).not.toThrow();
    expect(() => createWall(-1, E0)).not.toThrow();
  });

  it('runs on the grid lines round the enclosure, one piece per cell of edge, the gate taking one', () => {
    const e = E0;
    const segs = createWall(0, e).filter((p) => p.g.classList.contains('wall-seg'));
    const perimeter = 2 * (e.x1 - e.x0 + 1) + 2 * (e.y1 - e.y0 + 1);
    expect(segs).toHaveLength(perimeter - 1);
    expect(createWall(0, e).filter((p) => p.g.classList.contains('gate'))).toHaveLength(1);
    // the gate is on the south-west edge, the one the road comes in by
    expect(gateAt(e).y).toBe(e.y1 + 1);
  });

  it('puts the far edges behind the cells beside them and the near edges in front', () => {
    const e = E0;
    const pieces = createWall(3, e);
    const edge = (name: string) => pieces.filter((p) => p.g.getAttribute('data-edge') === name).map((p) => p.depth);
    // a building's depth is its centre, x + y; the cells along each edge
    for (let x = e.x0; x <= e.x1; x++) {
      const inside = x + 0.5 + e.y0 + 0.5;
      expect(Math.min(...edge('north-east').filter((d) => Math.abs(d - (x + 0.5 + e.y0)) < 1e-9))).toBeLessThan(inside);
    }
    for (let y = e.y0; y <= e.y1; y++) {
      const inside = e.x1 + 0.5 + y + 0.5;
      expect(edge('south-east').find((d) => Math.abs(d - (e.x1 + 1 + y + 0.5)) < 1e-9)!).toBeGreaterThan(inside);
    }
    expect(Math.max(...edge('north-west'))).toBeLessThan(Math.max(...edge('south-west')));
  });

  it('paints wall pieces in depth order with the buildings', () => {
    const view = createVillageView(() => {});
    const state = createInitialState(0, 4);
    state.slots.find((s) => s.id === 'w1')!.tier = 3;
    view.update(state, 0, null);
    const scene = view.root.querySelector('.scene')!;
    const kids = Array.from(scene.children);
    const index = (sel: (k: Element) => boolean) => kids.findIndex(sel);
    const forum = index((k) => k.getAttribute('data-slot') === 'c1');
    const gate = index((k) => k.classList.contains('gate'));
    const farthest = index((k) => k.getAttribute('data-edge') === 'north-east');
    expect(forum).toBeGreaterThan(-1);
    expect(farthest, 'the far wall is painted before the praetorium').toBeLessThan(forum);
    expect(gate, 'the gate is painted over the praetorium').toBeGreaterThan(forum);
    // and the order is exactly the depth order
    const depthOf = (k: Element) => Number(k.getAttribute('data-depth'));
    const depths = kids.map(depthOf);
    expect(depths.every((d) => Number.isFinite(d))).toBe(true);
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeGreaterThanOrEqual(depths[i - 1]);
  });

  it('rebuilds the circuit when the wall tier moves, and not for the castellum; the town grows and nothing moves', () => {
    const view = createVillageView(() => {});
    const state = createInitialState(0, 4);
    const w1 = state.slots.find((s) => s.id === 'w1')!;
    expect(w1.building, 'the wall slot is the wall').toBe('wall');
    w1.tier = 1;
    view.update(state, 0, null);
    const before = view.root.querySelectorAll('.tower').length;
    const floorBefore = view.root.querySelector('.town-floor .floor')!.getAttribute('points');
    view.update(state, 1000, null);
    expect(view.root.querySelectorAll('.tower').length, 'no churn on an unchanged tier').toBe(before);
    // the castellum is a separate building: raising it leaves the circuit alone
    const c2 = plot(state, 'castellum');
    state.slots.find((s) => s.id === c2)!.tier = 3;
    view.update(state, 1500, null);
    expect(view.root.querySelectorAll('.tower').length, 'the castellum is not the wall').toBe(before);
    const forumAt = view.root.querySelector('.slot[data-slot="c1"]')!.getAttribute('transform');
    w1.tier = 3;
    view.update(state, 2000, null);
    expect(view.root.querySelectorAll('.tower').length).toBeGreaterThan(before);
    expect(view.root.querySelector('.town-floor .floor')!.getAttribute('points'), 'the enclosure grew').not.toBe(floorBefore);
    expect(view.root.querySelector('.slot[data-slot="c1"]')!.getAttribute('transform'), 'the praetorium stays where it stood').toBe(forumAt);
  });
});

describe('the wall is lit from the top left', () => {
  it('lights the faces that look down and to the left, and shades the ones that look right', () => {
    expect(wallLight('north-east')).toBeGreaterThan(0);
    expect(wallLight('south-west')).toBeGreaterThan(0);
    expect(wallLight('north-west')).toBeLessThan(0);
    expect(wallLight('south-east')).toBeLessThan(0);
    const faces = new Set(createWall(3, E0).filter((p) => p.g.classList.contains('wall-seg'))
      .map((p) => p.g.querySelector('polygon')!.getAttribute('fill')));
    // two facings, two tones: a flat band of one colour is what made the old ring a ribbon
    expect(faces.size).toBe(2);
  });

  it('courses the stone at II and III, and posts the palisade at I', () => {
    const segs = (t: number) => createWall(t, E0).filter((p) => p.g.classList.contains('wall-seg'));
    const coursed = (t: number) => segs(t).some((p) => Array.from(p.g.querySelectorAll('line')).some((n) => (n.getAttribute('stroke-dasharray') ?? '') === '9 7'));
    expect(coursed(1), 'a palisade has no stone courses').toBe(false);
    expect(coursed(2)).toBe(true);
    expect(coursed(3)).toBe(true);
    const posts = (t: number) => segs(t).reduce((n, p) => n + Array.from(p.g.querySelectorAll('line')).filter((l) => !l.getAttribute('stroke-dasharray') && l.getAttribute('stroke-width') === '1.4').length, 0);
    expect(posts(1), 'the palisade is posts').toBeGreaterThan(50);
    expect(posts(2), 'stone is not').toBe(0);
  });

  it('flies the standard over the gate only on a finished circuit', () => {
    for (const t of [0, 1, 2]) expect(createWall(t, E0).some((p) => p.g.querySelector('.gate-banner')), `tier ${t}`).toBe(false);
    const banner = createWall(3, E0).find((p) => p.g.querySelector('.gate-banner'))!;
    expect(banner.g.classList.contains('gate')).toBe(true);
    const mast = banner.g.querySelector('.gate-banner')!;
    expect(mast.classList.contains('anim-flag')).toBe(true);
    expect(mast.querySelector('.cloth')).not.toBeNull();
  });
});
