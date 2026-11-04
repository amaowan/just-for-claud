// Daily propagation: who talks, who listens, acceptance and mutation (GDD 传播公式).

import { CONFIG } from './config.ts';
import { beliefsConflict, clarity, fitFactor, fitOf, type LocalBelief } from './idea.ts';
import { chooseMutation, validProposals, type OperatorContext, type Proposal } from './operators/index.ts';
import { ideaText } from './text.ts';
import type { Idea, IdeaShape, Npc, OperatorId } from './types.ts';
import {
  activeCores, addBelief, believedIdeas, bumpStat, coverage, evictCore, localBeliefs, locationOf,
  registerIdea, removeBelief, syncRng, villageCore, type Sim,
} from './world.ts';

// ---------- formulas (exported for tests) ----------

/** 1 to 3 listeners depending on talkativeness. */
export function listenerCount(talkativeness: number): number {
  const p = CONFIG.propagation;
  const n = p.listenersMin + Math.round(talkativeness * (p.listenersMax - p.listenersMin));
  return Math.max(p.listenersMin, Math.min(p.listenersMax, n));
}

/** 接受概率 = 轻信 × 信任 × 契合度, × (1 − 固执) if the listener holds a conflicting belief. */
export function acceptanceProbability(gullibility: number, trust: number, fit: number, stubbornness: number, hasConflict: boolean): number {
  let p = gullibility * trust * fit;
  if (hasConflict) p *= 1 - stubbornness;
  return Math.max(0, Math.min(1, p));
}

/** 变形概率 = 缩放 × (基础 + 0.4 × 想象力 + 0.3 × (1 − 清晰度) − k × 固执), k defaults to 0. */
export function mutationProbability(teller: Pick<Npc, 'imagination' | 'stubbornness'>, idea: IdeaShape): number {
  const p = CONFIG.propagation;
  const v = p.mutationScale * (p.mutationBase + p.mutationImagination * teller.imagination
    + p.mutationUnclarity * (1 - clarity(idea)) - p.mutationStubbornness * teller.stubbornness);
  return Math.max(0, Math.min(1, v));
}

export function isSkeptic(npc: Npc): boolean {
  return npc.gullibility < CONFIG.operators.skepticMaxGullibility;
}

// ---------- acceptance ----------

function tieTrust(sim: Sim, a: string, b: string): number {
  return sim.data.ties[a].find((t) => t.to === b)?.trust ?? CONFIG.propagation.defaultTrust;
}

/** Store an accepted idea: drop conflicting beliefs, enforce the village chaos cap, add the belief. */
function acceptIdea(sim: Sim, listenerId: string, idea: Idea, conflicts: Idea[], via: string): void {
  for (const c of conflicts) removeBelief(sim, listenerId, c.core);
  const home = sim.data.npcs[listenerId].home;
  if (home && (sim.world.villageCores[home][idea.core]?.believers ?? 0) === 0) {
    const active = activeCores(sim, home);
    if (active.length >= CONFIG.chaos.maxActiveCoresPerVillage) {
      // The least-believed core is forgotten to make room (ties: lexical core order).
      let lowest = active[0];
      for (const c of active) if (c.believers < lowest.believers) lowest = c;
      evictCore(sim, home, lowest.core, idea.core);
    }
  }
  addBelief(sim, listenerId, idea, via);
}

interface Hearing {
  listenerId: string;
  idea: Idea;
  trust: number;
  village: string;
  local: LocalBelief[];
  via: string;
}

type HearingResult = 'same' | 'accepted' | 'rejected';

function hear(sim: Sim, h: Hearing): HearingResult {
  const { world, data } = sim;
  const listener = data.npcs[h.listenerId];
  villageCore(sim, h.village, h.idea.core).mentions++;
  const existing = world.beliefs[h.listenerId][h.idea.core];
  if (existing) {
    // Hearing the same core again refreshes it, whatever the version.
    existing.heat = CONFIG.heat.initial;
    existing.lastMentionDay = world.day;
    if (existing.ideaKey === h.idea.key) return 'same';
  }
  const conflicts = believedIdeas(sim, h.listenerId).filter((b) => beliefsConflict(b, h.idea, data));
  const fit = fitFactor(fitOf(h.idea, data.villages[h.village], h.local, data));
  const p = acceptanceProbability(listener.gullibility, h.trust, fit, listener.stubbornness, conflicts.length > 0);
  if (!sim.rng.chance(p)) return 'rejected';
  acceptIdea(sim, h.listenerId, h.idea, conflicts, h.via);
  return 'accepted';
}

// ---------- one retelling ----------

