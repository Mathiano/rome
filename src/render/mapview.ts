/**
 * The world map (DESIGN §5.1): an SVG hex grid in the same palette as the
 * village. Terrain is visible from the start; a hex that holds something shows
 * a "?" until scouts have been there.
 */
import type { GameState } from '../state/types';
import { centre, corners, key, within } from '../map/grid';
import { claimOf, isKnown, isScouted, isSpentTreasure, siteAt } from '../map/sites';
import { generate, mapConfig } from '../map/world';
import { threatAgainst, tribeHolds } from '../map/contest';

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
    case 'quarry':
      g.append(el('polygon', { points: '-7,5 -5,-3 1,-5 7,-1 7,5', class: 'm-stone' }),
               el('line', { x1: -4, y1: 1, x2: 4, y2: 1, class: 'm-cut' }));
      break;
    case 'salt_spring':
      g.append(el('ellipse', { cx: 0, cy: 1, rx: 7, ry: 4, class: 'm-water' }),
               el('ellipse', { cx: 0, cy: 1, rx: 3.5, ry: 1.8, class: 'm-salt' }));
      break;
    case 'troop_field':
      for (let i = -1; i <= 1; i++) g.appendChild(el('line', { x1: i * 4, y1: 5, x2: i * 4 + 1, y2: -7, class: 'm-spear' }));
      g.appendChild(el('rect', { x: -6, y: 1, width: 12, height: 3, class: 'm-shield' }));
      break;
    case 'watchtower':
      g.append(el('rect', { x: -2.5, y: -7, width: 5, height: 12, class: 'm-wood' }),
               el('polygon', { points: '-4.5,-7 0,-11 4.5,-7', class: 'm-roof' }));
      break;
    case 'treasure':
      g.append(el('rect', { x: -5, y: -2, width: 10, height: 6, class: 'm-chest' }),
               el('circle', { cx: 0, cy: -3, r: 2, class: 'm-coin' }));
      break;
    case 'camp':
      g.append(el('polygon', { points: '0,-7 7,5 -7,5', class: 'm-camp' }),
               el('line', { x1: 0, y1: -9, x2: 0, y2: -2, class: 'm-spear' }));
      break;
  }
  return g;
}

/**
 * A holding's own mark (DESIGN §5.3), drawn in SVG and never painted: a camp is
 * a mark, a station a walled mark, a fort a walled mark with a tower.
 */
export function holdingMark(tier: number, size: number): SVGGElement {
  const g = el('g', { class: `holding tier-${tier}` });
  const r = size * 0.62;
  if (tier >= 2) {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    g.appendChild(el('polygon', { points: pts, class: 'h-wall' }));
  }
  if (tier >= 3) {
    g.append(el('rect', { x: r * 0.45, y: -r * 1.05, width: 5, height: 9, class: 'h-tower' }),
             el('polygon', { points: `${r * 0.45 - 1},${-r * 1.05} ${r * 0.45 + 2.5},${-r * 1.05 - 4} ${r * 0.45 + 6},${-r * 1.05}`, class: 'h-roof' }));
  }
  g.appendChild(el('line', { x1: -r * 0.55, y1: r * 0.55, x2: -r * 0.55, y2: -r * 0.2, class: 'h-pole' }));
  g.appendChild(el('polygon', { points: `${-r * 0.55},${-r * 0.2} ${-r * 0.55 + 6},${-r * 0.2 + 2} ${-r * 0.55},${-r * 0.2 + 4}`, class: 'h-flag' }));
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
      const known = isKnown(state, k);
      const spent = isSpentTreasure(state, k);
      const id = spent ? null : siteAt(state, k);
      const held = claimOf(state, k);
      const home = k === '0,0';
      const theirs = tribeHolds(state, k);
      const threat = threatAgainst(state, k);
      const stamp = [terrain, theirs ? `t${theirs.tribeId}` : '', threat ? `!${threat.resolveRound}` : '', known ? 's' : '', isScouted(state, k) ? 'x' : '', id ?? '', held ? `h${held.garrison}t${held.tier}` : '', state.map.works?.key === k ? 'w' : '', selected === k ? 'x' : '', state.map.pendingScout === k ? 'p' : ''].join('|');
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
      } else if (id && !known) {
        const t = el('text', { x: 0, y: 5, class: 'unknown' });
        t.textContent = '?';
        cell.marks.appendChild(t);
      } else if (id) {
        if (held) cell.marks.appendChild(holdingMark(held.tier ?? 1, size));
        if (theirs) {
          // taken by a tribe before the council could (§5.5): an opportunity gone
          const g = el('g', { class: 'tribe-held', 'data-tribe': theirs.tribeId });
          g.append(el('line', { x1: size * 0.35, y1: size * 0.45, x2: size * 0.35, y2: -size * 0.35, class: 'h-pole' }),
                   el('polygon', { points: `${size * 0.35},${-size * 0.35} ${size * 0.35 + 7},${-size * 0.25} ${size * 0.35},${-size * 0.12}`, class: 't-flag' }));
          cell.marks.appendChild(g);
        }
        if (threat) {
          const t = el('text', { x: -size * 0.5, y: -size * 0.3, class: 'threat' });
          t.textContent = '!';
          cell.marks.appendChild(t);
        }
        cell.marks.appendChild(siteGlyph(id));
        if (!isScouted(state, k) && !held) cell.poly.classList.add('seen');
        if (state.map.works?.key === k) {
          const t = el('text', { x: size * 0.55, y: -size * 0.45, class: 'rising' });
          t.textContent = '▲';
          cell.marks.appendChild(t);
        }
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
