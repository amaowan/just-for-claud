// Page shell: the living scene, speed controls, sleep, the tapestry report and the panels below.
import type { GameData } from '../sim/data.ts';
import { DAYS_PER_YEAR, CONFIG } from '../sim/config.ts';
import type { TellResult } from '../sim/propagation.ts';
import { buildReport, takeSnapshot } from '../sim/report.ts';
import { advanceDays } from '../sim/simulate.ts';
import { fill, ideaText } from '../sim/text.ts';
import type { TransmissionRecord } from '../sim/types.ts';
import { createSim, locationOf, type Sim } from '../sim/world.ts';
import { renderChains } from './chainView.ts';
import { renderComposer } from './composer.ts';
import { renderDebug } from './debugPanel.ts';
import { clear, h } from './dom.ts';
import { clockText } from './format.ts';
import { Fx } from './fx.ts';
import { renderLegend } from './legend.ts';
import { ThreadPalette } from './palette.ts';
import { dayMs, sampleSparks, sparkBudget, sparkMs } from './sampling.ts';
import type { Orientation } from './scene/layout.ts';
import { Stage } from './scene/stage.ts';
import { renderScroll, unroll } from './scroll.ts';
import { SleepVeil } from './sleep.ts';

const SPEEDS = [0, 1, 4, 16] as const;
const SLEEP_DAYS = 5 * DAYS_PER_YEAR;
const SLEEP_CHUNK = 30;
const SLEEP_FRAME_MS = 70;
const PANEL_REFRESH_MS = 3000;

