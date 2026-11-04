// 神化: a widely believed awe idea turns its creature (or spirit) into a god.
import { CONFIG } from '../config.ts';
import { ideaTone } from '../idea.ts';
import type { Operator, Proposal } from './types.ts';
import { baseShape, withSlot } from './types.ts';

export const deify: Operator = {
  id: 'deify',
  propose(ctx) {
    const { data, idea } = ctx;
    if (ideaTone(idea, data) !== 'awe') return [];
    if (ctx.coverage(idea.core) < CONFIG.operators.deifyMinCoverage) return [];
    const out: Proposal[] = [];
    for (const slot of ['subject', 'object'] as const) {
      const noun = data.nouns[idea[slot]];
      if (!noun.deifyTo || (noun.kind !== 'creature' && noun.kind !== 'spirit')) continue;
      out.push({ shape: withSlot(baseShape(idea), slot, noun.deifyTo), params: { from: noun.text, to: data.nouns[noun.deifyTo].text } });
    }
    return out;
  },
};
