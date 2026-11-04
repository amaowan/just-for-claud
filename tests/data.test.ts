import { describe, expect, it } from 'vitest';
import { getGameData, RAW_GAME_DATA } from '../src/gameData.ts';
import { loadGameData } from '../src/sim/data.ts';

describe('game data', () => {
  const data = getGameData();

  it('has the milestone-1 block counts', () => {
    expect(Object.values(data.nouns).filter((n) => !n.derived)).toHaveLength(12);
    expect(Object.values(data.relations)).toHaveLength(8);
    expect(Object.values(data.modifiers).filter((m) => !m.derived)).toHaveLength(10);
    expect(data.modifiers.sing.derived).toBeFalsy();
    expect(data.modifiers.sneeze.derived).toBeFalsy();
  });

  it('has two villages with 10 residents each and one merchant', () => {
    expect(data.villageIds).toEqual(['coast', 'mine']);
    expect(data.residents.coast).toHaveLength(10);
    expect(data.residents.mine).toHaveLength(10);
    expect(data.merchantIds).toHaveLength(1);
    const m = data.npcs[data.merchantIds[0]];
    const homes = new Set(data.ties[m.id].map((t) => data.npcs[t.to].home));
    expect(homes).toEqual(new Set(['coast', 'mine']));
  });

  it('every modifier upgrade chain has 2-3 levels', () => {
    for (const m of Object.values(data.modifiers).filter((x) => !x.derived && x.next)) {
      let levels = 1;
      let cur = m;
      while (cur.next) { cur = data.modifiers[cur.next]; levels++; }
      expect(levels).toBeGreaterThanOrEqual(2);
      expect(levels).toBeLessThanOrEqual(3);
    }
  });

  it('rejects broken data with a readable error', () => {
    const broken = { ...RAW_GAME_DATA, relations: (RAW_GAME_DATA.relations as object[]).slice(1) };
    expect(() => loadGameData(broken)).toThrow(/expected 8 relations/);
  });
});
