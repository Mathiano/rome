/**
 * The colony at a glance (DESIGN §1: build the colonia through tiers; §4.4:
 * the Praetorium's tier is the colony's tier). Every figure is read through a
 * function that already exists — buildingTier, populationCap, standing,
 * defenceStrength, claimedProduction — and nothing is weighted or summed into
 * a score: DESIGN has no score, and a colony-wide tier total would be one in
 * disguise. No chart either; the first chart in the game is Mathias's call.
 *
 * The town is counted in cells (§4.5 C.1): how many of those inside the wall
 * are built on. The wall is named beside the count, never counted in it.
 */
import { config, researchNodes, tribeDef, type ResourceId } from '../data';
import type { GameState } from '../state/types';
import { buildingTier, colonyTier, populationCap } from '../village/storage';
import { cellCount, enclosure, freeCells } from '../village/grid';
import { claimedProduction, siteAt } from '../map/sites';
import { mapConfig } from '../map/world';
import { playerFamily, rivalFamilies, standing } from '../politics/characters';
import { defenceStrength, raidStrength } from '../combat/raids';
import { homeMilitia, militiaPool } from '../combat/militia';
import { esc, n, ROMAN } from './overview';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Cells inside the wall that are built on, of how many the wall encloses. */
export function cellsUsed(state: GameState): { used: number; total: number } {
  const total = cellCount(enclosure(state));
  return { used: total - freeCells(state), total };
}

/** The header's extra words: the wall, the plots, the holdings. */
export function colonyLine(state: GameState): string {
  const wall = buildingTier(state, 'wall');
  const c = cellsUsed(state);
  const held = state.map.claimed.length;
  return ` · ${wall ? `Wall ${ROMAN[wall]}` : 'no wall'} · ${c.used} of ${c.total} cells built on · ${held ? plural(held, 'holding') : 'no holdings'}`;
}

/** Scouted hexes that hold a site, against the sites the country has. */
export function sitesSeen(state: GameState): number {
  return state.map.scouted.filter((k) => siteAt(state, k)).length;
}

function row(label: string, value: string): string {
  return `<div class="row"><span>${label}</span><span>${value}</span></div>`;
}

/** A tribe's name mid-sentence: the data says "The Chatti". */
const midName = (id: string) => tribeDef(id).name.replace(/^The /, 'the ');

export function renderSummary(state: GameState): string {
  const forum = colonyTier(state);
  const wall = buildingTier(state, 'wall');
  const c = cellsUsed(state);
  const cap = populationCap(state);
  const stalled = state.resources.grain <= 0 ? ` <span class="stalled">— growth stalled, no grain</span>` : '';
  const yields = Object.entries(claimedProduction(state)).filter(([, v]) => v).map(([k, v]) => `${n(v ?? 0)} ${k as ResourceId}/h`);
  const held = state.map.claimed.length;
  const houses = [playerFamily(state), ...rivalFamilies(state)]
    .map((f) => `${esc(f.name)} ${n(standing(state, f.id))}${f.isPlayer ? ' <b>(yours)</b>' : ''}`)
    .join(' · ');
  const tribes = Object.values(state.tribes);
  const strongest = tribes.reduce((a, b) => (raidStrength(state, b) > raidStrength(state, a) ? b : a), tribes[0]);
  const arms = `${n(defenceStrength(state))} against ${esc(midName(strongest.id))}'s ${n(raidStrength(state, strongest))} · ${homeMilitia(state)} of ${militiaPool(state)} men at home`;

  return `<div class="card summary" data-summary>`
    + row('Colony', `Praetorium ${ROMAN[forum]} <span class="muted">— the colony's tier</span>`)
    + row('Wall', wall ? ROMAN[wall] : 'none raised')
    + row('Town', `${c.used} of ${c.total} cells built on, inside ${wall ? `a wall of tier ${ROMAN[wall]}` : 'the ditch and bank'}`)
    + row('Population', `${config.population.start} → ${Math.floor(state.population)} of ${cap}${stalled}`)
    + row('Holdings', held ? `${held}${yields.length ? `, yielding ${yields.join(', ')}` : ''}` : 'none')
    + row('Country', `${sitesSeen(state)} of ${mapConfig.siteCount} sites seen`)
    + row('Standing', houses)
    + row('Rome', `favour ${n(state.rome.favour)} · ${plural(state.rome.completedIds.length, 'request')} completed`)
    + row('Library', `${state.research.completed.length} of ${researchNodes.length} studies known`)
    + row('Walls', arms)
    + `</div>`;
}
