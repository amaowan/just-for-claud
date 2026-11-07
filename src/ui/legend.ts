// 丝线图例: each idea core alive anywhere, its colour, and how far it has spread per village.
import { topVersion } from '../sim/history.ts';
import { ideaText } from '../sim/text.ts';
import { coverage, type Sim } from '../sim/world.ts';
import { h } from './dom.ts';
import type { ThreadPalette } from './palette.ts';

const MAX_ROWS = 8;

export function renderLegend(sim: Sim, palette: ThreadPalette): HTMLElement {
  const { data, world } = sim;
  const ui = data.text.ui;
  const cores = new Map<string, number>();
  for (const v of data.villageIds) {
    for (const vc of Object.values(world.villageCores[v])) {
      if (vc.believers > 0) cores.set(vc.core, (cores.get(vc.core) ?? 0) + vc.believers);
    }
  }
  const rows = [...cores].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, MAX_ROWS);
  const list = h('ul');
  for (const [core] of rows) {
    const v0 = data.villageIds.find((v) => (world.villageCores[v][core]?.believers ?? 0) > 0)!;
    const top = topVersion(sim, v0, core);
    const color = palette.color(core);
    const bars = h('div', { class: 'bars' });
    for (const v of data.villageIds) {
      const cov = coverage(sim, v, core);
      const bar = h('span', { class: 'bar', style: `color:${color}` }, h('i', { style: `width:${Math.round(cov * 100)}%` }));
      bars.append(h('span', { style: 'flex:1' }, `${data.villages[v].name.slice(-2)} ${Math.round(cov * 100)}%`, bar));
    }
    list.append(h('li', {},
      h('span', { class: 'thread', style: `color:${color}` }),
      h('div', {}, h('div', {}, top ? ideaText(top, data) : core), bars)));
  }
  return h('section', { class: 'card legend' },
    h('h2', {}, ui.legendTitle),
    rows.length ? list : h('p', { class: 'muted' }, ui.legendEmpty));
}
