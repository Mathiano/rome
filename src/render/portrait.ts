/**
 * Portraits (DESIGN §10): monochrome ink-and-wash busts, one accent colour per
 * family.
 *
 * 🟡 The doc assumes a batch generated from one fixed style prompt and
 * committed. There is no image model in this pipeline, so each bust is drawn
 * deterministically from the character's id instead. That is strictly better
 * for this game: new men are created at runtime with ids nobody could have
 * pre-rendered, and every face still survives a save/load unchanged.
 */
import type { Character, Family } from '../state/types';
import { config } from '../data';

const INK = '#2a2118';
const SKIN = ['#efe4d2', '#e3d5bf', '#d2c1a8', '#bda98d'];
const HAIR = ['#3b332a', '#5a4b3a', '#7d6c56', '#a99a84'];
const GREY = '#b8b0a2';
const CLOTH = '#ebe3d4';
const CLOTH_SHADE = '#cfc4b0';

/** FNV-1a. Same id, same face, on every device and after every reload. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** `n` may come from a shifted hash, so normalise before indexing: a negative
 * index yields undefined, which reaches the DOM as fill="undefined" and paints
 * black. */
function pick<T>(arr: T[], n: number): T {
  return arr[(n >>> 0) % arr.length];
}

export interface PortraitOptions {
  size?: number;
  /** Fraction of a natural lifespan spent, 0..1. Drives grey and lines. */
  age?: number;
  dead?: boolean;
}

