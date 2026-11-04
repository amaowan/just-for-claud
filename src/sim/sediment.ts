// 文化沉淀: rumor -> common knowledge -> custom -> festival / place name -> deity; plus yearly decay.

import { CONFIG, DAYS_PER_YEAR } from './config.ts';
import { parseCore } from './idea.ts';
import { manifestKindOf, shouldManifest } from './manifest.ts';
import { coverage, removeBelief, type Sim } from './world.ts';

function sortedCores(sim: Sim, village: string) {
  return Object.values(sim.world.villageCores[village]).sort((a, b) => (a.core < b.core ? -1 : a.core > b.core ? 1 : 0));
}

/** Nouns of a core that are deities, if any. */
export function deityOf(core: string, sim: Sim): string | undefined {
  const c = parseCore(core);
  for (const n of [c.subject, c.object]) if (sim.data.nouns[n].kind === 'deity') return n;
  return undefined;
}

export function hasPlace(core: string, sim: Sim): boolean {
  const c = parseCore(core);
  return sim.data.nouns[c.subject].kind === 'place' || sim.data.nouns[c.object].kind === 'place';
}

/** Run after each day's propagation. */
export function updateSediment(sim: Sim): void {
  const { world, data } = sim;
  const day = world.day;
  const s = CONFIG.sediment;
  const periodic = day % s.checkIntervalDays === 0;

  for (const v of data.villageIds) {
    for (const vc of sortedCores(sim, v)) {
      const cov = coverage(sim, v, vc.core);
      if (vc.everRumorDay === undefined && vc.believers >= s.rumorMinBelievers) {
        vc.everRumorDay = day;
        world.events.push({ type: 'rumor', day, village: v, core: vc.core });
      }
      if (vc.everCommonDay === undefined && cov >= s.commonCoverage) {
        vc.everCommonDay = day;
        world.events.push({ type: 'common', day, village: v, core: vc.core });
      }
      if (!periodic) continue;

      // Sustained-coverage timers (reset when coverage dips below at a check).
      if (cov >= s.customCoverage) vc.above50Since ??= day;
      else vc.above50Since = undefined;
      if (cov >= s.manifestCoverage) vc.manifestSince ??= day;
      else vc.manifestSince = undefined;

      const ritual = parseCore(vc.core).form === 'ritual';
      if (ritual && vc.customDay === undefined && vc.above50Since !== undefined
        && day - vc.above50Since >= s.customYears * DAYS_PER_YEAR) {
        vc.customDay = day;
        world.events.push({ type: 'custom', day, village: v, core: vc.core });
      }
      if (vc.customDay !== undefined && vc.festivalDay === undefined
        && day - vc.customDay >= s.festivalYearsAfterCustom * DAYS_PER_YEAR) {
        vc.festivalDay = day;
        world.events.push({ type: 'festival', day, village: v, core: vc.core });
      }
      if (vc.placeNameDay === undefined && cov >= s.commonCoverage
        && vc.mentions >= s.placeNameMentions && hasPlace(vc.core, sim)) {
        vc.placeNameDay = day;
        world.events.push({ type: 'placeName', day, village: v, core: vc.core });
      }
      if (shouldManifest(vc, day, data)) {
        vc.manifestDay = day;
        world.events.push({ type: 'manifest', day, village: v, core: vc.core, kind: manifestKindOf(vc.core, data) });
      }
    }
  }

  if (periodic) checkDeities(sim);
  if (day % DAYS_PER_YEAR === 0) yearlyDecay(sim);
}

/** 神灵诞生: a deified core with >= 60% coverage in at least 2 villages. */
export function checkDeities(sim: Sim): void {
  const { world, data } = sim;
  const cores = new Set<string>();
  for (const v of data.villageIds) for (const c of Object.keys(world.villageCores[v])) cores.add(c);
  for (const core of [...cores].sort()) {
    if (world.deities[core] !== undefined) continue;
    const deity = deityOf(core, sim);
    if (!deity) continue;
    const villages = data.villageIds.filter((v) => coverage(sim, v, core) >= CONFIG.sediment.deityCoverage);
    if (villages.length < CONFIG.sediment.deityMinVillages) continue;
    world.deities[core] = world.day;
    world.events.push({ type: 'deity', day: world.day, core, deity, villages });
  }
}

/** Beliefs nobody has mentioned for a year may be forgotten. */
export function yearlyDecay(sim: Sim): void {
  const { world, data, rng } = sim;
  for (const npcId of data.npcIds) {
    const b = world.beliefs[npcId];
    for (const core of Object.keys(b).sort()) {
      if (world.day - b[core].lastMentionDay <= CONFIG.decay.unmentionedDays) continue;
      if (rng.chance(CONFIG.decay.forgetChance)) removeBelief(sim, npcId, core);
    }
  }
}
