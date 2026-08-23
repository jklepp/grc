// The one form that describes a gap, in the two shapes its two hosts need.
//
// This lived inside ControlEvaluationPanel, where the control was never a
// question — the panel is open ON a control, so the form spoke only about the
// gap. Findings & CAPs needs the same form without that context, so the control
// becomes a field there and stays fixed here.
//
// Three exports, one form:
//   useFindingForm   the state and the draft it builds
//   FindingEditor    fields + inline buttons, for a host that is already a
//                    focused surface (the control panel — a modal inside a
//                    modal would be worse than an inline block)
//   FindingEditorModal  the same fields as their own popup, with the actions in
//                    a wizard footer, for a host that is a page
//
// Neither host's editor WRITES. Both return a draft and let the host stage or
// commit it, so there is still exactly one way facts reach storage.
import React, { useMemo, useState } from "react";
import { Check, ListTodo } from "lucide-react";
import {
  FINDING_SEVERITIES, FINDING_SOURCES, REMEDIATION_STATUSES, ORGS,
} from "../../engine";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, Callout, Field, FieldGrid, InlineHint, Select, TextInput, TX, Well,
  WizardBody, WizardChrome, WizardFooter, WizardHeader, WizardPane,
} from "../../components/wizard/WizardUI";
import { C } from "../../theme";
import { selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";
import type { FindingDraft } from "../../engine";
import type { ControlId } from "../../graph/ids";
import type { FindingSeverity, FindingSource, RemediationStatus } from "../../graph/nodes/findings";

export interface FindingFormState {
  title: string;
  detail: string;
  controlId: string;
  // "" means no asset — a legitimate answer now that a finding is anchored to
  // (system, control). A missing retention schedule is not located on one box.
  assetId: string;
  severity: FindingSeverity;
  source: FindingSource | "";
  ownerId: string;
  remediationStatus: RemediationStatus;
  due: string;
  remediationPlan: string;
  remediationOwnerId: string;
  targetDate: string;
  // Free text, turned into a real Evidence record by the host's mutation.
  // Only collected when the status being saved is Complete.
  closureEvidence: string;
}

export const EMPTY_FINDING_FORM: FindingFormState = {
  title: "", detail: "", controlId: "", assetId: "", severity: "medium", source: "",
  ownerId: "", remediationStatus: "Planned", due: "", remediationPlan: "",
  remediationOwnerId: "", targetDate: "", closureEvidence: "",
};

// Closure evidence already on the finding, resolved by the host from the live
// engine. The form has no engine access — same rule as systemId — so the host
// looks the records up and hands over what they say.
export interface ClosureEvidenceRef {
  id: string;
  source: string;
  collectedAt: string;
  evidenceType: string;
}

interface FindingFormConfig {
  initial?: Partial<FindingFormState>;
  controlOptions?: Array<{ id: ControlId; label: string }>;
  assetOptionsFor: (controlId: ControlId) => AssetOption[];
  // Absent on a new finding, and on any finding nothing has closed yet.
  closureEvidence?: ClosureEvidenceRef[];
}

// The form's whole brain, so the inline editor and the modal share one set of
// rules rather than two that drift.
export function useFindingForm({ initial, controlOptions, assetOptionsFor, closureEvidence = [] }: FindingFormConfig) {
  const [form, setForm] = useState<FindingFormState>(() => ({
    ...EMPTY_FINDING_FORM,
    controlId: controlOptions?.[0]?.id ?? "",
    ownerId: ORGS[0]?.id ?? "",
    due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    ...initial,
  }));

  function setField<K extends keyof FindingFormState>(key: K, value: FindingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const assetOptions = useMemo(
    () => (form.controlId ? assetOptionsFor(form.controlId as ControlId) : []),
    [form.controlId, assetOptionsFor]
  );

  // Changing the control can strand the asset on a control that does not apply
  // there. Clear it rather than carrying it forward into a draft the dry run
  // would reject with a message about applicability the operator never asked
  // about.
  function changeControl(controlId: string) {
    setForm((current) => {
      const stillValid = assetOptionsFor(controlId as ControlId).some((o) => o.assetId === current.assetId);
      return { ...current, controlId, assetId: stillValid ? current.assetId : "" };
    });
  }

  const completing = form.remediationStatus === "Complete";
  const closureReady = !completing || closureEvidence.length > 0 || Boolean(form.closureEvidence.trim());
  const ready = Boolean(form.title.trim() && form.controlId && form.ownerId && form.due && closureReady);

  // systemId is the host's to supply: it owns the boundary, and a form has no
  // business naming one.
  function buildDraft(): { draft: Omit<FindingDraft, "systemId">; closureEvidence: string } | null {
    if (!ready) return null;
    const owner = ORGS.find((org) => org.id === form.ownerId);
    if (!owner) return null;
    const remediationOwner = form.remediationOwnerId
      ? ORGS.find((org) => org.id === form.remediationOwnerId)
      : undefined;
    return {
      draft: {
        title: form.title.trim(),
        detail: form.detail.trim(),
        controlId: form.controlId as ControlId,
        assetId: form.assetId ? (form.assetId as FindingDraft["assetId"]) : undefined,
        severity: form.severity,
        source: form.source || undefined,
        ownerId: owner.id,
        remediationStatus: form.remediationStatus,
        due: form.due,
        remediationPlan: form.remediationPlan.trim() || undefined,
        remediationOwnerId: remediationOwner?.id,
        targetDate: form.targetDate || undefined,
      },
      closureEvidence: completing ? form.closureEvidence.trim() : "",
    };
  }

  return { form, setField, changeControl, assetOptions, completing, ready, buildDraft, closureEvidence };
}

type FindingFormApi = ReturnType<typeof useFindingForm>;

// Just the fields. Both hosts render these; only the actions differ.
export function FindingFields({ state, controlOptions }: {
  state: FindingFormApi;
  controlOptions?: Array<{ id: ControlId; label: string }>;
}) {
  const { form, setField, changeControl, assetOptions, completing, closureEvidence: recorded } = state;
  return (
    <>
      <FieldGrid cols={2}>
        <Field label="Title" span2 error={form.title.trim() ? null : "Required — say what was found."}>
          <TextInput value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="What was found" />
        </Field>
        <Field label="Detail" span2 note="Optional.">
          <TextInput value={form.detail} onChange={(e) => setField("detail", e.target.value)} placeholder="What's actually wrong" />
        </Field>

        {controlOptions && (
          <Field label="Control" span2 error={form.controlId ? null : "Required — a finding is a gap in a control."}>
            <Select value={form.controlId} aria-label="Control" onChange={(e) => changeControl(e.target.value)}>
              <option value="">Select a control…</option>
              {controlOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
        )}

        {/* Optional, and labelled so that reads as deliberate rather than as a
            field somebody forgot to fill in. */}
        <Field label="Asset" note="Optional — where the gap was observed.">
          <Select value={form.assetId} aria-label="Asset" onChange={(e) => setField("assetId", e.target.value)}>
            <option value="">No specific asset</option>
            {assetOptions.map((a) => <option key={a.assetId} value={a.assetId}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Severity">
          <Select value={form.severity} aria-label="Severity" onChange={(e) => setField("severity", selectedValue(FINDING_SEVERITIES, e.target.value, form.severity))}>
            {FINDING_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={form.source} aria-label="Source" onChange={(e) => setField("source", e.target.value === "" ? "" : selectedValue(FINDING_SOURCES, e.target.value, form.source || "control-gap"))}>
            <option value="">control-gap (default)</option>
            {FINDING_SOURCES.filter((s) => s !== "control-gap").map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
          </Select>
        </Field>
        <Field label="Owner">
          <Select value={form.ownerId} aria-label="Owner" onChange={(e) => setField("ownerId", e.target.value)}>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label="Remediation status">
          <Select value={form.remediationStatus} aria-label="Remediation status" onChange={(e) => setField("remediationStatus", selectedValue(REMEDIATION_STATUSES, e.target.value, form.remediationStatus))}>
            {REMEDIATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Due" error={form.due ? null : "Required."}>
          <TextInput type="date" value={form.due} aria-label="Due date" onChange={(e) => setField("due", e.target.value)} />
        </Field>
        <Field label="Remediation owner" note="Optional.">
          <Select value={form.remediationOwnerId} aria-label="Remediation owner" onChange={(e) => setField("remediationOwnerId", e.target.value)}>
            <option value="">Same as owner</option>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label="Target date" note="Optional.">
          <TextInput type="date" value={form.targetDate} aria-label="Target date" onChange={(e) => setField("targetDate", e.target.value)} />
        </Field>
        <Field label="Remediation plan (CAP)" span2 note="Optional — what will fix this.">
          <TextInput value={form.remediationPlan} onChange={(e) => setField("remediationPlan", e.target.value)} placeholder="What will fix this" />
        </Field>

        {/* Only asked when it is actually being answered. Closure evidence on a
            finding that is still in progress would be a claim about a fix that
            has not happened. */}
        {completing && (
          <Field
            label={recorded.length > 0 ? "Add closure evidence" : "Closure evidence"}
            span2
            note={recorded.length > 0
              ? "Optional — leave blank to keep what is already on record. Anything typed here is recorded as an ADDITIONAL self-attestation."
              : "Required — what proves it's fixed. Recorded as a self-attestation evidence record against this control."}
            error={recorded.length > 0 || form.closureEvidence.trim() ? null : "Add closure evidence before completing this finding."}
          >
            <TextInput
              value={form.closureEvidence}
              onChange={(e) => setField("closureEvidence", e.target.value)}
              placeholder="e.g. IAM policy rewritten and least-privilege scan re-run clean on 2026-08-20"
            />
          </Field>
        )}
      </FieldGrid>

      {/* What already closed this finding. Without it the field above is an
          empty box on a finding that IS closed, which reads as "nothing proves
          this" and invites a second record saying what the first one already
          said. */}
      {completing && recorded.length > 0 && (
        <Well className="flex flex-col gap-2">
          <div className={TX.label} style={{ color: C.muted }}>On record</div>
          {recorded.map((ev) => (
            <div key={ev.id} className="flex flex-col gap-0.5">
              <div className={TX.body} style={{ color: C.ink }}>{ev.source}</div>
              <div className={TX.help} style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
                {ev.id} · {ev.evidenceType} · collected {ev.collectedAt}
              </div>
            </div>
          ))}
        </Well>
      )}

      {completing && recorded.length === 0 && !form.closureEvidence.trim() && (
        <Callout tone="warning" title="Closure evidence required.">
          Record what was validated before marking this finding Complete.
        </Callout>
      )}
    </>
  );
}

export interface FindingEditorProps extends FindingFormConfig {
  submitLabel?: string;
  // Why this person may not save this finding, when they may not. Blocks the
  // primary and states the reason there (CONTRACT 4.7), rather than leaving the
  // form fillable and refusing at the end.
  blocker?: string | null;
  onCancel: () => void;
  onSubmit: (draft: Omit<FindingDraft, "systemId">, closureEvidence: string) => void;
}

// Inline form, for a host that is already a focused surface. The control panel
// uses this: it is itself a modal, and opening a second modal on top of it to
// type six fields would bury the control the gap is about.
export function FindingEditor({ initial, controlOptions, assetOptionsFor, closureEvidence, submitLabel, blocker, onCancel, onSubmit }: FindingEditorProps) {
  const state = useFindingForm({ initial, controlOptions, assetOptionsFor, closureEvidence });
  return (
    <Well className="flex flex-col gap-3.5">
      <FindingFields state={state} controlOptions={controlOptions} />
      {blocker && <InlineHint tone="warning">{blocker}</InlineHint>}
      <div className="flex items-center justify-end gap-2.5">
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          icon={Check}
          disabled={!state.ready || Boolean(blocker)}
          onClick={() => { const r = state.buildDraft(); if (r) onSubmit(r.draft, r.closureEvidence); }}
        >
          {submitLabel ?? (initial ? "Save finding" : "Create finding")}
        </Button>
      </div>
    </Well>
  );
}

export interface FindingEditorModalProps extends FindingEditorProps {
  open: boolean;
  // What the header names. A new finding has no subject yet, so the caller
  // supplies one rather than the modal inventing "Untitled".
  eyebrow?: string;
  heading?: string;
  problems?: string[] | null;
}

// The same form as its own popup, for a host that is a page.
//
// Deliberately rail-less (WizardBody `single`): there are no steps to walk, so
// inventing a rail would dress a single form up as a wizard — and with no rail
// there is no column for a `WizardRailSummary` to head, so this surface wears
// the unified masthead without its left cell (CONTRACT 4.10). The flow's name
// rides the eyebrow instead, where the other wizards put their position; this
// one has no run to be nth of, so it states the name alone rather than
// inventing a count (4.11).
export function FindingEditorModal({
  open, onCancel, onSubmit, initial, controlOptions, assetOptionsFor, closureEvidence,
  submitLabel, blocker, eyebrow, heading, problems,
}: FindingEditorModalProps) {
  const state = useFindingForm({ initial, controlOptions, assetOptionsFor, closureEvidence });
  if (!open) return null;
  return (
    <Modal open onClose={onCancel} width={840} height={720}>
      <WizardChrome>
        <WizardHeader
          icon={ListTodo}
          eyebrow={["Finding Editor", eyebrow].filter(Boolean).join(" · ")}
          title={heading ?? (initial ? "Edit finding" : "New finding")}
          onClose={<ModalCloseButton onClose={onCancel} />}
        />
        <WizardBody single>
          <WizardPane>
            {problems && problems.length > 0 && (
              <Callout tone="danger" title="Couldn't save — the change would leave the assessment inconsistent.">
                {problems.map((p, i) => <div key={i}>{p}</div>)}
              </Callout>
            )}
            <FindingFields state={state} controlOptions={controlOptions} />
          </WizardPane>
        </WizardBody>
        <WizardFooter
          position={state.completing ? "Completing — closure evidence required" : "A finding is a gap in a control"}
          hint={blocker ? <InlineHint tone="warning">{blocker}</InlineHint> : undefined}
          close={<Button onClick={onCancel}>Cancel</Button>}
          primary={(
            <Button
              variant="primary"
              icon={Check}
              disabled={!state.ready || Boolean(blocker)}
              onClick={() => { const r = state.buildDraft(); if (r) onSubmit(r.draft, r.closureEvidence); }}
            >
              {submitLabel ?? (initial ? "Save finding" : "Create finding")}
            </Button>
          )}
        />
      </WizardChrome>
    </Modal>
  );
}