function orientationNow(): Orientation {
  return window.innerWidth < 760 && window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

export function mountApp(root: HTMLElement, data: GameData): void {
  const ui = data.text.ui;
  const palette = new ThreadPalette();
  const stage = new Stage(data, palette);
  const fx = new Fx(stage);
  const veil = new SleepVeil(ui.sleeping);
  let sim: Sim = createSim(data, 42);
  let speed: number = 1;
  let sleeping = false;
  let onlyMutations = false;
  let debugOpen = false;
  let lastBubble = 0;
  let lastPanels = 0;
  const openLineages = new Set<string>();

  // ---------- DOM ----------
  const hud = h('div', { class: 'hud', 'aria-live': 'polite' });
  const today = h('span', { class: 'today' });
  const seed = h('input', { type: 'text', value: '42', size: '8', 'aria-label': ui.seed });
  const restart = h('button', { type: 'button' }, ui.restart);
  const speedButtons = SPEEDS.map((sp) => {
    const b = h('button', { type: 'button', 'aria-pressed': 'false' }, sp === 0 ? ui.pause : ui[`speed${sp}`]);
    b.addEventListener('click', () => setSpeed(sp));
    return b;
  });
  const sleepBtn = h('button', { type: 'button', class: 'sleep' }, ui.sleep);
  sleepBtn.addEventListener('click', () => void sleep());
  const legendSlot = h('div');
  const scrollSlot = h('div');
  const chainSlot = h('div');
  const debugSlot = h('div');
  const composer = renderComposer(() => sim, onTold) as HTMLElement & { refresh?: () => void };

  root.append(
    h('header', {},
      h('h1', {}, ui.title),
      h('p', { class: 'muted' }, ui.subtitle),
      h('div', { class: 'row' }, h('label', {}, `${ui.seed} `, seed), restart)),
    h('section', { class: 'card stage-wrap' }, h('div', { class: 'stage' }, stage.svg, hud, veil.el)),
    h('div', { class: 'controls-dock' },
      h('div', { class: 'controls' },
        h('span', { class: 'speed', role: 'group', 'aria-label': ui.speedLabel }, ...speedButtons),
        sleepBtn, today)),
    scrollSlot,
    h('div', { class: 'grid2' }, composer, legendSlot),
    chainSlot,
    debugSlot,
  );

  // ---------- rendering ----------
  let orientation = orientationNow();
  stage.build(orientation);
  window.addEventListener('resize', () => {
    const o = orientationNow();
    if (o === orientation) return;
    orientation = o;
    fx.clear();
    stage.build(o);
    stage.update(sim);
  });

  function refreshHud(count?: number) {
    hud.textContent = clockText(sim.world.day, data);
    if (count !== undefined) today.textContent = fill(ui.today, { n: count });
  }

  function refreshLegend() {
    clear(legendSlot);
    legendSlot.append(renderLegend(sim, palette));
  }

  function refreshPanels() {
    lastPanels = performance.now();
    composer.refresh?.();
    clear(chainSlot);
    chainSlot.append(renderChains(sim, onlyMutations, (v) => { onlyMutations = v; refreshPanels(); }, openLineages));
    clear(debugSlot);
    debugSlot.append(renderDebug(sim, debugOpen, (v) => { if (v !== debugOpen) { debugOpen = v; refreshPanels(); } }));
  }

  function refreshAll() {
    stage.update(sim);
    refreshHud();
    refreshLegend();
    refreshPanels();
  }

  function setSpeed(sp: number) {
    speed = sp;
    speedButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(SPEEDS[i] === sp)));
    if (sp === 0) refreshPanels();
  }

  // ---------- one animated day ----------
  function animateRecords(records: TransmissionRecord[]) {
    const budget = sparkBudget(speed);
    const picked = sampleSparks(records, budget, (id) => (id === 'player' ? 'player' : data.npcs[id]?.home ?? null));
    const window = Math.min(dayMs(speed) * 0.8, 900);
    const dur = sparkMs(speed);
    picked.forEach((r, i) => {
      const before = sim.world.ideas[r.before];
      const after = sim.world.ideas[r.after];
      fx.spark({
        from: () => stage.posOf(r.from, r.village),
        to: () => stage.posOf(r.to, r.village),
        color: palette.color(before.core),
        toColor: palette.color(after.core),
        delay: picked.length > 1 ? (i / picked.length) * window : 0,
        duration: dur,
        onArrive: () => {
          stage.nod(r.to);
          const now = performance.now();
          if (r.operator && (speed < 16 || now - lastBubble > 700)) {
            lastBubble = now;
            fx.bubble(stage.posOf(r.to, r.village), `【${data.text.labels.operators[r.operator]}】`, ideaText(after, data));
          }
        },
      });
    });
  }

  function runDay() {
    const m = data.merchantIds[0];
    const wasAt = locationOf(sim, m);
    const start = sim.world.history.length;
    advanceDays(sim, 1);
    const records = sim.world.history.slice(start);
    const nowAt = locationOf(sim, m);
    if (nowAt !== wasAt) {
      const walkMs = Math.min(2400, dayMs(speed) * CONFIG.merchant.stayDays * 0.5);
      fx.walk(wasAt === data.villageIds[0], walkMs, () => stage.update(sim));
    }
    stage.update(sim);
    animateRecords(records);
    refreshHud(records.length);
    refreshLegend();
    if (performance.now() - lastPanels > PANEL_REFRESH_MS) refreshPanels();
  }

  let acc = 0;
  let last = performance.now();
  function loop(now: number) {
    const dt = Math.min(250, now - last);
    last = now;
    if (!sleeping && speed > 0) {
      acc += dt;
      const ms = dayMs(speed);
      if (acc >= ms) {
        acc = Math.min(acc - ms, ms);
        runDay();
      }
    } else {
      acc = 0;
    }
    requestAnimationFrame(loop);
  }

  // ---------- the traveller tells someone ----------
  function onTold(npcId: string, result: TellResult) {
    const village = locationOf(sim, npcId);
    const color = palette.color(result.idea.core);
    fx.traveller(stage.layout.traveller[village], ui.travellerMark, 1600);
    fx.spark({
      from: () => stage.layout.traveller[village],
      to: () => stage.posOf(npcId, village),
      color, delay: 150, duration: 900,
      onArrive: () => {
        stage.nod(npcId);
        fx.bubble(stage.posOf(npcId, village), result.status === 'rejected' ? ui.bubbleRejected : ui.bubbleAccepted, ideaText(result.idea, data));
        refreshAll();
      },
    });
  }

  // ---------- sleep ----------
  async function sleep() {
    if (sleeping) return;
    sleeping = true;
    setSpeed(0);
    for (const b of [...speedButtons, sleepBtn, restart]) b.disabled = true;
    fx.clear();
    clear(scrollSlot);
    const before = takeSnapshot(sim);
    veil.show();
    await new Promise((r) => setTimeout(r, 900));
    let left = SLEEP_DAYS;
    while (left > 0) {
      const n = Math.min(SLEEP_CHUNK, left);
      advanceDays(sim, n);
      left -= n;
      veil.setYear(fill(ui.yearCounter, { year: Math.floor(sim.world.day / DAYS_PER_YEAR) + 1 }));
      refreshHud();
      await new Promise((r) => setTimeout(r, SLEEP_FRAME_MS));
    }
    veil.hide();
    await new Promise((r) => setTimeout(r, 700));
    stage.update(sim); // new lanterns, names and gods appear with their entrance animation
    refreshHud(0);
    refreshLegend();
    await new Promise((r) => setTimeout(r, 1800));
    const report = buildReport(sim, before, true);
    clear(scrollSlot);
    const scroll = renderScroll(report, data);
    scrollSlot.append(scroll);
    unroll(scroll);
    scroll.scrollIntoView({ behavior: 'smooth', block: 'start' });
    refreshPanels();
    for (const b of [...speedButtons, sleepBtn, restart]) b.disabled = false;
    sleeping = false;
  }

  restart.addEventListener('click', () => {
    if (sleeping) return;
    sim = createSim(data, seed.value.trim() || '42');
    palette.reset();
    fx.clear();
    stage.build(orientation);
    openLineages.clear();
    clear(scrollSlot);
    refreshAll();
  });

  setSpeed(1);
  refreshAll();
  requestAnimationFrame(loop);
}
