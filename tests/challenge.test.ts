// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { Game } from '../src/game';
import { config } from '../src/data';
import type { GameState } from '../src/state/types';
import {
  callChallenge, candidates, considerChallenge, officeFamilyId, playerCallChallenge,
  playerHoldsOffice, resolveChallenge, tally, tallyByHouse, wouldWin,
} from '../src/politics/challenge';
import { kill, leaderOf, livingMembers, playerFamily } from '../src/politics/characters';
import {
  assassinate, assassinationChance, denounce, exile, expose, marriageCandidates, marry,
  marryTribe, setBodyguards, totalBodyguards,
} from '../src/politics/intrigue';
import { appoint, holderOf } from '../src/politics/posts';
import { homeMilitia, militiaPool } from '../src/combat/militia';
import { bindPanel, renderPanel, type PanelHandlers, type Tab } from '../src/render/panel';
import type { Political } from '../src/game';

const rich = (s: GameState) => { s.resources.denarii = 5000; };
/** Give the player's head of house the standing the greater moves ask for. */
function elevate(s: GameState, gravitas = 400) {
  const l = leaderOf(s, playerFamily(s).id)!;
  l.gravitas = gravitas;
  l.gravitasStock = 200;
  return l;
}
/** Hand the office to a rival, as losing a vote would. */
function depose(s: GameState, familyId = 'cornelii') {
  s.office = leaderOf(s, familyId)!.id;
}

