// The living part of the scene: ties, villagers with belief rings, the merchant,
// lanterns, place names and gods. Rebuilt on layout change, updated after each sim day.

import type { GameData } from '../../sim/data.ts';
import { topVersion } from '../../sim/history.ts';
import { ideaText } from '../../sim/text.ts';
import { believedIdeas, locationOf, type Sim } from '../../sim/world.ts';
import { PROFESSION_VAR, type ThreadPalette } from '../palette.ts';
import { defs, drawBackdrop } from './backdrop.ts';
import { computeLayout, type Orientation, type Point, type SceneLayout } from './layout.ts';
import { arcPath, s, setAttrs } from './svg.ts';

const NODE_R = 15;
const RING_R = 20;
const MAX_LANTERNS = 6;

/** Simple robed-figure silhouette (head + flowing robe), centred on (0,0) at its feet. */
const GOD_PATH = 'M0 -58a9 9 0 1 1 0.1 0zM-6 -46q6 -4 12 0l10 18q-6 4 -4 10l8 18h-44l8 -18q2 -6 -4 -10z';

export class Stage {
  readonly svg: SVGSVGElement;
  layout!: SceneLayout;
  private ties!: SVGGElement;
  private decor!: SVGGElement;
  private nodesLayer!: SVGGElement;
  readonly fx: SVGGElement = s('g', { class: 'fx' });
  readonly bubbles: SVGGElement = s('g', { class: 'bubbles' });
  private nodeEls = new Map<string, { g: SVGGElement; rings: SVGGElement; title: SVGTitleElement }>();
  private merchantEl!: SVGGElement;
  private merchantTies!: SVGGElement;
  /** Current drawn merchant position (animated by the fx engine while walking). */
  merchantPos: Point = { x: 0, y: 0 };
  merchantWalking = false;
  /** Decorations already shown, so new ones get an entrance animation. */
  private seen = new Set<string>();
  private primed = false;

  private data: GameData;
  private palette: ThreadPalette;

  constructor(data: GameData, palette: ThreadPalette) {
    this.data = data;
    this.palette = palette;
    this.svg = s('svg', { class: 'world', role: 'img', 'aria-label': data.text.ui.sceneLabel ?? '' });
  }

  build(orientation: Orientation): void {
    this.layout = computeLayout(this.data, orientation);
    const L = this.layout;
    this.svg.replaceChildren();
    setAttrs(this.svg, { viewBox: `0 0 ${L.width} ${L.height}` });
    this.svg.dataset.orientation = orientation;
    this.ties = s('g', { class: 'ties' });
    this.decor = s('g', { class: 'decor' });
    this.nodesLayer = s('g', { class: 'nodes' });
    this.merchantTies = s('g', { class: 'ties merchant-ties' });
    this.svg.append(defs(), drawBackdrop(L, this.data), this.decor, this.ties, this.merchantTies, this.nodesLayer, this.fx, this.bubbles);
    this.drawTies();
    this.drawNodes();
    this.seen.clear();
    this.primed = false;
    this.decorKey = '';
  }

  private drawTies(): void {
    const { data, layout: L } = this;
    for (const a of data.npcIds) {
      if (!data.npcs[a].home) continue;
      for (const t of data.ties[a]) {
        if (t.to < a || !data.npcs[t.to].home) continue;
        const p = L.nodes[a];
        const q = L.nodes[t.to];
        this.ties.append(s('line', {
          class: 'tie', x1: p.x, y1: p.y, x2: q.x, y2: q.y,
          'stroke-width': (0.6 + t.trust * 2.6).toFixed(2), 'stroke-opacity': (0.18 + t.trust * 0.5).toFixed(2),
        }));
      }
    }
  }

  private nodeGroup(id: string, p: Point, cls = ''): SVGGElement {
    const n = this.data.npcs[id];
    const rings = s('g', { class: 'rings' });
    const title = s('title');
    const g = s('g', { class: `npc ${cls}`, transform: `translate(${p.x} ${p.y})`, 'data-id': id },
      title,
      s('circle', { class: 'node-shadow', r: NODE_R + 1, cy: 2 }),
      rings,
      s('circle', { class: 'node', r: NODE_R, style: `fill:${PROFESSION_VAR[n.profession]}` }),
      s('text', { class: 'initial', 'dominant-baseline': 'central', 'text-anchor': 'middle' }, [...n.name][0]),
      s('text', { class: 'npc-name', y: NODE_R + 14, 'text-anchor': 'middle' }, n.name));
    this.nodeEls.set(id, { g, rings, title });
    return g;
  }

