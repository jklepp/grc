import React, { useState } from "react";
import { C } from "../theme";
import { Button, Field, Select, TextArea, TextInput } from "./wizard/WizardUI";
import {
  CONTROL_FREQUENCIES, CONTROL_RECORD_STATUSES, CONTROL_RECORD_STATUS_META,
  type ControlFrequency, type ControlRecordStatus,
} from "../graph/nodes/controlRecords";

// One control record, edited in place: the statement of how it is met, its
// status, owner, and — only when a framework in scope asks for them — the
// frequency and evidence references. Used by the Controls tab (writing the
// system of record) and by an engagement (writing its draft). It never saves
// on its own; the caller decides which of the two a save means.

export interface ControlRecordValues {
  statement: string;
  status: ControlRecordStatus;
  ownerId: string;
  frequency?: ControlFrequency;
  evidence: string[];
  reviewedAt: string;
}

const FREQUENCY_LABELS: Record<ControlFrequency, string> = {
  continuous: "Continuous", "per-event": "Per event", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", "semi-annual": "Semi-annual", annual: "Annual",
};
export const frequencyLabel = (f?: string) => (f ? FREQUENCY_LABELS[f as ControlFrequency] ?? f : "—");

// A function rather than a map: C is re-themed in place, so its values must be read at render time.
const statusColor = (s: ControlRecordStatus) => (s === "implemented" ? C.green : s === "partial" ? C.amber : C.red);

export function ControlRecordForm({ initial, owners, requires, centralMethod, saveLabel = "Save", onSave, onCancel }: {
  initial: ControlRecordValues;
  owners: { id: string; name: string }[];
  requires: { frequency: boolean; evidence: boolean };
  /** For a hybrid control: what the central program does, and what this system must do. */
  centralMethod?: { statement: string; systemPart?: string } | null;
  saveLabel?: string;
  onSave: (values: ControlRecordValues) => string[] | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<ControlRecordValues>(initial);
  const [evidenceText, setEvidenceText] = useState(initial.evidence.join("\n"));
  const [problems, setProblems] = useState<string[]>([]);
  const set = <K extends keyof ControlRecordValues>(k: K, value: ControlRecordValues[K]) => setV((cur) => ({ ...cur, [k]: value }));

  const evidence = evidenceText.split("\n").map((l) => l.trim()).filter(Boolean);
  const owed = v.status !== "not-implemented";
  const missingFrequency = owed && requires.frequency && !v.frequency;
  const missingEvidence = owed && requires.evidence && evidence.length === 0;

  function save() {
    if (!v.statement.trim()) { setProblems(["Write how the control is met (or why it is not)."]); return; }
    const result = onSave({ ...v, statement: v.statement.trim(), evidence });
    if (Array.isArray(result) && result.length) setProblems(result);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {centralMethod && (
        <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: C.panel2 }}>
          <div className="font-semibold mb-1" style={{ color: C.ink }}>Central method</div>
          <div style={{ color: C.muted }}>{centralMethod.statement}</div>
          {centralMethod.systemPart && (
            <div className="mt-1.5" style={{ color: C.ink }}><span className="font-semibold">This system's part: </span>{centralMethod.systemPart}</div>
          )}
        </div>
      )}

      <Field label="Status">
        <div className="flex flex-wrap gap-1.5">
          {CONTROL_RECORD_STATUSES.map((s) => {
            const on = v.status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => set("status", s)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-md"
                style={{ border: `1px solid ${on ? statusColor(s) : C.border}`, background: on ? C.panel2 : "transparent", color: on ? statusColor(s) : C.muted }}
              >
                {CONTROL_RECORD_STATUS_META[s].label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="How it is met" note="Plain language: what is in place, where, and run by whom.">
        <TextArea value={v.statement} onChange={(e) => set("statement", e.target.value)} rows={4} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Owner">
          <Select value={v.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label={requires.frequency ? "Frequency · SOC 2 asks for this" : "Frequency"} error={missingFrequency ? "Owed: SOC 2 sizes its sample from it." : null}>
          <Select value={v.frequency ?? ""} onChange={(e) => set("frequency", (e.target.value || undefined) as ControlFrequency | undefined)}>
            <option value="">Not stated</option>
            {CONTROL_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
          </Select>
        </Field>
      </div>

      <Field
        label={requires.evidence ? "Evidence · the frameworks in scope ask for this" : "Evidence"}
        note="One reference per line: a report, ticket, test or document id. Pointers, not files."
        error={missingEvidence ? "Owed: no evidence reference yet." : null}
      >
        <TextArea value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} rows={3} placeholder={"Vanta test: RDS encryption at rest\nDRTEST-SYS-058-2026-01"} />
      </Field>

      <Field label="Reviewed on">
        <TextInput type="date" value={v.reviewedAt} onChange={(e) => set("reviewedAt", e.target.value)} style={{ maxWidth: 180 }} />
      </Field>

      {problems.length > 0 && (
        <div className="text-xs rounded-md px-3 py-2" style={{ color: C.red, background: C.redBg }}>
          {problems.slice(0, 3).map((p) => <div key={p}>{p}</div>)}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={save}>{saveLabel}</Button>
      </div>
    </div>
  );
}
