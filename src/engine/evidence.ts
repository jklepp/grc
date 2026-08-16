// What one collection actually proves, and how several combine.
//
// Extracted verbatim from engine/implementation.ts. Nothing here changed in the
// move — the golden master is byte-identical across it, which is the only
// evidence worth having that an extraction was clean.
//
// It comes out because the question it answers stopped being specific to one
// caller. "How much does this record prove, given its grade, its coverage, its
// age, and what it found?" is asked by the per-asset implementation, by the
// per-system PRISMA assessment that replaces it, and by the Measured level in
// between. Leaving it inside the module that used to be its only consumer would
// have meant the new one importing from a file it is replacing.
//
// Freshness is measured against ctx.now rather than a module-level clock read
// at import time. See engine/context.ts for why that mattered.
import type { Graph } from "../graph/types";
import type { EvidenceType } from "../graph/nodes/taxonomy";
import type { Evidence } from "../graph/nodes/evidence";
import { POLICY_REVIEW_INTERVAL_DAYS, type PolicyRecord } from "../graph/nodes/programArtifacts";
import type { EngineContext } from "./context";
import { evidenceBaseConfidence } from "./assurance";
import type { AssetId, ControlId } from "../graph/ids";

export const DAY_MS = 86400000;

// The grade at which ACME can be said to have VERIFIED something itself, rather
// than to have been told it. Below this line sits everything that rests on
// somebody's account of the control — a screenshot, a document, an auditor's
// examination; at or above it the system was interrogated directly.
//
// SOP-01's final step is where this rule is actually written down: "A Vanta
// automated test confirms encryption is actually active — at rest and in
// transit — before the asset's Data Protection category is marked Managed. A
// control that's configured but unverified doesn't count."
export const VERIFYING_EVIDENCE_FLOOR: EvidenceType = "API configuration observation";

// Full strength inside the validity window, then decaying to a floor. The floor
// is not zero because an expired collection is weaker proof, not no proof — a
// SOC 2 report from fourteen months ago still says something.
export const STALE_FLOOR = 0.35;

export interface ScoredEvidence extends Evidence {
  ageDays: number;
  stale: boolean;
  freshness: number;
  quality: number;
  coverage: number;
  exceptionRate: number | null;
  confidence: number;
}

export interface ComposedEvidenceConfidence {
  confidence: number;
  allocation: { id: string; source: string; quality: number; claimed: number }[];
  uncovered: number;
}

// Worst result wins. If one collection says a control failed, the control
// failed — a second passing collection means the failure is narrower, not that
// it didn't happen.
const RESULT_RANK: Record<string, number> = { fail: 0, partial: 1, pass: 2 };

// The record that establishes the worst verified condition, and therefore the
// one whose prevalence governs. Ties break toward the higher exception rate, so
// two failing tests resolve to the more systemic of the two. Keeping a single
// governing record means a deficient implementation can always name the
// collection that made it deficient.
export function governingRecord(records: ScoredEvidence[]): ScoredEvidence | null {
  if (records.length === 0) return null;
  return records.reduce((worst, r) => {
    if (RESULT_RANK[r.result] !== RESULT_RANK[worst.result]) {
      return RESULT_RANK[r.result] < RESULT_RANK[worst.result] ? r : worst;
    }
    return (r.exceptionRate ?? 0) > (worst.exceptionRate ?? 0) ? r : worst;
  });
}

// FAILURE PREVALENCE
// -------------------
// A verified failure is a finding regardless of how many members of the
// population it touched — the status stays deficient, the control still counts
// as failing, and it still drags the risks it holds down. But "1 of 10,000
// identities has excessive access" and "9,000 of 10,000 do" are not the same
// control-effectiveness condition, and a fixed factor per result label reported
// them identically.
//
// So prevalence scales the MAGNITUDE of the hit, never whether there was one.
// Two properties matter:
//
//   The ceiling is below 1. An isolated exception still costs something,
//   because a control with a verified breach is not operating perfectly.
//   The curve is sqrt, not linear, so early exceptions bite. A 5% exception
//   rate is a real problem and linear interpolation would wave it through at
//   ~92% of baseline; sqrt puts it at ~79%.
const PREVALENCE_CEILING = 0.95;
const PREVALENCE_FLOOR = 0.25;

// Used when a collection reports a result but no counts. Unchanged from the
// previous fixed factors, so a record that says nothing about prevalence is
// scored exactly as it was before.
const RESULT_EFFECTIVENESS_FACTOR: Record<string, number> = { pass: 1, partial: 0.75, fail: 0.35 };

export function effectivenessFactor(result: string | null, exceptionRate: number | null): number {
  if (result === "pass") return 1;
  if (result === null) return 1;
  if (exceptionRate == null) return RESULT_EFFECTIVENESS_FACTOR[result];
  const clamped = Math.min(1, Math.max(0, exceptionRate));
  return PREVALENCE_CEILING - (PREVALENCE_CEILING - PREVALENCE_FLOOR) * Math.sqrt(clamped);
}

