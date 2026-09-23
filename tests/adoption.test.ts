// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { config } from '../src/data';
import type { GameState } from '../src/state/types';
import {
  adoptFromHouse, adoptNewMan, adoptedName, adoptionCandidates, houseConsent, maybeAdopt, newManCost,
} from '../src/politics/adoption';
import { kill, leaderOf, livingMembers, playerFamily, standing } from '../src/politics/characters';
import { appoint, holderOf } from '../src/politics/posts';
import { tally, candidates } from '../src/politics/challenge';
import { bindPanel, renderPanel, type PanelHandlers } from '../src/render/panel';
import type { Political } from '../src/game';

const rich = (s: GameState) => { s.resources.denarii = 5000; };
/** Give the player's head of house the standing the moves ask for. */
function elevate(s: GameState, gravitas = 400) {
  const l = leaderOf(s, playerFamily(s).id)!;
  l.gravitas = gravitas;
  l.gravitasStock = 200;
  return l;
}
/** A house that would give a man up. */
function warm(s: GameState, familyId = 'cornelii') {
  s.families[familyId].attitude = config.adoption.houseConsentAttitude + 20;
  return s.families[familyId];
}

describe('the Roman form of an adopted name', () => {
  it('swaps the nomen and keeps the birth nomen as a cognomen in -anus', () => {
    // Gaius Octavius, adopted by Gaius Julius Caesar, was Gaius Julius Caesar Octavianus.
    expect(adoptedName('Gaius Octavius', 'gens Julia')).toBe('Gaius Julius Octavianus');
    expect(adoptedName('Sextus Cornelius Balbus', 'gens Aurelia')).toBe('Sextus Aurelius Balbus Cornelianus');
    expect(adoptedName('Aulus Valerius Laevinus', 'gens Aurelia')).toBe('Aulus Aurelius Laevinus Valerianus');
  });
  it('does not stack: a nomen already in -anus is left alone', () => {
    expect(adoptedName('Titus Aurelius Balbus Cornelianus', 'gens Claudia')).toBe('Titus Claudius Balbus Cornelianus Aurelianus');
  });
});

describe('a new man raised into the house (DESIGN §9.2)', () => {
  it('adds a grown, living, unposted member and takes the denarii', () => {
    const s = createInitialState(0, 1);
    rich(s); elevate(s);
    const before = livingMembers(s, 'player').length;
    const purse = s.resources.denarii;
    const cost = newManCost(s);
    const c = adoptNewMan(s);
    expect(livingMembers(s, 'player').length).toBe(before + 1);
    expect(c.familyId).toBe('player');
    expect(c.alive).toBe(true);
    expect(c.isLeader).toBe(false);
    expect(c.post).toBeNull();
    expect(c.age).toBeGreaterThanOrEqual(25);
    expect(c.name).toMatch(/^\w+ Aurelius \w+$/);
    expect(s.resources.denarii).toBe(purse - cost);
    expect(s.stats.adoptions).toBe(1);
  });

  it('is priced by the size of the household, so a purse cannot simply buy the council', () => {
    const s = createInitialState(0, 1);
    rich(s); elevate(s);
    const first = newManCost(s);
    adoptNewMan(s);
    const second = newManCost(s);
    expect(second).toBeGreaterThan(first);
    // the step is the per-member share of the base, to the nearest denarius
    expect(second - first).toBe(Math.round(config.adoption.newManCost * (1 + config.adoption.newManCostPerMember * 5))
      - Math.round(config.adoption.newManCost * (1 + config.adoption.newManCostPerMember * 4)));
  });

  it('is gated on rank and on coin', () => {
    const s = createInitialState(0, 1);
    rich(s);
    const l = leaderOf(s, 'player')!;
    l.gravitas = 0;
    expect(() => adoptNewMan(s)).toThrow(/rank/);
    elevate(s);
    s.resources.denarii = newManCost(s) - 1;
    expect(() => adoptNewMan(s)).toThrow(/denarii/);
  });

  it('runs no round: it is household business, like guards (DESIGN §3.2)', () => {
    const g = new Game(createInitialState(0, 1));
    rich(g.state); elevate(g.state);
    const round = g.state.round;
    g.adoptNewMan(1);
    expect(g.state.round).toBe(round);
    expect(livingMembers(g.state, 'player').length).toBe(5);
  });

  it('counts at the next vote: a house is its living members', () => {
    const s = createInitialState(0, 5);
    rich(s); elevate(s);
    const cand = candidates(s, 'cornelii');
    const before = tally(s, { callerFamilyId: 'cornelii', calledRound: 0, voteRound: 1, candidates: cand }).p_leader;
    adoptNewMan(s);
    const after = tally(s, { callerFamilyId: 'cornelii', calledRound: 0, voteRound: 1, candidates: cand }).p_leader;
    expect(after).toBe(before + 1);
  });
});

