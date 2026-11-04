// 人格化: an abstract subject (wind, rain, hearth) becomes a spirit.
import type { Operator } from './types.ts';
import { baseShape, withSlot } from './types.ts';

export const personify: Operator = {
  id: 'personify',
  propose(ctx) {
    const { data, idea } = ctx;
    const noun = data.nouns[idea.subject];
    if (noun.kind !== 'abstract' || !noun.personifyTo) return [];
    return [{ shape: withSlot(baseShape(idea), 'subject', noun.personifyTo), params: { from: noun.text, to: data.nouns[noun.personifyTo].text } }];
  },
};
