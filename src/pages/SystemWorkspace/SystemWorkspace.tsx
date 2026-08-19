import React, { useMemo, useState } from "react";
import { TabBar } from "../../components/Headings";
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
import { SystemControls } from "./SystemControls";
import { SystemRisk } from "./SystemRisk";
import { SystemAssets } from "./SystemAssets";
import { ControlEvaluationPanel } from "./ControlEvaluationPanel";
import AddSystemWizard from "../../components/AddSystemWizard";
import type { ControlId, SystemId } from "../../graph/ids";
import type { SystemWorkspaceTab } from "./tabs";
import { useLiveEngine } from "../../engine/useLiveEngine";

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
  onNavigate?: (target: string) => void;
}

export default function SystemWorkspace({ systemId: controlledSystemId, onSelectSystem, initialSubTab, onNavigate }: SystemWorkspaceProps) {
  const [localSystemId, setLocalSystemId] = useState(DEFAULT_SYSTEM_ID);
  const systemId = controlledSystemId ?? localSystemId;
  const [subTab, setSubTab] = useState<SystemWorkspaceTab>(SUB_TABS.some((t) => t.id === initialSubTab) ? initialSubTab! : SUB_TABS[0].id);
  const [selectedControlId, setSelectedControlId] = useState<ControlId | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const liveEngine = useLiveEngine();
  const systems = liveEngine.rollups.systemRollups;

  const system = systems.find((s) => s.id === systemId);
  if (!system) throw new Error(`Unknown system: ${systemId}`);
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
        onEdit={() => setEditorOpen(true)}
      />

      <TabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} variant="secondary" />

      <div className="pt-6" />

      {subTab === "overview" && (
        <SystemOverview
          system={system} cockpit={cockpit} identity={identity} exposure={exposure}
          resilience={resilience} secTests={secTests} ir={ir} vendors={vendors}
          dataTypes={dataTypes} onNavigate={setSubTab} onGenerateIsoReport={generateIsoReport}
        />
      )}

      {subTab === "architecture" && (
        <SystemArchitecture systemId={systemId} onSelectSystem={selectSystem} />
      )}

      {subTab === "data" && <SystemData system={system} dataTypes={dataTypes} resilience={resilience} backupRecovery={backupRecovery} />}

      {subTab === "identity" && <SystemIdentity identity={identity} exposure={exposure} />}

      {subTab === "security" && (
        <SystemSecurity exposure={exposure} sdlc={sdlc} vendors={vendors} onOpenExceptionRegister={() => onNavigate?.("exception-register")} />
      )}

      {subTab === "testing" && (
        <SystemTesting secTests={secTests} vuln={vuln} ir={ir} resilience={resilience} vendors={vendors} />
      )}

      {subTab === "controls" && (
        <SystemControls
          matrix={matrix} statusCounts={statusCounts}
          applicabilitySummary={applicabilitySummary} posture={posture}
          findingsByControl={findingsByControl}
          onSelectRow={(row) => setSelectedControlId(row.controlId)}
        />
      )}

      {subTab === "risk" && <SystemRisk system={system} topRisks={topRisks} />}

      {subTab === "assets" && <SystemAssets systemId={systemId} />}

      {selectedRow && <ControlEvaluationPanel row={selectedRow} system={system} onClose={() => setSelectedControlId(null)} />}

      <AddSystemWizard open={editorOpen} onClose={() => setEditorOpen(false)} onCreated={() => setEditorOpen(false)} editingSystemId={systemId} />
    </div>
  );
}
