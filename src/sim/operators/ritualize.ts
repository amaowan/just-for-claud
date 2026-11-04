// 仪式化: "X likes/fears Y" becomes something people must do, at a season.
// Also: a deified subject carrying a modifier from the wish table (data/tables/wishes.json)
// becomes the god's wish, e.g. 「会唱歌的山神」 -> 「每到春天，人们要为山神唱歌」.
import type { IdeaShape, Season } from '../types.ts';
import type { Operator, Proposal } from './types.ts';
import { baseShape } from './types.ts';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const ritualize: Operator = {
  id: 'ritualize',
  propose(ctx) {
    const { data, idea } = ctx;
    if (idea.form !== 'statement') return [];
    const shapes: IdeaShape[] = [];
    if (data.relations[idea.relation].ritualizable) shapes.push(baseShape(idea));
    if (data.nouns[idea.subject].kind === 'deity') {
      for (const m of idea.modifiers) {
        const fam = data.modifiers[m].family;
        for (const w of data.wishes) {
          if (w.modifierFamily !== fam) continue;
          shapes.push({ ...baseShape(idea), relation: w.relation, object: w.object, modifiers: idea.modifiers.filter((x) => x !== m) });
        }
      }
    }
    const out: Proposal[] = [];
    for (const shape of shapes) {
      for (const season of SEASONS) {
        out.push({ shape: { ...shape, form: 'ritual', season }, params: { season: data.text.sentence.seasons[season] } });
      }
    }
    return out;
  },
};
