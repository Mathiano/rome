import type { ResourceId, StatId, Ring } from '../data';

export type Resources = Record<ResourceId, number>;

export interface Slot {
  id: string;
  ring: Ring;
  site?: string;
  building: string | null;
  tier: number;
}

export interface Construction {
  slotId: string;
  buildingId: string;
  toTier: number;
  kind: 'building' | 'field';
  startedAt: number;
  finishAt: number;
}

export interface Character {
  id: string;
  name: string;
  familyId: string;
  sex: 'm' | 'f';
  age: number; // rounds
  alive: boolean;
  isLeader: boolean;
  stats: Record<StatId, number>;
  gravitas: number; // cumulative — rank is derived from this
  gravitasStock: number; // spendable
  post: string | null;
  lesserPost: string | null;
  /** Men from the militia pool standing over this one (DESIGN §8.1, §9.2). */
  bodyguards: number;
  spouseId?: string;
  exiled?: boolean;
  /** Gone with his house when it left the colony (DESIGN §9.7). Alive, but not here. */
  departed?: boolean;
  causeOfDeath?: string;
}

/** What a rival house has asked of the player, and by when. */
export interface Demand {
  kind: 'post' | 'denarii';
  postId?: string;
  denarii?: number;
  issuedRound: number;
  dueRound: number;
}

export interface Family {
  id: string;
  name: string;
  gensName: string;
  isPlayer: boolean;
  loyalist: boolean;
  colour: string;
  attitude: number; // toward the player, -100..100
  memberIds: string[];
  /** Refusals and slights remembered. Drives how far the house will go. */
  grievances: number;
  demand: Demand | null;
  denounced: boolean;
  /** The round the house left the colony (DESIGN §9.7), or null while it is here. */
  departedRound: number | null;
  /** Consecutive rounds the house has met the terms for leaving. */
  sourRounds: number;
}

export interface TribeState {
  id: string;
  fear: number;
  trust: number;
  strength: number;
  tradeOpen: boolean;
  allied: boolean;
  hostagesUntilRound: number;
  leakedUntilRound: number;
  /** The round a raid will land on, once scouts have seen them massing. */
  massingForRound: number;
  lastRaidRound: number;
  pendingEnvoy: string | null;
}

export interface RomeState {
  favour: number;
  activeRequestId: string | null;
  activeRequest: ActiveRequest | null;
  completedIds: string[];
  declinedIds: string[];
  progressionIndex: number;
  fillerCounter: number;
  scrolls: number;
  unlocks: string[];
  /** Rewards Rome has promised but is holding back until favour recovers. */
  withheldUnlocks: string[];
  administeringUntilRound: number;
  hostingUntilRound: number;
}

export interface ActiveRequest {
  id: string;
  title: string;
  text: string;
  kind: 'deliver' | 'build' | 'recruits' | 'host';
  deliver?: Partial<Resources>;
  build?: { building: string; tier: number };
  recruits?: number;
  hostCost?: number;
  reward: { denarii?: number; scrolls?: number; unlock?: string; gravitas?: number };
  delivered: Partial<Resources>;
  fulfilled: boolean; // waiting for Rome's turn to reward
  issuedRound: number;
}

export interface LogEntry {
  id: number;
  round: number;
  at: number;
  kind: 'village' | 'council' | 'tribe' | 'rome' | 'raid' | 'event' | 'family' | 'map' | 'system';
  text: string;
}

/** What a round produced, for the report the player is shown afterwards. */
export interface RoundReport {
  round: number;
  at: number;
  idle: boolean;
  fromLogId: number;
  population: number;
  corruption: number;
  resources: Resources;
}

/** Counters a playtester can quote back without keeping notes. */
export interface PlaytestStats {
  rounds: number;
  idleRounds: number;
  raidsSuffered: number;
  raidsRepelled: number;
  goodsLostToRaids: number;
  deaths: number;
  demandsGranted: number;
  demandsRefused: number;
  choicesAnswered: number;
  romeRequestsCompleted: number;
  romeRequestsDeclined: number;
  peakPopulation: number;
  denariiSpentOnHaste: number;
  challengesFaced: number;
  challengesWon: number;
  roundsOutOfOffice: number;
  assassinationsOrdered: number;
  assassinationsSucceeded: number;
  marriages: number;
  exiles: number;
  adoptions: number;
  secessions: number;
  sitesClaimed: number;
  sitesLost: number;
  siteRaidsRepelled: number;
  scoutsLost: number;
  researchCompleted: number;
}

/** One thing the Library is working on (DESIGN §4.6). */
export interface ResearchProgress {
  id: string;
  startedAt: number;
  finishAt: number;
}

/** Research is only ever added to: it survives every setback (Pillar 7). */
export interface ResearchState {
  active: ResearchProgress[];
  completed: string[];
}

/** A site the colony holds (DESIGN §5.3). */
export interface ClaimedSite {
  key: string;
  siteId: string;
  garrison: number;
  claimedRound: number;
}

export interface MapState {
  /** Fixed at founding. Terrain and sites are derived from it, never stored. */
  seed: number;
  scouted: string[];
  claimed: ClaimedSite[];
  /** Dispatched now, resolves at the next round (DESIGN §3.2). */
  pendingScout: string | null;
}

/** A forced vote on the top office (DESIGN §9.5). */
export interface Challenge {
  callerFamilyId: string;
  calledRound: number;
  voteRound: number;
  candidates: Record<string, string>;
  result?: { winnerId: string; tally: Record<string, number>; held: boolean };
}

export interface GameState {
  version: number;
  seed: number;
  createdAt: number;
  lastTick: number;
  lastRoundAt: number;
  round: number;
  resources: Resources;
  slots: Slot[];
  constructions: Construction[];
  population: number;
  recruitsSent: number;
  militia: { garrisons: number; bodyguards: number };
  families: Record<string, Family>;
  characters: Record<string, Character>;
  posts: Record<string, string | null>;
  /** Offices outside the council: standing without leverage (DESIGN §9.3). */
  lesserPosts: Record<string, string | null>;
  office: string | null;
  research: ResearchState;
  challenge: Challenge | null;
  lastChallengeRound: number;
  lastAssassinationRound: number;
  corruption: number;
  obstructed: Record<string, number>; // domain -> until round
  tribes: Record<string, TribeState>;
  map: MapState;
  rome: RomeState;
  log: LogEntry[];
  logSeq: number;
  /** Highest log id the player has acknowledged. Anything above it is news. */
  seenLogId: number;
  /** The founding card is shown once, not again after every village action. */
  seenOpening: boolean;
  lastReport: RoundReport | null;
  /** An event waiting on the player's answer. Nothing else is blocked by it. */
  pendingChoice: { eventId: string; title: string; text: string } | null;
  /** Rounds that ran while the player was away, pending a digest. */
  awayRounds: number;
  /** Local playtest record. Never read by the game; written for the Save tab. */
  stats: PlaytestStats;
}
