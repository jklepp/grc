// ASSET —[implements]→ CONTROL
//
// The edge the whole model turns on: a control's definition is universal, its
// implementation is contextual. Least Privilege means one thing, and it works
// extremely well on the KMS key and badly on the RAG service. There is no
// honest single number for "how good is Least Privilege at ACME," which is why
// there is no score on the control itself anywhere in this app.
//
// HOW AN IMPLEMENTATION IS COMPOSED, AND WHY IT ISN'T ALL TYPED HERE
// -------------------------------------------------------------------
// Applicability resolves to ~176 asset/control pairs. Hand-authoring a maturity
// stage and an effectiveness percentage for each would mean inventing ~350
// numbers nobody assessed — the machine-generated posture this app has always
// refused to ship, just with more keystrokes. So an implementation is composed
// from inputs that already exist and were each arrived at deliberately:
//
//   maturity       defaults to the asset's category-level assessment for the
//                  category this control belongs to. That assessment is a real
//                  curated judgment (edges/categoryAssessments.js); a control
//                  inherits it unless someone has recorded something different.
//   effectiveness  starts from the same assessment, then moves with what the
//                  evidence for THIS control on THIS asset actually returned.
//                  A failed cross-tenant test drags CLD-06 on the RAG service
//                  down without touching CLD-06 on the S3 bucket.
//   confidence     comes entirely from the evidence records (type, coverage,
//                  freshness). Nothing here asserts it.
//
// So the differentiation between two implementations of the same control comes
// from evidence, which is the only input that is actually per-pair. That is the
// intended reading: what separates a strong implementation from a weak one is
// what you can show about it.
//
// This file holds the three things that genuinely are per-implementation facts
// a person owns:
//
//   OWNERSHIP              who runs this control on this system
//   IMPLEMENTATION_OVERRIDES  where the recorded maturity differs from the
//                          asset's category baseline, with the reason
//   NOT_IMPLEMENTED        where a required control has no implementation at
//                          all — declared, not inferred from absence, so that
//                          "we haven't built this" and "nobody has looked" stay
//                          distinguishable
//
// engine/implementation.js does the composing.

// Who operates a control, by the category it belongs to and the system it runs
// in. Ownership genuinely varies by team and platform rather than by individual
// resource, so recording it per asset would be fifteen copies of the same fact.
export const OWNERSHIP = {
  "SYS-003": {
    "Data Protection": "Data Platform / IT Security",
    Configuration: "ML Platform Team",
    Detection: "IT Security — SOC function",
    "Identity & Access": "ML Platform Team / IT Security",
    Governance: "GRC",
    Resilience: "Infrastructure",
  },
  "SYS-042": {
    "Data Protection": "IT Security (SaaS administration)",
    Configuration: "IT Security (SaaS administration)",
    Detection: "IT Security — SOC function",
    "Identity & Access": "HR Operations / IT Security",
    Governance: "GRC",
    Resilience: "IT Security (SaaS administration)",
  },
  program: {
    "Data Protection": "Data Platform / IT Security",
    Configuration: "IT",
    Detection: "IT Security — SOC function",
    "Identity & Access": "IT Security",
    Governance: "GRC",
    Resilience: "Infrastructure",
  },
};

