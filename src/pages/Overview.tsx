import React from "react";
import ExecutiveDashboard from "./ExecutiveDashboard";
import RiskRegister from "./RiskRegister";
import DataFootprint from "./DataFootprint";
import type { OverviewAreaId } from "./overviewAreas";
import type { SystemId } from "../graph/ids";

// Overview merges the former "Executive Dashboard" (now "Assurance
// Overview"), "Risk Register", and "Enterprise Footprint" top-level pages
// into one route, switched by the top nav's "Overview" dropdown (see
// TopNav.tsx) instead of an in-page tab bar. Unlike Controls/Governance,
// there's no landing page to pick an area from first — the bare "Overview"
// nav click has nowhere useful to land but Assurance Overview, so that's the
// default whenever no area is specified.
export default function Overview({
  onNavigate, onOpenSystem, initialTab,
}: {
  onNavigate?: (target: string) => void;
  onOpenSystem?: (systemId: SystemId) => void;
  initialTab?: OverviewAreaId;
}) {
  const area: OverviewAreaId = initialTab ?? "dashboard";

  // Risk Register and Enterprise Footprint are deprecated: `deprecated: true`
  // in overviewAreas.ts keeps them out of the nav and stops App from ever
  // resolving their tab, so these two branches are unreachable today. They
  // stay wired up so that clearing the flag is the entire restore.
  if (area === "risk-register") return <RiskRegister />;
  if (area === "footprint") return <DataFootprint />;
  return <ExecutiveDashboard onNavigate={onNavigate} onOpenSystem={onOpenSystem} />;
}
