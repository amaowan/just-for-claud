// 反转: a skeptic retelling flips the relation. The 2% roll happens in propagation.
import { CONFIG } from '../config.ts';
import type { Operator } from './types.ts';
import { baseShape } from './types.ts';

export const invert: Operator = {
  id: 'invert',
  propose(ctx) {
    const { data, idea, teller } = ctx;
    if (!teller || teller.gullibility >= CONFIG.operators.skepticMaxGullibility) return [];
    const inv = data.relations[idea.relation].inverse;
    if (!inv) return [];
    return [{ shape: { ...baseShape(idea), relation: inv }, params: { from: data.relations[idea.relation].text, to: data.relations[inv].text } }];
  },
};
