// Balance report: N seeds, tell 「巨人 · 住在 · 山 · 会唱歌的」 once in the fishing village, simulate Y years.
// Usage: npm run balance [-- <seeds=100> <years=20>]
// Listener for seed s is the (s mod 10)-th fishing-village resident, so every villager is used equally.
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { DAYS_PER_YEAR } from '../src/sim/config.ts';
import { tellByPlayer } from '../src/sim/propagation.ts';
import { advanceDays } from '../src/sim/simulate.ts';
import type { IdeaShape, OperatorId } from '../src/sim/types.ts';
import { createSim } from '../src/sim/world.ts';
import { loadGameDataFromDisk } from './loadData.ts';

const SHAPE: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };

interface RunResult {
  seed: number;
  listener: string;
  accepted: boolean;
  variants: number;
  cores: number;
  reached: { common: number; custom: number; festival: number; placeName: number; manifest: number };
  deities: number;
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
  for (const core of cores) {
    const states = data.villageIds.map((v) => world.villageCores[v][core]).filter(Boolean);
    if (states.some((s) => s.everCommonDay !== undefined)) reached.common++;
    if (states.some((s) => s.customDay !== undefined)) reached.custom++;
    if (states.some((s) => s.festivalDay !== undefined)) reached.festival++;
    if (states.some((s) => s.placeNameDay !== undefined)) reached.placeName++;
    if (states.some((s) => s.manifestDay !== undefined)) reached.manifest++;
  }
  let finalBelievers = 0;
  for (const id of data.npcIds) {
    for (const b of Object.values(world.beliefs[id])) if (world.ideas[b.ideaKey].lineage === lineage) finalBelievers++;
  }
  return {
    seed, listener,
    accepted: told.status === 'accepted',
    variants: Math.max(0, keys.size - 1),
    cores: cores.size,
    reached,
    deities: Object.keys(world.deities).filter((c) => cores.has(c)).length,
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
const f1 = (x: number) => x.toFixed(1);
const pctOf = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const acc = results.filter((r) => r.accepted);

function sumOps(key: 'triggers' | 'acceptedMutations', rs: RunResult[]) {
  const t: Record<string, number> = {};
  for (const r of rs) for (const [op, n] of Object.entries(r[key])) t[op] = (t[op] ?? 0) + (n ?? 0);
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

const totalCores = acc.reduce((s, r) => s + r.cores, 0);
const stageRow = (label: string, k: keyof RunResult['reached']) => {
  const n = acc.reduce((s, r) => s + r.reached[k], 0);
  const runs = acc.filter((r) => r.reached[k] > 0).length;
  return `| ${label} | ${n} / ${totalCores} = ${pctOf(n, totalCores)} | ${f1(mean(acc.map((r) => (r.cores ? r.reached[k] / r.cores : 0)) ) * 100)}% | ${runs} / ${acc.length} |`;
};
const triggers = sumOps('triggers', acc);
const accepted = sumOps('acceptedMutations', acc);
const totalTriggers = triggers.reduce((s, [, n]) => s + n, 0);

const out: string[] = [];
out.push(`### 平衡性报告：${nSeeds} 个种子 × ${years} 年`);
out.push('');
out.push(`在渔村讲一次「山里住着会唱歌的巨人」（巨人 · 住在 · 山 · 会唱歌的），种子 1–${nSeeds}，第 s 个种子讲给渔村第 (s mod 10) 位村民，每位村民各 ${nSeeds / 10} 次。数值全部为当前 config 初始值。用时 ${f1((Date.now() - t0) / 1000)} 秒（${workers} 进程）。`);
out.push('');
out.push(`- 玩家这一次讲述被接受：${acc.length} / ${nSeeds}（${pctOf(acc.length, nSeeds)}）。未被接受的种子里这个想法完全没有传开，下面的统计只算被接受的 ${acc.length} 局。`);
out.push(`- 平均产生变体（被至少一人相信过的不同版本，不含原版）：**${f1(mean(acc.map((r) => r.variants)))}** 个（最少 ${Math.min(...acc.map((r) => r.variants))}，最多 ${Math.max(...acc.map((r) => r.variants))}）`);
out.push(`- 平均产生想法核心（主体+关系+对象+形态）：**${f1(mean(acc.map((r) => r.cores)))}** 个`);
out.push(`- ${years} 年后仍相信这条谱系某个版本的人数（共 21 人）：平均 ${f1(mean(acc.map((r) => r.finalBelievers)))}`);
out.push(`- 因混乱度上限被挤掉的核心（两村合计，含所有谱系）：平均 ${f1(mean(acc.map((r) => r.evictions)))} 次/局`);
out.push(`- 神化后诞生神灵：${acc.reduce((s, r) => s + r.deities, 0)} 次（${acc.filter((r) => r.deities > 0).length} 局出现）`);
out.push('');
out.push('**想法核心达到各沉淀阶段的比例**（某核心在任一村达到过即算）');
out.push('');
out.push('| 阶段 | 全部核心合计 | 每局比例的平均 | 至少有一个核心达到的局数 |');
out.push('|---|---|---|---|');
out.push(stageRow('常识（覆盖率 ≥ 30%）', 'common'));
out.push(stageRow('习俗（仪式化 + 50% 持续 5 年）', 'custom'));
out.push(stageRow('节日（习俗满 15 年）', 'festival'));
out.push(stageRow('地名（常识 + 提及 ≥ 200 次）', 'placeName'));
out.push(stageRow('成真（50% 持续 5 年）', 'manifest'));
out.push('');
out.push('**最常被触发的算子**（这条谱系的所有转述，含没被相信的）');
out.push('');
out.push('| 排名 | 算子 | 触发次数（每局平均） | 占全部触发 | 被相信的次数（每局平均） |');
out.push('|---|---|---|---|---|');
triggers.forEach(([op, n], i) => {
  const a = accepted.find(([o]) => o === op)?.[1] ?? 0;
  out.push(`| ${i < 3 ? `**${i + 1}**` : i + 1} | ${L.operators[op]} | ${f1(n / acc.length)} | ${pctOf(n, totalTriggers)} | ${f1(a / acc.length)} |`);
});
console.log(out.join('\n'));
