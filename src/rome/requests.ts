import { config, requestProgression, requestFiller, unlocks, type ResourceId } from '../data';
import type { GameState, ActiveRequest } from '../state/types';
import { log } from '../state/store';
import { pick } from '../state/rng';
import { buildingTier, forumTier, sumEffect } from '../village/storage';
import { canAfford, pay } from '../village/economy';
import { militiaPool } from '../combat/militia';
import { gainGravitas, leaderOf, playerFamily } from '../politics/characters';
import { clampAtt } from '../politics/posts';

function loyalist(state: GameState) {
  return Object.values(state.families).find((f) => f.loyalist && !f.isPlayer) ?? null;
}

/** Rome's turn (DESIGN §3.2 step 4): reward fulfilled requests, issue the next one. */
export function romeTurn(state: GameState): void {
  const r = state.rome;
  if (r.activeRequest) {
    const a = r.activeRequest;
    if (a.kind === 'build' && a.build && buildingTier(state, a.build.building) >= a.build.tier) a.fulfilled = true;
    if (a.kind === 'host' && r.hostingUntilRound > 0 && state.round >= r.hostingUntilRound) a.fulfilled = true;
    if (a.fulfilled) {
      grantReward(state, a);
      r.completedIds.push(a.id);
      r.activeRequest = null;
      r.activeRequestId = null;
      r.hostingUntilRound = 0;
      return; // one thing per turn; the next request arrives next round
    }
    return;
  }
  if (r.administeringUntilRound > state.round) return;
  issueNext(state);
}

export function issueNext(state: GameState): void {
  const r = state.rome;
  const progressionNext = requestProgression[r.progressionIndex];
  const useFiller = r.fillerCounter > 0 && r.fillerCounter % config.rome.fillerEveryRounds === 0 && progressionNext;
  r.fillerCounter += 1;
  let req: ActiveRequest;
  if (progressionNext && !useFiller) {
    req = { ...progressionNext, delivered: {}, fulfilled: false, issuedRound: state.round };
    r.progressionIndex += 1;
  } else {
    const tier = Math.max(1, forumTier(state));
    const f = pick(state, requestFiller);
    const deliver: Partial<Record<ResourceId, number>> = {};
    for (const [k, v] of Object.entries(f.deliverPerTier ?? {})) deliver[k as ResourceId] = (v ?? 0) * tier;
    const reward = {
      denarii: (f.rewardPerTier.denarii ?? 0) * tier,
      gravitas: (f.rewardPerTier.gravitas ?? 0) * tier,
    };
    req = {
      id: `${f.id}_${state.round}`,
      title: f.title,
      text: f.text,
      kind: f.kind,
      deliver: f.kind === 'deliver' ? deliver : undefined,
      recruits: f.kind === 'recruits' ? (f.recruitsPerTier ?? 0) * tier : undefined,
      reward,
      delivered: {},
      fulfilled: false,
      issuedRound: state.round,
    };
  }
  r.activeRequest = req;
  r.activeRequestId = req.id;
  log(state, 'rome', `Rome asks: ${req.title}. ${req.text}`);
}

function grantReward(state: GameState, a: ActiveRequest): void {
  const mult = 1 + sumEffect(state, 'romeRewardMultiplier');
  const parts: string[] = [];
  if (a.reward.denarii) {
    const d = Math.round(a.reward.denarii * mult);
    state.resources.denarii += d;
    parts.push(`${d} denarii`);
  }
  if (a.reward.scrolls) {
    state.rome.scrolls += a.reward.scrolls;
    parts.push(`${a.reward.scrolls} research scroll${a.reward.scrolls > 1 ? 's' : ''}`);
  }
  const leader = leaderOf(state, playerFamily(state).id);
  if (a.reward.gravitas && leader) {
    gainGravitas(leader, a.reward.gravitas);
    parts.push(`${a.reward.gravitas} gravitas`);
  }
  if (a.reward.unlock) {
    const u = unlocks[a.reward.unlock];
    if (u && !state.rome.unlocks.includes(a.reward.unlock)) {
      state.rome.unlocks.push(a.reward.unlock);
      if (u.gravitas && leader) gainGravitas(leader, u.gravitas);
      parts.push(u.name);
    }
  }
  state.rome.favour += 5;
  const loy = loyalist(state);
  if (loy) loy.attitude = clampAtt(loy.attitude + 3);
  log(state, 'rome', `Rome is pleased with "${a.title}" and sends ${parts.join(', ') || 'its thanks'}.`);
}

