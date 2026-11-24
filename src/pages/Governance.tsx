import React, { useState } from "react";
import PolicyCenter from "./PolicyCenter";
import ProcedureLibrary from "./ProcedureLibrary";
import SecurityPrinciples from "./SecurityPrinciples";
import ExceptionRegister from "./ExceptionRegister";
import { GovernanceLanding } from "./GovernanceLanding";
import type { GovernanceAreaId } from "./governanceAreas";

// Governance: Policies, Procedures, Security Principles and the Exception
// Register, switched by an in-page tab bar. A shell only; each page's content
// is its own.
const PAGE_BY_AREA = {
  policy: PolicyCenter,
  procedures: ProcedureLibrary,
  principles: SecurityPrinciples,
  exceptions: ExceptionRegister,
} satisfies Record<GovernanceAreaId, React.ComponentType<{ onNavigate?: (target: string) => void }>>;

type GovernanceTab = GovernanceAreaId;

// These pages cross-link by old top-level ids (e.g. "policy-center"); map
// them to the in-page tab. Ids for another page (e.g. "ssp") fall through to
// onNavigate and App.tsx's LEGACY_ROUTES.
const INTERNAL_TABS: Record<string, GovernanceTab> = {
  "policy-center": "policy",
  "procedure-library": "procedures",
  "security-principles": "principles",
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
