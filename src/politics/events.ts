import { config, events as eventDefs, activeTribe, type EventEffect, type EventChoice, type ResourceId } from '../data';
import type { GameState } from '../state/types';
import { chance, pick, weighted } from '../state/rng';
import { log } from '../state/store';
import { gainGravitas, kill, rivalFamilies } from './characters';
import { clampAtt } from './posts';
import { clampToCapacity, populationCap } from '../village/storage';
import { canAfford, pay } from '../village/economy';

const RESOURCE_KEYS: ResourceId[] = ['wood', 'clay', 'iron', 'grain', 'denarii'];

/**
 * Applies a bag of deltas. Everything an event can touch goes through here, so
 * adding an outcome to data/events.json never needs a new branch in code.
 */
export function applyEffect(state: GameState, e: EventEffect, targetId?: string): void {
  for (const k of RESOURCE_KEYS) {
    if (typeof e[k] === 'number') state.resources[k] += e[k] as number;
  }
  if (typeof e.population === 'number') {
    state.population = Math.max(1, Math.min(populationCap(state), state.population + e.population));
  }
  if (typeof e.attitude === 'number') {
    for (const f of rivalFamilies(state)) f.attitude = clampAtt(f.attitude + e.attitude);
  }
  if (typeof e.grievance === 'number') {
    for (const f of rivalFamilies(state)) f.grievances = Math.max(0, f.grievances + e.grievance);
  }
  if (typeof e.gravitas === 'number' && targetId) {
    const c = state.characters[targetId];
    if (c?.alive) gainGravitas(c, e.gravitas);
  }
  if (typeof e.corruption === 'number') {
    state.corruption = Math.max(config.corruption.min, Math.min(config.corruption.max, state.corruption + e.corruption));
  }
  if (typeof e.fear === 'number') state.tribe.fear = Math.max(0, Math.min(100, state.tribe.fear + e.fear));
  if (typeof e.trust === 'number') state.tribe.trust = Math.max(0, Math.min(100, state.tribe.trust + e.trust));
  if (typeof e.romeFavour === 'number') state.rome.favour += e.romeFavour;
  clampToCapacity(state);
}

function fill(text: string, state: GameState, name: string): string {
  const rival = rivalFamilies(state)[0];
  return text.replace('{name}', name).replace('{rival}', rival ? rival.name : 'other house');
}

export function rollEvent(state: GameState): void {
  if (state.pendingChoice) return; // one decision at a time
  if (!chance(state, config.events.chancePerRound)) return;
  const ev = weighted(state, eventDefs);
  const living = Object.values(state.characters).filter((c) => c.alive);
  const target = pick(state, living);
  const text = fill(ev.text, state, target?.name ?? 'someone');

  if (ev.choices?.length) {
    state.pendingChoice = { eventId: ev.id, title: ev.title, text };
    log(state, 'event', `${ev.title}: ${text}`);
    return;
  }
  const e = ev.effect ?? {};
  if (typeof e.illness === 'number') {
    log(state, 'event', `${ev.title}: ${text}`);
    if (target && chance(state, e.illness)) kill(state, target, ev.title.toLowerCase());
    else log(state, 'event', `${target?.name ?? 'The patient'} recovers.`);
    return;
  }
  applyEffect(state, e, target?.id);
  log(state, 'event', `${ev.title}: ${text}`);
  void activeTribe;
}

export function pendingChoices(state: GameState): EventChoice[] {
  if (!state.pendingChoice) return [];
  return eventDefs.find((e) => e.id === state.pendingChoice!.eventId)?.choices ?? [];
}

/** Answer the outstanding event. Immediate: the round already happened. */
export function resolveChoice(state: GameState, choiceId: string): void {
  const choice = pendingChoices(state).find((c) => c.id === choiceId);
  if (!choice) throw new Error('No such choice');
  if (choice.cost && !canAfford(state, choice.cost)) throw new Error('You cannot pay for that');
  if (choice.cost) pay(state, choice.cost);
  applyEffect(state, choice.effect);
  log(state, 'event', fill(choice.text, state, ''));
  state.stats.choicesAnswered += 1;
  state.pendingChoice = null;
}
