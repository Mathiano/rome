import { layout, building } from '../data';
import type { GameState, Slot } from '../state/types';
import { progress } from '../village/construction';
import { remainingText } from './panel';
import { sprite, type AnimPlacement, type LoopPlacement } from './sprites';
import { createEnvironment } from './environment';

const NS = 'http://www.w3.org/2000/svg';

export interface VillageView { root: SVGSVGElement; update(state: GameState, now: number, selected: string | null): void; }

/** Isometric projection of layout grid coordinates. */
export function project(x: number, y: number): { sx: number; sy: number } {
  const { w, h } = layout.tile;
  return { sx: ((x - y) * w) / 2, sy: ((x + y) * h) / 2 };
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function createVillageView(onSelect: (slotId: string) => void): VillageView {
  const VIEW = { x: -330, y: -190, w: 660, h: 360 };
  const root = el('svg', { viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, preserveAspectRatio: 'xMidYMid meet' });
  const world = el('g');
  root.appendChild(world);
  // The colony itself: wall, ground, roads and country. Drawn once, behind
  // every plot, and never touched again (DESIGN §10).
  world.appendChild(createEnvironment(VIEW));
  // Labels live above every plot: a plot drawn later would otherwise cover its
  // neighbour's name now that the plates touch.
  const labelLayer = el('g', { class: 'labels' });
  const hoverLabel = el('text', { class: 'label', x: 0, y: 0 });
  labelLayer.appendChild(hoverLabel);
  root.appendChild(labelLayer);
  let hovered: string | null = null;
  const groups = new Map<string, { g: SVGGElement; spriteG: SVGGElement; key: string; bar: SVGRectElement; barBg: SVGRectElement; label: SVGTextElement }>();
  const { w, h } = layout.tile;

  const ordered = [...layout.slots].sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const def of ordered) {
    const { sx, sy } = project(def.x, def.y);
    const g = el('g', { class: `slot ring-${def.ring}${def.site ? ' site-' + def.site : ''}`, 'data-slot': def.id, transform: `translate(${sx},${sy})` });
    const tile = el('polygon', { class: 'tile', points: `${-w / 2},0 0,${h / 2} ${w / 2},0 0,${-h / 2}` });
    g.appendChild(tile);
    const empty = el('g', { class: 'empty-marks' });
    for (const [sx, sy] of [[-w / 2, 0], [0, h / 2], [w / 2, 0], [0, -h / 2]] as [number, number][]) {
      empty.appendChild(el('line', { x1: sx * 0.86, y1: sy * 0.86, x2: sx * 0.86, y2: sy * 0.86 - 7, class: 'stake' }));
    }
    if (def.site) empty.appendChild(siteGlyph(def.site));
    g.appendChild(empty);
    const spriteG = el('g', { class: 'sprite' });
    g.appendChild(spriteG);
    const barBg = el('rect', { class: 'progress', x: -20, y: h / 2 + 2, width: 40, height: 4, rx: 1, visibility: 'hidden' });
    const bar = el('rect', { class: 'progress-bar', x: -20, y: h / 2 + 2, width: 0, height: 4, rx: 1, visibility: 'hidden' });
    const label = el('text', { class: 'label', x: 0, y: h / 2 + 14 });
    g.append(barBg, bar);
    g.addEventListener('click', () => onSelect(def.id));
    g.addEventListener('mouseenter', () => { hovered = def.id; });
    g.addEventListener('mouseleave', () => { if (hovered === def.id) hovered = null; });
    world.appendChild(g);
    groups.set(def.id, { g, spriteG, key: '', bar, barBg, label });
  }

  function update(state: GameState, now: number, selected: string | null): void {
    for (const slot of state.slots) {
      const gr = groups.get(slot.id)!;
      gr.g.classList.toggle('selected', selected === slot.id);
      const key = slot.building ? `${slot.building}_t${slot.tier}` : '';
      if (key !== gr.key) {
        gr.key = key;
        gr.spriteG.innerHTML = '';
        if (slot.building && slot.tier > 0) {
          const s = sprite(slot.building, slot.tier);
          if (s) {
            const img = el('image', { href: s.url, x: s.x, y: s.y, width: s.width, height: s.height, 'data-ax': s.ax, 'data-ay': s.ay });
            gr.spriteG.appendChild(img);
            for (const o of s.overlays) gr.spriteG.appendChild(o.kind === 'loop' ? loopOverlay(o) : animOverlay(o));
          }
        }
      }
      gr.g.classList.toggle('built', !!(slot.building && slot.tier > 0));
      const c = state.constructions.find((x) => x.slotId === slot.id);
      const vis = c ? 'visible' : 'hidden';
      gr.bar.setAttribute('visibility', vis);
      gr.barBg.setAttribute('visibility', vis);
      if (c) gr.bar.setAttribute('width', String(40 * progress(c, now)));
    }
    const named = hovered ?? selected;
    if (named) {
      const def = layout.slots.find((s) => s.id === named)!;
      const slot = state.slots.find((s) => s.id === named)!;
      const { sx, sy } = project(def.x, def.y);
      hoverLabel.setAttribute('transform', `translate(${sx},${sy + h * 1.1})`);
      const work = state.constructions.find((x) => x.slotId === named);
      hoverLabel.textContent = work
        ? `${labelFor(slot)} — ${remainingText(work.finishAt - now)}`
        : labelFor(slot);
    } else {
      hoverLabel.textContent = '';
    }
  }
  return { root, update };
}

