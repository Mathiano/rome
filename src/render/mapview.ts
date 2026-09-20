/**
 * The world map (DESIGN §5.1): an SVG hex grid in the same palette as the
 * village. Terrain is visible from the start; a hex that holds something shows
 * a "?" until scouts have been there.
 */
import type { GameState } from '../state/types';
import { centre, corners, key, within } from '../map/grid';
import { claimOf, isScouted, siteAt } from '../map/sites';
import { generate, mapConfig } from '../map/world';

const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export interface MapView {
  root: SVGSVGElement;
  update(state: GameState, selected: string | null): void;
}

/** A glyph for a known site, drawn small enough to read at hex size. */
function siteGlyph(id: string): SVGGElement {
  const g = el('g', { class: `site site-${id}` });
  switch (id) {
    case 'timber':
      g.append(el('polygon', { points: '0,-8 6,3 -6,3', class: 'm-leaf' }),
               el('rect', { x: -1, y: 2, width: 2, height: 4, class: 'm-wood' }));
      break;
    case 'clay_bank':
      g.append(el('ellipse', { cx: 0, cy: 0, rx: 7, ry: 4, class: 'm-clay' }),
               el('ellipse', { cx: 0, cy: -1, rx: 3, ry: 1.8, class: 'm-claydark' }));
      break;
    case 'iron_seam':
      g.append(el('polygon', { points: '-7,4 -2,-6 3,-4 7,4', class: 'm-rock' }),
               el('circle', { cx: 1, cy: 0, r: 2.2, class: 'm-iron' }));
      break;
    case 'meadow':
      for (let i = 0; i < 3; i++) g.appendChild(el('line', { x1: -6 + i * 2, y1: 4 - i, x2: 6 - i * 2, y2: -2 - i, class: 'm-grain' }));
      break;
    case 'ford':
      g.append(el('path', { d: 'M-8 2 Q-4 -2 0 2 T8 2', class: 'm-water' }),
               el('path', { d: 'M-8 -3 Q-4 -7 0 -3 T8 -3', class: 'm-water' }));
      break;
    case 'shrine':
      g.append(el('rect', { x: -6, y: -1, width: 12, height: 2.5, class: 'm-stone' }),
               el('rect', { x: -4.5, y: -1, width: 2, height: 7, class: 'm-stone' }),
               el('rect', { x: 2.5, y: -1, width: 2, height: 7, class: 'm-stone' }));
      break;
    case 'ruins':
      g.append(el('rect', { x: -6, y: -2, width: 3, height: 8, class: 'm-stone' }),
               el('rect', { x: -1, y: -6, width: 3, height: 12, class: 'm-stone' }),
               el('rect', { x: 4, y: 0, width: 3, height: 6, class: 'm-stone' }));
      break;
    case 'camp':
      g.append(el('polygon', { points: '0,-7 7,5 -7,5', class: 'm-camp' }),
               el('line', { x1: 0, y1: -9, x2: 0, y2: -2, class: 'm-spear' }));
      break;
  }
  return g;
}

export function createMapView(onSelect: (hex: string) => void): MapView {
  const size = mapConfig.hexSize;
  const span = (mapConfig.radius + 1) * size * 2;
  const root = el('svg', { viewBox: `${-span * 0.87} ${-span * 0.8} ${span * 1.74} ${span * 1.6}`, preserveAspectRatio: 'xMidYMid meet', class: 'worldmap' });
  const terrainLayer = el('g');
  const markLayer = el('g');
  const topLayer = el('g', { class: 'labels' });
  root.append(terrainLayer, markLayer, topLayer);

  const cells = new Map<string, { poly: SVGPolygonElement; marks: SVGGElement; state: string }>();
  for (const h of within(mapConfig.radius)) {
    const k = key(h);
    const g = el('g', { class: 'hex', 'data-hex': k });
    const poly = el('polygon', { points: corners(h, size), class: 'ground' });
    g.appendChild(poly);
    const marks = el('g', { transform: `translate(${centre(h, size).x},${centre(h, size).y})` });
    g.appendChild(marks);
    g.addEventListener('click', () => onSelect(k));
    terrainLayer.appendChild(g);
    cells.set(k, { poly, marks, state: '' });
  }

  const hint = el('text', { class: 'map-hint', x: 0, y: 0 });
  topLayer.appendChild(hint);

  function update(state: GameState, selected: string | null): void {
    const terrainMap = generate(state.map.seed).terrain;
    for (const [k, cell] of cells) {
      const terrain = terrainMap[k] ?? 'plain';
      const scouted = isScouted(state, k);
      const id = siteAt(state, k);
      const held = claimOf(state, k);
      const home = k === '0,0';
      const stamp = [terrain, scouted ? 's' : '', id ?? '', held ? `h${held.garrison}` : '', selected === k ? 'x' : '', state.map.pendingScout === k ? 'p' : ''].join('|');
      if (stamp === cell.state) continue;
      cell.state = stamp;
      cell.poly.setAttribute('class', `ground t-${terrain}${selected === k ? ' selected' : ''}${held ? ' held' : ''}`);
      cell.marks.innerHTML = '';
      if (home) {
        // The colonia, not Rome: a walled mark, named in the panel when selected.
        const g = el('g', { class: 'home' });
        g.append(
          el('rect', { x: -9, y: -3, width: 18, height: 10, class: 'home-wall' }),
          el('rect', { x: -9, y: -7, width: 4, height: 6, class: 'home-wall' }),
          el('rect', { x: 5, y: -7, width: 4, height: 6, class: 'home-wall' }),
          el('polygon', { points: '-5,-3 0,-9 5,-3', class: 'home-roof' }),
        );
        cell.marks.appendChild(g);
      } else if (id && !scouted) {
        const t = el('text', { x: 0, y: 5, class: 'unknown' });
        t.textContent = '?';
        cell.marks.appendChild(t);
      } else if (id) {
        cell.marks.appendChild(siteGlyph(id));
        if (held) {
          const badge = el('text', { x: 0, y: size * 0.78, class: 'garrison' });
          badge.textContent = held.garrison > 0 ? `⚔ ${held.garrison}` : 'held';
          cell.marks.appendChild(badge);
        }
      }
      if (state.map.pendingScout === k) {
        const t = el('text', { x: 0, y: -size * 0.6, class: 'scouting' });
        t.textContent = '…';
        cell.marks.appendChild(t);
      }
    }
    hint.textContent = '';
  }

  return { root, update };
}
