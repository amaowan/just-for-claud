// World state: creation, idea registry, belief bookkeeping, coverage, locations.

import { CONFIG } from './config.ts';
import type { GameData } from './data.ts';
import { coreKey, normalizeShape, shapeKey, type LocalBelief } from './idea.ts';
import { Rng } from './rng.ts';
import type { Belief, Idea, IdeaShape, OperatorId, VillageCoreState, World } from './types.ts';

/** Live simulation handle: immutable data + mutable world + the RNG stream. */
export interface Sim {
  data: GameData;
  world: World;
  rng: Rng;
  /** Initial village beliefs, always part of the village's local beliefs. */
  initialLocal: Record<string, LocalBelief[]>;
}

export function createSim(data: GameData, seed: string | number): Sim {
  const rng = new Rng(seed);
  const world: World = {
    seed: String(seed),
    day: 0,
    rngState: rng.getState(),
    ideas: {},
    coreLineage: {},
    beliefs: {},
    villageCores: {},
    deities: {},
    placeNames: {},
    playerLineages: [],
    history: [],
    events: [],
    stats: { triggers: {}, acceptedMutations: {}, transmissions: 0, rejected: 0 },
  };
  for (const id of data.npcIds) world.beliefs[id] = {};
  for (const v of data.villageIds) { world.villageCores[v] = {}; world.placeNames[v] = {}; }
  const sim: Sim = { data, world, rng, initialLocal: {} };

  for (const v of data.villageIds) {
    sim.initialLocal[v] = [];
    for (const shape of data.villages[v].initialBeliefs) {
      const idea = registerIdea(sim, shape, null, [], 0);
      sim.initialLocal[v].push({ core: idea.core, lineage: idea.lineage });
      const residents = data.residents[v];
      const count = Math.round(CONFIG.initialBeliefShare * residents.length);
      const chosen = rng.shuffle(residents).slice(0, count).sort();
      for (const npcId of chosen) addBelief(sim, npcId, idea, 'initial', true);
      const vc = villageCore(sim, v, idea.core);
      vc.everCommonDay = 0;
      if (vc.believers >= CONFIG.sediment.rumorMinBelievers) vc.everRumorDay = 0;
    }
  }
  syncRng(sim);
  return sim;
}

/** Persist the RNG position into the serializable world. */
export function syncRng(sim: Sim): void {
  sim.world.rngState = sim.rng.getState();
}

/** Get or create the idea for a shape. A new idea starts its own lineage when lineage is null. */
export function registerIdea(sim: Sim, shape: IdeaShape, lineage: string | null, parents: string[], day: number, viaOp?: OperatorId): Idea {
  const s = normalizeShape(shape);
  const key = shapeKey(s);
  const existing = sim.world.ideas[key];
  if (existing) return existing;
  const core = coreKey(s);
  const idea: Idea = { ...s, key, core, lineage: lineage ?? key, parents, bornDay: day };
  if (viaOp) idea.viaOp = viaOp;
  sim.world.ideas[key] = idea;
  sim.world.coreLineage[core] ??= idea.lineage;
  return idea;
}

export function villageCore(sim: Sim, village: string, core: string): VillageCoreState {
  const table = sim.world.villageCores[village];
  return (table[core] ??= { core, believers: 0, mentions: 0 });
}

export function coverage(sim: Sim, village: string, core: string): number {
  const vc = sim.world.villageCores[village][core];
  return vc ? vc.believers / sim.data.residents[village].length : 0;
}

export function activeCores(sim: Sim, village: string): VillageCoreState[] {
  return Object.values(sim.world.villageCores[village])
    .filter((c) => c.believers > 0)
    .sort((a, b) => (a.core < b.core ? -1 : a.core > b.core ? 1 : 0));
}

/** Where an NPC is on a given day. The merchant alternates villages. */
export function locationOf(sim: Sim, npcId: string, day = sim.world.day): string {
  const npc = sim.data.npcs[npcId];
  if (npc.home) return npc.home;
  const ids = sim.data.villageIds;
  return ids[Math.floor(day / CONFIG.merchant.stayDays) % ids.length];
}

export function believedIdeas(sim: Sim, npcId: string): Idea[] {
  const b = sim.world.beliefs[npcId];
  return Object.keys(b).sort().map((core) => sim.world.ideas[b[core].ideaKey]);
}

export function addBelief(sim: Sim, npcId: string, idea: Idea, via: string, silent = false): void {
  const day = sim.world.day;
  const belief: Belief = { ideaKey: idea.key, sinceDay: day, heat: CONFIG.heat.initial, lastMentionDay: day, lastEchoDay: day };
  const had = sim.world.beliefs[npcId][idea.core];
  sim.world.beliefs[npcId][idea.core] = belief;
  const home = sim.data.npcs[npcId].home;
  if (!home || had) return;
  const vc = villageCore(sim, home, idea.core);
  vc.believers++;
  if (vc.believers === 1 && !silent) {
    sim.world.events.push({ type: 'arrival', day, village: home, core: idea.core, via });
  }
}

export function removeBelief(sim: Sim, npcId: string, core: string, silent = false): void {
  if (!sim.world.beliefs[npcId][core]) return;
  delete sim.world.beliefs[npcId][core];
  const home = sim.data.npcs[npcId].home;
  if (!home) return;
  const vc = villageCore(sim, home, core);
  vc.believers--;
  if (vc.believers === 0 && !silent) {
    sim.world.events.push({ type: 'forgotten', day: sim.world.day, village: home, core });
  }
}

/** Everyone in the village forgets a core (used by the chaos cap). */
export function evictCore(sim: Sim, village: string, core: string, by: string): void {
  for (const npcId of sim.data.residents[village]) removeBelief(sim, npcId, core, true);
  sim.world.events.push({ type: 'evicted', day: sim.world.day, village, core, by });
}

export function bumpStat(table: Record<string, Partial<Record<OperatorId, number>>>, lineage: string, op: OperatorId): void {
  const t = (table[lineage] ??= {});
  t[op] = (t[op] ?? 0) + 1;
}

/** Cores currently counted as local beliefs: initial beliefs + cores at common knowledge or above. */
export function localBeliefs(sim: Sim, village: string): { core: string; lineage: string }[] {
  const out = sim.initialLocal[village].slice();
  const seen = new Set(out.map((l) => l.core));
  for (const vc of activeCores(sim, village)) {
    if (seen.has(vc.core)) continue;
    const common = coverage(sim, village, vc.core) >= CONFIG.sediment.commonCoverage;
    if (common || vc.customDay !== undefined) {
      out.push({ core: vc.core, lineage: sim.world.coreLineage[vc.core] });
    }
  }
  return out;
}
