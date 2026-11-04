import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, idea, npc } from './helpers.ts';

describe('professionFilter', () => {
  it('a miner hears singing as knocking', () => {
    const ps = validProposals('professionFilter', ctx({ listener: npc({ profession: 'miner' }) }));
    expect(ps.map((p) => p.shape.modifiers)).toEqual([['knock']]);
    expect(ps[0].params.to).toBe('会敲击的');
  });

  it('can rewrite the relation', () => {
    const fox = idea({ subject: 'fox', relation: 'help', object: 'giant', modifiers: [] });
    const ps = validProposals('professionFilter', ctx({ idea: fox, listener: npc({ profession: 'miner' }) }));
    expect(ps.map((p) => p.shape.relation)).toEqual(['guard']);
  });

  it('needs the profession to relate to the idea domains', () => {
    // fisher cares about water/wind; giant/mountain/sing are mountain + human.
    expect(validProposals('professionFilter', ctx({ listener: npc({ profession: 'fisher' }) }))).toEqual([]);
  });
});
