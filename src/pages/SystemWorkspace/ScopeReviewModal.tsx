import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Ban, Check } from "lucide-react";
import { C } from "../../theme";
import { commitRuntimeFacts, RESPONSIBILITIES } from "../../engine";
import { upsertControlReview } from "../../engine/runtimeMutations";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { APPLICABILITY_META, RESPONSIBILITY_META } from "./controlMeta";
import Modal, { ModalCloseButton } from "../../components/Modal";
import type { ReviewWave, ReviewWaveControl } from "../../engine/review";
import type { ControlId, SystemId } from "../../graph/ids";
import type { Control } from "../../graph/nodes/controls";

// The three buckets an operator actually decides card-by-card. "Remaining
// technical" is not walked here — once these three are clear, this modal
// hands off to the existing key-control grading queue (ControlEvaluationPanel)
// rather than reinventing a second walk for it.
const SCOPE_WAVES: ReviewWave[] = ["not-applicable", "vendor-inherited", "enterprise"];

const WAVE_COPY: Record<ReviewWave, { label: string; hint: string; confirmAction?: string; confirmSub?: string; confirmedLabel?: string }> = {
  "not-applicable": { label: "Not Applicable", hint: "Confirm derived exclusions, or pull a control back into scope." },
  "vendor-inherited": {
    label: "External Inherited", hint: "Confirm the provider actually runs this control for this boundary.",
    confirmAction: "Confirm External Inherited", confirmSub: "The provider runs this control for us",
    confirmedLabel: "Confirmed External Inherited",
  },
  enterprise: {
    label: "Internal Inherited", hint: "Confirm this system is covered by ACME's central program or process.",
    confirmAction: "Confirm Internal Inherited", confirmSub: "ACME's central program covers this control",
    confirmedLabel: "Confirmed Internal Inherited",
  },
  "system-owned": { label: "Remaining Technical", hint: "Grade the controls ACME still has to evidence on this boundary." },
};

const BUCKET_META: Record<ReviewWave, { Icon: typeof Ban; color: string; bg: string }> = {
  "not-applicable": APPLICABILITY_META["not-applicable"],
  "vendor-inherited": RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR],
  enterprise: RESPONSIBILITY_META[RESPONSIBILITIES.ENTERPRISE],
  "system-owned": RESPONSIBILITY_META[RESPONSIBILITIES.INTERNAL],
};

const HOLD_MS = 900;
const ENTER_DELAY_MS = 30;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface JustDecided {
  control: Control;
  label: string;
}

interface ScopeReviewModalProps {
  open: boolean;
  systemId: SystemId;
  assessor: string;
  onClose: () => void;
  onStartTechnicalReview: () => void;
  initialWave?: ReviewWave | null;
}

