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

export const APPLICABILITY_RULES: ApplicabilityRule[] = [
  // ---- Data Protection ---------------------------------------------------------
  {
    controlId: "CRY-05",
    requiredWhen: { assetKinds: ["object-storage", "relational-db", "vector-db", "key-management", "secrets-store", "saas-tenant"], minClassification: "Confidential" },
    rationale: "Holds data at rest at Confidential tier or above.",
    source: APPLICABILITY_SOURCES.CLASSIFICATION,
  },
  {
    controlId: "CRY-03",
    requiredWhen: {},
    rationale: "Every asset in scope either sends or receives data over a network.",
    source: APPLICABILITY_SOURCES.UNIVERSAL,
  },
  {
    controlId: "CRY-09",
    requiredWhen: { assetKinds: ["key-management", "secrets-store", "object-storage", "relational-db", "vector-db"] },
    rationale: "Either holds key material or depends on a customer-managed key to protect data at rest.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },
  {
    controlId: "DCH-18",
    requiredWhen: { assetKinds: ["object-storage", "relational-db", "vector-db", "saas-tenant", "log-feed"] },
    rationale: "Retains data over time, so a defined retention and disposal point exists.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },

  // ---- Configuration ------------------------------------------------------------
  {
    controlId: "CFG-02",
    requiredWhen: { hostingTypes: ["cloud", "on-prem"] },
    rationale: "ACME controls the configuration of this resource directly.",
    source: APPLICABILITY_SOURCES.HOSTING,
  },
  {
    controlId: "CFG-03",
    requiredWhen: { assetKinds: ["api-gateway", "compute-service", "relational-db", "vector-db"] },
    rationale: "Exposes services, ports, or functions that can be narrowed to what the workload actually needs.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },
  {
    controlId: "CHG-02",
    requiredWhen: {},
    rationale: "Every asset in scope has a configuration that can change, whether ACME-managed or vendor-managed.",
    source: APPLICABILITY_SOURCES.UNIVERSAL,
  },
  {
    controlId: "CLD-06",
    requiredWhen: { assetKinds: ["api-gateway", "compute-service", "vector-db", "object-storage", "saas-tenant", "saas-api"] },
    rationale: "Serves or stores data for more than one tenant, so isolation has to hold below the application layer.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },

  // ---- Detection -----------------------------------------------------------------
  {
    controlId: "MON-02",
    requiredWhen: {},
    rationale: "An asset that produces no forwarded events cannot be investigated after the fact.",
    source: APPLICABILITY_SOURCES.UNIVERSAL,
  },
  {
    controlId: "MON-03",
    requiredWhen: {},
    rationale: "Forwarded events have to identify actor, time, source, and outcome to be usable in an investigation.",
    source: APPLICABILITY_SOURCES.UNIVERSAL,
  },
  {
    controlId: "MON-08",
    requiredWhen: { assetKinds: ["log-feed", "object-storage", "relational-db", "saas-tenant"] },
    rationale: "Retains records that an investigation would later depend on being unaltered.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },
  {
    controlId: "VPM-05",
    requiredWhen: { assetKinds: ["api-gateway", "compute-service", "relational-db", "vector-db"], hostingTypes: ["cloud", "on-prem"] },
    rationale: "Runs software ACME is responsible for patching.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },

  // ---- Identity & Access ----------------------------------------------------------
  {
    controlId: "IAC-21",
    requiredWhen: {},
    rationale: "Every asset is reached by some identity whose access can be scoped to its actual need.",
    source: APPLICABILITY_SOURCES.UNIVERSAL,
  },
  {
    controlId: "IAC-17",
    requiredWhen: {},
    rationale: "Access granted to any asset drifts from need over time unless it is re-justified on a cycle.",
    source: APPLICABILITY_SOURCES.UNIVERSAL,
  },
  {
    controlId: "IAC-10",
    requiredWhen: { assetKinds: ["service-account", "saas-tenant", "saas-api", "api-gateway", "secrets-store"] },
    rationale: "Issues, holds, or verifies credentials, so credential lifetime and rotation are its concern.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },
  {
    controlId: "IAC-20",
    requiredWhen: {},
    rationale: "Authentication alone never establishes permission; a separate check has to enforce it.",
    source: APPLICABILITY_SOURCES.UNIVERSAL,
  },
  {
    controlId: "NET-03",
    requiredWhen: { assetKinds: ["api-gateway", "saas-api", "compute-service", "integration-endpoint", "export-endpoint"] },
    rationale: "Sits on a trust boundary where traffic crosses into or out of the system.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },
  {
    controlId: "NET-17",
    requiredWhen: { assetKinds: ["export-endpoint", "api-gateway", "saas-api", "object-storage", "integration-endpoint"], dataKinds: ["pii", "employee", "documents", "financial"] },
    rationale: "Sensitive data can leave the boundary through this asset, so what leaves has to be inspected.",
    source: APPLICABILITY_SOURCES.DATA_HANDLING,
  },

  // ---- Resilience -------------------------------------------------------------------
  {
    controlId: "BCD-11",
    requiredWhen: { assetKinds: ["object-storage", "relational-db", "vector-db", "saas-tenant"] },
    rationale: "Holds state whose loss could not be reconstructed from another asset.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },
  {
    controlId: "CAP-01",
    requiredWhen: { assetKinds: ["api-gateway", "compute-service", "relational-db", "vector-db", "saas-api"] },
    rationale: "Serves live request traffic whose volume can exceed what it is provisioned for.",
    source: APPLICABILITY_SOURCES.ASSET_TYPE,
  },
];

export interface ApplicabilityException {
  assetId: AssetId;
  controlId: ControlId;
  reason: string;
}

// Where a rule fires but the control genuinely doesn't apply. Each needs a
// reason, because "not applicable" without one is indistinguishable from "we
// never got to it" — and those are very different answers to give an auditor.
export const APPLICABILITY_EXCEPTIONS: ApplicabilityException[] = [
  {
    assetId: "AST-042-07", controlId: "DCH-18",
    reason: "Retention for the exported log stream is set and enforced in ACME's central monitoring destination, not in the vendor feed. Assessing it here would double-count the same control the destination already carries.",
  },
  {
    assetId: "AST-003-07", controlId: "CFG-02",
    reason: "AWS KMS exposes no operating system, service, or hardening surface ACME can configure — there is no baseline to apply. Its underlying hardening is inherited from the provider's certification rather than assessed here.",
  },
];

const EXCEPTION_KEY = new Set(APPLICABILITY_EXCEPTIONS.map((e) => `${e.assetId}::${e.controlId}`));

export function exceptionFor(assetId: AssetId, controlId: ControlId): ApplicabilityException | null {
  return EXCEPTION_KEY.has(`${assetId}::${controlId}`)
    ? APPLICABILITY_EXCEPTIONS.find((e) => e.assetId === assetId && e.controlId === controlId) ?? null
    : null;
}

export function rulesForControl(controlId: ControlId): ApplicabilityRule[] {
  return APPLICABILITY_RULES.filter((r) => r.controlId === controlId);
}
