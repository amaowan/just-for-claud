// 简化: ideas with too many blocks lose a modifier.
import { CONFIG } from '../config.ts';
import { blockCount } from '../idea.ts';
import type { Operator } from './types.ts';
import { baseShape } from './types.ts';

export const simplify: Operator = {
  id: 'simplify',
  propose(ctx) {
    const { data, idea } = ctx;
    if (blockCount(idea) <= CONFIG.operators.simplifyAboveBlocks) return [];
    return idea.modifiers.map((m, i) => {
      const shape = baseShape(idea);
      shape.modifiers.splice(i, 1);
      return { shape, params: { from: data.modifiers[m].text } };
    });
  },
};
