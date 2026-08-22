import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Ban, Check, ChevronDown, ChevronRight, ListChecks, Target } from "lucide-react";
import { C } from "../../theme";
import { commitRuntimeFacts, RESPONSIBILITIES } from "../../engine";
import { upsertControlReview } from "../../engine/runtimeMutations";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { APPLICABILITY_META, RESPONSIBILITY_META } from "./controlMeta";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, Callout, CompletionScreen, Field, HeaderStat, InlineField, InlineHint,
  RailGroup, RailItem, SaveErrorCallout, SearchInput, Section, StatTile, StatusPill, TextInput, TX, Well,
  WizardBanner, WizardBody, WizardChrome, WizardFooter, WizardHeader, WizardRail,
} from "../../components/wizard/WizardUI";
import type { ControlReview } from "../../graph/edges/controlReviews";
import type { InheritanceGroup, ReviewWave, ReviewWaveControl } from "../../engine/review";
import type { ControlId, SystemId } from "../../graph/ids";
import type { Control } from "../../graph/nodes/controls";

// One row of the All Controls browser: every control the catalog defines
// against this system, whether it currently applies or was excluded (by rule
// or by a prior override), so an operator can find and flip any single one —
// not just the ones the scope review surfaced as needing a decision.
interface AllControlsRow {
  control: Control;
  inScope: boolean;
  reason: string | null;
}

// The two decision surfaces plus the browser. Scope is exclusion-shaped now:
// being in scope needs no ceremony (the assessment walk is its human touch),
// so the review asks only "confirm what is OUT" — the short list a person
// should actually read — and "accept what the inherited coverage stands on,"
// asked per report rather than per control.
type ScopeView = "out-of-scope" | "inherited" | "all";

