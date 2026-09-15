import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildings } from '../src/data';

const DIR = join(__dirname, '..', 'assets', 'buildings');

describe('generated sprites (CLAUDE.md conventions)', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.svg'));
  it('has one sprite per building tier', () => {
    expect(files).toHaveLength(buildings.length * 3);
    for (const b of buildings) for (const t of [1, 2, 3]) expect(files).toContain(`${b.id}_t${t}.svg`);
  });
  for (const f of files) {
    it(`${f}: 64×64, anchored at the base-diamond centre, primitives only`, () => {
      const svg = readFileSync(join(DIR, f), 'utf8');
      expect(svg).toMatch(/viewBox="0 0 64 64"/);
      expect(svg).toMatch(/data-ax="32"/);
      expect(svg).toMatch(/data-ay="48"/);
      expect(svg).not.toMatch(/<path/);
      expect(svg).not.toMatch(/[CcQqSsTtAa]\s*[\d.-]+,/); // no curve commands anywhere
      const isT3 = f.endsWith('_t3.svg');
      expect(/@keyframes/.test(svg)).toBe(isT3);
      expect(/class="anim-/.test(svg)).toBe(isT3);
    });
  }
});
