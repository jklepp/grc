import React, { useState } from "react";
import CommonControlFramework from "./CommonControlFramework";
import PolicyCenter from "./PolicyCenter";
import ProcedureLibrary from "./ProcedureLibrary";
import SecurityPrinciples from "./SecurityPrinciples";
import ScheduledActivities from "./ScheduledActivities";
import ExceptionRegister from "./ExceptionRegister";
import { GovernanceLanding } from "./GovernanceLanding";
import type { GovernanceAreaId } from "./governanceAreas";

// Governance merges the former Common Controls, Policies (formerly "Policy
// Center"), Procedures (formerly "Procedure Library"), Security Principles,
// and Governance Schedule (formerly "Activity Timeliness") top-level pages
// into one, switched by an in-page tab bar instead of separate sidebar
// entries. Each page's own content is untouched — this is purely a shell
// around them. System Register (formerly "System Security Plan") lives on
// Data Estate now, not here.
const PAGE_BY_AREA = {
  ccf: CommonControlFramework,
  policy: PolicyCenter,
  procedures: ProcedureLibrary,
  principles: SecurityPrinciples,
  schedule: ScheduledActivities,
  exceptions: ExceptionRegister,
} satisfies Record<GovernanceAreaId, React.ComponentType<{ onNavigate?: (target: string) => void }>>;

type GovernanceTab = GovernanceAreaId;

// These pages cross-link each other by their old top-level ids (e.g.
// Procedure Library's "View policy" links to "policy-center"). Map those
// to the in-page tab they now mean instead of forwarding them up to the
// app-level navigator, which no longer has a page for them. Ids that mean
// a tab on a different consolidated page (e.g. "ssp") fall through to
// onNavigate so App.jsx's LEGACY_ROUTES can send them there.
const INTERNAL_TABS: Record<string, GovernanceTab> = {
  ccf: "ccf",
  "policy-center": "policy",
  "procedure-library": "procedures",
  "security-principles": "principles",
  "activity-timeliness": "schedule",
  "exception-register": "exceptions",
};

// `initialTab` lets other pages deep-link into a specific tab via App.jsx's
// legacy-id map.
// Inverse of INTERNAL_TABS: the route id App understands for each area, so
// switching areas updates the URL hash (deep links and back/forward).
const ROUTE_ID_BY_AREA = Object.fromEntries(
  Object.entries(INTERNAL_TABS).map(([routeId, tab]) => [tab, routeId])
) as Record<GovernanceTab, string>;

export default function Governance({ onNavigate, initialTab }: { onNavigate?: (target: string) => void; initialTab?: GovernanceTab }) {
  const [area, setArea] = useState<GovernanceTab | null>(initialTab ?? null);

  function changeArea(next: GovernanceTab | null) {
    if (onNavigate) {
      onNavigate(next ? ROUTE_ID_BY_AREA[next] : "governance");
      return;
    }
    setArea(next);
  }

  function handleNavigate(target: string) {
    const internalTab = INTERNAL_TABS[target];
    if (internalTab) {
      changeArea(internalTab);
      return;
    }
    onNavigate?.(target);
  }

  if (!area) return <GovernanceLanding onSelect={changeArea} />;

  const ActiveAreaPage = PAGE_BY_AREA[area];

  return (
    <div className="w-full">
      <ActiveAreaPage onNavigate={handleNavigate} />
    </div>
  );
}
