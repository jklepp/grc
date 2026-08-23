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
  Button, Callout, CompletionScreen, Field, InlineHint,
  RailGroup, RailItem, SaveErrorCallout, Section, StatTile, StatusPill, TextInput, TX, Well,
  WizardBody, WizardChrome, WizardFooter, WizardHeader, WizardPane, WizardRail, WizardRailSummary,
} from "../../components/wizard/WizardUI";
import type { ControlReview } from "../../graph/edges/controlReviews";
import type { InheritanceGroup, ReviewWave, ReviewWaveControl } from "../../engine/review";
import type { ControlId, SystemId } from "../../graph/ids";
import type { Control } from "../../graph/nodes/controls";
import { useSignedInUser } from "../../auth/useUser";
import { canReviewScope, allows } from "../../auth/gates";

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
  "out-of-scope": "Not In Scope",
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
  onEditAssets?: () => void;
  initialWave?: ReviewWave | null;
}

export function ScopeReviewModal({ open, systemId, assessor, onClose, onStartTechnicalReview, onEditAssets, initialWave = null }: ScopeReviewModalProps) {
  const liveEngine = useLiveEngine();
  const system = liveEngine.graph.systemById[systemId];
  const walk = liveEngine.review.wavesForSystem(systemId);
  const groups = liveEngine.review.inheritanceGroupsForSystem(systemId);
  const dormant = liveEngine.review.dormantAssessmentsForSystem(systemId);
  const summary = liveEngine.compliance.controlApplicabilitySummary(systemId);

  const [view, setView] = useState<ScopeView>("out-of-scope");
  const [saveError, setSaveError] = useState<string[] | null>(null);

  // The reviewer of record is no longer typed — it is whoever is signed in.
  // A signature a person can edit is not a signature.
  const user = useSignedInUser();
  const scopePermission = canReviewScope(user);

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
  const controlMatrix = useMemo(() => liveEngine.compliance.systemControlMatrix(systemId).map((row) => ({
    ...row,
    responsibility: liveEngine.compliance.responsibilityForControl(systemId, row.controlId),
  })), [liveEngine, systemId]);
  // Asset-scoped controls that currently sample no asset cannot produce a
  // valid Implemented record. Ask that scope question here, before the grading
  // walk, instead of letting Save be the first place the operator discovers it.
  const noAssetControls = liveEngine.review.assetCoverageQuestionsForSystem(systemId);
  const outOfScopeRemaining = naWave.remaining.length + noAssetControls.length;
  const outOfScopeDone = outOfScopeRemaining === 0;
  const assessmentQueue = useMemo(() => keyControlAssessmentQueue(
    controlMatrix,
    pendingScopeIds,
  ), [controlMatrix, pendingScopeIds]);
  const technicalRemaining = assessmentQueue.length;
  const everythingDone = outOfScopeDone && inheritedDone;
  // Control Assessment is the next phase, so every Scope Review prerequisite
  // must be settled before its rail item or footer action becomes available.
  // This keeps the visible step order aligned with System Readiness and avoids
  // a walk whose queue silently grows as inheritance decisions arrive later.
  const readyForAssessment = everythingDone;

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

  // Same name, different question. This used to mean "has a reviewer name been
  // typed"; it now means "may this person record a scope decision at all".
  const canWrite = allows(scopePermission);

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
  // one lands, the completion screen (which lives on the Not In Scope view)
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
    return { systemId, controlId, bucket, stance, note, reviewedBy: user.name, reviewedAt: today() };
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

  function confirmNoAssetOut(control: Control, note: string) {
    if (!commitReviews([review(control.id, "not-applicable", "confirm", note)])) return;
    setExcludingPendingId(null);
    setPendingNote("");
  }

  function confirmAllNoAssetOut() {
    const note = "No registered asset in this system matches the control's required asset population.";
    commitReviews(noAssetControls.map((control) => review(control.id, "not-applicable", "confirm", note)));
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

  // The bulk action External/Internal were missing next to Not In Scope's
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
  // one control, re-confirmed after a second look. Not In Scope has always
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

  // The rail's subtext is one thing in one unit on every step: how many
  // controls that step is about. It is a population size, not a progress
  // reading — how far along you are is carried by the rail's own done/active
  // state, the header's counter and the footer's counts, each of which stays
  // in the unit of the act it describes (4.6). Three different units across
  // three adjacent rows made the rail unreadable at a glance.
  const outOfScopeControls = naItems.length + noAssetControls.length;
  const externalControls = externalGroups.reduce((n, g) => n + g.controls.length, 0);
  const internalControls = internalGroups.reduce((n, g) => n + g.controls.length, 0);
  const controlCount = (n: number) => `${n} control${n === 1 ? "" : "s"}`;

  // What the header says about the step in hand — the same shape and the same
  // word as the Add System wizard (4.11): the eyebrow places you, the title is
  // the step's own name exactly as the rail and the engine spell it
  // (2.2, 2.7), and the description is the one imperative instruction for
  // doing the work here (2.5). Each section used to open with this sentence as
  // a Callout inside the pane, where it scrolled away with the first row.
  //
  // The completion panel is a screen of its own, not a step, so it names
  // itself rather than borrowing whichever step the rail happens to be on.
  const sectionIndex = Math.max(0, SECTION_ORDER.indexOf(view as Section));
  const sectionNumber = sectionIndex + 1;
  const reviewComplete = everythingDone && view === "out-of-scope";
  // The completion panel is the end of the run, not the first section it
  // happens to render on: the summary and the bar read full, or the chrome
  // would tell the reader they are a third of the way through a review it is
  // congratulating them for finishing.
  const progressValue = reviewComplete ? SECTION_ORDER.length : sectionNumber;
  const stepEyebrow = `Step ${sectionNumber} of ${SECTION_ORDER.length} · ${Math.round((sectionNumber / SECTION_ORDER.length) * 100)}%`;
  const sectionHeading: { eyebrow: string; title: string; description?: string } = reviewComplete
    ? { eyebrow: "Review complete", title: "Scope confirmed" }
    : view === "external"
      ? {
          eyebrow: stepEyebrow,
          title: SECTION_LABEL.external,
          description: `Controls ${system?.provider ?? "the provider"} runs for this boundary. Each row is one covered domain — accept the report or certification that backs it.`,
        }
      : view === "internal"
        ? {
            eyebrow: stepEyebrow,
            title: SECTION_LABEL.internal,
            description: "Controls covered by ACME's own central programs — run by us, evidenced at program level like any other control. Confirm each program actually reaches this boundary.",
          }
        : {
            eyebrow: stepEyebrow,
            title: SECTION_LABEL["out-of-scope"],
            description: `Review these controls for accuracy — confirm each one really is out of scope here, or pull it back in. The other ${summary.applicable} controls are already in scope and need nothing from you.`,
          };

  // Counts only: the header above already names the step, so repeating it
  // here spent the status slot on a word the reader can see. Still counted in
  // the unit that section's rail entry counts in (4.6).
  const footerPosition = view === "external"
      ? `${externalConfirmed} of ${externalGroups.length} claims confirmed`
      : view === "internal"
        ? `${internalConfirmed} of ${internalGroups.length} programs confirmed`
        : outOfScopeDone
          ? "All exclusions confirmed"
          : `${outOfScopeRemaining} to decide`;

  const footerHint = !canWrite
    ? <InlineHint tone="warning">Scope decisions are recorded by an assessor. You can read this review but not change it.</InlineHint>
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
  // `Mark in scope` wherever pullIntoScope is called, `Mark Not In Scope…` for
  // the disclosure that first asks for a reason, and `Confirm Not In Scope` for
  // the button that actually records the exclusion. All of them are painted
  // `primary` like every other row decision on this surface: taking a control
  // out of scope is a routine review call backed by a reason and a reviewer,
  // not a destructive act, and `danger` made the same decision look like two
  // different kinds of act depending on which section you were standing in — whether the reason was
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
                Confirm Not In Scope
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
                variant="primary"
                icon={Ban}
                disabled={!canWrite}
                onClick={() => { setExcludingPendingId(item.control.id); setPendingNote(""); }}
              >
                Mark Not In Scope…
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
                error={pendingNote.trim() ? null : "Enter why this control is not in scope for this boundary."}
              >
                <TextInput
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="Why doesn't this control's premise hold here?"
                  aria-label={`Reason ${item.control.id} is not in scope`}
                />
              </Field>
              <div className="flex items-center justify-end gap-2.5">
                <Button size="sm" onClick={() => { setExcludingPendingId(null); setPendingNote(""); }}>Cancel</Button>
                <Button size="sm" variant="primary" icon={Check} disabled={!pendingNote.trim()} onClick={() => confirmPendingOut(item, pendingNote.trim())}>
                  Confirm Not In Scope
                </Button>
              </div>
            </Well>
          </div>
        )}
      </div>
    );
  };

  const noAssetRow = (control: Control, isLast: boolean) => (
    <div key={control.id} style={{ borderBottom: isLast ? undefined : `1px solid ${C.border}` }}>
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className={TX.itemTitle} style={{ color: C.ink }}>{control.name}</div>
          <div className={`${TX.help} mt-1`} style={{ color: C.muted }}>
            <span className="font-mono">{control.id}</span> · {control.domain}
          </div>
          <div className={`${TX.help} mt-1.5`} style={{ color: C.ink }}>
            No registered asset currently matches this asset-scoped control. Update the asset attributes if it belongs here, or record why its premise does not hold.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onEditAssets && <Button size="sm" onClick={onEditAssets}>Update assets</Button>}
          <Button
            size="sm"
            variant="primary"
            icon={Ban}
            disabled={!canWrite}
            onClick={() => { setExcludingPendingId(control.id); setPendingNote(""); }}
          >
            Mark Not In Scope…
          </Button>
        </div>
      </div>
      {excludingPendingId === control.id && (
        <div className="px-3.5 pb-3.5">
          <Well hollow className="flex flex-col gap-3.5">
            <Field
              label="Reason"
              note="Required — explain why this asset-scoped control is not in scope for this boundary."
              error={pendingNote.trim() ? null : "Enter why this control is not in scope for this boundary."}
            >
              <TextInput
                value={pendingNote}
                onChange={(e) => setPendingNote(e.target.value)}
                placeholder="Why doesn't this control's premise hold here?"
                aria-label={`Reason ${control.id} is not in scope`}
              />
            </Field>
            <div className="flex items-center justify-end gap-2.5">
              <Button size="sm" onClick={() => { setExcludingPendingId(null); setPendingNote(""); }}>Cancel</Button>
              <Button size="sm" variant="primary" icon={Check} disabled={!pendingNote.trim()} onClick={() => confirmNoAssetOut(control, pendingNote.trim())}>
                Confirm Not In Scope
              </Button>
            </div>
          </Well>
        </div>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} width={1040} height={720}>
      <WizardChrome>
        {/* One block: the left cell names the flow and how far through it,
            over the rail it summarises; the right cell is the section in hand
            and the one instruction for it; the run rides the bottom edge.
            Section identity is chrome, so it stays pinned while the pane
            scrolls instead of scrolling away with the first row. */}
        <WizardHeader
          railSummary={(
            <WizardRailSummary icon={Target} title="Scope Review" />
          )}
          eyebrow={sectionHeading.eyebrow}
          title={sectionHeading.title}
          description={sectionHeading.description}
          progress={{ value: progressValue, total: SECTION_ORDER.length, label: "Scope review progress" }}
          onClose={<ModalCloseButton onClose={onClose} />}
        />

        <WizardBody>
          <WizardRail label="Scope review">
            <RailGroup connected>
              <RailItem
                icon={naMeta.Icon}
                title="Not In Scope"
                detail={controlCount(outOfScopeControls)}
                state={outOfScopeState}
                complete={outOfScopeDone}
                onClick={() => setView("out-of-scope")}
              />
              <RailItem
                icon={RESPONSIBILITY_META[RESPONSIBILITIES.VENDOR].Icon}
                title="External Inheritance"
                detail={controlCount(externalControls)}
                state={externalState}
                complete={externalDone}
                onClick={() => setView("external")}
              />
              <RailItem
                icon={RESPONSIBILITY_META[RESPONSIBILITIES.ENTERPRISE].Icon}
                title="Internal Inheritance"
                detail={controlCount(internalControls)}
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
                  : `After scope review · ${technicalRemaining} to grade`}
                state="pending"
                disabled={!readyForAssessment}
                onClick={() => { onClose(); onStartTechnicalReview(); }}
              />
            </RailGroup>
          </WizardRail>

          <WizardPane>
            {saveError && <SaveErrorCallout problems={saveError} />}

            {/* The reviewer of record was a text field here until sign-in
                arrived: it appeared when it was missing, because that was
                exactly when it blocked the work. There is nothing left to fill
                in — every decision is signed by whoever is signed in — so the
                only thing that can block the work now is not being allowed to
                do it, and that is what this says (6.3, 6.4). */}
            {!canWrite && (
              <Callout tone="warning" title="You can read this review, but not change it.">
                <p>
                  Scope decisions are recorded against the assessor who made them. Nothing on this
                  screen will save while you are signed in as {user.name}.
                </p>
              </Callout>
            )}

            {view === "out-of-scope" && everythingDone && (
              <CompletionScreen
                title="Scope confirmed"
                description="Every exclusion carries a named reviewer's decision and every inherited claim names the report it stands on. This is the record an auditor will ask for."
                tiles={
                  <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                    <StatTile label="In scope" value={summary.applicable} />
                    <StatTile label="Not In Scope" value={naItems.length} />
                    <StatTile label="Claims confirmed" value={groups.length} />
                    <StatTile label="To grade" value={technicalRemaining} hint="Key controls the assessment walk will ask about" />
                  </div>
                }
                signature={<>Reviewed by <b style={{ color: C.ink }}>{canWrite ? user.name : assessor}</b> · completed {today()}</>}
              />
            )}

            {view === "out-of-scope" && !everythingDone && (
              <>
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

                {noAssetControls.length > 0 && (
                  <Section
                    icon={Target}
                    title="Asset coverage decisions"
                    description="Resolve these before grading so the assessment never stops on a control with no valid asset population."
                    aside={(
                      <div className="flex items-center gap-2">
                        {noAssetControls.length > 1 && (
                          <Button size="sm" variant="primary" icon={Check} disabled={!canWrite} onClick={confirmAllNoAssetOut}>
                            Confirm all {noAssetControls.length} Not In Scope
                          </Button>
                        )}
                        <StatusPill tone="warning">{noAssetControls.length} to decide</StatusPill>
                      </div>
                    )}
                  >
                    <Well padded={false}>
                      {noAssetControls.map((control, index) => noAssetRow(control, index === noAssetControls.length - 1))}
                    </Well>
                  </Section>
                )}

                <Section
                  icon={Ban}
                  title="Derived exclusions"
                  description="Controls whose premise does not hold in this boundary. Read the reason, then confirm — or pull the control back into scope."
                  aside={exclusionsRemaining.length > 1 ? (
                    <Button size="sm" variant="primary" icon={Check} disabled={!canWrite} onClick={confirmAllExclusions}>
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
                    it sits inside Not In Scope rather than earning a rail
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
                title={view === "external" ? "Provider-covered domains" : "ACME-run programs"}
                aside={(() => {
                  const shown = view === "external" ? externalGroups : internalGroups;
                  const unit = view === "external" ? "claim" : "program";
                  const remainingGroups = shown.filter((g) => g.remaining.length > 0);
                  const done = view === "external" ? externalDone : internalDone;
                  return (
                    <div className="flex items-center gap-2">
                      {remainingGroups.length > 1 && (
                        <Button size="sm" variant="primary" icon={Check} disabled={!canWrite} onClick={() => confirmAllGroups(remainingGroups)}>
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
