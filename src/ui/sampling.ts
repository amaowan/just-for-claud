// Which retellings get a visible spark. At high speed we only show a sample.

import type { TransmissionRecord } from '../sim/types.ts';

/**
 * Keep at most `max` records: mutations first, then the traveller's tellings, then
 * cross-village news, then the rest, preserving the original order within each group.
 */
export function sampleSparks(records: TransmissionRecord[], max: number, homeOf: (id: string) => string | null): TransmissionRecord[] {
  if (records.length <= max) return records;
  const rank = (r: TransmissionRecord) => {
    if (r.operator) return 0;
    if (r.from === 'player') return 1;
    if (homeOf(r.from) === null || homeOf(r.to) === null) return 2;
    return 3;
  };
  const picked = records.map((r, i) => ({ r, i, k: rank(r) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i);
  return picked.map((p) => p.r);
}

/**
 * How many sparks one simulated day may show at a given speed. Faster speeds run more
 * days per second, so each day gets fewer sparks to keep roughly 10–15 on screen per second.
 */
export function sparkBudget(speed: number): number {
  if (speed >= 16) return 1;
  if (speed >= 4) return 3;
  return 12;
}

/** Real milliseconds per simulated day. */
export function dayMs(speed: number): number {
  return speed > 0 ? 1100 / speed : Infinity;
}

/** How long a spark takes to fly, in real milliseconds. */
export function sparkMs(speed: number): number {
  if (speed >= 16) return 450;
  if (speed >= 4) return 600;
  return 850;
}
