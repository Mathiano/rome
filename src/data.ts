// Single import point for all balance and content. Nothing numeric or nominal
// should live in src/ — if it does, that is a bug (CLAUDE.md).
import configJson from '../data/config.json';
import resourcesJson from '../data/resources.json';
import buildingsJson from '../data/buildings.json';
import layoutJson from '../data/layout.json';
import familiesJson from '../data/families.json';
import postsJson from '../data/posts.json';
import tribesJson from '../data/tribes.json';
import requestsJson from '../data/requests.json';
import eventsJson from '../data/events.json';
import researchJson from '../data/research.json';
import effectsJson from '../data/effects.json';
import advisorJson from '../data/advisor.json';

export type ResourceId = 'wood' | 'clay' | 'iron' | 'grain' | 'denarii';
export type StatId = 'authority' | 'discipline' | 'craft' | 'connections' | 'piety';
/** `perimeter` is the wall's alone: one slot, in no ring, at the gate (DESIGN §4.4, §4.5). */
export type Ring = 'centre' | 'inner' | 'outer' | 'perimeter';
export type Cost = Partial<Record<ResourceId, number>>;

export interface BuildingTier {
  cost: Cost;
  buildSeconds: number;
  requiresForumTier: number;
  effects: Record<string, number>;
}
export interface BuildingDef {
  id: string;
  name: string;
  ring: Ring;
  kind: 'building' | 'field';
  site?: string;
  produces?: ResourceId;
  role: string;
  tiers: BuildingTier[];
}
export interface ResearchDef {
  id: string;
  name: string;
  /** Which Library tier opens it (DESIGN §4.6). */
  rank: number;
  requires: string[];
  cost: Cost & { scrolls?: number };
  seconds: number;
  description: string;
  effects: Record<string, number>;
}
export interface SlotDef {
  id: string;
  ring: Ring;
  x: number;
  y: number;
  fixedBuilding?: string;
  site?: string;
}
export interface MemberDef {
  id: string;
  name: string;
  sex: 'm' | 'f';
  age: number;
  isLeader?: boolean;
  stats: Record<StatId, number>;
}
export interface FamilyDef {
  id: string;
  name: string;
  gensName: string;
  isPlayer: boolean;
  active: boolean;
  colour: string;
  loyalist?: boolean;
  attitude: number;
  members: MemberDef[];
}
export interface PostDef {
  id: string;
  name: string;
  domain: string;
  stat: StatId;
  description: string;
  minRank: number;
}
export interface TribeDef {
  id: string;
  name: string;
  archetype: 'trader' | 'raider' | 'wary';
  active: boolean;
  description: string;
  start: { fear: number; trust: number };
  strength: number;
  strengthGrowthPerRound: number;
  raidAppetite: number;
  trade: { gives: ResourceId; wants: ResourceId; ratio: number };
  likes: string[];
  hates: string[];
}
export interface LesserPostDef {
  id: string;
  name: string;
  stat: StatId;
  effect: 'corruptionFall' | 'buildSpeed' | 'gravitasPerRound' | 'attitudeDrift' | 'defence';
  perStat: number;
  description: string;
}
export interface EnvoyDef { id: string; name: string; description: string }
export interface Reward { denarii?: number; scrolls?: number; unlock?: string; gravitas?: number }
export interface RequestDef {
  id: string;
  title: string;
  text: string;
  kind: 'deliver' | 'build' | 'recruits' | 'host';
  deliver?: Cost;
  build?: { building: string; tier: number };
  recruits?: number;
  hostCost?: number;
  reward: Reward;
}
export interface FillerDef {
  id: string;
  title: string;
  text: string;
  kind: 'deliver' | 'recruits';
  deliverPerTier?: Cost;
  recruitsPerTier?: number;
  rewardPerTier: Reward;
}
export interface UnlockDef {
  name: string;
  description: string;
  defenceBonus?: number;
  buildTimeMultiplier?: number;
  militiaBonus?: number;
  gravitas?: number;
}
export type EventEffect = Partial<Record<
  'wood' | 'clay' | 'iron' | 'grain' | 'denarii' | 'population' | 'attitude' | 'gravitas' |
  'corruption' | 'fear' | 'trust' | 'romeFavour' | 'illness' | 'grievance', number>>;
