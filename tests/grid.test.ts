// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, migrate, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { building, buildings, layout, type BuildingDef } from '../src/data';
import {
  anchors, cellCount, cellsOf, enclosure, enclosureOfSize, extentOf, freeCells, inRect, occupied, placeProblem, riverbank,
} from '../src/village/grid';
import { checkPlace, completeFinished, placeBuild } from '../src/village/construction';
import { militiaPool } from '../src/combat/militia';
import { createVillageView, project, ZOOM } from '../src/render/village';
import type { GameState } from '../src/state/types';

const PLENTY = { wood: 99999, clay: 99999, iron: 99999, grain: 99999, denarii: 99999 };
const rich = (s: GameState) => { s.resources = { ...PLENTY }; return s; };
const wall = (s: GameState, t: number) => { s.slots.find((x) => x.id === 'w1')!.tier = t; };

/** Put a building down where it first fits and finish it. */
function stand(s: GameState, id: string, now = 0): string {
  const at = anchors(s, id)[0];
  const c = placeBuild(s, id, at.x, at.y, now);
  completeFinished(s, 1e12);
  return c.slotId;
}

/** A building that stands only on the riverbank, as the harbour will: data only, never shipped. */
function withHarbour<T>(fn: () => T): T {
  const harbour = {
    id: 'test_harbour', name: 'Harbour', zone: 'town', footprint: [2, 1], placement: 'riverbank', kind: 'building', role: 'test',
    tiers: [{ cost: {}, buildSeconds: 60, requiresColonyTier: 0, effects: {} }],
  } as BuildingDef;
  buildings.push(harbour);
  try { return fn(); } finally { buildings.splice(buildings.indexOf(harbour), 1); }
}

describe('the enclosure (DESIGN §4.5 C.1)', () => {
  it('is sized by the wall, grows with it, and keeps its river edge where it was', () => {
    const s = createInitialState(0, 1);
    let prev = enclosure(s);
    expect(cellCount(prev)).toBe(layout.grid.sizeByWallTier[0] ** 2);
    for (let t = 1; t <= 3; t++) {
      wall(s, t);
      const e = enclosure(s);
      expect(cellCount(e)).toBe(layout.grid.sizeByWallTier[t] ** 2);
      // every larger enclosure holds the one before it, so nothing is stranded
      for (const [x, y] of [[prev.x0, prev.y0], [prev.x1, prev.y1], [prev.x0, prev.y1], [prev.x1, prev.y0]]) expect(inRect(e, x, y)).toBe(true);
      expect(e.x1, 'the river edge never moves').toBe(layout.grid.riverEdge);
      prev = e;
    }
  });

  it('counts its free cells, and the founding praetorium takes four of them', () => {
    const s = createInitialState(0, 1);
    expect(freeCells(s)).toBe(cellCount(enclosure(s)) - 4);
    expect(cellsOf(s.slots.find((x) => x.building === 'praetorium')!)).toHaveLength(4);
  });
});

describe('placing a building (DESIGN §4.4, §4.5 C.1)', () => {
  it('fits it on free cells inside the wall, by its footprint, and nowhere else', () => {
    const s = rich(createInitialState(0, 1));
    const e = enclosure(s);
    expect(extentOf(building('castellum'))).toEqual([2, 2]);
    // not outside the wall, not across its edge, not over the forum
    expect(placeProblem(s, 'warehouse', e.x0 - 1, e.y0)).toBe('Outside the wall');
    expect(placeProblem(s, 'castellum', e.x1, e.y0)).toBe('Outside the wall');
    const seat = s.slots.find((x) => x.building === 'praetorium')!;
    expect(placeProblem(s, 'warehouse', seat.x!, seat.y!)).toBe('Those cells are taken');
    // every anchor offered is a place it fits, and together they are all of them
    for (const a of anchors(s, 'castellum')) expect(placeProblem(s, 'castellum', a.x, a.y)).toBeNull();
  });

  it('takes the cells the moment work begins, and a failed placement leaves nothing behind', () => {
    const s = rich(createInitialState(0, 1));
    const before = s.slots.length;
    const at = anchors(s, 'castellum')[0];
    const c = placeBuild(s, 'castellum', at.x, at.y, 0);
    expect(s.slots).toHaveLength(before + 1);
    expect(occupied(s).has(`${at.x},${at.y}`)).toBe(true);
    expect(s.constructions.map((x) => x.slotId)).toEqual([c.slotId]);
    // the building lane is busy: a second placement is refused and adds no slot
    const w = anchors(s, 'warehouse')[0];
    expect(() => placeBuild(s, 'warehouse', w.x, w.y, 0)).toThrow('A building is already under construction');
    expect(s.slots).toHaveLength(before + 1);
  });

  it('holds a unique building to one, and lets a repeatable fill the town', () => {
    const s = rich(createInitialState(0, 1));
    stand(s, 'temple');
    expect(checkPlace(s, 'temple').gates).toEqual(['unique']);
    const room = freeCells(s);
    let n = 0;
    // costs rise per copy (§4.4), so the treasury is refilled: only room may stop it here
    while (rich(s) && checkPlace(s, 'barracks').ok) { stand(s, 'barracks'); n++; }
    // every free cell took one: only room stops a repeatable
    expect(n).toBe(room);
    expect(freeCells(s)).toBe(0);
    expect(checkPlace(s, 'barracks').gates).toEqual(['room']);
    // raising the wall makes room again
    wall(s, 1);
    expect(checkPlace(s, 'barracks').ok).toBe(true);
  });
});

