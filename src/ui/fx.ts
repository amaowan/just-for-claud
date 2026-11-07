// Animation engine: glowing sparks along ties, speech bubbles, the merchant's walk.
// One requestAnimationFrame loop; every animation is a small object with an update(t).

import { along, type Point } from './scene/layout.ts';
import type { Stage } from './scene/stage.ts';
import { s, setAttrs } from './scene/svg.ts';

interface Anim {
  start: number;
  duration: number;
  update(t: number): void;
  done(): void;
}

const BUBBLE_MS = 2000;
const MAX_BUBBLES = 3;
const BUBBLE_LINE = 13;

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Split text into lines of at most n characters. */
export function wrap(text: string, n: number): string[] {
  const chars = [...text];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += n) out.push(chars.slice(i, i + n).join(''));
  return out.slice(0, 3);
}

export class Fx {
  private anims: Anim[] = [];
  private raf = 0;
  private bubbleEls: { el: SVGGElement; at: Point; until: number }[] = [];
  private stage: Stage;
  reducedMotion = false;

  constructor(stage: Stage) {
    this.stage = stage;
    this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private tick = (now: number) => {
    this.raf = 0;
    const still: Anim[] = [];
    for (const a of this.anims) {
      const t = Math.min(1, Math.max(0, (now - a.start) / a.duration));
      if (now < a.start) { still.push(a); continue; }
      a.update(t);
      if (t >= 1) a.done(); else still.push(a);
    }
    this.anims = still;
    this.bubbleEls = this.bubbleEls.filter((b) => {
      if (now < b.until) return true;
      b.el.style.opacity = '0';
      setTimeout(() => b.el.remove(), 400);
      return false;
    });
    if (this.anims.length || this.bubbleEls.length) this.raf = requestAnimationFrame(this.tick);
  };

  private add(a: Anim): void {
    this.anims.push(a);
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  get busy(): number {
    return this.anims.length;
  }

  clear(): void {
    this.anims = [];
    this.bubbleEls = [];
    this.stage.fx.replaceChildren();
    this.stage.bubbles.replaceChildren();
  }

  /**
   * A glowing dot flies from one person to another along a gently curved path.
   * If `toColor` differs, it changes colour halfway (the idea was changed in the telling).
   */
  spark(opts: {
    from: () => Point; to: () => Point; color: string; toColor?: string;
    delay: number; duration: number; onArrive?: () => void;
  }): void {
    const g = s('g', { class: 'spark', style: `color:${opts.color}` },
      s('circle', { class: 'spark-halo', r: 11 }),
      s('circle', { class: 'spark-core', r: 5.5 }),
      s('circle', { class: 'spark-dot', r: 2 }));
    let attached = false;
    let switched = false;
    const mutated = !!opts.toColor && opts.toColor !== opts.color;
    this.add({
      start: performance.now() + opts.delay,
      duration: this.reducedMotion ? Math.min(opts.duration, 200) : opts.duration,
      update: (t) => {
        if (!attached) { this.stage.fx.append(g); attached = true; }
        const a = opts.from();
        const b = opts.to();
        const e = ease(t);
        // Curve: control point offset perpendicular to the line.
        const mx = (a.x + b.x) / 2 - (b.y - a.y) * 0.18;
        const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
        const x = (1 - e) ** 2 * a.x + 2 * (1 - e) * e * mx + e ** 2 * b.x;
        const y = (1 - e) ** 2 * a.y + 2 * (1 - e) * e * my + e ** 2 * b.y;
        let scale = 1;
        if (mutated && t >= 0.5 && !switched) { g.style.color = opts.toColor!; switched = true; }
        if (mutated && t > 0.42 && t < 0.62) scale = 1 + Math.sin(((t - 0.42) / 0.2) * Math.PI) * 0.9;
        setAttrs(g, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})`, opacity: t > 0.92 ? ((1 - t) / 0.08).toFixed(2) : 1 });
      },
      done: () => { g.remove(); opts.onArrive?.(); },
    });
  }

  /** A speech bubble above someone's head, for about two seconds. */
  bubble(at: Point, label: string, text: string, ms = BUBBLE_MS): void {
    // Replace a bubble that would overlap; keep at most MAX_BUBBLES.
    for (const b of this.bubbleEls) if (Math.hypot(b.at.x - at.x, b.at.y - at.y) < 90) b.until = 0;
    while (this.bubbleEls.filter((b) => b.until > 0).length >= MAX_BUBBLES) {
      const oldest = this.bubbleEls.find((b) => b.until > 0);
      if (!oldest) break;
      oldest.until = 0;
    }
    const lines = wrap(text, BUBBLE_LINE);
    const w = Math.max([...label].length, ...lines.map((l) => [...l].length)) * 12.5 + 18;
    const h = (lines.length + (label ? 1 : 0)) * 15 + 12;
    const vb = this.stage.layout;
    const x = Math.min(vb.width - w / 2 - 4, Math.max(w / 2 + 4, at.x));
    const top = Math.max(4, at.y - 30 - h);
    const el = s('g', { class: 'bubble' },
      s('rect', { x: x - w / 2, y: top, width: w, height: h, rx: 9 }),
      s('path', { class: 'tail', d: `M${at.x - 6} ${top + h - 1} L${at.x} ${top + h + 9} L${at.x + 6} ${top + h - 1}` }),
      label ? s('text', { class: 'op', x, y: top + 17, 'text-anchor': 'middle' }, label) : null,
      ...lines.map((l, i) => s('text', { x, y: top + 17 + (i + (label ? 1 : 0)) * 15, 'text-anchor': 'middle' }, l)));
    this.stage.bubbles.append(el);
    this.bubbleEls.push({ el, at, until: performance.now() + ms });
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  /** The merchant walks the road between the two villages. */
  walk(fromStart: boolean, duration: number, onDone: () => void): void {
    const road = this.stage.layout.road;
    this.stage.merchantWalking = true;
    this.add({
      start: performance.now(),
      duration,
      update: (t) => {
        const e = ease(t);
        const p = along(road, fromStart ? e : 1 - e);
        // A little bob while walking.
        this.stage.placeMerchant({ x: p.x, y: p.y - Math.abs(Math.sin(t * Math.PI * 8)) * 3 });
      },
      done: () => { this.stage.merchantWalking = false; onDone(); },
    });
  }

  /** The traveller appears briefly at the village edge while telling someone. */
  traveller(at: Point, label: string, ms: number): void {
    const g = s('g', { class: 'traveller', transform: `translate(${at.x} ${at.y})` },
      s('circle', { r: 14 }), s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, label));
    this.stage.fx.append(g);
    setTimeout(() => g.remove(), ms);
  }
}
