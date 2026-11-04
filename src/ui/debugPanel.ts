// Who believes what, and each village's idea cores.
import { topVersion } from '../sim/history.ts';
import { ideaText } from '../sim/text.ts';
import { manifestKindOf } from '../sim/manifest.ts';
import { stageOf } from '../sim/report.ts';
import { believedIdeas, coverage, locationOf, type Sim } from '../sim/world.ts';
import { h } from './dom.ts';
import { pct } from './format.ts';

export function renderDebug(sim: Sim, open: boolean, setOpen: (v: boolean) => void): HTMLElement {
  const { data, world } = sim;
  const ui = data.text.ui;
  const L = data.text.labels;
  const details = h('details', { class: 'panel debug', open });
  details.addEventListener('toggle', () => setOpen(details.open));
  details.append(h('summary', {}, ui.debugTitle));
  if (!open) return details;

  const npcTable = h('table', {},
    h('thead', {}, h('tr', {}, ...[ui.colName, ui.colWhere, ui.colJob, ui.colTraits, ui.colBeliefs].map((c) => h('th', {}, c)))));
  const tbody = h('tbody');
  for (const id of data.npcIds) {
    const n = data.npcs[id];
    const beliefs = h('ul');
    for (const idea of believedIdeas(sim, id)) {
      beliefs.append(h('li', {}, `${ideaText(idea, data)}（${world.beliefs[id][idea.core].heat.toFixed(2)}）`));
    }
    tbody.append(h('tr', {},
      h('td', {}, n.name),
      h('td', {}, data.villages[locationOf(sim, id)].name),
      h('td', {}, `${L.professions[n.profession]}·${L.ages[n.age]}`),
      h('td', {}, [n.gullibility, n.stubbornness, n.talkativeness, n.imagination].map((x) => x.toFixed(2)).join(' / ')),
      h('td', {}, beliefs)));
  }
  npcTable.append(tbody);
  details.append(h('h3', {}, ui.debugNpcs), h('div', { class: 'scroll' }, npcTable));

  details.append(h('h3', {}, ui.debugCores));
  for (const v of data.villageIds) {
    const cores = Object.values(world.villageCores[v]).filter((c) => c.believers > 0)
      .sort((a, b) => b.believers - a.believers || (a.core < b.core ? -1 : 1));
    const table = h('table', {},
      h('thead', {}, h('tr', {}, ...[ui.colIdea, ui.colCoverage, ui.colStage, ui.colMentions, ui.colExtras].map((c) => h('th', {}, c)))));
    const body = h('tbody');
    for (const c of cores) {
      const cov = coverage(sim, v, c.core);
      const top = topVersion(sim, v, c.core);
      const extras: string[] = [];
      const named = Object.values(world.placeNames[v]).find((p) => p.core === c.core);
      if (named) extras.push(`${L.placeName}「${named.name}」`);
      if (c.manifestDay !== undefined) extras.push(ui.manifested.replace('{kind}', L.manifest[manifestKindOf(c.core, data)]));
      body.append(h('tr', {},
        h('td', {}, top ? ideaText(top, data) : c.core),
        h('td', {}, pct(cov)),
        h('td', {}, L.stages[stageOf(c, cov)]),
        h('td', {}, String(c.mentions)),
        h('td', {}, extras.join('；'))));
    }
    table.append(body);
    details.append(h('h4', {}, `${data.villages[v].name}（${cores.length}）`), h('div', { class: 'scroll' }, table));
  }
  return details;
}
