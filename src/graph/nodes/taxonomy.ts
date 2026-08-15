// The controlled vocabularies every other node and edge is expressed in.
//
// This is the line between the graph and the engine: an ordered list of the
// maturity stages a control can be at is vocabulary (a fact about how ACME
// describes posture), while the number each stage is worth is scoring (a
// judgment the engine applies). Splitting them is what lets engine/assurance.js
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
// mapping an SCF domain to an assurance category, an implementation type, or a
// tool is a judgment call about how ACME chooses to report, not a fact carried
// in the SCF source data.

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
export function highestTier(tiers: string[]): string | null {
  if (tiers.length === 0) return null;
  return tiers.reduce((a, b) => (tierRank(b) > tierRank(a) ? b : a));
}

// ---- Maturity and evidence vocabularies ---------------------------------------
// Both ordered weakest to strongest, so a comparison against a required minimum
// is an index comparison rather than a lookup table.
export const MATURITY_STAGES = ["Policy", "Procedure", "Implemented", "Monitored", "Managed"] as const;
export type MaturityStage = (typeof MATURITY_STAGES)[number];

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

// ---- Assurance categories ------------------------------------------------------
// The 6 rollup buckets every SCF domain resolves into for reporting.
export const ASSURANCE_CATEGORIES = ["Data Protection", "Configuration", "Detection", "Identity & Access", "Governance", "Resilience"] as const;
export type AssuranceCategory = (typeof ASSURANCE_CATEGORIES)[number];

export const DOMAIN_ASSURANCE_CATEGORY: Record<string, AssuranceCategory> = {
  "Security, Compliance & Resilience Governance": "Governance",
  "Artificial Intelligence & Autonomous Technologies": "Governance",
  "Asset Management": "Configuration",
  "Business Continuity & Disaster Recovery": "Resilience",
  "Capacity & Performance Planning": "Resilience",
  "Change Management": "Configuration",
  "Embedded Technology": "Configuration",
  "Cloud Security": "Configuration",
  Compliance: "Governance",
  "Configuration Management": "Configuration",
  "Continuous Monitoring": "Detection",
  "Cryptographic Protections": "Data Protection",
  "Data Classification & Handling": "Data Protection",
  "Endpoint Security": "Detection",
  "Human Resources Security": "Governance",
  "Identification & Authentication": "Identity & Access",
  "Incident Response": "Detection",
  "Information Assurance": "Governance",
  Maintenance: "Resilience",
  "Mobile Device Management": "Identity & Access",
  "Network Security": "Identity & Access",
  "Physical & Environmental Security": "Resilience",
  "Data Privacy": "Data Protection",
  "Project & Resource Management": "Governance",
  "Risk Management": "Governance",
  "Secure Engineering & Architecture": "Configuration",
  "Security Operations": "Detection",
  "Security Awareness & Training": "Governance",
  "Technology Development & Acquisition": "Governance",
  "Third-Party Management": "Governance",
  "Threat Management": "Detection",
  "Vulnerability & Patch Management": "Detection",
  "Web Security": "Identity & Access",
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
  "Security, Compliance & Resilience Governance": IMPLEMENTATION_TYPES.PROCESS,
  "Artificial Intelligence & Autonomous Technologies": IMPLEMENTATION_TYPES.PROCESS,
  "Asset Management": IMPLEMENTATION_TYPES.MANUAL,
  "Business Continuity & Disaster Recovery": IMPLEMENTATION_TYPES.MANUAL,
  "Capacity & Performance Planning": IMPLEMENTATION_TYPES.AUTOMATED,
  "Change Management": IMPLEMENTATION_TYPES.MANUAL,
  "Cloud Security": IMPLEMENTATION_TYPES.AUTOMATED,
  Compliance: IMPLEMENTATION_TYPES.PROCESS,
  "Configuration Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Continuous Monitoring": IMPLEMENTATION_TYPES.AUTOMATED,
  "Cryptographic Protections": IMPLEMENTATION_TYPES.AUTOMATED,
  "Data Classification & Handling": IMPLEMENTATION_TYPES.MANUAL,
  "Endpoint Security": IMPLEMENTATION_TYPES.AUTOMATED,
  "Human Resources Security": IMPLEMENTATION_TYPES.PROCESS,
  "Identification & Authentication": IMPLEMENTATION_TYPES.AUTOMATED,
  "Incident Response": IMPLEMENTATION_TYPES.MANUAL,
  "Information Assurance": IMPLEMENTATION_TYPES.PROCESS,
  Maintenance: IMPLEMENTATION_TYPES.MANUAL,
  "Mobile Device Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Network Security": IMPLEMENTATION_TYPES.AUTOMATED,
  "Physical & Environmental Security": IMPLEMENTATION_TYPES.MANUAL,
  "Data Privacy": IMPLEMENTATION_TYPES.PROCESS,
  "Project & Resource Management": IMPLEMENTATION_TYPES.PROCESS,
  "Risk Management": IMPLEMENTATION_TYPES.PROCESS,
  "Secure Engineering & Architecture": IMPLEMENTATION_TYPES.AUTOMATED,
  "Security Operations": IMPLEMENTATION_TYPES.MANUAL,
  "Security Awareness & Training": IMPLEMENTATION_TYPES.PROCESS,
  "Technology Development & Acquisition": IMPLEMENTATION_TYPES.MANUAL,
  "Third-Party Management": IMPLEMENTATION_TYPES.PROCESS,
  "Threat Management": IMPLEMENTATION_TYPES.MANUAL,
  "Vulnerability & Patch Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Web Security": IMPLEMENTATION_TYPES.AUTOMATED,
};

// Only populated for Automated domains — the primary tool that continuously
// enforces controls in that domain, reusing the same tool stack referenced
// throughout the Policy Center.
const DOMAIN_TOOL_HINT: Record<string, string> = {
  "Capacity & Performance Planning": "Azure Monitor",
  "Cloud Security": "Microsoft Defender for Cloud",
  "Configuration Management": "Intune / Azure Policy",
  "Continuous Monitoring": "Microsoft Sentinel",
  "Cryptographic Protections": "Azure Key Vault",
  "Endpoint Security": "Microsoft Defender for Endpoint",
  "Identification & Authentication": "Entra ID / Okta",
  "Mobile Device Management": "Microsoft Intune",
  "Network Security": "Zscaler",
  "Secure Engineering & Architecture": "Embedded architecture standard",
  "Vulnerability & Patch Management": "Tenable / Intune",
  "Web Security": "Cloudflare",
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
