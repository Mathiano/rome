import { building, layout } from '../data';
import type { GameState, Slot } from '../state/types';
import { progress } from '../village/construction';
import { buildingTier } from '../village/storage';
import { anchors, cellSize, centreOf, enclosure, enclosureOfSize, extentOf, riverbank } from '../village/grid';
import { remainingText } from './panel';
import { currentAdvice, resolveGoto } from './advisor';
import { sprite, type AnimPlacement, type LoopPlacement } from './sprites';
import { createGround, createTownFloor, createWall, gateAt, GATE_HIT, project as projectXY, type ScenePiece } from './environment';

const NS = 'http://www.w3.org/2000/svg';

export interface VillageView {
  root: SVGSVGElement;
  /** `placing` is a town building being put down: the view offers every cell it fits. */
  update(state: GameState, now: number, selected: string | null, placing?: string | null): void;
}

/** Isometric projection of grid units to scene units. */
export function project(x: number, y: number): { sx: number; sy: number } {
  const [sx, sy] = projectXY(x, y);
  return { sx, sy };
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Where a slot stands, in grid units: a footprint's centre, a site's cell centre, the wall's gate. */
export function slotCentre(state: GameState, slot: Slot): { x: number; y: number } {
  if (slot.zone === 'wall') return gateAt(enclosure(state));
  if (slot.zone === 'town') return centreOf(slot);
  return { x: (slot.x ?? 0) + 0.5, y: (slot.y ?? 0) + 0.5 };
}

/** A diamond of w×h cells centred on the origin, in scene units. */
function plate(w: number, h: number): string {
  const c = cellSize();
  const hw = c.w / 2;
  const hh = c.h / 2;
  // the corners of [−w/2, w/2] × [−h/2, h/2] in grid units, projected
  const p = (x: number, y: number) => `${(((x - y) * hw)).toFixed(1)},${(((x + y) * hh)).toFixed(1)}`;
  return [p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)].join(' ');
}

/**
 * Everything the view can show, in grid units: the largest enclosure, its
 * riverbank and the river past it, and every site outside the wall.
 */
function sceneBounds(): { x: number; y: number; w: number; h: number } {
  const big = enclosureOfSize(Math.max(...layout.grid.sizeByWallTier));
  const pts: [number, number][] = [
    [big.x0, big.y0], [big.x1 + 1 + layout.grid.riverbankDepth + 1, big.y0], [big.x0, big.y1 + 1], [big.x1 + 1 + layout.grid.riverbankDepth + 1, big.y1 + 1],
    ...layout.sites.flatMap((s) => [[s.x, s.y], [s.x + 1, s.y + 1]] as [number, number][]),
  ];
  const sx = pts.map(([x, y]) => project(x, y).sx);
  const sy = pts.map(([x, y]) => project(x, y).sy);
  const pad = cellSize().w * 0.6;
  const x0 = Math.min(...sx) - pad;
  const y0 = Math.min(...sy) - pad * 1.6; // sprites stand taller than their plates
  return { x: x0, y: y0, w: Math.max(...sx) + pad - x0, h: Math.max(...sy) + pad * 0.6 - y0 };
}

/**
 * The view's zoom (DESIGN §4.5 C.4): it opens on the whole country and zooms
 * in by the wheel as far as the old frame — so at its widest it shows roughly
 * three times what the round town did, and never more than the scene holds.
 */
export const ZOOM = { closestWidth: 660, aspect: 360 / 660 };

