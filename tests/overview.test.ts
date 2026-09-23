// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { building, buildings, config, layout, RESOURCE_IDS, type ResourceId } from '../src/data';
import { checkBuild, completeFinished, openedByForumTier, startBuild, slotById } from '../src/village/construction';
import { netPerHour, productionPerHour, slotProductionPerHour, postBonus, yieldMultiplier } from '../src/village/economy';
import { site } from '../src/map/world';
import { playerFamily } from '../src/politics/characters';
import { bindPanel, durationText, remainingText, renderPanel, type PanelHandlers } from '../src/render/panel';
import { effectNowNext, forumOpensWords, ledgerFor, lockWords, renderLanes, renderOverview } from '../src/render/overview';
import type { GameState } from '../src/state/types';

const PLENTY = { wood: 9999, clay: 9999, iron: 9999, grain: 9999, denarii: 9999 };
const rich = (s: GameState) => { s.resources = { ...PLENTY }; return s; };
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** A living member of the player's house, to hold a post. */
function playerMan(s: GameState): string {
  return playerFamily(s).memberIds.find((id) => s.characters[id].alive && s.characters[id].sex === 'm')!;
}

/** Every handler a no-op, so a test can override only the one it is watching. */
function noHandlers(): PanelHandlers {
  return {
    onTab: () => {}, onChoice: () => {}, onScout: () => {}, onBuild: () => {}, onRush: () => {},
    onSelectSlot: () => {}, onAdoptNewMan: () => {}, onPolitical: () => {}, onEnvoy: () => {}, onTrade: () => {},
    onResearch: () => {}, onRushResearch: () => {}, onGuards: () => {},
    onExport: () => {}, onImport: () => {}, onReset: () => {},
    onSelectHex: () => {}, onDismissAdvisor: () => {},
  };
}

describe('a build time stated before you commit (DESIGN §3.1, amended)', () => {
  it('never prints seconds, and shares its rounding with the time left on a job', () => {
    expect(durationText(30)).toBe('less than a minute');
    expect(durationText(100)).toBe('about 2 minutes');
    expect(durationText(900)).toBe('about 15 minutes');
    expect(durationText(5400)).toBe('about 1.5 hours');
    expect(durationText(7200)).toBe('about 2 hours');
    for (const b of buildings) for (const t of b.tiers) {
      const words = durationText(t.buildSeconds);
      expect(words, `${b.id} ${t.buildSeconds}s`).not.toMatch(/second/);
      expect(words).toMatch(/^(less than a minute|about \d+(\.5)? (minute|hour)s?)$/);
      expect(remainingText(t.buildSeconds * 1000)).toBe(`${words} left`);
    }
  });

  it('is on the plot card beside the cost, with the effect in words', () => {
    const g = new Game(rich(createInitialState(0, 1)));
    const html = strip(renderPanel(g, 'village', 'i1', 1));
    const wh = building('warehouse').tiers[0];
    expect(html).toContain(`Cost: ${wh.cost.wood} wood , ${wh.cost.clay} clay · ${durationText(wh.buildSeconds)}`);
    expect(html).toContain('kept per material 600');
    expect(html).not.toMatch(/warehouse capacity|production per hour|piety bonus/);
    expect(html).toContain('back to the colony');
  });
});

describe('effects in words, now → next', () => {
  it('reads absolute values from data/effects.json, not a running total', () => {
    expect(effectNowNext(building('warehouse'), 1, 2)).toBe('kept per material 600 → 2000 (+1400)');
    expect(effectNowNext(building('lumber_camp'), 0, 1)).toBe('yield 30/h');
    expect(effectNowNext(building('market'), 1, 2)).toBe('tax 15 → 35% (+20), trade rate 3 → 2.5 (−0.5)');
    expect(effectNowNext(building('library'), 1, 2)).toContain('gravitas 1 a round');
  });
});

