import React, { useState } from "react";
import { FileText, ListChecks, Shield, CalendarClock, ClipboardCheck } from "lucide-react";
import { TabBar } from "../components/Headings";
import PolicyCenter from "./PolicyCenter";
import ProcedureLibrary from "./ProcedureLibrary";
import SecurityPrinciples from "./SecurityPrinciples";
import ScheduledActivities from "./ScheduledActivities";
import SystemRegister from "./SystemRegister";

// Governance merges the former Policy Center, Procedure Library, Security
// Principles, Governance Schedule (formerly "Activity Timeliness"), and
// System Register (formerly "System Security Plan") top-level pages into one,
// switched by an in-page tab bar instead of five sidebar entries. Each page's
// own content is untouched — this is purely a shell around them.
const TABS = [
  { id: "policy", label: "Policy Center", icon: FileText, Page: PolicyCenter },
  { id: "procedures", label: "Procedure Library", icon: ListChecks, Page: ProcedureLibrary },
  { id: "principles", label: "Security Principles", icon: Shield, Page: SecurityPrinciples },
  { id: "schedule", label: "Governance Schedule", icon: CalendarClock, Page: ScheduledActivities },
  { id: "register", label: "System Register", icon: ClipboardCheck, Page: SystemRegister },
];

// These pages cross-link each other by their old top-level ids (e.g.
// Procedure Library's "View policy" links to "policy-center"). Map those
// to the in-page tab they now mean instead of forwarding them up to the
// app-level navigator, which no longer has a page for them. The external-
// facing legacy id "ssp" is kept stable here so existing deep links still
// land on the right tab even though its internal id changed.
const INTERNAL_TABS = {
  "policy-center": "policy",
  "procedure-library": "procedures",
  "security-principles": "principles",
  "activity-timeliness": "schedule",
  ssp: "register",
};

// `initialTab` lets other pages deep-link into a specific tab via App.jsx's
// legacy-id map.
export default function Governance({ onNavigate, initialTab }) {
  const [tab, setTab] = useState(initialTab || TABS[0].id);
  const ActiveTabPage = (TABS.find((t) => t.id === tab) || TABS[0]).Page;

  function handleNavigate(target) {
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