// Where the recorded maturity of a specific implementation differs from the
// asset's category baseline. Each carries the reason it differs — an override
// without one is just an unexplained number, which is what this model exists to
// get rid of.
export const IMPLEMENTATION_OVERRIDES = [
  {
    assetId: "AST-003-03", controlId: "CLD-06", maturityStage: "Procedure",
    note: "Tenant separation on the retrieval path is enforced by a filter the application is expected to pass, with no independent enforcement below it. Documented as a procedure rather than an implemented control, which is what the failing cross-tenant test confirms.",
  },
  {
    assetId: "AST-003-04", controlId: "CLD-06", maturityStage: "Implemented",
    note: "Index-level separation is real and enforced by the engine; the caller-supplied filter on vector search is the part that isn't.",
  },
  {
    assetId: "AST-003-03", controlId: "IAC-21", maturityStage: "Policy",
    note: "A least-privilege standard exists on paper, but the service role was provisioned with broad read access across every store in the boundary and has not been scoped since. SEC-2260.",
  },
  {
    assetId: "AST-003-05", controlId: "NET-17", maturityStage: "Policy",
    note: "DLP is required by the Data Classification & Handling Policy but nothing is deployed on the ingestion path. SEC-2261.",
  },
  {
    assetId: "AST-003-04", controlId: "DCH-18", maturityStage: "Policy",
    note: "No retention or disposal schedule exists for embeddings — the policy applies, the schedule was never written. SEC-2262.",
  },
  {
    assetId: "AST-042-06", controlId: "NET-17", maturityStage: "Policy",
    note: "Bulk export runs without content inspection. The control is required and understood; nothing enforces it.",
  },
  {
    assetId: "AST-042-03", controlId: "IAC-10", maturityStage: "Procedure",
    note: "The integration credential is a static secret with no expiry. Rotation is a documented manual step that has no recorded execution.",
  },
  {
    assetId: "AST-042-01", controlId: "IAC-17", maturityStage: "Procedure",
    note: "The recertification campaign runs, but the manager-role slice is past due rather than complete. SEC-2210.",
  },
  {
    assetId: "AST-003-07", controlId: "CRY-09", maturityStage: "Managed",
    note: "Automatic annual rotation, MFA-gated administrative access through PIM, and separation between key administration and access approval. The strongest implementation of this control in the estate.",
  },
  {
    assetId: "AST-003-08", controlId: "IAC-10", maturityStage: "Managed",
    note: "Every service credential is brokered and rotated automatically; nothing in the boundary holds a long-lived secret outside this store.",
  },
  {
    assetId: "AST-003-03", controlId: "MON-03", maturityStage: "Procedure",
    note: "Retrieval events carry a request id but no acting identity, so the logs cannot answer who read which document — the gap that would make a cross-tenant read invisible after the fact.",
  },
  {
    assetId: "AST-003-04", controlId: "BCD-11", maturityStage: "Procedure",
    note: "Snapshots are configured but have never been restore-tested, so recoverability is asserted rather than demonstrated.",
  },
  {
    assetId: "AST-003-03", controlId: "IAC-20", maturityStage: "Procedure",
    note: "Authentication is enforced at the service edge; the retrieval call itself performs no separate per-resource permission check.",
  },
  {
    assetId: "AST-042-06", controlId: "NET-03", maturityStage: "Procedure",
    note: "The endpoint accepts requests from outside the allowlisted integration ranges, so the boundary is defined but not enforced.",
  },
];

// Required controls with no implementation. Declared rather than inferred,
// because an absent record could equally mean "not built" or "not looked at,"
// and those are different answers. Anything required, not excepted, and not
// listed here is expected to have an implementation — validate.js enforces it.
export const NOT_IMPLEMENTED = [
  {
    assetId: "AST-042-03", controlId: "MON-03",
    reason: "The tenant emits no per-action log for this service account's API calls, so there is nothing to shape into a conformant event. Raised with the vendor; no ACME-side implementation is possible today.",
  },
  {
    assetId: "AST-042-05", controlId: "NET-17",
    reason: "Content inspection on the identity feed has not been built. The feed carries employee identifiers by design, so the control applies and is simply outstanding.",
  },
  {
    assetId: "AST-042-02", controlId: "NET-17",
    reason: "Inspection on the tenant API surface is not deployed; the DLP work to date has been scoped to the export path only.",
  },
];

const OVERRIDE_BY_PAIR = Object.fromEntries(IMPLEMENTATION_OVERRIDES.map((o) => [`${o.assetId}::${o.controlId}`, o]));
const NOT_IMPLEMENTED_BY_PAIR = Object.fromEntries(NOT_IMPLEMENTED.map((n) => [`${n.assetId}::${n.controlId}`, n]));

export function overrideFor(assetId, controlId) {
  return OVERRIDE_BY_PAIR[`${assetId}::${controlId}`] || null;
}

export function notImplementedFor(assetId, controlId) {
  return NOT_IMPLEMENTED_BY_PAIR[`${assetId}::${controlId}`] || null;
}

export function ownerFor(systemId, category) {
  return OWNERSHIP[systemId]?.[category] || OWNERSHIP.program[category];
}
