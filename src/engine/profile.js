// The required control profile per classification tier, and how an asset
// measures against it.
//
// Ported from controlProfiles.js essentially intact — the tier ladder was
// sound. Two things changed underneath it:
//
//   The tier being evaluated is now DERIVED from the data an asset holds
//   (engine/classification.js) rather than inherited from its parent system, so
//   an asset is judged against the bar its own data earns.
//
//   The actual posture being compared is the category ROLLUP, which blends
//   measured implementations with the assessed baseline, rather than the raw
//   category assessment. So an asset whose evidenced controls are failing no
//   longer clears its profile on the strength of a self-assessment that says
//   otherwise.
import { CLASSIFICATION_TIERS, ASSURANCE_CATEGORIES, MATURITY_STAGES, EVIDENCE_TYPES } from "../graph/nodes/taxonomy";
import { assessmentFor } from "../graph/edges/categoryAssessments";
import { blendAssurance, maturityScore, evidenceBaseConfidence, meetsMaturity, meetsEvidence, mean, display } from "./assurance";
import { ASSET_ROLLUP_BY_ID } from "./rollups";

// The baseline bar every asset at a tier must clear before any category-specific
// bump. Each tier is one full "how convincingly can we prove this" step up from
// the last: attest it in a doc, show it, have it examined, prove it by machine.
const TIER_BASELINE = {
  Public: { maturity: "Policy", evidence: "Document" },
  Internal: { maturity: "Procedure", evidence: "Screenshot" },
  Confidential: { maturity: "Implemented", evidence: "Auditor examination" },
  Restricted: { maturity: "Managed", evidence: "Automated technical test" },
};

// These three carry the most direct exposure when a breach involves sensitive
// data, so they're held one notch stricter than the tier baseline once data
// actually becomes sensitive.
const HIGH_SENSITIVITY_CATEGORIES = ["Data Protection", "Identity & Access", "Detection"];
const BUMPED_TIERS = ["Confidential", "Restricted"];

function bump(list, value) {
  return list[Math.min(list.indexOf(value) + 1, list.length - 1)];
}

export const CONTROL_PROFILES = {};
CLASSIFICATION_TIERS.forEach((tier) => {
  const base = TIER_BASELINE[tier];
  CONTROL_PROFILES[tier] = {};
  ASSURANCE_CATEGORIES.forEach((category) => {
    const shouldBump = BUMPED_TIERS.includes(tier) && HIGH_SENSITIVITY_CATEGORIES.includes(category);
    CONTROL_PROFILES[tier][category] = shouldBump
      ? { maturity: bump(MATURITY_STAGES, base.maturity), evidence: bump(EVIDENCE_TYPES, base.evidence) }
      : { maturity: base.maturity, evidence: base.evidence };
  });
});

// The assurance score an asset would need to fully clear its tier's profile:
// every category's required maturity and evidence run through the same formula
// assets are judged by, at 100% effectiveness (the ceiling, since "required"
// describes the bar itself, not an observed asset).
export function tierTargetScore(tier) {
  const profile = CONTROL_PROFILES[tier];
  return display(
    mean(
      ASSURANCE_CATEGORIES.map((category) =>
        blendAssurance({
          maturityStage: profile[category].maturity,
          evidenceConfidence: evidenceBaseConfidence(profile[category].evidence),
          effectivenessPct: 100,
        })
      )
    )
  );
}

// Per-category met / partial / gap for one asset against its tier's minimums.
// "met" needs both maturity and evidence to clear the bar; "partial" is one of
// the two; anything else is a genuine gap.
export function evaluateAssetAgainstProfile(assetId) {
  const asset = ASSET_ROLLUP_BY_ID[assetId];
  if (!asset) return null;
  const profile = CONTROL_PROFILES[asset.classification];
  const result = {};

  ASSURANCE_CATEGORIES.forEach((category) => {
    const required = profile[category];
    const assessment = assessmentFor(assetId, category);
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

export function profileSummary(assetId) {
  const evaluation = evaluateAssetAgainstProfile(assetId);
  const asset = ASSET_ROLLUP_BY_ID[assetId];
  const statuses = Object.values(evaluation).map((e) => e.status);
  return {
    evaluation,
    tier: asset.classification,
    target: tierTargetScore(asset.classification),
    actual: asset.overallAssurance,
    met: statuses.filter((s) => s === "met").length,
    partial: statuses.filter((s) => s === "partial").length,
    gap: statuses.filter((s) => s === "gap").length,
    clears: asset.overallAssurance >= tierTargetScore(asset.classification),
  };
}
