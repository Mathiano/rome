// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { portraitSvg } from '../src/render/portrait';
import { createInitialState } from '../src/state/store';
import type { Character } from '../src/state/types';

const s = createInitialState(0, 1);

describe('portraits', () => {
  it('is deterministic: the same character always gets the same face', () => {
    const c = s.characters.p_leader;
    const f = s.families.player;
    expect(portraitSvg(c, f)).toBe(portraitSvg(c, f));
  });

  it('different characters get different faces', () => {
    const f = s.families.player;
    const faces = new Set(Object.values(s.characters).map((c) => portraitSvg(c, f)));
    expect(faces.size).toBe(Object.keys(s.characters).length);
  });

  it('carries the family accent and marks the dead', () => {
    const c = s.characters.c_leader;
    const rival = s.families.cornelii;
    expect(portraitSvg(c, rival)).toContain(rival.colour);
    expect(portraitSvg(c, rival, { dead: true })).toContain('grayscale');
  });

  it('is well-formed SVG the browser will parse', () => {
    for (const c of Object.values(s.characters)) {
      const svg = portraitSvg(c, s.families[c.familyId]);
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.querySelector('parsererror'), c.name).toBeNull();
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 64 72');
    }
  });

  it('writes a contact sheet for review', () => {
    const names = ['Titus', 'Quintus', 'Decimus', 'Aulus', 'Manius', 'Spurius', 'Gaius', 'Marcus'];
    const cells: string[] = [];
    let i = 0;
    for (const famId of ['player', 'cornelii'] as const) {
      const fam = s.families[famId];
      for (const sex of ['m', 'f'] as const) {
        for (const age of [18, 40, 70, 130]) {
          for (let k = 0; k < 4; k++) {
            const c: Character = { ...s.characters.p_leader, id: `demo_${famId}_${sex}_${age}_${k}`, sex, age, name: names[i % names.length] };
            i += 1;
            cells.push(`<div style="text-align:center">${portraitSvg(c, fam, { size: 76 })}<div style="font:10px serif">${sex} ${age}</div></div>`);
          }
        }
      }
    }
    writeFileSync('/tmp/claude-0/-home-user-rome/86df4dec-8142-5527-ae2e-f4149e6faf81/scratchpad/portraits.html',
      `<body style="background:#efe6d2;margin:0;padding:12px"><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px">${cells.join('')}</div></body>`);
    expect(cells.length).toBe(64);
  });
});

describe('portrait colour safety', () => {
  it('never emits an invalid paint, whatever the id hashes to', () => {
    const f = s.families.player;
    for (let i = 0; i < 400; i++) {
      const c: Character = { ...s.characters.p_leader, id: `probe_${i}`, age: 14 + (i % 180), sex: i % 2 ? 'f' : 'm' };
      const svg = portraitSvg(c, f);
      expect(svg, `probe_${i}`).not.toMatch(/undefined|NaN/);
    }
  });
});
