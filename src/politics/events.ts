import { config, events as eventDefs } from '../data';
import type { GameState } from '../state/types';
import { chance, pick, weighted } from '../state/rng';
import { log } from '../state/store';
import { gainGravitas, kill, playerFamily } from './characters';
import { clampAtt } from './posts';
import { clampToCapacity, populationCap } from '../village/storage';

export function rollEvent(state: GameState): void {
  if (!chance(state, config.events.chancePerRound)) return;
  const ev = weighted(state, eventDefs);
  const living = Object.values(state.characters).filter((c) => c.alive);
  const target = pick(state, living);
  const text = ev.text.replace('{name}', target?.name ?? 'someone');
  const e = ev.effect;
  switch (e.type) {
    case 'illness':
      log(state, 'event', `${ev.title}: ${text}`);
      if (target && chance(state, Number(e.deathChance))) kill(state, target, ev.title.toLowerCase());
      else log(state, 'event', `${target?.name ?? 'The patient'} recovers.`);
      return;
    case 'resources':
      for (const k of ['wood', 'clay', 'iron', 'grain', 'denarii'] as const) {
        if (typeof e[k] === 'number') state.resources[k] += e[k] as number;
      }
      clampToCapacity(state);
      break;
    case 'gravitas':
      if (target) gainGravitas(target, Number(e.amount));
      break;
    case 'attitude':
      for (const f of Object.values(state.families)) if (!f.isPlayer) f.attitude = clampAtt(f.attitude + Number(e.amount));
      break;
    case 'population':
      state.population = Math.max(1, Math.min(populationCap(state), state.population + Number(e.amount)));
      break;
  }
  void playerFamily;
  log(state, 'event', `${ev.title}: ${text}`);
}
