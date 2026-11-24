import React from "react";
import ExecutiveDashboard from "./ExecutiveDashboard";
import RiskRegister from "./RiskRegister";
import DataFootprint from "./DataFootprint";
import ScheduledActivities from "./ScheduledActivities";
import type { OverviewAreaId } from "./overviewAreas";
import type { SystemId } from "../graph/ids";

// Overview's areas are switched by the top nav's "Overview" dropdown, not an
// in-page tab bar. There is no landing page: with no area, it shows the
// dashboard.
export default function Overview({
  onNavigate, onOpenSystem, onOpenEngagement, initialTab,
}: {
  onNavigate?: (target: string) => void;
  onOpenSystem?: (systemId: SystemId) => void;
  onOpenEngagement?: (engagementId: string, tab?: string) => void;
  initialTab?: OverviewAreaId;
}) {
  const area: OverviewAreaId = initialTab ?? "dashboard";

  // Risk Register and Enterprise Footprint are deprecated: `deprecated: true`
  // in overviewAreas.ts keeps them out of the nav and stops App from ever
  // resolving their tab, so these two branches are unreachable today. They
  // stay wired up so that clearing the flag is the entire restore.
  if (area === "risk-register") return <RiskRegister />;
  if (area === "footprint") return <DataFootprint />;
  if (area === "schedule") return <ScheduledActivities onNavigate={onNavigate} />;
  return <ExecutiveDashboard onNavigate={onNavigate} onOpenSystem={onOpenSystem} onOpenEngagement={onOpenEngagement} />;
}
