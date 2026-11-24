// The required control profile per classification tier, and how a system
// measures against it.
//
// The tier ladder itself lives in the graph (facts.controlProfile, resolved by
// assembleGraph) rather than beside this file, because "what bar must Restricted
// data clear" is a statement about a company's policy, not about how scoring
// works.
//
// A system is judged against the tier its most sensitive data earns, using the
// same PRISMA ratings that produced its score, so the two cannot disagree.
import type { Graph } from "../graph/types";
import {
  ASSURANCE_CATEGORIES, PRISMA_LEVELS,
  type ClassificationTier, type AssuranceCategory, type PrismaLevel,
} from "../graph/nodes/taxonomy";
import { PRISMA_LEVEL_WEIGHTS, meetsLevel, display } from "./assurance";
import type { RollupsApi } from "./rollups";
import type { SystemId } from "../graph/ids";
import type { ControlAssessment } from "./assessment";

export type ProfileEvaluationStatus = "met" | "partial" | "gap";

export function createProfile(graph: Graph, rollups: RollupsApi) {
  const profiles = graph.controlProfiles;

  function categoryWeightsFor(tier: string): Record<AssuranceCategory, number> {
    return graph.categoryWeights[tier as ClassificationTier] ?? graph.categoryWeights.Internal;
  }

  function categoryWeight(tier: string, category: string): number {
    return categoryWeightsFor(tier)[category as AssuranceCategory] ?? 0;
  }

  // The score reached when a control clears exactly this PRISMA level —
  // every weight at or below the level counted in full, nothing above it.
  // This is the same weighted formula prismaScore uses (HITRUST's own
  // 15/20/40/10/15), so a target computed here and a real assessment score
  // are always the same arithmetic and can be compared directly.
  function targetScoreForLevel(level: PrismaLevel): number {
    return display(
      PRISMA_LEVELS.filter((l) => meetsLevel(level, l)).reduce(
        (sum, l) => sum + PRISMA_LEVEL_WEIGHTS[l] * 100,
        0
      )
    ) as number;
  }

  // The score reached when every PRISMA level up to and including the tier's
  // required maturity is Fully Compliant, and every level above it is
  // Non-Compliant. Target and actual are the same arithmetic over the same
  // five weights:
  //
  //   Public       Policy  clears           -> 15
  //   Internal     + Procedure              -> 35
  //   Confidential + Implemented            -> 75
  //   Restricted   + Measured and Managed   -> 100
  //
  // tierBaseline.maturity's stage names are read as PRISMA level names; the
  // words are the same.
  function tierTargetScore(tier: string): number | null {
    const profile = profiles[tier as ClassificationTier];
    if (!profile) return null;
    // The strictest bar any category sets at this tier, since the profile can
    // bump high-sensitivity categories one notch above the baseline.
    const required = ASSURANCE_CATEGORIES.map((c) => profile[c].maturity).reduce((a, b) =>
      meetsLevel(b as PrismaLevel, a as PrismaLevel) ? b : a
    );
    return targetScoreForLevel(required as PrismaLevel);
  }

  // Per-category met / partial / gap for one system against its tier's minimum.
  //
  // Judged the way a real HITRUST assessor reads a PRISMA score: against the
  // single weighted composite (prismaScore's 15/20/40/10/15 blend), not by
  // demanding every rung independently hit Fully Compliant. A control that is
  // strong on Policy/Procedure/Implemented and merely adequate on Measured/
  // Managed still clears its bar — those two rungs are only 25% of the
  // formula between them, so unevenness there is exactly what a real audit
  // tolerates rather than gates on.
  //
  // "met" clears the category's target composite outright. "partial" sits
  // within 75% of the target — a real assessor's corrective-action-plan zone,
  // flagged for remediation rather than treated as a fail. Further off than
  // that, or nothing assessed yet, is a genuine gap.
  function evaluateSystemAgainstProfile(systemId: SystemId) {
    const system = rollups.systemRollupById[systemId];
    if (!system) return null;
    const tier = (system.classification ?? "Internal") as ClassificationTier;
    const profile = profiles[tier];

    const result = {} as Record<string, {
      status: ProfileEvaluationStatus;
      required: (typeof profile)[keyof typeof profile];
      weight: number;
      contribution: number;
      score: number | null;
      basis: string;
      coverage: (typeof system.categories)[AssuranceCategory]["coverage"];
      levelAverages: Record<PrismaLevel, number | null>;
      requiredLevel: PrismaLevel;
      failingControls: ControlAssessment[];
    }>;

    ASSURANCE_CATEGORIES.forEach((category) => {
      const required = profile[category];
      const rollup = system.categories[category];
      const requiredLevel = required.maturity as PrismaLevel;
      const target = targetScoreForLevel(requiredLevel);
      const scored = rollup.assessments;

      const status: ProfileEvaluationStatus =
        rollup.score == null ? "gap"
        : rollup.score >= target ? "met"
        : rollup.score >= target * 0.75 ? "partial"
        : "gap";

      // Which controls are actually holding the category back — named so a
      // reader sees what's behind the aggregate verdict, not just the verdict.
      const failingControls = scored.filter((a) => (a.rawScore ?? 0) < target);

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