describe('a man adopted from another house (DESIGN §9.2)', () => {
  it('moves house, takes the name, keeps his post and his marriage, and the houses warm', () => {
    const s = createInitialState(0, 1);
    rich(s); elevate(s);
    const from = warm(s);
    const ward = adoptionCandidates(s, 'cornelii')[0];
    appoint(s, 'works', ward.id);
    const born = ward.name;
    const att = from.attitude;
    from.grievances = 2;
    const theirs = livingMembers(s, 'cornelii').length;
    const mine = livingMembers(s, 'player').length;
    const theirStanding = standing(s, 'cornelii');

    adoptFromHouse(s, ward.id);

    expect(ward.familyId).toBe('player');
    expect(playerFamily(s).memberIds).toContain(ward.id);
    expect(from.memberIds).not.toContain(ward.id);
    expect(livingMembers(s, 'player').length).toBe(mine + 1);
    expect(livingMembers(s, 'cornelii').length).toBe(theirs - 1);
    expect(ward.name).toBe(adoptedName(born, 'gens Aurelia'));
    expect(ward.name).toMatch(/Cornelianus$/);
    expect(holderOf(s, 'works')?.id, 'the post goes with the man').toBe(ward.id);
    expect(ward.isLeader).toBe(false);
    expect(leaderOf(s, 'player')!.id, 'the headship does not move').toBe('p_leader');
    // his standing left with him
    expect(standing(s, 'cornelii')).toBe(theirStanding - ward.gravitas);
    expect(from.attitude).toBe(att + config.adoption.houseAttitude);
    expect(from.grievances).toBe(1);
    expect(s.stats.adoptions).toBe(1);
    expect(s.resources.denarii).toBe(5000 - config.adoption.houseCost);
  });

  it('needs the house to think well of you, and it keeps its head and its last men', () => {
    const s = createInitialState(0, 1);
    rich(s); elevate(s);
    const from = s.families.cornelii;
    from.attitude = config.adoption.houseConsentAttitude - 1;
    expect(houseConsent(s, 'cornelii').ok).toBe(false);
    const ward = adoptionCandidates(s, 'cornelii')[0];
    expect(() => adoptFromHouse(s, ward.id)).toThrow(/refuse/);

    warm(s);
    expect(houseConsent(s, 'cornelii').ok).toBe(true);
    const head = leaderOf(s, 'cornelii')!;
    expect(adoptionCandidates(s, 'cornelii').map((c) => c.id)).not.toContain(head.id);
    expect(() => adoptFromHouse(s, head.id)).toThrow(/head/);

    // thin the house down to the floor: what is left is not for sale
    for (const c of livingMembers(s, 'cornelii')) {
      if (livingMembers(s, 'cornelii').length <= config.adoption.houseMinSizeAfter) break;
      if (!c.isLeader) kill(s, c, 'test');
    }
    expect(livingMembers(s, 'cornelii').length).toBe(config.adoption.houseMinSizeAfter);
    expect(houseConsent(s, 'cornelii').ok).toBe(false);
  });

  it('is not open on your own kin, nor on a daughter of theirs', () => {
    const s = createInitialState(0, 1);
    rich(s); elevate(s); warm(s);
    expect(() => adoptFromHouse(s, 'p_son')).toThrow(/yours/);
    const daughter = livingMembers(s, 'cornelii').find((c) => c.sex === 'f')!;
    expect(adoptionCandidates(s, 'cornelii').map((c) => c.id)).not.toContain(daughter.id);
    expect(() => adoptFromHouse(s, daughter.id)).toThrow(/record/);
  });

  it('is a move that house is party to, so it runs a round', () => {
    const g = new Game(createInitialState(0, 1));
    rich(g.state); elevate(g.state); warm(g.state);
    const ward = adoptionCandidates(g.state, 'cornelii')[0];
    const round = g.state.round;
    g.act({ type: 'adopt', characterId: ward.id }, 1);
    expect(g.state.round).toBe(round + 1);
    expect(ward.familyId).toBe('player');
  });

  it('survives a save', () => {
    const s = createInitialState(0, 1);
    rich(s); elevate(s); warm(s);
    const ward = adoptionCandidates(s, 'cornelii')[0];
    adoptFromHouse(s, ward.id);
    const back = deserialise(serialise(s));
    expect(back.characters[ward.id].familyId).toBe('player');
    expect(back.families.player.memberIds).toContain(ward.id);
    expect(back.families.cornelii.memberIds).not.toContain(ward.id);
    expect(back.stats.adoptions).toBe(1);
  });
});

