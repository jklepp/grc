import React from "react";
import { ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../theme";

export interface AreaMetric {
  value: number | string;
  label: string;
  tone?: "default" | "good" | "attention";
}

export interface AreaListItem<TId extends string = string> {
  id: TId;
  icon: LucideIcon;
  label: string;
  description: string;
  metrics: AreaMetric[];
  attention?: { count: number; label: string };
}

function metricColor(tone: AreaMetric["tone"]): string {
  if (tone === "good") return C.green;
  if (tone === "attention") return C.amber;
  return C.ink;
}

function AreaAvatar({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg shrink-0"
      style={{ width: 38, height: 38, background: C.accentBg, color: C.accent }}
    >
      <Icon size={18} />
    </div>
  );
}

// Row styling mirrors SelectSystem's SystemRow (avatar, name/description on
// the left, stat readouts on the right) so the two "pick one of these" pages
// read as the same pattern instead of a table on one and cards on the other.
function AreaRow<TId extends string>({ area, onSelect }: { area: AreaListItem<TId>; onSelect: (id: TId) => void }) {
  const hasAttention = !!area.attention && area.attention.count > 0;
  return (
    <div
      className="w-full min-w-0 flex items-center gap-4 pl-3.5 pr-4 py-3.5 text-left transition-colors wz-hover"
      style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
      onClick={() => onSelect(area.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(area.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${area.label}`}
    >
      <AreaAvatar icon={area.icon} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-snug" style={{ color: C.ink }}>{area.label}</div>
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{area.description}</div>
        {area.attention && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px]" style={{ color: hasAttention ? C.amber : C.green }}>
            {hasAttention ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
            {hasAttention ? `${area.attention.count} ${area.attention.label}` : area.attention.label}
          </div>
        )}
      </div>
      <div className="hidden md:flex items-center gap-5 shrink-0">
        {area.metrics.map((metric) => (
          <div key={metric.label} className="text-center" style={{ minWidth: 68 }}>
            <div className="text-lg font-semibold tabular-nums" style={{ color: metricColor(metric.tone), fontFamily: "'Source Serif 4', serif" }}>
              {metric.value}
            </div>
            <div className="text-[10px] leading-tight mt-0.5" style={{ color: C.muted }}>{metric.label}</div>
          </div>
        ))}
      </div>
      <ChevronRight size={16} color={C.muted} className="shrink-0" />
    </div>
  );
}

export function AreaSelectList<TId extends string>({ areas, onSelect }: { areas: AreaListItem<TId>[]; onSelect: (id: TId) => void }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
      <div style={{ background: C.panel }}>
        {areas.map((area) => (
          <AreaRow key={area.id} area={area} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
