import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, FileWarning, Target, Wrench } from "lucide-react";
import { useLiveEngine } from "../../engine/useLiveEngine";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, CompletionScreen, WizardChrome, WizardFooter, WizardHeader,
  GUIDED_WORKFLOW_HEADER_MIN_HEIGHT, GUIDED_WORKFLOW_MODAL, WizardOutcomePane, WizardStageStrip,
} from "../../components/wizard/WizardUI";
import type { WizardStageNavigation, WizardStageStripItem } from "../../components/wizard/WizardUI";
import { ScopeReviewModal } from "./ScopeReviewModal";
import { ControlAssessmentWalk } from "./ControlAssessmentWalk";
import { ControlEvaluationPanel } from "./ControlEvaluationPanel";
import type { EvaluationStep } from "./ControlEvaluationPanel";
import type { SystemId } from "../../graph/ids";
import type { ControlMatrixRow } from "./types";

export type AssuranceStageId = "scope" | "assess" | "findings" | "remediate";

interface AssuranceWorkflowProps {
  open: boolean;
  systemId: SystemId;
  initialStage?: AssuranceStageId;
  onClose: () => void;
  onEditAssets?: () => void;
}

interface WorkItem {
  key: string;
  group: string;
  row: ControlMatrixRow;
  initialStep: EvaluationStep;
}

