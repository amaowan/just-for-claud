import { describe, expect, it } from 'vitest';
import { getGameData } from '../../src/gameData.ts';
import { tellByPlayer } from '../../src/sim/propagation.ts';
import { buildReport, takeSnapshot } from '../../src/sim/report.ts';
import { advanceDays } from '../../src/sim/simulate.ts';
import type { TransmissionRecord } from '../../src/sim/types.ts';
import { createSim } from '../../src/sim/world.ts';
import { THREAD_COUNT, ThreadPalette } from '../../src/ui/palette.ts';
import { classifyEntry } from '../../src/ui/reportIcons.ts';
import { sampleSparks, sparkBudget } from '../../src/ui/sampling.ts';
import { along, computeLayout } from '../../src/ui/scene/layout.ts';

const data = getGameData();

describe('ThreadPalette', () => {
  it('gives each core a stable colour and reuses freed ones', () => {
    const p = new ThreadPalette();
    expect(p.indexOf('a')).toBe(0);
    expect(p.indexOf('b')).toBe(1);
    expect(p.indexOf('a')).toBe(0);
    p.retain(['b']);
    expect(p.indexOf('c')).toBe(0); // a's colour freed
    expect(p.indexOf('b')).toBe(1);
  });

  it('wraps around when there are more cores than colours', () => {
    const p = new ThreadPalette();
    for (let i = 0; i < THREAD_COUNT; i++) p.indexOf(`c${i}`);
    expect(p.indexOf('extra')).toBeLessThan(THREAD_COUNT);
  });
});

describe('scene layout', () => {
  for (const o of ['landscape', 'portrait'] as const) {
    it(`puts every resident inside its village panel (${o})`, () => {
      const L = computeLayout(data, o);
      for (const v of data.villageIds) {
        const r = L.panels[v];
        for (const id of data.residents[v]) {
          const p = L.nodes[id];
          expect(p.x).toBeGreaterThan(r.x + 20);
          expect(p.x).toBeLessThan(r.x + r.w - 20);
          expect(p.y).toBeGreaterThan(r.y + 20);
          expect(p.y).toBeLessThan(r.y + r.h - 20);
        }
      }
      expect(L.road[0]).toEqual(L.market.coast);
      expect(L.road.at(-1)).toEqual(L.market.mine);
    });
  }

  it('walks along the road by length', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(along(pts, 0)).toEqual({ x: 0, y: 0 });
    expect(along(pts, 0.5)).toEqual({ x: 10, y: 0 });
    expect(along(pts, 0.75)).toEqual({ x: 10, y: 5 });
    expect(along(pts, 1)).toEqual({ x: 10, y: 10 });
  });
});

describe('spark sampling', () => {
  const rec = (i: number, extra: Partial<TransmissionRecord> = {}): TransmissionRecord => ({
    day: 1, from: `c0${i}`, to: 'c01', village: 'coast', lineage: 'L', before: 'k', after: 'k', accepted: true, ...extra,
  });
  const home = (id: string) => (id === 't01' ? null : 'coast');

  it('keeps everything under budget', () => {
    const rs = [rec(1), rec(2)];
    expect(sampleSparks(rs, 3, home)).toBe(rs);
  });

  it('prefers mutations, then the traveller, then the merchant, keeping order', () => {
    const rs = [rec(1), rec(2, { operator: 'localize' }), rec(3), rec(4, { from: 'player' }), rec(5, { from: 't01' }), rec(6, { operator: 'deify' })];
    const picked = sampleSparks(rs, 3, home);
    expect(picked.map((r) => r.from)).toEqual(['c02', 'player', 'c06']);
  });

  it('shows fewer sparks at higher speed', () => {
    expect(sparkBudget(16)).toBeLessThan(sparkBudget(4));
    expect(sparkBudget(4)).toBeLessThan(sparkBudget(1));
  });
});

describe('report icon classifier', () => {
  it('recognises every line of a real 20-year report', () => {
    const sim = createSim(data, 42);
    tellByPlayer(sim, 'c01', { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' });
    const before = takeSnapshot(sim);
    advanceDays(sim, 7200);
    const report = buildReport(sim, before, true);
    const kinds = report.sections.flatMap((s) => s.entries.map((e) => classifyEntry(e, data)));
    expect(kinds).not.toContain('other');
    expect(kinds).toEqual(expect.arrayContaining(['custom', 'deity', 'manifest', 'mutation', 'placeName']));
  }, 60_000);
});
