import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, idea, npc } from './helpers.ts';

describe('exaggerate', () => {
  it('upgrades a modifier for imaginative listeners', () => {
    const ps = validProposals('exaggerate', ctx({ listener: npc({ imagination: 0.8 }) }));
    expect(ps.map((p) => p.shape.modifiers)).toEqual([['sing2']]);
  });

  it('needs high imagination', () => {
    expect(validProposals('exaggerate', ctx({ listener: npc({ imagination: 0.3 }) }))).toEqual([]);
  });

  it('does not apply to comic ideas or maxed chains', () => {
    const l = npc({ imagination: 1 });
    expect(validProposals('exaggerate', ctx({ listener: l, idea: idea({ modifiers: ['sneeze'] }) }))).toEqual([]);
    expect(validProposals('exaggerate', ctx({ listener: l, idea: idea({ modifiers: ['sing3'] }) }))).toEqual([]);
  });
});
