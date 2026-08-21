import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Ban, Check, ListChecks, Target } from "lucide-react";
import { C } from "../../theme";
import { commitRuntimeFacts, RESPONSIBILITIES } from "../../engine";
import { upsertControlReview } from "../../engine/runtimeMutations";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { APPLICABILITY_META, RESPONSIBILITY_META } from "./controlMeta";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  ActionCard, Button, Callout, CompletionScreen, Field, HeaderStat, InlineField, InlineHint, ProgressBar,
  RailGroup, RailItem, SaveErrorCallout, SearchInput, Section, StatTile, StatusPill, TextInput, TX, Well,
  WizardBanner, WizardBody, WizardChrome, WizardFooter, WizardHeader, WizardRail, WZ,
} from "../../components/wizard/WizardUI";
import type { Tone } from "../../components/wizard/WizardUI";
import type { ReviewWave, ReviewWaveControl } from "../../engine/review";
import type { ControlId, SystemId } from "../../graph/ids";
import type { Control } from "../../graph/nodes/controls";

// One row of the All Controls browser: every control the catalog defines
// against this system, whether it currently applies or was excluded (by rule
// or by a prior override), so an operator can find and flip any single one —
// not just the ones a derived wave already surfaced as needing a decision.
interface AllControlsRow {
  control: Control;
  inScope: boolean;
  reason: string | null;
}

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

