import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, data, idea } from './helpers.ts';

describe('localize', () => {
  it('turns mountain things into sea things in the fishing village', () => {
    const subjects = validProposals('localize', ctx()).map((p) => `${p.shape.subject}/${p.shape.object}`);
    expect(subjects.sort()).toEqual(['giant/sea', 'whale/mountain']);
  });

  it('only changes the slot whose domain is foreign', () => {
    // whale (water) is local in the coast; only the mountain is foreign.
    const ps = validProposals('localize', ctx({ idea: idea({ subject: 'whale' }) }));
    expect(ps.map((p) => p.shape.object)).toEqual(['sea']);
    expect(ps.every((p) => p.shape.subject === 'whale')).toBe(true);
  });

  it('does nothing when everything is already local', () => {
    expect(validProposals('localize', ctx({ village: data.villages.mine }))).toEqual([]);
  });
});
