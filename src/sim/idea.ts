// Pure helpers over idea shapes: identity keys, derived numbers, tags, conflict/fit.

import { CONFIG } from './config.ts';
import type { GameData } from './data.ts';
import { shapeProblems } from './data.ts';
import type { Domain, Idea, IdeaShape, Tone, Village } from './types.ts';

export function normalizeShape(s: IdeaShape): IdeaShape {
  const mods: string[] = [];
  for (const m of s.modifiers) if (!mods.includes(m)) mods.push(m);
  const out: IdeaShape = { subject: s.subject, relation: s.relation, object: s.object, modifiers: mods, form: s.form };
  if (s.form === 'ritual' && s.season) out.season = s.season;
  return out;
}

/** Exact-version key. */
export function shapeKey(s: IdeaShape): string {
  const season = s.form === 'ritual' && s.season ? `:${s.season}` : '';
  return `${s.subject}|${s.relation}|${s.object}|${s.modifiers.join('+')}|${s.form}${season}`;
}

/** Core key: subject + relation + object + form (modifiers and season ignored). */
export function coreKey(s: Pick<IdeaShape, 'subject' | 'relation' | 'object' | 'form'>): string {
  return `${s.subject}|${s.relation}|${s.object}|${s.form}`;
}

export function parseCore(core: string): Pick<IdeaShape, 'subject' | 'relation' | 'object' | 'form'> {
  const [subject, relation, object, form] = core.split('|');
  return { subject, relation, object, form: form as IdeaShape['form'] };
}

export function blockCount(s: IdeaShape): number {
  return CONFIG.idea.baseBlocks + s.modifiers.length;
}

export function clarity(s: IdeaShape): number {
  const c = 1 - CONFIG.idea.clarityPenaltyPerBlock * (blockCount(s) - CONFIG.idea.baseBlocks);
  return Math.max(0, Math.min(1, c));
}

/** Tone: first modifier if any, otherwise the subject. */
export function ideaTone(s: IdeaShape, data: GameData): Tone {
  if (s.modifiers.length) return data.modifiers[s.modifiers[0]].tone;
  return data.nouns[s.subject].tone;
}

export function primaryDomain(s: IdeaShape, data: GameData): Domain {
  return data.nouns[s.subject].domain;
}

/** Domains of every noun and modifier in the idea. */
export function ideaDomains(s: IdeaShape, data: GameData): Set<Domain> {
  const out = new Set<Domain>([data.nouns[s.subject].domain, data.nouns[s.object].domain]);
  for (const m of s.modifiers) out.add(data.modifiers[m].domain);
  return out;
}

export function isValidShape(s: IdeaShape, data: GameData): boolean {
  if (s.modifiers.length > CONFIG.idea.maxModifiers) return false;
  const fams = new Set(s.modifiers.map((m) => data.modifiers[m]?.family));
  if (fams.size !== s.modifiers.length) return false;
  return shapeProblems(s, data).length === 0;
}

export function areInverse(r1: string, r2: string, data: GameData): boolean {
  return data.relations[r1]?.inverse === r2;
}

export function sharesNoun(a: IdeaShape, b: IdeaShape): boolean {
  return a.subject === b.subject || a.subject === b.object || a.object === b.subject || a.object === b.object;
}

export function sharesBlock(a: IdeaShape, b: IdeaShape): boolean {
  return sharesNoun(a, b) || a.modifiers.some((m) => b.modifiers.includes(m));
}

export function sharesDomain(a: IdeaShape, b: IdeaShape, data: GameData): boolean {
  const da = ideaDomains(a, data);
  for (const d of ideaDomains(b, data)) if (da.has(d)) return true;
  return false;
}

/** Same subject and object, mutually inverse relations. */
export function invertedPair(a: IdeaShape, b: IdeaShape, data: GameData): boolean {
  return a.subject === b.subject && a.object === b.object && areInverse(a.relation, b.relation, data);
}

/**
 * A ritual and the statement it came from (same lineage, different form) can be believed together:
 * 「每到春天，人们要为山神唱歌」 does not contradict 「山里住着山神」. Exception to PLAN-M1 §0 #6.
 */
export function ritualCoexists(a: Pick<IdeaShape, 'form'> & { lineage: string }, b: Pick<IdeaShape, 'form'> & { lineage: string }): boolean {
  return a.lineage === b.lineage && a.form !== b.form;
}

/** Listener-level conflict between two versions someone might believe. */
export function beliefsConflict(a: Idea, b: Idea, data: GameData): boolean {
  if (a.key === b.key) return false;
  if (invertedPair(a, b, data)) return true;
  if (ritualCoexists(a, b)) return false;
  return a.core === b.core || a.lineage === b.lineage;
}

export interface LocalBelief {
  core: string;
  lineage: string;
}

export type Fit = 'match' | 'neutral' | 'conflict';

/** How an idea fits a village's established beliefs (PLAN-M1 §0 #6). */
export function fitOf(idea: Idea, village: Village, local: LocalBelief[], data: GameData): Fit {
  let match = village.environment.includes(primaryDomain(idea, data));
  for (const l of local) {
    if (l.core === idea.core) { match = true; continue; }
    const shape = parseCore(l.core);
    if (invertedPair(idea, { ...shape, modifiers: [] }, data)) return 'conflict';
    if (l.lineage === idea.lineage && !ritualCoexists(idea, { form: shape.form, lineage: l.lineage })) return 'conflict';
    if (sharesNoun(idea, { ...shape, modifiers: [] })) match = true;
  }
  return match ? 'match' : 'neutral';
}

export function fitFactor(fit: Fit): number {
  const p = CONFIG.propagation;
  return fit === 'match' ? p.fitMatch : fit === 'conflict' ? p.fitConflict : p.fitNeutral;
}
