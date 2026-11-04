// Turns raw JSON (from data/) into typed, validated lookup tables.
// Pure: the caller supplies the parsed JSON (Vite import in the browser, fs in scripts).

import type {
  Domain, FusionRecipe, IdeaShape, ModifierBlock, NounBlock, NounKind, Npc, OperatorId,
  ProfessionInfo, Profession, RelationBlock, RelationCompat, Tie, Village, Wish,
} from './types.ts';
import { OPERATOR_IDS } from './types.ts';

/** Paths (relative to data/) of every data file, keyed by RawGameData field. */
export const DATA_FILES = {
  nouns: 'blocks/nouns.json',
  relations: 'blocks/relations.json',
  modifiers: 'blocks/modifiers.json',
  villages: 'villages.json',
  npcs: 'npcs.json',
  professions: 'tables/profession.json',
  fusion: 'tables/fusion.json',
  wishes: 'tables/wishes.json',
  compat: 'tables/compat.json',
  sentence: 'text/sentence.json',
  operatorText: 'text/operators.json',
  report: 'text/report.json',
  labels: 'text/labels.json',
  ui: 'text/ui.json',
} as const;

export type RawGameData = Record<keyof typeof DATA_FILES, unknown>;

export interface SentenceText {
  modifierJoiner: string;
  statement: Record<string, string>;
  ritual: Record<string, string>;
  ritualDefaultAct: Record<string, string>;
  seasons: Record<string, string>;
  seasonShort: Record<string, string>;
}

export interface ReportText {
  [key: string]: string | Record<string, string>;
  manifest: Record<string, string>;
  festivalName: Record<string, string>;
}

export interface Labels {
  professions: Record<string, string>;
  ages: Record<string, string>;
  domains: Record<string, string>;
  tones: Record<string, string>;
  operators: Record<string, string>;
  stages: Record<string, string>;
  placeName: string;
  manifest: Record<string, string>;
  player: string;
  traveling: string;
}

export interface GameData {
  nouns: Record<string, NounBlock>;
  relations: Record<string, RelationBlock>;
  modifiers: Record<string, ModifierBlock>;
  villages: Record<string, Village>;
  villageIds: string[];
  npcs: Record<string, Npc>;
  /** All NPC ids sorted. */
  npcIds: string[];
  /** Resident ids per village, sorted. */
  residents: Record<string, string[]>;
  merchantIds: string[];
  /** Undirected adjacency, each list sorted by NPC id. */
  ties: Record<string, { to: string; trust: number }[]>;
  professions: Record<Profession, ProfessionInfo>;
  fusion: FusionRecipe[];
  wishes: Wish[];
  compat: Record<string, RelationCompat>;
  text: {
    sentence: SentenceText;
    operators: Record<OperatorId, string[]>;
    report: ReportText;
    labels: Labels;
    ui: Record<string, string>;
  };
}

const DOMAINS: Domain[] = ['mountain', 'water', 'wind', 'sky', 'fire', 'forest', 'human', 'beast'];
const KINDS: NounKind[] = ['creature', 'place', 'thing', 'abstract', 'deity', 'spirit'];

export const EXPECTED_COUNTS = { nouns: 12, relations: 8, modifiers: 10, residentsPerVillage: 10 };
export const REQUIRED_MODIFIERS = ['sing', 'sneeze'];

function byId<T extends { id: string }>(list: T[], what: string, errors: string[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of list) {
    if (out[item.id]) errors.push(`duplicate ${what} id: ${item.id}`);
    out[item.id] = item;
  }
  return out;
}

/** Checks that a shape uses existing blocks and satisfies the compatibility table. */
export function shapeProblems(shape: IdeaShape, data: Pick<GameData, 'nouns' | 'relations' | 'modifiers' | 'compat'>): string[] {
  const p: string[] = [];
  const s = data.nouns[shape.subject];
  const o = data.nouns[shape.object];
  const r = data.relations[shape.relation];
  if (!s) p.push(`unknown subject ${shape.subject}`);
  if (!o) p.push(`unknown object ${shape.object}`);
  if (!r) p.push(`unknown relation ${shape.relation}`);
  for (const m of shape.modifiers) if (!data.modifiers[m]) p.push(`unknown modifier ${m}`);
  if (p.length) return p;
  const c = data.compat[shape.relation];
  if (!c) return [`no compat entry for ${shape.relation}`];
  if (shape.subject === shape.object) p.push('subject equals object');
  if (!c.subjectKinds.includes(s.kind)) p.push(`${s.id} (${s.kind}) cannot be subject of ${r.id}`);
  if (!c.objectKinds.includes(o.kind)) p.push(`${o.id} (${o.kind}) cannot be object of ${r.id}`);
  if (c.objectNeedsAbility && !o.ability) p.push(`${o.id} has no ability text for ${r.id}`);
  if (shape.form === 'ritual' && !r.ritualizable) p.push(`${r.id} cannot be a ritual`);
  return p;
}

