import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, idea } from './helpers.ts';

describe('simplify', () => {
  it('drops a modifier from a 5-block idea', () => {
    const ps = validProposals('simplify', ctx({ idea: idea({ modifiers: ['sing', 'huge'] }) }));
    expect(ps.map((p) => p.shape.modifiers).sort()).toEqual([['huge'], ['sing']]);
  });

  it('leaves 4-block ideas alone', () => {
    expect(validProposals('simplify', ctx())).toEqual([]);
  });
});

describe('simplify only at the modifier cap', () => {
  it('requires 2 modifiers even if the block limit were lower', () => {
    expect(validProposals('simplify', ctx({ idea: idea({ modifiers: ['huge'] }) }))).toEqual([]);
  });
});
