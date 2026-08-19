import React from "react";
import { Layers } from "lucide-react";
import { C } from "../../../theme";
import { ASSURANCE_CATEGORIES, PRISMA_LEVELS } from "../../../engine";
import type { PrismaLevel } from "../../../graph/nodes/taxonomy";
import { SectionHeader } from "../shared/SectionHeader";
import type { WorkspaceSystem } from "../types";

// Continuous 0–100 averages, not the five-point compliance scale. Thresholds
// follow the same colour steps ratingColor uses so a 75 mean reads like
// Mostly Compliant and a null stays muted rather than looking like a zero.
function laneColor(rating: number | null): string {
  if (rating == null) return C.muted;
  if (rating >= 100) return C.green;
  if (rating >= 75) return C.accent;
  if (rating >= 25) return C.amber;
  return C.red;
}

function PrismaRung({ level, rating }: { level: PrismaLevel; rating: number | null }) {
  return (
    <div className="min-w-0 rounded-lg px-2 py-2" style={{ background: C.panel2 }}>
      <div className="text-[10px] font-semibold truncate" style={{ color: C.muted }}>{level}</div>
      <div
        className="text-sm font-semibold tabular-nums mt-0.5"
        style={{ color: laneColor(rating), fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {rating == null ? "—" : rating}
      </div>
      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
        <div className="h-full rounded-full" style={{ width: `${rating ?? 0}%`, background: laneColor(rating) }} />
      </div>
    </div>
  );
}

export function AssuranceLanes({ system }: { system: WorkspaceSystem }) {
  return (
    <div>
      <SectionHeader
        icon={Layers}
        title="Assurance Lanes"
        description="How each CCF rollup scores on the five PRISMA levels. Unassessed categories and rungs stay empty — they are not scored as zero."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ASSURANCE_CATEGORIES.map((category) => {
          const lane = system.categories[category];
          return (
            <div key={category} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{category}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                    {lane.coverage.assessed} of {lane.coverage.applicable} assessed
                  </div>
                </div>
                <div
                  className="text-2xl font-semibold tabular-nums shrink-0"
                  style={{ color: lane.score == null ? C.muted : C.ink, fontFamily: "'Source Serif 4', serif" }}
                >
                  {lane.score ?? "—"}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mt-3">
                {PRISMA_LEVELS.map((level) => (
                  <PrismaRung key={level} level={level} rating={lane.levelAverages[level]} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
