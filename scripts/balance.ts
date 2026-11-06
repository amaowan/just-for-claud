// Balance report: N seeds, tell 「巨人 · 住在 · 山 · 会唱歌的」 once in the fishing village, simulate Y years.
// Usage: npm run balance [-- <seeds=100> <years=20> [json-out-path]]
// Listener for seed s is the (s mod 10)-th fishing-village resident, so every villager is used equally.
// For tuning experiments, CONFIG_OVERRIDES='{"propagation":{"mutationScale":0.5}}' deep-merges into CONFIG.
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { CONFIG, DAYS_PER_YEAR } from '../src/sim/config.ts';
import { tellByPlayer } from '../src/sim/propagation.ts';
import { advanceDays } from '../src/sim/simulate.ts';
import type { IdeaShape, OperatorId } from '../src/sim/types.ts';
import { createSim } from '../src/sim/world.ts';
import { loadGameDataFromDisk } from './loadData.ts';

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) deepMerge(target[k] as Record<string, unknown>, v as Record<string, unknown>);
    else target[k] = v;
  }
}
if (process.env.CONFIG_OVERRIDES) deepMerge(CONFIG as unknown as Record<string, unknown>, JSON.parse(process.env.CONFIG_OVERRIDES));

const SHAPE: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };

export interface RunResult {
  seed: number;
  listener: string;
  accepted: boolean;
  variants: number;
  cores: number;
  reached: { common: number; custom: number; festival: number; placeName: number; manifest: number };
  activeCoresEnd: Record<string, number>;
  customAny: boolean;
  customPlayer: boolean;
  placesNamed: number;
  maxRenamesPerPlace: number;
  deityBirths: number;
  triggers: Partial<Record<OperatorId, number>>;
  acceptedMutations: Partial<Record<OperatorId, number>>;
  finalBelievers: number;
  evictions: number;
  ms: number;
}

function runOne(seed: number, years: number): RunResult {
  const t0 = Date.now();
  const data = loadGameDataFromDisk();
  const sim = createSim(data, seed);
  const listener = data.residents.coast[seed % data.residents.coast.length];
  const told = tellByPlayer(sim, listener, SHAPE);
  const lineage = told.idea.lineage;
  advanceDays(sim, years * DAYS_PER_YEAR);
  const { world } = sim;

  const keys = new Set<string>();
  for (const r of world.history) if (r.lineage === lineage && r.accepted) keys.add(r.after);
  const cores = new Set([...keys].map((k) => world.ideas[k].core));
  const reached = { common: 0, custom: 0, festival: 0, placeName: 0, manifest: 0 };
  const placeEvents = world.events.filter((e) => e.type === 'placeName');
  for (const core of cores) {
    const states = data.villageIds.map((v) => world.villageCores[v][core]).filter(Boolean);
    if (states.some((s) => s.everCommonDay !== undefined)) reached.common++;
    if (states.some((s) => s.customDay !== undefined)) reached.custom++;
    if (states.some((s) => s.festivalDay !== undefined)) reached.festival++;
    if (placeEvents.some((e) => 'core' in e && e.core === core)) reached.placeName++;
    if (states.some((s) => s.manifestDay !== undefined)) reached.manifest++;
  }
  // Place names formed during play: places named in game (names the villages started with do not count
  // unless they were later replaced). Renames per place come from the place-name state.
  const placeEntries = data.villageIds.flatMap((v) => Object.values(world.placeNames?.[v] ?? {}));
  const placesNamed = placeEntries.filter((p) => !p.initial || p.renames > 0).length;
  const maxRenames = Math.max(0, ...placeEntries.map((p) => p.renames));
  // People (not beliefs: a ritual and its statement can be held together) who still believe some version.
  const finalBelievers = data.npcIds.filter((id) =>
    Object.values(world.beliefs[id]).some((b) => world.ideas[b.ideaKey].lineage === lineage)).length;
  const activeCoresEnd: Record<string, number> = {};
  for (const v of data.villageIds) activeCoresEnd[v] = Object.values(world.villageCores[v]).filter((c) => c.believers > 0).length;
  const customEvents = world.events.filter((e) => e.type === 'custom');
  return {
    seed, listener,
    accepted: told.status === 'accepted',
    variants: Math.max(0, keys.size - 1),
    cores: cores.size,
    reached,
    activeCoresEnd,
    customAny: customEvents.length > 0,
    customPlayer: customEvents.some((e) => 'core' in e && cores.has(e.core)),
    placesNamed,
    maxRenamesPerPlace: maxRenames,
    deityBirths: world.events.filter((e) => e.type === 'deity').length,
    triggers: world.stats.triggers[lineage] ?? {},
    acceptedMutations: world.stats.acceptedMutations[lineage] ?? {},
    finalBelievers,
    evictions: world.events.filter((e) => e.type === 'evicted').length,
    ms: Date.now() - t0,
  };
}

