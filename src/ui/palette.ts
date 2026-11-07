// Colours are CSS variables (theme.css) so light and dark mode can differ.
// Professions have fixed colours; idea cores get "threads" assigned on first sight.

import type { Profession } from '../sim/types.ts';

export const PROFESSION_VAR: Record<Profession, string> = {
  fisher: 'var(--prof-fisher)',
  miner: 'var(--prof-miner)',
  farmer: 'var(--prof-farmer)',
  weaver: 'var(--prof-weaver)',
  bard: 'var(--prof-bard)',
  merchant: 'var(--prof-merchant)',
  herbalist: 'var(--prof-herbalist)',
  keeper: 'var(--prof-keeper)',
};

export const THREAD_COUNT = 12;

export function threadVar(index: number): string {
  return `var(--thread-${index % THREAD_COUNT})`;
}

/**
 * Assigns each idea core a thread colour. A core keeps its colour while it is alive;
 * colours of cores nobody believes any more are freed for new cores.
 */
export class ThreadPalette {
  private byCore = new Map<string, number>();

  /** Colour index for a core, assigning the lowest free one if needed. */
  indexOf(core: string): number {
    const known = this.byCore.get(core);
    if (known !== undefined) return known;
    const used = new Set(this.byCore.values());
    let i = 0;
    while (used.has(i) && i < THREAD_COUNT) i++;
    const idx = i < THREAD_COUNT ? i : this.byCore.size % THREAD_COUNT;
    this.byCore.set(core, idx);
    return idx;
  }

  color(core: string): string {
    return threadVar(this.indexOf(core));
  }

  /** Forget cores that are no longer alive anywhere, so their colours can be reused. */
  retain(alive: Iterable<string>): void {
    const keep = new Set(alive);
    for (const core of [...this.byCore.keys()]) if (!keep.has(core)) this.byCore.delete(core);
  }

  reset(): void {
    this.byCore.clear();
  }
}
