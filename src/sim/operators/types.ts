import type { GameData } from '../data.ts';
import type { Idea, IdeaShape, Npc, OperatorId, Village } from '../types.ts';

export interface OperatorContext {
  data: GameData;
  /** The version being retold. */
  idea: Idea;
  /** Null when the player is speaking. */
  teller: Npc | null;
  listener: Npc;
  /** Village where the retelling happens (the listener's current location). */
  village: Village;
  /** Coverage of a core in this village, 0..1. */
  coverage: (core: string) => number;
  /** Other ideas the listener currently believes. */
  listenerIdeas: Idea[];
}

export interface Proposal {
  shape: IdeaShape;
  /** Text parameters for the operator's description template (Chinese). */
  params: Record<string, string>;
  /** Fusion: key of the second parent idea. */
  extraParent?: string;
}

export interface Operator {
  id: OperatorId;
  /** All concrete results this operator could produce here. Empty = condition not met. */
  propose(ctx: OperatorContext): Proposal[];
}

export function withSlot(shape: IdeaShape, slot: 'subject' | 'object', noun: string): IdeaShape {
  return { ...shape, modifiers: shape.modifiers.slice(), [slot]: noun };
}

export function baseShape(idea: Idea): IdeaShape {
  const s: IdeaShape = { subject: idea.subject, relation: idea.relation, object: idea.object, modifiers: idea.modifiers.slice(), form: idea.form };
  if (idea.season) s.season = idea.season;
  return s;
}