describe('the riverbank, kept for a harbour (§4.5; no harbour building yet)', () => {
  it('is a strip beyond the river edge, outside the wall, as long as the town', () => {
    const s = createInitialState(0, 1);
    const e = enclosure(s);
    const bank = riverbank(s);
    expect(bank.x0).toBe(e.x1 + 1);
    expect(bank.x1 - bank.x0 + 1).toBe(layout.grid.riverbankDepth);
    expect([bank.y0, bank.y1]).toEqual([e.y0, e.y1]);
    wall(s, 3);
    expect(riverbank(s).y1 - riverbank(s).y0).toBe(enclosure(s).y1 - enclosure(s).y0);
    // no building the game ships stands on it
    expect(buildings.some((b) => b.placement === 'riverbank')).toBe(false);
  });

  it('takes a 2×1 building along the bank, and only there; nothing else goes on it', () => {
    withHarbour(() => {
      const s = rich(createInitialState(0, 1));
      const bank = riverbank(s);
      // read along the bank: one cell out from the wall, two along the river
      expect(extentOf(building('test_harbour'))).toEqual([1, 2]);
      const spots = anchors(s, 'test_harbour');
      expect(spots.length).toBe(bank.y1 - bank.y0);
      for (const a of spots) expect(inRect(bank, a.x, a.y) && inRect(bank, a.x, a.y + 1)).toBe(true);
      const e = enclosure(s);
      expect(placeProblem(s, 'test_harbour', e.x0, e.y0)).toBe('Only on the riverbank');
      // and an ordinary building may not use the bank
      expect(placeProblem(s, 'warehouse', bank.x0, bank.y0)).toBe('Outside the wall');
      const id = placeBuild(s, 'test_harbour', spots[0].x, spots[0].y, 0).slotId;
      expect(cellsOf(s.slots.find((x) => x.id === id)!)).toHaveLength(2);
    });
  });
});

describe('the barracks (2026-09-27)', () => {
  it('is a repeatable 1×1 town building, and every one adds to the militia pool', () => {
    const b = building('barracks');
    expect(b.zone).toBe('town');
    expect(b.footprint).toEqual([1, 1]);
    expect(b.unique).toBeFalsy();
    const s = rich(createInitialState(0, 1));
    const base = militiaPool(s);
    stand(s, 'barracks');
    expect(militiaPool(s)).toBe(base + b.tiers[0].effects.militiaBonus);
    stand(s, 'barracks');
    expect(militiaPool(s)).toBe(base + 2 * b.tiers[0].effects.militiaBonus);
  });
});

describe('a save from the ring layout', () => {
  /**
   * The colony as a ring-layout save held it: slots by ring, the castellum
   * pinned to c2. Written with today's building ids: under the save rule no
   * format-1 save reaches this code through `deserialise` any more (format 3
   * resets it), and the migration is kept, as Mathias ruled, and tested here
   * through `migrate` directly.
   */
  function ringSave(): string {
    const raw = JSON.parse(serialise(createInitialState(0, 1)));
    const outer = layout.sites.map((d) => ({ id: d.id, ring: 'outer', site: d.site, building: null as string | null, tier: 0 }));
    outer.find((o) => o.id === 'o1')!.building = 'lumber_camp'; outer.find((o) => o.id === 'o1')!.tier = 2;
    raw.slots = [
      { id: 'c1', ring: 'centre', building: 'praetorium', tier: 2 },
      { id: 'c2', ring: 'centre', building: 'castellum', tier: 0 },
      { id: 'i1', ring: 'inner', building: 'warehouse', tier: 1 },
      { id: 'i2', ring: 'inner', building: null, tier: 0 },
      { id: 'i3', ring: 'inner', building: 'temple', tier: 2 },
      { id: 'i4', ring: 'inner', building: 'forum', tier: 0 },
      { id: 'i8', ring: 'inner', building: 'library', tier: 1 },
      ...outer,
      { id: 'w1', ring: 'perimeter', building: 'wall', tier: 1 },
    ];
    raw.constructions = [{ slotId: 'i4', buildingId: 'forum', toTier: 1, kind: 'building', startedAt: 0, finishAt: 60_000 }];
    raw.version = 1;
    return JSON.stringify(raw);
  }

  it('sets every building down on the grid, keeps its id and tier, and loses nothing it held', () => {
    const s = migrate(JSON.parse(ringSave()));
    const town = s.slots.filter((x) => x.zone === 'town');
    expect(town.map((x) => `${x.id}:${x.building}:${x.tier}`).sort()).toEqual(['c1:praetorium:2', 'i1:warehouse:1', 'i3:temple:2', 'i4:forum:0', 'i8:library:1']);
    // the seat on its founding cells
    const start = layout.startBuilt.find((b) => 'id' in b && b.building === 'praetorium') as { x: number; y: number };
    expect(s.slots.find((x) => x.id === 'c1')).toMatchObject({ x: start.x, y: start.y });
    // nothing overlaps and everything is inside the wall
    const e = enclosure(s);
    const seen = new Set<string>();
    for (const slot of town) for (const c of cellsOf(slot)) {
      expect(inRect(e, c.x, c.y), `${slot.id} outside`).toBe(true);
      expect(seen.has(`${c.x},${c.y}`), `${slot.id} overlaps`).toBe(false);
      seen.add(`${c.x},${c.y}`);
    }
    // the forum still rising keeps its slot, so its construction still names it
    expect(s.constructions[0].slotId).toBe('i4');
    // an empty plot and a castellum nobody raised hold nothing, and are gone
    expect(s.slots.some((x) => x.id === 'i2' || x.id === 'c2')).toBe(false);
    // sites and the wall keep their tiers; nothing carries the old ring
    expect(s.slots.find((x) => x.id === 'o1')).toMatchObject({ zone: 'site', building: 'lumber_camp', tier: 2 });
    expect(s.slots.find((x) => x.id === 'w1')).toMatchObject({ zone: 'wall', building: 'wall', tier: 1 });
    expect(s.slots.every((x) => !('ring' in x))).toBe(true);
    // and it loads the same way twice
    expect(deserialise(serialise(s)).slots).toEqual(s.slots);
  });

  it('plays on after the move: the forum finishes where it was set down', () => {
    const g = new Game(migrate(JSON.parse(ringSave())));
    g.tick(61_000);
    expect(g.state.slots.find((x) => x.id === 'i4')!.tier).toBe(1);
  });
});