  private drawNodes(): void {
    this.nodeEls.clear();
    for (const v of this.data.villageIds) {
      for (const id of this.data.residents[v]) this.nodesLayer.append(this.nodeGroup(id, this.layout.nodes[id]));
    }
    const m = this.data.merchantIds[0];
    this.merchantEl = this.nodeGroup(m, { x: 0, y: 0 }, 'merchant');
    this.merchantEl.insertBefore(s('path', { class: 'pack', d: 'M10 -6 h10 v14 h-10 z' }), this.merchantEl.firstChild);
    this.nodesLayer.append(this.merchantEl);
  }

  /** Little bounce on a villager who just heard something. */
  nod(id: string): void {
    const el = id === this.merchantId() ? this.merchantEl : this.nodeEls.get(id)?.g;
    if (!el) return;
    el.classList.remove('heard');
    void el.getBoundingClientRect();
    el.classList.add('heard');
    setTimeout(() => el.classList.remove('heard'), 600);
  }

  merchantId(): string {
    return this.data.merchantIds[0];
  }

  /** Where a speaker / listener currently is on screen. */
  posOf(id: string, village: string): Point {
    if (id === 'player') return this.layout.traveller[village];
    if (id === this.merchantId()) return this.merchantPos;
    return this.layout.nodes[id];
  }

  placeMerchant(p: Point): void {
    this.merchantPos = p;
    this.merchantEl.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }

  /** Refresh rings, merchant, lanterns, names and gods from the simulation state. */
  update(sim: Sim): void {
    const { data, world } = sim;
    // Belief rings: one coloured arc per believed core.
    const alive = new Set<string>();
    for (const id of data.npcIds) for (const core of Object.keys(world.beliefs[id])) alive.add(core);
    this.palette.retain(alive);
    for (const [id, el] of this.nodeEls) {
      const ideas = believedIdeas(sim, id);
      el.rings.replaceChildren();
      const n = ideas.length;
      ideas.forEach((idea, i) => {
        const color = this.palette.color(idea.core);
        if (n === 1) {
          el.rings.append(s('circle', { class: 'ring', r: RING_R, style: `stroke:${color}` }));
        } else {
          const gap = 0.12;
          const a0 = (i * 2 * Math.PI) / n + gap / 2;
          const a1 = ((i + 1) * 2 * Math.PI) / n - gap / 2;
          el.rings.append(s('path', { class: 'ring', d: arcPath(0, 0, RING_R, a0, a1), style: `stroke:${color}` }));
        }
      });
      const npc = data.npcs[id];
      el.title.textContent = [`${npc.name}（${data.text.labels.professions[npc.profession]}·${data.text.labels.ages[npc.age]}）`,
        ...ideas.map((i) => `· ${ideaText(i, data)}`)].join('\n');
    }
    // Merchant: stands at the market of the village he is in (unless walking).
    const here = locationOf(sim, this.merchantId());
    if (!this.merchantWalking) this.placeMerchant(this.layout.market[here]);
    this.drawMerchantTies(sim, here);
    this.drawDecor(sim);
  }

  private drawMerchantTies(sim: Sim, here: string): void {
    this.merchantTies.replaceChildren();
    if (this.merchantWalking) return;
    const m = this.merchantId();
    for (const t of this.data.ties[m]) {
      if (this.data.npcs[t.to].home !== here) continue;
      const q = this.layout.nodes[t.to];
      this.merchantTies.append(s('line', {
        class: 'tie merchant-tie', x1: this.merchantPos.x, y1: this.merchantPos.y, x2: q.x, y2: q.y,
        'stroke-width': (0.6 + t.trust * 2).toFixed(2),
      }));
    }
    void sim;
  }

  private fresh(key: string): boolean {
    const isNew = this.primed && !this.seen.has(key);
    this.seen.add(key);
    return isNew;
  }

