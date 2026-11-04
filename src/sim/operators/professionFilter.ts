// 职业滤镜: a listener whose profession relates to the idea's domains reinterprets a relation or modifier.
import { ideaDomains } from '../idea.ts';
import type { Operator, Proposal } from './types.ts';
import { baseShape } from './types.ts';

export const professionFilter: Operator = {
  id: 'professionFilter',
  propose(ctx) {
    const { data, idea, listener } = ctx;
    const info = data.professions[listener.profession];
    const domains = ideaDomains(idea, data);
    if (!info.domains.some((d) => domains.has(d))) return [];
    const profession = data.text.labels.professions[listener.profession];
    const out: Proposal[] = [];
    for (const r of info.rewrites) {
      const shape = baseShape(idea);
      if (r.slot === 'relation') {
        if (idea.relation !== r.from) continue;
        shape.relation = r.to;
        out.push({ shape, params: { from: data.relations[r.from].text, to: data.relations[r.to].text, profession } });
      } else {
        const i = idea.modifiers.indexOf(r.from);
        if (i < 0) continue;
        shape.modifiers[i] = r.to;
        out.push({ shape, params: { from: data.modifiers[r.from].text, to: data.modifiers[r.to].text, profession } });
      }
    }
    return out;
  },
};
