import React, { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { getAllSystems } from "../../engine";
import { SUB_TABS } from "./tabs";
import { STATUS_ORDER } from "./controlMeta";
import { SystemHeader } from "./SystemHeader";
import { SystemOverview } from "./SystemOverview";
import { SystemArchitecture } from "./SystemArchitecture";
import { SystemData } from "./SystemData";
import { SystemIdentity } from "./SystemIdentity";
import { SystemSecurity } from "./SystemSecurity";
import { SystemTesting } from "./SystemTesting";
import { SystemControls, DEFAULT_SELECTION } from "./SystemControls";
import type { ControlSelection } from "./SystemControls";
import { ScopeReviewModal } from "./ScopeReviewModal";
import { SystemRisk } from "./SystemRisk";
import { SystemFindings } from "./SystemFindings";
import { SystemAssets } from "./SystemAssets";
import { SystemActions } from "./SystemActions";
import { ControlEvaluationPanel } from "./ControlEvaluationPanel";
import type { EvaluationStep } from "./ControlEvaluationPanel";
import { ControlAssessmentWalk } from "./ControlAssessmentWalk";
import { keyControlAssessmentQueue } from "./recordAssessment";
import AddSystemWizard from "../../components/AddSystemWizard";
import type { ControlId, SystemId } from "../../graph/ids";
import type { SystemWorkspaceTab } from "./tabs";
import type { ReviewWave } from "../../engine/review";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { useSignedInUser } from "../../auth/useUser";
import { canAssess, canEditSystem, allows } from "../../auth/gates";

const SYSTEMS = getAllSystems();

// Opens on Production AI Platform — the system most worth landing on by
// default — falling back to the first system if it's ever renamed or removed.
const DEFAULT_SYSTEM = SYSTEMS.find((s) => s.name === "Production AI Platform") ?? SYSTEMS[0];
if (!DEFAULT_SYSTEM) throw new Error("System workspace requires at least one system.");
export const DEFAULT_SYSTEM_ID = DEFAULT_SYSTEM.id;

interface SystemWorkspaceProps {
  systemId?: SystemId | null;
  onSelectSystem?: (systemId: SystemId) => void;
  initialSubTab?: SystemWorkspaceTab | null;
  onSubTabChange?: (tab: SystemWorkspaceTab) => void;
  onNavigate?: (target: string) => void;
  startAssessment?: boolean;
}

export default function SystemWorkspace({ systemId: controlledSystemId, onSelectSystem, initialSubTab, onSubTabChange, onNavigate, startAssessment = false }: SystemWorkspaceProps) {
  const [localSystemId, setLocalSystemId] = useState(DEFAULT_SYSTEM_ID);
  const systemId = controlledSystemId ?? localSystemId;
  const [subTab, setSubTab] = useState<SystemWorkspaceTab>(SUB_TABS.some((t) => t.id === initialSubTab) ? initialSubTab! : SUB_TABS[0].id);
  // The route (URL hash) can change the requested tab after mount — e.g. the
  // browser back button — so follow it whenever it names a valid tab.
  useEffect(() => {
    if (initialSubTab && SUB_TABS.some((t) => t.id === initialSubTab)) setSubTab(initialSubTab);
  }, [initialSubTab]);
  // All user-driven tab changes go through here so the route stays in sync.
  function changeSubTab(tab: SystemWorkspaceTab) {
    setSubTab(tab);
    onSubTabChange?.(tab);
  }
  const [selectedControlId, setSelectedControlId] = useState<ControlId | null>(null);
  // Which step ControlEvaluationPanel should land on for the control above —
  // set alongside selectedControlId so a caller (SystemActions' rows) can
  // land straight on Findings & Remediation instead of Control Scoring.
  const [selectedControlStep, setSelectedControlStep] = useState<EvaluationStep | undefined>(undefined);
  const [scopeReviewOpen, setScopeReviewOpen] = useState(false);
  const [requestedWave, setRequestedWave] = useState<ReviewWave | null>(null);
  const [assessmentWalkOpen, setAssessmentWalkOpen] = useState(false);
  const [controlsSelection, setControlsSelection] = useState<ControlSelection | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitialStep, setEditorInitialStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [resumeScopeAfterEdit, setResumeScopeAfterEdit] = useState(false);
  const assessmentStarted = useRef(false);
  const liveEngine = useLiveEngine();
  const user = useSignedInUser();
  const systems = liveEngine.rollups.systemRollups;

  const system = systems.find((s) => s.id === systemId);
  if (!system) throw new Error(`Unknown system: ${systemId}`);
  // The assessment walk is not offered to someone who could not record a single
  // control at the end of it. The panel still says why on the one case that is
  // a refusal rather than an absence — an assessor who owns this system.
  const mayAssess = allows(canAssess(user, system));
  const activeSystemId = system.id;
  const reportSystem = system;
  const matrix = useMemo(
    () => liveEngine.compliance.systemControlMatrix(system.id).map((row) => ({
      ...row,
      responsibility: liveEngine.compliance.responsibilityForControl(system.id, row.controlId),
    })),
    [liveEngine, system]
  );
  const selectedRow = selectedControlId ? matrix.find((row) => row.controlId === selectedControlId) ?? null : null;
  const applicabilitySummary = useMemo(() => liveEngine.compliance.controlApplicabilitySummary(system.id), [liveEngine, system]);
  const coverageBreakdown = useMemo(() => liveEngine.compliance.systemCoverageBreakdown(system.id), [liveEngine, system]);
  // Three separately-meaningful numbers, not one score read three ways:
  // compliance asks whether what was assessed holds, assurance is the
  // criticality-weighted rollup across every category, coverage asks how much
  // of what applies was ever looked at. See CLAUDE.md — keeping these apart is
  // a project rule, not a UI choice.
  const posture = useMemo(() => ({
    compliance: coverageBreakdown.coveredPct,
    assurance: system.overallAssurance,
    coverage: coverageBreakdown.assessedPct,
  }), [coverageBreakdown, system]);

  const cockpit = useMemo(() => liveEngine.cockpit.cockpitSummary(system.id), [liveEngine, system]);
  const dueRecurring = useMemo(() => liveEngine.cockpit.dueRecurringForSystem(system.id), [liveEngine, system]);
  const identity = useMemo(() => liveEngine.identity.identityPostureForSystem(system.id), [liveEngine, system]);
  const exposure = useMemo(() => liveEngine.exposure.exposureForSystem(system.id), [liveEngine, system]);
  const secTests = useMemo(() => liveEngine.securityTesting.securityTestsForSystem(system.id), [liveEngine, system]);
  const ir = useMemo(() => liveEngine.incidentResponse.irForSystem(system.id), [liveEngine, system]);
  const resilience = useMemo(() => liveEngine.resilience.resilienceForSystem(system.id), [liveEngine, system]);
  const vendors = useMemo(() => liveEngine.vendors.vendorsForSystem(system.id), [liveEngine, system]);
  const vuln = useMemo(() => liveEngine.vulnerabilities.vulnerabilitiesForSystem(system.id), [liveEngine, system]);
  const sdlc = useMemo(() => liveEngine.sdlc.sdlcForSystem(system.id), [liveEngine, system]);
  const topRisks = useMemo(() => liveEngine.risk.topRisksForSystem(system.id, 5), [liveEngine, system]);
  const dataTypes = useMemo(() => liveEngine.classification.dataTypesForSystem(system.id), [liveEngine, system]);
  const backupRecovery = useMemo(() => liveEngine.rollups.flowLayoutForSystem(system.id).backupRecovery, [liveEngine, system]);

  const statusCounts = useMemo(() => {
    const counts: Record<(typeof STATUS_ORDER)[number], number> = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<(typeof STATUS_ORDER)[number], number>;
    matrix.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [matrix]);
  const assessmentQueue = useMemo(
    () => keyControlAssessmentQueue(
      matrix,
    ),
    [matrix]
  );

  const assessor = liveEngine.graph.assessmentScopeBySystem[system.id]?.assessor ?? "";

  useEffect(() => {
    if (!startAssessment || assessmentStarted.current) return;
    assessmentStarted.current = true;
    setRequestedWave(null);
    setScopeReviewOpen(true);
  }, [startAssessment]);

  function openAssessmentWalk() {
    setAssessmentWalkOpen(true);
  }

  function openScopeReview(wave: ReviewWave = "not-applicable") {
    setRequestedWave(wave);
    setScopeReviewOpen(true);
  }

  function openControlsGroup(selection: ControlSelection) {
    setControlsSelection(selection);
    changeSubTab("controls");
  }

  // The one place a control gets opened in ControlEvaluationPanel — used by
  // both the Controls table's row click and the Actions tab's rows, so a
  // caller that already knows which step matters (e.g. Findings &
  // Remediation, for a gap with nothing filed yet) can say so.
  function selectControl(controlId: ControlId, step?: EvaluationStep) {
    setSelectedControlId(controlId);
    setSelectedControlStep(step);
  }

  const findings = useMemo(() => liveEngine.findings.findingsForSystem(system.id), [liveEngine, system]);
  // Open findings per control, so the table can show a count without every
  // row re-filtering the system's whole findings list.
  const findingsByControl = useMemo(() => {
    const counts: Partial<Record<ControlId, number>> = {};
    findings.forEach((f) => {
      if (f.open) {
        counts[f.controlId] = (counts[f.controlId] ?? 0) + 1;
      }
    });
    return counts;
  }, [findings]);

  // Read, not derived here. The four System Readiness lanes are one engine
  // derivation (review.formalAssessmentForSystem) so the export, the cockpit
  // and this page cannot drift into three answers.
  const formalAssessment = useMemo(
    () => liveEngine.review.formalAssessmentForSystem(system.id),
    [liveEngine, system.id]
  );

  function openMissingFinding() {
    // A program control can retain a historical partial assessment after its
    // applicability premise is removed. The graph correctly refuses to hang a
    // new system finding on that out-of-scope program, so do not route the
    // operator into an editor that can only reject the finding. Scope Review
    // remains the place to resolve that stale applicability decision.
    const firstGap = formalAssessment.gapControlsMissingFinding.find(({ controlId }) => {
      const gapRow = matrix.find((candidate) => candidate.controlId === controlId);
      return gapRow?.keyControl?.scope !== "program"
        || liveEngine.applicability.resolveProgramApplicability(activeSystemId, controlId).required;
    });
    if (firstGap) selectControl(firstGap.controlId, "findings");
    else openControlsGroup(DEFAULT_SELECTION);
  }

  async function generateIsoReport() {
    const { exportIso27001SystemReportPdf } = await import("../../utils/exportIso27001SystemReportPdf");
    await exportIso27001SystemReportPdf({
      system: reportSystem,
      cockpit,
      matrix,
      applicabilitySummary,
      dataTypes,
      identity,
      exposure,
      resilience,
      securityTesting: secTests,
      incidentResponse: ir,
      vendors,
      topRisks,
    });
  }

  function selectSystem(id: SystemId) {
    if (onSelectSystem) onSelectSystem(id);
    else setLocalSystemId(id);
    setSubTab(SUB_TABS[0].id);
    setSelectedControlId(null);
  }

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SystemHeader
        system={system}
        systems={systems}
        systemId={systemId}
        onSelectSystem={selectSystem}
        onEdit={allows(canEditSystem(user, system)) ? () => { setEditorInitialStep(1); setResumeScopeAfterEdit(false); setEditorOpen(true); } : undefined}
        formallyAssessed={formalAssessment.complete}
      />

      <WorkspaceTabBar tabs={SUB_TABS} active={subTab} onChange={changeSubTab} />

      <div className="pt-6" />

      {subTab === "overview" && (
        <SystemOverview
          system={system} cockpit={cockpit} compliance={posture.compliance}
          exposure={exposure}
          dataTypes={dataTypes} onNavigate={changeSubTab}
          onOpenScopeReview={openScopeReview} onSelectControlsGroup={openControlsGroup}
          onOpenMissingFinding={openMissingFinding}
          onStartAssessment={mayAssess && formalAssessment.scopeDecided && assessmentQueue.length > 0 ? openAssessmentWalk : undefined}
          onGenerateIsoReport={generateIsoReport}
          formalAssessment={formalAssessment}
        />
      )}

      {subTab === "architecture" && (
        <SystemArchitecture systemId={systemId} onSelectSystem={selectSystem} />
      )}

      {subTab === "data" && <SystemData system={system} dataTypes={dataTypes} resilience={resilience} backupRecovery={backupRecovery} />}

      {subTab === "identity" && <SystemIdentity system={system} identity={identity} exposure={exposure} />}

      {subTab === "security" && (
        <SystemSecurity exposure={exposure} sdlc={sdlc} vendors={vendors} onOpenExceptionRegister={() => onNavigate?.("exception-register")} />
      )}

      {subTab === "testing" && (
        <SystemTesting secTests={secTests} vuln={vuln} ir={ir} resilience={resilience} vendors={vendors} identity={identity} />
      )}

      {subTab === "controls" && (
        <SystemControls
          matrix={matrix} statusCounts={statusCounts}
          applicabilitySummary={applicabilitySummary} posture={posture}
          findingsByControl={findingsByControl}
          keyControlRemaining={assessmentQueue.length}
          onStartAssessment={mayAssess && formalAssessment.scopeDecided && assessmentQueue.length > 0 ? openAssessmentWalk : undefined}
          walkActive={assessmentWalkOpen}
          onSelectRow={(row) => selectControl(row.controlId)}
          onOpenScopeReview={openScopeReview}
          initialSelection={controlsSelection ?? undefined}
        />
      )}

      {subTab === "risk" && <SystemRisk topRisks={topRisks} />}

      {subTab === "findings" && <SystemFindings systemId={system.id} findings={findings} />}

      {subTab === "actions" && (
        <SystemActions
          matrix={matrix}
          formalAssessment={formalAssessment}
          findings={findings}
          dueRecurring={dueRecurring}
          onNavigate={changeSubTab}
          onSelectControl={selectControl}
          onSelectControlsGroup={openControlsGroup}
          onStartAssessment={mayAssess && assessmentQueue.length > 0 ? openAssessmentWalk : undefined}
        />
      )}

      {subTab === "assets" && <SystemAssets systemId={systemId} />}

      <ScopeReviewModal
        open={scopeReviewOpen}
        systemId={system.id}
        assessor={assessor}
        initialWave={requestedWave}
        onClose={() => setScopeReviewOpen(false)}
        onStartTechnicalReview={openAssessmentWalk}
        onEditAssets={() => {
          setScopeReviewOpen(false);
          setEditorInitialStep(4);
          setResumeScopeAfterEdit(true);
          setEditorOpen(true);
        }}
      />

      <ControlAssessmentWalk
        open={assessmentWalkOpen}
        systemId={system.id}
        onClose={() => setAssessmentWalkOpen(false)}
        onGoToRemediation={() => {
          setAssessmentWalkOpen(false);
          if (formalAssessment.gapControlsMissingFinding.length > 0) openMissingFinding();
          else changeSubTab("findings");
        }}
      />

      {selectedRow && (
        <ControlEvaluationPanel
          key={selectedRow.controlId}
          row={selectedRow}
          system={system}
          initialStep={selectedControlStep}
          onClose={() => { setSelectedControlId(null); setSelectedControlStep(undefined); }}
        />
      )}

      <AddSystemWizard
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorInitialStep(1);
          if (resumeScopeAfterEdit) setScopeReviewOpen(true);
          setResumeScopeAfterEdit(false);
        }}
        onCreated={() => {
          setEditorOpen(false);
          setEditorInitialStep(1);
          if (resumeScopeAfterEdit) setScopeReviewOpen(true);
          setResumeScopeAfterEdit(false);
        }}
        editingSystemId={systemId}
        initialStep={editorInitialStep}
      />
    </div>
  );
}
