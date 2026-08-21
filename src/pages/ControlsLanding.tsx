import React from "react";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../components/Headings";
import { C, CLASS_ORDER } from "../theme";
import { IN_SCOPE_CONTROLS, getAllSystems } from "../engine";
import { CONTROL_AREAS } from "./controlAreas";
import type { ControlAreaId } from "./controlAreas";

interface AreaMetric {
  value: number;
  label: string;
}

const DOMAIN_COUNT = new Set(IN_SCOPE_CONTROLS.map((c) => c.domain)).size;
const STANDARD_COUNT = new Set(IN_SCOPE_CONTROLS.flatMap((c) => c.frameworks.map((f) => f.standard))).size;
const SYSTEM_COUNT = getAllSystems().length;

const AREA_SUMMARIES: Record<ControlAreaId, AreaMetric[]> = {
  ccf: [
    { value: IN_SCOPE_CONTROLS.length, label: "Controls in scope" },
    { value: DOMAIN_COUNT, label: "Domains" },
    { value: STANDARD_COUNT, label: "Standards mapped" },
  ],
  "control-profile": [
    { value: CLASS_ORDER.length, label: "Classification tiers" },
    { value: SYSTEM_COUNT, label: "Systems evaluated" },
  ],
};

export function ControlsLanding({ onSelect }: { onSelect: (area: ControlAreaId) => void }) {
  return (
    <div className="w-full pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={SlidersHorizontal}
        title="Select a Control Area"
        description="Choose the control workflow you want to work in. Each area draws from the same underlying control catalog and system assessments."
      />

      <div className="px-8 grid grid-cols-1 gap-5 max-w-xl">
        {CONTROL_AREAS.map((area) => {
          const metrics = AREA_SUMMARIES[area.id];
          const Icon = area.icon;
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelect(area.id)}
              className="group text-left transition-transform hover:-translate-y-0.5"
            >
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: C.panel, border: `1px solid ${C.border}`, minHeight: 205 }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ background: `linear-gradient(135deg, ${C.accentStrong} 0%, ${C.accent} 140%)` }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.14)" }}>
                      <Icon size={15} color="#FFFFFF" />
                    </div>
                    <h2 className="text-base leading-snug min-w-0 truncate" style={{ color: "#FFFFFF", fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{area.label}</h2>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "rgba(255,255,255,0.88)" }}>Open <ArrowRight size={13} /></span>
                </div>
                <div className="p-4 pt-3">
                  <p className="text-xs leading-relaxed min-h-10" style={{ color: C.muted }}>{area.description}</p>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    {metrics.map((metric) => (
                      <div key={metric.label}>
                        <div className="text-xl font-semibold tabular-nums" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{metric.value}</div>
                        <div className="text-[10px] leading-tight mt-1" style={{ color: C.muted }}>{metric.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
