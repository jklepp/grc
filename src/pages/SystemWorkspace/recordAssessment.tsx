import { useState } from "react";
import { Check, Scale } from "lucide-react";
import { C } from "../../theme";
import { addPrismaOverride, COMPLIANCE_LABELS, COMPLIANCE_RATINGS, commitRuntimeFacts, EVIDENCE_TYPES, evaluateControl } from "../../engine";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { buildLiveEngine } from "../../engine/liveGraph";
import { YAML_FACTS } from "../../graph/sources/yaml";
import type { ControlEvidenceDraft } from "../../engine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { AssetId, ControlId, SystemId } from "../../graph/ids";
import type { ComplianceRating, EvidenceType } from "../../graph/nodes/taxonomy";
import type { ControlMatrixRow } from "./types";
import {
  Button, Callout, CheckRow, ChoiceChip, Field, FieldGrid, InlineHint, SaveErrorCallout, Select, StatusPill,
  TextInput, TX, Well, WZ,
} from "../../components/wizard/WizardUI";
import { selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";

export interface RecordAssessmentInput {
  // The attested target on PRISMA's real 0/25/50/75/100 scale — not a
  // 3-way shortcut. 0 is Not Implemented and takes the reason+asset branch
  // below; anything else is a claim that gets backed by evidence and then
  // reconciled against what that evidence actually derives to (see
  // RecordAssessmentSection, which owns the attest-vs-derived comparison).
  rating: ComplianceRating;
  source: string;
  evidenceType: EvidenceType;
  assetId: AssetId | "";
  reason: string;
}

// What each point on the scale concretely claims, shown live as the assessor
// picks — the rubric that used to live only in a fine-print paragraph. 0 has
// no evidence branch (it records a gap, not a claim), so its line explains
// the asset+reason it asks for instead.
const RATING_GUIDANCE: Record<ComplianceRating, string> = {
  0: "Nothing implements this control on this boundary. Records a remediation-ready gap against an asset, with the reason, instead of evidence.",
  25: "Exists somewhere, but ad hoc — not consistently applied across the assets that require it.",
  50: "Implemented on part of the boundary, or with material exceptions. A document or self-attestation alone tops out here.",
  75: "Operating on all in-scope assets with minor exceptions. Expects testing evidence — a screenshot or stronger, not just inquiry.",
  100: "Operating everywhere with no known exceptions, backed by current testing evidence covering every required asset.",
};

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
// gets saved here is provisional — RecordAssessmentSection re-derives the
// actual rating from the evidence and reconciles it against what was
// attested before anything commits for real. Rendered only through that
// section, in both the key-control walk and the standalone panel (showContinue
// false there — one control, so there's nothing to advance to), so the two
// never drift into two different-feeling ways of recording the same fact.
// The source text a "no evidence yet" attestation gets, so it reads as an
// obvious placeholder in Evidence by lane rather than a real collection —
// and so it's unmistakable which record to open and replace once evidence
// exists.
const EVIDENCE_PENDING_SOURCE = "Evidence pending — attested only";

export function RecordAssessmentForm({ assetOptions, isProgramScoped, onSubmit, canContinue, continueLabel, showContinue = true, disabled = false }: RecordAssessmentFormProps) {
  const [rating, setRating] = useState<ComplianceRating | null>(null);
  const [evidencePending, setEvidencePending] = useState(false);
  const [source, setSource] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("Auditor examination");
  const [assetId, setAssetId] = useState<AssetId | "">(assetOptions[0]?.assetId ?? "");
  const [reason, setReason] = useState("");
  const attested = rating !== null;
  const missingImplementation = rating === 0;
  const canDeclareMissing = !isProgramScoped && assetOptions.length > 0;
  const hasRequiredAsset = isProgramScoped || assetOptions.length > 0;
  const ready = !attested
    ? false
    : missingImplementation
      ? Boolean(reason.trim() && assetId)
      : Boolean(hasRequiredAsset && (evidencePending || source.trim()));

  function submit(continueWalk: boolean) {
    if (!ready || disabled || rating === null) return;
    // Evidence-pending attestations still have to be a real, scoreable
    // record — see engine/evaluateControl's "empty claim" rule — so this
    // reuses the taxonomy's own weakest evidence type (Self-attestation)
    // rather than inventing a "no evidence" state the engine doesn't know.
    // That means it derives honestly (Self-attestation caps well under full
    // credit) and runs through the same reconcile-or-override flow as any
    // other attestation the moment it's saved.
    const pending = !missingImplementation && evidencePending;
    onSubmit({
      rating,
      source: pending ? EVIDENCE_PENDING_SOURCE : source.trim(),
      evidenceType: pending ? "Self-attestation" : evidenceType,
      assetId, reason: reason.trim(),
    }, continueWalk);
  }

  return (
    <Well className="flex flex-col gap-3.5">
      {/* This form only ever attests the Implemented lane — the one lane
          nothing else in the graph can derive on its own, because it asks a
          question only a human can answer: is the control actually running
          on the assets that require it. Policy/Procedure read the policy and
          SOP libraries; Measured/Managed read evidence prevalence and the
          activity calendar. Labeling the lane here is what used to be
          missing — the picker looked like a generic 0-100 score with no
          stated target. */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className={`${TX.code} w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0`}
          style={{ background: C.accent, color: WZ.onAccent, border: `1.5px solid ${C.accent}` }}
        >
          3
        </span>
        <span className={TX.itemTitle} style={{ color: C.ink }}>Implemented</span>
        <span className="ml-auto"><StatusPill tone="info">Attesting this lane</StatusPill></span>
      </div>
      <p className={TX.help} style={{ color: C.muted }}>
        Is this control actually operating on the assets that require it? Pick where it stands — you&rsquo;ll back the claim with evidence next. The other four lanes — Policy, Procedure, Measured, Managed — derive on their own from the policy library, procedures, evidence metrics, and review cadence; there&rsquo;s nothing to pick for them here.
      </p>
      <div className="flex flex-wrap gap-2">
        {COMPLIANCE_RATINGS.map((value) => {
          if (value === 0 && !canDeclareMissing) return null;
          return (
            <ChoiceChip
              key={value}
              selected={rating === value}
              onClick={() => setRating(value)}
              ariaLabel={`${value} — ${COMPLIANCE_LABELS[value]}`}
            >
              <span className="normal-case">{value} — {COMPLIANCE_LABELS[value]}</span>
            </ChoiceChip>
          );
        })}
      </div>
      {attested && (
        <p className={TX.help} style={{ color: C.muted }}>
          {RATING_GUIDANCE[rating]}
          {rating > 0 && " If the evidence you cite doesn't support this rating, you'll reconcile before it saves."}
        </p>
      )}
      {!attested ? null : missingImplementation ? (
        <FieldGrid cols={2}>
          {!isProgramScoped && (
            <Field label="Asset">
              <Select value={assetId} aria-label="Asset the gap is recorded against" onChange={(e) => setAssetId(e.target.value as AssetId)}>
                {assetOptions.map((a) => <option key={a.assetId} value={a.assetId}>{a.label}</option>)}
              </Select>
            </Field>
          )}
          <Field
            label="Reason"
            span2={isProgramScoped}
            error={reason.trim() ? null : "Required — say why nothing implements this control here."}
          >
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this control is not implemented on this boundary" />
          </Field>
        </FieldGrid>
      ) : (
        <div className="flex flex-col gap-3">
          <CheckRow
            checked={evidencePending}
            onChange={setEvidencePending}
            ariaLabel="I don't have evidence yet — attach it later"
            label={<>I don&rsquo;t have evidence yet — attach it later</>}
          />
          {evidencePending ? (
            <Callout tone="neutral" title="Saved as a self-attestation for now.">
              That is the weakest evidence grade, so the derived rating won&rsquo;t overstate what&rsquo;s actually on file. Find this record under Evidence by lane once it saves and replace it with the real source.
            </Callout>
          ) : (
            <FieldGrid cols={2}>
              <Field label="Source" error={source.trim() ? null : "Required — name where the evidence came from."}>
                <TextInput value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Screenshot of Okta MFA enforcement" />
              </Field>
              <Field label="Evidence type">
                <Select value={evidenceType} aria-label="Evidence type" onChange={(e) => setEvidenceType(selectedValue(EVIDENCE_TYPES, e.target.value, evidenceType))}>
                  {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
            </FieldGrid>
          )}
        </div>
      )}
      {attested && !isProgramScoped && assetOptions.length === 0 && (
        <InlineHint tone="warning">No asset in this boundary requires this control, so it cannot be recorded here.</InlineHint>
      )}
      <div className="flex items-center justify-end gap-2.5">
        <Button
          variant={showContinue ? "secondary" : "primary"}
          icon={showContinue ? undefined : Check}
          disabled={!ready || disabled}
          onClick={() => submit(false)}
        >
          {showContinue ? "Save" : continueLabel}
        </Button>
        {showContinue && (
          <Button
            variant="primary"
            icon={Check}
            disabled={!ready || !canContinue || disabled}
            onClick={() => submit(true)}
          >
            {continueLabel}
          </Button>
        )}
      </div>
    </Well>
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// The candidate evidence already stands (recordKeyControlAssessment already
// ran) — this only holds what's needed to show the attested-vs-derived
// comparison and, if the operator insists on the attested number, write the
// PRISMA override that keeps the disagreement auditable instead of silent.
interface Reconciliation {
  runtime: RuntimeFacts;
  attested: ComplianceRating;
  derived: ComplianceRating;
  rationale: string;
  continueWalk: boolean;
}

interface RecordAssessmentSectionProps {
  systemId: SystemId;
  controlId: ControlId;
  isProgramScoped: boolean;
  assetOptions: AssetOption[];
  // Folded into the saved fact as the assessor of record, and used to
  // pre-fill the override form when a reconciliation is needed.
  reviewer: string;
  showContinue: boolean;
  continueLabel: string;
  disabled?: boolean;
  onSaved?: (rating: ComplianceRating, continueWalk: boolean) => void;
}

// The one place a first assessment gets recorded: RecordAssessmentForm, plus
// the attest-vs-derived reconciliation that used to live in the old
// ControlAssessmentModal. Submitting attests a rating and cites evidence;
// before anything commits, the engine re-derives Implemented from that
// evidence on a preview build, and a mismatch stops here — accept the derived
// rating, or keep the attested one behind a named, reasoned PRISMA override.
export function RecordAssessmentSection({
  systemId, controlId, isProgramScoped, assetOptions, reviewer, showContinue, continueLabel, disabled = false, onSaved,
}: RecordAssessmentSectionProps) {
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [reconciling, setReconciling] = useState<Reconciliation | null>(null);
  const [overrideAssessor, setOverrideAssessor] = useState("");
  const [overrideNote, setOverrideNote] = useState("");

  // Commits whatever runtime is handed to it (evidence alone, or evidence
  // plus an override) — the one place that actually calls commitRuntimeFacts
  // for a decision, whether that decision came straight through or by way of
  // the reconciliation prompt below.
  function finalizeCommit(runtime: RuntimeFacts, rating: ComplianceRating, continueWalk: boolean) {
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setSaveError(problems);
      return;
    }
    setReconciling(null);
    setOverrideNote("");
    onSaved?.(rating, continueWalk);
  }

  function handleSubmit(input: RecordAssessmentInput, continueWalk: boolean) {
    setSaveError(null);
    let runtime: RuntimeFacts;
    try {
      runtime = recordKeyControlAssessment(loadRuntimeFacts(), {
        systemId, controlId, isProgramScoped,
        recordAssetOptions: assetOptions,
        input, reviewer,
      });
    } catch (e) {
      setSaveError([e instanceof Error ? e.message : String(e)]);
      return;
    }

    // Not Implemented has no "derived" evidence quality to reconcile against —
    // it's a reason, not a claim evidence can under- or over-support.
    if (input.rating > 0) {
      const preview = buildLiveEngine(YAML_FACTS, runtime);
      const implementedLevel = preview.engine?.assessment.assessmentFor(systemId, controlId)?.levels.Implemented;
      if (implementedLevel && implementedLevel.derived !== input.rating) {
        setOverrideAssessor(reviewer);
        setReconciling({
          runtime, attested: input.rating, derived: implementedLevel.derived,
          rationale: implementedLevel.rationale, continueWalk,
        });
        return;
      }
    }

    finalizeCommit(runtime, input.rating, continueWalk);
  }

  function keepAttestedWithOverride() {
    if (!reconciling || !overrideAssessor.trim() || !overrideNote.trim()) return;
    setSaveError(null);
    let overridden: RuntimeFacts;
    try {
      overridden = addPrismaOverride(reconciling.runtime, {
        systemId, controlId, level: "Implemented",
        rating: reconciling.attested,
        note: overrideNote.trim(),
        assessedBy: overrideAssessor.trim(),
        assessedAt: today(),
      });
    } catch (e) {
      setSaveError([e instanceof Error ? e.message : String(e)]);
      return;
    }
    finalizeCommit(overridden, reconciling.attested, reconciling.continueWalk);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {saveError && <SaveErrorCallout problems={saveError} />}
      {reconciling ? (
        <div className="flex flex-col gap-3.5">
          <Callout
            tone="warning"
            icon={Scale}
            title={`You attested ${reconciling.attested} — ${COMPLIANCE_LABELS[reconciling.attested]}.`}
          >
            This evidence supports <b>{reconciling.derived} — {COMPLIANCE_LABELS[reconciling.derived]}</b>: {reconciling.rationale}
          </Callout>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => finalizeCommit(reconciling.runtime, reconciling.derived, reconciling.continueWalk)}
            >
              Use {reconciling.derived} instead
            </Button>
          </div>

          <Well className="flex flex-col gap-3.5">
            <div>
              <div className={TX.itemTitle} style={{ color: C.ink }}>Keep {reconciling.attested} anyway</div>
              <p className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>
                Your professional judgment overrides the derived rating — the disagreement stays visible, not silently resolved. Requires your name and why.
              </p>
            </div>
            <FieldGrid cols={2}>
              <Field label="Assessor" error={overrideAssessor.trim() ? null : "Required to record an override."}>
                <TextInput value={overrideAssessor} onChange={(e) => setOverrideAssessor(e.target.value)} placeholder="Your name" />
              </Field>
              <Field label="Why" error={overrideNote.trim() ? null : "Required to record an override."}>
                <TextInput value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder={`Why ${reconciling.attested} is right despite this evidence`} />
              </Field>
            </FieldGrid>
            <div className="flex justify-end">
              <Button
                variant="primary"
                icon={Check}
                disabled={!overrideAssessor.trim() || !overrideNote.trim()}
                onClick={keepAttestedWithOverride}
              >
                Keep {reconciling.attested} — {COMPLIANCE_LABELS[reconciling.attested]}
              </Button>
            </div>
          </Well>
        </div>
      ) : (
        <RecordAssessmentForm
          assetOptions={assetOptions}
          isProgramScoped={isProgramScoped}
          canContinue
          showContinue={showContinue}
          disabled={disabled}
          continueLabel={continueLabel}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
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
