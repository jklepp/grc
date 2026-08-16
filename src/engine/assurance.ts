// The scoring layer. Pure functions, no data of its own.
//
// These are the formulas from the previous assuranceModel.js, essentially
// unchanged — they were the right formulas. What changed is what feeds them:
// criticality still comes from an asset's own factors, but control assurance
// now arrives from real implementations and evidence rather than from a
// six-value category block typed onto the asset.
//
// The ordered vocabularies these scales attach to (MATURITY_STAGES,
// EVIDENCE_TYPES) live in graph/nodes/taxonomy.ts. The split is deliberate:
// "Managed" is a fact about how ACME describes a control, "Managed is worth
// 100" is a judgment about how to score it, and the graph should not carry
// judgments.
import {
  EVIDENCE_TYPES, PRISMA_LEVELS,
  type EvidenceType, type PrismaLevel, type ComplianceRating,
} from "../graph/nodes/taxonomy";

// ---- Evidence confidence ------------------------------------------------------
// How much an assertion can be trusted, from "we say so" to "the system proves
// it continuously." This is the base rate for a TYPE of evidence;
// engine/implementation.ts then adjusts it by the coverage and freshness of the
// specific collection, which is the part the old string-enum average could not
// express.
export const EVIDENCE_CONFIDENCE: Record<EvidenceType, number> = {
  "Self-attestation": 40,
  Document: 55,
  Screenshot: 60,
  "Auditor examination": 75,
  "API configuration observation": 90,
  "Automated technical test": 95,
  "Continuous telemetry": 100,
};

export function evidenceBaseConfidence(type: EvidenceType | null | undefined): number {
  return (type && EVIDENCE_CONFIDENCE[type]) ?? 0;
}

export function meetsEvidence(actual: EvidenceType, required: EvidenceType): boolean {
  return EVIDENCE_TYPES.indexOf(actual) >= EVIDENCE_TYPES.indexOf(required);
}

// ---- HITRUST PRISMA ---------------------------------------------------------------
// Five maturity levels, each rated on the five-point compliance scale, combined
// as a weighted sum. The weights are HITRUST's, not ours, and the shape of them
// is the whole argument: a control that is written down and operating is worth
// far more than one that is only written down, so Implemented alone carries 40%
// while the two documentation rungs together carry 35%.
//
// This replaces blendAssurance's maturity/evidence/effectiveness split. The old
// blend asked three questions about a control and averaged the answers. PRISMA
// asks the same question five times at increasing standards of proof and adds
// up the credit, which is both the more defensible reading and the one an
// assessor can argue with a line at a time.
export const PRISMA_LEVEL_WEIGHTS: Record<PrismaLevel, number> = {
  Policy: 0.15,
  Procedure: 0.2,
  Implemented: 0.4,
  Measured: 0.1,
  Managed: 0.15,
};

export function meetsLevel(actual: PrismaLevel, required: PrismaLevel): boolean {
  return PRISMA_LEVELS.indexOf(actual) >= PRISMA_LEVELS.indexOf(required);
}

// Full precision, like everything else here — the weights are exact but a
// rollup of these still must not round on the way up. See the note below.
export function prismaScore(levels: Record<PrismaLevel, ComplianceRating>): number {
  return PRISMA_LEVELS.reduce((sum, level) => sum + PRISMA_LEVEL_WEIGHTS[level] * levels[level], 0);
}

// Snap a continuous ratio (5 of 6 sampled assets passed) onto the fixed scale.
// Nearest scale point, EXCEPT that Fully Compliant requires the ratio to be
// exactly 1. That exception is the same judgment PREVALENCE_CEILING encodes on
// the evidence side: a control with a verified exception is not operating
// perfectly, however small the exception was, and rounding 0.99 up to Fully
// Compliant would erase the one instance somebody needs to go fix.
export function nearestRating(ratio: number): ComplianceRating {
  if (ratio >= 1) return 100;
  return Math.min(75, Math.round(Math.max(0, ratio) * 4) * 25) as ComplianceRating;
}

// Where a grade of proof lands on the compliance scale. Used to derive the
// inherited ceiling below from the evidence scale rather than typing a second
// constant that could drift away from it.
export function complianceForConfidence(confidence: number): ComplianceRating {
  return (Math.round((confidence / 100) * 4) * 25) as ComplianceRating;
}

// The ceiling on any level of a control ACME inherits from its provider.
//
// A vendor's SOC 2 is an "Auditor examination" (75), which sits below the
// "API configuration observation" grade that engine/implementation.ts already
// treats as the floor for calling something verified. A level ACME cannot
// itself verify therefore cannot be rated Fully Compliant — not as a penalty
// for using a vendor, but because the strongest thing ACME can say is what the
// report says. Derived from EVIDENCE_CONFIDENCE so the two move together.
export const INHERITED_LEVEL_CAP = complianceForConfidence(EVIDENCE_CONFIDENCE["Auditor examination"]);

// ---- Asset criticality (FIPS-199-style) ----------------------------------------
// Five weighted factors, each 0-100. The overall score blends the highest single
// factor (a catastrophic regulatory or confidentiality exposure shouldn't be
// diluted by four unrelated low scores — the high-water-mark idea) with a
// weighted average across all five (so one spike alone can't fully mask the rest
// of the profile either).
export const CRITICALITY_FACTORS = ["confidentiality", "integrity", "availability", "regulatory", "businessDependency"] as const;
export type CriticalityFactorName = (typeof CRITICALITY_FACTORS)[number];
const CRITICALITY_WEIGHTS: Record<CriticalityFactorName, number> = { confidentiality: 0.25, integrity: 0.2, availability: 0.15, regulatory: 0.25, businessDependency: 0.15 };
const HIGH_WATER_MARK_WEIGHT = 0.6;

