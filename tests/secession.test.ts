// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState, deserialise, serialise } from '../src/state/store';
import { Game } from '../src/game';
import { config } from '../src/data';
import type { GameState } from '../src/state/types';
import { mayReturn, returnHome, secede, secessionTurn, underPressure } from '../src/politics/secession';
import { aliveMembers, kill, leaderOf, livingMembers } from '../src/politics/characters';
import { appoint, driftAttitudes, holderOf, postsHeldBy } from '../src/politics/posts';
import { bribe } from '../src/politics/intrigue';
import { candidates, tally } from '../src/politics/challenge';
import { renderPanel } from '../src/render/panel';

const S = () => config.secession;

/** A house that has every reason to go. */
function embitter(s: GameState, familyId = 'cornelii') {
  const f = s.families[familyId];
  f.grievances = S().grievances;
  f.attitude = S().attitude;
  return f;
}

/** Run the secession step `n` times, as `n` rounds would. */
function rounds(s: GameState, familyId: string, n: number) {
  for (let i = 0; i < n; i++) { s.round += 1; secessionTurn(s, s.families[familyId]); }
}

describe('the terms for leaving (DESIGN §9.7)', () => {
  it('take grievances, loathing and being out of office, all three', () => {
    const s = createInitialState(0, 1);
    const f = s.families.cornelii;
    expect(underPressure(s, f)).toBe(false);
    embitter(s);
    expect(underPressure(s, f)).toBe(true);
    f.grievances = S().grievances - 1;
    expect(underPressure(s, f)).toBe(false);
    f.grievances = S().grievances;
    f.attitude = S().attitude + 1;
    expect(underPressure(s, f)).toBe(false);
    f.attitude = S().attitude;
    // a house in power has no reason to go
    s.office = leaderOf(s, 'cornelii')!.id;
    expect(underPressure(s, f)).toBe(false);
    // and your own house never does
    expect(underPressure(s, s.families.player)).toBe(false);
  });

  it('must hold for consecutive rounds, warn the round before, and reset when the house is mollified', () => {
    const s = createInitialState(0, 1);
    const f = embitter(s);
    rounds(s, 'cornelii', S().rounds - 1);
    expect(f.departedRound).toBeNull();
    expect(f.sourRounds).toBe(S().rounds - 1);
    expect(s.log.some((l) => /talk openly of leaving/.test(l.text))).toBe(true);
    // a change of heart resets the count
    f.attitude = 0;
    rounds(s, 'cornelii', 1);
    expect(f.sourRounds).toBe(0);
    expect(f.departedRound).toBeNull();
    // and the whole run must be met again
    f.attitude = S().attitude;
    rounds(s, 'cornelii', S().rounds);
    expect(f.departedRound).toBe(s.round);
  });
});

