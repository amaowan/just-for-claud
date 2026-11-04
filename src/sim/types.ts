// Core data types for the propagation sandbox. Pure data, no behaviour.

import type { RngState } from './rng.ts';

export type Domain = 'mountain' | 'water' | 'wind' | 'sky' | 'fire' | 'forest' | 'human' | 'beast';
export type Tone = 'awe' | 'joy' | 'fear' | 'comic';
export type NounKind = 'creature' | 'place' | 'thing' | 'abstract' | 'deity' | 'spirit';
export type Profession =
  | 'fisher' | 'miner' | 'farmer' | 'weaver' | 'bard' | 'merchant' | 'herbalist' | 'keeper';
export type AgeGroup = 'child' | 'youth' | 'adult' | 'elder';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Form = 'statement' | 'ritual';
export type ManifestKind =
  | 'beingOrPlace' | 'skill' | 'item' | 'charm' | 'ritual' | 'taboo' | 'companion' | 'prank';
export type OperatorId =
  | 'localize' | 'professionFilter' | 'exaggerate' | 'deify' | 'ritualize'
  | 'fuse' | 'personify' | 'comedify' | 'simplify' | 'invert';

export const OPERATOR_IDS: readonly OperatorId[] = [
  'localize', 'professionFilter', 'exaggerate', 'deify', 'ritualize',
  'fuse', 'personify', 'comedify', 'simplify', 'invert',
];

// ---------- Blocks ----------

export interface NounBlock {
  id: string;
  text: string;
  domain: Domain;
  tone: Tone;
  kind: NounKind;
  /** Nouns sharing a role in different domains are local equivalents (localize). */
  role?: string;
  deifyTo?: string;
  personifyTo?: string;
  /** Verb phrase for the "can" relation, e.g. 歌 -> 唱歌. */
  ability?: string;
  /** Action phrase for rituals, e.g. 歌 -> 唱歌. */
  act?: string;
  /** Derived blocks are produced by operators and not offered in the composer. */
  derived?: boolean;
}

export interface RelationBlock {
  id: string;
  text: string;
  tone: Tone;
  manifest: ManifestKind;
  inverse?: string;
  ritualizable: boolean;
}

export interface ModifierBlock {
  id: string;
  text: string;
  domain: Domain;
  tone: Tone;
  /** Id of the level-1 modifier of this upgrade chain. */
  family: string;
  level: number;
  next?: string;
  derived?: boolean;
}

// ---------- Ideas ----------

/** The structural content of an idea. */
export interface IdeaShape {
  subject: string;
  relation: string;
  object: string;
  modifiers: string[];
  form: Form;
  season?: Season;
}

/** A concrete, immutable version of an idea. */
export interface Idea extends IdeaShape {
  /** Exact-version key (includes modifiers and season). */
  key: string;
  /** Core key: subject + relation + object + form. Coverage is aggregated by core. */
  core: string;
  /** Lineage id: key of the idea the player (or village history) originally introduced. */
  lineage: string;
  parents: string[];
  bornDay: number;
  /** Operator that first produced this version (absent for told / original ideas). */
  viaOp?: OperatorId;
}

// ---------- People and places ----------

export interface Npc {
  id: string;
  name: string;
  /** Home village; null for the travelling merchant. */
  home: string | null;
  gullibility: number;
  stubbornness: number;
  talkativeness: number;
  imagination: number;
  profession: Profession;
  age: AgeGroup;
}

export interface Tie {
  a: string;
  b: string;
  trust: number;
}

export interface Village {
  id: string;
  name: string;
  environment: Domain[];
  initialBeliefs: IdeaShape[];
}

export interface ProfessionRewrite {
  slot: 'relation' | 'modifier';
  from: string;
  to: string;
}

export interface ProfessionInfo {
  domains: Domain[];
  rewrites: ProfessionRewrite[];
}

export interface FusionMatcher {
  noun?: string;
  modifierFamily?: string;
}

export interface FusionRecipe {
  a: FusionMatcher;
  b: FusionMatcher;
  result: {
    /** Either a noun id or "a.subject" / "a.object" / "b.subject" / "b.object". */
    subject: string;
    relation: string;
    object: string;
    /** "a" keeps a's modifiers, "ab" merges both, [] clears. */
    modifiers: 'a' | 'ab' | string[];
  };
}

/** 修饰 → 愿望: a deified subject with this modifier can be ritualized into this wish. */
export interface Wish {
  modifierFamily: string;
  relation: string;
  object: string;
}

export interface RelationCompat {
  subjectKinds: NounKind[];
  objectKinds: NounKind[];
  objectNeedsAbility?: boolean;
}

// ---------- Simulation state ----------

export interface Belief {
  ideaKey: string;
  sinceDay: number;
  heat: number;
  lastMentionDay: number;
}

/** Per village, per idea core. */
export interface VillageCoreState {
  core: string;
  believers: number;
  mentions: number;
  everRumorDay?: number;
  everCommonDay?: number;
  /** Day at which coverage was first seen >= customCoverage in the current unbroken run. */
  above50Since?: number;
  /** Same, for the manifestation coverage threshold. */
  manifestSince?: number;
  customDay?: number;
  festivalDay?: number;
  placeNameDay?: number;
  manifestDay?: number;
}

export interface TransmissionRecord {
  day: number;
  /** NPC id, or "player". */
  from: string;
  to: string;
  village: string;
  lineage: string;
  before: string;
  after: string;
  operator?: OperatorId;
  /** Text parameters for the operator description. */
  params?: Record<string, string>;
  accepted: boolean;
}

export type SimEvent =
  | { type: 'arrival'; day: number; village: string; core: string; via: string }
  | { type: 'forgotten'; day: number; village: string; core: string }
  | { type: 'evicted'; day: number; village: string; core: string; by: string }
  | { type: 'rumor' | 'common' | 'custom' | 'festival' | 'placeName'; day: number; village: string; core: string }
  | { type: 'manifest'; day: number; village: string; core: string; kind: ManifestKind }
  | { type: 'deity'; day: number; core: string; deity: string; villages: string[] };

export interface SimStats {
  /** lineage -> operator -> times the operator fired (accepted or not). */
  triggers: Record<string, Partial<Record<OperatorId, number>>>;
  /** lineage -> operator -> times a mutated version was accepted. */
  acceptedMutations: Record<string, Partial<Record<OperatorId, number>>>;
  transmissions: number;
  rejected: number;
}

export interface World {
  seed: string;
  day: number;
  rngState: RngState;
  ideas: Record<string, Idea>;
  /** Core key -> lineage of the first idea that produced it. */
  coreLineage: Record<string, string>;
  /** npcId -> core -> belief (one belief per core per NPC). */
  beliefs: Record<string, Record<string, Belief>>;
  /** villageId -> core -> state. */
  villageCores: Record<string, Record<string, VillageCoreState>>;
  /** Core keys that already produced a deity. */
  deities: Record<string, number>;
  /** Lineages introduced by the player, in order. */
  playerLineages: string[];
  history: TransmissionRecord[];
  events: SimEvent[];
  stats: SimStats;
}