export function loadGameData(raw: RawGameData): GameData {
  const errors: string[] = [];
  const nounList = raw.nouns as NounBlock[];
  const relationList = raw.relations as RelationBlock[];
  const modifierList = raw.modifiers as ModifierBlock[];
  const villageList = raw.villages as Village[];
  const npcRaw = raw.npcs as { npcs: Npc[]; ties: [string, string, number][] };

  const nouns = byId(nounList, 'noun', errors);
  const relations = byId(relationList, 'relation', errors);
  const modifiers = byId(modifierList, 'modifier', errors);
  const villages = byId(villageList, 'village', errors);
  const npcs = byId(npcRaw.npcs, 'npc', errors);
  const professions = raw.professions as Record<Profession, ProfessionInfo>;
  const fusion = raw.fusion as FusionRecipe[];
  const wishes = raw.wishes as Wish[];
  const compat = (raw.compat as { relations: Record<string, RelationCompat> }).relations;

  // --- counts ---
  const baseNouns = nounList.filter((n) => !n.derived).length;
  const baseMods = modifierList.filter((m) => !m.derived).length;
  if (baseNouns !== EXPECTED_COUNTS.nouns) errors.push(`expected ${EXPECTED_COUNTS.nouns} base nouns, got ${baseNouns}`);
  if (relationList.length !== EXPECTED_COUNTS.relations) errors.push(`expected ${EXPECTED_COUNTS.relations} relations, got ${relationList.length}`);
  if (baseMods !== EXPECTED_COUNTS.modifiers) errors.push(`expected ${EXPECTED_COUNTS.modifiers} base modifiers, got ${baseMods}`);
  for (const id of REQUIRED_MODIFIERS) {
    if (!modifiers[id] || modifiers[id].derived) errors.push(`required base modifier missing: ${id}`);
  }

  // --- nouns ---
  for (const n of nounList) {
    if (!DOMAINS.includes(n.domain)) errors.push(`noun ${n.id}: bad domain ${n.domain}`);
    if (!KINDS.includes(n.kind)) errors.push(`noun ${n.id}: bad kind ${n.kind}`);
    if (n.deifyTo && nouns[n.deifyTo]?.kind !== 'deity') errors.push(`noun ${n.id}: deifyTo ${n.deifyTo} is not a deity`);
    if (n.personifyTo && nouns[n.personifyTo]?.kind !== 'spirit') errors.push(`noun ${n.id}: personifyTo ${n.personifyTo} is not a spirit`);
  }
  // --- relations ---
  for (const r of relationList) {
    if (r.inverse && relations[r.inverse]?.inverse !== r.id) errors.push(`relation ${r.id}: inverse not symmetric`);
    if (!compat[r.id]) errors.push(`relation ${r.id}: missing compat entry`);
  }
  // --- modifiers ---
  for (const m of modifierList) {
    if (!DOMAINS.includes(m.domain)) errors.push(`modifier ${m.id}: bad domain ${m.domain}`);
    if (m.next && !modifiers[m.next]) errors.push(`modifier ${m.id}: unknown next ${m.next}`);
    if (m.next && modifiers[m.next] && modifiers[m.next].level !== m.level + 1) errors.push(`modifier ${m.id}: next level mismatch`);
    if (!modifiers[m.family]) errors.push(`modifier ${m.id}: unknown family ${m.family}`);
  }
  // --- villages ---
  for (const v of villageList) {
    for (const d of v.environment) if (!DOMAINS.includes(d)) errors.push(`village ${v.id}: bad domain ${d}`);
    for (const b of v.initialBeliefs) {
      for (const p of shapeProblems(b, { nouns, relations, modifiers, compat })) errors.push(`village ${v.id} initial belief: ${p}`);
    }
  }
  // --- npcs ---
  const villageIds = villageList.map((v) => v.id);
  const residents: Record<string, string[]> = {};
  for (const id of villageIds) residents[id] = [];
  const merchantIds: string[] = [];
  for (const n of npcRaw.npcs) {
    for (const k of ['gullibility', 'stubbornness', 'talkativeness', 'imagination'] as const) {
      if (!(n[k] >= 0 && n[k] <= 1)) errors.push(`npc ${n.id}: ${k} out of [0,1]`);
    }
    if (!professions[n.profession]) errors.push(`npc ${n.id}: unknown profession ${n.profession}`);
    if (n.home === null) merchantIds.push(n.id);
    else if (!residents[n.home]) errors.push(`npc ${n.id}: unknown home ${n.home}`);
    else residents[n.home].push(n.id);
  }
  for (const id of villageIds) {
    residents[id].sort();
    if (residents[id].length !== EXPECTED_COUNTS.residentsPerVillage) {
      errors.push(`village ${id}: expected ${EXPECTED_COUNTS.residentsPerVillage} residents, got ${residents[id].length}`);
    }
  }
  if (merchantIds.length !== 1) errors.push(`expected exactly 1 travelling merchant, got ${merchantIds.length}`);

  const ties: Record<string, { to: string; trust: number }[]> = {};
  for (const id of Object.keys(npcs)) ties[id] = [];
  const tieList: Tie[] = npcRaw.ties.map(([a, b, trust]) => ({ a, b, trust }));
  const seenTie = new Set<string>();
  for (const t of tieList) {
    if (!npcs[t.a] || !npcs[t.b]) { errors.push(`tie ${t.a}-${t.b}: unknown npc`); continue; }
    const k = [t.a, t.b].sort().join('|');
    if (seenTie.has(k)) errors.push(`duplicate tie ${k}`);
    seenTie.add(k);
    if (!(t.trust > 0 && t.trust <= 1)) errors.push(`tie ${k}: trust out of (0,1]`);
    ties[t.a].push({ to: t.b, trust: t.trust });
    ties[t.b].push({ to: t.a, trust: t.trust });
  }
  for (const id of Object.keys(ties)) {
    ties[id].sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : 0));
    if (ties[id].length === 0) errors.push(`npc ${id}: has no ties`);
  }

  // --- professions ---
  for (const [p, info] of Object.entries(professions)) {
    for (const r of info.rewrites) {
      const table = r.slot === 'relation' ? relations : modifiers;
      if (!table[r.from] || !table[r.to]) errors.push(`profession ${p}: bad rewrite ${r.from} -> ${r.to}`);
    }
  }
  // --- fusion ---
  const refOk = (v: string) => /^(a|b)\.(subject|object)$/.test(v) || !!nouns[v];
  for (const [i, f] of fusion.entries()) {
    for (const m of [f.a, f.b]) {
      if (m.noun && !nouns[m.noun]) errors.push(`fusion ${i}: unknown noun ${m.noun}`);
      if (m.modifierFamily && !modifiers[m.modifierFamily]) errors.push(`fusion ${i}: unknown family ${m.modifierFamily}`);
    }
    if (!refOk(f.result.subject) || !refOk(f.result.object)) errors.push(`fusion ${i}: bad result noun`);
    if (!relations[f.result.relation]) errors.push(`fusion ${i}: unknown relation ${f.result.relation}`);
  }

  // --- wishes ---
  for (const w of wishes) {
    if (!modifiers[w.modifierFamily] || modifiers[w.modifierFamily].family !== w.modifierFamily) errors.push(`wish: unknown modifier family ${w.modifierFamily}`);
    if (!relations[w.relation]?.ritualizable) errors.push(`wish ${w.modifierFamily}: relation ${w.relation} is not ritualizable`);
    const probe: IdeaShape = { subject: 'mountainGod', relation: w.relation, object: w.object, modifiers: [], form: 'ritual', season: 'spring' };
    for (const p of shapeProblems(probe, { nouns, relations, modifiers, compat })) errors.push(`wish ${w.modifierFamily}: ${p}`);
  }

  const text = {
    sentence: raw.sentence as SentenceText,
    operators: raw.operatorText as Record<OperatorId, string[]>,
    report: raw.report as ReportText,
    labels: raw.labels as Labels,
    ui: raw.ui as Record<string, string>,
  };
  for (const op of OPERATOR_IDS) {
    if (!text.operators[op]?.length) errors.push(`missing operator text for ${op}`);
    if (!text.labels.operators[op]) errors.push(`missing operator label for ${op}`);
  }
  for (const r of relationList) {
    if (!text.sentence.statement[r.id]) errors.push(`missing statement template for ${r.id}`);
    if (r.ritualizable && !text.sentence.ritual[r.id]) errors.push(`missing ritual template for ${r.id}`);
    if (r.ritualizable && !text.report.festivalName?.[r.id]) errors.push(`missing festival name template for ${r.id}`);
    if (!text.report.manifest[r.manifest]) errors.push(`missing manifest text for ${r.manifest}`);
  }

  if (errors.length) throw new Error(`Invalid game data:\n- ${errors.join('\n- ')}`);

  return {
    nouns, relations, modifiers, villages, villageIds, npcs,
    npcIds: Object.keys(npcs).sort(), residents, merchantIds, ties,
    professions, fusion, wishes, compat, text,
  };
}