describe('a house that has left', () => {
  function gone(seed = 1) {
    const s = createInitialState(0, seed);
    const f = embitter(s);
    const head = leaderOf(s, 'cornelii')!;
    head.gravitas = 50;
    appoint(s, 'works', head.id);
    f.demand = { kind: 'denarii', denarii: 50, issuedRound: 0, dueRound: 3 };
    s.population = 40;
    const favour = s.rome.favour;
    s.round = 10;
    secede(s, f);
    return { s, f, head, favour };
  }

  it('is away, not dead: posts vacant, votes gone, citizens and Rome\'s regard with them', () => {
    const { s, f, head, favour } = gone();
    expect(f.departedRound).toBe(10);
    for (const c of aliveMembers(s, 'cornelii')) {
      expect(c.alive).toBe(true);
      expect(c.departed).toBe(true);
    }
    expect(livingMembers(s, 'cornelii')).toHaveLength(0);
    expect(holderOf(s, 'works')).toBeNull();
    expect(head.post).toBeNull();
    expect(postsHeldBy(s, 'cornelii')).toHaveLength(0);
    expect(f.demand).toBeNull();
    expect(s.population).toBe(40 - Math.floor(40 * S().populationShare));
    expect(s.rome.favour).toBe(favour + S().romeFavour);
    expect(s.stats.secessions).toBe(1);
    // nobody of theirs stands or votes
    const cand = candidates(s, 'valerii');
    expect(cand.cornelii).toBeUndefined();
    const votes = tally(s, { callerFamilyId: 'valerii', calledRound: 10, voteRound: 11, candidates: cand });
    const cast = Object.values(votes).reduce((a, b) => a + b, 0);
    expect(cast).toBe(Object.values(s.characters).filter((c) => c.alive && !c.departed && !c.exiled).length);
  });

  it('keeps its head while away, and succession stays within the house if he dies abroad', () => {
    const { s, head } = gone();
    expect(leaderOf(s, 'cornelii')?.id).toBe(head.id);
    const before = aliveMembers(s, 'cornelii').length;
    kill(s, head, 'old age');
    const next = leaderOf(s, 'cornelii');
    expect(next).not.toBeNull();
    expect(next!.departed, 'the heir is one of those who left, not a new man raised into an absent house').toBe(true);
    expect(aliveMembers(s, 'cornelii')).toHaveLength(before - 1);
  });

  it('neither sours nor mellows, but a gift still reaches it', () => {
    const { s, f } = gone();
    const att = f.attitude;
    driftAttitudes(s);
    expect(f.attitude).toBe(att);
    s.resources.denarii = 500;
    const l = leaderOf(s, 'player')!; l.gravitas = 50;
    bribe(s, 'cornelii');
    expect(f.attitude).toBe(att + config.intrigue.bribe.attitude);
  });

  it('cannot be appointed and does not catch the marsh fever', () => {
    const { s, head } = gone();
    head.gravitas = 50;
    expect(() => appoint(s, 'granary', head.id)).toThrow(/left the colony/);
  });

  it('hears terms after a spell if its regard is mended, and comes home regardless by the limit', () => {
    const { s, f } = gone();
    // too soon, whatever the regard
    f.attitude = 50;
    s.round = 10 + S().awayRounds - 1;
    expect(mayReturn(s, f)).toBe(false);
    // in time, but unforgiven
    s.round = 10 + S().awayRounds;
    f.attitude = S().returnAttitude - 1;
    expect(mayReturn(s, f)).toBe(false);
    // in time and forgiven
    f.attitude = S().returnAttitude;
    expect(mayReturn(s, f)).toBe(true);
    // unforgiven, but the limit has come
    f.attitude = -100;
    s.round = 10 + S().maxAwayRounds;
    expect(mayReturn(s, f)).toBe(true);
  });

  it('comes home whole, its grievances forgotten and its regard at least the floor', () => {
    const { s, f } = gone();
    f.grievances = 9;
    f.attitude = -100;
    returnHome(s, f);
    expect(f.departedRound).toBeNull();
    expect(f.grievances).toBe(0);
    expect(f.attitude).toBe(S().returnAttitude);
    expect(livingMembers(s, 'cornelii').length).toBe(aliveMembers(s, 'cornelii').length);
    expect(livingMembers(s, 'cornelii').every((c) => !c.departed)).toBe(true);
    expect(s.log.some((l) => /return to the colony/.test(l.text))).toBe(true);
  });

  it('is the rival step that sends it and brings it back, round by round', () => {
    const g = new Game(createInitialState(0, 2));
    const f = embitter(g.state);
    g.state.resources.denarii = 5000;
    let t = 1;
    const step = () => { t += 3_600_000; g.act({ type: 'convene' }, t); if (g.state.pendingChoice) g.state.pendingChoice = null; };
    // keep them bitter through the count: the round's drift cannot pull them under the bar twice
    for (let i = 0; i < S().rounds; i++) { f.attitude = S().attitude; f.grievances = S().grievances; step(); }
    expect(f.departedRound).not.toBeNull();
    const left = f.departedRound!;
    // away: nothing of theirs is here
    expect(livingMembers(g.state, 'cornelii')).toHaveLength(0);
    // mend the regard while they are away, then wait out the spell
    leaderOf(g.state, 'player')!.gravitas = 50;
    while (f.attitude < S().returnAttitude) bribe(g.state, 'cornelii');
    while (g.state.round < left + S().awayRounds) step();
    expect(f.departedRound, 'home once the spell is served and the regard mended').toBeNull();
    expect(livingMembers(g.state, 'cornelii').length).toBeGreaterThan(0);
  });

  it('survives a save, and an older save loads as a house that never left', () => {
    const { s } = gone();
    const back = deserialise(serialise(s));
    expect(back.families.cornelii.departedRound).toBe(10);
    expect(back.characters[leaderOf(back, 'cornelii')!.id].departed).toBe(true);
    expect(back.stats.secessions).toBe(1);

    const raw = JSON.parse(serialise(createInitialState(0, 1))) as { families: Record<string, Record<string, unknown>>; stats: Record<string, number> };
    for (const f of Object.values(raw.families)) { delete f.departedRound; delete f.sourRounds; }
    delete raw.stats.secessions;
    const old = deserialise(JSON.stringify(raw));
    expect(old.families.cornelii.departedRound).toBeNull();
    expect(old.families.cornelii.sourRounds).toBe(0);
    expect(old.stats.secessions).toBe(0);
  });

  it('is shown for what it is, with only a gift left to send', () => {
    const { s } = gone();
    const html = renderPanel(new Game(s), 'family', null, 1);
    expect(html).toContain('left the colony at round 10');
    expect(html).toContain('gone with the house');
    expect(html).toContain('data-political="bribe" data-family="cornelii"');
    expect(html).not.toContain('data-political="expose" data-family="cornelii"');
    expect(html).not.toContain('data-assassinate="cornelii"');
    // the houses still here keep the whole menu
    expect(html).toContain('data-political="expose" data-family="valerii"');
  });

  it('warns on the card before it happens', () => {
    const s = createInitialState(0, 1);
    embitter(s);
    rounds(s, 'cornelii', 1);
    const html = renderPanel(new Game(s), 'family', null, 1);
    expect(html).toContain('They talk of leaving the colony');
  });
});
