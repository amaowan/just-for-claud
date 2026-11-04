// 成真的多种形态: what a long-believed idea becomes depends on its relation block.

import { CONFIG, DAYS_PER_YEAR } from './config.ts';
import type { GameData } from './data.ts';
import { parseCore } from './idea.ts';
import type { ManifestKind, VillageCoreState } from './types.ts';

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
