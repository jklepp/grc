import React, { useState } from "react";
import { FileText, ListChecks, Shield, CalendarClock } from "lucide-react";
import { TabBar } from "../components/Headings";
import PolicyCenter from "./PolicyCenter";
import ProcedureLibrary from "./ProcedureLibrary";
import SecurityPrinciples from "./SecurityPrinciples";
import ScheduledActivities from "./ScheduledActivities";

// Governance merges the former Policy Center, Procedure Library, Security
// Principles, and Governance Schedule (formerly "Activity Timeliness") top-
// level pages into one, switched by an in-page tab bar instead of four
// sidebar entries. Each page's own content is untouched — this is purely a
// shell around them. System Register (formerly "System Security Plan")
// lives on Data Estate now, not here.
const TABS = [
  { id: "policy", label: "Policy Center", icon: FileText, Page: PolicyCenter },
  { id: "procedures", label: "Procedure Library", icon: ListChecks, Page: ProcedureLibrary },
  { id: "principles", label: "Security Principles", icon: Shield, Page: SecurityPrinciples },
  { id: "schedule", label: "Governance Schedule", icon: CalendarClock, Page: ScheduledActivities },
] as const;

type GovernanceTab = (typeof TABS)[number]["id"];

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
};

// `initialTab` lets other pages deep-link into a specific tab via App.jsx's
// legacy-id map.
export default function Governance({ onNavigate, initialTab }: { onNavigate?: (target: string) => void; initialTab?: GovernanceTab }) {
  const [tab, setTab] = useState<GovernanceTab>(initialTab || TABS[0].id);
  const ActiveTabPage = (TABS.find((t) => t.id === tab) || TABS[0]).Page;

  function handleNavigate(target: string) {
    const internalTab = INTERNAL_TABS[target];
    if (internalTab) {
      setTab(internalTab);
      return;
    }
    onNavigate?.(target);
  }

  return (
    <div className="w-full">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <ActiveTabPage onNavigate={handleNavigate} />
    </div>
  );
}
