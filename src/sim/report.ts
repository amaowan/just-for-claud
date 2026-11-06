// Change report: compare the world before and after a time jump, in Chinese.

import { CONFIG } from './config.ts';
import { anyVersion, describeMutation, nameOf, topVersion } from './history.ts';
import { parseCore } from './idea.ts';
import { itemOf } from './manifest.ts';
import { fill, ideaText, seasonText } from './text.ts';
import type { SimEvent, VillageCoreState } from './types.ts';
import { coverage, type Sim } from './world.ts';

export type Stage = 'none' | 'rumor' | 'common' | 'custom' | 'festival';
const STAGE_ORDER: Stage[] = ['none', 'rumor', 'common', 'custom', 'festival'];

export function stageOf(vc: VillageCoreState, cov: number): Stage {
  if (vc.festivalDay !== undefined) return 'festival';
  if (vc.customDay !== undefined) return 'custom';
  if (cov >= CONFIG.sediment.commonCoverage) return 'common';
  if (vc.believers >= CONFIG.sediment.rumorMinBelievers) return 'rumor';
  return 'none';
}

interface CoreSnap { believers: number; coverage: number; stage: Stage; text: string }

export interface Snapshot {
  day: number;
  eventCount: number;
  historyCount: number;
  villages: Record<string, Record<string, CoreSnap>>;
}

export function takeSnapshot(sim: Sim): Snapshot {
  const villages: Snapshot['villages'] = {};
  for (const v of sim.data.villageIds) {
    villages[v] = {};
    for (const vc of Object.values(sim.world.villageCores[v])) {
      if (vc.believers === 0) continue;
      const cov = coverage(sim, v, vc.core);
      const idea = topVersion(sim, v, vc.core);
      villages[v][vc.core] = { believers: vc.believers, coverage: cov, stage: stageOf(vc, cov), text: idea ? ideaText(idea, sim.data) : vc.core };
    }
  }
  return { day: sim.world.day, eventCount: sim.world.events.length, historyCount: sim.world.history.length, villages };
}

export interface ReportSection { title: string; entries: string[] }
export interface Report { title: string; range: string; sections: ReportSection[]; empty: boolean }

const MAX_PER_KIND = 6;
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function festivalName(sim: Sim, village: string, core: string): string {
  const idea = topVersion(sim, village, core) ?? anyVersion(sim, core);
  const t = sim.data.text.report;
  const c = parseCore(core);
  return fill(t.festivalName[c.relation] ?? '{seasonShort}{subject}节', {
    seasonShort: seasonText(idea?.season, sim.data, true),
    subject: sim.data.nouns[c.subject].text,
    object: sim.data.nouns[c.object].text,
  });
}

export { placeName } from './sediment.ts';

