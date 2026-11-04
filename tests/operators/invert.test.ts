import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, idea, npc } from './helpers.ts';

describe('invert', () => {
  const likes = idea({ relation: 'like', object: 'song', modifiers: [] });

  it('a skeptic flips "likes" into "fears"', () => {
    const ps = validProposals('invert', ctx({ idea: likes, teller: npc({ gullibility: 0.1 }) }));
    expect(ps.map((p) => p.shape.relation)).toEqual(['fear']);
  });

  it('believers do not invert', () => {
    expect(validProposals('invert', ctx({ idea: likes, teller: npc({ gullibility: 0.8 }) }))).toEqual([]);
  });

  it('relations without an inverse are never inverted', () => {
    expect(validProposals('invert', ctx({ teller: npc({ gullibility: 0 }) }))).toEqual([]);
  });

  it('the player never inverts', () => {
    expect(validProposals('invert', ctx({ idea: likes, teller: null }))).toEqual([]);
  });
});
