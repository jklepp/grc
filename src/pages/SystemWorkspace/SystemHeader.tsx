import React from "react";
import type { ReactNode } from "react";
import { C } from "../../theme";
import { ClassificationTag, AssuranceBadge, FormallyAssessedBadge, badgeColorFor } from "../../components/SystemBadges";
import { assuranceBand } from "../../engine";
import type { WorkspaceSystem } from "./types";

interface SystemHeaderProps {
  system: WorkspaceSystem;
  formallyAssessed?: boolean;
  /** The workspace tab bar, which shares this band: one strip of chrome, not two stacked. */
  children?: ReactNode;
}

// One identity bar: who this system is on the left, how it is doing on the right,
// and the tab bar in the same band below. Editing a system and switching to another
// one both belong to the system register (SelectSystem.tsx) — a system you are
// already inside needs neither a picker repeating its own name back to you nor a
// second copy of that name as a page title. The assurance ring carries its band
// word ("Developing") so the number has a noun beside it.
export function SystemHeader({ system, formallyAssessed, children }: SystemHeaderProps) {
  const band = assuranceBand(system.overallAssurance);
  return (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}` }}>
      <div className="px-4 lg:px-8 pt-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[23px] font-semibold leading-tight" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
            {system.name}
          </h1>
          {system.classification && <ClassificationTag level={system.classification} />}
          {formallyAssessed && <FormallyAssessedBadge />}
        </div>
        {system.overallAssurance != null && (
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[11px]" style={{ color: C.muted }}>Cyber assurance</span>
              <span className="text-[11.5px] font-semibold" style={{ color: badgeColorFor(band.color).color }}>{band.label}</span>
            </div>
            <AssuranceBadge pct={system.overallAssurance} size={32} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
