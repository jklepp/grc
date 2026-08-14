// The required control profile per classification tier — what a tier demands,
// and how much each assurance category counts toward whether it got it.
//
// This is policy, not derivation, which is why it sits in the graph rather than
// the engine: someone decided that Restricted data requires Managed maturity
// with machine-generated evidence, and that identity and data protection matter
// more than resilience when confidentiality exposure is catastrophic. Those are
// declarations. Judging an asset against them is the derived part, and that
// lives in engine/profile.js.
//
// WEIGHTS, AND WHY THEY REPLACED A FLAT MEAN
// -------------------------------------------
// An asset's assurance used to be the equal-weighted mean of its six
// categories, on the argument that no category is inherently more important
// than another and asset-specific requirements belong in the control profile.
// The first half of that is true. The second half was an argument for doing
// this, and it hadn't been done — the profile set a maturity and evidence floor
// per category but had no say in how much each category counted.
//
// The consequence was visible on the most sensitive asset in the register. The
// customer data bucket scores in the mid-nineties everywhere except Identity &
// Access, and a flat mean let one-sixth weighting absorb that: an asset whose
// entire risk profile is confidentiality reported near-full assurance while the
// controls governing who can read it were its weakest area by thirty points.
//
// So the tier supplies the weights. As data gets more sensitive the categories
// that stop it being read move up, and the ones that keep it running move down.
// At Public the ordering inverts rather than flattens, which is the honest
// reading: public data has no confidentiality exposure worth weighting, but
// defacement and outage are still real, so integrity and availability lead.
//
// Every row sums to 100 — asserted in graph/validate.js, since a tier whose
// weights quietly summed to 95 would rescale that tier's entire estate.
import { CLASSIFICATION_TIERS, ASSURANCE_CATEGORIES, MATURITY_STAGES, EVIDENCE_TYPES } from "./taxonomy";

export const CATEGORY_WEIGHTS = {
  Restricted: {
    "Identity & Access": 25,
    "Data Protection": 25,
    Detection: 15,
    Configuration: 15,
    Resilience: 10,
    Governance: 10,
  },
  Confidential: {
    "Identity & Access": 22,
    "Data Protection": 22,
    Detection: 16,
    Configuration: 16,
    Resilience: 12,
    Governance: 12,
  },
  Internal: {
    "Identity & Access": 18,
    "Data Protection": 18,
    Detection: 17,
    Configuration: 17,
    Resilience: 15,
    Governance: 15,
  },
  // Nothing here is secret, so weighting confidentiality controls heavily would
  // be measuring the wrong thing. What can still go wrong to public data is
  // that it gets altered or goes down.
  Public: {
    "Identity & Access": 12,
    "Data Protection": 12,
    Detection: 17,
    Configuration: 20,
    Resilience: 22,
    Governance: 17,
  },
};

export function categoryWeightsFor(tier) {
  return CATEGORY_WEIGHTS[tier] ?? CATEGORY_WEIGHTS.Internal;
}

export function categoryWeight(tier, category) {
  return categoryWeightsFor(tier)[category] ?? 0;
}

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
// actually becomes sensitive. Note this is a separate lever from the weights
// above: the bump raises the bar a category has to clear, the weight decides
// how much clearing it counts for.
const HIGH_SENSITIVITY_CATEGORIES = ["Data Protection", "Identity & Access", "Detection"];
const BUMPED_TIERS = ["Confidential", "Restricted"];

function bump(list, value) {
  return list[Math.min(list.indexOf(value) + 1, list.length - 1)];
}

// Resolved once: CONTROL_PROFILES[tier][category] -> { maturity, evidence, weight }
export const CONTROL_PROFILES = {};
CLASSIFICATION_TIERS.forEach((tier) => {
  const base = TIER_BASELINE[tier];
  CONTROL_PROFILES[tier] = {};
  ASSURANCE_CATEGORIES.forEach((category) => {
    const shouldBump = BUMPED_TIERS.includes(tier) && HIGH_SENSITIVITY_CATEGORIES.includes(category);
    CONTROL_PROFILES[tier][category] = {
      maturity: shouldBump ? bump(MATURITY_STAGES, base.maturity) : base.maturity,
      evidence: shouldBump ? bump(EVIDENCE_TYPES, base.evidence) : base.evidence,
      weight: categoryWeight(tier, category),
    };
  });
});
