// Build an idea from dropdowns and tell it to an NPC.
import { isValidShape } from '../sim/idea.ts';
import { tellByPlayer } from '../sim/propagation.ts';
import { fill, ideaText } from '../sim/text.ts';
import type { IdeaShape } from '../sim/types.ts';
import { locationOf, type Sim } from '../sim/world.ts';
import { h } from './dom.ts';

export function renderComposer(getSim: () => Sim, onTold: () => void): HTMLElement {
  const data = getSim().data;
  const ui = data.text.ui;
  const nouns = Object.values(data.nouns).filter((n) => !n.derived);
  const mods = Object.values(data.modifiers).filter((m) => !m.derived);

  const subject = h('select', { id: 'subject' });
  for (const n of nouns) subject.append(h('option', { value: n.id }, n.text));
  const relation = h('select', { id: 'relation' });
  for (const r of Object.values(data.relations)) relation.append(h('option', { value: r.id }, r.text));
  const object = h('select', { id: 'object' });
  const modSelects = [0, 1].map((i) => {
    const s = h('select', { id: `modifier${i}` }, h('option', { value: '' }, ui.none));
    for (const m of mods) s.append(h('option', { value: m.id }, m.text));
    return s;
  });
  const listener = h('select', { id: 'listener' });
  const preview = h('p', { class: 'preview' });
  const message = h('p', { class: 'message', 'aria-live': 'polite' });
  const tell = h('button', { type: 'button', class: 'primary' }, ui.tell);

  const shape = (): IdeaShape => ({
    subject: subject.value,
    relation: relation.value,
    object: object.value,
    modifiers: modSelects.map((s) => s.value).filter(Boolean),
    form: 'statement',
  });

  function refreshObjects() {
    const prev = object.value;
    object.replaceChildren();
    for (const n of nouns) {
      if (n.id === subject.value) continue;
      const trial = { ...shape(), object: n.id, modifiers: [] };
      if (isValidShape(trial, data)) object.append(h('option', { value: n.id }, n.text));
    }
    if ([...object.options].some((o) => o.value === prev)) object.value = prev;
  }

  function refreshListeners() {
    const sim = getSim();
    const prev = listener.value;
    listener.replaceChildren();
    for (const v of data.villageIds) {
      const group = h('optgroup', { label: data.villages[v].name });
      for (const id of data.residents[v]) {
        const n = data.npcs[id];
        group.append(h('option', { value: id }, `${n.name}（${data.text.labels.professions[n.profession]}·${data.text.labels.ages[n.age]}）`));
      }
      listener.append(group);
    }
    for (const id of data.merchantIds) {
      const n = data.npcs[id];
      const where = data.villages[locationOf(sim, id)].name;
      listener.append(h('option', { value: id }, `${n.name}（${data.text.labels.professions[n.profession]}·${where}）`));
    }
    listener.value = prev || data.residents[data.villageIds[0]][0];
  }

  function refreshPreview() {
    const s = shape();
    const valid = isValidShape(s, data);
    preview.textContent = valid ? `${ui.preview}「${ideaText(s, data)}」` : ui.invalid;
    tell.disabled = !valid;
  }

  subject.addEventListener('change', () => { refreshObjects(); refreshPreview(); });
  relation.addEventListener('change', () => { refreshObjects(); refreshPreview(); });
  for (const s of [object, ...modSelects]) s.addEventListener('change', refreshPreview);
  tell.addEventListener('click', () => {
    const sim = getSim();
    const result = tellByPlayer(sim, listener.value, shape());
    const name = data.npcs[listener.value].name;
    const key = result.status === 'accepted' ? 'accepted' : result.status === 'rejected' ? 'rejected' : 'alreadyBelieves';
    message.textContent = fill(ui[key], { name, idea: ideaText(result.idea, data) });
    message.dataset.status = result.status;
    onTold();
  });

  // Default: the GDD example 巨人 · 住在 · 山 · 会唱歌的.
  subject.value = 'giant';
  relation.value = 'liveIn';
  refreshObjects();
  object.value = 'mountain';
  modSelects[0].value = 'sing';
  refreshListeners();
  refreshPreview();

  const field = (label: string, el: HTMLElement) => h('label', { class: 'field' }, h('span', {}, label), el);
  const root = h('section', { class: 'panel composer' },
    h('h2', {}, ui.composeTitle),
    h('div', { class: 'fields' },
      field(ui.modifier, modSelects[0]), field(ui.modifier, modSelects[1]),
      field(ui.subject, subject), field(ui.relation, relation), field(ui.object, object)),
    preview,
    h('div', { class: 'fields' }, field(ui.listener, listener), tell),
    message,
  );
  (root as HTMLElement & { refresh?: () => void }).refresh = refreshListeners;
  return root;
}
