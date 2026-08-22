import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Ban, Check, ChevronDown, ChevronRight, History, Target } from "lucide-react";
import { C } from "../../theme";
import { commitRuntimeFacts, RESPONSIBILITIES } from "../../engine";
import { upsertControlReview } from "../../engine/runtimeMutations";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { APPLICABILITY_META, RESPONSIBILITY_META } from "./controlMeta";
import { keyControlAssessmentQueue } from "./recordAssessment";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, Callout, CompletionScreen, Field, HeaderStat, InlineField, InlineHint,
  RailGroup, RailItem, SaveErrorCallout, Section, StatTile, StatusPill, TextInput, TX, Well,
  WizardBanner, WizardBody, WizardChrome, WizardFooter, WizardHeader, WizardPane, WizardRail,
} from "../../components/wizard/WizardUI";
import type { ControlReview } from "../../graph/edges/controlReviews";
import type { InheritanceGroup, ReviewWave, ReviewWaveControl } from "../../engine/review";
import type { ControlId, SystemId } from "../../graph/ids";
import type { Control } from "../../graph/nodes/controls";

// The three decision surfaces. Scope is exclusion-shaped: being in scope needs
// no ceremony (the assessment walk is its human touch), so the review asks only
// "confirm what is OUT" — the short list a person should actually read — then
// splits inheritance by who covers it. External inheritance is accepted against
// the provider's report or certification; internal inheritance is ACME's own
// programs, standing on ACME's own program-level evidence, where the question is
// whether the program reaches this boundary — never a self-attestation.
//
// There is deliberately no catalog browser here any more. Excluding a control
// the rules never questioned is a judgement about that one control, so it lives
// on the control itself — the Scope section of ControlEvaluationPanel — not in a
// searchable list bolted to the side of a guided review.
type ScopeView = "out-of-scope" | "external" | "internal";

