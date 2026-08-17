import React, { useState } from "react";
import { Database, Network, ClipboardCheck, Boxes, Server } from "lucide-react";
import { TabBar } from "../components/Headings";
import DataFootprint from "./DataFootprint";
import DataMap from "./DataMap";
import SystemsRegister from "./SystemsRegister";
import SystemRegister from "./SystemRegister";
import AssetRegister from "./AssetRegister";

// Data Estate merges the four former top-level "Data & Assets" pages into one,
// switched by an in-page tab bar instead of four sidebar entries. Each page's
// own content is untouched — this is purely a shell around them.
const TABS = [
  { id: "systems", label: "Systems", icon: Server, Page: SystemsRegister },
  { id: "map", label: "System Security Map", icon: Network, Page: DataMap },
  { id: "register", label: "System Security Profile", icon: ClipboardCheck, Page: SystemRegister },
  { id: "assets", label: "Assets", icon: Boxes, Page: AssetRegister },
  { id: "footprint", label: "Enterprise Footprint", icon: Database, Page: DataFootprint },
];

// `initialTab` lets other pages deep-link into a specific tab (e.g. Executive
// Dashboard's "Explore Data Footprint" button) via App.jsx's legacy-id map.
export default function DataEstate({ initialTab }) {
  const [tab, setTab] = useState(initialTab || TABS[0].id);
  // Set only by System Register's card selection, and consumed once — as the
  // mount-time default for System Security Profile's own system picker — so
  // switching *away* and back doesn't keep overriding whatever the user then
  // picked there themselves.
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const active = TABS.find((t) => t.id === tab) || TABS[0];
  const ActiveTabPage = active.Page;

  function openSystemProfile(systemId) {
    setSelectedSystemId(systemId);
    setTab("register");
  }

  return (
    <div className="w-full">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <ActiveTabPage onSelectSystem={openSystemProfile} initialSystemId={selectedSystemId} />
    </div>
  );
}