describe('the top office (DESIGN §9.5)', () => {
  it('opens with the player holding it', () => {
    const s = createInitialState(0, 1);
    expect(playerHoldsOffice(s)).toBe(true);
    expect(officeFamilyId(s)).toBe('player');
  });

  it('every house of any weight puts a man up, and everybody votes exactly once', () => {
    const s = createInitialState(0, 5);
    const cand = candidates(s, 'cornelii');
    expect(Object.keys(cand).length).toBeGreaterThanOrEqual(2);
    expect(cand.player).toBeTruthy();
    expect(cand.cornelii).toBeTruthy();
    const votes = tally(s, { callerFamilyId: 'cornelii', calledRound: 0, voteRound: 1, candidates: cand });
    const cast = Object.values(votes).reduce((a, b) => a + b, 0);
    const voters = Object.values(s.characters).filter((c) => c.alive && !c.exiled).length;
    expect(cast).toBe(voters);
  });

  it('a vote no house carries outright leaves the office where it is', () => {
    const s = createInitialState(0, 5);
    const incumbent = s.office;
    callChallenge(s, 'cornelii');
    s.round = s.challenge!.voteRound;
    resolveChallenge(s);
    // Four equal houses, each voting for its own man: nobody has a majority.
    expect(s.office).toBe(incumbent);
    expect(s.stats.challengesFaced).toBe(1);
  });

  it('a house that has counted the votes takes the office, and the player continues out of power', () => {
    const s = createInitialState(0, 5);
    // Thin the player's house and the other two, so the Cornelii outvote everyone.
    for (const fid of ['player', 'valerii', 'claudii']) {
      for (const c of livingMembers(s, fid).slice(1)) kill(s, c, 'test');
    }
    for (const f of Object.values(s.families)) if (!f.isPlayer) f.attitude = -60;
    expect(wouldWin(s, 'cornelii')).toBe(true);
    callChallenge(s, 'cornelii');
    s.round = s.challenge!.voteRound;
    resolveChallenge(s);
    expect(officeFamilyId(s)).toBe('cornelii');
    expect(playerHoldsOffice(s)).toBe(false);
    // Pillar 7: a setback, not an end.
    expect(livingMembers(s, 'player').length).toBeGreaterThan(0);
    expect(s.office).not.toBeNull();
  });

  it('a house with nobody standing would rather the player kept it — unless it loathes them', () => {
    const s = createInitialState(0, 5);
    for (const c of livingMembers(s, 'valerii').slice(1)) kill(s, c, 'test');
    leaderOf(s, 'valerii')!.gravitas = 0;
    const cand = { player: leaderOf(s, 'player')!.id, cornelii: leaderOf(s, 'cornelii')!.id };
    const ch = { callerFamilyId: 'cornelii', calledRound: 0, voteRound: 1, candidates: cand };
    s.families.valerii.attitude = 0;
    const friendly = tally(s, ch)[cand.player];
    s.families.valerii.attitude = config.challenge.loyalToPlayerAttitude - 5;
    const hostile = tally(s, ch)[cand.player];
    expect(friendly).toBeGreaterThan(hostile);
  });

  it('a rival moves only once it has soured on you, and only if the count is on its side', () => {
    // Nobody has standing at the founding, so only the caller, the office and
    // the player put a man up: the two houses left over decide the vote, and
    // houses that loathe the player hand it to the strongest rival.
    const angry = createInitialState(0, 5);
    angry.round = 50;
    for (const f of Object.values(angry.families)) if (!f.isPlayer) f.attitude = -80;
    expect(wouldWin(angry, 'cornelii')).toBe(true);
    for (let i = 0; i < 40 && !angry.challenge; i++) considerChallenge(angry, 'cornelii');
    expect(angry.challenge?.callerFamilyId).toBe('cornelii');

    // The same count, but a house that still thinks well of you does not move.
    const content = createInitialState(0, 5);
    content.round = 50;
    for (const f of Object.values(content.families)) if (!f.isPlayer) f.attitude = -80;
    content.families.cornelii.attitude = config.challenge.callerAttitudeCeiling + 5;
    for (let i = 0; i < 40; i++) considerChallenge(content, 'cornelii');
    expect(content.challenge).toBeNull();

    // And the defence DESIGN §9.5 names: the other houses liking you more than
    // they like each other. One bitter house alone cannot carry the council,
    // however bitter, because the houses with nobody standing vote for you.
    const weak = createInitialState(0, 5);
    weak.round = 50;
    weak.families.valerii.attitude = -80;
    weak.families.cornelii.attitude = 0;
    weak.families.claudii.attitude = 0;
    expect(wouldWin(weak, 'valerii')).toBe(false);
    for (let i = 0; i < 40; i++) considerChallenge(weak, 'valerii');
    expect(weak.challenge).toBeNull();
  });

  it('the council is closed to a house out of office, and intrigue is not', () => {
    const s = createInitialState(0, 9);
    depose(s);
    rich(s);
    elevate(s);
    const mine = livingMembers(s, 'player')[1];
    expect(() => appoint(s, 'works', mine.id)).toThrow(/Praefectus/);
    // What is left: the houses, Rome, and a knife.
    s.corruption = 40;
    const before = s.corruption;
    expose(s, 'valerii');
    expect(s.corruption).toBeLessThan(before);
  });

  it('the player wins the office back by calling a vote, at a price and a rank', () => {
    const s = createInitialState(0, 9);
    depose(s);
    s.lastChallengeRound = 0;
    s.round = config.challenge.minRoundsBetween + 1;
    expect(() => playerCallChallenge(s)).toThrow(/denarii|gravitas rank/);
    rich(s);
    elevate(s);
    const coin = s.resources.denarii;
    playerCallChallenge(s);
    expect(s.challenge!.callerFamilyId).toBe('player');
    expect(s.resources.denarii).toBe(coin - (config.challenge.playerCallCost.denarii ?? 0));
    // Thin every rival so the player's own house carries the vote.
    for (const fid of ['cornelii', 'valerii', 'claudii']) {
      for (const c of livingMembers(s, fid).slice(1)) kill(s, c, 'test');
    }
    s.round = s.challenge!.voteRound;
    resolveChallenge(s);
    expect(playerHoldsOffice(s)).toBe(true);
    expect(s.stats.challengesWon).toBe(1);
  });

  it('calling a vote leaves a round to campaign in, not none', () => {
    const g = new Game(createInitialState(0, 9));
    depose(g.state);
    rich(g.state);
    elevate(g.state);
    g.state.lastChallengeRound = -99;
    g.act({ type: 'call_challenge' }, 1000);
    // The action ran the round in which the council heard it; the vote is still
    // ahead, which is the whole point of the round the player is given.
    expect(g.state.challenge).not.toBeNull();
    expect(g.state.challenge!.voteRound).toBe(g.state.round + config.challenge.roundsToVote);
    expect(g.state.challenge!.calledRound).toBe(g.state.round);
    g.act({ type: 'convene' }, 2000);
    expect(g.state.challenge).toBeNull();
    expect(g.state.stats.challengesFaced).toBe(1);
  });

  it('the council will not hear two challenges at once, nor one straight after another', () => {
    const s = createInitialState(0, 9);
    callChallenge(s, 'cornelii');
    expect(() => callChallenge(s, 'valerii')).toThrow(/already/);
    s.round = s.challenge!.voteRound;
    resolveChallenge(s);
    depose(s);
    rich(s);
    elevate(s);
    expect(() => playerCallChallenge(s)).toThrow(/will not hear/);
  });

  it('a round runs the vote when it falls due', () => {
    const g = new Game(createInitialState(0, 11));
    callChallenge(g.state, 'cornelii');
    const due = g.state.challenge!.voteRound;
    for (let i = 0; g.state.round < due; i++) g.act({ type: 'convene' }, i * 1000 + 1);
    expect(g.state.challenge).toBeNull();
    expect(g.state.stats.challengesFaced).toBe(1);
  });
});

