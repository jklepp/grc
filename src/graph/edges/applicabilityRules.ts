// Why a control applies to an asset — as data, not as a hardcoded assumption.
//
// The question an auditor actually asks is never "is this control in place."
// It's "why is this control in scope here," and its harder twin, "why isn't
// that one." Neither was answerable before: an asset's control expectations
// came from CONTROL_PROFILES[tier], a maturity/evidence floor per assurance
// category, which can say a Restricted asset needs Managed-grade Data
// Protection but not which controls that means or why.
//
// Rules are declarative rather than enumerated for a reason that matters at
// this scale: 15 assets x 323 in-scope controls is ~4,800 applicability
// decisions. Hand-listing them would guarantee both false claims (a control
// asserted against an asset it can't apply to) and silent omissions. Twenty-odd
// rules that each state a condition and its rationale generate the same answer
// and can be checked by reading them.
//
// A rule matches when EVERY condition it names holds. Several rules for one
// control are alternatives — any match makes the control required. Conditions:
//
//   assetKinds        the normalized `kind` on the asset
//   minClassification the asset's DERIVED tier is at or above this
//   dataKinds         the asset touches at least one data type of this kind,
//                     in any role — so a service account that only *accesses*
//                     personal data is in scope the same as a store that holds it
//   hostingTypes      the parent system's hosting arrangement
//
// EXCEPTIONS record where a rule would fire but the control genuinely doesn't
// apply, each with a stated reason. They are the answer to "why doesn't DP-019
// apply here" — an exception is a decision someone made, and it should read
// like one rather than being absent from the model.
import type { AssetKind } from "../nodes/assets";
import type { ClassificationTier } from "../nodes/taxonomy";
import type { HostingType } from "../nodes/systems";
import type { AssetId, ControlId } from "../ids";

export const APPLICABILITY_SOURCES = {
  CLASSIFICATION: "Data classification tier",
  ASSET_TYPE: "Asset type",
  DATA_HANDLING: "Personal data handling",
  HOSTING: "Hosting arrangement",
  UNIVERSAL: "Applies to every asset in scope",
} as const;
export type ApplicabilitySource = (typeof APPLICABILITY_SOURCES)[keyof typeof APPLICABILITY_SOURCES];

export interface ApplicabilityCondition {
  assetKinds?: AssetKind[];
  minClassification?: ClassificationTier;
  hostingTypes?: HostingType[];
  dataKinds?: string[];
}

export interface ApplicabilityRule {
  controlId: ControlId;
  requiredWhen: ApplicabilityCondition;
  rationale: string;
  source: ApplicabilitySource;
}


export interface ApplicabilityException {
  assetId: AssetId;
  controlId: ControlId;
  reason: string;
}