export function buildReport(sim: Sim, before: Snapshot, long: boolean): Report {
  const { data, world } = sim;
  const t = data.text.report;
  const T = (k: string, p: Record<string, string | number>) => fill(t[k] as string, p);
  const after = takeSnapshot(sim);
  const events = world.events.slice(before.eventCount);
  const sections: ReportSection[] = [];
  const textOf = (v: string, core: string) =>
    after.villages[v][core]?.text ?? before.villages[v][core]?.text ?? (anyVersion(sim, core) ? ideaText(anyVersion(sim, core)!, data) : core);

  for (const v of data.villageIds) {
    const vname = data.villages[v].name;
    const entries: string[] = [];
    const a = after.villages[v];
    const b = before.villages[v];
    const byBelievers = (cores: string[]) => cores.sort((x, y) => (a[y]?.believers ?? 0) - (a[x]?.believers ?? 0) || (x < y ? -1 : 1));
    const ofType = (type: SimEvent['type']) => events.filter((e) => e.type === type && 'village' in e && e.village === v);

    // Stage changes (highest stage reached in the period).
    const staged: string[] = [];
    for (const core of byBelievers(Object.keys(a))) {
      const from = STAGE_ORDER.indexOf(b[core]?.stage ?? 'none');
      const to = STAGE_ORDER.indexOf(a[core].stage);
      if (to <= from || to < STAGE_ORDER.indexOf('rumor')) continue;
      staged.push(core);
      const stage = STAGE_ORDER[to];
      const idea = a[core].text;
      if (stage === 'festival') entries.push(T('festival', { village: vname, festival: festivalName(sim, v, core) }));
      else if (stage === 'custom') entries.push(T('custom', { village: vname, idea }));
      else if (stage === 'common') entries.push(T('common', { village: vname, idea, coverage: pct(a[core].coverage) }));
      else entries.push(T('rumor', { village: vname, idea, believers: a[core].believers }));
    }
    // Place names and manifestations.
    for (const e of ofType('placeName').slice(0, MAX_PER_KIND)) {
      if (e.type !== 'placeName') continue;
      const place = data.nouns[e.place].text;
      entries.push(e.previous
        ? T('rename', { village: vname, place, name: e.name, previous: e.previous })
        : T('placeName', { village: vname, place, name: e.name }));
    }
    for (const e of ofType('manifest')) {
      if (e.type !== 'manifest') continue;
      const subject = data.nouns[parseCore(e.core).subject].text;
      entries.push(fill(t.manifest[e.kind], { village: vname, idea: textOf(v, e.core), subject, ...itemOf(e.core, data) }));
    }
    // Arrivals by the merchant, new sayings with a foothold.
    const viaMerchant = new Set<string>();
    for (const e of ofType('arrival')) {
      if (e.type !== 'arrival' || !a[e.core] || data.npcs[e.via]?.home !== null) continue;
      if (viaMerchant.has(e.core) || viaMerchant.size >= MAX_PER_KIND) continue;
      viaMerchant.add(e.core);
      entries.push(T('arrival', { village: vname, idea: a[e.core].text, via: nameOf(e.via, data) }));
    }
    const fresh = byBelievers(Object.keys(a).filter((c) => !b[c] && a[c].believers >= 2 && !staged.includes(c) && !viaMerchant.has(c)));
    for (const core of fresh.slice(0, MAX_PER_KIND)) entries.push(T('newCore', { village: vname, idea: a[core].text }));
    // Big shifts in belief.
    const shifted = byBelievers(Object.keys(a).filter((c) => b[c] && !staged.includes(c) && Math.abs(a[c].believers - b[c].believers) >= 3));
    for (const core of shifted.slice(0, MAX_PER_KIND)) {
      entries.push(T('coverageChange', { village: vname, idea: a[core].text, before: b[core].believers, after: a[core].believers }));
    }
    // Lost sayings that used to matter.
    const evicted = new Set(ofType('evicted').map((e) => e.core));
    const lost = Object.keys(b).filter((c) => !a[c] && b[c].believers >= 2).sort((x, y) => b[y].believers - b[x].believers);
    for (const core of lost.slice(0, MAX_PER_KIND)) {
      entries.push(T(evicted.has(core) ? 'evicted' : 'forgotten', { village: vname, idea: b[core].text }));
    }
    if (entries.length) sections.push({ title: vname, entries });
  }

  const global: string[] = [];
  for (const e of events) {
    if (e.type !== 'deity') continue;
    // Most believed version where the god was born (seasons etc. can differ between versions of a core).
    const version = e.villages.map((v) => topVersion(sim, v, e.core)).find(Boolean) ?? anyVersion(sim, e.core)!;
    global.push(T('deity', {
      deity: data.nouns[e.deity].text,
      idea: ideaText(version, data),
      villages: e.villages.map((v) => data.villages[v].name).join('、'),
    }));
  }
  if (global.length) sections.push({ title: t.globalSection as string, entries: global });

  // A few memorable mutations: the first accepted one of each operator in the period.
  const seenOps = new Set<string>();
  const highlights: string[] = [];
  for (const r of world.history.slice(before.historyCount)) {
    if (!r.operator || seenOps.has(r.operator)) continue;
    seenOps.add(r.operator);
    highlights.push(`${T('mutation', {
      day: r.day, from: nameOf(r.from, data), to: nameOf(r.to, data),
      before: ideaText(world.ideas[r.before], data), after: ideaText(world.ideas[r.after], data),
      op: data.text.labels.operators[r.operator],
    })}${describeMutation(r, sim)}`);
    if (highlights.length >= (long ? 5 : 3)) break;
  }
  if (highlights.length) sections.push({ title: t.mutationsTitle as string, entries: highlights });

  return {
    title: (long ? t.titleLong : t.titleShort) as string,
    range: T('range', { fromDay: before.day, toDay: after.day }),
    sections,
    empty: sections.length === 0,
  };
}