// Each bucket's existing app color, expressed in the wizard kit's tone
// vocabulary so the pill on the decision card is the same component every
// other status in every wizard uses.
const BUCKET_TONE: Record<ReviewWave, Tone> = {
  "not-applicable": "neutral",
  "vendor-inherited": "info",
  enterprise: "success",
  "system-owned": "neutral",
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

  // The wizard's second mode: every control in the catalog, browsable and
  // individually toggleable, rather than only the ones a derived wave
  // surfaced. Reuses the exact same override (upsertControlReview, bucket
  // "not-applicable") the wave walk above already writes — an operator can
  // pull any control out of scope here, or put it back, and the wave walk
  // picks up the result the next time it renders.
  const [view, setView] = useState<"walk" | "all">("walk");
  const [allQuery, setAllQuery] = useState("");
  const [excludingId, setExcludingId] = useState<ControlId | null>(null);
  const [excludeNote, setExcludeNote] = useState("");

  const allControlsMatrix = liveEngine.compliance.systemControlMatrix(systemId);
  const allControlsNotApplicable = liveEngine.compliance.notApplicableControlsForSystem(systemId);
  const allControlRows: AllControlsRow[] = useMemo(() => {
    const rows: AllControlsRow[] = [
      ...allControlsMatrix.map((row) => ({ control: row.control, inScope: true, reason: null })),
      ...allControlsNotApplicable.map((item) => ({ control: item.control, inScope: false, reason: item.reason })),
    ];
    return rows.sort((a, b) => (
      a.control.domain === b.control.domain
        ? a.control.id.localeCompare(b.control.id)
        : a.control.domain.localeCompare(b.control.domain)
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId, allControlsMatrix, allControlsNotApplicable]);

  const filteredAllControlRows = useMemo(() => {
    const q = allQuery.trim().toLowerCase();
    if (!q) return allControlRows;
    return allControlRows.filter((row) =>
      row.control.id.toLowerCase().includes(q)
      || row.control.name.toLowerCase().includes(q)
      || row.control.domain.toLowerCase().includes(q)
    );
  }, [allControlRows, allQuery]);

  function markControlOutOfScope(control: Control, note: string) {
    setSaveError(null);
    const runtime = upsertControlReview(loadRuntimeFacts(), {
      systemId, controlId: control.id, bucket: "not-applicable", stance: "confirm",
      note, reviewedBy: reviewer.trim() || assessor, reviewedAt: today(),
    });
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) { setSaveError(problems); return; }
    setExcludingId(null);
    setExcludeNote("");
  }

  function markControlInScope(control: Control) {
    setSaveError(null);
    const runtime = upsertControlReview(loadRuntimeFacts(), {
      systemId, controlId: control.id, bucket: "not-applicable", stance: "reject",
      note: "Pulled back into scope via the Control Scope Wizard.",
      reviewedBy: reviewer.trim() || assessor, reviewedAt: today(),
    });
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) setSaveError(problems);
  }

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
    setView("walk");
    setAllQuery("");
    setExcludingId(null);
    setExcludeNote("");
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

  // One place says where you are, the same way the Add System wizard's footer
  // does: the browser is a destination, a finished scope is a terminal state,
  // and otherwise it's wave N of the three.
  const footerPosition = view === "all"
    ? `All controls · ${filteredAllControlRows.length} shown`
    : scopeComplete
      ? "Scope complete"
      : `Wave ${SCOPE_WAVES.indexOf(wave) + 1} of ${SCOPE_WAVES.length} · ${waveCopy.label}`;

  const footerHint = !canWrite
    ? <InlineHint tone="warning">Name a reviewer of record before any scope decision can be saved.</InlineHint>
    : undefined;

  return (
    <Modal open={open} onClose={onClose} width={1040} height={720}>
      <WizardChrome>
        <WizardBanner icon={Target} title="Scope Determination Wizard" />
        <WizardHeader
          icon={Target}
          title="Scope Determination"
          description="Confirm which controls apply to this boundary before technical review begins, or open All Controls to set any control in or out of scope directly. Every decision is recorded with who made it and when."
          aside={
            <>
              <HeaderStat label="Scope decided" value={`${scopeDecided} of ${scopeTotal}`} />
              <InlineField label="Reviewer">
                <TextInput
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="Assessor of record"
                  aria-label="Reviewer of record"
                  style={{ width: 190 }}
                />
              </InlineField>
            </>
          }
          onClose={<ModalCloseButton onClose={onClose} />}
        />

        <WizardBody>
          <WizardRail label="Scope waves">
            <RailGroup connected>
              {SCOPE_WAVES.map((w) => {
                const projection = walk.waves[w];
                const isDone = projection.remaining.length === 0;
                return (
                  <RailItem
                    key={w}
                    icon={BUCKET_META[w].Icon}
                    title={WAVE_COPY[w].label}
                    detail={isDone
                      ? `${projection.decidedItems.length} of ${projection.total} decided`
                      : `${projection.remaining.length} of ${projection.total} remaining`}
                    state={isDone ? "done" : view === "walk" && w === wave ? "active" : "pending"}
                    onClick={() => { if (!justDecided) { setWave(w); setView("walk"); } }}
                  />
                );
              })}
              <RailItem
                icon={SystemOwnedIcon}
                title="Remaining Technical"
                detail={scopeComplete
                  ? `${technicalRemaining} queued for grading`
                  : `Not started · ${walk.waves["system-owned"].total}`}
                state="pending"
                disabled={!scopeComplete}
                onClick={() => { onClose(); onStartTechnicalReview(); }}
              />
            </RailGroup>

            <RailGroup label="Browse">
              <RailItem
                icon={ListChecks}
                title="All Controls"
                detail={`${allControlRows.length} in the catalog`}
                state={view === "all" ? "active" : "pending"}
                onClick={() => setView("all")}
              />
            </RailGroup>
          </WizardRail>

          <div className="p-6 overflow-y-auto flex flex-col min-w-0" style={{ background: C.bg }}>
            {view === "all" ? (
              <div className="flex flex-col gap-4 flex-1 min-h-0">
                {saveError && <SaveErrorCallout problems={saveError} />}
                <Section
                  grow
                  icon={ListChecks}
                  title="All controls"
                  description="Every control the catalog defines against this system — set any one in or out of scope directly."
                  aside={<StatusPill tone="neutral">{filteredAllControlRows.length} shown</StatusPill>}
                >
                  <SearchInput
                    value={allQuery}
                    onChange={setAllQuery}
                    placeholder="Search by id, name, or domain…"
                    ariaLabel="Search controls"
                    className="md:max-w-[380px]"
                  />
                  <Well padded={false} className="flex-1 min-h-0 overflow-y-auto">
                    {filteredAllControlRows.length === 0 && (
                      <div className={`${TX.help} text-center py-8`} style={{ color: C.muted }}>
                        No controls match that search.
                      </div>
                    )}
                    {filteredAllControlRows.map((row, index) => (
                      <div
                        key={row.control.id}
                        style={{ borderBottom: index < filteredAllControlRows.length - 1 ? `1px solid ${C.border}` : undefined }}
                      >
                        <div className="flex items-start gap-3 px-3.5 py-3">
                          <div className="min-w-0 flex-1">
                            <div className={TX.itemTitle} style={{ color: C.ink }}>{row.control.name}</div>
                            <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>
                              <span className="font-mono">{row.control.id}</span> · {row.control.domain}
                            </div>
                            {!row.inScope && row.reason && (
                              <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>{row.reason}</div>
                            )}
                          </div>
                          <StatusPill tone={row.inScope ? "success" : "neutral"} icon={row.inScope ? Check : Ban}>
                            {row.inScope ? "In scope" : "Out of scope"}
                          </StatusPill>
                          {row.inScope ? (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={!canWrite}
                              onClick={() => { setExcludingId(row.control.id); setExcludeNote(""); }}
                            >
                              Mark out of scope
                            </Button>
                          ) : (
                            <Button size="sm" disabled={!canWrite} onClick={() => markControlInScope(row.control)}>
                              Mark in scope
                            </Button>
                          )}
                        </div>
                        {excludingId === row.control.id && (
                          <div className="px-3.5 pb-3.5">
                            <Well hollow className="flex flex-col gap-3.5">
                              <Field
                                label="Reason"
                                note="Required — why this control does not apply to this boundary."
                                error={excludeNote.trim() ? null : "Enter a reason before recording the exclusion."}
                              >
                                <TextInput
                                  value={excludeNote}
                                  onChange={(e) => setExcludeNote(e.target.value)}
                                  placeholder="e.g. No physical facility inside this boundary"
                                  aria-label={`Reason ${row.control.id} is out of scope`}
                                />
                              </Field>
                              <div className="flex items-center justify-end gap-2.5">
                                <Button size="sm" onClick={() => { setExcludingId(null); setExcludeNote(""); }}>Cancel</Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  icon={Check}
                                  disabled={!excludeNote.trim()}
                                  onClick={() => markControlOutOfScope(row.control, excludeNote.trim())}
                                >
                                  Mark out of scope
                                </Button>
                              </div>
                            </Well>
                          </div>
                        )}
                      </div>
                    ))}
                  </Well>
                </Section>
              </div>
            ) : scopeComplete && !justDecided ? (
              <CompletionScreen
                title="Scope confirmed"
                description="Every derived call for this system has been confirmed or overridden by a named reviewer. This is the record an auditor will ask for."
                tiles={
                  <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                    {SCOPE_WAVES.map((w) => (
                      <StatTile key={w} label={WAVE_COPY[w].label} value={walk.waves[w].total} />
                    ))}
                    <StatTile label="Remaining Technical" value={technicalRemaining} hint="Queued for grading" />
                  </div>
                }
                signature={<>Reviewed by <b style={{ color: C.ink }}>{reviewer.trim() || assessor}</b> · completed {today()}</>}
              />
            ) : displayItem ? (
              <div className="flex flex-col flex-1 min-h-0 gap-4">
                {saveError && <SaveErrorCallout problems={saveError} />}

                <div className="flex items-center gap-3">
                  <span className={`${TX.label} shrink-0`} style={{ color: C.muted }}>{waveCopy.label}</span>
                  <ProgressBar
                    value={current.decidedItems.length}
                    total={current.total}
                    label={`${waveCopy.label} progress`}
                  />
                  <span className={`${TX.help} shrink-0`} style={{ color: C.muted }}>{remainingCount} left</span>
                </div>

                <div className="flex-1 flex items-start justify-center">
                  <div
                    className="w-full max-w-2xl"
                    style={{
                      background: C.panel,
                      border: `1px solid ${justDecided ? C.green : C.border}`,
                      borderRadius: WZ.radius.card,
                      opacity: entering ? 0 : 1,
                      transform: entering ? "translateX(40px)" : "translateX(0)",
                      transition: "border-color 180ms ease, transform 340ms cubic-bezier(.2,.7,.3,1), opacity 320ms ease",
                    }}
                  >
                    <div className="p-5 flex flex-col gap-4">
                      <div>
                        <div className={TX.eyebrow} style={{ color: C.accent }}>
                          {displayItem.control.id} · {displayItem.control.domain}
                        </div>
                        <h3 className={`${TX.stepTitle} mt-2`} style={{ color: C.ink, fontFamily: WZ.serif }}>
                          {displayItem.control.name}
                        </h3>
                        <p className={`${TX.lead} mt-2.5`} style={{ color: C.ink }}>{displayItem.control.description}</p>
                      </div>

                      {/* The derived reason is a full sentence, so it gets the
                          block message treatment rather than a pill — a pill
                          would refuse to wrap and blow out the card. */}
                      {!justDecided && displayItem.reason && (
                        <Callout tone={BUCKET_TONE[wave]} icon={bucketMeta.Icon} title={`Derived as ${waveCopy.label}.`}>
                          {displayItem.reason}
                        </Callout>
                      )}

                      {justDecided ? (
                        <Callout tone="success" title={`${justDecided.label}.`}>Advancing to the next control…</Callout>
                      ) : wave === "not-applicable" ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <ActionCard
                            icon={Ban}
                            tone="primary"
                            title="Not applicable"
                            description="Confirm the derived exclusion"
                            disabled={!canWrite}
                            onClick={() => decide(displayItem.control, "confirm", displayItem.reason, "Marked Not Applicable")}
                          />
                          <ActionCard
                            icon={ArrowRight}
                            title="Mark applicable"
                            description="Pull this control back into scope"
                            disabled={!canWrite}
                            onClick={() => decide(displayItem.control, "reject", "Marked applicable during scope review.", "Marked Applicable")}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <ActionCard
                              icon={Check}
                              tone="primary"
                              title={waveCopy.confirmAction ?? "Confirm"}
                              description={waveCopy.confirmSub ?? ""}
                              disabled={!canWrite}
                              onClick={() => decide(displayItem.control, "confirm", displayItem.reason, waveCopy.confirmedLabel ?? "Confirmed")}
                            />
                            <ActionCard
                              icon={Ban}
                              tone="danger"
                              title="Reject"
                              description="Bring it back into ACME's scope"
                              disabled={!canWrite}
                              onClick={() => setRejectingId(displayItem.control.id)}
                            />
                          </div>

                          {rejectingId === displayItem.control.id && (
                            <Well hollow className="flex flex-col gap-3.5">
                              <InlineHint tone="info">{destinationLabel(displayItem.control.id)}</InlineHint>
                              <Field
                                label="Reason"
                                note="Required — recorded against the control as the reviewer's override."
                                error={rejectNote.trim() ? null : "Enter why the derived call does not hold here."}
                              >
                                <TextInput
                                  value={rejectNote}
                                  onChange={(e) => setRejectNote(e.target.value)}
                                  placeholder="Why doesn't the derived call hold on this boundary?"
                                  aria-label={`Reason for rejecting ${displayItem.control.id}`}
                                />
                              </Field>
                              <div className="flex items-center justify-end gap-2.5">
                                <Button size="sm" onClick={() => { setRejectingId(null); setRejectNote(""); }}>Cancel</Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  icon={Check}
                                  disabled={!rejectNote.trim()}
                                  onClick={() => decide(
                                    displayItem.control,
                                    "reject",
                                    rejectNote.trim(),
                                    `Rejected — moved to ${WAVE_COPY[walk.proposedBucket(displayItem.control.id) as ReviewWave].label}`,
                                  )}
                                >
                                  Save and continue
                                </Button>
                              </div>
                            </Well>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </WizardBody>

        <WizardFooter position={footerPosition} hint={footerHint}>
          {view === "all" && <Button onClick={() => setView("walk")}>Back to review</Button>}
          {scopeComplete && technicalRemaining > 0 && (
            <Button
              variant="primary"
              iconRight={ArrowRight}
              onClick={() => { onClose(); onStartTechnicalReview(); }}
            >
              Begin technical review · {technicalRemaining}
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </WizardFooter>
      </WizardChrome>
    </Modal>
  );
}
