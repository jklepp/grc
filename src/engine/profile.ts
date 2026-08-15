// The required control profile per classification tier, and how an asset
// measures against it.
//
// Ported from controlProfiles.ts essentially intact — the tier ladder was
// sound. Two things changed underneath it:
//
//   The tier being evaluated is now DERIVED from the data an asset holds
//   (engine/classification.ts) rather than inherited from its parent system, so
//   an asset is judged against the bar its own data earns.
//
//   The actual posture being compared is the category ROLLUP, which blends
//   measured implementations with the assessed baseline, rather than the raw
//   category assessment. So an asset whose evidenced controls are failing no
//   longer clears its profile on the strength of a self-assessment that says
//   otherwise.
import { ASSURANCE_CATEGORIES } from "../graph/nodes/taxonomy";
import { CONTROL_PROFILES, categoryWeightsFor, categoryWeight } from "../graph/nodes/controlProfiles";
import { assessmentFor } from "../graph/edges/categoryAssessments";
import { blendAssurance, maturityScore, evidenceBaseConfidence, meetsMaturity, meetsEvidence, weightedMean, display } from "./assurance";
import { ASSET_ROLLUP_BY_ID } from "./rollups";
import type { AssetId } from "../graph/ids";

export { CONTROL_PROFILES, categoryWeightsFor, categoryWeight };

// The assurance score an asset would need to fully clear its tier's profile:
// every category's required maturity and evidence run through the same formula
// assets are judged by, at 100% effectiveness (the ceiling, since "required"
// describes the bar itself, not an observed asset).
//
// Weighted by the same tier weights the asset itself is scored with — a target
// computed on a flat mean while the actual is computed on a weighted one would
// be comparing two different things.
export function tierTargetScore(tier: string): number | null {
  const profile = CONTROL_PROFILES[tier as keyof typeof CONTROL_PROFILES];
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
export function evaluateAssetAgainstProfile(assetId: AssetId) {
  const asset = ASSET_ROLLUP_BY_ID[assetId];
  if (!asset) return null;
  const profile = CONTROL_PROFILES[asset.classification as keyof typeof CONTROL_PROFILES];
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
    const assessment = assessmentFor(assetId, category)!;
    const rollup = asset.categories[category];

    const maturityMet = meetsMaturity(assessment.maturityStage, required.maturity);
    const evidenceMet = meetsEvidence(assessment.evidenceType, required.evidence);

    // A category whose tracked controls are failing doesn't clear its profile
    // on the strength of the self-assessment alone. This is the check the old
    // model had no way to make, because it had nothing but the self-assessment.
    const measuredShortfall = rollup.implementations.some((i) => i.status === "deficient" || i.status === "not-implemented");

    const status = measuredShortfall ? (maturityMet && evidenceMet ? "partial" : "gap") : maturityMet && evidenceMet ? "met" : maturityMet || evidenceMet ? "partial" : "gap";

    result[category] = {
      status,
      required,
      weight: required.weight,
      // How much this category's shortfall actually costs the asset's score —
      // the number a flat mean could not express.
      contribution: Math.round((((rollup.raw as number) * required.weight) / 100) * 10) / 10,
      actual: { maturityStage: assessment.maturityStage, evidenceType: assessment.evidenceType, effectivenessPct: assessment.effectivenessPct },
      score: rollup.score,
      basis: rollup.basis,
      requiredMaturityScore: maturityScore(required.maturity),
      requiredEvidenceScore: evidenceBaseConfidence(required.evidence),
      measuredShortfall,
      failingControls: rollup.implementations.filter((i) => i.status === "deficient" || i.status === "not-implemented"),
    };
  });

  return result;
}

export function profileSummary(assetId: AssetId) {
  const evaluation = evaluateAssetAgainstProfile(assetId)!;
  const asset = ASSET_ROLLUP_BY_ID[assetId];
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