function today(): string {
  return new Date().toISOString().slice(0, 10);
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
  const groups = liveEngine.review.inheritanceGroupsForSystem(systemId);
  const summary = liveEngine.compliance.controlApplicabilitySummary(systemId);

  const [view, setView] = useState<ScopeView>("out-of-scope");
  const [reviewer, setReviewer] = useState(assessor);
  const [saveError, setSaveError] = useState<string[] | null>(null);

  // Out-of-scope review state: at most one pending question is being answered
  // "out" at a time, with its typed reason.
  const [excludingPendingId, setExcludingPendingId] = useState<ControlId | null>(null);
  const [pendingNote, setPendingNote] = useState("");

  // Inherited coverage state: which claim's control list is unfolded.
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // All Controls browser state.
  const [allQuery, setAllQuery] = useState("");
  const [excludingId, setExcludingId] = useState<ControlId | null>(null);
  const [excludeNote, setExcludeNote] = useState("");

  const naWave = walk.waves["not-applicable"];
  const naItems = [...naWave.remaining, ...naWave.decidedItems];
  const pendingItems = naItems.filter((item) => item.forceReview);
  const derivedExclusions = naItems.filter((item) => !item.forceReview);
  const pendingRemaining = pendingItems.filter((item) => !item.review);
  const exclusionsRemaining = naWave.remaining.filter((item) => !item.forceReview);
  const outOfScopeRemaining = naWave.remaining.length;
  const outOfScopeDone = outOfScopeRemaining === 0;

  const groupsConfirmed = groups.filter((g) => g.remaining.length === 0).length;
  const inheritedDone = groups.every((g) => g.remaining.length === 0);
  const technicalRemaining = walk.waves["system-owned"].remaining.length;
  const everythingDone = outOfScopeDone && inheritedDone;

  const canWrite = reviewer.trim().length > 0;

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

  // Reset to a clean slate every time the modal opens, landed on whichever
  // surface the caller asked for — the two inherited waves both map to the
  // Inherited Coverage view now that they are reviewed per report.
  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setExcludingPendingId(null);
    setPendingNote("");
    setExpandedGroupId(null);
    setAllQuery("");
    setExcludingId(null);
    setExcludeNote("");
    setView(initialWave === "vendor-inherited" || initialWave === "enterprise" ? "inherited" : "out-of-scope");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commitReviews(reviews: ControlReview[]): boolean {
    setSaveError(null);
    if (reviews.length === 0) return true;
    const runtime = reviews.reduce(upsertControlReview, loadRuntimeFacts());
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setSaveError(problems);
      return false;
    }
    return true;
  }

  function review(controlId: ControlId, bucket: ControlReview["bucket"], stance: ControlReview["stance"], note: string): ControlReview {
    return { systemId, controlId, bucket, stance, note, reviewedBy: reviewer.trim() || assessor, reviewedAt: today() };
  }

  function confirmExclusion(item: ReviewWaveControl) {
    commitReviews([review(item.control.id, "not-applicable", "confirm", item.reason)]);
  }

  function pullIntoScope(control: Control) {
    commitReviews([review(control.id, "not-applicable", "reject", "Marked applicable during scope review.")]);
  }

  function confirmAllExclusions() {
    commitReviews(exclusionsRemaining.map((item) => review(item.control.id, "not-applicable", "confirm", item.reason)));
  }

  function confirmPendingOut(item: ReviewWaveControl, note: string) {
    if (!commitReviews([review(item.control.id, "not-applicable", "confirm", note)])) return;
    setExcludingPendingId(null);
    setPendingNote("");
  }

  function confirmGroup(group: InheritanceGroup) {
    commitReviews(group.remaining.map((item) => review(item.control.id, group.bucket, "confirm", `Confirmed via ${group.title}.`)));
  }

  function takeOwnership(group: InheritanceGroup, item: ReviewWaveControl) {
    commitReviews([review(
      item.control.id, group.bucket, "reject",
      "Rejected inheritance — ACME evidences this control directly on this boundary.",
    )]);
  }

  function markControlOutOfScope(control: Control, note: string) {
    if (!commitReviews([review(control.id, "not-applicable", "confirm", note)])) return;
    setExcludingId(null);
    setExcludeNote("");
  }

  if (!open) return null;

  const outOfScopeState = view === "out-of-scope" ? "active" : outOfScopeDone ? "done" : "pending";
  const inheritedState = view === "inherited" ? "active" : inheritedDone ? "done" : "pending";
  const SystemOwnedIcon = RESPONSIBILITY_META[RESPONSIBILITIES.INTERNAL].Icon;
  const naMeta = APPLICABILITY_META["not-applicable"];

  const footerPosition = view === "all"
    ? `All controls · ${filteredAllControlRows.length} shown`
    : view === "inherited"
      ? `Inherited coverage · ${groupsConfirmed} of ${groups.length} claims confirmed`
      : outOfScopeDone
        ? "Out-of-scope review complete"
        : `Out-of-scope review · ${outOfScopeRemaining} to decide`;

  const footerHint = !canWrite
    ? <InlineHint tone="warning">Name a reviewer of record before any scope decision can be saved.</InlineHint>
    : undefined;

  const exclusionRow = (item: ReviewWaveControl, isLast: boolean) => {
    const decided = Boolean(item.review);
    const excluded = item.review?.stance === "confirm";
    return (
      <div key={item.control.id} style={{ borderBottom: isLast ? undefined : `1px solid ${C.border}` }}>
        <div className="flex items-start gap-3 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className={TX.itemTitle} style={{ color: C.ink }}>{item.control.name}</div>
            <div className={`${TX.help} mt-1`} style={{ color: C.muted }}>
              <span className="font-mono">{item.control.id}</span> · {item.control.domain}
            </div>
            <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>{item.reason}</div>
          </div>
          {decided ? (
            <StatusPill tone={excluded ? "neutral" : "success"} icon={excluded ? Ban : Check}>
              {excluded ? "Out of scope" : "In scope"}
            </StatusPill>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" disabled={!canWrite} onClick={() => pullIntoScope(item.control)}>Pull into scope</Button>
              <Button size="sm" variant="primary" icon={Ban} disabled={!canWrite} onClick={() => confirmExclusion(item)}>
                Confirm out of scope
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const pendingRow = (item: ReviewWaveControl, isLast: boolean) => {
    const decided = Boolean(item.review);
    const excluded = item.review?.stance === "confirm" && item.review.bucket === "not-applicable";
    return (
      <div key={item.control.id} style={{ borderBottom: isLast ? undefined : `1px solid ${C.border}` }}>
        <div className="flex items-start gap-3 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className={TX.itemTitle} style={{ color: C.ink }}>{item.control.name}</div>
            <div className={`${TX.help} mt-1`} style={{ color: C.muted }}>
              <span className="font-mono">{item.control.id}</span> · {item.control.domain}
            </div>
            <div className={`${TX.help} mt-1.5`} style={{ color: C.ink }}>{item.reason}</div>
          </div>
          {decided ? (
            <StatusPill tone={excluded ? "neutral" : "success"} icon={excluded ? Ban : Check}>
              {excluded ? "Out of scope" : "In scope"}
            </StatusPill>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" disabled={!canWrite} onClick={() => pullIntoScope(item.control)}>Mark applicable</Button>
              <Button
                size="sm"
                variant="danger"
                icon={Ban}
                disabled={!canWrite}
                onClick={() => { setExcludingPendingId(item.control.id); setPendingNote(""); }}
              >
                Out of scope…
              </Button>
            </div>
          )}
        </div>
        {excludingPendingId === item.control.id && !decided && (
          <div className="px-3.5 pb-3.5">
            <Well hollow className="flex flex-col gap-3.5">
              <Field
                label="Reason"
                note="Required — this was flagged as an open question, so the exclusion needs its own answer, not the question restated."
                error={pendingNote.trim() ? null : "Enter why this control is out of scope for this boundary."}
              >
                <TextInput
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="Why doesn't this control's premise hold here?"
                  aria-label={`Reason ${item.control.id} is out of scope`}
                />
              </Field>
              <div className="flex items-center justify-end gap-2.5">
                <Button size="sm" onClick={() => { setExcludingPendingId(null); setPendingNote(""); }}>Cancel</Button>
                <Button size="sm" variant="primary" icon={Check} disabled={!pendingNote.trim()} onClick={() => confirmPendingOut(item, pendingNote.trim())}>
                  Confirm out of scope
                </Button>
              </div>
            </Well>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} width={1040} height={720}>
      <WizardChrome>
        <WizardBanner icon={Target} title="Scope Determination Wizard" />
        <WizardHeader
          icon={Target}
          title="Scope Determination"
          description="Everything the baseline, rules, and frameworks bring in scope stays in scope — assessment is its confirmation. What needs a person is the short list going OUT, and accepting the reports the inherited coverage stands on."
          aside={
            <>
              <HeaderStat label="In scope" value={`${summary.applicable} of ${summary.total}`} />
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
          <WizardRail label="Scope review">
            <RailGroup connected>
              <RailItem
                icon={naMeta.Icon}
                title="Out of Scope"
                detail={outOfScopeDone
                  ? `${naItems.length} decided`
                  : `${outOfScopeRemaining} of ${naItems.length} to decide`}
                state={outOfScopeState}
                onClick={() => setView("out-of-scope")}
              />
              <RailItem
                icon={RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR].Icon}
                title="Inherited Coverage"
                detail={`${groupsConfirmed} of ${groups.length} claims confirmed`}
                state={inheritedState}
                onClick={() => setView("inherited")}
              />
              <RailItem
                icon={SystemOwnedIcon}
                title="Remaining Technical"
                detail={outOfScopeDone
                  ? `${technicalRemaining} queued for grading`
                  : `After out-of-scope review · ${walk.waves["system-owned"].total}`}
                state="pending"
                disabled={!outOfScopeDone}
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

          <div className="p-6 overflow-y-auto flex flex-col min-w-0 gap-4" style={{ background: C.bg }}>
            {saveError && <SaveErrorCallout problems={saveError} />}

            {view === "all" && (
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
                          <Button size="sm" disabled={!canWrite} onClick={() => pullIntoScope(row.control)}>
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
            )}

            {view === "out-of-scope" && everythingDone && (
              <CompletionScreen
                title="Scope confirmed"
                description="Every exclusion carries a named reviewer's decision and every inherited claim names the report it stands on. This is the record an auditor will ask for."
                tiles={
                  <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                    <StatTile label="In scope" value={summary.applicable} />
                    <StatTile label="Out of scope" value={naItems.length} />
                    <StatTile label="Claims confirmed" value={groups.length} />
                    <StatTile label="Remaining Technical" value={technicalRemaining} hint="Queued for grading" />
                  </div>
                }
                signature={<>Reviewed by <b style={{ color: C.ink }}>{reviewer.trim() || assessor}</b> · completed {today()}</>}
              />
            )}

            {view === "out-of-scope" && !everythingDone && (
              <>
                <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                  <StatTile label="In scope" value={summary.applicable} />
                  <StatTile label="Provider-inherited" value={summary.byResponsibility.vendor} />
                  <StatTile label="Program-covered" value={summary.byResponsibility.enterprise} />
                  <StatTile label="Yours to evidence" value={summary.byResponsibility.owned + summary.byResponsibility.shared} />
                </div>

                {pendingItems.length > 0 && (
                  <Section
                    icon={naMeta.Icon}
                    title="Open questions"
                    description="Applicability the rules deliberately could not resolve — each needs its own answer."
                    aside={<StatusPill tone={pendingRemaining.length > 0 ? "warning" : "success"}>
                      {pendingRemaining.length > 0 ? `${pendingRemaining.length} to answer` : "All answered"}
                    </StatusPill>}
                  >
                    <Well padded={false}>
                      {pendingItems.map((item, index) => pendingRow(item, index === pendingItems.length - 1))}
                    </Well>
                  </Section>
                )}

                <Section
                  icon={Ban}
                  title="Derived exclusions"
                  description="Controls whose premise does not hold in this boundary. Read the reason, then confirm — or pull the control back into scope."
                  aside={exclusionsRemaining.length > 1 ? (
                    <Button size="sm" icon={Check} disabled={!canWrite} onClick={confirmAllExclusions}>
                      Confirm all {exclusionsRemaining.length}
                    </Button>
                  ) : undefined}
                >
                  {derivedExclusions.length === 0 ? (
                    <Callout tone="info" title="Nothing is excluded by rule.">
                      Every control in the catalog applies to this boundary. The All Controls browser can pull any control out with a stated reason.
                    </Callout>
                  ) : (
                    <Well padded={false}>
                      {derivedExclusions.map((item, index) => exclusionRow(item, index === derivedExclusions.length - 1))}
                    </Well>
                  )}
                </Section>
              </>
            )}

            {view === "inherited" && (
              <Section
                grow
                icon={RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR].Icon}
                title="Inherited coverage"
                description="These controls are in scope; someone else runs them. Each claim is reviewed against the report it stands on — confirming a report claims every control it backs, in one signed decision."
                aside={<StatusPill tone={inheritedDone ? "success" : "neutral"}>
                  {groupsConfirmed} of {groups.length} confirmed
                </StatusPill>}
              >
                <Well padded={false} className="flex-1 min-h-0 overflow-y-auto">
                  {groups.map((group, index) => {
                    const confirmed = group.remaining.length === 0;
                    const expanded = expandedGroupId === group.id;
                    const meta = group.bucket === "vendor-inherited"
                      ? RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR]
                      : RESPONSIBILITY_META[RESPONSIBILITIES.ENTERPRISE];
                    return (
                      <div key={group.id} style={{ borderBottom: index < groups.length - 1 ? `1px solid ${C.border}` : undefined }}>
                        <div className="flex items-start gap-3 px-3.5 py-3">
                          <meta.Icon size={16} style={{ color: meta.color, marginTop: 2 }} />
                          <div className="min-w-0 flex-1">
                            <div className={TX.itemTitle} style={{ color: C.ink }}>{group.title}</div>
                            <div className={`${TX.help} mt-1`} style={{ color: C.muted }}>
                              {group.evidenceType ? `${group.evidenceType} · ${group.assessedAt}` : "Backed by the central program itself — no separate attestation on file"}
                              {" · "}{group.controls.length} control{group.controls.length === 1 ? "" : "s"}
                            </div>
                            {group.reference && expanded && (
                              <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>{group.reference}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            className={`${TX.help} flex items-center gap-1 shrink-0 mt-0.5`}
                            style={{ color: C.muted }}
                            aria-label={`${expanded ? "Hide" : "Show"} controls covered by ${group.title}`}
                            onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {expanded ? "Hide" : "Controls"}
                          </button>
                          {confirmed ? (
                            <StatusPill tone="success" icon={Check}>Confirmed</StatusPill>
                          ) : (
                            <Button size="sm" variant="primary" icon={Check} disabled={!canWrite} onClick={() => confirmGroup(group)}>
                              Confirm coverage · {group.remaining.length}
                            </Button>
                          )}
                        </div>
                        {expanded && (
                          <div className="px-3.5 pb-3">
                            <Well hollow padded={false}>
                              {group.controls.map((item, i) => {
                                const decided = Boolean(item.review);
                                const rejected = item.review?.stance === "reject";
                                return (
                                  <div
                                    key={item.control.id}
                                    className="flex items-center gap-3 px-3 py-2"
                                    style={{ borderBottom: i < group.controls.length - 1 ? `1px solid ${C.border}` : undefined }}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className={TX.help} style={{ color: C.ink }}>{item.control.name}</span>
                                      <span className={`${TX.help} ml-2 font-mono`} style={{ color: C.muted }}>{item.control.id}</span>
                                    </div>
                                    {decided ? (
                                      <StatusPill tone={rejected ? "warning" : "success"}>
                                        {rejected ? "ACME-owned" : "Confirmed"}
                                      </StatusPill>
                                    ) : (
                                      <Button size="sm" disabled={!canWrite} onClick={() => takeOwnership(group, item)}>
                                        Take ownership
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </Well>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Well>
              </Section>
            )}
          </div>
        </WizardBody>

        <WizardFooter position={footerPosition} hint={footerHint}>
          {view === "all" && <Button onClick={() => setView("out-of-scope")}>Back to review</Button>}
          {outOfScopeDone && technicalRemaining > 0 && (
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
