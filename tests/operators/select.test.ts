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
