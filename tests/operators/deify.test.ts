import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, idea } from './helpers.ts';

describe('deify', () => {
  const awe = idea({ modifiers: ['huge'] });

  it('turns the giant into the mountain god when widely believed', () => {
    const ps = validProposals('deify', ctx({ idea: awe, coverage: () => 0.6 }));
    expect(ps.map((p) => p.shape.subject)).toEqual(['mountainGod']);
  });

  it('needs high coverage', () => {
    expect(validProposals('deify', ctx({ idea: awe, coverage: () => 0.2 }))).toEqual([]);
  });

  it('needs an awe tone', () => {
    // "sing" is joyful
    expect(validProposals('deify', ctx({ idea: idea(), coverage: () => 1 }))).toEqual([]);
  });
});
