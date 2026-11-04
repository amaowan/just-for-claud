import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng.ts';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const sa = Array.from({ length: 5 }, () => a.next());
    const sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it('can be restored from saved state', () => {
    const a = new Rng('seed');
    a.next();
    const b = new Rng(a.getState());
    for (let i = 0; i < 20; i++) expect(b.next()).toBe(a.next());
  });

  it('stays in [0, 1) and int stays in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.int(3);
      expect(n === 0 || n === 1 || n === 2).toBe(true);
    }
  });

  it('weightedSample never returns duplicates and skips zero weights when possible', () => {
    const r = new Rng(3);
    for (let i = 0; i < 50; i++) {
      const s = r.weightedSample(['a', 'b', 'c'], [1, 0, 1], 2);
      expect(new Set(s).size).toBe(2);
      expect(s).not.toContain('b');
    }
  });
});
