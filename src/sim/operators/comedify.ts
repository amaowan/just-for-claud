// 滑稽化: children (or comic ideas) add a funny modifier, replacing one if already at the cap.
import { CONFIG } from '../config.ts';
import { ideaTone } from '../idea.ts';
import type { GameData } from '../data.ts';
import type { ModifierBlock } from '../types.ts';
import type { Operator, Proposal } from './types.ts';
import { baseShape } from './types.ts';

const comicCache = new WeakMap<GameData, ModifierBlock[]>();
function comicModifiers(data: GameData): ModifierBlock[] {
  let list = comicCache.get(data);
  if (!list) {
    list = Object.values(data.modifiers).filter((m) => m.tone === 'comic' && m.level === 1);
    comicCache.set(data, list);
  }
  return list;
}

export const comedify: Operator = {
  id: 'comedify',
  propose(ctx) {
    const { data, idea, listener } = ctx;
    if (listener.age !== 'child' && ideaTone(idea, data) !== 'comic') return [];
    const families = new Set(idea.modifiers.map((m) => data.modifiers[m].family));
    const pool = comicModifiers(data).filter((m) => !families.has(m.family));
    const out: Proposal[] = [];
    const subject = data.nouns[idea.subject].text;
    if (idea.modifiers.length < CONFIG.idea.maxModifiers) {
      for (const c of pool) {
        const shape = baseShape(idea);
        shape.modifiers.push(c.id);
        out.push({ shape, params: { from: subject, to: c.text + subject } });
      }
      return out;
    }
    const nonComic = idea.modifiers.map((m, i) => [m, i] as const).filter(([m]) => data.modifiers[m].tone !== 'comic');
    const replaceable = nonComic.length ? nonComic : idea.modifiers.map((m, i) => [m, i] as const);
    for (const [m, i] of replaceable) {
      for (const c of pool) {
        const shape = baseShape(idea);
        shape.modifiers[i] = c.id;
        out.push({ shape, params: { from: data.modifiers[m].text + subject, to: c.text + subject } });
      }
    }
    return out;
  },
};
