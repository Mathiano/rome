import { config, families as familyDefs, layout, startResources, posts, lesserPosts, activeTribes, RESOURCE_IDS } from '../data';
import type { GameState, Family, Character, Slot, LogEntry, TribeState } from './types';

export function createInitialState(now: number = Date.now(), seed: number = (now ^ 0x9e3779b9) | 0): GameState {
  const slots: Slot[] = layout.slots.map((s) => ({
    id: s.id,
    ring: s.ring,
    site: s.site,
    building: s.fixedBuilding ?? null,
    tier: 0,
  }));
  for (const b of layout.startBuilt) {
    const slot = slots.find((s) => s.id === b.slot)!;
    slot.building = b.building;
    slot.tier = b.tier;
  }

  const families: Record<string, Family> = {};
  const characters: Record<string, Character> = {};
  for (const f of familyDefs) {
    if (!f.active) continue;
    families[f.id] = {
      id: f.id,
      name: f.name,
      gensName: f.gensName,
      isPlayer: f.isPlayer,
      loyalist: !!f.loyalist,
      colour: f.colour,
      attitude: f.attitude,
      memberIds: f.members.map((m) => m.id),
      grievances: 0,
      demand: null,
      denounced: false,
    };
    for (const m of f.members) {
      characters[m.id] = {
        id: m.id,
        name: m.name,
        familyId: f.id,
        sex: m.sex,
        age: m.age,
        alive: true,
        isLeader: !!m.isLeader,
        stats: { ...m.stats },
        gravitas: 0,
        gravitasStock: 0,
        post: null,
        lesserPost: null,
        bodyguards: 0,
      };
    }
  }
  const playerLeader = Object.values(characters).find((c) => c.familyId === 'player' && c.isLeader)!;

  const state: GameState = {
    version: config.saveVersion,
    seed,
    createdAt: now,
    lastTick: now,
    lastRoundAt: now,
    round: 0,
    resources: { ...startResources },
    slots,
    constructions: [],
    population: config.population.start,
    recruitsSent: 0,
    militia: { garrisons: 0, bodyguards: 0 },
    families,
    characters,
    posts: Object.fromEntries(posts.map((p) => [p.id, null])),
    lesserPosts: Object.fromEntries(lesserPosts.map((p) => [p.id, null])),
    office: playerLeader.id,
    challenge: null,
    lastChallengeRound: -999,
    lastAssassinationRound: -999,
    corruption: 0,
    obstructed: {},
    tribes: Object.fromEntries(activeTribes().map((t) => [t.id, {
      id: t.id,
      fear: t.start.fear,
      trust: t.start.trust,
      strength: t.strength,
      tradeOpen: false,
      allied: false,
      hostagesUntilRound: 0,
      leakedUntilRound: 0,
      massingForRound: -999,
      lastRaidRound: -999,
      pendingEnvoy: null,
    }])),
    map: {
      seed: (seed ^ 0x5bf03635) | 0,
      scouted: [],
      claimed: [],
      pendingScout: null,
    },
    rome: {
      favour: config.rome.startFavour,
      activeRequestId: null,
      activeRequest: null,
      completedIds: [],
      declinedIds: [],
      progressionIndex: 0,
      fillerCounter: 0,
      scrolls: 0,
      unlocks: [],
      withheldUnlocks: [],
      administeringUntilRound: 0,
      hostingUntilRound: 0,
    },
    log: [],
    logSeq: 0,
    seenLogId: 0,
    lastReport: null,
    pendingChoice: null,
    awayRounds: 0,
    stats: emptyStats(),
  };
  log(state, 'system', `${config.townName} is founded. ${playerLeader.name} holds the office of ${config.topOffice.title}.`);
  return state;
}

export function emptyStats() {
  return {
    rounds: 0, idleRounds: 0, raidsSuffered: 0, raidsRepelled: 0, goodsLostToRaids: 0, deaths: 0,
    demandsGranted: 0, demandsRefused: 0, choicesAnswered: 0, romeRequestsCompleted: 0,
    romeRequestsDeclined: 0, peakPopulation: 0, denariiSpentOnHaste: 0,
    challengesFaced: 0, challengesWon: 0, roundsOutOfOffice: 0, assassinationsOrdered: 0,
    assassinationsSucceeded: 0, marriages: 0, exiles: 0,
    sitesClaimed: 0, sitesLost: 0, siteRaidsRepelled: 0, scoutsLost: 0,
  };
}

