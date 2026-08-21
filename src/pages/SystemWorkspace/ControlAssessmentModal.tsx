import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardCheck, Scale, Wrench } from "lucide-react";
import { C } from "../../theme";
import { addPrismaOverride, COMPLIANCE_LABELS, commitRuntimeFacts } from "../../engine";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { buildLiveEngine } from "../../engine/liveGraph";
import { YAML_FACTS } from "../../graph/sources/yaml";
import Modal, { ModalCloseButton } from "../../components/Modal";
import { RecordAssessmentForm, recordKeyControlAssessment, keyControlAssessmentQueue } from "./recordAssessment";
import type { RecordAssessmentInput } from "./recordAssessment";
import { STATUS_META } from "./controlMeta";
import { fieldLabel, inputStyle } from "./formHelpers";
import type { ControlId, SystemId } from "../../graph/ids";
import type { Control } from "../../graph/nodes/controls";
import type { ComplianceRating } from "../../graph/nodes/taxonomy";
import type { ControlMatrixRow } from "./types";
import type { RuntimeFacts } from "../../engine/liveGraph";

const HOLD_MS = 900;
const ENTER_DELAY_MS = 30;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface JustDecided {
  control: Control;
  label: string;
}

// The candidate evidence already stands (recordKeyControlAssessment already
// ran) — this only holds what's needed to show the attested-vs-derived
// comparison and, if the operator insists on the attested number, write the
// PRISMA override that keeps the disagreement auditable instead of silent.
interface Reconciliation {
  runtime: RuntimeFacts;
  control: Control;
  controlId: ControlId;
  attested: ComplianceRating;
  derived: ComplianceRating;
  rationale: string;
  continueWalk: boolean;
}

interface ControlAssessmentModalProps {
  open: boolean;
  systemId: SystemId;
  onClose: () => void;
  onOpenFullDetail: (controlId: ControlId) => void;
  // When set, the modal drops the domain-grouped walk entirely and edits just
  // this one control — the quick-edit landing page a Controls-tab row click
  // opens, one step short of the full ControlEvaluationPanel.
  controlId?: ControlId | null;
  // Walk mode only: wired up so the completion screen can hand off straight
  // into the Remediation queue when the walk surfaced a Not Implemented call.
  onGoToRemediation?: () => void;
}

