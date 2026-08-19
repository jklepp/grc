import React from "react";
import { Gauge } from "lucide-react";
import { C } from "../../../theme";
import { SectionHeader } from "../shared/SectionHeader";
import { StatTile } from "../shared/StatTile";
import { StatRing } from "../shared/StatRing";
import type { Band } from "../../../engine/assurance";
import type { CockpitSummary, WorkspaceSystem } from "../types";

// Assurance and Target share one card so the gap between them — the thing
// the whole cockpit is organized around — reads as a single fact instead of
// two numbers a reader has to subtract themselves.
function AssuranceTargetCard({ assurance, target, band }: { assurance?: number | null; target?: number | null; band?: Band | null }) {
  const gap = assurance != null && target != null ? target - assurance : null;
  return (
    <div className="relative rounded-xl p-4 pr-20" style={{ background: `linear-gradient(135deg, ${C.accent} 0%, #4B3F99 100%)` }}>
      <div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-semibold text-white" style={{ fontFamily: "'Source Serif 4', serif" }}>{assurance ?? "—"}</span>
          <span className="text-sm mb-0.5 text-white/75">/ {target ?? "—"} target</span>
        </div>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <StatRing pct={assurance} color="#FFFFFF" trackColor="rgba(255,255,255,0.25)" size={44} />
      </div>
      <div className="text-xs mt-1 text-white/85">Current Assurance</div>
      {gap !== null && (
        <div className="text-[11px] mt-1.5 font-medium text-white/80">
          {gap > 0 ? `${gap} pts to target` : "Meets target"}
        </div>
      )}
      {band?.label && <div className="text-[11px] mt-0.5 text-white/65">{band.label}</div>}
    </div>
  );
}

export function AssuranceCockpit({ system, cockpit }: { system: WorkspaceSystem; cockpit: CockpitSummary }) {
  const risksAboveAppetite = cockpit.residualRisk.aboveAppetiteCount;
  return (
    <div>
      <SectionHeader
        icon={Gauge}
        title="System Posture"
        description="Assurance, assessment coverage, evidence coverage, and risks above appetite."
      />
      <div className="grid grid-cols-4 gap-4">
        <AssuranceTargetCard assurance={cockpit.assurance} target={cockpit.target} band={cockpit.assuranceBand} />
        <StatTile
          label="Assessment Coverage"
          value={`${cockpit.coverage?.assessedPct ?? 0}%`}
          sub={`${cockpit.coverage?.assessed ?? 0} of ${cockpit.coverage?.applicable ?? 0} controls`}
          pct={cockpit.coverage?.assessedPct}
        />
        <StatTile
          label="Risks Above Appetite"
          value={risksAboveAppetite}
          color={risksAboveAppetite > 0 ? C.red : C.green}
          sub={cockpit.residualRisk.count > 0 ? `${cockpit.residualRisk.count} mapped scenarios` : "No mapped scenarios"}
        />
        <StatTile
          label="Evidence Coverage"
          value={`${system.controlBackedPct ?? 0}%`}
          sub={`${system.evidencedControlCount ?? 0} of ${system.requiredControlCount ?? 0} required instances${system.staleEvidenceCount > 0 ? ` · ${system.staleEvidenceCount} stale` : ""}`}
          color={(system.controlBackedPct ?? 0) < 60 ? C.red : (system.controlBackedPct ?? 0) < 90 ? C.amber : C.green}
          pct={system.controlBackedPct}
          ringColor={(system.controlBackedPct ?? 0) < 60 ? C.red : (system.controlBackedPct ?? 0) < 90 ? C.amber : C.green}
        />
      </div>
    </div>
  );
}
