// 融合: the heard idea merges with another idea the listener already believes.
import { CONFIG } from '../config.ts';
import { coreKey, ideaDomains, sharesBlock, sharesDomain } from '../idea.ts';
import type { FusionMatcher, Idea, IdeaShape } from '../types.ts';
import type { GameData } from '../data.ts';
import type { Operator, Proposal } from './types.ts';

function matches(idea: Idea, m: FusionMatcher, data: GameData): boolean {
  if (m.noun && idea.subject !== m.noun && idea.object !== m.noun) return false;
  if (m.modifierFamily && !idea.modifiers.some((x) => data.modifiers[x].family === m.modifierFamily)) return false;
  return true;
}

function resolveNoun(ref: string, a: Idea, b: Idea): string {
  switch (ref) {
    case 'a.subject': return a.subject;
    case 'a.object': return a.object;
    case 'b.subject': return b.subject;
    case 'b.object': return b.object;
    default: return ref;
  }
}

/** Union of modifiers, first come first kept, one per upgrade family, capped. */
export function mergeModifiers(first: string[], second: string[], data: GameData): string[] {
  const out: string[] = [];
  const fams = new Set<string>();
  for (const m of [...first, ...second]) {
    const f = data.modifiers[m].family;
    if (fams.has(f) || out.length >= CONFIG.idea.maxModifiers) continue;
    fams.add(f);
    out.push(m);
  }
  return out;
}

export const fuse: Operator = {
  id: 'fuse',
  propose(ctx) {
    const { data, idea } = ctx;
    const out: Proposal[] = [];
    for (const other of ctx.listenerIdeas) {
      if (other.core === idea.core) continue;
      const recipeShapes: IdeaShape[] = [];
      for (const r of data.fusion) {
        for (const [a, b] of [[idea, other], [other, idea]] as const) {
          if (!matches(a, r.a, data) || !matches(b, r.b, data)) continue;
          const mods = r.result.modifiers === 'a' ? a.modifiers.slice()
            : r.result.modifiers === 'ab' ? mergeModifiers(a.modifiers, b.modifiers, data)
            : r.result.modifiers.slice();
          recipeShapes.push({
            subject: resolveNoun(r.result.subject, a, b),
            relation: r.result.relation,
            object: resolveNoun(r.result.object, a, b),
            modifiers: mods,
            form: 'statement',
          });
        }
      }
      let shapes = recipeShapes;
      if (!shapes.length && (sharesBlock(idea, other) || sharesDomain(idea, other, data))) {
        const own = new Set([idea.subject, idea.object]);
        const doms = ideaDomains(idea, data);
        const cands = [other.subject, other.object].filter((n) => !own.has(n));
        const preferred = cands.filter((n) => doms.has(data.nouns[n].domain));
        for (const obj of preferred.length ? preferred : cands) {
          shapes.push({
            subject: idea.subject,
            relation: idea.relation,
            object: obj,
            modifiers: mergeModifiers(idea.modifiers, other.modifiers, data),
            form: idea.form,
            ...(idea.season ? { season: idea.season } : {}),
          });
        }
      }
      shapes = shapes.filter((s) => coreKey(s) !== other.core);
      for (const shape of shapes) out.push({ shape, params: {}, extraParent: other.key }); // 'other' text is filled in once chosen
    }
    return out;
  },
};
