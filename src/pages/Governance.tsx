import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { C } from "../theme";
import PolicyCenter from "./PolicyCenter";
import ProcedureLibrary from "./ProcedureLibrary";
import SecurityPrinciples from "./SecurityPrinciples";
import ScheduledActivities from "./ScheduledActivities";
import ExceptionRegister from "./ExceptionRegister";
import { GovernanceLanding } from "./GovernanceLanding";
import { GOVERNANCE_AREAS } from "./governanceAreas";
import type { GovernanceAreaId } from "./governanceAreas";

// Governance merges the former Policy Center, Procedure Library, Security
// Principles, and Governance Schedule (formerly "Activity Timeliness") top-
// level pages into one, switched by an in-page tab bar instead of four
// sidebar entries. Each page's own content is untouched — this is purely a
// shell around them. System Register (formerly "System Security Plan")
// lives on Data Estate now, not here.
const PAGE_BY_AREA = {
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
  "policy-center": "policy",
  "procedure-library": "procedures",
  "security-principles": "principles",
  "activity-timeliness": "schedule",
  "exception-register": "exceptions",
};

// `initialTab` lets other pages deep-link into a specific tab via App.jsx's
// legacy-id map.
export default function Governance({ onNavigate, initialTab }: { onNavigate?: (target: string) => void; initialTab?: GovernanceTab }) {
  const [area, setArea] = useState<GovernanceTab | null>(initialTab ?? null);

  function handleNavigate(target: string) {
    const internalTab = INTERNAL_TABS[target];
    if (internalTab) {
      setArea(internalTab);
      return;
    }
    onNavigate?.(target);
  }

  if (!area) return <GovernanceLanding onSelect={setArea} />;

  const ActiveAreaPage = PAGE_BY_AREA[area];
  const activeArea = GOVERNANCE_AREAS.find((candidate) => candidate.id === area) ?? GOVERNANCE_AREAS[0];

  return (
    <div className="w-full">
      <div className="px-8 pt-6 flex items-center justify-between gap-4">
        <button type="button" onClick={() => setArea(null)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.muted }}>
          <ArrowLeft size={13} /> All Governance Areas
        </button>
        <label className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
          Governance area
          <select
            value={activeArea.id}
            onChange={(event) => setArea(event.target.value as GovernanceAreaId)}
            className="rounded-lg px-3 py-2 outline-none text-sm font-medium"
            style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
          >
            {GOVERNANCE_AREAS.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
          </select>
        </label>
      </div>

      <ActiveAreaPage onNavigate={handleNavigate} />
    </div>
  );
}
