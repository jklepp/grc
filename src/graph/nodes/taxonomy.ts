// The controlled vocabularies every other node and edge is expressed in.
//
// This is the line between the graph and the engine: an ordered list of the
// maturity stages a control can be at is vocabulary (a fact about how ACME
// describes posture), while the number each stage is worth is scoring (a
// judgment the engine applies). Splitting them is what lets engine/assurance.ts
// stay a pure function library with no data of its own, and it keeps the graph
// free of anything that could be recomputed.
//
// Everything here was previously spread across assuranceModel.js and
// systemRegister.js. The domain-level maps in particular were sitting in
// systemRegister.js purely because that's where the first consumer happened to
// live, even though they describe SCF domains and have nothing to do with any
// one system.
//
// The same caveat those files carried still applies and is worth restating:
// mapping a control domain to an assurance category, an implementation type, or a
// tool is a judgment call about how ACME chooses to report, not a fact carried
// in the catalog source data.

// ---- Classification tiers ----------------------------------------------------
// Ordered least to most sensitive. validate.js asserts this stays in lockstep
// with CLASS_ORDER in theme.js, which drives the display colors — the two
// existing separately is a presentation concern, the two disagreeing is a bug.
export const CLASSIFICATION_TIERS = ["Public", "Internal", "Confidential", "Restricted"] as const;
export type ClassificationTier = (typeof CLASSIFICATION_TIERS)[number];

export function tierRank(tier: string): number {
  return CLASSIFICATION_TIERS.indexOf(tier as ClassificationTier);
}

// The high-water mark across a set of tiers — the operation behind both
// "an asset is as sensitive as the most sensitive data it holds" and
// "a system is as sensitive as its most sensitive asset."
export function highestTier(tiers: readonly string[]): ClassificationTier | null {
  if (tiers.length === 0) return null;
  const highest = tiers.reduce((a, b) => (tierRank(b) > tierRank(a) ? b : a));
  return CLASSIFICATION_TIERS.includes(highest as ClassificationTier) ? highest as ClassificationTier : null;
}

