// The shape of a required control profile entry — what a tier demands of one
// assurance category, and how much that category counts toward whether it got it.
//
// The TYPE only. ACME's actual profile lives in
// facts/control-profile.yaml, and resolving the definition (baseline + bump +
// weights) into the [tier][category] lookup the engine reads happens in
// graph/assemble.ts. What remains here is the reasoning, which belongs with the
// type it explains.
//
// This is policy, not derivation, which is why it sits in the graph rather than
// the engine: someone decided that Restricted data requires Managed maturity
// with machine-generated evidence, and that identity and data protection matter
// more than resilience when confidentiality exposure is catastrophic. Those are
// declarations. Judging an asset against them is the derived part, and that
// lives in engine/profile.ts.
//
// WEIGHTS
// -------
// A flat mean let one-sixth weighting absorb a thirty-point Identity & Access
// shortfall on data whose entire risk is confidentiality. So the tier supplies
// the weights. As data gets more sensitive the categories
// that stop it being read move up, and the ones that keep it running move down.
// At Public the ordering inverts rather than flattens, which is the honest
// reading: public data has no confidentiality exposure worth weighting, but
// defacement and outage are still real, so integrity and availability lead.
//
// Every row sums to 100 — asserted in graph/validate.ts, since a tier whose
// weights quietly summed to 95 would rescale that tier's entire estate.
import type { PrismaLevel, EvidenceType } from "./taxonomy";

export interface ControlProfileEntry {
  maturity: PrismaLevel;
  evidence: EvidenceType;
  weight: number;
}
