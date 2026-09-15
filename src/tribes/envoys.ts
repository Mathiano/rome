import { config, activeTribe, building } from '../data';
import type { GameState } from '../state/types';
import { log } from '../state/store';
import { clampToCapacity, buildingTier } from '../village/storage';
import { canAfford, pay } from '../village/economy';

const T = () => config.tribe;

export function dispatchEnvoy(state: GameState, envoyId: string): void {
  if (state.tribe.pendingEnvoy) throw new Error('An envoy is already on the road');
  if (envoyId === 'invite_festival') {
    if (!canAfford(state, T().festivalCost)) throw new Error('Not enough for a festival');
    pay(state, T().festivalCost);
  }
  state.tribe.pendingEnvoy = envoyId;
  log(state, 'tribe', `An envoy sets out for ${activeTribe().name}: ${envoyId.replace(/_/g, ' ')}.`);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Resolves at the tribe's step of the next round (DESIGN §3.2). */
export function resolveEnvoy(state: GameState): void {
  const id = state.tribe.pendingEnvoy;
  if (!id) return;
  state.tribe.pendingEnvoy = null;
  const t = state.tribe;
  const def = activeTribe();
  const c = T();
  switch (id) {
    case 'demand_tribute':
      if (t.fear >= c.tributeFearThreshold) {
        state.resources[def.trade.gives] += c.tributeAmount;
        clampToCapacity(state);
        t.trust = clamp(t.trust - 2);
        log(state, 'tribe', `${def.name} pay tribute: ${c.tributeAmount} ${def.trade.gives}.`);
      } else {
        t.trust = clamp(t.trust + c.tributeRefusalTrust);
        log(state, 'tribe', `${def.name} laugh at the demand for tribute. Trust falls.`);
      }
      break;
    case 'offer_trade':
      if (buildingTier(state, 'market') < 1) {
        log(state, 'tribe', `${def.name} would trade, but you have no ${building('market').name}.`);
      } else {
        t.tradeOpen = true;
        t.trust = clamp(t.trust + c.tradeTrust);
        log(state, 'tribe', `${def.name} agree to trade ${def.trade.gives} for ${def.trade.wants} at the market.`);
      }
      break;
    case 'propose_alliance':
      if (t.trust >= c.allianceTrustThreshold && t.fear <= c.allianceFearThreshold) {
        t.allied = true;
        log(state, 'tribe', `${def.name} swear alliance. They will not raid an ally.`);
      } else {
        t.trust = clamp(t.trust + c.allianceRefusalTrust);
        log(state, 'tribe', `${def.name} are not ready for an alliance.`);
      }
      break;
    case 'ask_hostages':
      if (t.fear >= c.hostageFearThreshold) {
        t.hostagesUntilRound = state.round + c.hostageRaidSuppressionRounds;
        log(state, 'tribe', `${def.name} send the sons of two chiefs. No raids for ${c.hostageRaidSuppressionRounds} rounds.`);
      } else {
        t.trust = clamp(t.trust + c.hostageRefusalTrust);
        log(state, 'tribe', `${def.name} refuse hostages and take offence.`);
      }
      break;
    case 'warn_of_raid':
      t.fear = clamp(t.fear + c.warnFear);
      t.trust = clamp(t.trust + c.warnTrust);
      log(state, 'tribe', `Your envoy shows ${def.name} the walls and the men on them. Fear rises.`);
      break;
    case 'invite_festival':
      t.trust = clamp(t.trust + c.festivalTrust);
      t.fear = clamp(t.fear + c.festivalFear);
      log(state, 'tribe', `${def.name} feast with the colony. Trust rises.`);
      break;
  }
}

/** Trade at the market once a trade agreement exists: give `wants`, receive `gives` at the tribe's ratio, improved by market tier. */
export function tradeRate(state: GameState): number {
  const def = activeTribe();
  const market = buildingTier(state, 'market');
  const marketRate = market > 0 ? building('market').tiers[market - 1].effects.tradeRate : def.trade.ratio;
  return Math.max(def.trade.ratio, marketRate);
}

export function trade(state: GameState, amountWanted: number): void {
  if (!state.tribe.tradeOpen) throw new Error('No trade agreement');
  const def = activeTribe();
  const rate = tradeRate(state);
  const give = Math.ceil(amountWanted * rate);
  if (state.resources[def.trade.wants] < give) throw new Error(`Not enough ${def.trade.wants}`);
  state.resources[def.trade.wants] -= give;
  state.resources[def.trade.gives] += amountWanted;
  clampToCapacity(state);
  log(state, 'tribe', `Traded ${give} ${def.trade.wants} for ${amountWanted} ${def.trade.gives}.`);
}
