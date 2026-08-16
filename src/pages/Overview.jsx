import React, { useState } from "react";
import { LayoutDashboard, AlertTriangle } from "lucide-react";
import { TabBar } from "../components/Headings";
import ExecutiveDashboard from "./ExecutiveDashboard";
import RiskRegister from "./RiskRegister";

// Overview merges the former "Executive Dashboard" and "Risk Register" top-level
// pages into one, switched by an in-page tab bar instead of two sidebar entries.
// Each page's own content is untouched — this is purely a shell around them.
const TABS = [
  { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { id: "risk-register", label: "Risk Register", icon: AlertTriangle },
];

export default function Overview({ onNavigate }) {
  const [tab, setTab] = useState("dashboard");

  // ExecutiveDashboard's internal links to "risk-register" should switch the
  // in-page tab rather than trying to reach a sidebar page id that no longer
  // exists; every other target still goes up to the app-level navigator.
  function handleDashboardNavigate(target) {
    if (target === "risk-register") {
      setTab("risk-register");
      return;
    }
    onNavigate?.(target);
  }

  return (
    <div className="w-full">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === "dashboard" ? (
        <ExecutiveDashboard onNavigate={handleDashboardNavigate} />
      ) : (
        <RiskRegister />
      )}
    </div>
  );
}
