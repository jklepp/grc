import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { C } from "../theme";
import CommonControlFramework from "./CommonControlFramework";
import ControlProfile from "./ControlProfile";
import { ControlsLanding } from "./ControlsLanding";
import { CONTROL_AREAS } from "./controlAreas";
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
  const activeArea = CONTROL_AREAS.find((candidate) => candidate.id === area) ?? CONTROL_AREAS[0];

  return (
    <div className="w-full">
      <div className="px-8 pt-6 flex items-center justify-between gap-4">
        <button type="button" onClick={() => changeArea(null)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.muted }}>
          <ArrowLeft size={13} /> All Control Areas
        </button>
        <label className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
          Control area
          <select
            value={activeArea.id}
            onChange={(event) => changeArea(event.target.value as ControlAreaId)}
            className="rounded-lg px-3 py-2 outline-none text-sm font-medium"
            style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
          >
            {CONTROL_AREAS.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
          </select>
        </label>
      </div>

      <ActiveAreaPage />
    </div>
  );
}
