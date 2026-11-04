// Ideas the player told (and the villages' originals), each with an expandable passing-on chain.
import { chainFor, describeMutation, listLineages, nameOf, topVersion } from '../sim/history.ts';
import { ideaText } from '../sim/text.ts';
import { coverage, type Sim } from '../sim/world.ts';
import { h } from './dom.ts';
import { pct } from './format.ts';

const PAGE = 300;

export function renderChains(sim: Sim, onlyMutations: boolean, setOnlyMutations: (v: boolean) => void, openSet: Set<string>): HTMLElement {
  const { data, world } = sim;
  const ui = data.text.ui;
  const toggle = h('input', { type: 'checkbox', checked: onlyMutations });
  toggle.addEventListener('change', () => setOnlyMutations(toggle.checked));
  const root = h('section', { class: 'panel chains' },
    h('h2', {}, ui.ideasTitle),
    h('label', { class: 'inline' }, toggle, ` ${ui.onlyMutations}`));

  const lineages = listLineages(sim);
  if (!world.playerLineages.length) root.append(h('p', { class: 'muted' }, ui.ideasEmpty));

  for (const { lineage, byPlayer } of lineages) {
    const origin = world.ideas[lineage];
    const details = h('details', { open: openSet.has(lineage) });
    details.addEventListener('toggle', () => { if (details.open) openSet.add(lineage); else openSet.delete(lineage); });
    details.append(h('summary', {}, `「${ideaText(origin, data)}」`, h('span', { class: 'muted' }, byPlayer ? ui.lineagePlayer : ui.lineageInitial)));

    // Current versions of this lineage per village.
    const current = h('ul', { class: 'current' });
    for (const v of data.villageIds) {
      const cores = Object.values(world.villageCores[v])
        .filter((c) => c.believers > 0 && world.coreLineage[c.core] === lineage)
        .sort((a, b) => b.believers - a.believers)
        .slice(0, 5);
      for (const c of cores) {
        const top = topVersion(sim, v, c.core);
        if (top) current.append(h('li', {}, `${data.villages[v].name} ${pct(coverage(sim, v, c.core))}：「${ideaText(top, data)}」`));
      }
    }
    details.append(h('h4', {}, ui.currentVersions), current);

    if (details.open) {
      const chain = chainFor(sim, lineage, onlyMutations);
      const ol = h('ol', { class: 'chain' });
      if (!chain.length) ol.append(h('li', { class: 'muted' }, ui.chainEmpty));
      for (const r of chain.slice(0, PAGE)) {
        const head = `第 ${r.day} 天 · ${nameOf(r.from, data)} → ${nameOf(r.to, data)}（${data.villages[r.village].name}）`;
        const before = ideaText(world.ideas[r.before], data);
        const after = ideaText(world.ideas[r.after], data);
        let body: string;
        if (r.from === 'player') body = `${ui.chainTold}「${before}」${r.accepted ? '' : ` · ${ui.chainRejected}`}`;
        else if (r.operator) body = `【${data.text.labels.operators[r.operator]}】「${before}」→「${after}」 ${describeMutation(r, sim)}`;
        else body = `${ui.chainSame}「${after}」`;
        ol.append(h('li', { class: r.operator ? 'mutated' : '' }, h('span', { class: 'muted' }, head), h('br'), body));
      }
      if (chain.length > PAGE) ol.append(h('li', { class: 'muted' }, ui.chainMore.replace('{count}', String(chain.length - PAGE))));
      details.append(ol);
    }
    root.append(details);
  }
  return root;
}
