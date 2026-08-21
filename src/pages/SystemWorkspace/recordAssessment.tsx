import React, { useState } from "react";
import { C } from "../../theme";
import { EVIDENCE_TYPES, evaluateControl } from "../../engine";
import type { ControlEvidenceDraft } from "../../engine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { AssetId, ControlId, SystemId } from "../../graph/ids";
import type { EvidenceType } from "../../graph/nodes/taxonomy";
import type { ControlMatrixRow } from "./types";
import { fieldLabel, inputStyle, selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";

export type RecordDecision = "holds" | "partial" | "not-implemented";

export interface RecordAssessmentInput {
  decision: RecordDecision;
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
}

// The lean "record a fact" form: three decision buttons, a source/evidence-type
// pair (or an asset+reason pair for Not Implemented), and a continue/save split.
// Shared by ControlEvaluationPanel's "Record Assessment" step and
// ControlAssessmentModal's per-card walk, so the two never drift into two
// different-feeling ways of recording the same fact.
export function RecordAssessmentForm({ assetOptions, isProgramScoped, onSubmit, canContinue, continueLabel }: RecordAssessmentFormProps) {
  const [decision, setDecision] = useState<RecordDecision>("holds");
  const [source, setSource] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("Auditor examination");
  const [assetId, setAssetId] = useState<AssetId | "">(assetOptions[0]?.assetId ?? "");
  const [reason, setReason] = useState("");
  const missingImplementation = decision === "not-implemented";
  const ready = missingImplementation
    ? Boolean(reason.trim() && assetId)
    : Boolean(source.trim() && (isProgramScoped || assetOptions.length > 0));

  function submit(continueWalk: boolean) {
    if (!ready) return;
    onSubmit({ decision, source: source.trim(), evidenceType, assetId, reason: reason.trim() }, continueWalk);
  }

  return (
    <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="text-[11px] leading-snug mb-3" style={{ color: C.muted }}>
        Recording a fact puts this control in the engagement scope. Scores are derived from that fact — not typed here.
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {([
          ["holds", "Holds"],
          ["partial", "Partial"],
          ...((!isProgramScoped && assetOptions.length > 0) ? [["not-implemented", "Not implemented"] as const] : []),
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDecision(value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{
              background: decision === value ? C.accent : C.panel,
              color: decision === value ? "#fff" : C.ink,
              border: `1px solid ${decision === value ? C.accent : C.border}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {missingImplementation ? (
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
            <input style={inputStyle()} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Assessor review — J. Ortiz" />
          </div>
          <div>{fieldLabel("Evidence type")}
            <select style={inputStyle()} value={evidenceType} onChange={(e) => setEvidenceType(selectedValue(EVIDENCE_TYPES, e.target.value, evidenceType))}>
              {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}
      {!missingImplementation && (
        <div className="text-[10.5px] mt-2 leading-snug" style={{ color: C.muted }}>
          Holds earns full credit toward Implemented regardless of evidence type — that's your call as assessor. Evidence type instead drives Measured: an automated, self-rerunning test scores higher there than a one-off examination. Override a PRISMA lane after saving if the derived rating is wrong.
        </div>
      )}
      {!isProgramScoped && assetOptions.length === 0 && (
        <div className="text-[10.5px] mt-2 leading-snug" style={{ color: C.amber }}>
          No asset in this boundary requires this control, so it cannot be recorded here.
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: ready && canContinue ? C.accent : C.border, color: "#fff" }}
          disabled={!ready || !canContinue}
          onClick={() => submit(true)}
        >
          {continueLabel}
        </button>
        <button
          type="button"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: ready ? C.accentBg : C.panel, color: ready ? C.accent : C.muted, border: `1px solid ${C.border}` }}
          disabled={!ready}
          onClick={() => submit(false)}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// Turns a RecordAssessmentForm decision into the fact that actually gets
// saved — a control-evidence entry, or a not-implemented finding-worthy gap.
// Pulled out of ControlEvaluationPanel's handler so ControlAssessmentModal's
// walk can save the exact same way instead of re-deriving this mapping.
export function recordKeyControlAssessment(
  existing: RuntimeFacts,
  params: {
    systemId: SystemId;
    controlId: ControlId;
    isProgramScoped: boolean;
    recordAssetOptions: AssetOption[];
    input: RecordAssessmentInput;
  },
): RuntimeFacts {
  const { systemId, controlId, isProgramScoped, recordAssetOptions, input } = params;
  const fallbackAssetId = input.assetId || recordAssetOptions[0]?.assetId;

  if (input.decision === "not-implemented") {
    if (!fallbackAssetId) throw new Error("Not implemented requires an asset in this boundary");
    return evaluateControl(existing, {
      systemId,
      controlId,
      notImplemented: { assetId: fallbackAssetId, reason: input.reason },
    });
  }

  const evidence: ControlEvidenceDraft = {
    source: input.source,
    evidenceType: input.evidenceType,
    result: input.decision === "holds" ? "pass" : "partial",
    coveragePct: 100,
    independence: "internal",
    collectorType: "manual",
    assetIds: isProgramScoped ? [] : recordAssetOptions.map((a) => a.assetId),
    note: `Key-control walk: ${input.decision}.`,
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
