import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { lossFraction, resolveRaid, defenceStrength, raidChance } from '../src/combat/raids';
import { militiaPool } from '../src/combat/militia';
import { dispatchEnvoy, resolveEnvoy, trade } from '../src/tribes/envoys';
import { romeTurn, deliver, decline, checkCollapse } from '../src/rome/requests';
import { config, requestProgression, activeTribe } from '../src/data';
import { appoint } from '../src/politics/posts';

describe('raids', () => {
  it('loss fraction is 0 when defence holds and capped otherwise', () => {
    expect(lossFraction(10, 20)).toBe(0);
    expect(lossFraction(20, 20)).toBe(0);
    expect(lossFraction(1000, 0)).toBe(config.raid.maxLossFraction);
    expect(lossFraction(30, 20)).toBeGreaterThan(0);
  });
  it('cellars are exempt and denarii are never taken', () => {
    const s = createInitialState(0, 1);
    s.tribe.strength = 10_000;
    s.resources = { wood: 500, clay: 500, iron: 500, grain: 500, denarii: 500 };
    // give cellars tier 1 by placing one
    const cellar = s.slots.find((x) => x.id === 'i1')!;
    cellar.building = 'cellars';
    cellar.tier = 1;
    const r = resolveRaid(s);
    expect(r.fraction).toBe(config.raid.maxLossFraction);
    expect(s.resources.denarii).toBe(500);
    // 100 hidden, 400 exposed, half of exposed lost
    expect(s.resources.wood).toBe(500 - Math.floor(400 * config.raid.maxLossFraction));
  });
  it('the garrison prefect adds discipline to defence; allies never raid', () => {
    const s = createInitialState(0, 1);
    const base = defenceStrength(s);
    appoint(s, 'garrison', 'c_nephew');
    expect(defenceStrength(s)).toBe(base + s.characters.c_nephew.stats.discipline * config.raid.garrisonDisciplineWeight);
    s.tribe.allied = true;
    expect(raidChance(s)).toBe(0);
  });
  it('militia pool scales with population and castellum', () => {
    const s = createInitialState(0, 1);
    const p0 = militiaPool(s);
    s.population += 40;
    expect(militiaPool(s)).toBe(p0 + Math.floor(40 * config.population.militiaRatio));
  });
});

describe('tribe envoys', () => {
  it('an envoy is prepared now and resolves at the next round', () => {
    const g = new Game(createInitialState(0, 1));
    g.dispatchEnvoy('warn_of_raid', 1);
    const fear = g.state.tribe.fear;
    expect(g.state.tribe.pendingEnvoy).toBe('warn_of_raid');
    expect(() => g.dispatchEnvoy('offer_trade', 2)).toThrow();
    g.act({ type: 'convene' }, 3);
    expect(g.state.tribe.pendingEnvoy).toBeNull();
    // +warnFear then -decay in the same round
    expect(g.state.tribe.fear).toBeCloseTo(fear + config.tribe.warnFear - config.tribe.fearDecayPerRound);
  });
  it('tribute needs fear; trade needs a market; alliance needs trust', () => {
    const s = createInitialState(0, 1);
    s.tribe.fear = 0;
    dispatchEnvoy(s, 'demand_tribute');
    const trust = s.tribe.trust;
    resolveEnvoy(s);
    expect(s.tribe.trust).toBe(trust + config.tribe.tributeRefusalTrust);
    dispatchEnvoy(s, 'offer_trade');
    resolveEnvoy(s);
    expect(s.tribe.tradeOpen).toBe(false);
    const m = s.slots.find((x) => x.id === 'i4')!;
    m.building = 'market';
    m.tier = 1;
    dispatchEnvoy(s, 'offer_trade');
    resolveEnvoy(s);
    expect(s.tribe.tradeOpen).toBe(true);
    const def = activeTribe();
    s.resources[def.trade.wants] = 1000;
    const gives = s.resources[def.trade.gives];
    trade(s, 10);
    expect(s.resources[def.trade.gives]).toBe(gives + 10);
    s.tribe.trust = 100;
    s.tribe.fear = 0;
    dispatchEnvoy(s, 'propose_alliance');
    resolveEnvoy(s);
    expect(s.tribe.allied).toBe(true);
  });
});

describe('Rome', () => {
  it('issues the progression in order, rewards on its turn after delivery', () => {
    const s = createInitialState(0, 1);
    romeTurn(s);
    expect(s.rome.activeRequest!.id).toBe(requestProgression[0].id);
    s.resources.wood = 1000;
    deliver(s);
    expect(s.rome.activeRequest!.fulfilled).toBe(true);
    const d = s.resources.denarii;
    romeTurn(s);
    expect(s.rome.activeRequest).toBeNull();
    expect(s.rome.completedIds).toEqual([requestProgression[0].id]);
    expect(s.resources.denarii).toBeGreaterThan(d);
  });
  it('declining costs favour and loyalist regard, nothing else', () => {
    const s = createInitialState(0, 1);
    romeTurn(s);
    const fav = s.rome.favour;
    const att = s.families.cornelii.attitude;
    const res = { ...s.resources };
    decline(s);
    expect(s.rome.favour).toBe(fav + config.rome.declineFavour);
    expect(s.families.cornelii.attitude).toBe(att + config.rome.declineLoyalistAttitude);
    expect(s.resources).toEqual(res);
  });
  it('build requests are noticed once the tier stands', () => {
    const s = createInitialState(0, 1);
    romeTurn(s);
    s.resources.wood = 1000;
    deliver(s);
    romeTurn(s);
    romeTurn(s); // r02: build waystation
    expect(s.rome.activeRequest!.kind).toBe('build');
    romeTurn(s);
    expect(s.rome.activeRequest!.fulfilled).toBe(false);
    const w = s.slots.find((x) => x.id === 'i5')!;
    w.building = 'waystation';
    w.tier = 1;
    romeTurn(s);
    expect(s.rome.completedIds).toHaveLength(2);
  });
  it('collapse triggers administration, never a loss', () => {
    const s = createInitialState(0, 1);
    s.corruption = 100;
    s.rome.scrolls = 3;
    expect(checkCollapse(s)).toBe(true);
    expect(s.corruption).toBe(0);
    expect(s.rome.scrolls).toBe(3);
    expect(s.rome.administeringUntilRound).toBe(config.collapse.administrationRounds);
    expect(checkCollapse(s)).toBe(false);
  });
});
