import type { GameData } from '../sim/data.ts';
import type { Report } from '../sim/report.ts';
import { h } from './dom.ts';

export function renderReport(report: Report | null, data: GameData): HTMLElement {
  const root = h('section', { class: 'panel report' });
  if (!report) return root;
  root.append(h('h2', {}, report.title), h('p', { class: 'muted' }, report.range));
  if (report.empty) root.append(h('p', {}, data.text.report.nothing as string));
  for (const s of report.sections) {
    root.append(h('h3', {}, s.title));
    const ul = h('ul');
    for (const e of s.entries) ul.append(h('li', {}, e));
    root.append(ul);
  }
  return root;
}