const ROMAN = ['', 'I', 'II', 'III'];

/** A small mark of what a resource site holds, drawn on an unbuilt plot. */
function siteGlyph(site: string): SVGGElement {
  const g = el('g', { class: 'glyph' });
  if (site === 'forest') {
    g.appendChild(el('polygon', { points: '0,-16 8,2 -8,2', class: 'gl-leaf' }));
    g.appendChild(el('polygon', { points: '0,-8 6,6 -6,6', class: 'gl-leaf' }));
    g.appendChild(el('rect', { x: -1.5, y: 5, width: 3, height: 5, class: 'gl-wood' }));
  } else if (site === 'clay_bank') {
    g.appendChild(el('ellipse', { cx: 0, cy: 2, rx: 12, ry: 6, class: 'gl-clay' }));
    g.appendChild(el('ellipse', { cx: 0, cy: 1, rx: 6, ry: 3, class: 'gl-claydark' }));
  } else if (site === 'iron_seam') {
    g.appendChild(el('polygon', { points: '-10,4 -4,-8 4,-6 10,4', class: 'gl-rock' }));
    g.appendChild(el('circle', { cx: 2, cy: 0, r: 3, class: 'gl-iron' }));
  } else if (site === 'farmland') {
    for (let i = 0; i < 3; i++) {
      g.appendChild(el('line', { x1: -10 + i * 3, y1: 4 - i * 2, x2: 10 - i * 3, y2: -2 - i * 2, class: 'gl-furrow' }));
    }
  }
  return g;
}

/**
 * The tier-3 animation set (DESIGN §10): smoke, a swinging crane hook, a
 * fluttering standard, a furnace glow. Drawn as SVG over the sprite and driven
 * by CSS keyframes, positioned from the same plate anchor as the sprite.
 */
export function animOverlay(o: AnimPlacement): SVGGElement {
  const g = el('g', { class: `anim anim-${o.anim}`, transform: `translate(${o.x},${o.y}) scale(${o.scale})` });
  if (o.anim === 'smoke') {
    for (let i = 0; i < 3; i++) {
      const c = el('circle', { class: `puff p${i}`, cx: 0, cy: 0, r: 1.5 + i * 0.55 });
      g.appendChild(c);
    }
  } else if (o.anim === 'flag') {
    g.appendChild(el('polygon', { class: 'cloth', points: '0,0 7.5,1.6 6.4,5.4 0,6.6' }));
  } else if (o.anim === 'glow') {
    g.appendChild(el('circle', { class: 'halo', cx: 0, cy: 0, r: 4.2 }));
    g.appendChild(el('circle', { class: 'core', cx: 0, cy: 0, r: 1.8 }));
  } else {
    const rope = el('g', { class: 'arm' });
    rope.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 7.5 }));
    rope.appendChild(el('polyline', { points: '-1.8,7.5 0,9.6 1.8,7.5' }));
    g.appendChild(rope);
  }
  return g;
}

/** A sprite-sheet loop: a nested <svg> clips one frame; the sheet steps left one frame per tick. */
export function loopOverlay(o: LoopPlacement): SVGSVGElement {
  const clip = el('svg', { class: 'overlay', x: o.x, y: o.y, width: o.width, height: o.height, viewBox: `0 0 ${o.frameWidth} ${o.frameHeight}`, preserveAspectRatio: 'none' });
  const sheet = el('image', { href: o.url, x: 0, y: 0, width: o.frameWidth * o.frames, height: o.frameHeight, preserveAspectRatio: 'none' });
  const seconds = o.frames / o.fps;
  sheet.style.animation = `sheet-loop ${seconds}s steps(${o.frames}) infinite`;
  sheet.style.setProperty('--sheet-width', `${o.frameWidth * o.frames}px`);
  clip.appendChild(sheet);
  return clip;
}

function labelFor(slot: Slot): string {
  if (slot.building && slot.tier > 0) return `${building(slot.building).name} ${ROMAN[slot.tier] ?? slot.tier}`;
  if (slot.building) return building(slot.building).name;
  if (slot.site) return slot.site.replace('_', ' ');
  return 'empty plot';
}
