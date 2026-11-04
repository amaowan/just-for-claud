// 文化沉淀: rumor -> common knowledge -> custom -> festival / place name -> deity; plus yearly decay.

import { CONFIG, DAYS_PER_YEAR } from './config.ts';
import { parseCore } from './idea.ts';
import { manifestKindOf, shouldManifest } from './manifest.ts';
import { fill } from './text.ts';
import type { VillageCoreState } from './types.ts';
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
  return placeOf(core, sim) !== undefined;
}

/** The place noun a core is about (object first), if any. */
export function placeOf(core: string, sim: Sim): string | undefined {
  const c = parseCore(core);
  if (sim.data.nouns[c.object].kind === 'place') return c.object;
  if (sim.data.nouns[c.subject].kind === 'place') return c.subject;
  return undefined;
}

/** The name a core would give its place, e.g. 巨人 · 住在 · 山 -> 巨人山. */
export function placeName(sim: Sim, core: string): { placeId: string; place: string; name: string } {
  const c = parseCore(core);
  const n = sim.data.nouns;
  const placeId = placeOf(core, sim) ?? c.object;
  const otherId = placeId === c.object ? c.subject : c.object;
  return {
    placeId,
    place: n[placeId].text,
    name: fill(sim.data.text.report.placeNameName as string, { other: n[otherId].text, place: n[placeId].text }),
  };
}

/**
 * 地名: a common, much-mentioned core names its place. Each place has one name at a time;
 * a rival name takes over only when its core has been mentioned > placeRenameFactor times as often.
 */
export function updatePlaceNames(sim: Sim, village: string): void {
  const { world } = sim;
  const s = CONFIG.sediment;
  const best = new Map<string, VillageCoreState>();
  for (const vc of sortedCores(sim, village)) {
    if (vc.mentions < s.placeNameMentions || coverage(sim, village, vc.core) < s.commonCoverage) continue;
    const place = placeOf(vc.core, sim);
    if (!place) continue;
    const cur = best.get(place);
    if (!cur || vc.mentions > cur.mentions) best.set(place, vc);
  }
  const names = world.placeNames[village];
  for (const [place, vc] of [...best].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const { name } = placeName(sim, vc.core);
    const current = names[place];
    if (!current) {
      names[place] = { core: vc.core, name, sinceDay: world.day, renames: 0 };
    } else {
      if (current.name === name) continue;
      const currentMentions = world.villageCores[village][current.core]?.mentions ?? 0;
      if (vc.mentions <= s.placeRenameFactor * currentMentions) continue;
      names[place] = { core: vc.core, name, sinceDay: world.day, renames: current.renames + 1 };
    }
    vc.placeNameDay ??= world.day;
    world.events.push({ type: 'placeName', day: world.day, village, core: vc.core, place, name, ...(current ? { previous: current.name } : {}) });
  }
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
      if (shouldManifest(vc, day, data)) {
        vc.manifestDay = day;
        world.events.push({ type: 'manifest', day, village: v, core: vc.core, kind: manifestKindOf(vc.core, data) });
      }
    }
  }

  if (periodic) {
    for (const v of data.villageIds) updatePlaceNames(sim, v);
    checkDeities(sim);
    forgetUnechoed(sim);
  }
}

/** 神灵诞生: a deified core with >= 60% coverage in at least 2 villages. Each god is born once. */
export function checkDeities(sim: Sim): void {
  const { world, data } = sim;
  const cores = new Set<string>();
  for (const v of data.villageIds) for (const c of Object.keys(world.villageCores[v])) cores.add(c);
  for (const core of [...cores].sort()) {
    const deity = deityOf(core, sim);
    if (!deity || world.deities[deity] !== undefined) continue;
    const villages = data.villageIds.filter((v) => coverage(sim, v, core) >= CONFIG.sediment.deityCoverage);
    if (villages.length < CONFIG.sediment.deityMinVillages) continue;
    world.deities[deity] = world.day;
    world.events.push({ type: 'deity', day: world.day, core, deity, villages });
  }
}

/**
 * 衰退: versions nobody has repeated back for a while are forgotten.
 * Customs (and later stages) are practised, so their believers keep them.
 */
export function forgetUnechoed(sim: Sim): void {
  const { world, data, rng } = sim;
  for (const npcId of data.npcIds) {
    const home = data.npcs[npcId].home;
    const b = world.beliefs[npcId];
    for (const core of Object.keys(b).sort()) {
      if (world.day - b[core].lastEchoDay <= CONFIG.decay.unechoedDays) continue;
      if (home && world.villageCores[home][core]?.customDay !== undefined) continue;
      if (rng.chance(CONFIG.decay.forgetChance)) removeBelief(sim, npcId, core);
    }
  }
}
