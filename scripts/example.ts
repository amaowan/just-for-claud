// Seed-42 example: tell 「巨人 · 住在 · 山 · 会唱歌的」 to the most talkative fisher of the fishing village,
// sleep 20 years, print the full change report and the first 30 mutations of the original lineage.
// Usage: npm run example [-- <seed=42> <years=20>]
import { DAYS_PER_YEAR } from '../src/sim/config.ts';
import { chainFor, describeMutation, nameOf } from '../src/sim/history.ts';
import { tellByPlayer } from '../src/sim/propagation.ts';
import { buildReport, takeSnapshot } from '../src/sim/report.ts';
import { advanceDays } from '../src/sim/simulate.ts';
import { ideaText } from '../src/sim/text.ts';
import type { IdeaShape } from '../src/sim/types.ts';
import { createSim } from '../src/sim/world.ts';
import { loadGameDataFromDisk } from './loadData.ts';

const [seed = '42', yearsArg = '20'] = process.argv.slice(2);
const data = loadGameDataFromDisk();
const L = data.text.labels;
const sim = createSim(data, seed);
const shape: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };

// Most talkative fisher in the fishing village (ties broken by id).
const fishers = data.residents.coast.filter((id) => data.npcs[id].profession === 'fisher');
const npcId = fishers.reduce((a, b) => (data.npcs[b].talkativeness > data.npcs[a].talkativeness ? b : a));
const npc = data.npcs[npcId];

console.log(`种子 ${seed}：旅人对渔村最健谈的渔夫${npc.name}（${L.ages[npc.age]}，健谈 ${npc.talkativeness}）讲「${ideaText(shape, data)}」`);
let r = tellByPlayer(sim, npcId, shape);
let attempts = 1;
while (r.status === 'rejected') { r = tellByPlayer(sim, npcId, shape); attempts++; }
console.log(`讲了 ${attempts} 次才被相信。\n`);

const before = takeSnapshot(sim);
advanceDays(sim, Number(yearsArg) * DAYS_PER_YEAR);
const report = buildReport(sim, before, true);
console.log(`## ${report.title}（${report.range}）`);
for (const s of report.sections) {
  console.log(`\n### ${s.title}`);
  for (const e of s.entries) console.log(`- ${e}`);
}

const chain = chainFor(sim, r.idea.lineage);
const mutations = chain.filter((x) => x.operator);
console.log(`\n### 原始谱系的前 30 次变形（共 ${chain.length} 次被接受的转述，其中 ${mutations.length} 次变形）`);
mutations.slice(0, 30).forEach((x, i) => {
  console.log(`${i + 1}. 第 ${x.day} 天 ${nameOf(x.from, data)} → ${nameOf(x.to, data)}（${data.villages[x.village].name}）【${L.operators[x.operator!]}】「${ideaText(sim.world.ideas[x.before], data)}」→「${ideaText(sim.world.ideas[x.after], data)}」 ${describeMutation(x, sim)}`);
});
