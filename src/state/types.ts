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
  /**
   * The ledger (reports unit): the colony as it stood when the round began, so
   * the card can show before → after. A round runs in one synchronous call, so
   * the two are exact. Absent on a report saved before the ledger existed.
   */
  before?: { resources: Resources; population: number; corruption: number };
  /** The last log id the round wrote; lines above it belong to the next round. */
  toLogId?: number;
  /** Cheap derivations at round end, for the history table on the Save tab. */
  standing?: number;
  forumTier?: number;
  buildingsRaised?: number;
  claimed?: number;
}

// ---------------------------------------------------------------- reports
/**
 * A report is the record of something another actor did to the colony, with
 * the numbers the prose line was made from (reports unit). Each report is
 * written by the same call as its log line and points at it by `logId`, so
 * the two never drift and `seenLogId` is the one cursor for both.
 */
export type ReportKind = 'raid' | 'site_raid' | 'scout' | 'envoy' | 'challenge' | 'rome' | 'collapse';

/** The named terms of DESIGN §8.2, each with its multiplier already folded in. */
export interface DefenceBreakdown {
  ditch: number;
  wall: number;
  militia: number;
  garrison: number;
  engines: number;
  lesser: number;
  total: number;
  men: { home: number; garrisons: number; bodyguards: number };
  prefectId: string | null;
  obstructed: boolean;
}

export interface GoodsLine { stored: number; hidden: number; exposed: number; lost: number }

export interface RaidReportData {
  tribeId: string;
  raid: number;
  defence: DefenceBreakdown;
  fraction: number;
  goods: Partial<Record<ResourceId, GoodsLine>>;
  fear: { before: number; after: number };
  fellId: string | null;
}

export interface SiteRaidReportData {
  tribeId: string;
  siteId: string;
  hex: string;
  garrison: number;
  defence: number;
  attack: number;
  held: boolean;
  menLost: number;
  fear: { before: number; after: number };
}

export interface ScoutReportData {
  hex: string;
  ring: number;
  siteId: string | null;
  hostile: boolean;
  casualties: number;
  denarii: number;
  fearShift: number;
  scrolls: number;
  population: { before: number; after: number };
  claimable: boolean;
}

export interface EnvoyReportData {
  tribeId: string;
  envoyId: string;
  /** A refusal names the axis that fell short: too little fear, too much of it (an alliance), too little trust. */
  outcome: 'accepted' | 'refused_fear' | 'refused_feared' | 'refused_trust' | 'no_market';
  fear: { before: number; after: number };
  trust: { before: number; after: number };
  /** What the like/hate web did to the other tribes, as deltas. */
  web: Record<string, { trust: number; fear: number }>;
}

export interface ChallengeReportData {
  phase: 'called' | 'resolved';
  callerFamilyId: string;
  voteRound: number;
  candidates: Record<string, string>;
  tally: Record<string, number>;
  byHouse: Record<string, Record<string, number>>;
  winnerId?: string;
  held?: boolean;
  winnerGravitas?: number;
  loserAttitude?: number;
}

export interface RomeReportData {
  phase: 'issued' | 'rewarded' | 'declined';
  requestId: string;
  title: string;
  kind: ActiveRequest['kind'];
  reward: ActiveRequest['reward'];
  issuedRound: number;
  multiplier?: { research: number; favour: number };
  paid?: { denarii: number; scrolls: number; gravitas: number; unlock: string | null };
  withheld?: { unlock: string; minFavour: number } | null;
  favourDelta?: number;
  loyalistAttitudeDelta?: number;
}

export interface CollapseReportData {
  trigger: 'population' | 'corruption';
  population: number;
  corruption: number;
  grant: Partial<Resources>;
  rounds: number;
  untilRound: number;
}

export interface ReportDataByKind {
  raid: RaidReportData;
  site_raid: SiteRaidReportData;
  scout: ScoutReportData;
  envoy: EnvoyReportData;
  challenge: ChallengeReportData;
  rome: RomeReportData;
  collapse: CollapseReportData;
}

export type Report = { [K in ReportKind]: { id: number; round: number; at: number; kind: K; logId: number; data: ReportDataByKind[K] } }[ReportKind];

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
  /** "Enough counsel": the opening line has been put away for this save. */
  advisorDismissed: boolean;
  lastReport: RoundReport | null;
  /** Every round's report, oldest first, capped by config.history.max (reports unit). */
  history: RoundReport[];
  /** The record behind the log lines, oldest first, capped by config.reports.max. */
  reports: Report[];
  reportSeq: number;
  /** An event waiting on the player's answer. Nothing else is blocked by it. */
  pendingChoice: { eventId: string; title: string; text: string } | null;
  /** Rounds that ran while the player was away, pending a digest. */
  awayRounds: number;
  /** Local playtest record. Never read by the game; written for the Save tab. */
  stats: PlaytestStats;
}
