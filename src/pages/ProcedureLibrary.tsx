import React, { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ListChecks, ClipboardList, Layers, Link2, Boxes, User, RefreshCw, FileCheck2,
  CheckCircle2, Circle, RotateCcw, Info, Play, X, PartyPopper, ChevronDown, ChevronUp,
  AlertTriangle, Paperclip, Ticket, Calculator,
} from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { PROCEDURES } from "../data/procedures";
import { POLICIES, getFrameworkClauses, MAPPED_STANDARDS, STANDARD_ABBR } from "../data/policies";
import { getAllSystems, EVIDENCE_CONFIDENCE } from "../engine";
import type { AuthoredProcedure, AuthoredProcedureStep, ProcedureStepEvidence } from "../data/procedures";
import { EXEC_STORAGE_KEY, loadExecutions, computeReliability } from "../data/procedureExecutions";
import { useSignedInUser } from "../auth/useUser";
import { initialsOf } from "../auth/roster";
import { canRunProcedure, allows } from "../auth/gates";
import type { ExecutionStepRecord, ExecutionsMap, ProcedureExecution, ProcedureReliability, StepEvidencePayload } from "../data/procedureExecutions";

const SYSTEMS = getAllSystems();

// A run is owned by whoever started it — the signed-in user, recorded as
// initials on the execution and on every step they complete. State persists in
// localStorage only (no backend). Each "Start SOP" click creates a real
// execution record (not just a flat completed/not-completed map) with per-step
// evidence, so a run of SOP-04 looks like an actual access-review cycle rather
// than five blank checkmarks — but it is still a person typing the numbers in,
// so the confidence tier stays Self-attestation (see the info callout below)
// until this is backed by a real system. Knowing WHICH person does not change
// that; it only makes the record answerable.
const SLIDE_MS = 320;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function quarterLabel(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

// Execution IDs look like "SOP-04-2026-Q3-002" — the run number disambiguates
// a second execution started in the same quarter (e.g. a redo after a bad run).
function newExecution(procedure: AuthoredProcedure, existingList: ProcedureExecution[], owner: string): ProcedureExecution {
  const period = quarterLabel(new Date());
  const runNumber = existingList.filter((e) => e.period === period).length + 1;
  return {
    id: `${procedure.code}-${period}-${String(runNumber).padStart(3, "0")}`,
    period,
    owner,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "in_progress",
    steps: procedure.steps.map(() => ({ status: "pending", completedAt: null, evidence: null })),
  };
}

function stepSummary(stepRecord?: ExecutionStepRecord): number | null {
  return stepRecord && stepRecord.evidence && typeof stepRecord.evidence.summary === "number" ? stepRecord.evidence.summary : null;
}

function executionProgress(execution: ProcedureExecution): { done: number; total: number; pct: number } {
  const done = execution.steps.filter((s) => s.status === "complete").length;
  return { done, total: execution.steps.length, pct: Math.round((100 * done) / execution.steps.length) };
}

function MetaChip({ icon: Icon, label, value }: { icon: LucideIcon; label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>
        <Icon size={11} /> {label}
      </div>
      <div className="text-xs mt-1" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}

function ProcedureStepRow({ step: s, index }: { step: AuthoredProcedureStep; index?: number }) {
  const isRequired = s.controls && s.controls.length > 0;
  return (
    <div className="flex gap-2.5">
      {index != null && <span className="text-xs font-semibold shrink-0 w-5" style={{ color: C.accent }}>{index + 1}.</span>}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{s.title}</div>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              background: isRequired ? C.accentBg : C.panel2,
              color: isRequired ? C.accent : C.muted,
              border: `1px solid ${isRequired ? C.accent : C.border}`,
            }}
          >
            {isRequired ? "Required" : "Recommended"}
          </span>
        </div>
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{s.detail}</div>
        {s.controls && s.controls.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {s.controls.map((id) => (
              <span
                key={id}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: C.panel2, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", border: `1px solid ${C.border}` }}
                title="Control this step operationalizes"
              >
                {id}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Some SOPs now cover up to ~46 real controls (the Governance, Risk &
// Compliance group), so the raw ID list and clause citations both need to
// stay usable rather than dumping a wall of IDs — collapsed by default with
// a "show N more" toggle, and the clause list scrolls instead of growing
// the card indefinitely.
function ControlMapping({ controlIds, uncitedControlIds }: { controlIds: string[]; uncitedControlIds: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showUncited, setShowUncited] = useState(false);
  const LIMIT = 18;
  const shown = expanded ? controlIds : controlIds.slice(0, LIMIT);
  const hiddenCount = controlIds.length - shown.length;
  const citedCount = controlIds.length - uncitedControlIds.length;

  return (
    <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="text-[11px] mb-3" style={{ color: C.muted }}>
        Maps to <span style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{controlIds.length}</span> SCF control{controlIds.length !== 1 ? "s" : ""}:{" "}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{shown.join(", ")}{hiddenCount > 0 ? " …" : ""}</span>
        {hiddenCount > 0 && (
          <button onClick={() => setExpanded(true)} className="ml-1.5 font-medium" style={{ color: C.accent }}>show {hiddenCount} more</button>
        )}
        {expanded && controlIds.length > LIMIT && (
          <button onClick={() => setExpanded(false)} className="ml-1.5 font-medium" style={{ color: C.accent }}>show less</button>
        )}
      </div>
      <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${C.border}`, maxHeight: 160, overflowY: "auto" }}>
        {MAPPED_STANDARDS.map((std) => {
          const clauses = getFrameworkClauses(controlIds, std);
          if (clauses.length === 0) return null;
          return (
            <div key={std} className="flex items-start gap-2 text-[11px]">
              <span className="w-12 shrink-0 font-semibold pt-0.5" style={{ color: C.accent }}>{STANDARD_ABBR[std]}</span>
              <span className="flex-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{clauses.join(", ")}</span>
            </div>
          );
        })}
      </div>
      <div className="pt-2 mt-2 text-[11px]" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
        <span style={{ color: C.ink, fontWeight: 600 }}>{citedCount}/{controlIds.length}</span>{" "}
        {uncitedControlIds.length === 0
          ? "controls are individually cited on a specific step above (tagged inline) — every control this procedure owns is called out at step level."
          : "controls are individually cited on a specific step above (tagged inline); the rest are covered by the procedure as a whole but not yet called out at step level."}
        {uncitedControlIds.length > 0 && (
          <>
            {" "}
            <button onClick={() => setShowUncited((v) => !v)} className="font-medium" style={{ color: C.accent }}>
              {showUncited ? "hide" : "show"} the {uncitedControlIds.length} not yet cited
            </button>
            {showUncited && (
              <div className="mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{uncitedControlIds.join(", ")}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function assuranceColor(score: number): string {
  if (score >= 90) return C.green;
  if (score >= 75) return C.amber;
  if (score >= 60) return C.amber;
  return C.red;
}

// Renders the right input(s) for a step's evidence type and gates "Mark step
// complete" until the entry actually satisfies that type's requirement —
// the whole point being that no step completes on a blank click. `execution`
// is passed in so a "tickets" or "verify" step can read an earlier step's
// captured summary value (e.g. "how many accounts were flagged") and check
// against it, the same cross-step reconciliation the feedback asked for.
interface StepEvidenceFormProps {
  step: AuthoredProcedureStep;
  execution: ProcedureExecution;
  onComplete: (payload: StepEvidencePayload) => void;
}

function StepEvidenceForm({ step, execution, onComplete }: StepEvidenceFormProps) {
  const ev: ProcedureStepEvidence | { type: "note" } = step.evidence || { type: "note" };
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [ticketText, setTicketText] = useState("");
  const [verifyActual, setVerifyActual] = useState("");

  const priorSummary = (idx?: number) => (idx != null ? stepSummary(execution.steps[idx]) : null);

  let canComplete = false;
  let buildPayload: () => StepEvidencePayload = () => ({});
  let extra: ReactNode = null;

  if (ev.type === "file") {
    canComplete = !!file;
    buildPayload = () => file ? { fileName: file.name, fileSize: file.size, fileType: file.type || "unknown" } : {};
  } else if (ev.type === "fields") {
    const allFilled = ev.fields.every((f) => fieldValues[f.key] !== undefined && String(fieldValues[f.key]).trim() !== "");
    const reconcileOk = allFilled && ev.reconcile ? ev.reconcile.check(fieldValues) : allFilled;
    canComplete = allFilled && reconcileOk;
    buildPayload = () => ({ values: fieldValues, summary: ev.summaryKey ? Number(fieldValues[ev.summaryKey]) : undefined });
    if (allFilled && ev.reconcile) {
      extra = (
        <div className="text-xs mt-2 flex items-center gap-1.5" style={{ color: reconcileOk ? C.green : C.red }}>
          {reconcileOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {ev.reconcile.formula} {reconcileOk ? "✓" : "— doesn't reconcile, fix the numbers"}
        </div>
      );
    }
  } else if (ev.type === "tickets") {
    const ids = ticketText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const pattern = ev.pattern;
    const patternOk = ids.length > 0 && (!pattern || ids.every((id) => pattern.test(id)));
    const expected = ev.expectedFromStep != null ? priorSummary(ev.expectedFromStep) : null;
    const countOk = expected == null || ids.length === expected;
    canComplete = patternOk && countOk;
    buildPayload = () => ({ ids, summary: ids.length });
    extra = (
      <div className="text-xs mt-2 space-y-1">
        {ev.pattern && ticketText && !patternOk && <div style={{ color: C.red }}>Each ID must match {ev.patternHint}</div>}
        {expected != null && ids.length > 0 && (
          <div style={{ color: countOk ? C.green : C.amber }}>
            {ids.length} ticket{ids.length !== 1 ? "s" : ""} entered — {expected} {ev.expectedLabel} in this run {countOk ? "✓" : `(expected ${expected})`}
          </div>
        )}
      </div>
    );
  } else if (ev.type === "verify") {
    const expected = ev.expectedFromStep != null ? priorSummary(ev.expectedFromStep) : null;
    const actualNum = verifyActual === "" ? null : Number(verifyActual);
    canComplete = actualNum !== null && !Number.isNaN(actualNum);
    const pass = expected == null || actualNum === expected;
    buildPayload = () => ({ actual: actualNum, expected, pass });
    if (actualNum !== null && expected != null) {
      extra = (
        <div className="text-xs mt-2 flex items-center gap-1.5" style={{ color: pass ? C.green : C.amber }}>
          {pass ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {pass ? "Matches expected — PASS" : `Expected ${expected}, got ${actualNum} — this won't block completion, but it's logged as an exception on this run`}
        </div>
      );
    }
  } else {
    canComplete = note.trim().length >= 8;
    buildPayload = () => ({ note: note.trim() });
  }

  return (
    <div className="mt-5">
      {ev.type === "file" && (
        <div>
          <label className="text-xs font-medium flex items-center gap-1.5 mb-2" style={{ color: C.ink }}><Paperclip size={12} />{ev.label}</label>
          <input type="file" accept={ev.accept} onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" style={{ color: C.muted }} />
          {file && <div className="text-xs mt-1.5" style={{ color: C.green }}>Attached: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)</div>}
        </div>
      )}
      {ev.type === "fields" && (
        <div>
          <label className="text-xs font-medium flex items-center gap-1.5 mb-2" style={{ color: C.ink }}><Calculator size={12} />{ev.label}</label>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {ev.fields.map((f) => (
              <div key={f.key}>
                <div className="text-[10px] mb-1" style={{ color: C.muted }}>{f.label}</div>
                <input
                  type="number"
                  value={fieldValues[f.key] ?? ""}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full text-sm px-2 py-1.5 rounded-md"
                  style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}
                />
              </div>
            ))}
          </div>
          {extra}
        </div>
      )}
      {ev.type === "tickets" && (
        <div>
          <label className="text-xs font-medium flex items-center gap-1.5 mb-2" style={{ color: C.ink }}><Ticket size={12} />{ev.label}</label>
          <textarea
            value={ticketText}
            onChange={(e) => setTicketText(e.target.value)}
            placeholder={`e.g. ${ev.patternHint || "ticket IDs, comma-separated"}`}
            rows={2}
            className="w-full text-sm px-2 py-1.5 rounded-md"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}
          />
          {extra}
        </div>
      )}
      {ev.type === "verify" && (
        <div>
          <label className="text-xs font-medium flex items-center gap-1.5 mb-2" style={{ color: C.ink }}><CheckCircle2 size={12} />{ev.label}</label>
          {ev.expectedFromStep != null && (
            <div className="text-xs mb-1.5" style={{ color: C.muted }}>
              Expected: <span style={{ color: C.ink, fontWeight: 600 }}>{priorSummary(ev.expectedFromStep) ?? "—"}</span> {ev.expectedLabel}
            </div>
          )}
          <input
            type="number"
            value={verifyActual}
            onChange={(e) => setVerifyActual(e.target.value)}
            placeholder={ev.actualLabel}
            className="text-sm px-2 py-1.5 rounded-md"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink, width: 220 }}
          />
          {extra}
        </div>
      )}
      {ev.type === "note" && (
        <div>
          <label className="text-xs font-medium mb-2 block" style={{ color: C.ink }}>What did you actually do for this step?</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Describe what was done, checked, or confirmed — a blank click isn't evidence."
            className="w-full text-sm px-2 py-1.5 rounded-md"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}
          />
        </div>
      )}

      <button
        onClick={() => canComplete && onComplete(buildPayload())}
        disabled={!canComplete}
        className="flex items-center justify-center gap-2 text-sm font-semibold py-3 px-6 rounded-lg mt-4"
        style={{ background: canComplete ? C.accent : C.panel2, color: canComplete ? "#fff" : C.muted, width: "fit-content", cursor: canComplete ? "pointer" : "not-allowed" }}
      >
        <CheckCircle2 size={16} /> Mark step complete
      </button>
    </div>
  );
}

// The animated step card: sits inside an overflow-hidden frame in the modal.
// Completing a step drives it through exit (slide left + fade) -> instantly
// repositioned off-screen right with transitions disabled -> enter (slide
// back to center + fade). The double requestAnimationFrame before flipping
// to "enter" forces the browser to paint the off-screen position first, so
// the transition back to center actually animates instead of being
// collapsed into a single no-op frame.
type SlidePhase = "idle" | "exit" | "enter-instant" | "enter";

function StepCard({ step, execution, onComplete, phase }: StepEvidenceFormProps & { phase: SlidePhase }) {
  const slide: CSSProperties = (() => {
    switch (phase) {
      case "exit":
        return { transform: "translateX(-115%)", opacity: 0, transition: `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease` };
      case "enter-instant":
        return { transform: "translateX(115%)", opacity: 0, transition: "none" };
      case "enter":
        return { transform: "translateX(0)", opacity: 1, transition: `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease` };
      default:
        return { transform: "translateX(0)", opacity: 1, transition: `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease` };
    }
  })();

  return (
    <div style={{ ...slide, height: "100%", overflowY: "auto" }}>
      <div className="text-2xl font-semibold mb-3" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{step.title}</div>
      <div className="text-sm leading-relaxed" style={{ color: C.muted, maxWidth: 480 }}>{step.detail}</div>
      <StepEvidenceForm step={step} execution={execution} onComplete={onComplete} />
    </div>
  );
}

interface SopWizardModalProps {
  procedure: AuthoredProcedure;
  execution: ProcedureExecution;
  onCompleteStep: (stepIndex: number, payload: StepEvidencePayload) => void;
  onStartNew: () => void;
  onClose: () => void;
}

function SopWizardModal({ procedure, execution, onCompleteStep, onStartNew, onClose }: SopWizardModalProps) {
  const steps = procedure.steps;
  const firstIncomplete = execution.steps.findIndex((s) => s.status !== "complete");
  const startIndex = firstIncomplete === -1 ? steps.length : firstIncomplete;

  const [displayIndex, setDisplayIndex] = useState(startIndex);
  const [phase, setPhase] = useState<SlidePhase>("idle");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isComplete = displayIndex >= steps.length;
  const exceptionCount = execution.steps.filter((s) => s.evidence && s.evidence.pass === false).length;

  function handleComplete(payload: StepEvidencePayload) {
    onCompleteStep(displayIndex, payload);
    setPhase("exit");
    setTimeout(() => {
      const next = displayIndex + 1;
      setDisplayIndex(next);
      if (next < steps.length) {
        setPhase("enter-instant");
        requestAnimationFrame(() => requestAnimationFrame(() => setPhase("enter")));
      } else {
        setPhase("idle");
      }
    }, SLIDE_MS);
  }

  function handleStartNew() {
    onStartNew();
    setDisplayIndex(0);
    setPhase("idle");
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full flex overflow-hidden"
        style={{ background: C.panel, border: `1px solid ${C.border}`, maxWidth: 860, height: "min(640px, 85vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: the full process workflow, always visible */}
        <div className="w-72 shrink-0 p-5 flex flex-col" style={{ background: C.panel2, borderRight: `1px solid ${C.border}`, overflowY: "auto" }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{procedure.code}</div>
          <div className="text-sm font-semibold leading-snug" style={{ color: C.ink }}>{procedure.title}</div>
          <div className="text-[10px] mb-4 mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{execution.id}</div>
          <div className="space-y-1">
            {steps.map((s, i) => {
              const stepRecord = execution.steps[i];
              const done = i < displayIndex || (i === displayIndex && phase === "exit");
              const isCurrent = i === displayIndex && !isComplete && phase !== "exit";
              const exception = stepRecord.evidence && stepRecord.evidence.pass === false;
              return (
                <div
                  key={i}
                  title={stepRecord.completedAt ? `Completed ${formatTimestamp(stepRecord.completedAt)}` : undefined}
                  className="flex items-start gap-2.5 rounded-lg p-2"
                  style={{ background: isCurrent ? C.accentBg : "transparent" }}
                >
                  <span className="shrink-0 mt-0.5">
                    {done ? (exception ? <AlertTriangle size={15} color={C.amber} /> : <CheckCircle2 size={15} color={C.green} />) : <Circle size={15} color={isCurrent ? C.accent : C.muted} />}
                  </span>
                  <span className="text-xs leading-snug" style={{ color: done ? (exception ? C.amber : C.green) : isCurrent ? C.ink : C.muted, fontWeight: isCurrent ? 600 : 400 }}>
                    {i + 1}. {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: the step actually being worked, one at a time */}
        <div className="flex-1 min-w-0 p-8 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4 shrink-0">
            <div className="text-xs font-medium" style={{ color: C.muted }}>
              {!isComplete ? `Step ${displayIndex + 1} of ${steps.length}` : "Execution complete"}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: C.muted, background: C.panel2 }} title="Close">
              <X size={16} />
            </button>
          </div>

          <div style={{ overflow: "hidden", position: "relative", flex: 1 }}>
            {!isComplete ? (
              <StepCard step={steps[displayIndex]} execution={execution} onComplete={handleComplete} phase={phase} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <PartyPopper size={40} color={C.green} className="mb-3" />
                <div className="text-xl font-semibold" style={{ color: C.ink }}>{execution.id} complete</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>
                  {steps.length} of {steps.length} steps completed by {execution.owner}
                </div>
                {exceptionCount > 0 && (
                  <div className="text-xs mt-1 flex items-center gap-1.5" style={{ color: C.amber }}>
                    <AlertTriangle size={13} /> {exceptionCount} exception{exceptionCount !== 1 ? "s" : ""} flagged for follow-up
                  </div>
                )}
                <div className="flex items-center gap-2 mt-6">
                  <button
                    onClick={handleStartNew}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-lg text-sm font-semibold"
                    style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
                  >
                    <RotateCcw size={14} /> Start a new run
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 rounded-lg text-sm font-semibold"
                    style={{ background: C.accent, color: "#fff" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type EvidenceType = ProcedureStepEvidence["type"] | "note";

function EvidenceValue({ type, evidence }: { type: EvidenceType; evidence: StepEvidencePayload | null }) {
  if (!evidence) return null;
  if (type === "file") return <span>{evidence.fileName ?? "File"} ({Math.max(1, Math.round((evidence.fileSize ?? 0) / 1024))} KB)</span>;
  if (type === "fields") return <span>{Object.entries(evidence.values ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>;
  if (type === "tickets") return <span>{(evidence.ids ?? []).join(", ")}</span>;
  if (type === "verify") {
    return (
      <span style={{ color: evidence.pass === false ? C.amber : "inherit" }}>
        {evidence.actual}{evidence.expected != null ? ` / expected ${evidence.expected}` : ""} {evidence.pass === false ? "⚠ mismatch" : "✓"}
      </span>
    );
  }
  return <span>&ldquo;{evidence.note}&rdquo;</span>;
}

interface ExecutionsPanelProps {
  procedure: AuthoredProcedure;
  executions: ProcedureExecution[];
  reliability: ProcedureReliability | null;
  expandedRunId: string | null;
  onToggleExpand: (executionId: string | null) => void;
  onStart: () => void;
}

function ExecutionsPanel({ procedure, executions, reliability, expandedRunId, onToggleExpand, onStart }: ExecutionsPanelProps) {
  return (
    <div>
      <div className="rounded-lg p-4 mb-5 flex items-center justify-between" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
        <div>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Procedure Reliability</div>
          {reliability ? (
            <div className="text-2xl font-semibold" style={{ color: reliability.reliabilityPct >= 90 ? C.green : reliability.reliabilityPct >= 70 ? C.amber : C.red }}>
              {reliability.reliabilityPct}%
            </div>
          ) : (
            <div className="text-sm" style={{ color: C.muted }}>No completed executions yet</div>
          )}
        </div>
        {reliability && (
          <div className="text-xs text-right leading-relaxed" style={{ color: C.muted }}>
            {reliability.completedRuns} of {reliability.totalRuns} run{reliability.totalRuns !== 1 ? "s" : ""} completed<br />
            {reliability.cleanRuns}/{reliability.completedRuns} clean{reliability.totalExceptions > 0 ? `, ${reliability.totalExceptions} exception${reliability.totalExceptions !== 1 ? "s" : ""} flagged` : ""}
          </div>
        )}
      </div>

      {executions.length === 0 ? (
        <div className="text-sm text-center py-10" style={{ color: C.muted }}>
          No executions recorded yet.{" "}
          <button onClick={onStart} className="font-semibold" style={{ color: C.accent }}>Start the first one</button>.
        </div>
      ) : (
        <div className="space-y-2">
          {executions.map((exec) => {
            const { done, total } = executionProgress(exec);
            const isExpanded = expandedRunId === exec.id;
            const exceptions = exec.steps.filter((s) => s.evidence && s.evidence.pass === false).length;
            return (
              <div key={exec.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <button
                  onClick={() => onToggleExpand(isExpanded ? null : exec.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  style={{ background: C.panel2 }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{exec.id}</div>
                      <div className="text-[11px]" style={{ color: C.muted }}>
                        Started {formatDate(exec.startedAt)}{exec.completedAt ? ` · completed ${formatDate(exec.completedAt)}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {exceptions > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: C.panel, color: C.amber }}>
                        <AlertTriangle size={10} /> {exceptions}
                      </span>
                    )}
                    <span className="text-[11px] font-medium" style={{ color: exec.status === "complete" ? C.green : C.accent }}>
                      {exec.status === "complete" ? "Complete" : "In progress"}
                    </span>
                    <span className="text-xs" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{done}/{total}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="p-3 space-y-2.5" style={{ background: C.panel }}>
                    {procedure.steps.map((s, i) => {
                      const rec = exec.steps[i];
                      const evType = (s.evidence || { type: "note" }).type;
                      const exception = rec.evidence && rec.evidence.pass === false;
                      return (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="shrink-0 mt-0.5">
                            {rec.status === "complete" ? (exception ? <AlertTriangle size={13} color={C.amber} /> : <CheckCircle2 size={13} color={C.green} />) : <Circle size={13} color={C.muted} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div style={{ color: C.ink, fontWeight: 500 }}>{i + 1}. {s.title}</div>
                            {rec.status === "complete" && rec.completedAt && (
                              <div style={{ color: C.muted }} className="mt-0.5">
                                <EvidenceValue type={evType} evidence={rec.evidence} /> — {formatTimestamp(rec.completedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProcedureLibrary({ onNavigate }: { onNavigate?: (pageId: string) => void }) {
  const user = useSignedInUser();
  const mayRun = allows(canRunProcedure(user));
  const initials = initialsOf(user);
  const [selectedId, setSelectedId] = useState(PROCEDURES[0].id);
  const [tab, setTab] = useState<"procedure" | "executions">("procedure");
  const [executionsMap, setExecutionsMap] = useState<ExecutionsMap>(loadExecutions);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardExecutionId, setWizardExecutionId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(EXEC_STORAGE_KEY, JSON.stringify(executionsMap));
  }, [executionsMap]);

  const selected = PROCEDURES.find((p) => p.id === selectedId) || PROCEDURES[0];
  const linkedPolicy = POLICIES.find((p) => p.id === selected.policyId);

  // Every SOP's steps are authored Required-first (see the file header in
  // procedures.js), so the split and divider can be derived from a simple
  // count rather than re-sorting here. Required means the step carries a
  // `controls` citation; Recommended means it doesn't yet — not that it's
  // optional (see ControlMapping below for the same distinction at the
  // procedure-wide, rather than step, level).
  const requiredCount = selected.steps.filter((s) => s.controls && s.controls.length > 0).length;

  // What this SOP actually operationalizes, and how well. An asset no longer
  // carries a category score to rank by — and ranking assets was always the
  // weaker panel for a procedure page anyway. The controls this SOP is the
  // owning procedure for, with the Procedure-level rating each one earned
  // across both systems, makes the link between writing a step and moving a
  // number visible for the first time.
  const scoredControls = SYSTEMS.flatMap((s) =>
    s.scoredAssessments.filter((a) => a.category === selected.category)
  )
    .filter((a) => selected.controlIds.includes(a.controlId))
    .sort((a, b) => a.levels.Procedure.rating - b.levels.Procedure.rating || (a.rawScore ?? 0) - (b.rawScore ?? 0));

  const selectedExecutions = executionsMap[selected.id] || [];
  const activeExecution = selectedExecutions.find((e) => e.status === "in_progress") || null;
  const wizardExecution = selectedExecutions.find((e) => e.id === wizardExecutionId) || null;
  const reliability = computeReliability(selectedExecutions);

  function selectProcedure(id: string) {
    setSelectedId(id);
    setTab("procedure");
    setExpandedRunId(null);
  }

  function startOrResume(procedureId: string) {
    const procedure = PROCEDURES.find((p) => p.id === procedureId);
    if (!procedure) return;
    const list = executionsMap[procedureId] || [];
    const existing = list.find((e) => e.status === "in_progress");
    const exec = existing || newExecution(procedure, list, initials);
    if (!existing) {
      setExecutionsMap((prev) => ({ ...prev, [procedureId]: [exec, ...(prev[procedureId] || [])] }));
    }
    setWizardExecutionId(exec.id);
    setWizardOpen(true);
  }

  function completeStep(procedureId: string, executionId: string, stepIndex: number, payload: StepEvidencePayload) {
    setExecutionsMap((prev) => ({
      ...prev,
      [procedureId]: (prev[procedureId] || []).map((e) => {
        if (e.id !== executionId) return e;
        const steps: ExecutionStepRecord[] = e.steps.map((s, i) =>
          i === stepIndex ? { status: "complete", completedAt: new Date().toISOString(), completedBy: initials, evidence: payload } : s
        );
        const allDone = steps.every((s) => s.status === "complete");
        return { ...e, steps, status: allDone ? "complete" : "in_progress", completedAt: allDone ? new Date().toISOString() : null };
      }),
    }));
  }

  function startNewRun(procedureId: string) {
    const procedure = PROCEDURES.find((p) => p.id === procedureId);
    if (!procedure) return;
    const list = executionsMap[procedureId] || [];
    const exec = newExecution(procedure, list, initials);
    setExecutionsMap((prev) => ({ ...prev, [procedureId]: [exec, ...(prev[procedureId] || [])] }));
    setWizardExecutionId(exec.id);
  }

  function discardActiveRun(procedureId: string) {
    setExecutionsMap((prev) => ({ ...prev, [procedureId]: (prev[procedureId] || []).filter((e) => e.status !== "in_progress") }));
  }

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={ListChecks}
        title="Procedures"
        description={'One Standard Operating Procedure per Assurance Category — the "how" behind each policy\'s "what."'}
        descriptionClassName="max-w-none lg:whitespace-nowrap"
      />

      <div className="px-4 lg:px-8 flex flex-col lg:flex-row gap-4 lg:gap-5 pb-12">
        <div className="w-full lg:w-64 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
          {PROCEDURES.map((p) => {
            const isActive = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => selectProcedure(p.id)}
                className="w-full flex flex-col items-start px-3 py-2.5 text-left"
                style={{ background: isActive ? C.panel2 : "transparent", borderBottom: `1px solid ${C.border}` }}
              >
                <span className="text-[10px]" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{p.code} · {p.category}</span>
                <span className="text-xs leading-snug font-medium" style={{ color: isActive ? C.ink : C.muted }}>{p.title}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 rounded-xl p-6" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
            {selected.code} · {selected.category}
          </div>
          <h2 className="text-2xl mb-3" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.title}</h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: C.ink }}>{selected.purpose}</p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
            <MetaChip icon={User} label="Owner" value={selected.owner} />
            <MetaChip icon={RefreshCw} label="Review Cadence" value={selected.reviewCadence} />
            <MetaChip icon={FileCheck2} label="Typical Evidence" value={selected.evidenceType} />
          </div>

          {linkedPolicy && (
            <div className="mb-6">
              <SectionHeading icon={Link2}>Implements policy</SectionHeading>
              <button
                onClick={() => onNavigate && onNavigate("policy-center")}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
              >
                <span style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{linkedPolicy.code}</span> {linkedPolicy.title}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTab("procedure")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: tab === "procedure" ? C.panel2 : "transparent", color: tab === "procedure" ? C.ink : C.muted }}
              >
                Procedure
              </button>
              <button
                onClick={() => setTab("executions")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: tab === "executions" ? C.panel2 : "transparent", color: tab === "executions" ? C.ink : C.muted }}
              >
                Executions{selectedExecutions.length > 0 ? ` (${selectedExecutions.length})` : ""}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {mayRun && activeExecution && (
                <button
                  onClick={() => discardActiveRun(selected.id)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
                  style={{ color: C.muted }}
                  title="Discard the in-progress run"
                >
                  <RotateCcw size={11} /> Discard draft
                </button>
              )}
              {mayRun && (
                <button
                  onClick={() => startOrResume(selected.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: C.accent, color: "#fff" }}
                >
                  <Play size={13} /> {activeExecution ? "Continue SOP" : "Start SOP"}
                </button>
              )}
            </div>
          </div>

          {tab === "executions" ? (
            <div className="mb-6">
              <ExecutionsPanel
                procedure={selected}
                executions={selectedExecutions}
                reliability={reliability}
                expandedRunId={expandedRunId}
                onToggleExpand={setExpandedRunId}
                onStart={() => startOrResume(selected.id)}
              />
            </div>
          ) : (
            <>
              <SectionHeading
                icon={ClipboardList}
                right={(
                  <span className="text-[11px]" style={{ color: C.muted }}>
                    <span style={{ color: C.accent, fontWeight: 600 }}>{requiredCount} Required</span>
                    {" · "}
                    <span style={{ color: C.ink, fontWeight: 600 }}>{selected.steps.length - requiredCount} Recommended</span>
                  </span>
                )}
              >
                Procedure steps
              </SectionHeading>
              <div className="text-[11px] leading-relaxed mb-3" style={{ color: C.muted }}>
                <span style={{ color: C.accent, fontWeight: 600 }}>Required</span> steps are individually mapped to a
                specific control in ACME's framework crosswalk (tagged inline below the step).{" "}
                <span style={{ color: C.ink, fontWeight: 600 }}>Recommended</span> steps are security practice ACME
                follows beyond what's currently cited to a specific control — not optional, just not yet tied to one.
              </div>
              <div className="space-y-3 mb-6">
                {selected.stepGroups ? (
                  selected.stepGroups.map((g) => {
                    const groupSteps = selected.steps.filter((s) => s.group === g.id);
                    if (groupSteps.length === 0) return null;
                    return (
                      <div key={g.id} className="mb-5">
                        <div className="pb-1">
                          <div
                            className="block w-full text-sm font-bold uppercase tracking-wide px-3 py-0.5 rounded-lg"
                            style={{ color: C.accent, border: `1px solid ${C.accent}` }}
                          >
                            {g.title}
                          </div>
                          <div className="text-[11px] mt-0.5 leading-snug" style={{ color: C.muted }}>{g.blurb}</div>
                        </div>
                        <div className="space-y-3">
                          {groupSteps.map((s) => (
                            <ProcedureStepRow key={s.title} step={s} index={selected.steps.indexOf(s)} />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  selected.steps.map((s, i) => {
                    // Steps arrive sorted required-first, so the divider is a
                    // position test against requiredCount rather than a property
                    // of the step itself.
                    const showDivider = i === requiredCount && requiredCount > 0 && requiredCount < selected.steps.length;
                    return (
                      <React.Fragment key={i}>
                        {showDivider && (
                          <div className="flex items-center gap-2 pt-1 max-lg:flex-wrap">
                            <span className="text-[10px] uppercase tracking-wide font-semibold shrink-0" style={{ color: C.muted }}>
                              Recommended — beyond the current framework mapping
                            </span>
                            <div className="flex-1 h-px" style={{ background: C.border }} />
                          </div>
                        )}
                        <ProcedureStepRow step={s} index={i} />
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              <div className="flex items-start gap-2 text-[11px] leading-relaxed rounded-lg p-3 mb-6" style={{ background: C.panel2, color: C.muted }}>
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>
                  Running the SOP through <span style={{ color: C.ink, fontWeight: 600 }}>Start SOP</span> creates a real
                  execution record — see the <span style={{ color: C.ink, fontWeight: 600 }}>Executions</span> tab — with
                  per-step evidence and, on steps that support it, built-in consistency checks (numbers that must
                  reconcile, a ticket count that must match what an earlier step flagged). That's a meaningfully
                  higher bar than a blank checkbox, but it's still the same simulated user typing the numbers in, so
                  it stays <span style={{ color: C.ink, fontWeight: 600 }}>Self-attestation</span>-tier evidence
                  ({EVIDENCE_CONFIDENCE["Self-attestation"]}/100 in the Cyber Assurance model) until a step is backed
                  by a real system instead of a person's entry.
                </span>
              </div>

              <SectionHeading icon={Layers}>Control mapping</SectionHeading>
              <div className="mb-6"><ControlMapping controlIds={selected.controlIds} uncitedControlIds={selected.uncitedControlIds} /></div>

              <SectionHeading icon={Boxes} hint="weakest procedure rating first">
                What this SOP is scoring
              </SectionHeading>
              <div className="text-[11px] mb-2 leading-relaxed" style={{ color: C.muted }}>
                Every assessed control this SOP owns, with the Procedure-level rating it earned.
                A step citing a control by name rates it Fully Compliant; owning the control&apos;s
                domain without a step for it rates Partially. This is where writing a step
                changes a number.
              </div>
              {scoredControls.length === 0 ? (
                <div className="rounded-lg px-3 py-3 text-xs" style={{ border: `1px solid ${C.border}`, color: C.muted }}>
                  No control this SOP owns is inside either system&apos;s assessment scope yet.
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  {scoredControls.map((a, i) => (
                    <div
                      key={`${a.systemId}-${a.controlId}`}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                      style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none", background: i % 2 ? "transparent" : C.panel2 }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {a.controlId} — {a.control.name}
                        </div>
                        <div className="text-[11px]" style={{ color: C.muted }}>{a.systemId} · {a.levels.Procedure.rationale}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold" style={{ color: assuranceColor(a.levels.Procedure.rating) }}>
                          {a.levels.Procedure.rating}
                        </div>
                        <div className="text-[10px]" style={{ color: C.muted }}>control {a.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {wizardOpen && wizardExecution && (
        <SopWizardModal
          procedure={selected}
          execution={wizardExecution}
          onCompleteStep={(stepIndex, payload) => completeStep(selected.id, wizardExecution.id, stepIndex, payload)}
          onStartNew={() => startNewRun(selected.id)}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