export function retell(sim: Sim, tellerId: string, listenerId: string, idea: Idea, village: string, local: LocalBelief[]): void {
  const { world, data, rng } = sim;
  const teller = data.npcs[tellerId];
  const listener = data.npcs[listenerId];
  world.stats.transmissions++;

  const ctx: OperatorContext = {
    data, idea, teller, listener,
    village: data.villages[village],
    coverage: (core) => coverage(sim, village, core),
    listenerIdeas: believedIdeas(sim, listenerId).filter((i) => i.core !== idea.core),
  };

  let op: OperatorId | undefined;
  let proposal: Proposal | undefined;
  if (isSkeptic(teller) && rng.chance(CONFIG.operators.invertChance)) {
    const ps = validProposals('invert', ctx);
    if (ps.length) { op = 'invert'; proposal = rng.pick(ps); }
  }
  if (!op && rng.chance(mutationProbability(teller, idea))) {
    const m = chooseMutation(ctx, rng);
    if (m) { op = m.op; proposal = m.proposal; }
  }

  let heard = idea;
  if (op && proposal) {
    if (proposal.extraParent) {
      proposal = { ...proposal, params: { ...proposal.params, other: ideaText(world.ideas[proposal.extraParent], data) } };
    }
    const parents = proposal.extraParent ? [idea.key, proposal.extraParent] : [idea.key];
    heard = registerIdea(sim, proposal.shape, idea.lineage, parents, world.day, op);
    bumpStat(world.stats.triggers, idea.lineage, op);
  }

  const result = hear(sim, { listenerId, idea: heard, trust: tieTrust(sim, listenerId, tellerId), village, local, via: tellerId });
  if (result === 'rejected') world.stats.rejected++;
  if (result !== 'accepted') return;
  if (op) bumpStat(world.stats.acceptedMutations, idea.lineage, op);
  world.history.push({
    day: world.day, from: tellerId, to: listenerId, village, lineage: idea.lineage,
    before: idea.key, after: heard.key, operator: op, params: proposal?.params, accepted: true,
  });
}

// ---------- the player ----------

export type TellResult = { status: 'accepted' | 'rejected' | 'already'; idea: Idea };

/** The traveller tells an idea directly. Uses the same acceptance formula; never mutates. */
export function tellByPlayer(sim: Sim, npcId: string, shape: IdeaShape): TellResult {
  const { world } = sim;
  const idea = registerIdea(sim, shape, null, [], world.day);
  if (!world.playerLineages.includes(idea.lineage)) world.playerLineages.push(idea.lineage);
  const village = locationOf(sim, npcId);
  const result = hear(sim, {
    listenerId: npcId, idea, trust: CONFIG.propagation.playerTrust, village,
    local: localBeliefs(sim, village), via: 'player',
  });
  if (result !== 'same') {
    world.history.push({
      day: world.day, from: 'player', to: npcId, village, lineage: idea.lineage,
      before: idea.key, after: idea.key, accepted: result === 'accepted',
    });
  }
  syncRng(sim);
  return { status: result === 'same' ? 'already' : result, idea };
}

// ---------- one day ----------

/** Advance the propagation by one day (no sedimentation; see simulate.ts). */
export function propagateDay(sim: Sim): void {
  const { world, data, rng } = sim;
  world.day++;
  const local: Record<string, LocalBelief[]> = {};
  for (const v of data.villageIds) local[v] = localBeliefs(sim, v);

  // Snapshot of who believes what at dawn.
  const talks: { npcId: string; core: string; heat: number }[] = [];
  for (const npcId of data.npcIds) {
    const b = world.beliefs[npcId];
    for (const core of Object.keys(b).sort()) talks.push({ npcId, core, heat: b[core].heat });
  }

  for (const t of talks) {
    if (!rng.chance(t.heat)) continue;
    const belief = world.beliefs[t.npcId][t.core];
    if (!belief) continue; // replaced or forgotten earlier today
    belief.lastMentionDay = world.day;
    const idea = world.ideas[belief.ideaKey];
    const here = locationOf(sim, t.npcId);
    const ties = data.ties[t.npcId].filter((x) => locationOf(sim, x.to) === here);
    if (!ties.length) continue;
    const n = Math.min(ties.length, listenerCount(data.npcs[t.npcId].talkativeness));
    const chosen = rng.weightedSample(ties, ties.map((x) => x.trust ** CONFIG.propagation.trustWeightExponent), n);
    for (const l of chosen) retell(sim, t.npcId, l.to, idea, here, local[here]);
  }

  // Freshness fades.
  for (const npcId of data.npcIds) {
    const home = data.npcs[npcId].home;
    const b = world.beliefs[npcId];
    for (const core of Object.keys(b)) {
      const custom = home ? world.villageCores[home][core]?.customDay !== undefined : false;
      const floor = custom ? CONFIG.heat.floorCustom : CONFIG.heat.floor;
      b[core].heat = Math.max(floor, b[core].heat * CONFIG.heat.dailyDecay);
    }
  }
}