export function createVillageView(onSelect: (slotId: string) => void, onPlace: (x: number, y: number) => void = () => {}): VillageView {
  const SCENE = sceneBounds();
  const VIEW = { ...SCENE };
  const root = el('svg', { viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, preserveAspectRatio: 'xMidYMid meet' });
  const world = el('g');
  root.appendChild(world);
  // The country lies under everything and never changes.
  world.appendChild(createGround(VIEW));
  // The town floor and grid change with the wall's tier; the scene above it
  // holds every slot and every piece of wall, appended in depth order.
  const floorLayer = el('g', { class: 'floor-layer' });
  const scene = el('g', { class: 'scene' });
  const placeLayer = el('g', { class: 'place-layer' });
  world.append(floorLayer, scene, placeLayer);
  // Labels live above every plot: a plot drawn later would otherwise cover its
  // neighbour's name.
  const labelLayer = el('g', { class: 'labels' });
  const hoverLabel = el('text', { class: 'label', x: 0, y: 0 });
  labelLayer.appendChild(hoverLabel);
  root.appendChild(labelLayer);
  let hovered: string | null = null;
  const groups = new Map<string, { g: SVGGElement; spriteG: SVGGElement; key: string; bar: SVGRectElement; barBg: SVGRectElement; depth: number; pos: string }>();
  const { h } = cellSize();

  // --- zoom: the wheel scales the frame about the pointer, clamped to the scene
  function setView(x: number, y: number, w: number): void {
    const hh = w * (SCENE.h / SCENE.w);
    VIEW.w = w;
    VIEW.h = hh;
    VIEW.x = Math.max(SCENE.x, Math.min(SCENE.x + SCENE.w - w, x));
    VIEW.y = Math.max(SCENE.y, Math.min(SCENE.y + SCENE.h - hh, y));
    root.setAttribute('viewBox', `${VIEW.x.toFixed(1)} ${VIEW.y.toFixed(1)} ${VIEW.w.toFixed(1)} ${VIEW.h.toFixed(1)}`);
  }
  root.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = root.getBoundingClientRect();
    const fx = rect.width ? (ev.clientX - rect.left) / rect.width : 0.5;
    const fy = rect.height ? (ev.clientY - rect.top) / rect.height : 0.5;
    const w = Math.max(ZOOM.closestWidth, Math.min(SCENE.w, VIEW.w * (ev.deltaY > 0 ? 1.15 : 1 / 1.15)));
    const hh = w * (SCENE.h / SCENE.w);
    setView(VIEW.x + (VIEW.w - w) * fx, VIEW.y + (VIEW.h - hh) * fy, w);
  }, { passive: false });

  function makeGroup(state: GameState, slot: Slot) {
    const g = el('g', { class: `slot zone-${slot.zone}${slot.site ? ' site-' + slot.site : ''}`, 'data-slot': slot.id });
    // The wall stands on no plate: its circuit is its sprite. It still needs
    // something to click, so its `tile` is the gate's own span.
    const tile = slot.zone === 'wall'
      ? el('polygon', { class: 'tile', points: `${-GATE_HIT.w / 2},2 ${GATE_HIT.w / 2},2 ${GATE_HIT.w / 2},${-GATE_HIT.h} ${-GATE_HIT.w / 2},${-GATE_HIT.h}` })
      : el('polygon', { class: 'tile', points: slot.zone === 'town' ? plate(...extentOf(building(slot.building!))) : plate(1, 1) });
    g.appendChild(tile);
    if (slot.zone === 'site') {
      const { w } = cellSize();
      const empty = el('g', { class: 'empty-marks' });
      for (const [sx, sy] of [[-w / 2, 0], [0, h / 2], [w / 2, 0], [0, -h / 2]] as [number, number][]) {
        empty.appendChild(el('line', { x1: sx * 0.86, y1: sy * 0.86, x2: sx * 0.86, y2: sy * 0.86 - 7, class: 'stake' }));
      }
      if (slot.site) empty.appendChild(siteGlyph(slot.site));
      g.appendChild(empty);
    }
    const spriteG = el('g', { class: 'sprite' });
    g.appendChild(spriteG);
    const barBg = el('rect', { class: 'progress', x: -20, y: h / 2 + 2, width: 40, height: 4, rx: 1, visibility: 'hidden' });
    const bar = el('rect', { class: 'progress-bar', x: -20, y: h / 2 + 2, width: 0, height: 4, rx: 1, visibility: 'hidden' });
    g.append(barBg, bar);
    g.addEventListener('click', () => onSelect(slot.id));
    // Paint the label on the spot rather than on the next village tick.
    g.addEventListener('mouseenter', () => { hovered = slot.id; paintLabel(); });
    g.addEventListener('mouseleave', () => { if (hovered === slot.id) hovered = null; paintLabel(); });
    const entry = { g, spriteG, key: '', bar, barBg, depth: 0, pos: '' };
    groups.set(slot.id, entry);
    placeGroup(state, slot, entry);
    return entry;
  }

  function placeGroup(state: GameState, slot: Slot, entry: { g: SVGGElement; depth: number; pos: string }): void {
    const c = slotCentre(state, slot);
    const pos = `${c.x},${c.y}`;
    if (pos === entry.pos) return;
    entry.pos = pos;
    const { sx, sy } = project(c.x, c.y);
    entry.g.setAttribute('transform', `translate(${sx},${sy})`);
    entry.depth = c.x + c.y;
  }

  /**
   * The wall and the floor under it follow the wall's tier; the slots follow
   * the colony. The scene is re-sorted only when one of those changes — never
   * on a plain tick, so nothing under the pointer is rebuilt (the steady UI).
   */
  let shape = '';
  let wallPieces: ScenePiece[] = [];
  function compose(state: GameState): void {
    const wallTier = buildingTier(state, 'wall');
    const e = enclosure(state);
    const ids = state.slots.map((s) => s.id).join(' ');
    const next = `${wallTier}|${ids}`;
    if (next === shape) return;
    const tierChanged = shape.split('|')[0] !== String(wallTier);
    shape = next;
    if (tierChanged) {
      floorLayer.replaceChildren(createTownFloor(e, riverbank(state)));
      for (const p of wallPieces) p.g.remove();
      wallPieces = createWall(wallTier, e);
    }
    const live = new Set(state.slots.map((s) => s.id));
    for (const [id, gr] of groups) if (!live.has(id)) { gr.g.remove(); groups.delete(id); }
    for (const slot of state.slots) {
      const gr = groups.get(slot.id) ?? makeGroup(state, slot);
      placeGroup(state, slot, gr);
    }
    const pieces: ScenePiece[] = [...wallPieces, ...Array.from(groups.values()).map((gr) => ({ depth: gr.depth, g: gr.g }))];
    pieces.sort((a, b) => a.depth - b.depth);
    // Appending an element already in the scene moves it; the order is the depth.
    for (const p of pieces) {
      p.g.setAttribute('data-depth', p.depth.toFixed(3));
      scene.appendChild(p.g);
    }
  }

  /** The cells a building can go on, drawn as its footprint at every anchor that fits. */
  let placeKey = '';
  function drawPlacing(state: GameState, placing: string | null): void {
    const k = placing ? `${placing}|${shape}` : '';
    if (k === placeKey) return;
    placeKey = k;
    placeLayer.replaceChildren();
    root.classList.toggle('placing', !!placing);
    if (!placing) return;
    const [w, hh] = extentOf(building(placing));
    for (const a of anchors(state, placing)) {
      const { sx, sy } = project(a.x + w / 2, a.y + hh / 2);
      const spot = el('polygon', { class: 'place-spot', points: plate(w, hh), transform: `translate(${sx},${sy})`, 'data-place-at': `${a.x},${a.y}` });
      spot.addEventListener('click', (ev) => { ev.stopPropagation(); onPlace(a.x, a.y); });
      placeLayer.appendChild(spot);
    }
  }

  /** Whatever update() last drew, so a hover can answer without waiting for it. */
  let last: { state: GameState; now: number; selected: string | null } | null = null;

  function paintLabel(): void {
    if (!last) return;
    const named = hovered ?? last.selected;
    const slot = named ? last.state.slots.find((s) => s.id === named) : undefined;
    if (!slot) { hoverLabel.textContent = ''; return; }
    const c = slotCentre(last.state, slot);
    const { sx, sy } = project(c.x, c.y);
    // The gate is on the near edge of the town, so the wall's name goes above it.
    const dy = slot.zone === 'wall' ? -h * 0.9 : h * 0.9;
    hoverLabel.setAttribute('transform', `translate(${sx},${sy + dy})`);
    const work = last.state.constructions.find((x) => x.slotId === slot.id);
    hoverLabel.textContent = work
      ? `${labelFor(slot)} — ${remainingText(work.finishAt - last.now)}`
      : labelFor(slot);
  }

  function update(state: GameState, now: number, selected: string | null, placing: string | null = null): void {
    last = { state, now, selected };
    compose(state);
    drawPlacing(state, placing);
    // The counsel's plot is marked the way the selected one is.
    const step = currentAdvice(state);
    const counsel = step ? resolveGoto(state, step).slot ?? null : null;
    for (const slot of state.slots) {
      const gr = groups.get(slot.id)!;
      gr.g.classList.toggle('selected', selected === slot.id);
      gr.g.classList.toggle('counsel', counsel === slot.id);
      const key = slot.building ? `${slot.building}_t${slot.tier}` : '';
      if (key !== gr.key) {
        gr.key = key;
        gr.spriteG.innerHTML = '';
        if (slot.building && slot.tier > 0) {
          const s = sprite(slot.building, slot.tier);
          if (s) {
            // A sprite's plate is one cell; a larger footprint scales it to fill.
            const k = slot.zone === 'town' ? Math.min(...extentOf(building(slot.building))) : 1;
            const holder = k === 1 ? gr.spriteG : el('g', { transform: `scale(${k})` });
            if (holder !== gr.spriteG) gr.spriteG.appendChild(holder);
            const img = el('image', { href: s.url, x: s.x, y: s.y, width: s.width, height: s.height, 'data-ax': s.ax, 'data-ay': s.ay });
            holder.appendChild(img);
            for (const o of s.overlays) holder.appendChild(o.kind === 'loop' ? loopOverlay(o) : animOverlay(o));
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
    paintLabel();
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
  return 'open ground';
}
