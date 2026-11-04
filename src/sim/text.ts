// Template rendering. All Chinese text comes from data/text/*.json.

import type { GameData } from './data.ts';
import type { IdeaShape, Season } from './types.ts';

export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Subject with its modifiers, e.g. 会唱歌的巨人. */
export function subjectPhrase(s: IdeaShape, data: GameData): string {
  const mods = s.modifiers.map((m) => data.modifiers[m].text).join(data.text.sentence.modifierJoiner);
  return mods + data.nouns[s.subject].text;
}

export function seasonText(season: Season | undefined, data: GameData, short = false): string {
  const table = short ? data.text.sentence.seasonShort : data.text.sentence.seasons;
  return season ? table[season] : '';
}

/** The full Chinese sentence for an idea. */
export function ideaText(s: IdeaShape, data: GameData): string {
  const t = data.text.sentence;
  const obj = data.nouns[s.object];
  const params: Record<string, string> = {
    S: subjectPhrase(s, data),
    O: obj.text,
    ability: obj.ability ?? obj.text,
    season: seasonText(s.season, data),
  };
  if (s.form === 'ritual') {
    params.act = obj.act ?? fill(t.ritualDefaultAct[s.relation] ?? '{O}', params);
    return fill(t.ritual[s.relation], params);
  }
  return fill(t.statement[s.relation], params);
}