export function portraitSvg(c: Character, fam: Family, opts: PortraitOptions = {}): string {
  const size = opts.size ?? 52;
  const h = hash(c.id);
  const accent = fam.colour;
  const skin = pick(SKIN, h >>> 2);
  const female = c.sex === 'f';

  const { roundsMin, roundsMax } = config.lifespan;
  const age = opts.age ?? Math.max(0, Math.min(1, (c.age - 14) / Math.max(1, roundsMax - 14)));
  const old = age > (roundsMin - 14) / (roundsMax - 14) * 0.62;
  const hairBase = pick(HAIR, h >>> 5);
  const hairCol = age > 0.55 ? GREY : hairBase;

  const headW = 17 + ((h >>> 7) % 3);
  const jaw = ((h >>> 9) % 3);            // 0 round, 1 square, 2 long
  const noseKind = (h >>> 11) % 3;
  const browLift = ((h >>> 13) % 3) - 1;
  const style = (h >>> 15) % 4;           // hair style
  const beard = !female && old && ((h >>> 17) % 3 === 0);
  // Roman portrait busts are stern far more often than they smile.
  const mouthCurve = [-0.9, -0.3, 0.2, 0.2, 1.1][(h >>> 19) % 5];
  const mouthWide = 3.8 + ((h >>> 21) % 3) * 0.8;

  const cx = 32;
  const chin = jaw === 2 ? 50 : 47;
  const cheek = jaw === 1 ? headW : headW - 1.5;

  const p: string[] = [];
  p.push(`<rect x="0" y="0" width="64" height="72" rx="3" fill="${accent}" fill-opacity="0.14"/>`);
  p.push(`<ellipse cx="32" cy="34" rx="26" ry="30" fill="${accent}" fill-opacity="0.1"/>`);

  // shoulders and tunic, with the family's stripe
  p.push(`<path d="M8 72 Q10 58 24 55 L40 55 Q54 58 56 72 Z" fill="${CLOTH}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`);
  p.push(`<path d="M24 55 Q32 63 40 55" fill="${CLOTH_SHADE}" stroke="${INK}" stroke-width="1"/>`);
  p.push(`<rect x="${female ? 38 : 40}" y="60" width="4" height="12" fill="${accent}" fill-opacity="0.85"/>`);

  // neck
  p.push(`<rect x="${cx - 5}" y="${chin - 6}" width="10" height="12" fill="${skin}" stroke="${INK}" stroke-width="1.1"/>`);

  // head
  const top = 16;
  p.push(`<path d="M${cx - cheek} ${top + 13}
      Q${cx - cheek} ${top - 3} ${cx} ${top - 3}
      Q${cx + cheek} ${top - 3} ${cx + cheek} ${top + 13}
      Q${cx + cheek} ${chin - 6} ${cx} ${chin}
      Q${cx - cheek} ${chin - 6} ${cx - cheek} ${top + 13} Z"
      fill="${skin}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`);
  // wash on the shaded side
  p.push(`<path d="M${cx + 3} ${top - 2} Q${cx + cheek} ${top + 6} ${cx + cheek - 1} ${top + 16} Q${cx + cheek - 3} ${chin - 6} ${cx} ${chin} Q${cx + 4} ${chin - 12} ${cx + 3} ${top - 2} Z" fill="${INK}" fill-opacity="0.1"/>`);
  // ears
  for (const s of [-1, 1]) {
    p.push(`<ellipse cx="${cx + s * (cheek + 0.5)}" cy="${top + 17}" rx="2.2" ry="3.4" fill="${skin}" stroke="${INK}" stroke-width="1"/>`);
  }

  // brows and eyes
  const eyeY = top + 15;
  for (const s of [-1, 1]) {
    const ex = cx + s * 6;
    p.push(`<path d="M${ex - 4} ${eyeY - 4 + browLift * 0.6} Q${ex} ${eyeY - 6.5 + browLift} ${ex + 4} ${eyeY - 4.2}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`);
    p.push(`<path d="M${ex - 3.4} ${eyeY} Q${ex} ${eyeY - 2.6} ${ex + 3.4} ${eyeY}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`);
    if (!opts.dead) p.push(`<circle cx="${ex}" cy="${eyeY - 0.4}" r="1.15" fill="${INK}"/>`);
    else p.push(`<path d="M${ex - 3} ${eyeY - 1} L${ex + 3} ${eyeY - 1}" stroke="${INK}" stroke-width="1.2"/>`);
  }

  // nose
  const nY = eyeY + 8;
  if (noseKind === 0) p.push(`<path d="M${cx - 1} ${eyeY + 1} L${cx - 2.5} ${nY} Q${cx} ${nY + 2} ${cx + 2.6} ${nY - 0.6}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`);
  else if (noseKind === 1) p.push(`<path d="M${cx - 0.5} ${eyeY + 1} Q${cx - 3.5} ${nY - 2} ${cx - 2} ${nY} Q${cx} ${nY + 2.2} ${cx + 3} ${nY - 1}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`);
  else p.push(`<path d="M${cx - 1} ${eyeY + 1} L${cx - 1.5} ${nY + 1} L${cx + 3} ${nY}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`);

  // mouth
  const mY = nY + 6;
  p.push(`<path d="M${cx - mouthWide} ${mY} Q${cx} ${mY + mouthCurve} ${cx + mouthWide} ${mY}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`);
  if (old) {
    p.push(`<path d="M${cx - 7} ${mY - 3} Q${cx - 6} ${mY + 1} ${cx - 6.5} ${mY + 3}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.55"/>`);
    p.push(`<path d="M${cx + 7} ${mY - 3} Q${cx + 6} ${mY + 1} ${cx + 6.5} ${mY + 3}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.55"/>`);
  }
  if (beard) {
    p.push(`<path d="M${cx - cheek + 2} ${mY - 2} Q${cx} ${chin + 5} ${cx + cheek - 2} ${mY - 2} Q${cx} ${mY + 3} ${cx - cheek + 2} ${mY - 2} Z" fill="${hairCol}" stroke="${INK}" stroke-width="1"/>`);
  }

  // hair
  if (female) {
    p.push(`<path d="M${cx - cheek - 1} ${top + 14} Q${cx - cheek - 2} ${top - 6} ${cx} ${top - 6} Q${cx + cheek + 2} ${top - 6} ${cx + cheek + 1} ${top + 14} Q${cx + cheek - 2} ${top + 4} ${cx} ${top + 3} Q${cx - cheek + 2} ${top + 4} ${cx - cheek - 1} ${top + 14} Z" fill="${hairCol}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`);
    p.push(`<path d="M${cx - cheek - 1} ${top + 6} Q${cx} ${top + 9} ${cx + cheek + 1} ${top + 6}" fill="none" stroke="${accent}" stroke-width="2" stroke-opacity="0.9"/>`);
    p.push(`<ellipse cx="${cx}" cy="${top - 4}" rx="6" ry="4" fill="${hairCol}" stroke="${INK}" stroke-width="1.1"/>`);
  } else if (style === 3 && old) {
    // receding
    p.push(`<path d="M${cx - cheek - 1} ${top + 12} Q${cx - cheek} ${top + 1} ${cx - 5} ${top + 2} Q${cx + 4} ${top + 3} ${cx + cheek} ${top + 1} Q${cx + cheek + 1} ${top + 12} ${cx + cheek + 1} ${top + 12}" fill="${hairCol}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`);
  } else if (style === 1) {
    // curls
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.08 + (0.84 * i) / 6);
      p.push(`<circle cx="${cx - Math.cos(a) * (cheek - 0.5)}" cy="${top + 3 - Math.sin(a) * 9}" r="3.4" fill="${hairCol}" stroke="${INK}" stroke-width="0.9"/>`);
    }
  } else {
    // cropped Roman cut
    p.push(`<path d="M${cx - cheek - 1} ${top + 13} Q${cx - cheek - 1} ${top - 6} ${cx} ${top - 6} Q${cx + cheek + 1} ${top - 6} ${cx + cheek + 1} ${top + 13} Q${cx + cheek - 1} ${top + 5} ${cx} ${top + 6} Q${cx - cheek + 1} ${top + 5} ${cx - cheek - 1} ${top + 13} Z" fill="${hairCol}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`);
    if (style === 2) p.push(`<path d="M${cx - 8} ${top + 5} L${cx + 2} ${top + 1}" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.5"/>`);
  }

  const dim = opts.dead ? ' style="filter:grayscale(1);opacity:0.55"' : '';
  return `<svg class="portrait" viewBox="0 0 64 72" width="${size}" height="${Math.round((size * 72) / 64)}"${dim}>${p.join('')}</svg>`;
}