// ---------- worker mode ----------
if (process.argv[2] === '--worker') {
  const years = Number(process.argv[3]);
  const seeds = process.argv.slice(4).map(Number);
  for (const s of seeds) process.send!(runOne(s, years));
  process.exit(0);
}

// ---------- main ----------
const nSeeds = Number(process.argv[2] ?? 100);
const years = Number(process.argv[3] ?? 20);
const jsonOut = process.argv[4];
const seeds = Array.from({ length: nSeeds }, (_, i) => i + 1);
const workers = Math.min(availableParallelism(), nSeeds);
const self = fileURLToPath(import.meta.url);
const results: RunResult[] = [];
const t0 = Date.now();

await Promise.all(Array.from({ length: workers }, (_, w) => new Promise<void>((resolve, reject) => {
  const mine = seeds.filter((_, i) => i % workers === w);
  const child = fork(self, ['--worker', String(years), ...mine.map(String)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  child.on('message', (r) => { results.push(r as RunResult); process.stderr.write(`\r${results.length}/${nSeeds}`); });
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${w} exited ${code}`))));
})));
process.stderr.write('\n');
results.sort((a, b) => a.seed - b.seed);

const data = loadGameDataFromDisk();
const L = data.text.labels;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const f1 = (x: number) => x.toFixed(1);
const pctOf = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const acc = results.filter((r) => r.accepted);

function sumOps(key: 'triggers' | 'acceptedMutations', rs: RunResult[]) {
  const t: Record<string, number> = {};
  for (const r of rs) for (const [op, n] of Object.entries(r[key])) t[op] = (t[op] ?? 0) + (n ?? 0);
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

const activeAll = results.flatMap((r) => Object.values(r.activeCoresEnd));
const activeAcc = acc.flatMap((r) => Object.values(r.activeCoresEnd));
const summary = {
  seeds: nSeeds, years, seconds: (Date.now() - t0) / 1000,
  acceptRate: acc.length / nSeeds,
  variantsMean: mean(acc.map((r) => r.variants)),
  variantsMedian: median(acc.map((r) => r.variants)),
  variantsMin: Math.min(...acc.map((r) => r.variants)),
  variantsMax: Math.max(...acc.map((r) => r.variants)),
  variantsInTarget: acc.filter((r) => r.variants >= 20 && r.variants <= 40).length / (acc.length || 1),
  coresMean: mean(acc.map((r) => r.cores)),
  activeCoresMean: mean(activeAll),
  activeCoresMin: Math.min(...activeAll),
  activeCoresMax: Math.max(...activeAll),
  activeCoresInTarget: activeAll.filter((n) => n >= 3 && n <= 6).length / activeAll.length,
  activeCoresAccMean: mean(activeAcc),
  activeCoresAccMin: Math.min(...activeAcc),
  activeCoresAccMax: Math.max(...activeAcc),
  activeCoresAccInTarget: activeAcc.filter((n) => n >= 3 && n <= 6).length / (activeAcc.length || 1),
  customRunRate: results.filter((r) => r.customAny).length / nSeeds,
  customPlayerRunRate: acc.filter((r) => r.customPlayer).length / (acc.length || 1),
  placesNamedMean: mean(results.map((r) => r.placesNamed)),
  placesNamedInTarget: results.filter((r) => r.placesNamed >= 1 && r.placesNamed <= 3).length / nSeeds,
  maxRenames: Math.max(...results.map((r) => r.maxRenamesPerPlace)),
  renameOkRate: results.filter((r) => r.maxRenamesPerPlace <= 1).length / nSeeds,
  deityMean: mean(results.map((r) => r.deityBirths)),
  deityMax: Math.max(...results.map((r) => r.deityBirths)),
  deityInTarget: results.filter((r) => r.deityBirths <= 2).length / nSeeds,
  finalBelieversMean: mean(acc.map((r) => r.finalBelievers)),
  evictionsMean: mean(results.map((r) => r.evictions)),
  stages: Object.fromEntries((['common', 'custom', 'festival', 'placeName', 'manifest'] as const).map((k) => {
    const total = acc.reduce((s, r) => s + r.cores, 0);
    return [k, total ? acc.reduce((s, r) => s + r.reached[k], 0) / total : 0];
  })),
  triggers: sumOps('triggers', acc).map(([op, n]) => [op, n / (acc.length || 1)]),
  acceptedMutations: sumOps('acceptedMutations', acc).map(([op, n]) => [op, n / (acc.length || 1)]),
};
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ summary, results }, null, 1));

const S = summary;
const totalTriggers = S.triggers.reduce((s, [, n]) => s + (n as number), 0);
const out: string[] = [];
out.push(`### 平衡性报告：${nSeeds} 个种子 × ${years} 年`);
out.push('');
out.push(`在渔村讲一次「山里住着会唱歌的巨人」，种子 1–${nSeeds}，第 s 个种子讲给渔村第 (s mod 10) 位村民。用时 ${f1(S.seconds)} 秒（${workers} 进程）。谱系相关指标只统计讲述被接受的 ${acc.length} 局；世界级指标统计全部 ${nSeeds} 局。`);
out.push('');
out.push('| 指标 | 结果 | 目标 |');
out.push('|---|---|---|');
out.push(`| 玩家讲一次被接受 | ${pctOf(acc.length, nSeeds)} | ≥ 75% |`);
out.push(`| 每条谱系的变体数 | 平均 ${f1(S.variantsMean)}，中位 ${S.variantsMedian}（${S.variantsMin}–${S.variantsMax}），${pctOf(S.variantsInTarget * 100, 100)} 的局落在目标内 | 20–40 |`);
out.push(`| 20 年后每村活跃核心（全部局） | 平均 ${f1(S.activeCoresMean)}（${S.activeCoresMin}–${S.activeCoresMax}），${pctOf(S.activeCoresInTarget * 100, 100)} 的村落在目标内 | 3–6 |`);
out.push(`| 20 年后每村活跃核心（讲述被接受的局） | 平均 ${f1(S.activeCoresAccMean)}（${S.activeCoresAccMin}–${S.activeCoresAccMax}），${pctOf(S.activeCoresAccInTarget * 100, 100)} 的村落在目标内 | 3–6 |`);
out.push(`| 出现习俗的局（任何想法） | ${pctOf(S.customRunRate * 100, 100)}（玩家这条谱系：${pctOf(S.customPlayerRunRate * 100, 100)}） | ≥ 30% |`);
out.push(`| 每局新起地名（不含开局自带的） | 平均 ${f1(S.placesNamedMean)}，${pctOf(S.placesNamedInTarget * 100, 100)} 的局在 1–3 个 | 1–3 |`);
out.push(`| 同一地点最多改名次数 | 最多 ${S.maxRenames}，${pctOf(S.renameOkRate * 100, 100)} 的局 ≤ 1 | ≤ 1 |`);
out.push(`| 每局神灵诞生 | 平均 ${f1(S.deityMean)}，最多 ${S.deityMax}，${pctOf(S.deityInTarget * 100, 100)} 的局 ≤ 2 | 0–2 |`);
out.push('');
out.push(`其他：每局平均想法核心 ${f1(S.coresMean)} 个；${years} 年后仍相信这条谱系某个版本的人数平均 ${f1(S.finalBelieversMean)} / 21；混乱度上限挤掉核心平均 ${f1(S.evictionsMean)} 次/局。`);
out.push('');
out.push(`谱系核心达到各阶段的比例：常识 ${pctOf(S.stages.common * 100, 100)}，习俗 ${pctOf(S.stages.custom * 100, 100)}，节日 ${pctOf(S.stages.festival * 100, 100)}，地名 ${pctOf(S.stages.placeName * 100, 100)}，成真 ${pctOf(S.stages.manifest * 100, 100)}。`);
out.push('');
out.push('| 算子 | 每局触发 | 占比 | 每局被相信 |');
out.push('|---|---|---|---|');
for (const [op, n] of S.triggers) {
  const a = S.acceptedMutations.find(([o]) => o === op)?.[1] ?? 0;
  out.push(`| ${L.operators[op as string]} | ${f1(n as number)} | ${pctOf(n as number, totalTriggers)} | ${f1(a as number)} |`);
}
console.log(out.join('\n'));
