import React from "react";
import { Plug } from "lucide-react";
import { C, CLASS_META } from "../theme";

// Small presentational badges shared by any page that displays a system from the
// register (Data Classification Register, System Security Plan) — kept in one
// place so a system looks identical wherever it's shown.
export function ClassificationTag({ level }) {
  const meta = CLASS_META[level];
  return (
    <span className="text-[11px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide" style={{ background: meta.bg, color: meta.color, letterSpacing: "0.04em" }}>
      {level}
    </span>
  );
}

export function StandardChip({ standard, active, onClick }) {
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

export function DataTypeChip({ type }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: C.accentBg, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
      {type}
    </span>
  );
}

export function SourceBadge({ syncSource }) {
  const isVanta = syncSource === "vanta";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: isVanta ? C.accentBg : C.amberBg, color: isVanta ? C.accent : C.amber }}>
      <Plug size={10} />
      {isVanta ? "Vanta-monitored" : "Private integration"}
    </span>
  );
}
