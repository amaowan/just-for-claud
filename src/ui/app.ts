// Page shell: wires the simulation to the panels.
import type { GameData } from '../sim/data.ts';
import { buildReport, takeSnapshot, type Report } from '../sim/report.ts';
import { advanceDays } from '../sim/simulate.ts';
import { createSim, type Sim } from '../sim/world.ts';
import { renderChains } from './chainView.ts';
import { renderComposer } from './composer.ts';
import { renderDebug } from './debugPanel.ts';
import { clear, h } from './dom.ts';
import { clockText } from './format.ts';
import { renderReport } from './reportView.ts';

const CHUNK_DAYS = 60;

export function mountApp(root: HTMLElement, data: GameData): void {
  const ui = data.text.ui;
  let sim: Sim = createSim(data, 42);
  let report: Report | null = null;
  let onlyMutations = false;
  let debugOpen = false;
  let busy = false;
  const openLineages = new Set<string>();

  const clock = h('p', { class: 'clock' });
  const seed = h('input', { type: 'text', value: '42', size: '8', 'aria-label': ui.seed });
  const restart = h('button', { type: 'button' }, ui.restart);
  const reportSlot = h('div');
  const chainSlot = h('div');
  const debugSlot = h('div');
  const composer = renderComposer(() => sim, () => refresh()) as HTMLElement & { refresh?: () => void };

  const buttons = ([['advanceDay', 1, false], ['advanceMonth', 30, false], ['sleep', 1800, true]] as const).map(([key, days, long]) => {
    const b = h('button', { type: 'button' }, ui[key]);
    b.addEventListener('click', () => advance(days, long));
    return b;
  });

  function setBusy(v: boolean) {
    busy = v;
    for (const b of [...buttons, restart]) b.disabled = v;
  }

  /** Run in chunks so the page stays responsive during long sleeps. */
  function advance(days: number, long: boolean) {
    if (busy) return;
    setBusy(true);
    const before = takeSnapshot(sim);
    let left = days;
    const step = () => {
      const n = Math.min(CHUNK_DAYS, left);
      advanceDays(sim, n);
      left -= n;
      clock.textContent = clockText(sim.world.day, data);
      if (left > 0) { setTimeout(step, 0); return; }
      report = buildReport(sim, before, long);
      setBusy(false);
      refresh();
    };
    step();
  }

  function refresh() {
    clock.textContent = clockText(sim.world.day, data);
    composer.refresh?.();
    clear(reportSlot);
    reportSlot.append(renderReport(report, data));
    clear(chainSlot);
    chainSlot.append(renderChains(sim, onlyMutations, (v) => { onlyMutations = v; refresh(); }, openLineages));
    clear(debugSlot);
    debugSlot.append(renderDebug(sim, debugOpen, (v) => { if (v !== debugOpen) { debugOpen = v; refresh(); } }));
  }

  restart.addEventListener('click', () => {
    sim = createSim(data, seed.value.trim() || '42');
    report = null;
    openLineages.clear();
    refresh();
  });

  root.append(
    h('header', {},
      h('h1', {}, ui.title),
      h('p', { class: 'muted' }, ui.subtitle),
      h('div', { class: 'row' }, h('label', { class: 'inline' }, `${ui.seed} `, seed), restart)),
    composer,
    h('section', { class: 'panel time' }, h('h2', {}, ui.timeTitle), clock, h('div', { class: 'row' }, ...buttons)),
    reportSlot,
    chainSlot,
    debugSlot,
  );
  refresh();
}
