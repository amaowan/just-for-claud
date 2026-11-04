// All tunable numbers live here. Initial values come from docs/GDD.md and docs/PLAN-M1.md §0.

import type { OperatorId } from './types.ts';

export const CONFIG = {
  calendar: {
    daysPerMonth: 30,
    monthsPerYear: 12,
    /** Month index (0-based) at which each season starts: spring, summer, autumn, winter. */
    seasonStartMonths: [0, 3, 6, 9],
  },

  idea: {
    maxModifiers: 2,
    /** Subject + relation + object. */
    baseBlocks: 3,
    /** clarity = 1 - clarityPenaltyPerBlock * (blocks - baseBlocks), clamped to [0, 1]. */
    clarityPenaltyPerBlock: 0.15,
  },

  propagation: {
    listenersMin: 1,
    listenersMax: 3,
    /** Listener-choice weight = trust ^ trustWeightExponent ("better ties first"). */
    trustWeightExponent: 2,
    /** Trust used when there is no tie between listener and teller. */
    defaultTrust: 0.3,
    playerTrust: 0.8,
    /** The traveller's telling is accepted with at least this probability. */
    playerMinAcceptance: 0.75,
    fitMatch: 1.2,
    fitNeutral: 1.0,
    fitConflict: 0.5,
    /**
     * Mutation chance = scale * (base + imagination * k1 + (1 - clarity) * k2 - stubbornness * k3).
     * GDD initial values: base 0.1, k1 0.4, k2 0.3, scale 1. Lowered after the first balance report:
     * villagers retell popular ideas almost daily for years, so even ~1.5% per retelling is plenty.
     */
    mutationScale: 0.04,
    mutationBase: 0.05,
    mutationImagination: 0.4,
    mutationUnclarity: 0.3,
    /** Reserved: stubborn tellers retell more accurately. 0 = GDD formula unchanged. */
    mutationStubbornness: 0,
  },

  heat: {
    initial: 1,
    dailyDecay: 0.9,
    floor: 0.05,
    /** Floor for cores that reached custom (or later) in the believer's village. */
    floorCustom: 0.2,
  },

  operators: {
    /**
     * Relative weights when several operators qualify (tuned with npm run balance).
     * Ritualize/deify/exaggerate are favoured so the 夸大 → 神化 → 仪式化 path can happen at all;
     * localize/fuse/comedify are damped because they dominated the first balance report.
     */
    weights: {
      localize: 0.5,
      professionFilter: 1,
      exaggerate: 3,
      deify: 3,
      ritualize: 20,
      fuse: 0.5,
      personify: 1,
      comedify: 0.3,
      simplify: 1,
      invert: 1,
    } satisfies Record<OperatorId, number>,
    exaggerateMinImagination: 0.6,
    deifyMinCoverage: 0.5,
    /** Teller with gullibility below this counts as a skeptic. */
    skepticMaxGullibility: 0.3,
    /** Independent chance a skeptic inverts the relation when retelling. */
    invertChance: 0.02,
    /** Simplify applies when an idea has more than this many blocks AND its modifiers are at the cap. */
    simplifyAboveBlocks: 4,
  },

  sediment: {
    rumorMinBelievers: 3,
    commonCoverage: 0.3,
    customCoverage: 0.5,
    customYears: 5,
    festivalYearsAfterCustom: 15,
    placeNameMentions: 1000,
    /** A place is renamed only if the new name's core has more than this many times the mentions of the current one. */
    placeRenameFactor: 3,
    manifestCoverage: 0.5,
    manifestYears: 5,
    deityCoverage: 0.6,
    deityMinVillages: 2,
    /** Sustained-coverage timers are checked (and reset if below) this often. */
    checkIntervalDays: 30,
  },

  decay: {
    /**
     * A version nobody else has repeated to its believer for this many days may be forgotten.
     * Telling it yourself does not keep it alive, so lonely offshoots die out.
     */
    unechoedDays: 180,
    /** Chance per sediment check (every checkIntervalDays) that such a belief is forgotten. */
    forgetChance: 0.25,
  },

  tradition: {
    /**
     * Believers of a village's original belief resist rewriting it: when the conflicting belief is
     * the original core, the listener's stubbornness is raised to at least this value.
     */
    stubbornness: 0.9,
  },

  chaos: {
    maxActiveCoresPerVillage: 12,
  },

  merchant: {
    stayDays: 10,
  },

  initialBeliefShare: 0.6,
} as const;

export type Config = typeof CONFIG;

export const DAYS_PER_YEAR = CONFIG.calendar.daysPerMonth * CONFIG.calendar.monthsPerYear;
