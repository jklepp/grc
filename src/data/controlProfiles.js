// Control Profile — the required control posture for each data classification
// tier, expressed as a minimum maturity stage + minimum evidence type per
// Assurance Category. This is the "Required Control Profile" step in the
// platform's top-down flow: Asset Criticality -> Required Control Profile ->
// Unified Control Framework. Classification tier (not a raw criticality
// score) drives the requirement, per the existing Public/Internal/
// Confidential/Restricted tiers already used everywhere else in the app
// (see CLASS_ORDER in theme.js).
import { CLASS_ORDER } from "../theme";
import { MATURITY_STAGES, EVIDENCE_TYPES, ASSURANCE_CATEGORIES, MATURITY_SCORE, EVIDENCE_CONFIDENCE, categoryAssuranceScore } from "./assuranceModel";

// Baseline bar every asset at a tier must clear, before any category-specific
// bump. Each tier is one full "how convincingly can we prove this" step up
// from the last: attest it in a doc, show it, have it examined, prove it by
// machine.
const TIER_BASELINE = {
  Public: { maturity: "Policy", evidence: "Document" },
  Internal: { maturity: "Procedure", evidence: "Screenshot" },
  Confidential: { maturity: "Implemented", evidence: "Auditor examination" },
  Restricted: { maturity: "Managed", evidence: "Automated technical test" },
};

// These three categories carry the most direct exposure when a breach
// involves sensitive data, so they're held to one notch stricter than the
// tier baseline once data actually becomes sensitive (Confidential/Restricted).
const HIGH_SENSITIVITY_CATEGORIES = ["Data Protection", "Identity & Access", "Detection"];
const BUMPED_TIERS = ["Confidential", "Restricted"];

function bump(list, value) {
  const i = list.indexOf(value);
  return list[Math.min(i + 1, list.length - 1)];
}

// Resolved once at module load: CONTROL_PROFILES[tier][category] -> { maturity, evidence }
export const CONTROL_PROFILES = {};
CLASS_ORDER.forEach((tier) => {
  const base = TIER_BASELINE[tier];
  CONTROL_PROFILES[tier] = {};
  ASSURANCE_CATEGORIES.forEach((category) => {
    const shouldBump = BUMPED_TIERS.includes(tier) && HIGH_SENSITIVITY_CATEGORIES.includes(category);
    CONTROL_PROFILES[tier][category] = shouldBump
      ? { maturity: bump(MATURITY_STAGES, base.maturity), evidence: bump(EVIDENCE_TYPES, base.evidence) }
      : { maturity: base.maturity, evidence: base.evidence };
  });
});

// Per-category pass/partial/gap for one asset's actual maturity+evidence
// against its classification tier's required minimums. "met" requires both
// maturity and evidence to clear the bar; "partial" is one of the two;
// anything else is a genuine gap.
export function evaluateAssetAgainstProfile(classification, categories) {
  const profile = CONTROL_PROFILES[classification];
  const result = {};
  ASSURANCE_CATEGORIES.forEach((category) => {
    const required = profile[category];
    const actual = categories[category];
    const maturityMet = MATURITY_STAGES.indexOf(actual.maturityStage) >= MATURITY_STAGES.indexOf(required.maturity);
    const evidenceMet = EVIDENCE_TYPES.indexOf(actual.evidenceType) >= EVIDENCE_TYPES.indexOf(required.evidence);
    const status = maturityMet && evidenceMet ? "met" : maturityMet || evidenceMet ? "partial" : "gap";
    result[category] = { status, required, actual, requiredMaturityScore: MATURITY_SCORE[required.maturity], requiredEvidenceScore: EVIDENCE_CONFIDENCE[required.evidence] };
  });
  return result;
}

// The assurance score a system would need to fully clear its tier's Required
// Control Profile — every category's required maturity+evidence run through
// the same categoryAssuranceScore formula assets are judged by, at 100%
// effectiveness (the ceiling, since "required" describes the bar itself, not
// an observed asset). Not a separately hand-picked round number per tier.
export function tierTargetScore(tier) {
  const profile = CONTROL_PROFILES[tier];
  const scores = ASSURANCE_CATEGORIES.map((category) =>
    categoryAssuranceScore({ maturityStage: profile[category].maturity, evidenceType: profile[category].evidence, effectivenessPct: 100 })
  );
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
