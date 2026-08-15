// Composes one control implementation, and scores it.
//
// An implementation is assembled rather than stored, from four inputs that each
// already exist for their own reasons:
//
//   applicability  is this control required here at all
//   assessment     the asset's category-level baseline (the "assessed" floor)
//   overrides      a recorded maturity that differs from that baseline, with why
//   evidence       what a collection against THIS control on THIS asset showed
//
// Evidence is the only per-pair input, and that is the intended reading: what
// separates a strong implementation of a control from a weak one is what you
// can actually show about it. CLD-06 on the S3 bucket and CLD-06 on the RAG
// service start from similar baselines and end up far apart because one has a
// passing cross-tenant test and the other has a failing one.
//
// EVIDENCE CONFIDENCE
// -------------------
// The old evidenceConfidenceScore() averaged the EVIDENCE_CONFIDENCE value of
// six type strings. That treats a continuous telemetry feed that stopped
// reporting nine months ago as identical to one reading live, and a test
// covering 40% of a fleet as identical to one covering all of it. Here the base
// rate for the type is multiplied by the collection's coverage and by a
// freshness factor that decays past the record's own validity window. A stale
// record still counts for something — it was true once — but not for what it
// was worth on the day it was collected.
import { KEY_CONTROL_BY_ID, PROGRAM_SCOPED_CONTROLS } from "../graph/nodes/keyControls";
import { ASSET_BY_ID } from "../graph/nodes/assets";
import { BASIS, ASSURANCE_CATEGORIES } from "../graph/nodes/taxonomy";
import { evidenceFor } from "../graph/nodes/evidence";
import { assessmentFor, CATEGORY_ASSESSMENTS } from "../graph/edges/categoryAssessments";
import { overrideFor, notImplementedFor, ownerIdsFor, ownerOverrideFor } from "../graph/edges/controlImplementations";
import { ORG_BY_ID } from "../graph/nodes/orgs";
import { resolveApplicability, requiredControlsForAsset } from "./applicability";
import { blendAssurance, evidenceBaseConfidence, mean, display } from "./assurance";

// Today, read once. Freshness is measured against the real clock rather than a
// frozen constant so a demo left running for a month reports evidence going
// stale, which is the honest behaviour.
const NOW = new Date();
const DAY_MS = 86400000;

export function ageInDays(collectedAt) {
  return Math.max(0, Math.floor((NOW - new Date(collectedAt)) / DAY_MS));
}

// Full strength inside the validity window, then decaying to a floor. The floor
// is not zero because an expired collection is weaker proof, not no proof — a
// SOC 2 report from fourteen months ago still says something.
const STALE_FLOOR = 0.35;

export function freshnessFactor(record) {
  const age = ageInDays(record.collectedAt);
  if (age <= record.validForDays) return 1;
  const overdue = age - record.validForDays;
  return Math.max(STALE_FLOOR, 1 - overdue / (record.validForDays * 2));
}

export function scoreEvidence(record) {
  const freshness = freshnessFactor(record);
  const base = evidenceBaseConfidence(record.evidenceType);
  const hasPrevalence = Number.isFinite(record.population) && Number.isFinite(record.exceptions) && record.population > 0;
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
    exceptionRate: hasPrevalence ? record.exceptions / record.population : null,
    // Retained for anything that wants a single per-record figure.
    confidence: Math.round(base * (record.coveragePct / 100) * freshness),
  };
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
export function composeEvidenceConfidence(records) {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) => b.quality - a.quality);
  let remaining = 1;
  let accumulated = 0;
  const allocation = [];
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

// Worst result wins. If one collection says a control failed, the control
// failed — a second passing collection means the failure is narrower, not that
// it didn't happen.
const RESULT_RANK = { fail: 0, partial: 1, pass: 2 };

