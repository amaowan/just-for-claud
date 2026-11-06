import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/gameData.ts';
import { CONFIG } from '../src/sim/config.ts';
import { coreKey } from '../src/sim/idea.ts';
import {
  acceptanceProbability, effectiveStubbornness, listenerCount, mutationProbability, propagateDay, tellByPlayer,
} from '../src/sim/propagation.ts';
import { advanceDays } from '../src/sim/simulate.ts';
import type { IdeaShape } from '../src/sim/types.ts';
import {
  activeCores, addBelief, coverage, createSim, locationOf, registerIdea,
} from '../src/sim/world.ts';

const data = getGameData();
const giant: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };

describe('propagation formulas', () => {
  it('talkativeness maps to 1-3 listeners', () => {
    expect(listenerCount(0)).toBe(1);
    expect(listenerCount(0.5)).toBe(2);
    expect(listenerCount(1)).toBe(3);
  });

  it('acceptance = gullibility × trust × fit, × (1 − stubbornness) on conflict', () => {
    expect(acceptanceProbability(0.5, 0.8, 1.2, 0.5, false)).toBeCloseTo(0.48);
    expect(acceptanceProbability(0.5, 0.8, 1.2, 0.5, true)).toBeCloseTo(0.24);
    expect(acceptanceProbability(0.5, 0.8, 0.5, 0.9, false)).toBeCloseTo(0.2);
    expect(acceptanceProbability(1, 1, 1.2, 0, false)).toBe(1); // clamped
  });

  it('mutation = scale × (base + 0.4 × imagination + 0.3 × (1 − clarity))', () => {
    const { mutationScale: k, mutationBase: b } = CONFIG.propagation;
    expect(mutationProbability({ imagination: 0.5, stubbornness: 0.9 }, giant)).toBeCloseTo(k * (b + 0.2 + 0.3 * 0.15));
    expect(mutationProbability({ imagination: 0, stubbornness: 0 }, { ...giant, modifiers: [] })).toBeCloseTo(k * b);
  });
});

