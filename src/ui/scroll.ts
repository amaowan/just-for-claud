// 织锦卷轴: the change report, unrolled slowly, one icon per line.
import type { GameData } from '../sim/data.ts';
import type { Report } from '../sim/report.ts';
import { h } from './dom.ts';
import { classifyEntry, ICON_PATHS } from './reportIcons.ts';
import { s } from './scene/svg.ts';

function icon(kind: keyof typeof ICON_PATHS): SVGSVGElement {
  return s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: ICON_PATHS[kind] }));
}

export function renderScroll(report: Report | null, data: GameData): HTMLElement {
  const root = h('section', { class: 'scroll', 'aria-live': 'polite' });
  if (!report) return root;
  const inner = h('div', { class: 'inner' },
    h('h2', { class: 'scroll-title' }, report.title),
    h('p', { class: 'range' }, report.range));
  if (report.empty) inner.append(h('p', { style: 'text-align:center' }, data.text.report.nothing as string));
  let i = 0;
  for (const sec of report.sections) {
    inner.append(h('h3', {}, sec.title));
    const ul = h('ul');
    for (const e of sec.entries) {
      const li = h('li', { style: `transition-delay:${(0.6 + i++ * 0.12).toFixed(2)}s` }, icon(classifyEntry(e, data)), h('span', {}, e));
      ul.append(li);
    }
    inner.append(ul);
  }
  root.append(h('div', { class: 'rod' }), h('div', { class: 'cloth' }, inner), h('div', { class: 'rod' }));
  return root;
}

/** Start unrolling (after it is in the DOM). */
export function unroll(scroll: HTMLElement): void {
  requestAnimationFrame(() => requestAnimationFrame(() => scroll.classList.add('open')));
}
