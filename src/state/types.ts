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
  causeOfDeath?: string;
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
  round: number;
  at: number;
  kind: 'village' | 'council' | 'tribe' | 'rome' | 'raid' | 'event' | 'family' | 'system';
  text: string;
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
  office: string | null;
  corruption: number;
  obstructed: Record<string, number>; // domain -> until round
  tribe: TribeState;
  rome: RomeState;
  log: LogEntry[];
}
