import { CONFIG, DAYS_PER_YEAR } from '../sim/config.ts';
import type { GameData } from '../sim/data.ts';
import { fill } from '../sim/text.ts';
import type { Season } from '../sim/types.ts';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function seasonOfDay(day: number): Season {
  const month = Math.floor((day % DAYS_PER_YEAR) / CONFIG.calendar.daysPerMonth);
  let s = 0;
  CONFIG.calendar.seasonStartMonths.forEach((start, i) => { if (month >= start) s = i; });
  return SEASONS[s];
}

export function clockText(day: number, data: GameData): string {
  return fill(data.text.ui.clock, {
    day,
    year: Math.floor(day / DAYS_PER_YEAR) + 1,
    season: data.text.sentence.seasons[seasonOfDay(day)],
  });
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
