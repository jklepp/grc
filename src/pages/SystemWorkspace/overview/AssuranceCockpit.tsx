import React from "react";
import { Gauge } from "lucide-react";
import { C } from "../../../theme";
import { SectionHeading } from "../../../components/Headings";
import { SEVERITY_LEVELS } from "../../../engine";
import { StatTile } from "../shared/StatTile";
import { StatRing } from "../shared/StatRing";
import type { Band } from "../../../engine/assurance";
import type { CockpitSummary, WorkspaceSystem } from "../types";

function bandColor(band?: Band | null): string {
  if (band?.color === "green") return C.green;
  if (band?.color === "amber") return C.amber;
  if (band?.color === "red") return C.red;
  return C.ink;
}

// Assurance and Target share one card so the gap between them — the thing
// the whole cockpit is organized around — reads as a single fact instead of
// two numbers a reader has to subtract themselves.
function AssuranceTargetCard({ assurance, target, band }: { assurance?: number | null; target?: number | null; band?: Band | null }) {
  const gap = assurance != null && target != null ? target - assurance : null;
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-semibold" style={{ color: bandColor(band), fontFamily: "'Source Serif 4', serif" }}>{assurance ?? "—"}</span>
          <span className="text-sm mb-0.5" style={{ color: C.muted }}>/ {target ?? "—"} target</span>
        </div>
        <StatRing pct={assurance} color={bandColor(band)} size={44} />
      </div>
      <div className="text-xs mt-1" style={{ color: C.muted }}>Current Assurance</div>
      {gap !== null && (
        <div className="text-[11px] mt-1.5 font-medium" style={{ color: gap > 0 ? C.amber : C.green }}>
          {gap > 0 ? `${gap} pts to target` : "Meets target"}
        </div>
      )}
      {band?.label && <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{band.label}</div>}
    </div>
  );
}

export function AssuranceCockpit({ system, cockpit }: { system: WorkspaceSystem; cockpit: CockpitSummary }) {
  return (
    <div>
      <SectionHeading icon={Gauge}>Assurance Cockpit</SectionHeading>
      <div className="grid grid-cols-4 gap-4">
        <AssuranceTargetCard assurance={cockpit.assurance} target={cockpit.target} band={cockpit.assuranceBand} />
        <StatTile
          label="Assessment Coverage"
          value={`${cockpit.coverage?.assessedPct ?? 0}%`}
          sub={`${cockpit.coverage?.assessed ?? 0} of ${cockpit.coverage?.applicable ?? 0} controls`}
          pct={cockpit.coverage?.assessedPct}
        />
        <StatTile
          label="Residual Risk"
          value={cockpit.residualRisk.top ? cockpit.residualRisk.top.residual.severity : "—"}
          color={cockpit.residualRisk.top?.residual.severity === "Severe" ? C.red : C.ink}
          sub={cockpit.residualRisk.top ? `Top of ${cockpit.residualRisk.count} scenarios` : "No mapped scenarios"}
          ring={cockpit.residualRisk.top ? (SEVERITY_LEVELS.indexOf(cockpit.residualRisk.top.residual.severity) + 1) * 25 : 0}
          ringColor={cockpit.residualRisk.top?.residual.severity === "Severe" ? C.red : C.amber}
        />
        <StatTile
          label="Evidence Health"
          value={`${system.controlBackedPct ?? 0}%`}
          sub={system.staleEvidenceCount > 0 ? `${system.staleEvidenceCount} stale` : "All current"}
          color={system.staleEvidenceCount > 0 ? C.amber : undefined}
          pct={system.controlBackedPct}
          ringColor={system.staleEvidenceCount > 0 ? C.amber : C.green}
        />
      </div>
    </div>
  );
}
