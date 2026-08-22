import { COMPLIANCE_LABELS, evaluateControl } from "../../engine";
import type { ControlEvidenceDraft } from "../../engine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { AssetId, ControlId, SystemId } from "../../graph/ids";
import type { ComplianceRating, EvidenceType } from "../../graph/nodes/taxonomy";
import type { ControlMatrixRow } from "./types";
import type { LaneGraderState } from "./PrismaLaneGrader";
import type { AssetOption } from "./formHelpers";

// The Implemented lane's claim, reduced to the fact it will be saved as. The
// other four PRISMA lanes never appear here: they derive from the policy and
// SOP libraries, evidence prevalence and the review calendar, so an assessor
// disagreeing with one records a PRISMA override, not a new fact.
export interface RecordAssessmentInput {
  // The attested target on PRISMA's real 0/25/50/75/100 scale — not a 3-way
  // shortcut. 0 is Not Implemented and takes the reason+asset branch below;
  // anything else is a claim backed by evidence.
  rating: ComplianceRating;
  source: string;
  evidenceType: EvidenceType;
  assetId: AssetId | "";
  reason: string;
}

// The source text a "no evidence yet" attestation gets, so it reads as an
// obvious placeholder in Evidence by lane rather than a real collection — and
// so it's unmistakable which record to open and replace once evidence exists.
export const EVIDENCE_PENDING_SOURCE = "Evidence pending — attested only";

// The grader's Implemented column, as the fact it commits to.
//
// An evidence-pending attestation still has to be a real, scoreable record —
// see engine/evaluateControl's "empty claim" rule — so it reuses the taxonomy's
// own weakest evidence type rather than inventing a "no evidence" state the
// engine doesn't know. It therefore derives honestly (Self-attestation caps
// well under full credit) instead of quietly banking the attested number.
export function implementedFactInput(state: LaneGraderState): RecordAssessmentInput | null {
  const rating = state.ratings.Implemented;
  if (rating == null) return null;
  const pending = rating > 0 && state.evidencePending;
  return {
    rating,
    source: pending ? EVIDENCE_PENDING_SOURCE : state.source.trim(),
    evidenceType: pending ? "Self-attestation" : state.evidenceType,
    assetId: state.assetId,
    reason: state.reason.trim(),
  };
}

// The same fact, made safe to DRY-RUN against a half-filled form.
//
// An unassessed control's five lanes are all forced to a fake 0 by
// assessment.ts's out-of-scope early return, so the grid has no honest
// baseline to grade against until the control is in scope. The panel gets one
// by building a throwaway runtime from this input and reading the lanes off it
// — which means it needs a valid input before the operator has finished typing,
// and before they have picked Implemented at all. An unpicked Implemented falls
// back to the weakest possible claim, so the four documentation lanes derive for
// real while the Implemented column still reads "awaiting your call". None of
// this is ever committed — see implementedFactInput for the path that is.
export function previewFactInput(state: LaneGraderState): RecordAssessmentInput {
  const real = implementedFactInput(state);
  const base: RecordAssessmentInput = real ?? {
    // Nothing picked yet: the weakest possible claim, just enough to put the
    // control in scope so the four documentation lanes derive for real.
    rating: 50, evidenceType: "Self-attestation", source: "",
    assetId: state.assetId, reason: "",
  };
  return {
    ...base,
    // Never the operator's own source text. graph/validate rejects one source
    // name carrying two evidence types (sourceConflicts) — a real hazard here,
    // because the source the operator typed, or the shared evidence-pending
    // placeholder, can already exist on file under a different type, and a
    // preview that fails validation silently falls back to the all-zero lanes
    // this whole surface exists to get rid of. The source cannot affect a
    // derivation anyway; only the type, result and coverage can.
    source: `Preview derivation · ${base.evidenceType}`,
    reason: base.reason || "Not implemented on this boundary.",
  };
}

// Turns an Implemented-lane decision into the fact that actually gets saved —
// a control-evidence entry, or a not-implemented finding-worthy gap. Either
// way `evaluateControl` also puts the control in the system's assessment
// scope, which is what makes the other four lanes derive at all.
//
// `reviewer`, when given, is folded into the note/reason text (the only place
// evaluateControl has room for it) so the assessor of record is a real saved
// fact rather than UI chrome that vanishes on refresh. The structured copy
// rides on the PRISMA overrides and control review the same commit writes.
export function recordKeyControlAssessment(
  existing: RuntimeFacts,
  params: {
    systemId: SystemId;
    controlId: ControlId;
    isProgramScoped: boolean;
    recordAssetOptions: AssetOption[];
    input: RecordAssessmentInput;
    reviewer?: string;
  },
): RuntimeFacts {
  const { systemId, controlId, isProgramScoped, recordAssetOptions, input, reviewer } = params;
  const fallbackAssetId = input.assetId || recordAssetOptions[0]?.assetId;
  const reviewerSuffix = reviewer?.trim() ? ` Reviewed by ${reviewer.trim()}.` : "";

  if (input.rating === 0) {
    if (!fallbackAssetId) throw new Error("Not implemented requires an asset in this boundary");
    return evaluateControl(existing, {
      systemId,
      controlId,
      notImplemented: { assetId: fallbackAssetId, reason: input.reason + reviewerSuffix },
    });
  }

  const evidence: ControlEvidenceDraft = {
    source: input.source,
    evidenceType: input.evidenceType,
    result: input.rating >= 75 ? "pass" : "partial",
    coveragePct: 100,
    independence: "internal",
    collectorType: "manual",
    assetIds: isProgramScoped ? [] : recordAssetOptions.map((a) => a.assetId),
    note: `Attested ${input.rating} — ${COMPLIANCE_LABELS[input.rating]}.${reviewerSuffix}`,
  };
  return evaluateControl(existing, {
    systemId,
    controlId,
    evidenceEntries: [evidence],
  });
}

// Applicable key controls with no fact recorded yet — the punch list both the
// Overview "Assess" tile and the Controls tab's "Assess N key controls"
// button walk. A program-scoped key control applies everywhere; anything
// else needs at least one required asset in this boundary.
//
// `pendingScopeIds` excludes controls still waiting on a Scope Review
// decision (an unconfirmed inheritance claim). Without it, a key control
// nobody has confirmed as inherited yet reads as an ordinary "unassessed"
// row and lands in this queue asking to be graded directly — the wrong
// surface for a decision that belongs in Scope Review.
export function keyControlAssessmentQueue(
  matrix: ControlMatrixRow[],
  systemAssets: ReadonlyArray<{ id: string }>,
  isRequired: (assetId: string, controlId: ControlId) => boolean,
  pendingScopeIds?: ReadonlySet<ControlId>,
): ControlMatrixRow[] {
  return matrix.filter((row) => {
    if (!row.keyControl || row.status !== "unassessed") return false;
    if (pendingScopeIds?.has(row.controlId)) return false;
    if (row.keyControl.scope === "program") return true;
    return systemAssets.some((asset) => isRequired(asset.id, row.controlId));
  });
}
