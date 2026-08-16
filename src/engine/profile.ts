// The required control profile per classification tier, and how a system
// measures against it.
//
// The tier ladder itself lives in the graph (facts.controlProfile, resolved by
// assembleGraph) rather than beside this file, because "what bar must Restricted
// data clear" is a statement about a company's policy, not about how scoring
// works.
//
// THE SUBJECT MOVED FROM ASSET TO SYSTEM
// ---------------------------------------
// This used to judge one asset against the tier its own data earned, comparing
// the tier's required maturity and evidence against the asset's category
// assessment. Both halves of that comparison are gone: assets no longer carry a
// score, and the per-asset category assessment they were compared against was
// retired with them.
//
// What replaced it reads better anyway. A system is judged against the tier its
// most sensitive data earns, and the comparison is against what the PRISMA
// levels actually found — so "does this boundary clear its bar" is answered by
// the same ratings that produced its score, rather than by a self-assessment
// sitting beside them that could disagree.
import type { Graph } from "../graph/types";
import {
  ASSURANCE_CATEGORIES, PRISMA_LEVELS,
  type ClassificationTier, type AssuranceCategory, type PrismaLevel,
} from "../graph/nodes/taxonomy";
import { PRISMA_LEVEL_WEIGHTS, meetsLevel, display } from "./assurance";
import type { RollupsApi } from "./rollups";
import type { SystemId } from "../graph/ids";

export function createProfile(graph: Graph, rollups: RollupsApi) {
  const profiles = graph.controlProfiles;

  function categoryWeightsFor(tier: string): Record<AssuranceCategory, number> {
    return graph.categoryWeights[tier as ClassificationTier] ?? graph.categoryWeights.Internal;
  }

  function categoryWeight(tier: string, category: string): number {
    return categoryWeightsFor(tier)[category as AssuranceCategory] ?? 0;
  }

  // The score reached when every PRISMA level up to and including the tier's
  // required maturity is Fully Compliant, and every level above it is
  // Non-Compliant.
  //
  // This is a genuinely different derivation from the old one, and a better
  // ladder. It used to run the tier's required maturity and evidence through
  // blendAssurance at 100% effectiveness, which mixed three axes to produce a
  // target the actual score was never computed the same way from. Now the target
  // and the actual are the same arithmetic over the same five weights, so the
  // comparison means something:
  //
  //   Public       Policy  clears           -> 15
  //   Internal     + Procedure              -> 35
  //   Confidential + Implemented            -> 75
  //   Restricted   + Measured and Managed   -> 100
  //
  // tierBaseline.maturity is reinterpreted rather than re-authored. The five
  // stage names and the five level names are the same words, so control-profile
  // .yaml needed no change — only a different reading of what it was always
  // saying.
  function tierTargetScore(tier: string): number | null {
    const profile = profiles[tier as ClassificationTier];
    if (!profile) return null;
    // The strictest bar any category sets at this tier, since the profile can
    // bump high-sensitivity categories one notch above the baseline.
    const required = ASSURANCE_CATEGORIES.map((c) => profile[c].maturity).reduce((a, b) =>
      meetsLevel(b as PrismaLevel, a as PrismaLevel) ? b : a
    );
    return display(
      PRISMA_LEVELS.filter((level) => meetsLevel(required as PrismaLevel, level)).reduce(
        (sum, level) => sum + PRISMA_LEVEL_WEIGHTS[level] * 100,
        0
      )
    );
  }

  // Per-category met / partial / gap for one system against its tier's minimum.
  //
  // "met" means every level up to the required one is Fully Compliant across the
  // category; "partial" means the required level is reached on average but not
  // everywhere; anything else is a gap. Judged from the level ratings rather
  // than from the category score, so a category cannot clear its bar on the
  // strength of a strong Policy rating while the rung that was actually required
  // is failing.
  function evaluateSystemAgainstProfile(systemId: SystemId) {
    const system = rollups.systemRollupById[systemId];
    if (!system) return null;
    const tier = (system.classification ?? "Internal") as ClassificationTier;
    const profile = profiles[tier];

    const result = {} as Record<string, {
      status: string;
      required: (typeof profile)[keyof typeof profile];
      weight: number;
      contribution: number;
      score: number | null;
      basis: string;
      coverage: (typeof system.categories)[AssuranceCategory]["coverage"];
      levelAverages: Record<PrismaLevel, number | null>;
      requiredLevel: PrismaLevel;
      failingControls: unknown[];
    }>;

    ASSURANCE_CATEGORIES.forEach((category) => {
      const required = profile[category];
      const rollup = system.categories[category];
      const requiredLevel = required.maturity as PrismaLevel;

      // Every level at or below the bar has to be Fully Compliant for the
      // category to have met it.
      const rungs = PRISMA_LEVELS.filter((level) => meetsLevel(requiredLevel, level));
      const scored = rollup.assessments;

      const allFull = scored.length > 0 && rungs.every((level) =>
        scored.every((a) => a.levels[level].rating === 100)
      );
      const mostlyThere = scored.length > 0 && rungs.every((level) =>
        (rollup.levelAverages[level] ?? 0) >= 75
      );

      const failingControls = scored.filter((a) =>
        rungs.some((level) => a.levels[level].rating <= 25)
      );

      const status = scored.length === 0 ? "gap" : allFull ? "met" : mostlyThere ? "partial" : "gap";

      result[category] = {
        status,
        required,
        weight: required.weight,
        // How much this category's shortfall actually costs the system's score —
        // the number a flat mean could not express.
        contribution: rollup.raw === null ? 0 : Math.round(((rollup.raw * required.weight) / 100) * 10) / 10,
        score: rollup.score,
        basis: rollup.basis,
        coverage: rollup.coverage,
        levelAverages: rollup.levelAverages,
        requiredLevel,
        failingControls,
      };
    });

    return result;
  }

  function profileSummary(systemId: SystemId) {
    const evaluation = evaluateSystemAgainstProfile(systemId);
    const system = rollups.systemRollupById[systemId];
    if (!evaluation || !system) return null;
    const statuses = Object.values(evaluation).map((e) => e.status);
    const target = tierTargetScore(system.classification as string);
    return {
      evaluation,
      tier: system.classification,
      target,
      actual: system.overallAssurance,
      coverage: system.coverage,
      met: statuses.filter((s) => s === "met").length,
      partial: statuses.filter((s) => s === "partial").length,
      gap: statuses.filter((s) => s === "gap").length,
      clears: (system.overallAssurance ?? 0) >= (target ?? 0),
    };
  }

  return {
    CONTROL_PROFILES: profiles,
    categoryWeightsFor,
    categoryWeight,
    tierTargetScore,
    evaluateSystemAgainstProfile,
    profileSummary,
  };
}

export type ProfileApi = ReturnType<typeof createProfile>;