// ---- Evidence vocabulary --------------------------------------------------------
// Ordered weakest to strongest, so a comparison against a required minimum is an
// index comparison rather than a lookup table.
//
// MATURITY_STAGES used to sit here alongside it: one value naming where a
// control had reached. It is gone. A control is not AT a stage any more — it is
// rated at all five PRISMA levels independently and its score is the weighted
// sum, which is a different claim and needed a different vocabulary. See
// PRISMA_LEVELS below.
export const EVIDENCE_TYPES = [
  "Self-attestation",
  "Document",
  "Screenshot",
  "Auditor examination",
  "API configuration observation",
  "Automated technical test",
  "Continuous telemetry",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// ---- The PRISMA ladder -----------------------------------------------------------
// The five maturity levels a control is rated at, from HITRUST's PRISMA-derived
// scoring model. These are the same five rungs MATURITY_STAGES named, with
// "Monitored" written as "Measured" so the vocabulary matches the framework it
// implements — HITRUST's fourth rung asks whether the control's operation is
// being measured, which is a different question from whether it is being
// watched.
//
// The important difference from the old MATURITY_STAGES is not the spelling: a
// maturity STAGE was one value describing where a control had reached, so a
// control was at Procedure or at Managed but never both. A PRISMA LEVEL is a
// dimension — a control is rated separately at all five, and the score is a
// weighted sum across them. That is why this replaced the old vocabulary rather
// than renaming it.
//
// Ordered weakest to strongest, so "at least Implemented" stays index arithmetic.
export const PRISMA_LEVELS = ["Policy", "Procedure", "Implemented", "Measured", "Managed"] as const;
export type PrismaLevel = (typeof PRISMA_LEVELS)[number];

// ---- The compliance scale --------------------------------------------------------
// What each level is rated on. Five fixed points, not a continuum: an assessor
// says a level is Mostly Compliant, never that it is 68% compliant. Keeping the
// scale discrete is what stops a derived ratio from arriving at the score with
// more precision than the judgment behind it actually carries.
//
// Ordered, so "at least Mostly Compliant" is an index comparison rather than a
// lookup table that could drift out of step with the labels below.
export const COMPLIANCE_RATINGS = [0, 25, 50, 75, 100] as const;
export type ComplianceRating = (typeof COMPLIANCE_RATINGS)[number];

export const COMPLIANCE_LABELS: Record<ComplianceRating, string> = {
  0: "Non-Compliant",
  25: "Somewhat Compliant",
  50: "Partially Compliant",
  75: "Mostly Compliant",
  100: "Fully Compliant",
};

export function isComplianceRating(value: unknown): value is ComplianceRating {
  return (COMPLIANCE_RATINGS as readonly unknown[]).includes(value);
}

// ---- Assurance categories ------------------------------------------------------
// The 6 rollup buckets every SCF domain resolves into for reporting.
export const ASSURANCE_CATEGORIES = ["Data Protection", "Configuration", "Detection", "Identity & Access", "Governance", "Resilience"] as const;
export type AssuranceCategory = (typeof ASSURANCE_CATEGORIES)[number];

export const DOMAIN_ASSURANCE_CATEGORY: Record<string, AssuranceCategory> = {
  Governance: "Governance",
  "Risk Management": "Governance",
  "AI & Autonomous Technologies": "Governance",
  "Asset Management": "Configuration",
  "Identity & Access": "Identity & Access",
  "Data Protection": "Data Protection",
  Privacy: "Data Protection",
  "Configuration Management": "Configuration",
  "Change & Cloud Security": "Configuration",
  "Detection & Monitoring": "Detection",
  "Endpoint Security": "Detection",
  "Vulnerability Management": "Detection",
  "Incident Response": "Detection",
  "Business Continuity": "Resilience",
  "Capacity & Performance": "Resilience",
  "Physical & Maintenance": "Resilience",
  "Network & Web Security": "Identity & Access",
  "Secure Development": "Configuration",
  "People Security": "Governance",
  "Third-Party Management": "Governance",
};

export function categoryForDomain(domain: string): AssuranceCategory {
  return DOMAIN_ASSURANCE_CATEGORY[domain] || "Governance";
}

// ---- Implementation type -------------------------------------------------------
// How a control actually gets satisfied: continuously enforced by tooling, done
// by a person on a recurring basis, or evidenced by documentation rather than a
// system at all. A property of the control's nature, so it's assigned once per
// domain rather than per system.
export const IMPLEMENTATION_TYPES = {
  AUTOMATED: "Automated",
  MANUAL: "Manual",
  PROCESS: "Process & Procedure",
} as const;
export type ImplementationType = (typeof IMPLEMENTATION_TYPES)[keyof typeof IMPLEMENTATION_TYPES];

const DOMAIN_IMPLEMENTATION_TYPE: Record<string, ImplementationType> = {
  Governance: IMPLEMENTATION_TYPES.PROCESS,
  "Risk Management": IMPLEMENTATION_TYPES.PROCESS,
  "AI & Autonomous Technologies": IMPLEMENTATION_TYPES.PROCESS,
  "Asset Management": IMPLEMENTATION_TYPES.MANUAL,
  "Identity & Access": IMPLEMENTATION_TYPES.AUTOMATED,
  "Data Protection": IMPLEMENTATION_TYPES.AUTOMATED,
  Privacy: IMPLEMENTATION_TYPES.PROCESS,
  "Configuration Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Change & Cloud Security": IMPLEMENTATION_TYPES.AUTOMATED,
  "Detection & Monitoring": IMPLEMENTATION_TYPES.AUTOMATED,
  "Endpoint Security": IMPLEMENTATION_TYPES.AUTOMATED,
  "Vulnerability Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Incident Response": IMPLEMENTATION_TYPES.MANUAL,
  "Business Continuity": IMPLEMENTATION_TYPES.MANUAL,
  "Capacity & Performance": IMPLEMENTATION_TYPES.AUTOMATED,
  "Physical & Maintenance": IMPLEMENTATION_TYPES.MANUAL,
  "Network & Web Security": IMPLEMENTATION_TYPES.AUTOMATED,
  "Secure Development": IMPLEMENTATION_TYPES.MANUAL,
  "People Security": IMPLEMENTATION_TYPES.PROCESS,
  "Third-Party Management": IMPLEMENTATION_TYPES.PROCESS,
};

// Only populated for Automated domains — the primary tool that continuously
// enforces controls in that domain, reusing the same tool stack referenced
// throughout the Policy Center.
const DOMAIN_TOOL_HINT: Record<string, string> = {
  "Identity & Access": "Entra ID / Okta",
  "Data Protection": "Azure Key Vault",
  "Configuration Management": "Intune / Azure Policy",
  "Change & Cloud Security": "Microsoft Defender for Cloud",
  "Detection & Monitoring": "Microsoft Sentinel",
  "Endpoint Security": "Microsoft Defender for Endpoint",
  "Vulnerability Management": "Tenable / Intune",
  "Capacity & Performance": "Azure Monitor",
  "Network & Web Security": "Zscaler / Cloudflare",
};

export function getImplementationType(domain: string): ImplementationType {
  return DOMAIN_IMPLEMENTATION_TYPE[domain] || IMPLEMENTATION_TYPES.PROCESS;
}

export function getToolHint(domain: string): string | null {
  return DOMAIN_TOOL_HINT[domain] || null;
}

// ---- Basis ---------------------------------------------------------------------
// Every derived number in the engine carries one of these, so a reader can tell
// what a score is actually standing on. This is the mechanism that replaces
// fabricated per-control status: where there's nothing to compute from, the
// answer is "unassessed" rather than a plausible-looking number.
export const BASIS = {
  MEASURED: "measured", // backed by control implementations with real evidence
  ASSESSED: "assessed", // backed only by a category-level judgment
  INHERITED: "inherited", // covered by a vendor's own certification
  UNASSESSED: "unassessed", // nothing backs this yet — a gap, not a score
} as const;
export type Basis = (typeof BASIS)[keyof typeof BASIS];

export const BASIS_ORDER: Basis[] = [BASIS.MEASURED, BASIS.ASSESSED, BASIS.INHERITED, BASIS.UNASSESSED];

export const BASIS_META: Record<Basis, { label: string; detail: string }> = {
  [BASIS.MEASURED]: { label: "Measured", detail: "Computed from control implementations backed by evidence records." },
  [BASIS.ASSESSED]: { label: "Assessed", detail: "Computed from a category-level judgment, not from control-level evidence." },
  [BASIS.INHERITED]: { label: "Inherited", detail: "Covered by the hosting provider's own certification rather than ACME evidence." },
  [BASIS.UNASSESSED]: { label: "Unassessed", detail: "No implementation record exists yet — shown as a gap rather than a score." },
};
