import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardCheck } from "lucide-react";
import { C } from "../../theme";
import { commitRuntimeFacts } from "../../engine";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import Modal, { ModalCloseButton } from "../../components/Modal";
import { RecordAssessmentForm, recordKeyControlAssessment, keyControlAssessmentQueue } from "./recordAssessment";
import type { RecordAssessmentInput, RecordDecision } from "./recordAssessment";
import type { ControlId, SystemId } from "../../graph/ids";
import type { Control } from "../../graph/nodes/controls";
import type { RuntimeFacts } from "../../engine/liveGraph";

const HOLD_MS = 900;
const ENTER_DELAY_MS = 30;

const DECISION_LABELS: Record<RecordDecision, string> = {
  holds: "Marked Holds",
  partial: "Marked Partial",
  "not-implemented": "Marked Not Implemented",
};

interface JustDecided {
  control: Control;
  label: string;
}

interface ControlAssessmentModalProps {
  open: boolean;
  systemId: SystemId;
  onClose: () => void;
  onOpenFullDetail: (controlId: ControlId) => void;
}

// Control Assessment's counterpart to ScopeReviewModal: one applicable key
// control per card, one decision, auto-advance to the next — instead of
// dropping straight into ControlEvaluationPanel's full 5-tab detail view for
// what should be a quick "record a fact" pass. The detail view stays one
// click away (onOpenFullDetail) for anyone who wants to attach evidence or
// grade PRISMA lanes instead of taking the fast path.
export function ControlAssessmentModal({ open, systemId, onClose, onOpenFullDetail }: ControlAssessmentModalProps) {
  const liveEngine = useLiveEngine();
  const matrix = liveEngine.compliance.systemControlMatrix(systemId).map((row) => ({
    ...row,
    responsibility: liveEngine.compliance.responsibilityForControl(systemId, row.controlId),
  }));
  const systemAssets = liveEngine.graph.assetsBySystem[systemId] ?? [];
  const queue = keyControlAssessmentQueue(
    matrix,
    systemAssets,
    (assetId, controlId) => liveEngine.applicability.resolveApplicability(assetId, controlId).required,
  );
  const current = queue[0] ?? null;

  const [justDecided, setJustDecided] = useState<JustDecided | null>(null);
  const [entering, setEntering] = useState(false);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [initialTotal, setInitialTotal] = useState(0);
  const timersRef = useRef<number[]>([]);

  function clearTimers() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }

  // Reset to a clean slate every time the modal opens, and snapshot the
  // starting queue size — the queue itself only shrinks as controls get
  // assessed and leave "unassessed" for good, so decided count is just the
  // difference from that snapshot rather than something tracked separately.
  useEffect(() => {
    if (!open) return;
    clearTimers();
    setJustDecided(null);
    setEntering(false);
    setSaveError(null);
    setInitialTotal(queue.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => clearTimers(), []);

  if (!open) return null;

  const decidedCount = Math.max(0, initialTotal - queue.length);
  const complete = current === null;
  const isProgramScoped = current?.keyControl?.scope === "program";
  const recordAssetOptions = current
    ? systemAssets
      .filter((asset) => liveEngine.applicability.resolveApplicability(asset.id, current.controlId).required)
      .map((asset) => ({ assetId: asset.id, label: asset.name }))
    : [];

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
      });
    } catch (e) {
      setSaveError([e instanceof Error ? e.message : String(e)]);
      return;
    }
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setSaveError(problems);
      return;
    }
    if (!continueWalk) {
      onClose();
      return;
    }
    setJustDecided({ control: current.control, label: DECISION_LABELS[input.decision] });
    const t1 = window.setTimeout(() => {
      setJustDecided(null);
      setEntering(true);
      const t2 = window.setTimeout(() => setEntering(false), ENTER_DELAY_MS);
      timersRef.current.push(t2);
    }, HOLD_MS);
    timersRef.current.push(t1);
  }

  const displayControl: Control | null = justDecided ? justDecided.control : current?.control ?? null;

  return (
    <Modal open={open} onClose={onClose} width={1080} height={720}>
      <div className="flex items-start justify-between px-7 py-5 gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex gap-3 items-start min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: C.accentBg, color: C.accent }}>
            <ClipboardCheck size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Control Assessment</div>
            <div className="text-xs mt-0.5 max-w-md leading-relaxed" style={{ color: C.muted }}>
              Record a fact for each key control still unassessed on this boundary. Scores are derived from what you record here.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-[9.5px] uppercase tracking-wide" style={{ color: C.muted }}>Assessed</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: C.ink }}>{decidedCount} of {initialTotal}</div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-9 py-7">
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
            <button type="button" onClick={onClose} className="text-sm font-semibold rounded-xl px-5 py-3 mt-6" style={{ background: C.accent, color: "#fff" }}>
              Close
            </button>
          </div>
        ) : displayControl ? (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: C.muted }}>
                Key Controls &middot; {queue.length} left
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
                ) : current ? (
                  <div className="mt-6">
                    <RecordAssessmentForm
                      assetOptions={recordAssetOptions}
                      isProgramScoped={Boolean(isProgramScoped)}
                      canContinue
                      continueLabel={queue.length === 1 ? "Save and finish" : "Save and continue"}
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
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