describe('daily propagation', () => {
  it('the player can plant an idea; a refusal leaves no belief', () => {
    for (let seed = 0; seed < 20; seed++) {
      const sim = createSim(data, seed);
      const r = tellByPlayer(sim, 'c03', giant);
      const has = !!sim.world.beliefs.c03[coreKey(giant)];
      expect(has).toBe(r.status === 'accepted');
      expect(sim.world.history.at(-1)).toMatchObject({ from: 'player', to: 'c03', accepted: r.status === 'accepted' });
    }
  });

  it('the player is believed at least 75% of the time (floor 0.8), even by a skeptic', () => {
    let accepted = 0;
    const n = 400;
    for (let seed = 0; seed < n; seed++) {
      // 老贝: gullibility 0.2 -> formula alone gives 0.2 × 0.8 × 1.0 = 16%.
      if (tellByPlayer(createSim(data, seed), 'c02', giant).status === 'accepted') accepted++;
    }
    expect(accepted / n).toBeGreaterThan(0.75);
    expect(accepted / n).toBeLessThan(0.86); // floor 0.8; 400 trials: about ±2% noise
  });

  it('believers of the original village belief are extra stubborn about it', () => {
    const sim = createSim(data, 11);
    const original = sim.world.ideas[sim.initialLocal.coast[0].lineage];
    const holder = data.residents.coast.find((id) => sim.world.beliefs[id][original.core])!;
    const variant = registerIdea(sim, { ...original, subject: 'rainSpirit' }, original.lineage, [original.key], 1);
    expect(effectiveStubbornness(sim, holder, [original])).toBeGreaterThanOrEqual(CONFIG.tradition.stubbornness);
    // A mutated offshoot does not get the bonus.
    expect(effectiveStubbornness(sim, holder, [variant])).toBe(data.npcs[holder].stubbornness);
  });

  it('an idea spreads through the village over a month', () => {
    const sim = createSim(data, 1);
    const idea = registerIdea(sim, giant, null, [], 0);
    addBelief(sim, 'c07', idea, 'player');
    advanceDays(sim, 30);
    const lineageBelievers = data.residents.coast.filter((id) => {
      const b = sim.world.beliefs[id];
      return Object.values(b).some((x) => sim.world.ideas[x.ideaKey].lineage === idea.lineage);
    });
    expect(lineageBelievers.length).toBeGreaterThan(2);
    expect(sim.world.history.length).toBeGreaterThan(0);
  });

  it('the merchant alternates villages every 10 days', () => {
    const sim = createSim(data, 1);
    expect(locationOf(sim, 't01', 0)).toBe('coast');
    expect(locationOf(sim, 't01', 9)).toBe('coast');
    expect(locationOf(sim, 't01', 10)).toBe('mine');
    expect(locationOf(sim, 't01', 20)).toBe('coast');
    expect(locationOf(sim, 'c01', 10)).toBe('coast');
  });

  it('the merchant carries ideas to the other village', () => {
    const sim = createSim(data, 3);
    const idea = registerIdea(sim, giant, null, [], 0);
    addBelief(sim, 't01', idea, 'player');
    advanceDays(sim, 60);
    const mineHasIt = Object.values(sim.world.villageCores.mine).some(
      (c) => c.believers > 0 && sim.world.coreLineage[c.core] === idea.lineage,
    );
    expect(mineHasIt).toBe(true);
  });

  it('hearing the same core again resets freshness to 1, even a different version', () => {
    const sim = createSim(data, 5);
    const idea = registerIdea(sim, giant, null, [], 0);
    addBelief(sim, 'c02', idea, 'player');
    sim.world.beliefs.c02[idea.core].heat = 0.1;
    expect(tellByPlayer(sim, 'c02', giant).status).toBe('already');
    expect(sim.world.beliefs.c02[idea.core].heat).toBe(1);
    sim.world.beliefs.c02[idea.core].heat = 0.1;
    tellByPlayer(sim, 'c02', { ...giant, modifiers: [] }); // same core, other version
    expect(sim.world.beliefs.c02[idea.core].heat).toBe(1);
  });

  it('chaos cap: a new core evicts the least-believed one', () => {
    const sim = createSim(data, 9);
    const residents = data.residents.coast;
    const fillers: IdeaShape[] = [];
    for (const s of ['giant', 'whale', 'fox', 'seabird']) {
      for (const o of ['mountain', 'sea', 'skyLake']) fillers.push({ subject: s, relation: 'liveIn', object: o, modifiers: [], form: 'statement' });
    }
    // The initial "rain comes from the sky lake" is already active: add 11 more to reach 12.
    fillers.slice(0, 11).forEach((shape, i) => {
      const idea = registerIdea(sim, shape, null, [], 0);
      const holders = i === 0 ? 1 : 2; // the first filler is the least believed
      for (let k = 0; k < holders; k++) addBelief(sim, residents[(i + k) % residents.length], idea, 'test');
    });
    expect(activeCores(sim, 'coast')).toHaveLength(12);
    const weakest = coreKey(fillers[0]);
    const newcomer = registerIdea(sim, { subject: 'giant', relation: 'like', object: 'song', modifiers: [], form: 'statement' }, null, [], 0);
    const listener = residents[5]; // does not hold the weakest core; nothing it holds conflicts
    // Force acceptance via the player path with a gullible listener.
    let tries = 0;
    while (!sim.world.beliefs[listener][newcomer.core] && tries++ < 50) tellByPlayer(sim, listener, newcomer);
    expect(sim.world.beliefs[listener][newcomer.core]).toBeDefined();
    expect(coverage(sim, 'coast', weakest)).toBe(0);
    expect(activeCores(sim, 'coast').length).toBeLessThanOrEqual(12);
    expect(sim.world.events.some((e) => e.type === 'evicted' && e.core === weakest)).toBe(true);
  });

  it('a day only touches state deterministically', () => {
    const a = createSim(data, 77);
    const b = createSim(data, 77);
    tellByPlayer(a, 'c07', giant);
    tellByPlayer(b, 'c07', giant);
    for (let i = 0; i < 40; i++) { propagateDay(a); propagateDay(b); }
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
  });
});
