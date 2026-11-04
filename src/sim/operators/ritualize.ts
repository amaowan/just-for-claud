// 仪式化: "X likes/fears Y" becomes something people must do, at a season.
import type { Season } from '../types.ts';
import type { Operator } from './types.ts';
import { baseShape } from './types.ts';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const ritualize: Operator = {
  id: 'ritualize',
  propose(ctx) {
    const { data, idea } = ctx;
    if (idea.form !== 'statement' || !data.relations[idea.relation].ritualizable) return [];
    return SEASONS.map((season) => ({
      shape: { ...baseShape(idea), form: 'ritual' as const, season },
      params: { season: data.text.sentence.seasons[season] },
    }));
  },
};
