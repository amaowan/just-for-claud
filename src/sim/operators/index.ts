// Operator registry and selection.
import { CONFIG } from '../config.ts';
import { isValidShape, normalizeShape, shapeKey } from '../idea.ts';
import type { Rng } from '../rng.ts';
import type { OperatorId } from '../types.ts';
import { comedify } from './comedify.ts';
import { deify } from './deify.ts';
import { exaggerate } from './exaggerate.ts';
import { fuse } from './fuse.ts';
import { invert } from './invert.ts';
import { localize } from './localize.ts';
import { personify } from './personify.ts';
import { professionFilter } from './professionFilter.ts';
import { ritualize } from './ritualize.ts';
import { simplify } from './simplify.ts';
import type { Operator, OperatorContext, Proposal } from './types.ts';

export type { OperatorContext, Proposal } from './types.ts';

export const OPERATORS: Record<OperatorId, Operator> = {
  localize, professionFilter, exaggerate, deify, ritualize, fuse, personify, comedify, simplify, invert,
};

/** Order used whenever several operators are considered (stable for determinism). */
export const REGULAR_OPERATORS: OperatorId[] = [
  'localize', 'professionFilter', 'exaggerate', 'deify', 'ritualize', 'fuse', 'personify', 'comedify', 'simplify',
];

/** Proposals that are valid ideas and actually change something. */
export function validProposals(op: OperatorId, ctx: OperatorContext): Proposal[] {
  // A version produced by an operator cannot be changed by that same operator again right away.
  if (ctx.idea.viaOp === op) return [];
  const out: Proposal[] = [];
  const seen = new Set<string>([ctx.idea.key]);
  for (const p of OPERATORS[op].propose(ctx)) {
    const shape = normalizeShape(p.shape);
    const key = shapeKey(shape);
    if (seen.has(key) || !isValidShape(shape, ctx.data)) continue;
    seen.add(key);
    out.push({ ...p, shape });
  }
  return out;
}

export function canApply(op: OperatorId, ctx: OperatorContext): boolean {
  return validProposals(op, ctx).length > 0;
}

export interface Mutation {
  op: OperatorId;
  proposal: Proposal;
}

/** Pick one qualifying regular operator (weighted) and one of its proposals. */
export function chooseMutation(ctx: OperatorContext, rng: Rng): Mutation | null {
  const options: { op: OperatorId; proposals: Proposal[] }[] = [];
  for (const op of REGULAR_OPERATORS) {
    const proposals = validProposals(op, ctx);
    if (proposals.length) options.push({ op, proposals });
  }
  if (!options.length) return null;
  const i = rng.weightedIndex(options.map((o) => CONFIG.operators.weights[o.op]));
  return { op: options[i].op, proposal: rng.pick(options[i].proposals) };
}