// The review sections in the order the rail shows them. Both the guided
// hand-off and the footer's Continue button walk this order rather than
// jumping to whichever section happens to have work left — otherwise the
// footer names a step the reader can see is not the next one.
const SECTION_ORDER = ["out-of-scope", "external", "internal"] as const;
type Section = (typeof SECTION_ORDER)[number];
const SECTION_LABEL: Record<Section, string> = {
  "out-of-scope": "Out of Scope",
  external: "External Inheritance",
  internal: "Internal Inheritance",
};

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
  const system = liveEngine.graph.systemById[systemId];
  const walk = liveEngine.review.wavesForSystem(systemId);
  const groups = liveEngine.review.inheritanceGroupsForSystem(systemId);
  const dormant = liveEngine.review.dormantAssessmentsForSystem(systemId);
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

  const naWave = walk.waves["not-applicable"];
  const naItems = [...naWave.remaining, ...naWave.decidedItems];
  const pendingItems = naItems.filter((item) => item.forceReview);
  const derivedExclusions = naItems.filter((item) => !item.forceReview);
  const pendingRemaining = pendingItems.filter((item) => !item.review);
  const exclusionsRemaining = naWave.remaining.filter((item) => !item.forceReview);
  const outOfScopeRemaining = naWave.remaining.length;
  const outOfScopeDone = outOfScopeRemaining === 0;

  const externalGroups = groups.filter((g) => g.bucket === "vendor-inherited");
  const internalGroups = groups.filter((g) => g.bucket === "enterprise");
  const externalRemaining = externalGroups.reduce((sum, g) => sum + g.remaining.length, 0);
  const internalRemaining = internalGroups.reduce((sum, g) => sum + g.remaining.length, 0);
  const externalConfirmed = externalGroups.filter((g) => g.remaining.length === 0).length;
  const internalConfirmed = internalGroups.filter((g) => g.remaining.length === 0).length;
  const externalDone = externalRemaining === 0;
  const internalDone = internalRemaining === 0;
  const inheritedDone = externalDone && internalDone;
  // What the Control Assessment Wizard will ACTUALLY put in front of the
  // operator when they leave here — built the same way that wizard builds it,
  // from the same function, so this screen cannot promise a workload the next
  // screen does not deliver.
  //
  // This used to read walk.waves["system-owned"].remaining.length, which is a
  // different population: that wave drops inherited and program-scoped controls
  // because it exists to ORDER this review's own sections, not to describe the
  // grading queue. On a runtime-created system the two differed roughly four to
  // one, so the rail advertised 21 and the walk opened with 90.
  // A key control still waiting on an inheritance decision here does not
  // belong in the technical queue yet — see recordAssessment.ts's
  // keyControlAssessmentQueue. Excluding it is what lets Control Assessment
  // open before every inheritance claim is confirmed (readyForAssessment
  // below): the controls that are ready stay ready, the undecided ones just
  // don't show up to be graded until Scope Review says what they are.
  const pendingScopeIds = useMemo(() => new Set([
    ...groups.filter((g) => g.bucket === "vendor-inherited").flatMap((g) => g.remaining.map((item) => item.control.id)),
    ...groups.filter((g) => g.bucket === "enterprise").flatMap((g) => g.remaining.map((item) => item.control.id)),
  ]), [groups]);
  const assessmentQueue = useMemo(() => keyControlAssessmentQueue(
    liveEngine.compliance.systemControlMatrix(systemId).map((row) => ({
      ...row,
      responsibility: liveEngine.compliance.responsibilityForControl(systemId, row.controlId),
    })),
    liveEngine.graph.assetsBySystem[systemId] ?? [],
    (assetId, controlId) => liveEngine.applicability.resolveApplicability(assetId, controlId).required,
    pendingScopeIds,
  ), [liveEngine, systemId, pendingScopeIds]);
  const technicalRemaining = assessmentQueue.length;
  const everythingDone = outOfScopeDone && inheritedDone;
  // Internal inheritance is worked claim-by-claim and can take a while to
  // finish end to end (many small central programs); gating every applicable
  // key control behind it meant a system with 40 controls ready to grade sat
  // idle until the last program on a long internal list was confirmed.
  // External inheritance is usually a short, provider-driven list, so it
  // still has to be settled first — see pendingScopeIds above for how an
  // undecided internal claim's controls stay out of the queue in the
  // meantime rather than leaking in ungraded.
  const readyForAssessment = outOfScopeDone && externalDone;

  // What each internal claim actually stands on: ACME's own program-level
  // evidence, read from the same coverage derivation everything else uses —
  // not a report, and never a self-attestation.
  const programEvidence = useMemo(() => {
    const map: Record<string, { evidenced: number; total: number }> = {};
    internalGroups.forEach((g) => {
      map[g.id] = {
        total: g.controls.length,
        evidenced: g.controls.filter(
          (item) => liveEngine.compliance.controlCoverageForSystem(systemId, item.control.id).status !== "unassessed"
        ).length,
      };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, liveEngine, systemId]);

  const canWrite = reviewer.trim().length > 0;

  // Where to land when the modal OPENS: the earliest section still holding
  // work, so re-opening resumes rather than restarting. Navigation once
  // inside walks SECTION_ORDER instead — see the hand-off effect and the
  // footer's Continue button.
  function nextViewWithWork(): ScopeView {
    if (outOfScopeRemaining > 0) return "out-of-scope";
    if (externalRemaining > 0) return "external";
    if (internalRemaining > 0) return "internal";
    return "out-of-scope"; // everything done — the completion screen's home
  }

  // Tracks the previous remaining counts so the guided hand-off below fires
  // only on the transition where a section's last decision lands.
  const remainingRef = useRef({ scope: outOfScopeRemaining, external: externalRemaining, internal: internalRemaining });

  // Reset to a clean slate every time the modal opens, landed on whichever
  // surface still has work (or the one the caller asked for — the two
  // inherited waves map to their inheritance views).
  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setExcludingPendingId(null);
    setPendingNote("");
    setExpandedGroupId(null);
    if (initialWave === "vendor-inherited") setView("external");
    else if (initialWave === "enterprise") setView("internal");
    else setView(nextViewWithWork());
    remainingRef.current = { scope: outOfScopeRemaining, external: externalRemaining, internal: internalRemaining };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Guided hand-offs at the moment a section's last decision lands: Out of
  // Scope hands off to External Inheritance, External to Internal, in that
  // order — the same order the footer's Continue button offers. When the last
  // one lands, the completion screen (which lives on the Out of Scope view)
  // takes over instead. Only the transition advances the view — navigating
  // back to a finished section to re-read it stays possible.
  useEffect(() => {
    if (!open) return;
    const prev = remainingRef.current;
    remainingRef.current = { scope: outOfScopeRemaining, external: externalRemaining, internal: internalRemaining };
    const finished =
      (view === "out-of-scope" && prev.scope > 0 && outOfScopeRemaining === 0)
      || (view === "external" && prev.external > 0 && externalRemaining === 0)
      || (view === "internal" && prev.internal > 0 && internalRemaining === 0);
    if (!finished) return;
    if (outOfScopeRemaining === 0 && externalRemaining === 0 && internalRemaining === 0) {
      setView("out-of-scope");
      return;
    }
    const next = SECTION_ORDER[SECTION_ORDER.indexOf(view as Section) + 1];
    if (next) setView(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, outOfScopeRemaining, externalRemaining, internalRemaining]);

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

  function noteForGroup(group: InheritanceGroup): string {
    const evidence = programEvidence[group.id];
    return group.bucket === "vendor-inherited"
      ? group.report
        ? `Accepted ${group.report.title} as covering ${group.domain} for this boundary.`
        : `Accepted ${group.coveredBy}'s coverage of ${group.domain} — no report or certification on file.`
      : `Confirmed ACME's central ${group.domain} program covers this boundary (${evidence?.evidenced ?? 0} of ${evidence?.total ?? group.controls.length} controls evidenced at program level).`;
  }

  function confirmGroup(group: InheritanceGroup) {
    commitReviews(group.remaining.map((item) => review(item.control.id, group.bucket, "confirm", noteForGroup(group))));
  }

  // The bulk action External/Internal were missing next to Out of Scope's
  // "Confirm all" — one claim, one program, and a required report or
  // certification each carry enough weight to deserve their own row, but
  // clicking through a long list of them one at a time added nothing a
  // single decision couldn't cover.
  function confirmAllGroups(list: InheritanceGroup[]) {
    commitReviews(list.flatMap((g) => g.remaining.map((item) => review(item.control.id, g.bucket, "confirm", noteForGroup(g)))));
  }

  function takeOwnership(group: InheritanceGroup, item: ReviewWaveControl) {
    commitReviews([review(
      item.control.id, group.bucket, "reject",
      "Rejected inheritance — ACME evidences this control directly on this boundary.",
    )]);
  }

  // The reversal takeOwnership never had: a claim already accepted for this
  // one control, re-confirmed after a second look. Out of Scope has always
  // let a confirmed exclusion be pulled back (reversalRow); an inheritance
  // claim decided one way, individually, deserves the same way back the
  // other.
  function confirmSingleItem(group: InheritanceGroup, item: ReviewWaveControl) {
    commitReviews([review(item.control.id, group.bucket, "confirm", noteForGroup(group))]);
  }

  if (!open) return null;

  const outOfScopeState = view === "out-of-scope" ? "active" : outOfScopeDone ? "done" : "pending";
  const externalState = view === "external" ? "active" : externalDone ? "done" : "pending";
  const internalState = view === "internal" ? "active" : internalDone ? "done" : "pending";
  const SystemOwnedIcon = RESPONSIBILITY_META[RESPONSIBILITIES.INTERNAL].Icon;
  const naMeta = APPLICABILITY_META["not-applicable"];

  const footerPosition = view === "external"
      ? `External inheritance · ${externalConfirmed} of ${externalGroups.length} claims confirmed`
      : view === "internal"
        ? `Internal inheritance · ${internalConfirmed} of ${internalGroups.length} programs confirmed`
        : outOfScopeDone
          ? "Out-of-scope review complete"
          : `Out-of-scope review · ${outOfScopeRemaining} to decide`;

  const footerHint = !canWrite
    ? <InlineHint tone="warning">Name a reviewer of record before any scope decision can be saved.</InlineHint>
    : undefined;

  // "Continue" means the next section along the rail — never whichever
  // section happens to still have work. Counted in the unit that section's
  // rail entry counts in — claims and programs for the inheritance sections,
  // individual controls for the out-of-scope list — so the two never disagree
  // about how much is left.
  const sectionRemaining: Record<Section, number> = {
    "out-of-scope": outOfScopeRemaining,
    external: externalGroups.filter((g) => g.remaining.length > 0).length,
    internal: internalGroups.filter((g) => g.remaining.length > 0).length,
  };
  const currentIndex = SECTION_ORDER.indexOf(view as Section);
  const nextSection = currentIndex >= 0 && currentIndex < SECTION_ORDER.length - 1
    ? SECTION_ORDER[currentIndex + 1]
    : null;
  // Offered once the section in hand is settled, and stood down entirely when
  // everything is done so "Begin technical review" is the only way forward.
  const showContinue = Boolean(nextSection)
    && sectionRemaining[SECTION_ORDER[currentIndex]] === 0
    && !everythingDone;

  // Three row shapes, one vocabulary for the two decisions they offer (2.6):
  // `Mark in scope` wherever pullIntoScope is called, `Mark out of scope…` for
  // the disclosure that first asks for a reason, and `Confirm out of scope` for
  // the button that actually records the exclusion — whether the reason was
  // derived by the rules or just typed. These had drifted to three labels for
  // the in-scope act alone ("Pull into scope" / "Mark applicable" / "Mark in
  // scope"), which reads as three different decisions.
  //
  // A decided row keeps its `Mark in scope` action rather than freezing into a
  // status pill. isForcedNotApplicable and isForcedApplicable are the same
  // record read two ways (see engine/review.ts), so the engine has always been
  // able to undo an exclusion — only the UI made it one-way. It mattered less
  // while the All Controls browser offered a second route back; with that gone
  // this list is the only one, and a scope call nobody can reverse is a trap.
  const reversalRow = (control: Control) => (
    <Button size="sm" disabled={!canWrite} onClick={() => pullIntoScope(control)}>Mark in scope</Button>
  );

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
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill tone={excluded ? "neutral" : "success"} icon={excluded ? Ban : Check}>
                {excluded ? "Out of scope" : "In scope"}
              </StatusPill>
              {excluded && reversalRow(item.control)}
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" disabled={!canWrite} onClick={() => pullIntoScope(item.control)}>Mark in scope</Button>
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
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill tone={excluded ? "neutral" : "success"} icon={excluded ? Ban : Check}>
                {excluded ? "Out of scope" : "In scope"}
              </StatusPill>
              {excluded && reversalRow(item.control)}
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" disabled={!canWrite} onClick={() => pullIntoScope(item.control)}>Mark in scope</Button>
              <Button
                size="sm"
                variant="danger"
                icon={Ban}
                disabled={!canWrite}
                onClick={() => { setExcludingPendingId(item.control.id); setPendingNote(""); }}
              >
                Mark out of scope…
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
        <WizardBanner icon={Target} title="Scope Review Wizard" />
        {/* One instruction, imperative, naming the three sections in the rail
            in the order they are worked (2.5). The reasoning behind the model
            — why in-scope controls need no ceremony — belongs in each
            section's own description, not in the chrome above every view. */}
        <WizardHeader
          icon={Target}
          title="Scope Review"
          description="Work the three sections in order: confirm the controls going out of scope, accept the provider coverage you rely on, then confirm which ACME programs reach this system. Everything else is already in scope and needs nothing from you here."
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
                complete={outOfScopeDone}
                onClick={() => setView("out-of-scope")}
              />
              <RailItem
                icon={RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR].Icon}
                title="External Inheritance"
                detail={`${externalConfirmed} of ${externalGroups.length} claims confirmed`}
                state={externalState}
                complete={externalDone}
                onClick={() => setView("external")}
              />
              <RailItem
                icon={RESPONSIBILITY_META[RESPONSIBILITIES.ENTERPRISE].Icon}
                title="Internal Inheritance"
                detail={`${internalConfirmed} of ${internalGroups.length} programs confirmed`}
                state={internalState}
                complete={internalDone}
                onClick={() => setView("internal")}
              />
              {/* Named for the surface it opens — the Control Assessment
                  Wizard — so the rail, the footer's Continue and the System
                  Readiness card all say the same words (2.2). The TITLE names
                  the destination; the DETAIL has to name the population, because
                  the readiness card counts every unassessed control while this
                  counts only the ones the walk will stop on. Same words for the
                  same place, different words for different numbers. */}
              <RailItem
                icon={SystemOwnedIcon}
                title="Control Assessment"
                detail={readyForAssessment
                  ? `${technicalRemaining} key control${technicalRemaining === 1 ? "" : "s"} to grade`
                  : `After Out of Scope and External Inheritance · ${technicalRemaining} to grade`}
                state="pending"
                disabled={!readyForAssessment}
                onClick={() => { onClose(); onStartTechnicalReview(); }}
              />
            </RailGroup>
          </WizardRail>

          <WizardPane>
            {saveError && <SaveErrorCallout problems={saveError} />}

            {view === "out-of-scope" && everythingDone && (
              <CompletionScreen
                title="Scope confirmed"
                description="Every exclusion carries a named reviewer's decision and every inherited claim names the report it stands on. This is the record an auditor will ask for."
                tiles={
                  <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                    <StatTile label="In scope" value={summary.applicable} />
                    <StatTile label="Out of scope" value={naItems.length} />
                    <StatTile label="Claims confirmed" value={groups.length} />
                    <StatTile label="To grade" value={technicalRemaining} hint="Key controls the assessment walk will ask about" />
                  </div>
                }
                signature={<>Reviewed by <b style={{ color: C.ink }}>{reviewer.trim() || assessor}</b> · completed {today()}</>}
              />
            )}

            {view === "out-of-scope" && !everythingDone && (
              <>
                <Callout tone="info" title="Review the out-of-scope controls for accuracy.">
                  The other {summary.applicable} controls are already in scope and need nothing from you here.
                  Check that each control below really doesn't apply to this system — confirm it, or pull it back into scope.
                </Callout>

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
                      Every control in the catalog applies to this boundary. To take one out, open it from the
                      Controls tab and record the exclusion in its Scope section — the reason belongs with the
                      control it is about.
                    </Callout>
                  ) : (
                    <Well padded={false}>
                      {derivedExclusions.map((item, index) => exclusionRow(item, index === derivedExclusions.length - 1))}
                    </Well>
                  )}
                </Section>

                {/* The history behind an exclusion, which the exclusion row
                    itself cannot carry: these controls were graded before
                    somebody decided they do not apply here. Shown as a record,
                    not a decision — there is nothing to confirm, which is why
                    it sits inside Out of Scope rather than earning a rail
                    entry of its own. Absent entirely when nothing qualifies. */}
                {dormant.length > 0 && (
                  <Section
                    icon={History}
                    title="Assessed, then scoped out"
                    description="These carry an assessment from before they were excluded. The record stays readable and stops counting toward this system's scores; pulling a control back into scope makes it count again."
                    aside={<StatusPill tone="neutral">{dormant.length} retained</StatusPill>}
                  >
                    <Well padded={false}>
                      {dormant.map((d, index) => (
                        <div
                          key={d.control.id}
                          className="px-3.5 py-3"
                          style={{ borderBottom: index < dormant.length - 1 ? `1px solid ${C.border}` : undefined }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className={TX.itemTitle} style={{ color: C.ink }}>{d.control.name}</div>
                              <div className={`${TX.help} mt-1`} style={{ color: C.muted }}>
                                <span className="font-mono">{d.control.id}</span> · {d.control.domain}
                              </div>
                              {d.reason && (
                                <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>{d.reason}</div>
                              )}
                              <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>
                                Scoped out by {d.reviewedBy || "an unnamed reviewer"}
                                {d.reviewedAt && ` on ${d.reviewedAt}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusPill tone="neutral" icon={History}>Dormant</StatusPill>
                              {reversalRow(d.control)}
                            </div>
                          </div>
                          {/* What actually survives, counted rather than
                              scored — there is no live rating to quote once
                              the control has left the applicable set. */}
                          <div className="flex items-center gap-2 flex-wrap mt-2.5">
                            {d.inDeclaredScope && <StatusPill tone="neutral">In declared assessment scope</StatusPill>}
                            {d.evidenceCount > 0 && <StatusPill tone="neutral">{d.evidenceCount} evidence</StatusPill>}
                            {d.mechanismCount > 0 && <StatusPill tone="neutral">{d.mechanismCount} mechanism{d.mechanismCount === 1 ? "" : "s"}</StatusPill>}
                            {d.findingCount > 0 && <StatusPill tone="warning">{d.findingCount} finding{d.findingCount === 1 ? "" : "s"}</StatusPill>}
                            {d.overrides.map((o) => (
                              <StatusPill key={`${d.control.id}-${o.level}`} tone="neutral">
                                {o.level} {o.rating} · assessor override
                              </StatusPill>
                            ))}
                          </div>
                        </div>
                      ))}
                    </Well>
                  </Section>
                )}
              </>
            )}

            {(view === "external" || view === "internal") && (
              <Section
                grow
                icon={view === "external" ? RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR].Icon : RESPONSIBILITY_META[RESPONSIBILITIES.ENTERPRISE].Icon}
                title={view === "external" ? "External inheritance" : "Internal inheritance"}
                description={view === "external"
                  ? `Controls ${system?.provider ?? "the provider"} runs for this boundary. Each row is one covered domain — accept the report or certification that backs it.`
                  : "Controls covered by ACME's own central programs — run by us, evidenced at program level like any other control. Confirm each program actually reaches this boundary."}
                aside={(() => {
                  const shown = view === "external" ? externalGroups : internalGroups;
                  const unit = view === "external" ? "claim" : "program";
                  const remainingGroups = shown.filter((g) => g.remaining.length > 0);
                  const done = view === "external" ? externalDone : internalDone;
                  return (
                    <div className="flex items-center gap-2">
                      {remainingGroups.length > 1 && (
                        <Button size="sm" icon={Check} disabled={!canWrite} onClick={() => confirmAllGroups(remainingGroups)}>
                          Confirm all {remainingGroups.length} {unit}{remainingGroups.length === 1 ? "" : "s"}
                        </Button>
                      )}
                      <StatusPill tone={done ? "success" : "neutral"}>
                        {view === "external" ? `${externalConfirmed} of ${externalGroups.length} confirmed` : `${internalConfirmed} of ${internalGroups.length} confirmed`}
                      </StatusPill>
                    </div>
                  );
                })()}
              >
                <Well padded={false} className="flex-1 min-h-0 overflow-y-auto">
                  {(view === "external" ? externalGroups : internalGroups).map((group, index, shown) => {
                    const confirmed = group.remaining.length === 0;
                    const expanded = expandedGroupId === group.id;
                    const external = group.bucket === "vendor-inherited";
                    const meta = external
                      ? RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR]
                      : RESPONSIBILITY_META[RESPONSIBILITIES.ENTERPRISE];
                    const evidence = programEvidence[group.id];
                    return (
                      <div key={group.id} style={{ borderBottom: index < shown.length - 1 ? `1px solid ${C.border}` : undefined }}>
                        <div className="flex items-start gap-3 px-3.5 py-3">
                          <meta.Icon size={16} style={{ color: meta.color, marginTop: 2 }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={TX.itemTitle} style={{ color: C.ink }}>{group.domain}</span>
                              {external && !group.report && <StatusPill tone="warning">No report on file</StatusPill>}
                              {!external && evidence?.evidenced === 0 && <StatusPill tone="warning">No program evidence yet</StatusPill>}
                            </div>
                            <div className={`${TX.help} mt-1`} style={{ color: C.muted }}>
                              {external ? (
                                <>
                                  Covered by {group.coveredBy}
                                  {group.report && ` · ${group.report.title} · ${group.report.evidenceType} · ${group.report.assessedAt}`}
                                </>
                              ) : (
                                <>
                                  ACME-run program · {evidence?.evidenced ?? 0} of {evidence?.total ?? group.controls.length} controls evidenced at program level
                                  {group.report && ` · Program audit: ${group.report.title} (${group.report.assessedAt})`}
                                </>
                              )}
                              {" · "}{group.controls.length} control{group.controls.length === 1 ? "" : "s"}
                            </div>
                            {group.report?.reference && expanded && (
                              <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>{group.report.reference}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            className={`${TX.help} flex items-center gap-1 shrink-0 mt-0.5`}
                            style={{ color: C.muted }}
                            aria-label={`${expanded ? "Hide" : "Show"} controls covered by ${group.coveredBy} for ${group.domain}`}
                            onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {expanded ? "Hide" : "Controls"}
                          </button>
                          {confirmed ? (
                            <StatusPill tone="success" icon={Check}>Confirmed</StatusPill>
                          ) : (
                            <Button size="sm" variant="primary" icon={Check} disabled={!canWrite} onClick={() => confirmGroup(group)}>
                              Confirm Inheritance · {group.remaining.length}
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
                                      <div className="flex items-center gap-2 shrink-0">
                                        <StatusPill tone={rejected ? "warning" : "success"}>
                                          {rejected ? "ACME-owned" : "Confirmed"}
                                        </StatusPill>
                                        <Button
                                          size="sm"
                                          disabled={!canWrite}
                                          onClick={() => rejected ? confirmSingleItem(group, item) : takeOwnership(group, item)}
                                        >
                                          {rejected ? "Confirm inheritance" : "Take ownership"}
                                        </Button>
                                      </div>
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
          </WizardPane>
        </WizardBody>

        {/* Immediate surface: every confirmation above has already committed,
            so there is no Save and nothing to Discard (5.6, 5.7). */}
        <WizardFooter
          position={footerPosition}
          hint={footerHint}
          close={<Button onClick={onClose}>Close</Button>}
          primary={showContinue && nextSection
            ? (
              <Button variant="primary" iconRight={ArrowRight} onClick={() => setView(nextSection)}>
                Continue to {SECTION_LABEL[nextSection]}
                {sectionRemaining[nextSection] > 0 ? ` · ${sectionRemaining[nextSection]}` : ""}
              </Button>
            )
            : readyForAssessment && technicalRemaining > 0
              ? (
                <Button
                  variant="primary"
                  iconRight={ArrowRight}
                  onClick={() => { onClose(); onStartTechnicalReview(); }}
                >
                  Continue to Control Assessment · {technicalRemaining}
                </Button>
              )
              : undefined}
        />
      </WizardChrome>
    </Modal>
  );
}
