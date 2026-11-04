import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, idea } from './helpers.ts';

describe('personify', () => {
  it('turns the wind into a wind spirit', () => {
    const wind = idea({ subject: 'wind', relation: 'steal', object: 'song', modifiers: [] });
    const ps = validProposals('personify', ctx({ idea: wind }));
    expect(ps.map((p) => p.shape.subject)).toEqual(['windSpirit']);
  });

  it('ignores concrete subjects', () => {
    expect(validProposals('personify', ctx())).toEqual([]);
  });
});