describe('locked, and why (every failing gate)', () => {
  function forumOneWithLibraryAndABusyLane(): GameState {
    const s = rich(createInitialState(0, 1));
    startBuild(s, 'i1', 'library', 0);
    completeFinished(s, 1e9);
    startBuild(s, 'c2', 'castellum', 0);
    s.resources = { wood: 100, clay: 100, iron: 50, grain: 100, denarii: 100 };
    return s;
  }

  it('keeps ok, reason and the first-gate order, and lists the rest', () => {
    const s = forumOneWithLibraryAndABusyLane();
    const check = checkBuild(s, 'i1', 'library');
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('A building is already under construction');
    expect(check.reasons[0]).toBe(check.reason);
    expect(check.gates).toEqual(['lane', 'forum', 'resources']);
    expect(check.reasons).toEqual(['A building is already under construction', 'Needs forum tier 2', 'Not enough resources']);
    const cost = building('library').tiers[1].cost;
    expect(check.short).toEqual({ wood: cost.wood! - 100, clay: cost.clay! - 100, iron: cost.iron! - 50 });
    expect(startBuild.bind(null, s, 'i1', 'library', 0)).toThrow(check.reason);
  });

  it('reports nothing when the build is allowed', () => {
    const s = rich(createInitialState(0, 1));
    const check = checkBuild(s, 'i1', 'warehouse');
    expect(check.ok).toBe(true);
    expect(check.reasons).toEqual([]);
    expect(check.short).toEqual({});
  });

  it('says the Forum first and greyed, then the lane and the shortfall', () => {
    const s = forumOneWithLibraryAndABusyLane();
    const words = lockWords(checkBuild(s, 'i1', 'library'));
    expect(words).toContain('<span class="gate">needs Forum II</span>');
    expect(words).toMatch(/<span class="muted">lane busy · short 200 wood, 180 clay, 60 iron<\/span>/);
    expect(words.indexOf('needs Forum')).toBeLessThan(words.indexOf('lane busy'));
  });

  it('puts the same list on the plot card and on the overview row', () => {
    const g = new Game(forumOneWithLibraryAndABusyLane());
    const card = renderPanel(g, 'village', 'i1', 1);
    expect(card).toContain('data-build="i1" data-building="library" disabled');
    expect(card).toContain('needs Forum II');
    expect(card).toContain('lane busy · short');
    const row = renderPanel(g, 'village', null, 1);
    expect(row).toContain('needs Forum II');
  });
});

describe('what the next Forum tier opens (derived, never authored)', () => {
  it('matches a walk over data/buildings.json', () => {
    for (const t of [1, 2, 3]) {
      const expected: string[] = [];
      for (const b of buildings) {
        if (b.id === 'forum') continue;
        b.tiers.forEach((tier, i) => { if (tier.requiresForumTier === t) expected.push(`${b.id}:${i + 1}`); });
      }
      expect(openedByForumTier(t).map((o) => `${o.building.id}:${o.tier}`)).toEqual(expected);
    }
    expect(openedByForumTier(3).map((o) => `${o.building.id}:${o.tier}`)).toEqual(['library:3']);
    expect(openedByForumTier(9)).toEqual([]);
  });

  it('is grouped on the Forum row', () => {
    expect(forumOpensWords(2)).toBe('tier III of everything but the Library, and Library II');
    expect(forumOpensWords(3)).toBe('Library III');
    const g = new Game(rich(createInitialState(0, 1)));
    expect(strip(renderPanel(g, 'village', null, 1))).toContain('opens tier III of everything but the Library, and Library II');
  });
});

