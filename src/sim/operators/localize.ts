// 本地化: a noun whose domain is foreign to this village becomes the local thing with the same role.
import type { Operator, Proposal } from './types.ts';
import { baseShape, withSlot } from './types.ts';

export const localize: Operator = {
  id: 'localize',
  propose(ctx) {
    const { data, idea, village } = ctx;
    const out: Proposal[] = [];
    for (const slot of ['subject', 'object'] as const) {
      const noun = data.nouns[idea[slot]];
      if (!noun.role || village.environment.includes(noun.domain)) continue;
      for (const cand of Object.values(data.nouns)) {
        if (cand.id === noun.id || cand.role !== noun.role || !village.environment.includes(cand.domain)) continue;
        out.push({ shape: withSlot(baseShape(idea), slot, cand.id), params: { from: noun.text, to: cand.text } });
      }
    }
    return out;
  },
};
