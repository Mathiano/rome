import { config, tribeDef, building } from '../data';
import type { GameState, TribeState } from '../state/types';
import { log } from '../state/store';
import { clampToCapacity, buildingTier } from '../village/storage';
import { canAfford, pay } from '../village/economy';
import { claimedEffect } from '../map/sites';
import { researchEffect } from '../village/storage';

const T = () => config.tribe;

export function tribeState(state: GameState, id: string): TribeState {
  const t = state.tribes[id];
  if (!t) throw new Error(`unknown tribe ${id}`);
  return t;
}

/**
 * Tribes watch each other (DESIGN §7). Warming to one cools those who hate it
 * and warms those who like it, so there is no way to be everyone's friend.
 */
export function propagateWeb(state: GameState, id: string, trustDelta: number, share = config.tribe.webShare): void {
  if (!trustDelta) return;
  const def = tribeDef(id);
  for (const other of Object.values(state.tribes)) {
    if (other.id === id) continue;
    const likes = def.likes.includes(other.id) || tribeDef(other.id).likes.includes(id);
    const hates = def.hates.includes(other.id) || tribeDef(other.id).hates.includes(id);
    if (!likes && !hates) continue;
    const move = trustDelta * share * (likes ? 1 : -1);
    other.trust = clamp(other.trust + move);
    if (hates && trustDelta > 0) other.fear = clamp(other.fear + move * -0.5);
  }
}

export function dispatchEnvoy(state: GameState, tribeId: string, envoyId: string): void {
  const t = tribeState(state, tribeId);
  if (t.pendingEnvoy) throw new Error('An envoy is already on the road');
  if (envoyId === 'invite_festival') {
    if (!canAfford(state, T().festivalCost)) throw new Error('Not enough for a festival');
    pay(state, T().festivalCost);
  }
  t.pendingEnvoy = envoyId;
  log(state, 'tribe', `An envoy sets out for ${tribeDef(tribeId).name}: ${envoyId.replace(/_/g, ' ')}.`);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Resolves at the tribe's step of the next round (DESIGN §3.2). */
export function resolveEnvoy(state: GameState, t: TribeState): void {
  const id = t.pendingEnvoy;
  if (!id) return;
  t.pendingEnvoy = null;
  const def = tribeDef(t.id);
  const c = T();
  const trustBefore = t.trust;
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
        propagateWeb(state, t.id, config.tribe.allianceTrustThreshold, config.tribe.allianceWebShare);
        log(state, 'tribe', `${def.name} swear alliance. They will not raid an ally, and their enemies have noticed.`);
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
  propagateWeb(state, t.id, t.trust - trustBefore);
}

/** Trade at the market once a trade agreement exists: give `wants`, receive `gives` at the tribe's ratio, improved by market tier. */
export function tradeRate(state: GameState, tribeId: string): number {
  const def = tribeDef(tribeId);
  const market = buildingTier(state, 'market');
  const marketRate = market > 0 ? building('market').tiers[market - 1].effects.tradeRate : def.trade.ratio;
  // Holding the ford sharpens the rate beyond what the market alone can do.
  return Math.max(1, Math.max(def.trade.ratio, marketRate) + claimedEffect(state, 'tradeRate') + researchEffect(state, 'tradeRate'));
}

export function trade(state: GameState, tribeId: string, amountWanted: number): void {
  const t = tribeState(state, tribeId);
  if (!t.tradeOpen) throw new Error('No trade agreement');
  const def = tribeDef(tribeId);
  const rate = tradeRate(state, tribeId);
  const give = Math.ceil(amountWanted * rate);
  if (state.resources[def.trade.wants] < give) throw new Error(`Not enough ${def.trade.wants}`);
  state.resources[def.trade.wants] -= give;
  state.resources[def.trade.gives] += amountWanted;
  clampToCapacity(state);
  log(state, 'tribe', `Traded ${give} ${def.trade.wants} for ${amountWanted} ${def.trade.gives}.`);
}
