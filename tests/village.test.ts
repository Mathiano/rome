// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { accrue, denariiIncomePerHour, netPerHour } from '../src/village/economy';
import { capacity, populationCap } from '../src/village/storage';
import { checkBuild, startBuild, rushPrice, rush, completeFinished, eligibleBuildings, slotById } from '../src/village/construction';
import { tick } from '../src/village/clock';
import { building, config } from '../src/data';
import { defenceStrength } from '../src/combat/raids';
import { Game } from '../src/game';
import { bindPanel, remainingText, renderPanel, type PanelHandlers } from '../src/render/panel';
import { createVillageView } from '../src/render/village';

const H = 3_600_000;

describe('economy', () => {
  it('accrues linearly and caps at storage (Pillar: Travian storage)', () => {
    const s = createInitialState(0, 1);
    const cap = capacity(s, 'wood');
    accrue(s, 1000 * H);
    expect(s.resources.wood).toBe(cap);
    expect(s.resources.clay).toBe(capacity(s, 'clay'));
    expect(s.resources.grain).toBeLessThanOrEqual(capacity(s, 'grain'));
  });
  it('treasury is uncapped', () => {
    const s = createInitialState(0, 1);
    expect(capacity(s, 'denarii')).toBe(Infinity);
    const before = s.resources.denarii;
    const income = denariiIncomePerHour(s);
    accrue(s, 10 * H);
    expect(s.resources.denarii).toBeCloseTo(before + income * 10, 3);
  });
  it('population grows toward the cap and never exceeds it', () => {
    const s = createInitialState(0, 1);
    accrue(s, 100 * H);
    expect(s.population).toBe(populationCap(s));
  });
  it('grain net accounts for upkeep', () => {
    const s = createInitialState(0, 1);
    const net = netPerHour(s);
    expect(net.grain).toBeCloseTo(building('farm').tiers[0].effects.productionPerHour - s.population * config.population.grainUpkeepPerHeadPerHour, 6);
  });
});

describe('construction', () => {
  it('starts, charges cost and completes at finishAt', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 1000, clay: 1000, iron: 1000, grain: 1000, denarii: 1000 };
    const check = checkBuild(s, 'i1', 'warehouse');
    expect(check.ok).toBe(true);
    const c = startBuild(s, 'i1', 'warehouse', 0);
    expect(s.resources.wood).toBe(1000 - check.cost.wood!);
    expect(completeFinished(s, c.finishAt - 1)).toHaveLength(0);
    expect(completeFinished(s, c.finishAt)).toHaveLength(1);
    expect(s.slots.find((x) => x.id === 'i1')!.tier).toBe(1);
  });
  it('allows one building and one field concurrently, no more (DESIGN §4.4)', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    startBuild(s, 'i1', 'warehouse', 0);
    expect(checkBuild(s, 'i2', 'granary').ok).toBe(false);
    expect(checkBuild(s, 'o2', 'lumber_camp').ok).toBe(true);
    startBuild(s, 'o2', 'lumber_camp', 0);
    expect(checkBuild(s, 'o4', 'clay_works').ok).toBe(false);
  });
  it('rejects a building on the wrong site and duplicates of inner buildings', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    expect(checkBuild(s, 'o2', 'farm').ok).toBe(false);
    startBuild(s, 'i1', 'warehouse', 0);
    completeFinished(s, 1e9);
    expect(checkBuild(s, 'i2', 'warehouse').ok).toBe(false);
  });
  it('gates tiers on the forum tier', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    startBuild(s, 'i1', 'warehouse', 0);
    completeFinished(s, 1e9);
    startBuild(s, 'i1', 'warehouse', 0);
    completeFinished(s, 1e9);
    expect(checkBuild(s, 'i1', 'warehouse').reason).toMatch(/forum tier 2/);
  });
  it('rush price never exceeds what the colony earns in the remaining time (Pillar 3)', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
    const c = startBuild(s, 'i1', 'insulae', 0);
    for (const now of [0, c.finishAt / 3, c.finishAt - 1000]) {
      const remainingHours = (c.finishAt - now) / H;
      const earns = denariiIncomePerHour(s) * remainingHours;
      expect(rushPrice(s, c, now)).toBeLessThanOrEqual(Math.max(config.rush.minPrice, Math.ceil(earns)));
    }
    const price = rushPrice(s, c, 0);
    rush(s, 'i1', 0);
    expect(s.resources.denarii).toBe(9999 - price);
    expect(s.slots.find((x) => x.id === 'i1')!.tier).toBe(1);
  });
});

describe('clock', () => {
  it('handles a long offline gap with a construction boundary inside it', () => {
    const s = createInitialState(0, 1);
    s.resources = { wood: 500, clay: 500, iron: 500, grain: 500, denarii: 500 };
    const c = startBuild(s, 'o2', 'lumber_camp', 0);
    const woodBefore = s.resources.wood;
    tick(s, c.finishAt + H);
    // one hour at the new (higher) rate after completion, plus the pre-completion accrual
    const t1 = building('lumber_camp').tiers[0].effects.productionPerHour;
    const expected = woodBefore + t1 * (c.finishAt / H) + 2 * t1 * 1;
    expect(s.resources.wood).toBeCloseTo(Math.min(expected, capacity(s, 'wood')), 3);
    expect(s.constructions).toHaveLength(0);
  });
  it('never moves the clock backwards into a penalty', () => {
    const s = createInitialState(1000, 1);
    tick(s, 500);
    expect(s.lastTick).toBe(500);
  });
  it('runs idle rounds after the calendar floor, capped', () => {
    const s = createInitialState(0, 1);
    const floor = config.calendarFloorHours * H;
    tick(s, floor - 1);
    expect(s.round).toBe(0);
    tick(s, floor);
    expect(s.round).toBe(1);
    tick(s, floor * 100);
    expect(s.round).toBe(1 + config.idleRoundsMaxCatchUp);
  });
});

