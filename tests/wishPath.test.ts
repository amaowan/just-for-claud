import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/gameData.ts';
import { validProposals } from '../src/sim/operators/index.ts';
import { festivalName } from '../src/sim/report.ts';
import { updateSediment } from '../src/sim/sediment.ts';
import { ideaText } from '../src/sim/text.ts';
import type { IdeaShape } from '../src/sim/types.ts';
import { addBelief, createSim, registerIdea, villageCore, type Sim } from '../src/sim/world.ts';
import { ctx, npc } from './operators/helpers.ts';

const data = getGameData();

function runMonths(sim: Sim, months: number) {
  for (let i = 0; i < months; i++) {
    sim.world.day += 30;
    for (const id of data.npcIds) {
      for (const b of Object.values(sim.world.beliefs[id])) { b.lastMentionDay = sim.world.day; b.lastEchoDay = sim.world.day; }
    }
    updateSediment(sim);
  }
}

describe('会唱歌的巨人 → 山神 → 春日歌会', () => {
  it('goes all the way through real operators and sedimentation', () => {
    const sim = createSim(data, 1);
    const start: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };
    let idea = registerIdea(sim, start, null, [], 0);
    const dreamer = npc({ imagination: 0.9 });

    // 1. 夸大: 会唱歌的 -> 歌声能唤雨的 (the idea turns awe-toned, so it can be deified).
    const ex = validProposals('exaggerate', ctx({ idea, listener: dreamer }));
    expect(ex.map((p) => p.shape.modifiers)).toEqual([['sing2']]);
    idea = registerIdea(sim, ex[0].shape, idea.lineage, [idea.key], 1, 'exaggerate');

    // 2. 神化: the giant becomes the mountain god once the core is widely believed.
    const de = validProposals('deify', ctx({ idea, coverage: () => 0.6, village: data.villages.mine }));
    expect(de.map((p) => p.shape.subject)).toEqual(['mountainGod']);
    idea = registerIdea(sim, de[0].shape, idea.lineage, [idea.key], 2, 'deify');
    expect(ideaText(idea, data)).toBe('山里住着歌声能唤雨的山神');

    // 3. 仪式化 via the wish table: singing (any level of the chain) -> the god likes songs.
    const ri = validProposals('ritualize', ctx({ idea }));
    const spring = ri.find((p) => p.shape.season === 'spring' && p.shape.relation === 'like')!;
    expect(spring).toBeDefined();
    idea = registerIdea(sim, spring.shape, idea.lineage, [idea.key], 3, 'ritualize');
    expect(ideaText(idea, data)).toBe('每到春天，人们要为山神唱歌');

    // 4. 习俗: held by 60% of the village for 5 years.
    for (const id of data.residents.mine.slice(0, 6)) addBelief(sim, id, idea, 'test');
    runMonths(sim, 61);
    const vc = villageCore(sim, 'mine', idea.core);
    expect(vc.customDay).toBeDefined();

    // 5. 节日: 15 more years.
    runMonths(sim, 15 * 12);
    expect(vc.festivalDay).toBeDefined();
    expect(festivalName(sim, 'mine', idea.core)).toBe('春日歌会');
  });

  it('only deified subjects turn wishes into rituals', () => {
    const giant = registerIdea(createSim(data, 1), { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['greedy'], form: 'statement' }, null, [], 0);
    expect(validProposals('ritualize', ctx({ idea: giant }))).toEqual([]);
    const god = registerIdea(createSim(data, 1), { subject: 'forestGod', relation: 'liveIn', object: 'mountain', modifiers: ['greedy'], form: 'statement' }, null, [], 0);
    const texts = validProposals('ritualize', ctx({ idea: god })).map((p) => ideaText(p.shape, data));
    expect(texts).toContain('每到秋天，人们要为林神摆上供品');
    const tickle = registerIdea(createSim(data, 1), { subject: 'seaGod', relation: 'liveIn', object: 'sea', modifiers: ['ticklish'], form: 'statement' }, null, [], 0);
    expect(validProposals('ritualize', ctx({ idea: tickle })).map((p) => ideaText(p.shape, data)))
      .toContain('每到冬天，人们都不许挥动羽毛，免得吓着海神');
  });
});