describe('the rest of the intrigue menu (DESIGN §9.6)', () => {
  it('exposing a house drops corruption and buys a grievance', () => {
    const s = createInitialState(0, 2);
    rich(s); elevate(s);
    s.corruption = 50;
    const att = s.families.cornelii.attitude;
    expose(s, 'cornelii');
    expect(s.corruption).toBe(50 - config.intrigue.expose.corruptionDrop);
    expect(s.families.cornelii.attitude).toBeLessThan(att);
    expect(s.families.cornelii.grievances).toBe(1);
    expect(() => expose(s, 'player')).toThrow();
  });

  it('a denunciation spends your own standing and buys Rome’s ear', () => {
    const s = createInitialState(0, 2);
    const l = elevate(s);
    const favour = s.rome.favour;
    denounce(s, 'cornelii');
    expect(s.rome.favour).toBe(favour + config.intrigue.denounce.romeFavour);
    expect(l.gravitasStock).toBe(200 - config.intrigue.denounce.gravitasCost);
  });

  it('an exile empties his post, and every house takes note', () => {
    const s = createInitialState(0, 2);
    rich(s); elevate(s);
    const target = leaderOf(s, 'cornelii')!;
    appoint(s, 'works', target.id);
    expect(holderOf(s, 'works')?.id).toBe(target.id);
    const others = s.families.valerii.attitude;
    exile(s, target.id);
    expect(holderOf(s, 'works')).toBeNull();
    expect(target.alive).toBe(false);
    expect(target.exiled).toBe(true);
    expect(s.families.valerii.attitude).toBeLessThan(others);
    expect(s.stats.exiles).toBe(1);
    // An exile casts no vote.
    const cand = candidates(s, 'cornelii');
    const cast = Object.values(tally(s, { callerFamilyId: 'cornelii', calledRound: 0, voteRound: 1, candidates: cand }))
      .reduce((a, b) => a + b, 0);
    expect(cast).toBe(Object.values(s.characters).filter((c) => c.alive && !c.exiled).length);
  });

  it('a marriage binds both ways and only outside the house', () => {
    const s = createInitialState(0, 2);
    rich(s); elevate(s);
    const pairs = marriageCandidates(s, 'cornelii');
    expect(pairs.length).toBeGreaterThan(0);
    const att = s.families.cornelii.attitude;
    s.families.cornelii.grievances = 2;
    marry(s, pairs[0].a, pairs[0].b);
    expect(s.characters[pairs[0].a].spouseId).toBe(pairs[0].b);
    expect(s.characters[pairs[0].b].spouseId).toBe(pairs[0].a);
    expect(s.families.cornelii.attitude).toBeGreaterThan(att);
    expect(s.families.cornelii.grievances).toBe(2 - config.intrigue.marry.grievanceRelief);
    expect(() => marry(s, pairs[0].a, pairs[0].b)).toThrow(/married/);
    const mine = livingMembers(s, 'player').filter((c) => !c.spouseId);
    if (mine.length > 1) expect(() => marry(s, mine[0].id, mine[1].id)).toThrow();
  });

  it('a marriage into a tribe moves that tribe instead', () => {
    const s = createInitialState(0, 2);
    rich(s); elevate(s);
    const who = livingMembers(s, 'player').find((c) => !c.spouseId)!;
    const trust = s.tribes.chatti.trust;
    marryTribe(s, who.id, 'chatti');
    expect(s.tribes.chatti.trust).toBeGreaterThan(trust);
    expect(who.spouseId).toBe('tribe:chatti');
  });

  it('guards come off the walls, are capped, and cannot be conjured', () => {
    const g = new Game(createInitialState(0, 2));
    const s = g.state;
    const mine = livingMembers(s, 'player')[0];
    const walls = homeMilitia(s);
    expect(militiaPool(s)).toBeGreaterThan(0);
    g.guards(mine.id, 1, 1);
    expect(mine.bodyguards).toBe(1);
    expect(totalBodyguards(s)).toBe(1);
    expect(homeMilitia(s)).toBe(walls - 1);
    // A round is not spent on arranging your own household (DESIGN §3.2).
    expect(s.round).toBe(0);
    // The cap is applied first, so what is refused is men that do not exist:
    // one already stands over him and no others are uncommitted.
    expect(() => setBodyguards(s, mine.id, 3, 0)).toThrow(/spare/);
    expect(mine.bodyguards).toBe(1);
    setBodyguards(s, mine.id, config.bodyguard.maxPerCharacter + 5, 99);
    expect(mine.bodyguards).toBe(config.bodyguard.maxPerCharacter);
    const theirs = leaderOf(s, 'cornelii')!;
    expect(() => setBodyguards(s, theirs.id, 1, 99)).toThrow(/your own/);
  });

  it('guards make a man harder to kill', () => {
    const s = createInitialState(0, 2);
    const target = leaderOf(s, 'cornelii')!;
    const bare = assassinationChance(s, target.id);
    target.bodyguards = config.bodyguard.maxPerCharacter;
    expect(assassinationChance(s, target.id)).toBeLessThan(bare);
  });

  it('a knife in the dark turns every house colder and cannot be repeated at once', () => {
    const s = createInitialState(0, 4);
    rich(s); elevate(s);
    s.round = 40;
    const target = livingMembers(s, 'cornelii').find((c) => !c.isLeader)!;
    const before = Object.fromEntries(Object.values(s.families).map((f) => [f.id, f.attitude]));
    assassinate(s, target.id);
    expect(s.stats.assassinationsOrdered).toBe(1);
    for (const f of Object.values(s.families)) {
      if (f.isPlayer) continue;
      expect(f.attitude, f.id).toBeLessThan(before[f.id]);
      expect(f.grievances).toBeGreaterThan(0);
    }
    expect(() => assassinate(s, leaderOf(s, 'valerii')!.id)).toThrow(/Too soon/);
    expect(() => assassinate(s, livingMembers(s, 'player')[0].id)).toThrow(/your own/);
  });

  it('the greater moves are gated on rank, not only on coin', () => {
    const s = createInitialState(0, 4);
    rich(s);
    s.round = 40;
    const l = leaderOf(s, playerFamily(s).id)!;
    l.gravitas = 0;
    expect(() => exile(s, leaderOf(s, 'cornelii')!.id)).toThrow(/rank/);
    expect(() => assassinate(s, leaderOf(s, 'cornelii')!.id)).toThrow(/rank/);
  });
});