/** Player delivers what is owed. Real-time: resources leave now; Rome rewards on its turn. */
export function deliver(state: GameState): void {
  const a = state.rome.activeRequest;
  if (!a || a.kind !== 'deliver' || !a.deliver) throw new Error('Nothing to deliver');
  const owed: Partial<Record<ResourceId, number>> = {};
  for (const [k, v] of Object.entries(a.deliver)) {
    const remaining = (v ?? 0) - (a.delivered[k as ResourceId] ?? 0);
    if (remaining > 0) owed[k as ResourceId] = remaining;
  }
  if (!canAfford(state, owed)) throw new Error('Not enough in store');
  pay(state, owed);
  for (const [k, v] of Object.entries(owed)) a.delivered[k as ResourceId] = (a.delivered[k as ResourceId] ?? 0) + (v ?? 0);
  a.fulfilled = true;
  log(state, 'rome', `The goods for "${a.title}" set out for the Rhine.`);
}

export function sendRecruits(state: GameState): void {
  const a = state.rome.activeRequest;
  if (!a || a.kind !== 'recruits' || !a.recruits) throw new Error('No recruits asked for');
  if (militiaPool(state) < a.recruits) throw new Error('Not enough militia');
  if (state.population <= a.recruits) throw new Error('Not enough people');
  state.population -= a.recruits;
  state.recruitsSent += a.recruits;
  a.fulfilled = true;
  log(state, 'rome', `${a.recruits} men march west to join the auxilia.`);
}

export function hostOfficial(state: GameState): void {
  const a = state.rome.activeRequest;
  if (!a || a.kind !== 'host') throw new Error('No one to host');
  const cost = a.hostCost ?? 0;
  if (state.resources.denarii < cost) throw new Error('Not enough denarii');
  if (state.rome.hostingUntilRound > 0) throw new Error('Already hosting');
  state.resources.denarii -= cost;
  state.rome.hostingUntilRound = state.round + config.rome.hostOfficialRounds;
  log(state, 'rome', `You spend ${cost} denarii to receive Rome's guest. They stay ${config.rome.hostOfficialRounds} rounds.`);
}

/** Ignoring Rome: no punishment, only forgone aid and a cooler loyalist (DESIGN §6). */
export function decline(state: GameState): void {
  const a = state.rome.activeRequest;
  if (!a) throw new Error('No request');
  state.rome.declinedIds.push(a.id);
  state.rome.activeRequest = null;
  state.rome.activeRequestId = null;
  state.rome.hostingUntilRound = 0;
  state.rome.favour += config.rome.declineFavour;
  const loy = loyalist(state);
  if (loy) loy.attitude = clampAtt(loy.attitude + config.rome.declineLoyalistAttitude);
  log(state, 'rome', `You let "${a.title}" go unanswered. Rome says nothing; the ${loy?.name ?? 'loyalists'} notice.`);
}

/** Rome steps in when the colony collapses (DESIGN §1, §6). A soft reset, never a loss. */
export function checkCollapse(state: GameState): boolean {
  const c = config.collapse;
  if (state.rome.administeringUntilRound > state.round) return false;
  if (state.population > c.populationFloor && state.corruption < c.corruptionCeiling) return false;
  state.rome.administeringUntilRound = state.round + c.administrationRounds;
  state.corruption = 0;
  for (const k of Object.keys(c.grant) as ResourceId[]) state.resources[k] += c.grant[k as keyof typeof c.grant];
  for (const pid of Object.keys(state.posts)) {
    const h = state.posts[pid];
    if (h) state.characters[h].post = null;
    state.posts[pid] = null;
  }
  state.population = Math.max(state.population, c.populationFloor * 2);
  log(state, 'rome', `The colony has collapsed. A procurator from Rome administers ${config.townName} for ${c.administrationRounds} rounds and clears the council. Research and your house survive.`);
  return true;
}
