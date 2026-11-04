// Seed-42 example: tell 「巨人 · 住在 · 山 · 会唱歌的」 in the fishing village, sleep 5 years, print the report.
// Usage: npm run example [-- <seed> <npcId> <days>]
import { chainFor, describeMutation, nameOf } from '../src/sim/history.ts';
import { tellByPlayer } from '../src/sim/propagation.ts';
import { buildReport, takeSnapshot } from '../src/sim/report.ts';
import { advanceDays } from '../src/sim/simulate.ts';
import { ideaText } from '../src/sim/text.ts';
import type { IdeaShape } from '../src/sim/types.ts';
import { createSim } from '../src/sim/world.ts';
import { loadGameDataFromDisk } from './loadData.ts';

const [seed = '42', npcId = 'c07', daysArg = '1800'] = process.argv.slice(2);
const data = loadGameDataFromDisk();
const sim = createSim(data, seed);
const shape: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };

console.log(`种子 ${seed}：旅人对${data.npcs[npcId].name}讲「${ideaText(shape, data)}」`);
let r = tellByPlayer(sim, npcId, shape);
let attempts = 1;
while (r.status === 'rejected') { r = tellByPlayer(sim, npcId, shape); attempts++; }
console.log(`讲了 ${attempts} 次才被相信。\n`);

const before = takeSnapshot(sim);
advanceDays(sim, Number(daysArg));
const report = buildReport(sim, before, true);
console.log(`## ${report.title}（${report.range}）`);
for (const s of report.sections) {
  console.log(`\n### ${s.title}`);
  for (const e of s.entries) console.log(`- ${e}`);
}

const chain = chainFor(sim, r.idea.lineage);
const mutations = chain.filter((x) => x.operator);
console.log(`\n### 传话链摘录（共 ${chain.length} 次被接受的转述，其中 ${mutations.length} 次变形；前 15 次变形）`);
for (const x of mutations.slice(0, 15)) {
  console.log(`- 第 ${x.day} 天 ${nameOf(x.from, data)} → ${nameOf(x.to, data)}（${data.villages[x.village].name}）【${data.text.labels.operators[x.operator!]}】「${ideaText(sim.world.ideas[x.before], data)}」→「${ideaText(sim.world.ideas[x.after], data)}」 ${describeMutation(x, sim)}`);
}