// The record that establishes the worst verified condition, and therefore the
// one whose prevalence governs. Ties break toward the higher exception rate, so
// two failing tests resolve to the more systemic of the two. Keeping a single
// governing record means a deficient implementation can always name the
// collection that made it deficient.
function governingRecord(records) {
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
const RESULT_EFFECTIVENESS_FACTOR = { pass: 1, partial: 0.75, fail: 0.35 };

export function effectivenessFactor(result, exceptionRate) {
  if (result === "pass") return 1;
  if (result === null) return 1;
  if (exceptionRate == null) return RESULT_EFFECTIVENESS_FACTOR[result];
  const clamped = Math.min(1, Math.max(0, exceptionRate));
  return PREVALENCE_CEILING - (PREVALENCE_CEILING - PREVALENCE_FLOOR) * Math.sqrt(clamped);
}

// The category baseline for program-scoped controls: the portfolio mean of that
// category across every asset. Derived rather than a separate hand-set figure,
// so a program control's floor moves with the estate it governs.
const PROGRAM_BASELINE = {};
ASSURANCE_CATEGORIES.forEach((category) => {
  const rows = CATEGORY_ASSESSMENTS.filter((a) => a.category === category);
  PROGRAM_BASELINE[category] = {
    maturityStage: rows[0]?.maturityStage ?? "Procedure",
    effectivenessPct: mean(rows.map((r) => r.effectivenessPct)) ?? 0,
  };
});

// assetId of null means a program-scoped control.
export function buildImplementation(assetId, controlId) {
  const control = KEY_CONTROL_BY_ID[controlId];
  const isProgram = assetId === null;
  const asset = isProgram ? null : ASSET_BY_ID[assetId];
  const systemId = asset?.systemId ?? "program";

  const applicability = isProgram
    ? { required: true, reasons: [{ rationale: "Governs the program as a whole rather than any one resource.", source: "Program scope" }], exception: null, notRequiredBecause: null }
    : resolveApplicability(assetId, controlId);

  const baseline = isProgram ? PROGRAM_BASELINE[control.category] : assessmentFor(assetId, control.category);
  const override = isProgram ? null : overrideFor(assetId, controlId);
  const ownerOverride = isProgram ? null : ownerOverrideFor(assetId, controlId);
  const declaredMissing = isProgram ? null : notImplementedFor(assetId, controlId);
  const records = evidenceFor(assetId, controlId).map(scoreEvidence);

  const ownerIds = ownerOverride?.ownerIds ?? ownerIdsFor(systemId, control.category);
  const owners = ownerIds.map((id) => ORG_BY_ID[id]);

  const common = {
    assetId,
    controlId,
    control,
    systemId,
    category: control.category,
    scope: control.scope,
    owners,
    ownerNames: owners.map((o) => o.name).join(" / "),
    ownerOverride,
    findingId: override?.findingId ?? null,
    applicability,
    evidence: records,
    baseline,
    override,
  };

  if (!applicability.required) {
    return { ...common, status: "not-applicable", basis: BASIS.UNASSESSED, score: null, rawScore: null, evidenceConfidence: null, effectivenessPct: null, maturityStage: null };
  }

  if (declaredMissing) {
    return {
      ...common,
      status: "not-implemented",
      // Knowing a control is absent IS a measurement — it's the one case where
      // a zero is a finding rather than a blank.
      basis: BASIS.MEASURED,
      score: 0,
      rawScore: 0,
      evidenceConfidence: 0,
      effectivenessPct: 0,
      maturityStage: null,
      note: declaredMissing.reason,
    };
  }

  const maturityStage = override?.maturityStage ?? baseline.maturityStage;

  // The worst verified condition governs, and it stays nameable: `governing` is
  // the specific collection this implementation's status and prevalence come
  // from, so a deficient control can always say which test made it deficient.
  const governing = governingRecord(records);
  const result = governing ? governing.result : null;
  const exceptionRate = governing ? governing.exceptionRate : null;

  const composed = composeEvidenceConfidence(records);
  const evidenceConfidence = composed ? composed.confidence : null;

  const factor = effectivenessFactor(result, exceptionRate);
  const effectivenessPct = result === null ? baseline.effectivenessPct : baseline.effectivenessPct * factor;

  const basis = records.length > 0 ? BASIS.MEASURED : BASIS.ASSESSED;

  // With no evidence, confidence falls back to the assessment's own declared
  // evidence type — the honest reading of "someone said so at this grade."
  const confidenceForScore = evidenceConfidence ?? evidenceBaseConfidence(baseline.evidenceType);

  const raw = blendAssurance({ maturityStage, evidenceConfidence: confidenceForScore, effectivenessPct });

  return {
    ...common,
    status: result === null ? "unevidenced" : result === "pass" ? "effective" : result === "partial" ? "partial" : "deficient",
    basis,
    result,
    maturityStage,
    effectivenessPct: display(effectivenessPct),
    rawEffectivenessPct: effectivenessPct,
    // Where the status and the size of the hit came from, kept together so the
    // drawer and the trace can say "deficient because THIS test found N of M".
    governing,
    exceptionRate,
    exceptionSummary: governing && governing.exceptionRate != null
      ? { exceptions: governing.exceptions, population: governing.population, unit: governing.populationUnit, rate: governing.exceptionRate, source: governing.source }
      : null,
    effectivenessFactor: factor,
    evidenceConfidence: display(confidenceForScore),
    rawEvidenceConfidence: confidenceForScore,
    evidenceAllocation: composed ? composed.allocation : [],
    evidenceUncovered: composed ? composed.uncovered : null,
    // `score` is for display; `rawScore` is what the category rollup consumes,
    // so a control's movement survives the trip upward instead of being rounded
    // away at the first hop.
    score: display(raw),
    rawScore: raw,
    note: override?.note ?? null,
  };
}

export const IMPLEMENTATION_STATUS_META = {
  effective: { label: "Effective", color: "green" },
  partial: { label: "Partial", color: "amber" },
  deficient: { label: "Deficient", color: "red" },
  unevidenced: { label: "Unevidenced", color: "muted" },
  "not-implemented": { label: "Not implemented", color: "red" },
  "not-applicable": { label: "Not applicable", color: "muted" },
};

export function implementationsForAsset(assetId) {
  return requiredControlsForAsset(assetId).map((c) => buildImplementation(assetId, c.id));
}

export function implementationsForAssetInCategory(assetId, category) {
  return implementationsForAsset(assetId).filter((i) => i.category === category);
}

export const PROGRAM_IMPLEMENTATIONS = PROGRAM_SCOPED_CONTROLS.map((c) => buildImplementation(null, c.id));

export function programImplementation(controlId) {
  return PROGRAM_IMPLEMENTATIONS.find((i) => i.controlId === controlId) || null;
}
