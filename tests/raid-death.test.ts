import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/store';
import { config } from '../src/data';
import { holderDeathChance, resolveRaid } from '../src/combat/raids';
import { appoint, holderOf } from '../src/politics/posts';
import { leaderOf } from '../src/politics/characters';

const TRIBE_ID = 'chatti';

/** The garrison post asks a rank of its holder; give him the standing and the post. */
function post(s: ReturnType<typeof createInitialState>, id: string) {
  s.characters[id].gravitas = 50;
  appoint(s, 'garrison', id);
}

/** A raid nothing could stop: strength far beyond the ditch, the bank and the militia. */
function overwhelm(s: ReturnType<typeof createInitialState>) {
  s.tribes[TRIBE_ID].strength = 100_000;
  s.resources.wood = 500;
}

describe('death by raid (DESIGN §9.2, §8.2)', () => {
  it('is eased by discipline, never by guards, and never goes below nothing', () => {
    const s = createInitialState(0, 1);
    const c = s.characters.c_nephew;
    const r = config.raid;
    c.stats.discipline = 0;
    expect(holderDeathChance(c)).toBeCloseTo(r.holderDeathChance, 6);
    c.stats.discipline = 5;
    expect(holderDeathChance(c)).toBeCloseTo(r.holderDeathChance * (1 - 5 * r.holderDeathDisciplineRelief), 6);
    c.bodyguards = 4;
    expect(holderDeathChance(c), 'guards stand in his house, not on the wall').toBeCloseTo(r.holderDeathChance * (1 - 5 * r.holderDeathDisciplineRelief), 6);
    c.stats.discipline = 100;
    expect(holderDeathChance(c)).toBe(0);
  });

  it('a raid that gets through can kill the prefect on the wall, and his post falls vacant', () => {
    const s = createInitialState(0, 1);
    overwhelm(s);
    post(s, 'c_nephew');
    config.raid.holderDeathChance = 1;
    config.raid.holderDeathDisciplineRelief = 0;
    const r = resolveRaid(s, s.tribes[TRIBE_ID]);
    expect(r.fraction).toBeGreaterThan(0);
    expect(r.fell?.id).toBe('c_nephew');
    const c = s.characters.c_nephew;
    expect(c.alive).toBe(false);
    expect(c.causeOfDeath).toMatch(/on the wall/);
    expect(holderOf(s, 'garrison')).toBeNull();
    expect(s.stats.deaths).toBe(1);
    expect(s.log.some((l) => /dies: on the wall/.test(l.text))).toBe(true);
  });

  it('a repelled raid kills nobody, whatever the odds', () => {
    const s = createInitialState(0, 1);
    post(s, 'c_nephew');
    s.tribes[TRIBE_ID].strength = 0;
    config.raid.holderDeathChance = 1;
    config.raid.holderDeathDisciplineRelief = 0;
    const r = resolveRaid(s, s.tribes[TRIBE_ID]);
    expect(r.fraction).toBe(0);
    expect(r.fell).toBeUndefined();
    expect(s.characters.c_nephew.alive).toBe(true);
  });

  it('with the post vacant there is nobody on the wall to lose', () => {
    const s = createInitialState(0, 1);
    overwhelm(s);
    config.raid.holderDeathChance = 1;
    const deaths = s.stats.deaths;
    const r = resolveRaid(s, s.tribes[TRIBE_ID]);
    expect(r.fraction).toBeGreaterThan(0);
    expect(r.fell).toBeUndefined();
    expect(s.stats.deaths).toBe(deaths);
  });

  it('the head of a house who falls is succeeded, as any death is (Pillar 7)', () => {
    const s = createInitialState(0, 1);
    overwhelm(s);
    const head = leaderOf(s, 'cornelii')!;
    post(s, head.id);
    config.raid.holderDeathChance = 1;
    config.raid.holderDeathDisciplineRelief = 0;
    resolveRaid(s, s.tribes[TRIBE_ID]);
    expect(head.alive).toBe(false);
    const next = leaderOf(s, 'cornelii');
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(head.id);
  });

  it('at the shipped odds it is rare: a handful in a hundred raids, not most of them', () => {
    let fell = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const s = createInitialState(0, seed);
      overwhelm(s);
      post(s, 'c_nephew');
      config.raid.holderDeathChance = 0.08;
      config.raid.holderDeathDisciplineRelief = 0.06;
      if (resolveRaid(s, s.tribes[TRIBE_ID]).fell) fell += 1;
    }
    expect(fell).toBeGreaterThan(0);
    expect(fell).toBeLessThan(20);
  });
});
