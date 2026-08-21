import React, { useState } from "react";
import CommonControlFramework from "./CommonControlFramework";
import ControlProfile from "./ControlProfile";
import { ControlsLanding } from "./ControlsLanding";
import type { ControlAreaId } from "./controlAreas";

// Controls merges the former "Common Controls" and "Control Profile" top-level
// pages into one, switched by an area picker instead of two sidebar entries.
// Each page's own content is untouched — this is purely a shell around them,
// matching the Governance page's "select an area" landing pattern.
const PAGE_BY_AREA = {
  ccf: CommonControlFramework,
  "control-profile": ControlProfile,
} satisfies Record<ControlAreaId, React.ComponentType>;

// `initialTab` lets other pages deep-link into a specific area (e.g. Executive
// Dashboard's "Explore Assurance" button) via App.jsx's legacy-id map.
export default function Controls({ initialTab, onNavigate }: { initialTab?: ControlAreaId; onNavigate?: (target: string) => void }) {
  const [area, setArea] = useState<ControlAreaId | null>(initialTab ?? null);

  // Area ids double as route ids in App's legacy-id map, so switching areas
  // updates the URL hash (deep links and back/forward) when App is listening.
  function changeArea(next: ControlAreaId | null) {
    if (onNavigate) {
      onNavigate(next ?? "assurance");
      return;
    }
    setArea(next);
  }

  if (!area) return <ControlsLanding onSelect={changeArea} />;

  const ActiveAreaPage = PAGE_BY_AREA[area];

  return (
    <div className="w-full">
      <ActiveAreaPage />
    </div>
  );
}