describe('the rival houses keep their numbers up the same way (DESIGN §9.1)', () => {
  it('a house below the floor raises a new man sooner or later; one above it does not', () => {
    const s = createInitialState(0, 3);
    const fam = s.families.valerii;
    // a full house never adopts
    for (let i = 0; i < 40; i++) maybeAdopt(s, fam);
    expect(livingMembers(s, 'valerii').length).toBe(4);
    // a thinned one does
    for (const c of livingMembers(s, 'valerii')) if (!c.isLeader) kill(s, c, 'test');
    expect(livingMembers(s, 'valerii').length).toBe(1);
    for (let i = 0; i < 40; i++) maybeAdopt(s, fam);
    expect(livingMembers(s, 'valerii').length).toBeGreaterThan(1);
    expect(livingMembers(s, 'valerii').length).toBeLessThanOrEqual(config.adoption.rivalMinSize);
  });

  it('the player is never adopted for', () => {
    const s = createInitialState(0, 3);
    for (const c of livingMembers(s, 'player')) if (!c.isLeader) kill(s, c, 'test');
    for (let i = 0; i < 40; i++) maybeAdopt(s, s.families.player);
    expect(livingMembers(s, 'player').length).toBe(1);
  });

  it('happens in the rival step of a round', () => {
    const g = new Game(createInitialState(0, 3));
    for (const c of livingMembers(g.state, 'claudii')) if (!c.isLeader) kill(g.state, c, 'test');
    for (let i = 0; i < 30; i++) g.act({ type: 'convene' }, 1 + i * 3_600_000);
    expect(livingMembers(g.state, 'claudii').length).toBeGreaterThan(1);
  });

  it('an older save without the count loads with it at zero', () => {
    const raw = JSON.parse(serialise(createInitialState(0, 1))) as { stats: Record<string, number> };
    delete raw.stats.adoptions;
    expect(deserialise(JSON.stringify(raw)).stats.adoptions).toBe(0);
  });
});

describe('the adoption controls', () => {
  function handlers() {
    const acts: Political[] = [];
    let raised = 0;
    const h: PanelHandlers = {
      onTab: () => {}, onChoice: () => {}, onScout: () => {}, onBuild: () => {}, onRush: () => {},
      onAdoptNewMan: () => { raised += 1; },
      onPolitical: (a) => { acts.push(a); }, onEnvoy: () => {}, onTrade: () => {},
      onResearch: () => {}, onRushResearch: () => {}, onGuards: () => {},
      onExport: () => {}, onImport: () => {}, onReset: () => {},
    };
    return { h, acts, raised: () => raised };
  }

  it('your own house offers a new man; each rival house offers its spare men', () => {
    const g = new Game(createInitialState(0, 1));
    rich(g.state); elevate(g.state); warm(g.state);
    const html = renderPanel(g, 'family', null, 1);
    expect(html).toContain('data-adopt-new');
    expect(html).toContain(`${newManCost(g.state)} denarii`);
    for (const id of ['cornelii', 'valerii', 'claudii']) {
      expect(html).toContain(`data-adopt="${id}"`);
      expect(html).toContain(`data-select-adopt="${id}"`);
    }
    // the warm house is open; a cold one says why not
    expect(html).toContain('they think too little of you');
  });

  it('a click carries the man, and raising a new man never touches the political handler', () => {
    const g = new Game(createInitialState(0, 1));
    rich(g.state); elevate(g.state); warm(g.state);
    const panel = document.createElement('div');
    const { h, acts, raised } = handlers();
    bindPanel(panel, h);
    panel.innerHTML = renderPanel(g, 'family', null, 1);
    panel.querySelector<HTMLButtonElement>('button[data-adopt-new]')!.click();
    expect(raised()).toBe(1);
    expect(acts).toHaveLength(0);
    const ward = adoptionCandidates(g.state, 'cornelii')[0];
    panel.querySelector<HTMLButtonElement>('button[data-adopt="cornelii"]')!.click();
    expect(acts).toEqual([{ type: 'adopt', characterId: ward.id }]);
  });
});
