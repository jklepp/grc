import React, { useState } from "react";
import { LayoutDashboard, AlertTriangle, Database } from "lucide-react";
import { TabBar } from "../components/Headings";
import ExecutiveDashboard from "./ExecutiveDashboard";
import RiskRegister from "./RiskRegister";
import DataFootprint from "./DataFootprint";

// Overview merges the former "Executive Dashboard", "Risk Register", and
// "Enterprise Footprint" top-level pages into one, switched by an in-page tab
// bar instead of separate sidebar entries. Each page's own content is
// untouched — this is purely a shell around them.
const TABS = [
  { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { id: "risk-register", label: "Risk Register", icon: AlertTriangle },
  { id: "footprint", label: "Enterprise Footprint", icon: Database },
] as const;

type OverviewTab = (typeof TABS)[number]["id"];

// Route ids App understands for each in-page tab, so switching tabs updates
// the URL hash (deep links and back/forward) instead of staying invisible.
const ROUTE_ID_BY_TAB: Record<OverviewTab, string> = {
  dashboard: "executive-dashboard",
  "risk-register": "risk-register",
  footprint: "data-footprint",
};

export default function Overview({ onNavigate, initialTab }: { onNavigate?: (target: string) => void; initialTab?: OverviewTab }) {
  const [tab, setTab] = useState<OverviewTab>(TABS.some((t) => t.id === initialTab) ? initialTab ?? "dashboard" : "dashboard");

  function changeTab(next: OverviewTab) {
    if (onNavigate) {
      onNavigate(ROUTE_ID_BY_TAB[next]);
      return;
    }
    setTab(next);
  }

  // ExecutiveDashboard's internal links to "risk-register" should switch the
  // in-page tab rather than trying to reach a sidebar page id that no longer
  // exists; every other target still goes up to the app-level navigator.
  function handleDashboardNavigate(target: string) {
    if (target === "risk-register") {
      changeTab("risk-register");
      return;
    }
    onNavigate?.(target);
  }

  return (
    <div className="w-full">
      <TabBar tabs={TABS} active={tab} onChange={changeTab} />

      {tab === "dashboard" && <ExecutiveDashboard onNavigate={handleDashboardNavigate} />}
      {tab === "risk-register" && <RiskRegister />}
      {tab === "footprint" && <DataFootprint />}
    </div>
  );
}