describe('production per building, and the ledger behind the header', () => {
  function workingColony(): GameState {
    const s = rich(createInitialState(0, 1));
    // A second field, a held meadow, a granary prefect and two studies.
    startBuild(s, 'o2', 'lumber_camp', 0);
    completeFinished(s, 1e9);
    s.map.claimed.push({ key: '2,1', siteId: 'meadow', garrison: 0, claimedRound: 0 });
    s.map.claimed.push({ key: '3,1', siteId: 'timber', garrison: 0, claimedRound: 0 });
    s.posts.granary = playerMan(s);
    s.research.completed.push('crop_rotation', 'charcoal_burning');
    s.corruption = 12;
    return s;
  }

  it('sums slot by slot, with held sites, to the header (multipliers included)', () => {
    const s = workingColony();
    expect(postBonus(s, 'granary')).toBeGreaterThan(0);
    const total = productionPerHour(s);
    for (const id of RESOURCE_IDS.filter((r) => r !== 'denarii')) {
      let sum = 0;
      for (const slot of s.slots) sum += building(slot.building ?? 'forum').produces === id ? slotProductionPerHour(s, slot) : 0;
      // Held sites take the same multiplier the fields do.
      for (const c of s.map.claimed) sum += (site(c.siteId).produces?.[id] ?? 0) * yieldMultiplier(s, id);
      expect(sum, id).toBeCloseTo(total[id], 9);
    }
  });

  it('asks what a plot would yield at the next tier, and the open plot at tier I', () => {
    const s = workingColony();
    const farm = slotById(s, 'o7');
    const mult = 1 + postBonus(s, 'granary') + 0.12;
    expect(slotProductionPerHour(s, farm)).toBeCloseTo(35 * mult, 9);
    expect(slotProductionPerHour(s, farm, 2)).toBeCloseTo(90 * mult, 9);
    const open = slotById(s, 'o6');
    expect(open.building).toBeNull();
    expect(slotProductionPerHour(s, open)).toBe(0);
    expect(slotProductionPerHour(s, open, 1, 'farm')).toBeCloseTo(35 * mult, 9);
  });

  it('adds up to netPerHour for every resource, corruption and the floor included', () => {
    const s = workingColony();
    const net = netPerHour(s);
    for (const id of RESOURCE_IDS) {
      const lines = ledgerFor(s, id);
      expect(lines.reduce((a, l) => a + l.value, 0), id).toBeCloseTo(net[id], 9);
    }
    const grain = ledgerFor(s, 'grain').map((l) => l.label);
    expect(grain).toContain('Farm I');
    expect(grain).toContain('River meadow, held');
    expect(grain.some((l) => l.startsWith('Prefect of the granary — ') && l.includes('craft'))).toBe(true);
    expect(grain).toContain('research: +12%');
    expect(grain).toContain(`upkeep: ${Math.floor(s.population)} heads × ${config.population.grainUpkeepPerHeadPerHour}`);
    const den = ledgerFor(s, 'denarii').map((l) => l.label);
    expect(den).toContain(`tax: ${Math.floor(s.population)} heads × ${config.population.taxPerHeadPerHour}`);
    expect(den).toContain(`corruption: 12 × ${config.corruption.denariiDrainPerPointPerHour}`);
    // Ruinous corruption over a thin tax take: the treasury floors at nothing, and the ledger says so.
    s.corruption = config.corruption.max;
    s.population = 1;
    expect(netPerHour(s).denarii).toBe(0);
    const floored = ledgerFor(s, 'denarii');
    expect(floored.reduce((a, l) => a + l.value, 0)).toBeCloseTo(0, 9);
    expect(floored.at(-1)!.label).toMatch(/nothing/);
  });

  it('shows obstruction with its sign', () => {
    const s = workingColony();
    s.obstructed.grain = s.round + 3;
    expect(postBonus(s, 'granary')).toBe(-config.leverage.obstructPenalty);
    const line = ledgerFor(s, 'grain').find((l) => l.label.startsWith('Prefect of the granary'))!;
    expect(line.label).toContain('obstructs');
    expect(line.label).toContain('−25%');
    expect(line.value).toBeLessThan(0);
    expect(ledgerFor(s, 'grain').reduce((a, l) => a + l.value, 0)).toBeCloseTo(netPerHour(s).grain, 9);
  });

  it('renders one ledger per resource', () => {
    const html = renderOverview(workingColony(), 1);
    for (const id of RESOURCE_IDS) expect(html).toContain(`data-ledger="${id}"`);
  });
});

describe('the two lanes (DESIGN §4.4: one building, one field, no queue)', () => {
  it('shows the job in each lane, or that it is free', () => {
    const s = rich(createInitialState(0, 1));
    const c = startBuild(s, 'c2', 'castellum', 0);
    const html = renderLanes(s, 60_000);
    expect(html).toContain('data-lane="building"');
    expect(html).toContain('data-lane="field"');
    expect(html).toMatch(/class="card lane busy" data-lane="building"/);
    expect(html).toMatch(/class="card lane free" data-lane="field"/);
    expect(html).toContain(`Castellum I, ${remainingText(c.finishAt - 60_000)}`);
    expect(html).toContain('data-rush="c2"');
    expect(html).toContain('Finish now');
    expect(html).not.toMatch(/queue/i);
  });

  it('routes the lane\'s Finish now to onRush', () => {
    const s = rich(createInitialState(0, 1));
    startBuild(s, 'o2', 'lumber_camp', 0);
    const panel = document.createElement('div');
    const rushed: string[] = [];
    bindPanel(panel, { ...noHandlers(), onRush: (id) => rushed.push(id) });
    panel.innerHTML = renderPanel(new Game(s), 'village', null, 1);
    panel.querySelector<HTMLButtonElement>('.lanes [data-rush="o2"]')!.click();
    expect(rushed).toEqual(['o2']);
  });
});