describe('the village view on the grid', () => {
  it('marks every place a building fits while it is being placed, and hands the click back as a cell', () => {
    const s = rich(createInitialState(0, 1));
    const placed: string[] = [];
    const view = createVillageView(() => {}, (x, y) => placed.push(`${x},${y}`));
    view.update(s, 0, null, 'castellum');
    const spots = view.root.querySelectorAll('.place-spot');
    expect(spots).toHaveLength(anchors(s, 'castellum').length);
    expect(view.root.classList.contains('placing')).toBe(true);
    (spots[0] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const a = anchors(s, 'castellum')[0];
    expect(placed).toEqual([`${a.x},${a.y}`]);
    view.update(s, 0, null, null);
    expect(view.root.querySelectorAll('.place-spot')).toHaveLength(0);
    expect(view.root.classList.contains('placing')).toBe(false);
  });

  it('draws a new building the moment it is placed, and never re-sorts on a plain tick', () => {
    const s = rich(createInitialState(0, 1));
    const view = createVillageView(() => {});
    view.update(s, 0, null);
    const id = placeBuild(s, 'granary', anchors(s, 'granary')[0].x, anchors(s, 'granary')[0].y, 0).slotId;
    view.update(s, 1, null);
    const g = view.root.querySelector(`.slot[data-slot="${id}"]`);
    expect(g).not.toBeNull();
    const order = Array.from(view.root.querySelector('.scene')!.children);
    view.update(s, 2, null);
    expect(Array.from(view.root.querySelector('.scene')!.children)).toEqual(order);
    expect(view.root.querySelector(`.slot[data-slot="${id}"]`)).toBe(g);
  });

  it('zooms by the wheel between the old frame and the whole country (§4.5 C.4)', () => {
    const view = createVillageView(() => {});
    view.update(createInitialState(0, 1), 0, null);
    const width = () => Number(view.root.getAttribute('viewBox')!.split(' ')[2]);
    const widest = width();
    expect(widest).toBeLessThanOrEqual(ZOOM.closestWidth * 3);
    for (let i = 0; i < 40; i++) view.root.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(width()).toBeCloseTo(ZOOM.closestWidth, 0);
    for (let i = 0; i < 40; i++) view.root.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));
    expect(width()).toBeCloseTo(widest, 0);
  });

  it('keeps the largest town, its bank and every site inside the widest frame', () => {
    const view = createVillageView(() => {});
    const [vx, vy, vw, vh] = view.root.getAttribute('viewBox')!.split(' ').map(Number);
    const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
    const corners: [number, number][] = [
      [big.x0, big.y0], [big.x1 + 1 + layout.grid.riverbankDepth, big.y0], [big.x0, big.y1 + 1], [big.x1 + 1 + layout.grid.riverbankDepth, big.y1 + 1],
      ...layout.sites.map((d) => [d.x + 0.5, d.y + 0.5] as [number, number]),
    ];
    for (const [x, y] of corners) {
      const { sx, sy } = project(x, y);
      expect(sx).toBeGreaterThanOrEqual(vx);
      expect(sx).toBeLessThanOrEqual(vx + vw);
      expect(sy).toBeGreaterThanOrEqual(vy);
      expect(sy).toBeLessThanOrEqual(vy + vh);
    }
  });
});
