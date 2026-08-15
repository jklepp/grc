import React, { useState } from "react";
import { Database, Network, ShieldCheck, Boxes } from "lucide-react";
import { TabBar } from "../components/Headings";
import DataFootprint from "./DataFootprint";
import DataMap from "./DataMap";
import DataClassificationGapMatrix from "./DataClassificationGapMatrix";
import AssetRegister from "./AssetRegister";

// Data Estate merges the four former top-level "Data & Assets" pages into one,
// switched by an in-page tab bar instead of four sidebar entries. Each page's
// own content is untouched — this is purely a shell around them.
const TABS = [
  { id: "footprint", label: "Data Footprint", icon: Database, Page: DataFootprint },
  { id: "map", label: "Enterprise Data Map", icon: Network, Page: DataMap },
  { id: "systems", label: "Systems Register", icon: ShieldCheck, Page: DataClassificationGapMatrix },
  { id: "assets", label: "Asset Register", icon: Boxes, Page: AssetRegister },
];

// `initialTab` lets other pages deep-link into a specific tab (e.g. Executive
// Dashboard's "Explore Data Footprint" button) via App.jsx's legacy-id map.
export default function DataEstate({ initialTab }) {
  const [tab, setTab] = useState(initialTab || TABS[0].id);
  const active = TABS.find((t) => t.id === tab) || TABS[0];
  const ActiveTabPage = active.Page;

  return (
    <div className="w-full">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <ActiveTabPage />
    </div>
  );
}