// Control Assessment's counterpart to ScopeReviewModal: applicable key
// controls grouped by domain in a left rail (walk mode), one card at a time,
// auto-advancing to the next domain with work left — instead of dropping
// straight into ControlEvaluationPanel's full 5-tab detail view for what
// should be a quick "record a fact" pass. The same card also runs in single-
// control mode (no rail, no walk) as the Controls tab's row-click landing
// page. The detail view stays one click away (onOpenFullDetail) either way,
// for anyone who wants to attach evidence or grade PRISMA lanes instead.
export function ControlAssessmentModal({ open, systemId, onClose, onOpenFullDetail, controlId = null, onGoToRemediation }: ControlAssessmentModalProps) {
  const liveEngine = useLiveEngine();
  const singleMode = controlId != null;
  const matrix = liveEngine.compliance.systemControlMatrix(systemId).map((row) => ({
    ...row,
    responsibility: liveEngine.compliance.responsibilityForControl(systemId, row.controlId),
  }));
  const systemAssets = liveEngine.graph.assetsBySystem[systemId] ?? [];
  const queue = keyControlAssessmentQueue(
    matrix,
    systemAssets,
    (assetId, ctrlId) => liveEngine.applicability.resolveApplicability(assetId, ctrlId).required,
  );

  const remainingByDomain = useMemo(() => {
    const groups: Record<string, ControlMatrixRow[]> = {};
    queue.forEach((row) => { (groups[row.control.domain] ??= []).push(row); });
    return groups;
  }, [queue]);

  const [domainOrder, setDomainOrder] = useState<string[]>([]);
  const [domainTotals, setDomainTotals] = useState<Record<string, number>>({});
  const [activeDomain, setActiveDomain] = useState<string>("");
  const [reviewer, setReviewer] = useState("");
  const [notImplementedCount, setNotImplementedCount] = useState(0);
  const [justDecided, setJustDecided] = useState<JustDecided | null>(null);
  const [entering, setEntering] = useState(false);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [initialTotal, setInitialTotal] = useState(0);
  const [reconciling, setReconciling] = useState<Reconciliation | null>(null);
  const [overrideAssessor, setOverrideAssessor] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const timersRef = useRef<number[]>([]);

  function clearTimers() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }

  // Reset to a clean slate every time the modal opens, snapshotting the
  // starting queue and its domain breakdown — the rail's totals and order
  // stay fixed for the session even as items leave "remaining" one by one.
  useEffect(() => {
    if (!open) return;
    clearTimers();
    setJustDecided(null);
    setEntering(false);
    setSaveError(null);
    setReviewer("");
    setNotImplementedCount(0);
    setReconciling(null);
    setOverrideAssessor("");
    setOverrideNote("");
    if (!singleMode) {
      const totals: Record<string, number> = {};
      queue.forEach((row) => { totals[row.control.domain] = (totals[row.control.domain] ?? 0) + 1; });
      const order = Object.keys(totals).sort();
      setDomainTotals(totals);
      setDomainOrder(order);
      setInitialTotal(queue.length);
      setActiveDomain(order[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, singleMode]);

  useEffect(() => () => clearTimers(), []);

  // Once the active domain empties, move on to the next domain with work
  // left, mirroring ScopeReviewModal's wave advance.
  useEffect(() => {
    if (!open || singleMode || justDecided) return;
    const remaining = remainingByDomain[activeDomain]?.length ?? 0;
    if (remaining > 0) return;
    const idx = domainOrder.indexOf(activeDomain);
    const next = domainOrder.slice(idx + 1).find((d) => (remainingByDomain[d]?.length ?? 0) > 0);
    if (next) setActiveDomain(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, singleMode, justDecided, activeDomain, remainingByDomain, domainOrder]);

  if (!open) return null;

  const singleRow = singleMode ? matrix.find((r) => r.controlId === controlId) ?? null : null;
  const domainQueue = singleMode ? [] : (remainingByDomain[activeDomain] ?? []);
  const current = singleMode ? singleRow : (domainQueue[0] ?? null);

  const decidedCount = Math.max(0, initialTotal - queue.length);
  const complete = !singleMode && current === null;
  const canWrite = singleMode || reviewer.trim().length > 0;
  const isProgramScoped = current?.keyControl?.scope === "program";
  const recordAssetOptions = current
    ? systemAssets
      .filter((asset) => liveEngine.applicability.resolveApplicability(asset.id, current.controlId).required)
      .map((asset) => ({ assetId: asset.id, label: asset.name }))
    : [];

  // Commits whatever runtime is handed to it (evidence alone, or evidence
  // plus an override) — the one place that actually calls commitRuntimeFacts
  // for a decision, whether that decision came straight through or by way of
  // the reconciliation prompt below.
  function finalizeCommit(runtime: RuntimeFacts, control: Control, rating: ComplianceRating, continueWalk: boolean) {
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setSaveError(problems);
      return;
    }
    if (rating === 0) setNotImplementedCount((n) => n + 1);
    setReconciling(null);
    setOverrideNote("");
    if (!continueWalk) {
      onClose();
      return;
    }
    setJustDecided({ control, label: `Attested ${rating} — ${COMPLIANCE_LABELS[rating]}` });
    const t1 = window.setTimeout(() => {
      setJustDecided(null);
      setEntering(true);
      const t2 = window.setTimeout(() => setEntering(false), ENTER_DELAY_MS);
      timersRef.current.push(t2);
    }, HOLD_MS);
    timersRef.current.push(t1);
  }

  function handleSubmit(input: RecordAssessmentInput, continueWalk: boolean) {
    if (!current) return;
    setSaveError(null);
    let runtime: RuntimeFacts;
    try {
      runtime = recordKeyControlAssessment(loadRuntimeFacts(), {
        systemId,
        controlId: current.controlId,
        isProgramScoped: Boolean(isProgramScoped),
        recordAssetOptions,
        input,
        reviewer,
      });
    } catch (e) {
      setSaveError([e instanceof Error ? e.message : String(e)]);
      return;
    }

    // Not Implemented has no "derived" evidence quality to reconcile against —
    // it's a reason, not a claim evidence can under- or over-support.
    if (input.rating > 0) {
      const preview = buildLiveEngine(YAML_FACTS, runtime);
      const implementedLevel = preview.engine?.assessment.assessmentFor(systemId, current.controlId)?.levels.Implemented;
      if (implementedLevel && implementedLevel.derived !== input.rating) {
        setOverrideAssessor(reviewer);
        setReconciling({
          runtime, control: current.control, controlId: current.controlId,
          attested: input.rating, derived: implementedLevel.derived,
          rationale: implementedLevel.rationale, continueWalk,
        });
        return;
      }
    }

    finalizeCommit(runtime, current.control, input.rating, continueWalk);
  }

  function acceptDerivedRating() {
    if (!reconciling) return;
    finalizeCommit(reconciling.runtime, reconciling.control, reconciling.derived, reconciling.continueWalk);
  }

  function keepAttestedWithOverride() {
    if (!reconciling || !overrideAssessor.trim() || !overrideNote.trim()) return;
    setSaveError(null);
    let overridden: RuntimeFacts;
    try {
      overridden = addPrismaOverride(reconciling.runtime, {
        systemId, controlId: reconciling.controlId, level: "Implemented",
        rating: reconciling.attested,
        note: overrideNote.trim(),
        assessedBy: overrideAssessor.trim(),
        assessedAt: today(),
      });
    } catch (e) {
      setSaveError([e instanceof Error ? e.message : String(e)]);
      return;
    }
    finalizeCommit(overridden, reconciling.control, reconciling.attested, reconciling.continueWalk);
  }

  const displayControl: Control | null = justDecided ? justDecided.control : reconciling ? reconciling.control : current?.control ?? null;
  const displayStatus = !singleMode || !current ? null : STATUS_META[current.status];

  return (
    <Modal open={open} onClose={onClose} width={1080} height={720}>
      <div className="flex items-start justify-between px-7 py-5 gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex gap-3 items-start min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: C.accentBg, color: C.accent }}>
            <ClipboardCheck size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
              {singleMode ? "Record Assessment" : "Control Assessment"}
            </div>
            <div className="text-xs mt-0.5 max-w-md leading-relaxed" style={{ color: C.muted }}>
              {singleMode
                ? "Record a fact for this control on this boundary. Scores are derived from what you record here."
                : "Record a fact for each key control still unassessed on this boundary. Scores are derived from what you record here."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {!singleMode && (
            <div className="text-right">
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: C.muted }}>Assessed</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: C.ink }}>{decidedCount} of {initialTotal}</div>
            </div>
          )}
          <ModalCloseButton onClose={onClose} />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: singleMode ? "1fr" : "236px 1fr" }}>
        {!singleMode && (
          <nav className="p-2.5 overflow-y-auto" style={{ background: C.panel2, borderRight: `1px solid ${C.border}` }}>
            {domainOrder.map((domain) => {
              const remaining = remainingByDomain[domain]?.length ?? 0;
              const total = domainTotals[domain] ?? 0;
              const decided = total - remaining;
              const isDone = remaining === 0;
              const isActive = domain === activeDomain && !isDone;
              const state = isDone ? "done" : isActive ? "active" : "pending";
              const bg = state === "done" ? C.greenBg : state === "active" ? C.accentBg : "transparent";
              const iconBg = state === "done" ? C.green : state === "active" ? C.accent : C.border;
              const iconColor = state === "pending" ? C.muted : "#fff";
              const textColor = state === "done" ? C.green : state === "active" ? C.accent : C.ink;
              const subColor = state === "done" ? C.green : state === "active" ? C.accent : C.muted;
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => { if (!justDecided && remaining > 0) setActiveDomain(domain); }}
                  className="w-full rounded-lg px-3 py-2.5 mb-1 flex items-center gap-2.5 text-left"
                  style={{ background: bg, boxShadow: state === "active" ? `inset 3px 0 0 ${C.accent}` : "none", cursor: remaining > 0 ? "pointer" : "default" }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
                    {isDone ? <Check size={13} /> : <ClipboardCheck size={13} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold truncate" style={{ color: textColor }}>{domain}</div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: subColor, fontWeight: state === "pending" ? 400 : 600 }}>
                      {isDone ? `${decided} of ${total} decided` : `${remaining} of ${total} remaining`}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        )}

        <div className="px-9 py-7 flex flex-col min-w-0">
          {saveError && (
            <div className="rounded-lg p-3 mb-4 text-[11px]" style={{ background: C.redBg, color: C.red }}>
              {saveError.join(" ")}
            </div>
          )}

          {complete && !justDecided ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: C.greenBg, color: C.green }}>
                <Check size={26} />
              </div>
              <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Control assessment complete</div>
              <div className="text-[13px] mt-2 max-w-md leading-relaxed" style={{ color: C.muted }}>
                Every applicable key control on this boundary now has a recorded fact behind its score.
              </div>

              {domainOrder.length > 0 && (
                <div
                  className="grid gap-2.5 mt-7 w-full max-w-2xl"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
                >
                  {domainOrder.map((domain) => (
                    <div key={domain} className="rounded-xl p-3.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{domainTotals[domain]}</div>
                      <div className="text-[10px] mt-1 leading-tight truncate" style={{ color: C.muted }}>{domain}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-6 text-[11px]" style={{ color: C.muted }}>
                Reviewed by <b style={{ color: C.ink }}>{reviewer.trim() || "unnamed reviewer"}</b> &middot; completed {today()}
              </div>

              <div className="flex items-center gap-3 mt-6">
                {notImplementedCount > 0 && onGoToRemediation ? (
                  <button
                    type="button"
                    onClick={() => { onClose(); onGoToRemediation(); }}
                    className="flex items-center gap-2 text-sm font-semibold rounded-xl px-5 py-3"
                    style={{ background: C.accent, color: "#fff" }}
                  >
                    <Wrench size={15} /> Go to Remediation &middot; {notImplementedCount} control{notImplementedCount === 1 ? "" : "s"} <ArrowRight size={15} />
                  </button>
                ) : (
                  <button type="button" onClick={onClose} className="text-sm font-semibold rounded-xl px-5 py-3" style={{ background: C.accent, color: "#fff" }}>
                    Close
                  </button>
                )}
                {notImplementedCount > 0 && onGoToRemediation && (
                  <button type="button" onClick={onClose} className="text-sm font-semibold px-4 py-3" style={{ color: C.muted }}>
                    Close for now
                  </button>
                )}
              </div>
            </div>
          ) : displayControl ? (
            <>
              {!singleMode && (
                <>
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: C.muted }}>
                      {activeDomain} &middot; {domainQueue.length} left
                    </div>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden mb-6" style={{ background: C.border }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: C.accent,
                        width: `${initialTotal ? Math.round((decidedCount / initialTotal) * 100) : 0}%`,
                        transition: "width 320ms ease",
                      }}
                    />
                  </div>
                </>
              )}

              <div className="flex-1 flex items-center justify-center">
                <div
                  className="rounded-2xl w-full max-w-xl p-9"
                  style={{
                    background: C.panel, border: `1px solid ${justDecided ? C.green : C.border}`,
                    boxShadow: justDecided ? `0 0 0 4px ${C.greenBg}` : "0 10px 30px rgba(0,0,0,0.08)",
                    opacity: entering ? 0 : 1,
                    transform: entering ? "translateX(46px)" : "translateX(0)",
                    transition: "border-color 180ms ease, box-shadow 180ms ease, transform 340ms cubic-bezier(.2,.7,.3,1), opacity 320ms ease",
                  }}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {displayControl.id}
                    <span className="w-1 h-1 rounded-full" style={{ background: C.border }} />
                    <span style={{ color: C.muted, textTransform: "none", letterSpacing: 0, fontFamily: "'Inter', sans-serif" }}>{displayControl.domain}</span>
                    {displayStatus && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded ml-1" style={{ background: displayStatus.bg, color: displayStatus.color, textTransform: "none", letterSpacing: 0 }}>
                        <displayStatus.Icon size={10} /> {displayStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl mt-2.5 mb-3.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600, lineHeight: 1.3 }}>
                    {displayControl.name}
                  </div>
                  <div className="text-[14px] leading-relaxed" style={{ color: C.ink }}>{displayControl.description}</div>

                  {justDecided ? (
                    <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.green, color: "#fff" }}>
                          <Check size={16} strokeWidth={3} />
                        </div>
                        <div className="text-lg font-bold" style={{ color: C.green }}>{justDecided.label}</div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] mt-1.5 ml-11" style={{ color: C.muted }}>
                        <ArrowRight size={11} /> Advancing to the next control&hellip;
                      </div>
                    </div>
                  ) : reconciling ? (
                    <div className="mt-6">
                      <div className="rounded-lg p-4" style={{ background: C.amberBg, border: `1px solid ${C.amber}55` }}>
                        <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: C.ink }}>
                          <Scale size={15} color={C.amber} />
                          You attested {reconciling.attested} — {COMPLIANCE_LABELS[reconciling.attested]}
                        </div>
                        <div className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: C.ink }}>
                          This evidence supports <b>{reconciling.derived} — {COMPLIANCE_LABELS[reconciling.derived]}</b>: {reconciling.rationale}
                        </div>
                        <button
                          type="button"
                          onClick={acceptDerivedRating}
                          className="text-xs font-semibold rounded-lg px-3 py-1.5 mt-3"
                          style={{ background: C.ink, color: C.bg }}
                        >
                          Use {reconciling.derived} instead
                        </button>
                      </div>

                      <div className="rounded-lg p-4 mt-3" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                        <div className="text-[11.5px] font-semibold" style={{ color: C.ink }}>
                          Keep {reconciling.attested} anyway
                        </div>
                        <div className="text-[10.5px] mt-1 mb-2.5 leading-snug" style={{ color: C.muted }}>
                          Your professional judgment overrides the derived rating — the disagreement stays visible, not silently resolved. Requires your name and why.
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>{fieldLabel("Assessor")}
                            <input style={inputStyle()} value={overrideAssessor} onChange={(e) => setOverrideAssessor(e.target.value)} placeholder="Your name" />
                          </div>
                          <div>{fieldLabel("Why")}
                            <input style={inputStyle()} value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder={`Why ${reconciling.attested} is right despite this evidence`} />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!overrideAssessor.trim() || !overrideNote.trim()}
                          onClick={keepAttestedWithOverride}
                          className="text-xs font-semibold rounded-lg px-3 py-1.5 mt-3"
                          style={{
                            background: overrideAssessor.trim() && overrideNote.trim() ? C.accent : C.border,
                            color: "#fff",
                          }}
                        >
                          Keep {reconciling.attested} — {COMPLIANCE_LABELS[reconciling.attested]}
                        </button>
                      </div>
                    </div>
                  ) : current ? (
                    <div className="mt-6">
                      <RecordAssessmentForm
                        key={current.controlId}
                        assetOptions={recordAssetOptions}
                        isProgramScoped={Boolean(isProgramScoped)}
                        canContinue
                        showContinue={!singleMode}
                        disabled={!canWrite}
                        continueLabel={singleMode ? "Save assessment" : queue.length === 1 ? "Save and finish" : "Save and continue"}
                        onSubmit={handleSubmit}
                      />
                      <button
                        type="button"
                        onClick={() => onOpenFullDetail(current.controlId)}
                        className="text-[11px] font-semibold mt-3"
                        style={{ color: C.accent }}
                      >
                        Open full detail instead
                      </button>

                      {!singleMode && (
                        <div className="flex items-center gap-2.5 mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                          <span className="text-[10.5px]" style={{ color: C.muted }}>Reviewer</span>
                          <input
                            value={reviewer}
                            onChange={(e) => setReviewer(e.target.value)}
                            className="rounded-lg px-2.5 py-1.5 text-[12px]"
                            style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.ink, width: 200 }}
                            placeholder="Assessor of record"
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
