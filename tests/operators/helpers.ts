import { getGameData } from '../../src/gameData.ts';
import { coreKey, shapeKey } from '../../src/sim/idea.ts';
import type { OperatorContext } from '../../src/sim/operators/index.ts';
import type { Idea, IdeaShape, Npc } from '../../src/sim/types.ts';

export const data = getGameData();

export function idea(s: Partial<IdeaShape> = {}, lineage = 'L'): Idea {
  const shape: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement', ...s };
  return { ...shape, key: shapeKey(shape), core: coreKey(shape), lineage, parents: [], bornDay: 0 };
}

export function npc(over: Partial<Npc> = {}): Npc {
  return {
    id: 'x', name: '测试', home: 'coast', gullibility: 0.5, stubbornness: 0.5,
    talkativeness: 0.5, imagination: 0.5, profession: 'weaver', age: 'adult', ...over,
  };
}

export function ctx(over: Partial<OperatorContext> = {}): OperatorContext {
  return {
    data,
    idea: idea(),
    teller: npc({ id: 'teller' }),
    listener: npc({ id: 'listener' }),
    village: data.villages.coast,
    coverage: () => 0,
    listenerIdeas: [],
    ...over,
  };
}