describe('the colony overview', () => {
  it('lists every slot that carries a building, grouped centre, inner, outer, then the perimeter', () => {
    const s = rich(createInitialState(0, 1));
    startBuild(s, 'i3', 'temple', 0);
    completeFinished(s, 1e9);
    const html = renderOverview(s, 1);
    for (const slot of s.slots.filter((x) => x.building)) expect(html, slot.id).toContain(`data-slot="${slot.id}"`);
    for (const slot of s.slots.filter((x) => !x.building)) expect(html, slot.id).not.toContain(`data-slot="${slot.id}"`);
    const at = (t: string) => html.indexOf(t);
    expect(at('The centre')).toBeLessThan(at('The inner ring'));
    expect(at('The inner ring')).toBeLessThan(at('The outer ring'));
    expect(at('The outer ring')).toBeLessThan(at('The perimeter'));
    expect(at('data-slot="w1"')).toBeGreaterThan(at('The perimeter'));
    expect(html).toContain('data-select-slot="w1"');
    expect(html).toContain('not yet raised');
  });

  it('gives each row its tier, next effect, cost, time and an Upgrade button', () => {
    const s = rich(createInitialState(0, 1));
    const html = renderPanel(new Game(s), 'village', null, 1);
    const lumber = building('lumber_camp').tiers[1];
    expect(html).toContain('data-build="o1" data-building="lumber_camp"');
    expect(strip(html)).toContain(`30 wood/h now → 80/h at II (+50) ${lumber.cost.wood} wood , ${lumber.cost.clay} clay , ${lumber.cost.iron} iron ${durationText(lumber.buildSeconds)} Upgrade`);
    expect(strip(html)).toContain('Forum I II: gravitas 1 → 2 a round (+1)');
  });

  it('marks a job under way with its time left and the rush button, and a top tier as at its height', () => {
    const s = rich(createInitialState(0, 1));
    const c = startBuild(s, 'o1', 'lumber_camp', 0);
    slotById(s, 'c1').tier = 3;
    const html = renderOverview(s, 1000);
    expect(html).toContain(`tier II under way — ${remainingText(c.finishAt - 1000)}`);
    expect(html).toMatch(/data-slot="o1">[\s\S]*?data-rush="o1"/);
    expect(strip(html)).toContain('Forum III at its height');
    expect(html).not.toContain('data-build="c1"');
  });

  it('lists the inner buildings not yet placed as exactly the complement, and the open plots by site', () => {
    const s = rich(createInitialState(0, 1));
    startBuild(s, 'i3', 'temple', 0);
    completeFinished(s, 1e9);
    const html = renderOverview(s, 1);
    const placed = new Set(s.slots.map((x) => x.building));
    for (const b of buildings.filter((x) => x.ring === 'inner')) {
      expect(html.includes(`data-unplaced="${b.id}"`), b.id).toBe(!placed.has(b.id));
    }
    // No build button on these rows; a link selects the first open plot instead.
    const openInner = s.slots.find((x) => x.ring === 'inner' && !x.building)!;
    expect(html).toMatch(new RegExp(`data-unplaced="warehouse">[\\s\\S]*?data-select-slot="${openInner.id}">choose a plot`));
    expect(html).not.toMatch(/data-unplaced="warehouse">[\s\S]*?data-build=/);
    expect(strip(html)).toContain('farmland ×2: Farm I +35 grain/h');
    expect(strip(html)).toContain('iron seam ×1: Iron mine I +18 iron/h');
    const firstFarmland = layout.slots.find((x) => x.site === 'farmland' && !s.slots.find((y) => y.id === x.id)!.building)!;
    expect(html).toMatch(new RegExp(`farmland ×2[\\s\\S]*?data-select-slot="${firstFarmland.id}"`));
    // o1 is built and o2 is not: one forest plot stays open.
    expect(strip(html)).toContain('forest ×1: Lumber camp I +30 wood/h');
  });

  it('is what the Village panel opens on, and the plot card leads back to it', () => {
    const g = new Game(rich(createInitialState(0, 1)));
    expect(renderPanel(g, 'village', null, 1)).toContain('In the colony');
    expect(renderPanel(g, 'village', null, 1)).not.toContain('data-overview');
    const card = renderPanel(g, 'village', 'o1', 1);
    expect(card).not.toContain('In the colony');
    expect(card).toContain('data-overview');
    const panel = document.createElement('div');
    const picked: string[] = [];
    const built: string[] = [];
    bindPanel(panel, { ...noHandlers(), onSelectSlot: (id) => picked.push(id), onBuild: (slot, b) => built.push(`${slot}:${b}`) });
    panel.innerHTML = card;
    panel.querySelector<HTMLButtonElement>('[data-overview]')!.click();
    expect(picked, 'no slot selected is the overview').toEqual(['']);
    panel.innerHTML = renderPanel(g, 'village', null, 1);
    panel.querySelector<HTMLButtonElement>('[data-build="o1"]')!.click();
    expect(built).toEqual(['o1:lumber_camp']);
    panel.querySelector<HTMLButtonElement>('[data-unplaced="warehouse"] [data-select-slot]')!.click();
    expect(picked.at(-1)).toBe('i1');
  });
});

