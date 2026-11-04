import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ideaText } from '../../src/sim/text.ts';
import { ctx, data, idea } from './helpers.ts';

describe('ritualize', () => {
  it('turns "likes" into a seasonal practice', () => {
    const likes = idea({ subject: 'mountainGod', relation: 'like', object: 'song', modifiers: [] });
    const ps = validProposals('ritualize', ctx({ idea: likes }));
    expect(ps).toHaveLength(4);
    expect(ps.every((p) => p.shape.form === 'ritual')).toBe(true);
    const spring = ps.find((p) => p.shape.season === 'spring')!;
    expect(ideaText(spring.shape, data)).toBe('每到春天，人们要为山神唱歌');
  });

  it('ignores relations that cannot become rituals', () => {
    expect(validProposals('ritualize', ctx())).toEqual([]);
  });

  it('does not ritualize twice', () => {
    const r = idea({ relation: 'like', object: 'song', form: 'ritual', season: 'winter' });
    expect(validProposals('ritualize', ctx({ idea: r }))).toEqual([]);
  });
});