// ------------------------------------------------------------------ the panels
function handlers(): { h: PanelHandlers; acts: Political[]; guards: [string, number][] } {
  const acts: Political[] = [];
  const guards: [string, number][] = [];
  const h: PanelHandlers = {
    onTab: () => {}, onChoice: () => {}, onScout: () => {}, onBuild: () => {}, onRush: () => {},
    onSelectSlot: () => {},
    onAdoptNewMan: () => {},
    onPolitical: (a) => acts.push(a), onEnvoy: () => {}, onTrade: () => {},
    onResearch: () => {}, onRushResearch: () => {},
    onGuards: (id, men) => guards.push([id, men]),
    onExport: () => {}, onImport: () => {}, onReset: () => {},
    onSelectHex: () => {}, onDismissAdvisor: () => {},
  };
  return { h, acts, guards };
}

function mount(g: Game, tab: Tab) {
  const el = document.createElement('div');
  el.id = 'panel';
  el.innerHTML = renderPanel(g, tab, 'i1', 2);
  document.body.appendChild(el);
  return el;
}

describe('the challenge and intrigue panels', () => {
  it('the council shows the count as it stands while a challenge is before it', () => {
    const g = new Game(createInitialState(0, 5));
    const plain = renderPanel(g, 'council', null, 2);
    expect(plain).not.toContain('challenge stands');
    callChallenge(g.state, 'cornelii');
    const html = renderPanel(g, 'council', null, 2);
    expect(html).toContain('challenge stands');
    expect(html).toContain('class="tally"');
    // One row per candidate, and the count is shown rather than hidden.
    const el = document.createElement('div');
    el.innerHTML = html;
    expect(el.querySelectorAll('.tally .row').length).toBe(Object.keys(g.state.challenge!.candidates).length);
  });

  it('out of office the council offers a challenge instead of appointments', () => {
    const g = new Game(createInitialState(0, 5));
    depose(g.state);
    rich(g.state);
    elevate(g.state);
    g.state.lastChallengeRound = -99;
    const el = mount(g, 'council');
    expect(el.textContent).toContain('out of office');
    const call = el.querySelector<HTMLButtonElement>('button[data-political="call_challenge"]')!;
    expect(call).toBeTruthy();
    expect(call.disabled).toBe(false);
    for (const b of el.querySelectorAll<HTMLButtonElement>('button[data-appoint]')) expect(b.disabled).toBe(true);
    el.remove();
  });

  it('every rival house carries the whole menu, and only your own kin can be guarded', () => {
    const g = new Game(createInitialState(0, 5));
    rich(g.state);
    elevate(g.state);
    const el = mount(g, 'family');
    for (const fid of ['cornelii', 'valerii', 'claudii']) {
      for (const move of ['bribe', 'expose', 'denounce']) {
        expect(el.querySelector(`button[data-political="${move}"][data-family="${fid}"]`), `${move} ${fid}`).toBeTruthy();
      }
      expect(el.querySelector(`button[data-exile="${fid}"]`)).toBeTruthy();
      expect(el.querySelector(`button[data-assassinate="${fid}"]`)).toBeTruthy();
      expect(el.querySelector(`select[data-select-target="${fid}"]`)).toBeTruthy();
      expect(el.querySelector(`select[data-select-marry="${fid}"]`)).toBeTruthy();
    }
    const guarded = [...el.querySelectorAll<HTMLElement>('button[data-guards]')].map((b) => b.dataset.guards!);
    const own = new Set(livingMembers(g.state, 'player').map((c) => c.id));
    expect(guarded.length).toBeGreaterThan(0);
    for (const id of guarded) expect(own.has(id)).toBe(true);
    el.remove();
  });

  it('a click carries the id of what it is aimed at', () => {
    const g = new Game(createInitialState(0, 5));
    rich(g.state);
    elevate(g.state);
    const el = mount(g, 'family');
    const { h, acts, guards } = handlers();
    bindPanel(el, h);
    const target = el.querySelector<HTMLSelectElement>('select[data-select-target="cornelii"]')!.value;
    el.querySelector<HTMLButtonElement>('button[data-assassinate="cornelii"]')!.click();
    el.querySelector<HTMLButtonElement>('button[data-exile="cornelii"]')!.click();
    el.querySelector<HTMLButtonElement>('button[data-political="expose"][data-family="valerii"]')!.click();
    el.querySelector<HTMLButtonElement>('button[data-marry="claudii"]')!.click();
    const g1 = el.querySelector<HTMLButtonElement>('button[data-guards]')!;
    g1.click();
    expect(acts).toEqual([
      { type: 'assassinate', targetId: target },
      { type: 'exile', characterId: target },
      { type: 'expose', familyId: 'valerii' },
      { type: 'marry', aId: expect.any(String), bId: expect.any(String) },
    ]);
    expect(guards).toEqual([[g1.dataset.guards, Number(g1.dataset.men)]]);
    el.remove();
  });

  it('appeasing a tribe still carries which tribe, ahead of the catch-all', () => {
    const g = new Game(createInitialState(0, 5));
    g.state.resources.denarii = 5000;
    g.state.tribes.chatti.massingForRound = g.state.round + 1;
    const el = mount(g, 'tribe');
    const { h, acts } = handlers();
    bindPanel(el, h);
    const btn = el.querySelector<HTMLButtonElement>('button[data-political="appease"][data-tribe="chatti"]')!;
    expect(btn).toBeTruthy();
    btn.click();
    expect(acts).toEqual([{ type: 'appease', tribeId: 'chatti' }]);
    el.remove();
  });
});

