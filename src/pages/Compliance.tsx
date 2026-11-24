import React, { useState } from "react";
import CommonControlFramework from "./CommonControlFramework";
import ComplianceFrameworks from "./ComplianceFrameworks";
import ExternalObligations from "./ExternalObligations";
import Audits from "./Audits/Audits";
import { ComplianceLanding } from "./GovernanceLanding";
import type { ComplianceAreaId } from "./complianceAreas";

// Compliance: the control and audit side split out of Governance — Common
// Controls, Compliance Frameworks, Audits, External Obligations. Same shell
// as Governance.tsx: a landing page to pick an area, then the area's page
// untouched.
/** An audit to open in place, from a deep link (#/compliance/audits/<id>[/<tab>]). */
export interface InitialEngagement { id: string; tab?: string }

const PAGE_BY_AREA: Record<ComplianceAreaId, React.ComponentType<{ onNavigate?: (target: string) => void; initialEngagement?: InitialEngagement }>> = {
  ccf: CommonControlFramework,
  frameworks: ComplianceFrameworks,
  audits: Audits,
  obligations: ExternalObligations,
};

// Old top-level ids these pages still cross-link by, mapped to the in-page
// area. Anything else falls through to App's LEGACY_ROUTES.
const INTERNAL_TABS: Record<string, ComplianceAreaId> = {
  ccf: "ccf",
  "compliance-frameworks": "frameworks",
  audits: "audits",
  "external-obligations": "obligations",
};

// Inverse of INTERNAL_TABS, so switching areas updates the URL hash.
const ROUTE_ID_BY_AREA = Object.fromEntries(
  Object.entries(INTERNAL_TABS).map(([routeId, tab]) => [tab, routeId])
) as Record<ComplianceAreaId, string>;

export default function Compliance({ onNavigate, initialTab, initialEngagement }: {
  onNavigate?: (target: string) => void; initialTab?: ComplianceAreaId; initialEngagement?: InitialEngagement;
}) {
  const [area, setArea] = useState<ComplianceAreaId | null>(initialTab ?? null);

  function changeArea(next: ComplianceAreaId | null) {
    if (onNavigate) {
      onNavigate(next ? ROUTE_ID_BY_AREA[next] : "compliance");
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

  if (!area) return <ComplianceLanding onSelect={changeArea} />;

  const ActiveAreaPage = PAGE_BY_AREA[area];

  return (
    <div className="w-full">
      <ActiveAreaPage onNavigate={handleNavigate} initialEngagement={area === "audits" ? initialEngagement : undefined} />
    </div>
  );
}