export interface EventChoice {
  id: string;
  label: string;
  text: string;
  cost?: Cost;
  effect: EventEffect;
}
export interface EventDef {
  id: string;
  weight: number;
  title: string;
  text: string;
  effect?: EventEffect;
  choices?: EventChoice[];
}

export const config = configJson;
export const resources = resourcesJson.resources as { id: ResourceId; name: string; store: string; site?: string; denariiValue: number }[];
export const startResources = resourcesJson.start as Record<ResourceId, number>;
export const buildings = buildingsJson.buildings as BuildingDef[];
export const layout = layoutJson as { tile: { w: number; h: number }; slots: SlotDef[]; startBuilt: { slot: string; building: string; tier: number }[] };
export const families = familiesJson.families as FamilyDef[];
export const newMen = familiesJson.newMen;
export const posts = postsJson.posts as PostDef[];
export const lesserPosts = postsJson.lesser as LesserPostDef[];
export const tribes = tribesJson.tribes as TribeDef[];
export const envoys = tribesJson.envoys as EnvoyDef[];
export const requestProgression = requestsJson.progression as RequestDef[];
export const requestFiller = requestsJson.filler as FillerDef[];
export const unlocks = requestsJson.unlocks as Record<string, UnlockDef>;
export const events = eventsJson.events as unknown as EventDef[];
export const researchNodes = researchJson.nodes as unknown as ResearchDef[];
export const researchConfig = researchJson.config as { concurrent: number; rushMinPrice: number };

export const RESOURCE_IDS: ResourceId[] = resources.map((r) => r.id);
export const STAT_IDS: StatId[] = ['authority', 'discipline', 'craft', 'connections', 'piety'];

export function researchNode(id: string): ResearchDef {
  const r = researchNodes.find((x) => x.id === id);
  if (!r) throw new Error(`unknown research ${id}`);
  return r;
}
export function building(id: string): BuildingDef {
  const b = buildings.find((x) => x.id === id);
  if (!b) throw new Error(`unknown building ${id}`);
  return b;
}
export function lesserPost(id: string): LesserPostDef {
  const p = lesserPosts.find((x) => x.id === id);
  if (!p) throw new Error(`unknown lesser post ${id}`);
  return p;
}
export function post(id: string): PostDef {
  const p = posts.find((x) => x.id === id);
  if (!p) throw new Error(`unknown post ${id}`);
  return p;
}
export function activeTribes(): TribeDef[] {
  const list = tribes.filter((x) => x.active);
  if (!list.length) throw new Error('no active tribe');
  return list;
}

export function tribeDef(id: string): TribeDef {
  const t = tribes.find((x) => x.id === id);
  if (!t) throw new Error(`unknown tribe ${id}`);
  return t;
}

/** The first active tribe. Kept for the few places that need one by default. */
export function activeTribe(): TribeDef {
  return activeTribes()[0];
}

/** The words for an effect key: what the number is and what follows it (`data/effects.json`). */
export interface EffectWordsDef { noun: string; unit: string; percent?: boolean }
export const effectVocabulary = effectsJson.effects as Record<string, EffectWordsDef>;
// ---------------------------------------------------------------- the counsel
/** Where a counsel step points: a tab, and on it a village slot or a map hex. */
export interface AdvisorGoto { tab: 'village' | 'map' | 'library' | 'council' | 'family' | 'tribe' | 'rome' | 'log' | 'save'; slot?: string; hex?: 'nearestUnknown' }
/** What a step asks for, so the card can say what is still short. */
export interface AdvisorAction { build?: { slot: string; building: string }; scout?: true }
/** One condition the colony either meets or does not; evaluated in src/render/advisor.ts. */
export type AdvisorCondition = Record<string, unknown>;
export interface AdvisorStep {
  id: string;
  text: string;
  goto: AdvisorGoto;
  action?: AdvisorAction;
  /** Any one of these holding finishes the step. */
  done: AdvisorCondition[];
}
export interface AdvisorDef {
  title: string;
  showMe: string;
  dismiss: string;
  founding: { subtitle: string; paragraphs: string[] };
  steps: AdvisorStep[];
}
export const advisor = advisorJson as unknown as AdvisorDef;
