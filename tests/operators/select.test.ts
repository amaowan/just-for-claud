import { describe, expect, it } from 'vitest';
import { chooseMutation } from '../../src/sim/operators/index.ts';
import { Rng } from '../../src/sim/rng.ts';
import { ctx, npc } from './helpers.ts';

describe('chooseMutation', () => {
  it('only picks qualifying operators and is deterministic', () => {
    const c = ctx({ listener: npc({ age: 'child', imagination: 0.9 }) });
    const a = Array.from({ length: 30 }, (_, i) => chooseMutation(c, new Rng(i))?.op);
    const b = Array.from({ length: 30 }, (_, i) => chooseMutation(c, new Rng(i))?.op);
    expect(a).toEqual(b);
    // weaver hears 会唱歌的 as 会织布的, so professionFilter also qualifies.
    expect(new Set(a)).toEqual(new Set(['localize', 'exaggerate', 'comedify', 'professionFilter']));
  });
});

describe('no operator twice in a row', () => {
  it('a version made by comedify cannot be comedified again, but other operators still apply', async () => {
    const { validProposals } = await import('../../src/sim/operators/index.ts');
    const { idea } = await import('./helpers.ts');
    const made = { ...idea({ modifiers: ['sing', 'sneeze'] }), viaOp: 'comedify' as const };
    const child = npc({ age: 'child' });
    expect(validProposals('comedify', ctx({ idea: made, listener: child }))).toEqual([]);
    expect(validProposals('simplify', ctx({ idea: made, listener: child })).length).toBeGreaterThan(0);
    const simplified = { ...idea({ modifiers: ['sing', 'huge'] }), viaOp: 'simplify' as const };
    expect(validProposals('simplify', ctx({ idea: simplified }))).toEqual([]);
  });
});