  private decorKey = '';

  private drawDecor(sim: Sim): void {
    const { data, world } = sim;
    const L = this.layout;
    // Only redraw when something visible changed, so sway/breathe animations keep running smoothly.
    const key = JSON.stringify([
      data.villageIds.map((v) => Object.values(world.villageCores[v]).filter((c) => c.customDay !== undefined).map((c) => [c.core, c.festivalDay !== undefined])),
      world.placeNames, world.events.filter((e) => e.type === 'deity').length,
    ]);
    if (key === this.decorKey && this.primed) return;
    this.decorKey = key;
    this.decor.replaceChildren();
    for (const v of data.villageIds) {
      // Lanterns for customs (red) and festivals (gold, bigger).
      const cores = Object.values(world.villageCores[v])
        .filter((c) => c.customDay !== undefined)
        .sort((a, b) => (a.customDay! - b.customDay!) || (a.core < b.core ? -1 : 1))
        .slice(0, MAX_LANTERNS);
      const line = L.lanterns[v];
      if (cores.length) {
        const g = s('g', { class: 'lanterns' },
          s('path', { class: 'lantern-string', d: `M${line.x1} ${line.y} Q${(line.x1 + line.x2) / 2} ${line.y + 16} ${line.x2} ${line.y}` }));
        cores.forEach((c, i) => {
          const t = (i + 1) / (cores.length + 1);
          const x = line.x1 + (line.x2 - line.x1) * t;
          const y = line.y + 16 * 4 * t * (1 - t) + 6;
          const festival = c.festivalDay !== undefined;
          const top = topVersion(sim, v, c.core);
          const lantern = s('g', { class: `lantern${festival ? ' festival' : ''}${this.fresh(`l:${v}:${c.core}:${festival}`) ? ' appear' : ''}`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` },
            s('title', {}, top ? ideaText(top, data) : c.core),
            s('g', { class: 'sway' },
              s('line', { class: 'lantern-cord', x1: 0, y1: -6, x2: 0, y2: 0 }),
              s('rect', { class: 'lantern-cap', x: -5, y: 0, width: 10, height: 3, rx: 1 }),
              s('ellipse', { class: 'lantern-body', cx: 0, cy: festival ? 13 : 11, rx: festival ? 11 : 8, ry: festival ? 11 : 9 }),
              s('rect', { class: 'lantern-cap', x: -5, y: festival ? 23 : 19, width: 10, height: 3, rx: 1 }),
              s('line', { class: 'lantern-tassel', x1: 0, y1: festival ? 26 : 22, x2: 0, y2: festival ? 34 : 29 })));
          g.append(lantern);
        });
        this.decor.append(g);
      }
      // Place names floating over the place they name.
      for (const [place, pn] of Object.entries(world.placeNames[v] ?? {})) {
        const a = L.anchors[v][place];
        if (!a) continue;
        const w = [...pn.name].length * 15 + 18;
        this.decor.append(s('g', {
          class: `place-name${pn.initial && pn.renames === 0 ? ' old' : ''}${this.fresh(`p:${v}:${place}:${pn.name}`) ? ' appear' : ''}`,
          transform: `translate(${a.x} ${a.y})`,
        },
        s('rect', { class: 'place-tag', x: -w / 2, y: -13, width: w, height: 24, rx: 4 }),
        s('text', { class: 'place-text', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, pn.name)));
      }
    }
    // Gods: a glowing silhouette where they were born.
    for (const e of world.events) {
      if (e.type !== 'deity') continue;
      for (const v of e.villages) {
        const p = L.peak[v];
        const g = s('g', { class: `god god-${data.nouns[e.deity].domain}${this.fresh(`g:${e.deity}:${v}`) ? ' appear' : ''}`, transform: `translate(${p.x} ${p.y})` },
          s('title', {}, data.nouns[e.deity].text),
          s('circle', { class: 'god-halo', r: 34, cy: -30 }),
          s('path', { class: 'god-body', d: GOD_PATH }),
          s('text', { class: 'god-name', y: 14, 'text-anchor': 'middle' }, data.nouns[e.deity].text));
        this.decor.append(g);
      }
    }
    this.primed = true;
  }
}