const FINDING_GROUPS = ["Needs Finding", "Needs CAP"] as const;
const REMEDIATION_GROUPS = ["Open remediation", "Ready to reassess"] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ActionWalk({
  open, systemId, stage, workflowNavigation, onClose, onContinue,
}: {
  open: boolean;
  systemId: SystemId;
  stage: "findings" | "remediate";
  workflowNavigation: WizardStageNavigation;
  onClose: () => void;
  onContinue: () => void;
}) {
  const liveEngine = useLiveEngine();
  const system = liveEngine.rollups.systemRollups.find((candidate) => candidate.id === systemId);
  const matrix = useMemo(() => liveEngine.compliance.systemControlMatrix(systemId).map((row) => ({
    ...row,
    responsibility: liveEngine.compliance.responsibilityForControl(systemId, row.controlId),
  })), [liveEngine, systemId]);
  const formalAssessment = useMemo(
    () => liveEngine.review.formalAssessmentForSystem(systemId),
    [liveEngine, systemId],
  );
  const rowById = useMemo(
    () => new Map(matrix.map((row) => [row.controlId, row])),
    [matrix],
  );

  const queue = useMemo<WorkItem[]>(() => {
    if (stage === "findings") {
      return [
        ...formalAssessment.gapControlsMissingFinding.flatMap(({ controlId }) => {
          const row = rowById.get(controlId);
          return row ? [{ key: `finding:${controlId}`, group: FINDING_GROUPS[0], row, initialStep: "findings" as const }] : [];
        }),
        ...formalAssessment.gapControlsMissingCap.flatMap(({ controlId }) => {
          const row = rowById.get(controlId);
          return row ? [{ key: `cap:${controlId}`, group: FINDING_GROUPS[1], row, initialStep: "findings" as const }] : [];
        }),
      ];
    }

    const awaitingReassessment = new Set(formalAssessment.controlsAwaitingReassessment.map(({ controlId }) => controlId));
    return formalAssessment.residualControls.flatMap(({ controlId }) => {
      const row = rowById.get(controlId);
      if (!row) return [];
      const reassess = awaitingReassessment.has(controlId);
      return [{
        key: `${reassess ? "reassess" : "remediate"}:${controlId}`,
        group: reassess ? REMEDIATION_GROUPS[1] : REMEDIATION_GROUPS[0],
        row,
        initialStep: reassess ? "scoring" as const : "findings" as const,
      }];
    });
  }, [formalAssessment, rowById, stage]);

  const groups = stage === "findings" ? FINDING_GROUPS : REMEDIATION_GROUPS;
  const [activeGroup, setActiveGroup] = useState<string>(groups[0]);
  const [initialTotal, setInitialTotal] = useState(0);
  const [groupTotals, setGroupTotals] = useState<Record<string, number>>({});
  const [handledKeys, setHandledKeys] = useState<ReadonlySet<string>>(new Set());
  const [skippedKeys, setSkippedKeys] = useState<ReadonlySet<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }
    const totals: Record<string, number> = Object.fromEntries(groups.map((group) => [group, 0]));
    queue.forEach((item) => { totals[item.group] = (totals[item.group] ?? 0) + 1; });
    setActiveGroup(groups.find((group) => totals[group] > 0) ?? groups[0]);
    setInitialTotal(queue.length);
    setGroupTotals(totals);
    setHandledKeys(new Set());
    setSkippedKeys(new Set());
    setInitialized(true);
    // The queue is intentionally snapshotted when this stage opens. Live
    // changes are still read below; they do not restart the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage]);

  useEffect(() => {
    if (!open) return;
    setGroupTotals((current) => {
      const next = { ...current };
      groups.forEach((group) => {
        const observed = queue.filter((item) => item.group === group).length
          + [...handledKeys].filter((key) => key.startsWith(group === FINDING_GROUPS[0] ? "finding:" : group === FINDING_GROUPS[1] ? "cap:" : group === REMEDIATION_GROUPS[1] ? "reassess:" : "remediate:")).length;
        next[group] = Math.max(next[group] ?? 0, observed);
      });
      return next;
    });
  }, [open, queue, groups, handledKeys]);

  const remainingByGroup = useMemo(() => {
    const result: Record<string, WorkItem[]> = Object.fromEntries(groups.map((group) => [group, []]));
    queue.forEach((item) => {
      if (!handledKeys.has(item.key) && !skippedKeys.has(item.key)) result[item.group].push(item);
    });
    return result;
  }, [groups, handledKeys, queue, skippedKeys]);

  useEffect(() => {
    if (!open || (remainingByGroup[activeGroup]?.length ?? 0) > 0) return;
    const next = groups.find((group) => (remainingByGroup[group]?.length ?? 0) > 0);
    if (next && next !== activeGroup) setActiveGroup(next);
  }, [activeGroup, groups, open, remainingByGroup]);

  if (!open || !system) return null;

  const current = remainingByGroup[activeGroup]?.[0] ?? null;
  const remainingTotal = groups.reduce((sum, group) => sum + (remainingByGroup[group]?.length ?? 0), 0);
  const skippedCount = skippedKeys.size;
  const handledCount = handledKeys.size;
  const runTotal = Math.max(initialTotal, remainingTotal + skippedCount + handledCount);
  const complete = initialized && remainingTotal === 0;
  const stageTitle = stage === "findings" ? "File Findings & CAPs" : "Remediate";
  const StageIcon = stage === "findings" ? FileWarning : Wrench;
  const liveOutstanding = stage === "findings"
    ? formalAssessment.gapControlsMissingFinding.length + formalAssessment.gapControlsMissingCap.length
    : formalAssessment.residualCount;

  if (complete) {
    const paused = skippedCount > 0 || liveOutstanding > 0;
    return (
      <Modal open onClose={onClose} width={GUIDED_WORKFLOW_MODAL.width} height={GUIDED_WORKFLOW_MODAL.height}>
        <WizardChrome>
          <WizardHeader
            minHeight={GUIDED_WORKFLOW_HEADER_MIN_HEIGHT}
            icon={StageIcon}
            eyebrow={`System Assurance · ${handledCount} worked`}
            title={paused ? `${stageTitle} paused` : `${stageTitle} complete`}
            onClose={<ModalCloseButton onClose={onClose} />}
          />
          <WizardStageStrip {...workflowNavigation} />
          <WizardOutcomePane>
            <CompletionScreen
              title={paused ? `${liveOutstanding} item${liveOutstanding === 1 ? "" : "s"} still require attention` : `No ${stageTitle.toLowerCase()} work remains`}
              description={paused
                ? "Saved work is on record. Skipped or still-open items remain in this stage and will be here when the workflow is reopened."
                : stage === "findings"
                  ? "Every assessed gap has a Finding with a corrective action plan on record."
                  : "Every remediation item in this run is cleared or ready for its next recorded review."}
              signature={<>Updated by the signed-in operator · {today()}</>}
            />
          </WizardOutcomePane>
          <WizardFooter
            position={`${handledCount} worked${skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}`}
            close={<Button onClick={onClose}>Close</Button>}
            primary={skippedCount > 0
              ? <Button variant="primary" onClick={() => setSkippedKeys(new Set())}>Review skipped items · {skippedCount}</Button>
              : <Button variant="primary" iconRight={ArrowRight} onClick={onContinue}>{stage === "findings" ? "Continue to Remediate" : "Finish workflow"}</Button>}
          />
        </WizardChrome>
      </Modal>
    );
  }

  if (!current) return null;

  const recordHandled = () => setHandledKeys((previous) => new Set(previous).add(current.key));
  return (
    <ControlEvaluationPanel
      key={current.key}
      row={current.row}
      system={system}
      initialStep={current.initialStep}
      workflowNavigation={workflowNavigation}
      onClose={onClose}
      walk={{
        title: stageTitle,
        icon: StageIcon,
        groupLabel: `${stageTitle} queue`,
        domains: groups.map((group) => ({
          domain: group,
          total: groupTotals[group] ?? 0,
          remaining: remainingByGroup[group]?.length ?? 0,
        })),
        activeDomain: activeGroup,
        onSelectDomain: setActiveGroup,
        decidedCount: handledCount,
        initialTotal: Math.max(1, runTotal),
        onRecorded: recordHandled,
        onDraftSaved: recordHandled,
        onSkip: () => setSkippedKeys((previous) => new Set(previous).add(current.key)),
      }}
    />
  );
}

