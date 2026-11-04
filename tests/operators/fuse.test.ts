import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ideaText } from '../../src/sim/text.ts';
import { ctx, data, idea } from './helpers.ts';

describe('fuse', () => {
  const rainFromLake = idea({ subject: 'rain', relation: 'comeFrom', object: 'skyLake', modifiers: [] }, 'init');

  it('uses a recipe: singing giant + rain from the sky lake -> the giant can summon rain', () => {
    const ps = validProposals('fuse', ctx({ listenerIdeas: [rainFromLake] }));
    expect(ps.map((p) => ideaText(p.shape, data))).toContain('会唱歌的巨人能唤雨');
    expect(ps[0].extraParent).toBe(rainFromLake.key);
  });

  it('falls back to the generic rule when ideas share a block', () => {
    const foxLikesMountain = idea({ subject: 'fox', relation: 'guard', object: 'stone', modifiers: ['huge'] }, 'other');
    const ps = validProposals('fuse', ctx({ idea: idea({ modifiers: ['huge'] }), listenerIdeas: [foxLikesMountain] }));
    // giant · live in · (stone is not a place; fox is not a place) -> no valid generic result
    expect(ps).toEqual([]);
    const giantGuardsStone = idea({ subject: 'giant', relation: 'guard', object: 'stone', modifiers: [] }, 'g');
    const fox = idea({ subject: 'fox', relation: 'liveIn', object: 'mountain', modifiers: ['guardMiners'] }, 'f');
    const gs = validProposals('fuse', ctx({ idea: giantGuardsStone, listenerIdeas: [fox] }));
    expect(gs.map((p) => `${p.shape.subject}|${p.shape.relation}|${p.shape.object}`).sort())
      .toEqual(['giant|guard|mountain']); // prefers a noun sharing a domain (mountain) over fox (forest)
  });

  it('needs another related idea in the listener head', () => {
    expect(validProposals('fuse', ctx({ listenerIdeas: [] }))).toEqual([]);
    const unrelated = idea({ subject: 'seabird', relation: 'help', object: 'whale', modifiers: [] }, 'u');
    expect(validProposals('fuse', ctx({ listenerIdeas: [unrelated] }))).toEqual([]);
  });
});
