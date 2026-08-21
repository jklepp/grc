import React, { useState } from "react";
import { C } from "../../theme";
import { COMPLIANCE_LABELS, COMPLIANCE_RATINGS, EVIDENCE_TYPES, evaluateControl } from "../../engine";
import type { ControlEvidenceDraft } from "../../engine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { AssetId, ControlId, SystemId } from "../../graph/ids";
import type { ComplianceRating, EvidenceType } from "../../graph/nodes/taxonomy";
import type { ControlMatrixRow } from "./types";
import { fieldLabel, inputStyle, selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";

export interface RecordAssessmentInput {
  // The attested target on PRISMA's real 0/25/50/75/100 scale — not a
  // 3-way shortcut. 0 is Not Implemented and takes the reason+asset branch
  // below; anything else is a claim that gets backed by evidence and then
  // reconciled against what that evidence actually derives to (see
  // ControlAssessmentModal, which owns the attest-vs-derived comparison).
  rating: ComplianceRating;
  source: string;
  evidenceType: EvidenceType;
  assetId: AssetId | "";
  reason: string;
}

interface RecordAssessmentFormProps {
  assetOptions: AssetOption[];
  isProgramScoped: boolean;
  onSubmit: (input: RecordAssessmentInput, continueWalk: boolean) => void;
  canContinue: boolean;
  continueLabel: string;
  showContinue?: boolean;
  disabled?: boolean;
}

// Attest, then evidence — in that order. Step 1 is the assessor's judgment
// call on the real PRISMA scale (0/25/50/75/100); nothing else renders until
// they've made it. Step 2 backs that claim: an asset+reason for Not
// Implemented (0), or a source/evidence-type pair for everything else. What
// gets saved here is provisional — ControlAssessmentModal re-derives the
// actual rating from the evidence and reconciles it against what was
// attested before anything commits for real.
// Shared by ControlAssessmentModal's domain-grouped walk and its single-control
// quick-edit mode (showContinue false there — one control, so there's nothing
// to advance to), so the two never drift into two different-feeling ways of
// recording the same fact.
export function RecordAssessmentForm({ assetOptions, isProgramScoped, onSubmit, canContinue, continueLabel, showContinue = true, disabled = false }: RecordAssessmentFormProps) {
  const [rating, setRating] = useState<ComplianceRating | null>(null);
  const [source, setSource] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("Auditor examination");
  const [assetId, setAssetId] = useState<AssetId | "">(assetOptions[0]?.assetId ?? "");
  const [reason, setReason] = useState("");
  const attested = rating !== null;
  const missingImplementation = rating === 0;
  const canDeclareMissing = !isProgramScoped && assetOptions.length > 0;
  const ready = !attested
    ? false
    : missingImplementation
      ? Boolean(reason.trim() && assetId)
      : Boolean(source.trim() && (isProgramScoped || assetOptions.length > 0));

  function submit(continueWalk: boolean) {
    if (!ready || disabled || rating === null) return;
    onSubmit({ rating, source: source.trim(), evidenceType, assetId, reason: reason.trim() }, continueWalk);
  }

  return (
    <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="text-[11px] leading-snug mb-3" style={{ color: C.muted }}>
        Say where this control stands, on PRISMA's own scale. You'll back that claim with evidence next.
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {COMPLIANCE_RATINGS.map((value) => {
          if (value === 0 && !canDeclareMissing) return null;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{
                background: rating === value ? C.accent : C.panel,
                color: rating === value ? "#fff" : C.ink,
                border: `1px solid ${rating === value ? C.accent : C.border}`,
              }}
            >
              {value} — {COMPLIANCE_LABELS[value]}
            </button>
          );
        })}
      </div>
      {!attested ? null : missingImplementation ? (
        <div className="grid grid-cols-2 gap-2">
          {!isProgramScoped && (
            <div>{fieldLabel("Asset")}
              <select style={inputStyle()} value={assetId} onChange={(e) => setAssetId(e.target.value as AssetId)}>
                {assetOptions.map((a) => <option key={a.assetId} value={a.assetId}>{a.label}</option>)}
              </select>
            </div>
          )}
          <div className={isProgramScoped ? "col-span-2" : ""}>{fieldLabel("Reason")}
            <input style={inputStyle()} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this control is not implemented on this boundary" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>{fieldLabel("Source")}
            <input style={inputStyle()} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Screenshot of Okta MFA enforcement" />
          </div>
          <div>{fieldLabel("Evidence type")}
            <select style={inputStyle()} value={evidenceType} onChange={(e) => setEvidenceType(selectedValue(EVIDENCE_TYPES, e.target.value, evidenceType))}>
              {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}
      {attested && !missingImplementation && (
        <div className="text-[10.5px] mt-2 leading-snug" style={{ color: C.muted }}>
          A self-attestation or a document can't single-handedly earn full credit toward Implemented — HITRUST requires testing, not inquiry. A screenshot or stronger, covering every required asset, can. If what you attested doesn't match what this evidence actually supports, you'll get a chance to reconcile before it saves.
        </div>
      )}
      {attested && !isProgramScoped && assetOptions.length === 0 && (
        <div className="text-[10.5px] mt-2 leading-snug" style={{ color: C.amber }}>
          No asset in this boundary requires this control, so it cannot be recorded here.
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        {showContinue && (
          <button
            type="button"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: ready && canContinue && !disabled ? C.accent : C.border, color: "#fff" }}
            disabled={!ready || !canContinue || disabled}
            onClick={() => submit(true)}
          >
            {continueLabel}
          </button>
        )}
        <button
          type="button"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={showContinue
            ? { background: ready && !disabled ? C.accentBg : C.panel, color: ready && !disabled ? C.accent : C.muted, border: `1px solid ${C.border}` }
            : { background: ready && !disabled ? C.accent : C.border, color: "#fff" }}
          disabled={!ready || disabled}
          onClick={() => submit(false)}
        >
          {showContinue ? "Save" : continueLabel}
        </button>
      </div>
    </div>
  );
}

// Turns a RecordAssessmentForm decision into the fact that actually gets
// saved — a control-evidence entry, or a not-implemented finding-worthy gap.
// `reviewer`, when given, is folded into the note/reason text (the only place
// evaluateControl has room for it) so the assessor of record is a real saved
// fact rather than UI chrome that vanishes on refresh.
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
export function keyControlAssessmentQueue(
  matrix: ControlMatrixRow[],
  systemAssets: ReadonlyArray<{ id: string }>,
  isRequired: (assetId: string, controlId: ControlId) => boolean,
): ControlMatrixRow[] {
  return matrix.filter((row) => {
    if (!row.keyControl || row.status !== "unassessed") return false;
    if (row.keyControl.scope === "program") return true;
    return systemAssets.some((asset) => isRequired(asset.id, row.controlId));
  });
}
