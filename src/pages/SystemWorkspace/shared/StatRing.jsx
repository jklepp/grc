import React from "react";
import { C } from "../../../theme";

// A tiny ring chart for a single 0-100 value — just enough visual weight to
// tell stat tiles apart from an ordinary stat card at a glance, without
// pretending to be a real analytics widget.
export function StatRing({ pct, color, size = 40, stroke = 4, trackColor }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor ?? C.border} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (filled / 100) * c} strokeLinecap="round"
      />
    </svg>
  );
}
