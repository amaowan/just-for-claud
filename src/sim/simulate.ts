// Advancing time: propagation every day, then sedimentation and decay.

import { propagateDay } from './propagation.ts';
import { updateSediment } from './sediment.ts';
import { syncRng, type Sim } from './world.ts';

export function advanceDays(sim: Sim, days: number): void {
  for (let i = 0; i < days; i++) {
    propagateDay(sim);
    updateSediment(sim);
  }
  syncRng(sim);
}
