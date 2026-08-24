import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Wrench } from "lucide-react";
import { C } from "../../theme";
import { useLiveEngine } from "../../engine/useLiveEngine";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, CompletionScreen, StatTile, WizardChrome,
  GUIDED_WORKFLOW_HEADER_MIN_HEIGHT, GUIDED_WORKFLOW_MODAL, WizardFooter, WizardHeader, WizardMiniFlow, WizardOutcomePane,
} from "../../components/wizard/WizardUI";
import type { WizardStageNavigation } from "../../components/wizard/WizardUI";
import { ControlEvaluationPanel } from "./ControlEvaluationPanel";
import { keyControlAssessmentQueue } from "./recordAssessment";
import type { ControlId, SystemId } from "../../graph/ids";
import type { ControlMatrixRow } from "./types";
import { useSignedInUser } from "../../auth/useUser";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// What the walk holds on screen between one control and the next. The panel is
// keyed on the control id and rebuilt from scratch each time, so an in-panel
// transition cannot survive the swap — the hold has to live out here, where it
// also gets to say what was recorded and what is coming.
interface ControlAssessmentWalkProps {
  open: boolean;
  systemId: SystemId;
  onClose: () => void;
  // Wired up so the completion screen can hand off straight to the first
  // assessed gap that still needs its Finding/CAP recorded.
  onContinueToFindings?: () => void;
  workflowNavigation?: WizardStageNavigation;
  allowEmptyCompletion?: boolean;
}