export function criticalityScore(factors: Record<string, number>): number {
  const values = CRITICALITY_FACTORS.map((f) => factors[f]);
  const max = Math.max(...values);
  const weightedAvg = CRITICALITY_FACTORS.reduce((sum, f) => sum + factors[f] * CRITICALITY_WEIGHTS[f], 0);
  return Math.round(HIGH_WATER_MARK_WEIGHT * max + (1 - HIGH_WATER_MARK_WEIGHT) * weightedAvg);
}

export interface Band {
  label: string;
  color: string;
}

export function criticalityBand(score: number): Band {
  if (score >= 90) return { label: "Critical", color: "red" };
  if (score >= 75) return { label: "High", color: "amber" };
  if (score >= 50) return { label: "Moderate", color: "amber" };
  return { label: "Low", color: "green" };
}

// PRECISION, AND WHY THESE DON'T ROUND
// -------------------------------------
// Rounding at every level of a five-deep rollup destroys the signal it's
// supposed to carry. A control moving 16 points inside a category that then
// rounds, feeding an asset score that rounds, feeding a system score that
// rounds, arrives at the enterprise as exactly nothing — and a model where a
// failing control provably changes no number above it is not propagating, it
// only looks like it is when you check the bottom.
//
// So every function here returns full precision and the chain stays continuous.
// Rounding happens once, at the point a number is stored for display, and each
// rollup keeps the unrounded value alongside it for the next level up to
// consume.
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface WeightedEntry {
  value: number;
  weight: number;
}

// Weighted mean, used wherever a rollup would otherwise let a low-stakes member
// cancel out a high-stakes one — an enterprise score that averages the KMS key
// against the audit log feed as equals is not measuring what it claims to.
export function weightedMean(entries: WeightedEntry[]): number | null {
  const totalWeight = entries.reduce((a, e) => a + e.weight, 0);
  if (totalWeight === 0) return null;
  return entries.reduce((a, e) => a + e.value * e.weight, 0) / totalWeight;
}

// Display rounding, applied once at the boundary between the engine and a page.
export function display(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value);
}

// ---- Operating history (HITRUST-style maturity gate) --------------------------
// A control can be perfectly configured and still lack the track record HITRUST
// expects before crediting the top rungs of the maturity ladder: Managed asks
// whether someone has acted on it over time, Measured asks whether its
// operation has been observed long enough to say anything about it. Neither
// question has an answer on day one, however good day one's evidence is. The
// two documentation rungs get a shorter window for the same reason — a policy
// or procedure that only just started applying hasn't been "in effect" yet.
//
// These are HITRUST's own PRISMA windows, not an ACME judgment.
export const OPERATING_HISTORY_THRESHOLD_DAYS: Record<PrismaLevel, number> = {
  Policy: 60,
  Procedure: 60,
  Implemented: 90,
  Measured: 90,
  Managed: 90,
};

// The rating held when the operating-history window hasn't closed yet.
// Verified-but-unproven-over-time is a real, partial claim — the same tier a
// stale or under-covered result already lands at elsewhere in this engine —
// not a failure and not full credit.
export const IMMATURE_LEVEL_CAP: ComplianceRating = 50;

// ---- Bands ------------------------------------------------------------------------
// Named so any page citing "the target" points at the same real threshold — the
// score an asset needs to clear the Strong band, not a separately-chosen round
// number.
export const ASSURANCE_TARGET = 90;
export const ADEQUATE_THRESHOLD = 75;

export function assuranceBand(score: number | null | undefined): Band & { label: string } {
  if (score == null) return { label: "Unassessed", color: "muted" };
  if (score >= ASSURANCE_TARGET) return { label: "Strong", color: "green" };
  if (score >= ADEQUATE_THRESHOLD) return { label: "Adequate", color: "amber" };
  if (score >= 60) return { label: "Developing", color: "amber" };
  return { label: "Weak", color: "red" };
}

// ---- Residual risk (likelihood x impact, impact held constant) ---------------------
// Impact is intrinsic to the asset — what happens if it's compromised — and
// doesn't move because controls improved. Only likelihood does. Impact is
// derived from criticality rather than stored, so the two can't drift apart.
export function impactFromCriticality(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

// Linear interpolation from the inherent (pre-control) likelihood at 0% control
// assurance down to a floor of 1 at 100% — controls can suppress likelihood
// close to zero but never eliminate it.
export function residualLikelihood(inherentLikelihood: number, controlAssurancePct: number | null): number {
  const reduced = inherentLikelihood - ((controlAssurancePct ?? 0) / 100) * (inherentLikelihood - 1);
  return Math.round(reduced * 10) / 10;
}

export function riskScore(likelihood: number, impact: number): number {
  return Math.round(likelihood * impact * 10) / 10;
}

export function riskBand(score: number): Band {
  if (score >= 15) return { label: "Critical", color: "red" };
  if (score >= 10) return { label: "High", color: "red" };
  if (score >= 5) return { label: "Moderate", color: "amber" };
  if (score >= 2) return { label: "Low", color: "green" };
  return { label: "Minimal", color: "green" };
}
