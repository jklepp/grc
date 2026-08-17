import React, { useMemo, useState } from "react";
import { TabBar } from "../../components/Headings";
import {
  getAllSystems, systemControlMatrix, dataTypesForSystem,
  cockpitSummary, identityPostureForSystem, exposureForSystem, securityTestsForSystem,
  resilienceForSystem, irForSystem, vendorsForSystem, vulnerabilitiesForSystem, sdlcForSystem,
  topRisksForSystem,
} from "../../engine";
import { SUB_TABS } from "./tabs";
import { STATUS_ORDER } from "./controlMeta";
import { getReferencedPolicies } from "./policyLookup";
import { SystemHeader } from "./SystemHeader";
import { SystemOverview } from "./SystemOverview";
import { SystemArchitecture } from "./SystemArchitecture";
import { SystemData } from "./SystemData";
import { SystemSecurity } from "./SystemSecurity";
import { SystemTesting } from "./SystemTesting";
import { SystemControls } from "./SystemControls";
import { SystemRisk } from "./SystemRisk";
import { SystemAssets } from "./SystemAssets";
import { ControlDetailDrawer } from "./ControlDetailDrawer";

const SYSTEMS = getAllSystems();

// Opens on Production AI Platform — the system most worth landing on by
// default — falling back to the first system if it's ever renamed or removed.
export const DEFAULT_SYSTEM_ID = (SYSTEMS.find((s) => s.name === "Production AI Platform") ?? SYSTEMS[0]).id;

export default function SystemWorkspace({ systemId: controlledSystemId, onSelectSystem, initialSubTab }) {
  const [localSystemId, setLocalSystemId] = useState(DEFAULT_SYSTEM_ID);
  const systemId = controlledSystemId ?? localSystemId;
  const setSystemId = onSelectSystem ?? setLocalSystemId;
  const [subTab, setSubTab] = useState(SUB_TABS.some((t) => t.id === initialSubTab) ? initialSubTab : SUB_TABS[0].id);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());
  const [selectedRow, setSelectedRow] = useState(null);

  const system = SYSTEMS.find((s) => s.id === systemId);
  const matrix = useMemo(() => systemControlMatrix(system.id), [system]);
  const referencedPolicies = useMemo(() => getReferencedPolicies(matrix), [matrix]);

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

  const domains = useMemo(() => {
    const set = new Set(matrix.map((r) => r.control.domain));
    return [...set].sort();
  }, [matrix]);

  const filtered = matrix.filter(
    (r) =>
      (domainFilter === "All" || r.control.domain === domainFilter) &&
      (statusFilter === "All" || r.status === statusFilter) &&
      (r.control.name.toLowerCase().includes(query.toLowerCase()) || r.control.id.toLowerCase().includes(query.toLowerCase()))
  );

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    matrix.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [matrix]);

  function selectSystem(id) {
    setSystemId(id);
    setSubTab(SUB_TABS[0].id);
    setDomainFilter("All");
    setStatusFilter("All");
    setQuery("");
    setSelectedRow(null);
    setExpandedTypes(new Set());
  }

  function toggleType(type) {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
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
        <SystemSecurity system={system} identity={identity} exposure={exposure} vuln={vuln} sdlc={sdlc} vendors={vendors} />
      )}

      {subTab === "testing" && (
        <SystemTesting secTests={secTests} ir={ir} resilience={resilience} vendors={vendors} />
      )}

      {subTab === "controls" && (
        <SystemControls
          matrix={matrix} statusCounts={statusCounts} filtered={filtered} domains={domains}
          referencedPolicies={referencedPolicies}
          query={query} setQuery={setQuery}
          domainFilter={domainFilter} setDomainFilter={setDomainFilter}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          expandedTypes={expandedTypes} toggleType={toggleType}
          onSelectRow={setSelectedRow}
        />
      )}

      {subTab === "risk" && <SystemRisk system={system} topRisks={topRisks} />}

      {subTab === "assets" && <SystemAssets systemId={systemId} />}

      {selectedRow && <ControlDetailDrawer row={selectedRow} system={system} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}
