// 成真的多种形态: what a long-believed idea becomes depends on its relation block.

import { CONFIG, DAYS_PER_YEAR } from './config.ts';
import type { GameData } from './data.ts';
import { parseCore } from './idea.ts';
import { fill } from './text.ts';
import type { ManifestKind, VillageCoreState } from './types.ts';

/** The concrete item an 「X 来自 Y」 idea produces when it comes true, from data/tables/items.json. */
export function itemOf(core: string, data: GameData): { item: string; gather: string } {
  const c = parseCore(core);
  const s = data.nouns[c.subject];
  const o = data.nouns[c.object];
  const rule = data.items.rules.find((r) =>
    (!r.subject || r.subject === c.subject) && (!r.object || r.object === c.object) && (!r.subjectKind || r.subjectKind === s.kind));
  const t = rule ?? data.items.default;
  const params = { subject: s.text, object: o.text };
  return { item: fill(t.item, params), gather: fill(t.gather, params) };
}

export function manifestKindOf(core: string, data: GameData): ManifestKind {
  return data.relations[parseCore(core).relation].manifest;
}

/**
 * Whether a village core manifests today. Rituals (like/need) manifest through the
 * custom/festival stages instead, so they never produce a separate manifestation.
 */
export function shouldManifest(vc: VillageCoreState, day: number, data: GameData): boolean {
  if (vc.manifestDay !== undefined || vc.manifestSince === undefined) return false;
  if (manifestKindOf(vc.core, data) === 'ritual') return false;
  return day - vc.manifestSince >= CONFIG.sediment.manifestYears * DAYS_PER_YEAR;
}
