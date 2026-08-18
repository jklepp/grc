import React, { useMemo, useState } from "react";
import { TabBar } from "../../components/Headings";
import {
  getAllSystems, systemControlMatrix, dataTypesForSystem,
  cockpitSummary, identityPostureForSystem, exposureForSystem, securityTestsForSystem,
  resilienceForSystem, irForSystem, vendorsForSystem, vulnerabilitiesForSystem, sdlcForSystem,
  topRisksForSystem, controlApplicabilitySummary, responsibilityForControl, systemCoverageBreakdown,
  findingsForSystem,
} from "../../engine";
import { SUB_TABS } from "./tabs";
import { STATUS_ORDER } from "./controlMeta";
import { SystemHeader } from "./SystemHeader";
import { SystemOverview } from "./SystemOverview";
import { SystemArchitecture } from "./SystemArchitecture";
import { SystemData } from "./SystemData";
import { SystemSecurity } from "./SystemSecurity";
import { SystemTesting } from "./SystemTesting";
import { SystemControls } from "./SystemControls";
import { SystemRisk } from "./SystemRisk";
import { SystemAssets } from "./SystemAssets";
import { ControlEvaluationPanel } from "./ControlEvaluationPanel";

const SYSTEMS = getAllSystems();

// Opens on Production AI Platform — the system most worth landing on by
// default — falling back to the first system if it's ever renamed or removed.
export const DEFAULT_SYSTEM_ID = (SYSTEMS.find((s) => s.name === "Production AI Platform") ?? SYSTEMS[0]).id;

export default function SystemWorkspace({ systemId: controlledSystemId, onSelectSystem, initialSubTab }) {
  const [localSystemId, setLocalSystemId] = useState(DEFAULT_SYSTEM_ID);
  const systemId = controlledSystemId ?? localSystemId;
  const setSystemId = onSelectSystem ?? setLocalSystemId;
  const [subTab, setSubTab] = useState(SUB_TABS.some((t) => t.id === initialSubTab) ? initialSubTab : SUB_TABS[0].id);
  const [selectedRow, setSelectedRow] = useState(null);

  const system = SYSTEMS.find((s) => s.id === systemId);
  const matrix = useMemo(
    () => systemControlMatrix(system.id).map((row) => ({
      ...row,
      responsibility: responsibilityForControl(system.id, row.controlId),
    })),
    [system]
  );
  const applicabilitySummary = useMemo(() => controlApplicabilitySummary(system.id), [system]);
  const coverageBreakdown = useMemo(() => systemCoverageBreakdown(system.id), [system]);
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

  const cockpit = useMemo(() => cockpitSummary(system.id), [system]);
  const identity = useMemo(() => identityPostureForSystem(system.id), [system]);
  const exposure = useMemo(() => exposureForSystem(system.id), [system]);
  const secTests = useMemo(() => securityTestsForSystem(system.id), [system]);
  const ir = useMemo(() => irForSystem(system.id), [system]);
  const resilience = useMemo(() => resilienceForSystem(system.id), [system]);
  const vendors = useMemo(() => vendorsForSystem(system.id), [system]);
  const vuln = useMemo(() => vulnerabilitiesForSystem(system.id), [system]);
  const sdlc = useMemo(() => sdlcForSystem(system.id), [system]);
  const topRisks = useMemo(() => topRisksForSystem(system.id, 5), [system]);
  const dataTypes = useMemo(() => dataTypesForSystem(system.id), [system]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    matrix.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [matrix]);

  const findings = useMemo(() => findingsForSystem(system.id), [system]);
  // Open findings per control, so the table can show a count without every
  // row re-filtering the system's whole findings list.
  const findingsByControl = useMemo(() => {
    const counts = {};
    findings.forEach((f) => {
      if (f.open) {
        counts[f.controlId] = (counts[f.controlId] ?? 0) + 1;
      }
    });
    return counts;
  }, [findings]);

  function selectSystem(id) {
    setSystemId(id);
    setSubTab(SUB_TABS[0].id);
    setSelectedRow(null);
  }

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SystemHeader system={system} systems={SYSTEMS} systemId={systemId} onSelectSystem={selectSystem} />

      <TabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} variant="secondary" />

      <div className="pt-6" />

      {subTab === "overview" && (
        <SystemOverview
          system={system} cockpit={cockpit} identity={identity} exposure={exposure}
          resilience={resilience} secTests={secTests} ir={ir} vendors={vendors}
          dataTypes={dataTypes} onNavigate={setSubTab}
        />
      )}

      {subTab === "architecture" && (
        <SystemArchitecture systemId={systemId} system={system} onSelectSystem={selectSystem} />
      )}

      {subTab === "data" && <SystemData system={system} dataTypes={dataTypes} />}

      {subTab === "security" && (
        <SystemSecurity system={system} identity={identity} exposure={exposure} sdlc={sdlc} vendors={vendors} />
      )}

      {subTab === "testing" && (
        <SystemTesting secTests={secTests} vuln={vuln} ir={ir} resilience={resilience} vendors={vendors} />
      )}

      {subTab === "controls" && (
        <SystemControls
          matrix={matrix} statusCounts={statusCounts}
          applicabilitySummary={applicabilitySummary} posture={posture}
          findingsByControl={findingsByControl}
          onSelectRow={setSelectedRow}
        />
      )}

      {subTab === "risk" && <SystemRisk system={system} topRisks={topRisks} />}

      {subTab === "assets" && <SystemAssets systemId={systemId} />}

      {selectedRow && <ControlEvaluationPanel row={selectedRow} system={system} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}
