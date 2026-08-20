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
//                  curated judgment (edges/categoryAssessments.ts); a control
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
// This file holds the four things that genuinely are per-implementation facts
// a person owns:
//
//   OWNERSHIP              who runs this control on this system, by default
//   OWNER_OVERRIDES         where a specific implementation's owner differs
//                          from that default, with why
//   IMPLEMENTATION_OVERRIDES  where the recorded maturity differs from the
//                          asset's category baseline, with the reason
//   NOT_IMPLEMENTED        where a required control has no implementation at
//                          all — declared, not inferred from absence, so that
//                          "we haven't built this" and "nobody has looked" stay
//                          distinguishable
//
// engine/implementation.ts does the composing.
import type { PrismaLevel } from "../nodes/taxonomy";
import type { AssetId, ControlId, OrgId, FindingId, SystemId } from "../ids";

// ---- Who operates the control ------------------------------------------------
// A control ACME requires but doesn't run itself is not "not applicable" — it's
// implemented by someone else. Before this, inheritance was expressed as an
// applicability EXCEPTION, so an auditor asking how CFG-02 is satisfied on the
// KMS key was told "not required here," which isn't true: it is required, and
// AWS satisfies it.
//
// Modelling it as responsibility rather than as a scope keeps the scope
// vocabulary at two values and lets an inherited control score on the same
// ladder as everything else. Vendor differentiation needs no separate rating —
// it falls out of what the vendor can actually produce. AWS exposes queryable
// config APIs (observation, 90); a SaaS vendor hands over an annual SOC 2 PDF
// (auditor examination, 75). Same scale, same decay, same ceiling.
export const RESPONSIBILITIES = {
  INTERNAL: "internal", // an ACME team runs it, scoped to this system — System Owned
  VENDOR: "vendor", // the provider runs it; we review their evidence — Vendor Inherited
  SHARED: "shared", // provider secures the platform, ACME configures it — Shared Responsibility
  // A central ACME program runs it once, the same way, for every system in the
  // register — not this system's team, and not a vendor. Enterprise IAM,
  // vulnerability management, and incident response are the shape: one team,
  // one process, attested once (graph/nodes/enterpriseAttestations.ts) and
  // inherited by every boundary rather than re-proven per system.
  ENTERPRISE: "enterprise", // Enterprise Inherited
} as const;
export type Responsibility = (typeof RESPONSIBILITIES)[keyof typeof RESPONSIBILITIES];

// Domains where the provider secures the platform and ACME configures it —
// SHARED by nature of the domain, not because someone happened to type
// `responsibility: "shared"` on one pair. Unlike VENDOR/ENTERPRISE this
// carries no scoring effect: the control is still assessed (or not) exactly
// as any other, this only changes which responsibility bucket it displays
// under. A specific (asset, control) pair can still override this default via
// ImplementationMechanism.responsibility, the same way one can already
// override the internal default.
export const SHARED_RESPONSIBILITY_DOMAINS: string[] = [
  "Change & Cloud Security",
  "Configuration Management",
  "Endpoint Security",
  "Network & Web Security",
];

// ---- The per-implementation facts a person owns -------------------------------
// `mechanism` is the HOW, and it genuinely did not exist anywhere in the model
// before. You could see that a bucket was encrypted and who owned it, but not
// by what means — "SSE-KMS under the SYS-003 CMK" was nowhere.
//
// Authored sparsely on purpose. An implementation with no record here is
// internal-responsibility with an unstated mechanism, which is the honest
// default for the ~176 pairs nobody has written one for yet.
export interface ImplementationMechanism {
  assetId: AssetId;
  controlId: ControlId;
  mechanism: string;
  responsibility?: Responsibility;
  // Required when responsibility is vendor or shared — who actually runs it.
  provider?: string;
}

