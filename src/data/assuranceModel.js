// Cyber Assurance scoring engine — single source of truth for every formula
// behind Asset Criticality, Control Assurance, Evidence Confidence, and
// Residual Risk. Consumed by assets.js (which attaches these numbers to real
// assets) and controlProfiles.js (which sets the bar these numbers are judged
// against). Kept framework-agnostic on purpose: HITRUST's PRISMA maturity
// model, NIST's CIA-plus weighting, and a plain likelihood x impact residual
// risk grid, but none of the vendor-specific scoring mechanics.

// ---- Control maturity (HITRUST PRISMA-style) --------------------------------
// How convincingly a control can be shown to exist, operate consistently, be
// measured, and be actively managed — not just whether it's "on" or "off".
export const MATURITY_STAGES = ["Policy", "Procedure", "Implemented", "Monitored", "Managed"];
export const MATURITY_SCORE = { Policy: 20, Procedure: 40, Implemented: 60, Monitored: 80, Managed: 100 };

// ---- Evidence confidence -----------------------------------------------------
// How much an assertion can be trusted, from "we say so" to "the system proves
// it continuously." Feeds into Control Assurance as one input; also rolled up
// on its own as a card-level metric so evidence quality is visible directly.
export const EVIDENCE_TYPES = [
  "Self-attestation",
  "Document",
  "Screenshot",
  "Auditor examination",
  "API configuration observation",
  "Automated technical test",
  "Continuous telemetry",
];
export const EVIDENCE_CONFIDENCE = {
  "Self-attestation": 40,
  Document: 55,
  Screenshot: 60,
  "Auditor examination": 75,
  "API configuration observation": 90,
  "Automated technical test": 95,
  "Continuous telemetry": 100,
};

// ---- Asset criticality (NIST/FIPS-199-style) ---------------------------------
// Five weighted factors, each scored 0-100. The overall score is a blend of
// the highest single factor (a catastrophic regulatory or confidentiality
// exposure shouldn't get diluted away by four unrelated low scores — the
// FIPS-199 "high water mark" idea) and a weighted average across all five (so
// one spike alone can't fully mask the rest of the profile either).
export const CRITICALITY_FACTORS = ["confidentiality", "integrity", "availability", "regulatory", "businessDependency"];
const CRITICALITY_WEIGHTS = { confidentiality: 0.25, integrity: 0.2, availability: 0.15, regulatory: 0.25, businessDependency: 0.15 };
const HIGH_WATER_MARK_WEIGHT = 0.6;

export function criticalityScore(factors) {
  const values = CRITICALITY_FACTORS.map((f) => factors[f]);
  const max = Math.max(...values);
  const weightedAvg = CRITICALITY_FACTORS.reduce((sum, f) => sum + factors[f] * CRITICALITY_WEIGHTS[f], 0);
  return Math.round(HIGH_WATER_MARK_WEIGHT * max + (1 - HIGH_WATER_MARK_WEIGHT) * weightedAvg);
}

export function criticalityBand(score) {
  if (score >= 90) return { label: "Critical", color: "red" };
  if (score >= 75) return { label: "High", color: "amber" };
  if (score >= 50) return { label: "Moderate", color: "amber" };
  return { label: "Low", color: "green" };
}

// ---- Assurance categories -----------------------------------------------------
// The 6 rollup buckets every SCF domain resolves into for reporting — coarse
// enough to fit on a card, granular enough to show where an asset is actually
// weak. Domain -> category is a judgment call (same caveat as
// DOMAIN_IMPLEMENTATION_TYPE in systemRegister.js), not a fact from the SCF
// source data.
export const ASSURANCE_CATEGORIES = ["Data Protection", "Configuration", "Detection", "Identity & Access", "Governance", "Resilience"];

export const DOMAIN_ASSURANCE_CATEGORY = {
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

export function categoryForDomain(domain) {
  return DOMAIN_ASSURANCE_CATEGORY[domain] || "Governance";
}

// ---- Control assurance ---------------------------------------------------------
// One category's assurance blends maturity (is it built to last), evidence
// confidence (can we prove it), and effectiveness (is it actually working) —
// maturity weighted highest since a control that isn't Managed can't sustain
// the other two over time.
const CATEGORY_WEIGHTS = { maturity: 0.4, evidence: 0.3, effectiveness: 0.3 };

export function categoryAssuranceScore({ maturityStage, evidenceType, effectivenessPct }) {
  const maturityScore = MATURITY_SCORE[maturityStage];
  const evidenceScore = EVIDENCE_CONFIDENCE[evidenceType];
  return Math.round(CATEGORY_WEIGHTS.maturity * maturityScore + CATEGORY_WEIGHTS.evidence * evidenceScore + CATEGORY_WEIGHTS.effectiveness * effectivenessPct);
}

// Equal-weighted across categories — no category is inherently more important
// to the platform than another; asset-specific weighting can live in the
// Control Profile requirements instead of here.
export function overallControlAssurance(categoryScores) {
  const values = Object.values(categoryScores);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// The Evidence Confidence card metric is a decomposition of the same evidence
// inputs categoryAssuranceScore already consumes, not an independently scored
// number — surfaced separately because "can we prove it" deserves its own line.
export function evidenceConfidenceScore(categories) {
  const scores = Object.values(categories).map((c) => EVIDENCE_CONFIDENCE[c.evidenceType]);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// Named so any page citing "the target" (an Executive Dashboard KPI card, an
// "assets below target" count) points at the same real threshold — the score
// an asset needs to clear the Strong band below, not a separately-chosen
// round number.
export const ASSURANCE_TARGET = 90;
export const ADEQUATE_THRESHOLD = 75;

export function assuranceBand(score) {
  if (score >= ASSURANCE_TARGET) return { label: "Strong", color: "green" };
  if (score >= ADEQUATE_THRESHOLD) return { label: "Adequate", color: "amber" };
  if (score >= 60) return { label: "Developing", color: "amber" };
  return { label: "Weak", color: "red" };
}

// ---- Residual risk (likelihood x impact, impact held constant) ----------------
// Impact is intrinsic to the asset (what happens if it's compromised) and
// doesn't move just because controls improved — only likelihood does. Impact
// is derived from criticality rather than hand-typed, so it can't drift out
// of sync with the asset's own criticality score.
export function impactFromCriticality(score) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

// Linear interpolation from the inherent (pre-control) likelihood at 0%
// control assurance down to a floor of 1 at 100% assurance — controls can
// suppress likelihood close to zero but never fully eliminate it.
export function residualLikelihood(inherentLikelihood, controlAssurancePct) {
  const reduced = inherentLikelihood - (controlAssurancePct / 100) * (inherentLikelihood - 1);
  return Math.round(reduced * 10) / 10;
}

export function riskScore(likelihood, impact) {
  return Math.round(likelihood * impact * 10) / 10;
}

export function riskBand(score) {
  if (score >= 15) return { label: "Critical", color: "red" };
  if (score >= 10) return { label: "High", color: "red" };
  if (score >= 5) return { label: "Moderate", color: "amber" };
  if (score >= 2) return { label: "Low", color: "green" };
  return { label: "Minimal", color: "green" };
}