export function AssuranceWorkflow({
  open, systemId, initialStage = "scope", onClose, onEditAssets,
}: AssuranceWorkflowProps) {
  const liveEngine = useLiveEngine();
  const system = liveEngine.rollups.systemRollups.find((candidate) => candidate.id === systemId);
  const formalAssessment = useMemo(
    () => liveEngine.review.formalAssessmentForSystem(systemId),
    [liveEngine, systemId],
  );
  const [stage, setStage] = useState<AssuranceStageId>(initialStage);

  useEffect(() => {
    if (open) setStage(initialStage);
  }, [initialStage, open, systemId]);

  if (!open || !system) return null;

  const findingsRemaining = formalAssessment.gapControlsMissingFinding.length
    + formalAssessment.gapControlsMissingCap.length;
  const stages: WizardStageStripItem[] = [
    {
      id: "scope", title: "Confirm Scope", icon: Target,
      detail: `${formalAssessment.scopeRemainingCount} remaining`,
      complete: formalAssessment.scopeDecided,
    },
    {
      id: "assess", title: "Assess Controls", icon: ClipboardCheck,
      detail: `${formalAssessment.assessmentRemainingCount} remaining`,
      complete: formalAssessment.controlsAssessed,
    },
    {
      id: "findings", title: "File Findings & CAPs", icon: FileWarning,
      detail: `${findingsRemaining} remaining`,
      complete: formalAssessment.gapsRecorded,
    },
    {
      id: "remediate", title: "Remediate", icon: Wrench,
      detail: `${formalAssessment.residualCount} remaining`,
      complete: formalAssessment.residualCount === 0,
    },
  ];
  const workflowNavigation: WizardStageNavigation = {
    stages,
    activeId: stage,
    label: "System assurance stages",
    onSelect: (id) => setStage(id as AssuranceStageId),
  };
  const assessor = liveEngine.graph.assessmentScopeBySystem[systemId]?.assessor ?? "";

  if (stage === "scope") {
    return (
      <ScopeReviewModal
        open
        systemId={systemId}
        assessor={assessor}
        onClose={onClose}
        onStartTechnicalReview={() => setStage("assess")}
        onContinue={() => setStage("assess")}
        continueLabel="Assess Controls"
        continueCount={formalAssessment.assessmentRemainingCount}
        onEditAssets={onEditAssets}
        workflowNavigation={workflowNavigation}
      />
    );
  }

  if (stage === "assess") {
    return (
      <ControlAssessmentWalk
        open
        systemId={systemId}
        onClose={onClose}
        onContinueToFindings={() => setStage("findings")}
        workflowNavigation={workflowNavigation}
        allowEmptyCompletion
      />
    );
  }

  return (
    <ActionWalk
      key={stage}
      open
      systemId={systemId}
      stage={stage}
      workflowNavigation={workflowNavigation}
      onClose={onClose}
      onContinue={() => stage === "findings" ? setStage("remediate") : onClose()}
    />
  );
}
