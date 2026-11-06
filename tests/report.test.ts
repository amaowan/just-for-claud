import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/gameData.ts';
import { chainFor, describeMutation, listLineages } from '../src/sim/history.ts';
import { tellByPlayer } from '../src/sim/propagation.ts';
import { buildReport, takeSnapshot } from '../src/sim/report.ts';
import { advanceDays } from '../src/sim/simulate.ts';
import type { IdeaShape } from '../src/sim/types.ts';
import { createSim } from '../src/sim/world.ts';

const data = getGameData();
/** Multi-year simulations take a few seconds; allow slow CI machines. */
const LONG = 60_000;
const giant: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };

function plantedSim(seed: number) {
  const sim = createSim(data, seed);
  let tries = 0;
  while (tellByPlayer(sim, 'c07', giant).status === 'rejected' && tries++ < 20);
  return sim;
}

describe('report and chain', () => {
  it('a 5-year sleep produces a Chinese report with village sections', () => {
    const sim = plantedSim(42);
    const before = takeSnapshot(sim);
    advanceDays(sim, 1800);
    const report = buildReport(sim, before, true);
    expect(report.title).toBe('这些年发生了什么');
    expect(report.empty).toBe(false);
    expect(report.sections.some((s) => s.title === '海岸渔村')).toBe(true);
    for (const s of report.sections) for (const e of s.entries) expect(e).not.toMatch(/\{\w+\}/); // no unfilled placeholders
  }, LONG);

  it('the chain lists the player telling first and explains mutations', () => {
    const sim = plantedSim(7);
    advanceDays(sim, 120);
    const [lineage] = listLineages(sim);
    expect(lineage.byPlayer).toBe(true);
    const chain = chainFor(sim, lineage.lineage);
    expect(chain[0].from).toBe('player');
    const mutated = chainFor(sim, lineage.lineage, true);
    expect(mutated.length).toBeGreaterThan(0);
    for (const r of mutated.slice(0, 20)) expect(describeMutation(r, sim)).not.toMatch(/\{\w+\}/);
  });
});

describe('determinism', () => {
  it('the same seed gives byte-identical worlds after 3 years', () => {
    const a = plantedSim(123);
    const b = plantedSim(123);
    advanceDays(a, 1080);
    advanceDays(b, 1080);
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
  }, LONG);

  it('different seeds diverge', () => {
    const a = plantedSim(1);
    const b = plantedSim(2);
    advanceDays(a, 200);
    advanceDays(b, 200);
    expect(JSON.stringify(a.world.beliefs)).not.toBe(JSON.stringify(b.world.beliefs));
  });
});

describe('deity text', () => {
  it('quotes the version most people in the birth village believe', async () => {
    const { addBelief, registerIdea } = await import('../src/sim/world.ts');
    const sim = createSim(data, 2);
    const base = { subject: 'mountainGod', relation: 'like', object: 'song', modifiers: [], form: 'ritual' as const };
    const autumn = registerIdea(sim, { ...base, season: 'autumn' }, null, [], 0);
    const summer = registerIdea(sim, { ...base, season: 'summer' }, autumn.lineage, [autumn.key], 1);
    const before = takeSnapshot(sim);
    addBelief(sim, data.residents.mine[0], autumn, 'test');
    for (const id of data.residents.mine.slice(1, 7)) addBelief(sim, id, summer, 'test');
    sim.world.events.push({ type: 'deity', day: 1, core: summer.core, deity: 'mountainGod', villages: ['mine'] });
    const text = buildReport(sim, before, true).sections.flatMap((s) => s.entries).join('\n');
    expect(text).toContain('山神从「每到夏天，人们要为山神唱歌」里醒来');
  });
});
