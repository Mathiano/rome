import { layout, building } from '../data';
import type { GameState, Slot } from '../state/types';
import { progress } from '../village/construction';
import { sprite } from './sprites';

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
  const root = el('svg', { viewBox: '-330 -190 660 360', preserveAspectRatio: 'xMidYMid meet' });
  const world = el('g');
  root.appendChild(world);
  const groups = new Map<string, { g: SVGGElement; spriteG: SVGGElement; key: string; bar: SVGRectElement; barBg: SVGRectElement; label: SVGTextElement }>();
  const { w, h } = layout.tile;

  const ordered = [...layout.slots].sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const def of ordered) {
    const { sx, sy } = project(def.x, def.y);
    const g = el('g', { class: `slot ring-${def.ring}${def.site ? ' site-' + def.site : ''}`, 'data-slot': def.id, transform: `translate(${sx},${sy})` });
    const tile = el('polygon', { class: 'tile', points: `${-w / 2},0 0,${h / 2} ${w / 2},0 0,${-h / 2}` });
    g.appendChild(tile);
    const spriteG = el('g', { class: 'sprite' });
    g.appendChild(spriteG);
    const barBg = el('rect', { class: 'progress', x: -20, y: h / 2 + 2, width: 40, height: 4, rx: 1, visibility: 'hidden' });
    const bar = el('rect', { class: 'progress-bar', x: -20, y: h / 2 + 2, width: 0, height: 4, rx: 1, visibility: 'hidden' });
    const label = el('text', { class: 'label', x: 0, y: h / 2 + 14 });
    g.append(barBg, bar, label);
    g.addEventListener('click', () => onSelect(def.id));
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
            gr.spriteG.setAttribute('transform', `translate(${-s.ax},${-s.ay})`);
            gr.spriteG.innerHTML = s.inner;
          }
        }
      }
      gr.label.textContent = labelFor(slot);
      const c = state.constructions.find((x) => x.slotId === slot.id);
      const vis = c ? 'visible' : 'hidden';
      gr.bar.setAttribute('visibility', vis);
      gr.barBg.setAttribute('visibility', vis);
      if (c) gr.bar.setAttribute('width', String(40 * progress(c, now)));
    }
  }
  return { root, update };
}

const ROMAN = ['', 'I', 'II', 'III'];

function labelFor(slot: Slot): string {
  if (slot.building && slot.tier > 0) return `${building(slot.building).name} ${ROMAN[slot.tier] ?? slot.tier}`;
  if (slot.building) return building(slot.building).name;
  if (slot.site) return slot.site.replace('_', ' ');
  return 'empty plot';
}
