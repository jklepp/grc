import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plug, Search, ChevronDown } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { assuranceBand } from "../engine";
import type { DataType } from "../graph/nodes/dataTypes";
import type { ClassificationTier } from "../graph/nodes/taxonomy";
import type { SystemId } from "../graph/ids";
import type { SystemRollup } from "../engine/rollups";

const BADGE_COLORS = {
  green: { color: C.green, bg: C.greenBg },
  amber: { color: C.amber, bg: C.amberBg },
  red: { color: C.red, bg: C.redBg },
  accent: { color: C.accent, bg: C.accentBg },
  muted: { color: C.muted, bg: "transparent" },
};

function colorFor(key: string): { color: string; bg: string } {
  if (key in BADGE_COLORS) return BADGE_COLORS[key as keyof typeof BADGE_COLORS];
  return BADGE_COLORS.muted;
}

// Small ring badge for showing a system's overall assurance % inline next to
// its name/classification (title bars, picker rows) — a compact cousin of the
// larger AssuranceRing used on the Executive Overview's hero stat.
export function AssuranceBadge({ pct, size = 34 }: { pct?: number | null; size?: number }) {
  if (pct == null) return null;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const color = colorFor(assuranceBand(pct).color).color;
  return (
    <div className="inline-flex items-center gap-1.5 shrink-0" title={`${pct}% Cyber Assurance`}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.panel2} strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          />
        </svg>
        <div style={{ position: "absolute", inset: 0 }} className="flex items-center justify-center">
          <span className="font-semibold" style={{ color, fontSize: size * 0.28, fontFamily: "'Source Serif 4', serif" }}>{pct}</span>
        </div>
      </div>
    </div>
  );
}

// Small presentational badges shared by any page that displays a system from the
// register (Data Classification Register, System Security Plan) — kept in one
// place so a system looks identical wherever it's shown.
export function ClassificationTag({ level }: { level: ClassificationTier }) {
  const meta = CLASS_META[level];
  return (
    <span className="text-[11px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide" style={{ background: meta.bg, color: meta.color, letterSpacing: "0.04em" }}>
      {level}
    </span>
  );
}

interface StandardChipProps {
  standard: string;
  active?: boolean;
  onClick?: () => void;
}

export function StandardChip({ standard, active, onClick }: StandardChipProps) {
  const clickable = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className="text-[11px] px-2 py-0.5 rounded font-medium transition-colors"
      style={{ border: `1px solid ${C.accent}`, color: active ? "#0F1420" : C.accent, background: active ? C.accent : "transparent", cursor: clickable ? "pointer" : "default" }}
    >
      {standard}
    </button>
  );
}

export function DataTypeChip({ type }: { type: string }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: C.accentBg, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
      {type}
    </span>
  );
}

// A single data type a system processes, shown as a scannable card (name +
// sensitivity + regulatory flags) instead of a comma-joined text line — used
// on the System Security Profile's Data section.
export function DataTypeCard({ dataType }: { dataType: DataType }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-sm font-semibold" style={{ color: C.ink }}>{dataType.name}</div>
        <ClassificationTag level={dataType.sensitivity} />
      </div>
      {dataType.description && (
        <div className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{dataType.description}</div>
      )}
      <div className="flex gap-1.5 flex-wrap mt-3">
        {dataType.regulatoryFlags.length > 0
          ? dataType.regulatoryFlags.map((f) => (
              <span key={f} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: C.accentBg, color: C.accent }}>{f}</span>
            ))
          : <span className="text-[11px]" style={{ color: C.muted }}>No regulated-data category</span>}
      </div>
    </div>
  );
}

export function SourceBadge({ syncSource }: { syncSource: string }) {
  const isVanta = syncSource === "vanta";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: isVanta ? C.accentBg : C.amberBg, color: isVanta ? C.accent : C.amber }}>
      <Plug size={10} />
      {isVanta ? "Vanta-monitored" : "Private integration"}
    </span>
  );
}

// Searchable system dropdown for any page that lets the user switch which
// system they're looking at (Systems Data Flow, System Register) — a
// type-to-filter combobox instead of a plain <select> so systems can be found
// by name, id, or classification.
interface SystemPickerProps {
  systems: readonly SystemRollup[];
  systemId: SystemId;
  onSelect: (id: SystemId) => void;
  width?: number;
}

export function SystemPicker({ systems, systemId, onSelect, width = 380 }: SystemPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = systems.find((s) => s.id === systemId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) =>
      s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.classification?.toLowerCase() ?? "").includes(q)
    );
  }, [systems, query]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function choose(id: SystemId) {
    onSelect(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef} style={{ width }}>
      <div
        className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg cursor-text"
        style={{ background: C.panel, border: `1px solid ${open ? C.accent : C.border}` }}
        onClick={() => setOpen(true)}
      >
        <Search size={14} color={C.muted} className="shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected ? selected.name : "Search systems…"}
          className="bg-transparent text-sm outline-none w-full min-w-0"
          style={{ color: C.ink }}
        />
        <ChevronDown size={14} color={C.muted} className="shrink-0" />
      </div>

      {open && (
        <div
          className="absolute z-10 mt-1.5 w-full rounded-lg overflow-y-auto"
          style={{ background: C.panel, border: `1px solid ${C.border}`, maxHeight: 320, boxShadow: "0 12px 28px rgba(0,0,0,0.28)" }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: C.muted }}>No systems match "{query}"</div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => choose(s.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                style={{ background: s.id === systemId ? C.accentBg : "transparent", borderBottom: `1px solid ${C.border}` }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: C.ink }}>{s.name}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>{s.id}{s.assetCount != null ? ` · ${s.assetCount} assets` : ""}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.classification && <ClassificationTag level={s.classification} />}
                  {s.overallAssurance != null && (
                    <span className="text-xs font-semibold w-9 text-right" style={{ color: colorFor(assuranceBand(s.overallAssurance).color).color }}>{s.overallAssurance}%</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
