// Passing-on chains: who told whom, when, and how the idea changed.

import type { GameData } from './data.ts';
import { fill, ideaText } from './text.ts';
import type { Idea, TransmissionRecord } from './types.ts';
import type { Sim } from './world.ts';

export function nameOf(id: string, data: GameData): string {
  return id === 'player' ? data.text.labels.player : data.npcs[id]?.name ?? id;
}

/** Lineages shown in the UI: the player's first, then the villages' original beliefs. */
export function listLineages(sim: Sim): { lineage: string; byPlayer: boolean }[] {
  const out = sim.world.playerLineages.map((lineage) => ({ lineage, byPlayer: true }));
  for (const v of sim.data.villageIds) {
    for (const l of sim.initialLocal[v]) {
      if (!out.some((o) => o.lineage === l.lineage)) out.push({ lineage: l.lineage, byPlayer: false });
    }
  }
  return out;
}

export function chainFor(sim: Sim, lineage: string, onlyMutations = false): TransmissionRecord[] {
  return sim.world.history.filter((r) => r.lineage === lineage && (!onlyMutations || r.operator));
}

function stableIndex(r: TransmissionRecord, n: number): number {
  let h = r.day;
  for (const ch of r.to + r.from) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

/** One-sentence Chinese explanation of what the operator did in this record. */
export function describeMutation(r: TransmissionRecord, sim: Sim): string {
  if (!r.operator) return '';
  const { data } = sim;
  const templates = data.text.operators[r.operator];
  return fill(templates[stableIndex(r, templates.length)], {
    ...(r.params ?? {}),
    teller: nameOf(r.from, data),
    listener: nameOf(r.to, data),
    village: data.villages[r.village].name,
  });
}

export function recordIdeas(r: TransmissionRecord, sim: Sim): { before: Idea; after: Idea } {
  return { before: sim.world.ideas[r.before], after: sim.world.ideas[r.after] };
}

/** Most believed version of a core among a village's residents. */
export function topVersion(sim: Sim, village: string, core: string): Idea | undefined {
  const counts = new Map<string, number>();
  for (const id of sim.data.residents[village]) {
    const b = sim.world.beliefs[id][core];
    if (b) counts.set(b.ideaKey, (counts.get(b.ideaKey) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of [...counts].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (n > bestN) { best = k; bestN = n; }
  return best ? sim.world.ideas[best] : undefined;
}

/** Any registered version of a core (for cores nobody believes any more). */
export function anyVersion(sim: Sim, core: string): Idea | undefined {
  for (const idea of Object.values(sim.world.ideas)) if (idea.core === core) return idea;
  return undefined;
}

export function coreText(sim: Sim, village: string, core: string): string {
  const idea = topVersion(sim, village, core) ?? anyVersion(sim, core);
  return idea ? ideaText(idea, sim.data) : core;
}
