// 夸大: awe/joy ideas told to imaginative listeners climb one step up a modifier's upgrade chain.
import { CONFIG } from '../config.ts';
import { ideaTone } from '../idea.ts';
import type { Operator, Proposal } from './types.ts';
import { baseShape } from './types.ts';

export const exaggerate: Operator = {
  id: 'exaggerate',
  propose(ctx) {
    const { data, idea, listener } = ctx;
    const tone = ideaTone(idea, data);
    if (tone !== 'awe' && tone !== 'joy') return [];
    if (listener.imagination < CONFIG.operators.exaggerateMinImagination) return [];
    const out: Proposal[] = [];
    idea.modifiers.forEach((m, i) => {
      const next = data.modifiers[m].next;
      if (!next) return;
      const shape = baseShape(idea);
      shape.modifiers[i] = next;
      out.push({ shape, params: { from: data.modifiers[m].text, to: data.modifiers[next].text } });
    });
    return out;
  },
};
