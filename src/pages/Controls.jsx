import React, { useState } from "react";
import { LayoutGrid, SlidersHorizontal } from "lucide-react";
import { TabBar } from "../components/Headings";
import CommonControlFramework from "./CommonControlFramework";
import ControlProfile from "./ControlProfile";

// Controls merges the former "Common Controls" and "Control Profile" top-level
// pages into one, switched by an in-page tab bar instead of two sidebar entries.
// Each page's own content is untouched — this is purely a shell around them.
const TABS = [
  { id: "ccf", label: "Common Controls", icon: LayoutGrid, Page: CommonControlFramework },
  { id: "control-profile", label: "Control Profile", icon: SlidersHorizontal, Page: ControlProfile },
];

// `initialTab` lets other pages deep-link into a specific tab (e.g. Executive
// Dashboard's "Explore Assurance" button) via App.jsx's legacy-id map.
export default function Controls({ initialTab }) {
  const [tab, setTab] = useState(initialTab || TABS[0].id);
  const ActiveTabPage = (TABS.find((t) => t.id === tab) || TABS[0]).Page;

  return (
    <div className="w-full">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <ActiveTabPage />
    </div>
  );
}