export function log(state: GameState, kind: LogEntry['kind'], text: string): void {
  state.logSeq = (state.logSeq ?? 0) + 1;
  state.log.push({ id: state.logSeq, round: state.round, at: state.lastTick, kind, text });
  if (state.log.length > config.log.max) state.log.splice(0, state.log.length - config.log.max);
}

export const SAVE_KEY = 'rome.save.v1';

export function serialise(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialise(json: string): GameState {
  const raw = JSON.parse(json) as Partial<GameState>;
  if (typeof raw !== 'object' || raw === null || typeof raw.version !== 'number') {
    throw new Error('Not a save file');
  }
  return migrate(raw as GameState);
}

// Forward migrations live here. v1 is the first save format.
export function migrate(state: GameState): GameState {
  for (const id of RESOURCE_IDS) {
    if (typeof state.resources[id] !== 'number') state.resources[id] = 0;
  }
  // New posts added in data after a save was made appear as vacant.
  for (const p of posts) if (!(p.id in state.posts)) state.posts[p.id] = null;
  // v1 saves predate the report and digest; give their log entries ids.
  if (typeof state.logSeq !== 'number') {
    state.logSeq = 0;
    for (const e of state.log) e.id = ++state.logSeq;
    state.seenLogId = state.logSeq;
    state.lastReport = null;
    state.awayRounds = 0;
  }
  if (state.pendingChoice === undefined) state.pendingChoice = null;
  if (!state.lesserPosts) state.lesserPosts = {};
  for (const p of lesserPosts) if (!(p.id in state.lesserPosts)) state.lesserPosts[p.id] = null;
  for (const c of Object.values(state.characters)) if (c.lesserPost === undefined) c.lesserPost = null;
  if (!state.stats) state.stats = emptyStats();
  else state.stats = { ...emptyStats(), ...state.stats };
  if (!state.rome.withheldUnlocks) state.rome.withheldUnlocks = [];
  // Saves from before the other two tribes woke up carry a single `tribe`.
  const legacy = (state as unknown as { tribe?: TribeState }).tribe;
  if (!state.tribes) state.tribes = {};
  if (legacy && !state.tribes[legacy.id]) state.tribes[legacy.id] = legacy;
  delete (state as unknown as { tribe?: TribeState }).tribe;
  for (const t of activeTribes()) {
    if (state.tribes[t.id]) continue;
    state.tribes[t.id] = {
      id: t.id, fear: t.start.fear, trust: t.start.trust, strength: t.strength,
      tradeOpen: false, allied: false, hostagesUntilRound: 0, leakedUntilRound: 0,
      massingForRound: -999, lastRaidRound: -999, pendingEnvoy: null,
    };
  }
  for (const c of Object.values(state.characters)) if (c.bodyguards === undefined) c.bodyguards = 0;
  if (state.challenge === undefined) state.challenge = null;
  if (state.lastChallengeRound === undefined) state.lastChallengeRound = -999;
  if (state.lastAssassinationRound === undefined) state.lastAssassinationRound = -999;
  if (!state.map) {
    state.map = { seed: (state.seed ^ 0x5bf03635) | 0, scouted: [], claimed: [], pendingScout: null };
  }
  for (const t of Object.values(state.tribes)) {
    if (t.massingForRound === undefined) t.massingForRound = -999;
  }
  for (const f of Object.values(state.families)) {
    if (f.grievances === undefined) f.grievances = 0;
    if (f.demand === undefined) f.demand = null;
    if (f.denounced === undefined) f.denounced = false;
  }
  state.version = config.saveVersion;
  return state;
}

export function saveToLocalStorage(state: GameState, key: string = SAVE_KEY): boolean {
  try {
    globalThis.localStorage?.setItem(key, serialise(state));
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocalStorage(key: string = SAVE_KEY): GameState | null {
  try {
    const json = globalThis.localStorage?.getItem(key);
    return json ? deserialise(json) : null;
  } catch {
    return null;
  }
}

export function clearLocalStorage(key: string = SAVE_KEY): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