// ---- When a control's current implementation went live -----------------------
// A separate fact from `mechanism` above on purpose: HOW a control is
// implemented and SINCE WHEN it has been operating are different questions,
// and this one is answered rarely — most (asset, control) pairs carry no
// record here, and engine/assessment.ts treats that absence as "operating
// history untracked", not as "just implemented". Where it IS authored, it
// anchors the HITRUST-style 90-day operating-history gate: evidence can prove
// a control works today without proving it has worked long enough to earn the
// top rungs of the maturity ladder, and those are different claims.
export interface ControlOperatingHistory {
  assetId: AssetId;
  controlId: ControlId;
  implementedAt: string;
}

// ---- Program controls, per system ---------------------------------------------
// Seven key controls are marked scope: "program" because asking each asset
// whether ACME runs a risk-assessment process would be theatre. But they were
// scored and then never consumed by any rollup, so the program layer reached the
// hero number not at all.
//
// They now score from the bottom like everything else: one implementation per
// (system, control) that a rule confirms, rolled up through the system. What
// they are NOT is blanket-inherited — four of the seven hold everywhere, three
// depend on what a system contains, and one of those three would be wrong
// today. AAT-01 (AI governance) blanket-applied to the Workday boundary would
// assert AI governance coverage for a system with no AI asset in it.
//
// Same shape as an asset applicability rule, one level up: conditions over what
// the system holds, and a rationale that travels with the answer.
export interface ProgramApplicabilityRule {
  controlId: ControlId;
  // Omitted condition means "not part of this rule's test", so a rule with an
  // empty `appliesWhen` reads as "every system", matching ruleMatches() on the
  // asset side.
  appliesWhen: {
    hostingTypes?: string[];
    // Data kinds present anywhere in the system boundary.
    dataKinds?: string[];
    // Asset kinds present anywhere in the system boundary.
    assetKinds?: string[];
    // The system has at least one actor reaching in or out across the boundary.
    hasExternalActors?: boolean;
    // identity.ts IdentityPopulation.identityType values with totalCount > 0
    // anywhere in the boundary (any-of) — e.g. "service-account", "vendor".
    identityTypes?: string[];
    // A privileged or break-glass identity population exists (totalCount > 0).
    hasPrivilegedIdentity?: boolean;
    // exposure.ts ExposurePosture.adminPosture, if recorded (any-of).
    adminPostures?: string[];
    // exposure.ts ExposurePosture.apiPosture, if recorded (any-of).
    apiPostures?: string[];
    // exposure.ts ExposurePosture.egressPosture, if recorded (any-of).
    egressPostures?: string[];
    // The system has at least one vendors.ts SystemVendor record, or
    // declared one at onboarding (systems.ts OnboardingSecurityProfile).
    hasThirdPartyIntegration?: boolean;
    // vendors.ts Vendor.category for vendors this system depends on (any-of).
    vendorCategories?: string[];
    // sdlc.ts SdlcPosture.applicable, or declared at onboarding — the
    // system runs software ACME builds.
    sdlcApplicable?: boolean;
    // systems.ts NetworkExposure axes declared present (any-of).
    networkExposure?: string[];
    // dataProfile.subjects names customers/end-users — a customer-facing
    // principal population exists.
    hasCustomerIdentities?: boolean;
    // The system uses AI, independent of whether it owns an AI-kind asset.
    usesAI?: boolean;
    // The system can take autonomous action without a human in the loop.
    autonomousActions?: boolean;
    // systems.ts SystemRegulatoryContext values present (any-of).
    regulatoryContext?: string[];
  };
  rationale: string;
}

// A program control a rule matched but that shouldn't apply to this system
// anyway — the system-level twin of an applicability exception.
export interface ProgramApplicabilityException {
  systemId: SystemId;
  controlId: ControlId;
  reason: string;
}


export interface OwnerOverride {
  assetId: AssetId;
  controlId: ControlId;
  ownerIds: OrgId[];
  note: string;
}


export interface ImplementationOverride {
  assetId: AssetId;
  controlId: ControlId;
  maturityStage: PrismaLevel;
  note: string;
  findingId?: FindingId;
}


export interface NotImplemented {
  assetId: AssetId;
  controlId: ControlId;
  reason: string;
}