// The key-control walk: applicable key controls grouped by domain, worked one
// at a time with auto-advance to the next domain with work left. This is only
// the orchestration — queue snapshot, active domain, skip list,
// completion screen. The control itself renders in ControlEvaluationPanel
// (the same full panel a Controls-tab row click opens), passed the walk
// chrome via its `walk` prop, so there is exactly one assessment UI.
export function ControlAssessmentWalk({
  open, systemId, onClose, onContinueToFindings, workflowNavigation, allowEmptyCompletion = false,
}: ControlAssessmentWalkProps) {
  const liveEngine = useLiveEngine();
  const user = useSignedInUser();
  const system = liveEngine.rollups.systemRollups.find((s) => s.id === systemId);
  const matrix = liveEngine.compliance.systemControlMatrix(systemId).map((row) => ({
    ...row,
    responsibility: liveEngine.compliance.responsibilityForControl(systemId, row.controlId),
  }));
  // Same exclusion Scope Review counts against: a key control still waiting
  // on an inheritance decision does not belong in this walk — that decision
  // is Scope Review's, not a rating the assessor should be asked to invent.
  const scopeWaves = liveEngine.review.wavesForSystem(systemId).waves;
  const pendingScopeIds = new Set([
    ...scopeWaves["vendor-inherited"].remaining.map((item) => item.control.id),
    ...scopeWaves.enterprise.remaining.map((item) => item.control.id),
  ]);
  const queue = keyControlAssessmentQueue(
    matrix,
    pendingScopeIds,
  );

  // Build the first queue frame synchronously. The workflow swaps phases by
  // mounting this walk, so empty initial state made the modal disappear for
  // one paint before the open effect populated the queue.
  const startingTotals: Record<string, number> = {};
  queue.forEach((row) => {
    startingTotals[row.control.domain] = (startingTotals[row.control.domain] ?? 0) + 1;
  });
  const startingOrder = Object.keys(startingTotals).sort();

  const [domainOrder, setDomainOrder] = useState<string[]>(startingOrder);
  const [domainTotals, setDomainTotals] = useState<Record<string, number>>(startingTotals);
  const [activeDomain, setActiveDomain] = useState(startingOrder[0] ?? "");
  const [initialTotal, setInitialTotal] = useState(queue.length);
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<ControlId>>(new Set());
  const [recordedIds, setRecordedIds] = useState<ReadonlySet<ControlId>>(new Set());
  const [initialized, setInitialized] = useState(open);

  // Skipped controls stay unassessed (and in the live queue) but leave the
  // walk's "remaining" view, so the walk can finish around them.
  const remainingByDomain = useMemo(() => {
    const groups: Record<string, ControlMatrixRow[]> = {};
    queue.forEach((row) => {
      if (!skippedIds.has(row.controlId) && !recordedIds.has(row.controlId)) {
        (groups[row.control.domain] ??= []).push(row);
      }
    });
    return groups;
  }, [queue, skippedIds, recordedIds]);

  // Reset to a clean slate every time the walk opens, snapshotting the
  // starting queue and its domain breakdown — the rail's totals and order
  // stay fixed for the session even as items leave "remaining" one by one.
  useEffect(() => {
    if (!open) return;
    setSkippedIds(new Set());
    setRecordedIds(new Set());
    const totals: Record<string, number> = {};
    queue.forEach((row) => { totals[row.control.domain] = (totals[row.control.domain] ?? 0) + 1; });
    const order = Object.keys(totals).sort();
    setDomainTotals(totals);
    setDomainOrder(order);
    setInitialTotal(queue.length);
    setActiveDomain(order[0] ?? "");
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Once the active domain empties, move on to the next domain with work
  // left — wrapping back to earlier domains so finishing a later one the
  // operator jumped to doesn't strand undone work behind a false completion.
  useEffect(() => {
    if (!open) return;
    if ((remainingByDomain[activeDomain]?.length ?? 0) > 0) return;
    const idx = domainOrder.indexOf(activeDomain);
    const next = domainOrder.slice(idx + 1).find((d) => (remainingByDomain[d]?.length ?? 0) > 0)
      ?? domainOrder.find((d) => (remainingByDomain[d]?.length ?? 0) > 0);
    if (next && next !== activeDomain) setActiveDomain(next);
  }, [open, activeDomain, remainingByDomain, domainOrder]);

  if (!open || !system) return null;

  const current = remainingByDomain[activeDomain]?.[0] ?? null;
  const remainingTotal = Object.values(remainingByDomain).reduce((sum, rows) => sum + rows.length, 0);
  const skippedCount = queue.filter((row) => skippedIds.has(row.controlId)).length;
  const decidedCount = Math.max(0, initialTotal - remainingTotal - skippedCount);
  const complete = initialized && remainingTotal === 0 && (initialTotal > 0 || allowEmptyCompletion);
  const formalAssessment = liveEngine.review.formalAssessmentForSystem(systemId);
  const filingCount = formalAssessment.gapControlsMissingFinding.length + formalAssessment.gapControlsMissingCap.length;

  if (complete) {
    return (
      <Modal
        requiresRoom="The control assessment walk"
        open
        onClose={onClose}
        width={workflowNavigation ? GUIDED_WORKFLOW_MODAL.width : 880}
        height={workflowNavigation ? GUIDED_WORKFLOW_MODAL.height : 620}
      >
        <WizardChrome>
          {/* The run is over, so this screen has no rail to head and takes
              the masthead without its rail-summary cell (4.11). The header
              names the outcome rather than a step, and the bar reads full —
              the completion panel is not step N of anything (4.9). */}
          <WizardHeader
            minHeight={workflowNavigation ? GUIDED_WORKFLOW_HEADER_MIN_HEIGHT : undefined}
            icon={ClipboardCheck}
            eyebrow={`Control Assessment · ${decidedCount} of ${initialTotal} assessed`}
            title={skippedCount > 0 ? "Assessment walk paused" : "Control assessment complete"}
            progress={{ value: initialTotal, total: initialTotal, label: "Control assessment progress" }}
            aside={workflowNavigation ? <WizardMiniFlow {...workflowNavigation} /> : undefined}
            onClose={<ModalCloseButton onClose={onClose} />}
          />
          <WizardOutcomePane>
            <CompletionScreen
              title={skippedCount > 0 ? "Some controls still need a decision" : "Every key control is assessed"}
              description={skippedCount > 0
                ? `${decidedCount} of ${initialTotal} applicable key controls now have a recorded assessment; ${skippedCount} still need a decision.`
                : "Every applicable key control on this boundary now has a recorded fact behind its score."}
              tiles={domainOrder.length > 0 ? (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                  {domainOrder.map((domain) => (
                    <StatTile key={domain} label={domain} value={domainTotals[domain]} />
                  ))}
                </div>
              ) : undefined}
              signature={<>Reviewed by <b style={{ color: C.ink }}>{user.name}</b> &middot; completed {today()}</>}
            />
          </WizardOutcomePane>
          <WizardFooter
            position={`${decidedCount} of ${initialTotal} assessed`}
            close={<Button onClick={onClose}>Close</Button>}
            primary={skippedCount > 0
              ? (
                <Button variant="primary" iconRight={ArrowRight} onClick={() => setSkippedIds(new Set())}>
                  Review skipped controls &middot; {skippedCount}
                </Button>
              )
              : onContinueToFindings
                ? (
                <Button
                  variant="primary"
                  icon={Wrench}
                  iconRight={ArrowRight}
                  onClick={onContinueToFindings}
                >
                  Continue to File Findings &amp; CAPs{filingCount > 0 ? ` · ${filingCount}` : ""}
                </Button>
                )
                : undefined}
          />
        </WizardChrome>
      </Modal>
    );
  }

  // A missing current item can still occur while live engine facts change.
  // The initial workflow frame is populated synchronously above.
  if (!current) return null;

  return (
    <ControlEvaluationPanel
      key={current.controlId}
      row={current}
      system={system}
      onClose={onClose}
      walk={{
        domains: domainOrder.map((domain) => ({
          domain,
          total: domainTotals[domain] ?? 0,
          remaining: remainingByDomain[domain]?.length ?? 0,
        })),
        activeDomain,
        onSelectDomain: setActiveDomain,
        decidedCount,
        initialTotal,
        onRecorded: (_rating, continueWalk) => {
          setRecordedIds((previous) => new Set(previous).add(current.controlId));
          if (!continueWalk) {
            onClose();
          }
        },
        onSkip: () => setSkippedIds((prev) => new Set(prev).add(current.controlId)),
      }}
      workflowNavigation={workflowNavigation}
    />
  );
}