export function ScopeReviewModal({ open, systemId, assessor, onClose, onStartTechnicalReview, initialWave = null }: ScopeReviewModalProps) {
  const liveEngine = useLiveEngine();
  const walk = liveEngine.review.wavesForSystem(systemId);
  const [wave, setWave] = useState<ReviewWave>(initialWave ?? SCOPE_WAVES[0]);
  const [reviewer, setReviewer] = useState(assessor);
  const [rejectingId, setRejectingId] = useState<ControlId | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [justDecided, setJustDecided] = useState<JustDecided | null>(null);
  const [entering, setEntering] = useState(false);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const timersRef = useRef<number[]>([]);

  function clearTimers() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }

  // Reset to a clean slate every time the modal opens, landed on whichever
  // scope wave still has work (or the requested one, if the Controls tab
  // asked for a specific bucket).
  useEffect(() => {
    if (!open) return;
    clearTimers();
    setJustDecided(null);
    setEntering(false);
    setRejectingId(null);
    setRejectNote("");
    setSaveError(null);
    const target = initialWave && SCOPE_WAVES.includes(initialWave) ? initialWave : null;
    setWave(target ?? SCOPE_WAVES.find((w) => walk.waves[w].remaining.length > 0) ?? SCOPE_WAVES[SCOPE_WAVES.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => clearTimers(), []);

  const current = walk.waves[wave];
  const remainingCount = current.remaining.length;

  // Once the active wave is empty (and we're not still celebrating its last
  // card), move on to the next scope wave with work left.
  useEffect(() => {
    if (!open || justDecided || remainingCount > 0) return;
    const nextWave = SCOPE_WAVES.slice(SCOPE_WAVES.indexOf(wave) + 1).find((w) => walk.waves[w].remaining.length > 0);
    if (nextWave) setWave(nextWave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, justDecided, remainingCount, wave, walk]);

  const scopeComplete = SCOPE_WAVES.every((w) => walk.waves[w].remaining.length === 0);
  const technicalRemaining = walk.waves["system-owned"].remaining.length;
  const scopeTotal = SCOPE_WAVES.reduce((sum, w) => sum + walk.waves[w].total, 0);
  const scopeDecided = SCOPE_WAVES.reduce((sum, w) => sum + walk.waves[w].decidedItems.length, 0);

  const canWrite = reviewer.trim().length > 0;
  const bucketMeta = BUCKET_META[wave];
  const waveCopy = WAVE_COPY[wave];
  const SystemOwnedIcon = BUCKET_META["system-owned"].Icon;

  function saveOne(control: Control, stance: "confirm" | "reject", note: string): boolean {
    setSaveError(null);
    const runtime = upsertControlReview(loadRuntimeFacts(), {
      systemId,
      controlId: control.id,
      bucket: wave,
      stance,
      note,
      reviewedBy: reviewer.trim(),
      reviewedAt: today(),
    });
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setSaveError(problems);
      return false;
    }
    return true;
  }

  function decide(control: Control, stance: "confirm" | "reject", note: string, label: string) {
    if (!saveOne(control, stance, note)) return;
    setRejectingId(null);
    setRejectNote("");
    setJustDecided({ control, label });
    const t1 = window.setTimeout(() => {
      setJustDecided(null);
      setEntering(true);
      const t2 = window.setTimeout(() => setEntering(false), ENTER_DELAY_MS);
      timersRef.current.push(t2);
    }, HOLD_MS);
    timersRef.current.push(t1);
  }

  function destinationLabel(controlId: ControlId): string {
    const destination = walk.proposedBucket(controlId);
    if (destination === wave) return "This control is independently required there, so rejecting will not move it.";
    return `Rejecting moves this control to ${WAVE_COPY[destination as ReviewWave].label} for review.`;
  }

  if (!open) return null;

  const displayItem: ReviewWaveControl | null = justDecided
    ? { control: justDecided.control, reason: "", responsibility: null, review: null, proposed: true }
    : current.remaining[0] ?? null;

  return (
    <Modal open={open} onClose={onClose} width={1080} height={720}>
      <div className="flex items-start justify-between px-7 py-5 gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex gap-3 items-start min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: C.accentBg, color: C.accent }}>
            <Check size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Scope Review</div>
            <div className="text-xs mt-0.5 max-w-md leading-relaxed" style={{ color: C.muted }}>
              Confirm which controls apply to this boundary before technical review begins. Every decision is recorded with who made it and when.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-[9.5px] uppercase tracking-wide" style={{ color: C.muted }}>Scope Decided</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: C.ink }}>{scopeDecided} of {scopeTotal}</div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "236px 1fr" }}>
        <nav className="p-2.5 overflow-y-auto" style={{ background: C.panel2, borderRight: `1px solid ${C.border}` }}>
          {SCOPE_WAVES.map((w) => {
            const meta = BUCKET_META[w];
            const projection = walk.waves[w];
            const isDone = projection.remaining.length === 0;
            const isActive = w === wave && !isDone;
            const state = isDone ? "done" : isActive ? "active" : "pending";
            const bg = state === "done" ? C.greenBg : state === "active" ? C.accentBg : "transparent";
            const iconBg = state === "done" ? C.green : state === "active" ? C.accent : C.border;
            const iconColor = state === "pending" ? C.muted : "#fff";
            const textColor = state === "done" ? C.green : state === "active" ? C.accent : C.ink;
            const subColor = state === "done" ? C.green : state === "active" ? C.accent : C.muted;
            return (
              <button
                key={w}
                type="button"
                onClick={() => { if (!justDecided) setWave(w); }}
                className="w-full rounded-lg px-3 py-2.5 mb-1 flex items-center gap-2.5 text-left"
                style={{ background: bg, boxShadow: state === "active" ? `inset 3px 0 0 ${C.accent}` : "none" }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
                  {isDone ? <Check size={13} /> : <meta.Icon size={13} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold" style={{ color: textColor }}>{WAVE_COPY[w].label}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: subColor, fontWeight: state === "pending" ? 400 : 600 }}>
                    {isDone ? `${projection.decidedItems.length} of ${projection.total} decided` : `${projection.remaining.length} of ${projection.total} remaining`}
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => { if (scopeComplete) { onClose(); onStartTechnicalReview(); } }}
            className="w-full rounded-lg px-3 py-2.5 mb-1 flex items-center gap-2.5 text-left"
            style={{ background: scopeComplete ? C.accentBg : "transparent", cursor: scopeComplete ? "pointer" : "default" }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: scopeComplete ? C.accent : C.border, color: scopeComplete ? "#fff" : C.muted }}>
              <SystemOwnedIcon size={13} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold" style={{ color: scopeComplete ? C.accent : C.ink }}>Remaining Technical</div>
              <div className="text-[10.5px] mt-0.5" style={{ color: scopeComplete ? C.accent : C.muted, fontWeight: scopeComplete ? 600 : 400 }}>
                {scopeComplete ? `${technicalRemaining} queued for grading` : `Not started · ${walk.waves["system-owned"].total}`}
              </div>
            </div>
          </button>
        </nav>

        <div className="px-9 py-7 flex flex-col min-w-0">
          {saveError && (
            <div className="rounded-lg p-3 mb-4 text-[11px]" style={{ background: C.redBg, color: C.red }}>
              {saveError.join(" ")}
            </div>
          )}

          {scopeComplete && !justDecided ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: C.greenBg, color: C.green }}>
                <Check size={26} />
              </div>
              <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Scope confirmed</div>
              <div className="text-[13px] mt-2 max-w-md leading-relaxed" style={{ color: C.muted }}>
                Every derived call for this system has been confirmed or overridden by a named reviewer. This is the record an auditor will ask for.
              </div>

              <div className="grid grid-cols-4 gap-2.5 mt-7 w-full max-w-xl">
                {SCOPE_WAVES.map((w) => (
                  <div key={w} className="rounded-xl p-3.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                    <div className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{walk.waves[w].total}</div>
                    <div className="text-[10px] mt-1 leading-tight" style={{ color: C.muted }}>{WAVE_COPY[w].label}</div>
                  </div>
                ))}
                <div className="rounded-xl p-3.5" style={{ background: C.accentBg, border: `1px solid ${C.accent}55` }}>
                  <div className="text-xl font-semibold" style={{ color: C.accent, fontFamily: "'Source Serif 4', serif" }}>{technicalRemaining}</div>
                  <div className="text-[10px] mt-1 leading-tight" style={{ color: C.accent }}>Remaining Technical</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-6 text-[11px]" style={{ color: C.muted }}>
                Reviewed by <b style={{ color: C.ink }}>{reviewer.trim() || assessor}</b> &middot; completed {today()}
              </div>

              <div className="flex items-center gap-3 mt-6">
                {technicalRemaining > 0 ? (
                  <button
                    type="button"
                    onClick={() => { onClose(); onStartTechnicalReview(); }}
                    className="flex items-center gap-2 text-sm font-semibold rounded-xl px-5 py-3"
                    style={{ background: C.accent, color: "#fff" }}
                  >
                    Begin Technical Review &middot; {technicalRemaining} controls <ArrowRight size={15} />
                  </button>
                ) : null}
                <button type="button" onClick={onClose} className="text-sm font-semibold px-4 py-3" style={{ color: C.muted }}>
                  Close for now
                </button>
              </div>
            </div>
          ) : displayItem ? (
            <>
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: C.muted }}>
                  {waveCopy.label} &middot; {remainingCount} left
                </div>
              </div>
              <div className="h-1 rounded-full overflow-hidden mb-6" style={{ background: C.border }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: C.accent,
                    width: `${current.total ? Math.round((current.decidedItems.length / current.total) * 100) : 0}%`,
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
                    {displayItem.control.id}
                    <span className="w-1 h-1 rounded-full" style={{ background: C.border }} />
                    <span style={{ color: C.muted, textTransform: "none", letterSpacing: 0, fontFamily: "'Inter', sans-serif" }}>{displayItem.control.domain}</span>
                  </div>
                  <div className="text-2xl mt-2.5 mb-3.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600, lineHeight: 1.3 }}>
                    {displayItem.control.name}
                  </div>
                  <div className="text-[14px] leading-relaxed" style={{ color: C.ink }}>{displayItem.control.description}</div>

                  {!justDecided && (
                    <div className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: bucketMeta.bg, color: bucketMeta.color }}>
                      <bucketMeta.Icon size={12} />
                      {displayItem.reason}
                    </div>
                  )}

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
                  ) : wave === "not-applicable" ? (
                    <div className="flex gap-3 mt-6">
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => decide(displayItem.control, "confirm", displayItem.reason, "Marked Not Applicable")}
                        className="flex-1 rounded-xl px-4 py-4 text-left"
                        style={{ background: C.ink, color: C.bg, opacity: canWrite ? 1 : 0.5 }}
                      >
                        <div className="flex items-center gap-2 text-[15px] font-bold"><Ban size={16} /> Not Applicable</div>
                        <div className="text-[11px] mt-1 opacity-70">Confirm the derived exclusion</div>
                      </button>
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => decide(displayItem.control, "reject", "Marked applicable during scope review.", "Marked Applicable")}
                        className="flex-1 rounded-xl px-4 py-4 text-left"
                        style={{ background: "transparent", color: C.accent, border: `1.5px solid ${C.accent}55`, opacity: canWrite ? 1 : 0.5 }}
                      >
                        <div className="flex items-center gap-2 text-[15px] font-bold"><ArrowRight size={16} /> Mark Applicable</div>
                        <div className="text-[11px] mt-1 opacity-70">Pull this control back into scope</div>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3 mt-6">
                        <button
                          type="button"
                          disabled={!canWrite}
                          onClick={() => decide(displayItem.control, "confirm", displayItem.reason, waveCopy.confirmedLabel ?? "Confirmed")}
                          className="flex-1 rounded-xl px-4 py-4 text-left"
                          style={{ background: C.panel2, color: C.muted, opacity: canWrite ? 1 : 0.5 }}
                        >
                          <div className="flex items-center gap-2 text-[14.5px] font-bold" style={{ color: C.ink }}><Check size={16} /> {waveCopy.confirmAction}</div>
                          <div className="text-[11px] mt-1">{waveCopy.confirmSub}</div>
                        </button>
                        <button
                          type="button"
                          disabled={!canWrite}
                          onClick={() => setRejectingId(displayItem.control.id)}
                          className="flex-1 rounded-xl px-4 py-4 text-left"
                          style={{ background: C.red, color: "#fff", opacity: canWrite ? 1 : 0.5 }}
                        >
                          <div className="flex items-center gap-2 text-[14.5px] font-bold"><Ban size={16} /> Reject</div>
                          <div className="text-[11px] mt-1 opacity-80">Bring it back into ACME's scope</div>
                        </button>
                      </div>

                      {rejectingId === displayItem.control.id && (
                        <div className="rounded-xl p-4 mt-3.5" style={{ background: C.accentBg }}>
                          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold mb-2.5" style={{ color: C.accent }}>
                            <ArrowRight size={13} /> {destinationLabel(displayItem.control.id)}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="Why doesn't the derived call hold on this boundary?"
                              className="flex-1 rounded-lg px-3 py-2.5 text-[12.5px]"
                              style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}
                            />
                            <button
                              type="button"
                              disabled={!rejectNote.trim()}
                              onClick={() => decide(displayItem.control, "reject", rejectNote.trim(), "Rejected — Moved to " + WAVE_COPY[walk.proposedBucket(displayItem.control.id) as ReviewWave].label)}
                              className="rounded-lg px-4 py-2.5 text-[12.5px] font-bold whitespace-nowrap"
                              style={{ background: rejectNote.trim() ? C.accent : C.border, color: "#fff" }}
                            >
                              Save &amp; Continue
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!justDecided && !(rejectingId === displayItem.control.id) && (
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
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
