import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/gameData.ts';
import {
  beliefsConflict, clarity, coreKey, fitOf, ideaDomains, ideaTone, isValidShape, shapeKey,
} from '../src/sim/idea.ts';
import { ideaText } from '../src/sim/text.ts';
import type { Idea, IdeaShape } from '../src/sim/types.ts';

const data = getGameData();
const giant: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: ['sing'], form: 'statement' };
const asIdea = (s: IdeaShape, lineage = 'L1'): Idea => ({ ...s, key: shapeKey(s), core: coreKey(s), lineage, parents: [], bornDay: 0 });

describe('idea helpers', () => {
  it('core ignores modifiers, key does not', () => {
    const plain = { ...giant, modifiers: [] };
    expect(coreKey(giant)).toBe(coreKey(plain));
    expect(shapeKey(giant)).not.toBe(shapeKey(plain));
  });

  it('clarity drops with more blocks', () => {
    expect(clarity({ ...giant, modifiers: [] })).toBe(1);
    expect(clarity(giant)).toBeCloseTo(0.85);
    expect(clarity({ ...giant, modifiers: ['sing', 'huge'] })).toBeCloseTo(0.7);
  });

  it('tone comes from the first modifier, else the subject', () => {
    expect(ideaTone(giant, data)).toBe('joy');
    expect(ideaTone({ ...giant, modifiers: [] }, data)).toBe('awe');
    expect(ideaTone({ ...giant, modifiers: ['sneeze'] }, data)).toBe('comic');
  });

  it('collects domains of all nouns and modifiers', () => {
    expect([...ideaDomains(giant, data)].sort()).toEqual(['human', 'mountain']);
  });

  it('renders Chinese sentences', () => {
    expect(ideaText(giant, data)).toBe('山里住着会唱歌的巨人');
    expect(ideaText({ subject: 'mountainGod', relation: 'like', object: 'song', modifiers: [], form: 'ritual', season: 'spring' }, data))
      .toBe('每到春天，人们要为山神唱歌');
    expect(ideaText({ subject: 'giant', relation: 'can', object: 'rain', modifiers: ['sing'], form: 'statement' }, data))
      .toBe('会唱歌的巨人能唤雨');
  });

  it('validates shapes against the compatibility table', () => {
    expect(isValidShape(giant, data)).toBe(true);
    expect(isValidShape({ ...giant, object: 'song' }, data)).toBe(false); // live in a song
    expect(isValidShape({ ...giant, modifiers: ['sing', 'sing2'] }, data)).toBe(false); // same chain twice
  });

  it('detects listener conflicts', () => {
    const a = asIdea(giant);
    expect(beliefsConflict(a, asIdea({ ...giant, modifiers: [] }, 'other'), data)).toBe(true); // same core
    expect(beliefsConflict(a, asIdea({ ...giant, subject: 'whale', object: 'sea' }), data)).toBe(true); // same lineage
    const likes = asIdea({ subject: 'giant', relation: 'like', object: 'song', modifiers: [], form: 'statement' }, 'X');
    const fears = asIdea({ ...likes, relation: 'fear' }, 'Y');
    expect(beliefsConflict(likes, fears, data)).toBe(true); // inverse relation
    expect(beliefsConflict(likes, asIdea(giant, 'Z'), data)).toBe(false);
  });

  it('computes village fit', () => {
    const coast = data.villages.coast;
    const mine = data.villages.mine;
    const idea = asIdea(giant);
    expect(fitOf(idea, coast, [{ core: 'rain|comeFrom|skyLake|statement', lineage: 'init' }], data)).toBe('neutral');
    expect(fitOf(idea, mine, [], data)).toBe('match'); // giant is a mountain thing
    expect(fitOf(idea, coast, [{ core: 'whale|liveIn|sea|statement', lineage: 'L1' }], data)).toBe('conflict');
  });
});
