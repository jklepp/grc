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
import { overrideFor, notImplementedFor, ownerFor } from "../graph/edges/controlImplementations";
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
  return {
    ...record,
    ageDays: ageInDays(record.collectedAt),
    stale: ageInDays(record.collectedAt) > record.validForDays,
    freshness: Math.round(freshness * 100) / 100,
    confidence: Math.round(base * (record.coveragePct / 100) * freshness),
  };
}

// Worst result wins. If one collection says a control failed, the control
// failed — a second passing collection means the failure is narrower, not that
// it didn't happen.
const RESULT_RANK = { fail: 0, partial: 1, pass: 2 };

function aggregateResult(records) {
  if (records.length === 0) return null;
  return records.reduce((worst, r) => (RESULT_RANK[r.result] < RESULT_RANK[worst] ? r.result : worst), "pass");
}

// How much a result moves effectiveness away from the assessed baseline. A
// failing test doesn't zero the control — compensating pieces usually remain —
// but it should cost most of its credit.
const RESULT_EFFECTIVENESS_FACTOR = { pass: 1, partial: 0.75, fail: 0.35 };

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
  const declaredMissing = isProgram ? null : notImplementedFor(assetId, controlId);
  const records = evidenceFor(assetId, controlId).map(scoreEvidence);

  const common = {
    assetId,
    controlId,
    control,
    systemId,
    category: control.category,
    scope: control.scope,
    owner: ownerFor(systemId, control.category),
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
  const result = aggregateResult(records);

  // Strongest single collection, not an average: this is the evidence you would
  // actually put in front of an auditor. Averaging in a weaker corroborating
  // document would make a well-evidenced control look worse for having more
  // evidence.
  const evidenceConfidence = records.length > 0 ? Math.max(...records.map((r) => r.confidence)) : null;

  const effectivenessPct =
    result === null
      ? baseline.effectivenessPct
      : Math.round(baseline.effectivenessPct * RESULT_EFFECTIVENESS_FACTOR[result]);

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
    effectivenessPct,
    evidenceConfidence: confidenceForScore,
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
