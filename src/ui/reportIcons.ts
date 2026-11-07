// Small SVG icons for the tapestry report. Each report line is matched back to the
// template (data/text/report.json) that produced it, so the simulation stays untouched.

import type { GameData } from '../sim/data.ts';

export type EntryKind =
  | 'arrival' | 'newCore' | 'rumor' | 'common' | 'custom' | 'festival' | 'placeName' | 'rename'
  | 'coverageChange' | 'forgotten' | 'evicted' | 'deity' | 'mutation'
  | 'manifest' | 'other';

const SIMPLE: EntryKind[] = [
  'festival', 'custom', 'rename', 'placeName', 'deity', 'mutation', 'arrival', 'common', 'rumor',
  'coverageChange', 'evicted', 'forgotten', 'newCore',
];

function templateRegex(template: string): RegExp {
  const parts = template.split(/\{\w+\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('[\\s\\S]+?')}`);
}

const cache = new WeakMap<GameData, { kind: EntryKind; re: RegExp }[]>();

function matchers(data: GameData) {
  let list = cache.get(data);
  if (list) return list;
  const t = data.text.report;
  list = [];
  for (const kind of SIMPLE) {
    const tpl = t[kind];
    if (typeof tpl === 'string') list.push({ kind, re: templateRegex(tpl) });
  }
  for (const tpl of Object.values(t.manifest)) list.push({ kind: 'manifest', re: templateRegex(tpl) });
  cache.set(data, list);
  return list;
}

export function classifyEntry(entry: string, data: GameData): EntryKind {
  for (const m of matchers(data)) if (m.re.test(entry)) return m.kind;
  return 'other';
}

/** 24×24 line icons, drawn with currentColor. */
export const ICON_PATHS: Record<EntryKind, string> = {
  festival: 'M12 3v2M7 7h10l-1 9H8zM9 16v3M15 16v3M5 21h14M10 10h4',
  custom: 'M12 2v3M8 5h8a3 3 0 0 1 3 3v6a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V8a3 3 0 0 1 3-3zM12 19v3',
  placeName: 'M6 21V4M6 4h11l-2 3 2 3H6',
  rename: 'M6 21V4M6 4h11l-2 3 2 3H6M14 15l4 4M18 15l-4 4',
  deity: 'M12 2l2.2 6.6H21l-5.5 4 2.1 6.6L12 15l-5.6 4.2 2.1-6.6L3 8.6h6.8z',
  mutation: 'M4 18c4-10 12-10 16 0M8 8c1-3 7-3 8 0M12 3v2',
  arrival: 'M3 17h18M5 17l2-6h10l2 6M9 11V7h6v4M8 20h.01M16 20h.01',
  common: 'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-4 3-6 5-6s5 2 5 6M12 20c0-4 3-6 5-6s5 2 5 6',
  rumor: 'M4 5h16v10H9l-5 4zM8 9h8M8 12h5',
  coverageChange: 'M4 20V10M10 20V6M16 20v-8M22 20H2',
  evicted: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM6 6l12 12',
  forgotten: 'M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10zM9 14h6',
  newCore: 'M12 3v18M3 12h18M6 6l12 12M18 6L6 18',
  manifest: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
  other: 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
};
