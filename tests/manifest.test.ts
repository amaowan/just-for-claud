import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/gameData.ts';
import { DAYS_PER_YEAR } from '../src/sim/config.ts';
import { manifestKindOf, shouldManifest } from '../src/sim/manifest.ts';
import { updateSediment } from '../src/sim/sediment.ts';
import type { IdeaShape } from '../src/sim/types.ts';
import { addBelief, createSim, registerIdea, villageCore } from '../src/sim/world.ts';

const data = getGameData();

describe('manifestation by relation', () => {
  it('maps each relation to its result type (GDD 成真的多种形态)', () => {
    const expected: Record<string, string> = {
      liveIn: 'beingOrPlace', can: 'skill', comeFrom: 'item', guard: 'charm',
      like: 'ritual', fear: 'taboo', help: 'companion', steal: 'prank',
    };
    for (const [rel, kind] of Object.entries(expected)) {
      expect(manifestKindOf(`fox|${rel}|stone|statement`, data)).toBe(kind);
    }
  });

  it('needs 50% coverage held for 5 years', () => {
    const vc = { core: 'fox|guard|stone|statement', believers: 5, mentions: 0, manifestSince: 0 };
    expect(shouldManifest(vc, 5 * DAYS_PER_YEAR - 30, data)).toBe(false);
    expect(shouldManifest(vc, 5 * DAYS_PER_YEAR, data)).toBe(true);
    expect(shouldManifest({ ...vc, manifestSince: undefined }, 99999, data)).toBe(false);
  });

  it('"likes" manifests through customs, not as a separate result', () => {
    const vc = { core: 'giant|like|song|statement', believers: 5, mentions: 0, manifestSince: 0 };
    expect(shouldManifest(vc, 10 * DAYS_PER_YEAR, data)).toBe(false);
  });

  it('emits a manifest event in the simulation', () => {
    const sim = createSim(data, 1);
    const shape: IdeaShape = { subject: 'fox', relation: 'guard', object: 'stone', modifiers: [], form: 'statement' };
    const idea = registerIdea(sim, shape, null, [], 0);
    for (const id of data.residents.mine.slice(0, 5)) addBelief(sim, id, idea, 'test');
    for (let m = 1; m <= 61; m++) {
      sim.world.day = m * 30;
      for (const id of data.residents.mine) for (const b of Object.values(sim.world.beliefs[id])) { b.lastMentionDay = sim.world.day; b.lastEchoDay = sim.world.day; }
      updateSediment(sim);
    }
    expect(villageCore(sim, 'mine', idea.core).manifestDay).toBeDefined();
    expect(sim.world.events.some((e) => e.type === 'manifest' && e.kind === 'charm')).toBe(true);
  });
});
