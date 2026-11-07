// 沉睡: the scene darkens, snow falls, the year counter rolls.
import { h } from './dom.ts';

export class SleepVeil {
  readonly el: HTMLElement;
  private digits: HTMLElement;
  private label: HTMLElement;
  private snow: HTMLElement;
  private shown = '';

  constructor(sleepingText: string) {
    this.digits = h('span', { class: 'digits' });
    this.label = h('div', { class: 'label' }, sleepingText);
    this.snow = h('div', { 'aria-hidden': 'true' });
    this.el = h('div', { class: 'sleep-veil', 'aria-hidden': 'true' },
      this.snow, h('div', { class: 'year-roll' }, this.label, h('div', {}, this.digits)));
  }

  show(): void {
    this.snow.replaceChildren();
    for (let i = 0; i < 70; i++) {
      const f = h('span', { class: 'flake' });
      const size = 2 + Math.random() * 5;
      f.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;opacity:${0.4 + Math.random() * 0.5};`
        + `animation-duration:${4 + Math.random() * 5}s;animation-delay:${-Math.random() * 8}s;--dx:${(Math.random() * 60 - 30).toFixed(0)}px`;
      this.snow.append(f);
    }
    this.el.classList.add('on');
  }

  /** Update the rolling year text; only re-animates when it changes. */
  setYear(text: string): void {
    if (text === this.shown) return;
    this.shown = text;
    this.digits.replaceChildren(h('span', {}, text));
  }

  hide(): void {
    this.el.classList.remove('on');
    setTimeout(() => this.snow.replaceChildren(), 1300);
  }
}