// EVIDENCE CONFIDENCE ACROSS SEVERAL COLLECTIONS
// -----------------------------------------------
// The naive options are both wrong. Averaging means adding a weak corroborating
// document makes a strong technical test look worse, so a control is punished
// for having more evidence. Taking the maximum means a 20%-coverage automated
// test and a 100% API observation report only the better of the two, throwing
// away the fact that between them they cover the whole population — and that a
// fifth of it is evidenced at a higher grade than the max alone admits.
//
// So coverage is allocated rather than compared. Records are sorted by quality,
// the best claims its share of the population first, and each subsequent record
// claims only what is left unclaimed. Confidence is the coverage-weighted mean
// of the qualities that ended up claiming each portion, with any unevidenced
// remainder contributing zero.
//
//   A: automated test, quality 95, coverage 20%   -> claims 20% at 95
//   B: API observation, quality 90, coverage 100% -> claims the other 80% at 90
//   confidence = 0.2*95 + 0.8*90 = 91
//
// which is higher than either max (90) or mean, and correctly so.
//
// THE ASSUMPTION, STATED: we don't model WHICH members of a population each
// collection looked at, so this assumes two records covering 20% and 100% touch
// different portions wherever they can. That is the optimistic reading; the
// pessimistic one is that the 20% is a subset of the 100%, which is exactly
// max(). Making this exact needs evidence scoped to identified population
// segments — a data-model change, not a formula change.
export function composeEvidenceConfidence(records: ScoredEvidence[]): ComposedEvidenceConfidence | null {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) => b.quality - a.quality);
  let remaining = 1;
  let accumulated = 0;
  const allocation: ComposedEvidenceConfidence["allocation"] = [];
  sorted.forEach((r) => {
    const claimed = Math.min(r.coverage, remaining);
    if (claimed > 0) {
      accumulated += claimed * r.quality;
      allocation.push({ id: r.id, source: r.source, quality: r.quality, claimed: Math.round(claimed * 1000) / 1000 });
      remaining -= claimed;
    }
  });
  return { confidence: accumulated, allocation, uncovered: Math.round(remaining * 1000) / 1000 };
}

export function createEvidence(graph: Graph, ctx: EngineContext) {
  function ageInDays(collectedAt: string): number {
    return Math.max(0, Math.floor((ctx.now.getTime() - new Date(collectedAt).getTime()) / DAY_MS));
  }

  function freshnessFactor(record: Evidence): number {
    const age = ageInDays(record.collectedAt);
    if (age <= record.validForDays) return 1;
    const overdue = age - record.validForDays;
    return Math.max(STALE_FLOOR, 1 - overdue / (record.validForDays * 2));
  }

  function scoreEvidence(record: Evidence): ScoredEvidence {
    const freshness = freshnessFactor(record);
    const base = evidenceBaseConfidence(record.evidenceType);
    const hasPrevalence =
      Number.isFinite(record.population) && Number.isFinite(record.exceptions) && (record.population as number) > 0;
    return {
      ...record,
      ageDays: ageInDays(record.collectedAt),
      stale: ageInDays(record.collectedAt) > record.validForDays,
      freshness: Math.round(freshness * 100) / 100,
      // How good this collection is as proof, independent of how much of the
      // population it looked at. Coverage is deliberately NOT folded in here:
      // composeEvidenceConfidence() allocates coverage across records, so folding
      // it in twice would penalize a narrow high-grade test for being narrow and
      // then again for not covering the rest.
      quality: Math.round(base * freshness),
      coverage: record.coveragePct / 100,
      // What share of the population this collection actually found in breach.
      // Null when the record doesn't count — see effectivenessFactor().
      exceptionRate: hasPrevalence ? (record.exceptions as number) / (record.population as number) : null,
      // Retained for anything that wants a single per-record figure.
      confidence: Math.round(base * (record.coveragePct / 100) * freshness),
    };
  }

  function evidenceFor(assetId: AssetId | null | undefined, controlId: ControlId): Evidence[] {
    return [...(graph.evidenceByPair[`${assetId ?? "program"}::${controlId}`] ?? [])];
  }

  // The same question freshnessFactor asks of a collection, asked of a document.
  // It lives here rather than beside the policy types because "is this current
  // as of now" needs ctx, and ctx belongs to the engine.
  function policyOverdue(policy: PolicyRecord): boolean {
    const age = Math.floor((ctx.now.getTime() - new Date(policy.lastReviewed).getTime()) / DAY_MS);
    return age > POLICY_REVIEW_INTERVAL_DAYS;
  }

  return { ageInDays, freshnessFactor, scoreEvidence, evidenceFor, policyOverdue };
}

export type EvidenceApi = ReturnType<typeof createEvidence>;