describe("Rome's request marked on the row it asks for", () => {
  function asking(s: GameState, buildingId: string, tier: number): GameState {
    s.rome.activeRequest = {
      id: 'r_test', title: 'Raise it', text: '', kind: 'build', build: { building: buildingId, tier },
      reward: { denarii: 80, scrolls: 1 }, delivered: {}, fulfilled: false, issuedRound: 0,
    };
    s.rome.activeRequestId = 'r_test';
    return s;
  }

  it('lifts an unplaced building Rome wants to the top, worded with the reward', () => {
    const s = asking(rich(createInitialState(0, 1)), 'waystation', 1);
    const html = renderOverview(s, 1);
    expect(html).toContain('data-rome-asks="waystation"');
    expect(html).toContain('Rome asks for this — 80 denarii, 1 scroll');
    const unplaced = [...html.matchAll(/data-unplaced="([a-z_]+)"/g)].map((m) => m[1]);
    expect(unplaced[0]).toBe('waystation');
    expect(html.match(/data-rome-asks=/g)).toHaveLength(1);
  });

  it('marks a standing building on its row, and clears once the tier stands or Rome has marked it fulfilled', () => {
    const s = asking(rich(createInitialState(0, 1)), 'castellum', 2);
    expect(renderOverview(s, 1)).toMatch(/data-slot="c2">[\s\S]*?data-rome-asks="castellum"/);
    // Raised before Rome's turn has run: the ask is answered, so the row no longer carries it.
    slotById(s, 'c2').tier = 2;
    expect(s.rome.activeRequest!.fulfilled).toBe(false);
    expect(renderOverview(s, 1)).not.toContain('data-rome-asks');
    slotById(s, 'c2').tier = 1;
    s.rome.activeRequest!.fulfilled = true;
    expect(renderOverview(s, 1)).not.toContain('data-rome-asks');
  });

  it('marks nothing for a request that is not a build', () => {
    const s = asking(rich(createInitialState(0, 1)), 'castellum', 2);
    s.rome.activeRequest!.kind = 'deliver';
    expect(renderOverview(s, 1)).not.toContain('data-rome-asks');
  });
});

/** The overview reads its yields through the same resource ids the header prints. */
it('names resources the way the header does', () => {
  const s = rich(createInitialState(0, 1));
  const html = renderOverview(s, 1);
  for (const id of ['wood', 'clay', 'grain'] as ResourceId[]) expect(html).toContain(`${id}/h`);
});

describe('a plot rising from nothing', () => {
  it('shows no tier and no zero yield on its row while tier I is under way', () => {
    const g = new Game(createInitialState(0, 5));
    g.build('o5', 'iron_mine', 1000);
    const html = renderPanel(g, 'village', null, 1000, null);
    const row = html.match(/<li data-slot="o5">[\s\S]*?<\/li>/)![0];
    expect(row).toContain('tier I under way');
    expect(row).not.toContain('<b></b>');
    expect(row).not.toContain('0 iron/h');
    // once it stands, the tier and the yield come back
    g.tick(1000 + 60 * 60 * 1000);
    const later = renderPanel(g, 'village', null, 1000 + 60 * 60 * 1000, null).match(/<li data-slot="o5">[\s\S]*?<\/li>/)![0];
    expect(later).toContain('<b>I</b>');
    expect(later).toMatch(/\d+ iron\/h/);
  });
});
