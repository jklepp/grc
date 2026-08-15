// The required control profile per classification tier, and how an asset
// measures against it.
//
// The tier ladder itself now lives in the graph (facts.controlProfile, resolved
// by assembleGraph) rather than beside this file, because "what bar must
// Restricted data clear" is a statement about a company's policy, not about how
// scoring works. Two things this module still owns:
//
//   The tier being evaluated is DERIVED from the data an asset holds
//   (engine/classification.ts) rather than inherited from its parent system, so
//   an asset is judged against the bar its own data earns.
//
//   The actual posture being compared is the category ROLLUP, which blends
//   measured implementations with the assessed baseline, rather than the raw
//   category assessment. So an asset whose evidenced controls are failing no
//   longer clears its profile on the strength of a self-assessment that says
//   otherwise.
import type { Graph } from "../graph/types";
import { ASSURANCE_CATEGORIES, type ClassificationTier, type AssuranceCategory } from "../graph/nodes/taxonomy";
import {
  blendAssurance, maturityScore, evidenceBaseConfidence, meetsMaturity, meetsEvidence,
  weightedMean, display,
} from "./assurance";
import type { RollupsApi } from "./rollups";
import type { AssetId } from "../graph/ids";

export function createProfile(graph: Graph, rollups: RollupsApi) {
  const profiles = graph.controlProfiles;

  function categoryWeightsFor(tier: string): Record<AssuranceCategory, number> {
    return graph.categoryWeights[tier as ClassificationTier] ?? graph.categoryWeights.Internal;
  }

  function categoryWeight(tier: string, category: string): number {
    return categoryWeightsFor(tier)[category as AssuranceCategory] ?? 0;
  }

  // The assurance score an asset would need to fully clear its tier's profile:
  // every category's required maturity and evidence run through the same formula
  // assets are judged by, at 100% effectiveness (the ceiling, since "required"
  // describes the bar itself, not an observed asset).
  //
  // Weighted by the same tier weights the asset itself is scored with — a target
  // computed on a flat mean while the actual is computed on a weighted one would
  // be comparing two different things.
  function tierTargetScore(tier: string): number | null {
    const profile = profiles[tier as ClassificationTier];
    return display(
      weightedMean(
        ASSURANCE_CATEGORIES.map((category) => ({
          value: blendAssurance({
            maturityStage: profile[category].maturity,
            evidenceConfidence: evidenceBaseConfidence(profile[category].evidence),
            effectivenessPct: 100,
          }),
          weight: categoryWeight(tier, category),
        }))
      )
    );
  }

  // Per-category met / partial / gap for one asset against its tier's minimums.
  // "met" needs both maturity and evidence to clear the bar; "partial" is one of
  // the two; anything else is a genuine gap.
  function evaluateAssetAgainstProfile(assetId: AssetId) {
    const asset = rollups.assetRollupById[assetId];
    if (!asset) return null;
    const profile = profiles[asset.classification as ClassificationTier];
    const result = {} as Record<string, {
      status: string;
      required: (typeof profile)[keyof typeof profile];
      weight: number;
      contribution: number;
      actual: { maturityStage: string; evidenceType: string; effectivenessPct: number };
      score: number | null;
      basis: string;
      requiredMaturityScore: number;
      requiredEvidenceScore: number;
      measuredShortfall: boolean;
      failingControls: unknown[];
    }>;

    ASSURANCE_CATEGORIES.forEach((category) => {
      const required = profile[category];
      const assessment = graph.assessmentByPair[`${assetId}::${category}`]!;
      const rollup = asset.categories[category];

      const maturityMet = meetsMaturity(assessment.maturityStage, required.maturity);
      const evidenceMet = meetsEvidence(assessment.evidenceType, required.evidence);

      // A category whose tracked controls are failing doesn't clear its profile
      // on the strength of the self-assessment alone. This is the check the old
      // model had no way to make, because it had nothing but the self-assessment.
      const measuredShortfall = rollup.implementations.some(
        (i) => i.status === "deficient" || i.status === "not-implemented"
      );

      const status = measuredShortfall
        ? maturityMet && evidenceMet ? "partial" : "gap"
        : maturityMet && evidenceMet ? "met" : maturityMet || evidenceMet ? "partial" : "gap";

      result[category] = {
        status,
        required,
        weight: required.weight,
        // How much this category's shortfall actually costs the asset's score —
        // the number a flat mean could not express.
        contribution: Math.round((((rollup.raw as number) * required.weight) / 100) * 10) / 10,
        actual: {
          maturityStage: assessment.maturityStage,
          evidenceType: assessment.evidenceType,
          effectivenessPct: assessment.effectivenessPct,
        },
        score: rollup.score,
        basis: rollup.basis,
        requiredMaturityScore: maturityScore(required.maturity),
        requiredEvidenceScore: evidenceBaseConfidence(required.evidence),
        measuredShortfall,
        failingControls: rollup.implementations.filter(
          (i) => i.status === "deficient" || i.status === "not-implemented"
        ),
      };
    });

    return result;
  }

  function profileSummary(assetId: AssetId) {
    const evaluation = evaluateAssetAgainstProfile(assetId)!;
    const asset = rollups.assetRollupById[assetId];
    const statuses = Object.values(evaluation).map((e) => e.status);
    return {
      evaluation,
      tier: asset.classification,
      target: tierTargetScore(asset.classification as string),
      actual: asset.overallAssurance,
      met: statuses.filter((s) => s === "met").length,
      partial: statuses.filter((s) => s === "partial").length,
      gap: statuses.filter((s) => s === "gap").length,
      clears: (asset.overallAssurance ?? 0) >= (tierTargetScore(asset.classification as string) ?? 0),
    };
  }

  return {
    CONTROL_PROFILES: profiles,
    categoryWeightsFor,
    categoryWeight,
    tierTargetScore,
    evaluateAssetAgainstProfile,
    profileSummary,
  };
}

export type ProfileApi = ReturnType<typeof createProfile>;