describe('the count by house (reports unit)', () => {
  it('sums to the tally per candidate, and every living voter is counted once', () => {
    for (const seed of [1, 5, 9]) {
      const s = createInitialState(0, seed);
      s.families.valerii.attitude = -60;
      const cand = candidates(s, 'cornelii');
      const ch = { callerFamilyId: 'cornelii', calledRound: 0, voteRound: 1, candidates: cand };
      const votes = tally(s, ch);
      const byHouse = tallyByHouse(s, ch);
      expect(Object.keys(byHouse).sort()).toEqual(Object.keys(s.families).sort());
      for (const cid of Object.keys(votes)) {
        const sum = Object.values(byHouse).reduce((a, h) => a + (h[cid] ?? 0), 0);
        expect(sum, `${seed}:${cid}`).toBe(votes[cid]);
      }
      for (const fid of Object.keys(s.families)) {
        const cast = Object.values(byHouse[fid]).reduce((a, b) => a + b, 0);
        expect(cast).toBe(livingMembers(s, fid).filter((m) => !m.exiled).length);
      }
      // a house with a man standing votes for him and nobody else
      for (const [fid, cid] of Object.entries(cand)) expect(Object.keys(byHouse[fid])).toEqual([cid]);
    }
  });
  it('a resolved challenge leaves one resolved report naming the winner', () => {
    const g = new Game(createInitialState(0, 5));
    callChallenge(g.state, 'cornelii');
    g.state.round = g.state.challenge!.voteRound;
    resolveChallenge(g.state);
    const resolved = g.state.reports.filter((r) => r.kind === 'challenge' && r.data.phase === 'resolved');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].kind === 'challenge' && resolved[0].data.winnerId).toBe(g.state.office);
  });
});
