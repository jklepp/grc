import React from "react";
import ExecutiveDashboard from "./ExecutiveDashboard";
import RiskRegister from "./RiskRegister";
import DataFootprint from "./DataFootprint";
import type { OverviewAreaId } from "./overviewAreas";

// Overview merges the former "Executive Dashboard" (now "Assurance
// Overview"), "Risk Register", and "Enterprise Footprint" top-level pages
// into one route, switched by the top nav's "Overview" dropdown (see
// TopNav.tsx) instead of an in-page tab bar. Unlike Controls/Governance,
// there's no landing page to pick an area from first — the bare "Overview"
// nav click has nowhere useful to land but Assurance Overview, so that's the
// default whenever no area is specified.
export default function Overview({ onNavigate, initialTab }: { onNavigate?: (target: string) => void; initialTab?: OverviewAreaId }) {
  const area: OverviewAreaId = initialTab ?? "dashboard";

  if (area === "risk-register") return <RiskRegister />;
  if (area === "footprint") return <DataFootprint />;
  return <ExecutiveDashboard onNavigate={onNavigate} />;
}