describe('time left on a job (DESIGN §3.1, amended 2026-09-20)', () => {
  it('rounds to words a player can act on, and never ticks by the second', () => {
    expect(remainingText(0)).toBe('less than a minute left');
    expect(remainingText(30_000)).toBe('less than a minute left');
    expect(remainingText(60_000)).toBe('about 1 minute left');
    expect(remainingText(4 * 60_000)).toBe('about 4 minutes left');
    expect(remainingText(60 * 60_000)).toBe('about 60 minutes left');
    // past an hour and a half it reads in hours, to the nearest half
    expect(remainingText(2 * 3_600_000)).toBe('about 2 hours left');
    expect(remainingText(2.5 * 3_600_000)).toBe('about 2.5 hours left');
    expect(remainingText(3.8 * 3_600_000)).toBe('about 4 hours left');
    // a finished or overdue job never reads as negative
    expect(remainingText(-5000)).toBe('less than a minute left');
  });

  it('shows the wait on the plot card and on the plot itself', () => {
    const g = new Game(createInitialState(0, 4));
    g.build('c2', 'castellum', 1);
    const html = renderPanel(g, 'village', 'c2', 1);
    expect(html).toContain('Work in progress');
    expect(html).toMatch(/about \d+ minutes? left|less than a minute left/);
    const view = createVillageView(() => {});
    view.update(g.state, 1, 'c2');
    const label = view.root.querySelector('.labels .label')!.textContent ?? '';
    expect(label).toContain('Castellum');
    expect(label).toMatch(/left$/);
  });
});

/**
 * The wall arrived after saves already existed, and it is the first thing
 * pinned to a slot that a save can predate. A migration that forgot
 * `fixedBuilding` would have left it as an unnamed empty plot that nothing
 * could ever be built on, since only the pin makes it eligible.
 */
describe('a save older than the wall', () => {
  /** A save as it stood before the perimeter slot existed. */
  function saveWithoutTheWall(): string {
    const raw = JSON.parse(serialise(createInitialState(0, 1))) as { slots: { id: string }[] };
    raw.slots = raw.slots.filter((s) => s.id !== 'w1');
    expect(raw.slots.some((s) => s.id === 'w1')).toBe(false);
    return JSON.stringify(raw);
  }

  it('loads with the wall on its perimeter slot, not as an empty plot', () => {
    const back = deserialise(saveWithoutTheWall());
    const w1 = back.slots.find((s) => s.id === 'w1');
    expect(w1, 'the perimeter slot is added to an older save').toBeTruthy();
    expect(w1!.building, 'and it is the wall, not empty ground').toBe('wall');
    expect(w1!.ring).toBe('perimeter');
    expect(w1!.tier, 'unraised: the colony keeps its ditch and bank').toBe(0);
  });

  it('names the wall and offers it for building', () => {
    const back = deserialise(saveWithoutTheWall());
    expect(eligibleBuildings(back, slotById(back, 'w1'))).toEqual(['wall']);
    const check = checkBuild(back, 'w1', 'wall');
    expect(check.toTier).toBe(1);
    expect(check.reason ?? 'ok').not.toBe('Cannot build that here');
  });

  it('adds no defence of its own until it is raised', () => {
    const back = deserialise(saveWithoutTheWall());
    const before = defenceStrength(back);
    slotById(back, 'w1').tier = 1;
    expect(defenceStrength(back)).toBeGreaterThan(before);
  });
});

/** The wall is reachable from the panel: it stands at the gate, not on a plot. */
describe('the colony index', () => {
  it('lists every pinned building, raised or not, and selects it', () => {
    const g = new Game(createInitialState(0, 1));
    const html = renderPanel(g, 'village', null, 1);
    for (const id of ['forum', 'castellum', 'wall']) {
      expect(html, id).toContain(building(id).name);
    }
    expect(html, 'the wall is a button that selects its slot').toContain('data-select-slot="w1"');
    expect(html).toContain('not yet raised');
  });

  it('hands the slot id back when one is clicked', () => {
    const panel = document.createElement('div');
    const picked: string[] = [];
    bindPanel(panel, { ...noHandlers(), onSelectSlot: (id) => picked.push(id) });
    panel.innerHTML = renderPanel(new Game(createInitialState(0, 1)), 'village', null, 1);
    panel.querySelector<HTMLButtonElement>('[data-select-slot="w1"]')!.click();
    expect(picked).toEqual(['w1']);
  });
});

/** Every handler a no-op, so a test can override only the one it is watching. */
function noHandlers(): PanelHandlers {
  return {
    onTab: () => {}, onChoice: () => {}, onScout: () => {}, onBuild: () => {}, onRush: () => {},
    onSelectSlot: () => {}, onAdoptNewMan: () => {}, onPolitical: () => {}, onEnvoy: () => {}, onTrade: () => {},
    onResearch: () => {}, onRushResearch: () => {}, onGuards: () => {},
    onExport: () => {}, onImport: () => {}, onReset: () => {},
  };
}
