import { describe, expect, it } from 'vitest';
import { validProposals } from '../../src/sim/operators/index.ts';
import { ctx, idea, npc } from './helpers.ts';

describe('comedify', () => {
  const child = npc({ age: 'child' });

  it('a child adds a funny modifier when below the cap', () => {
    const ps = validProposals('comedify', ctx({ listener: child }));
    expect(ps.length).toBeGreaterThan(0);
    expect(ps.every((p) => p.shape.modifiers.length === 2 && p.shape.modifiers[0] === 'sing')).toBe(true);
    expect(ps.map((p) => p.shape.modifiers[1])).toContain('sneeze');
  });

  it('replaces a modifier when already at 2, never exceeding the cap', () => {
    const full = idea({ modifiers: ['sing', 'huge'] });
    const ps = validProposals('comedify', ctx({ idea: full, listener: child }));
    expect(ps.length).toBeGreaterThan(0);
    expect(ps.every((p) => p.shape.modifiers.length === 2)).toBe(true);
  });

  it('adults hearing a serious idea do not comedify', () => {
    expect(validProposals('comedify', ctx({ listener: npc({ age: 'elder' }) }))).toEqual([]);
  });

  it('comic ideas get sillier for anyone', () => {
    const ps = validProposals('comedify', ctx({ idea: idea({ modifiers: ['sneeze'] }), listener: npc({ age: 'elder' }) }));
    expect(ps.length).toBeGreaterThan(0);
  });
});
