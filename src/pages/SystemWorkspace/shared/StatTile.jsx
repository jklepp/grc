import React from "react";
import { C } from "../../../theme";
import { StatRing } from "./StatRing";

// `pct` renders a ring for tiles whose value is already a 0-100 measure
// (assurance, target, coverage); `ring`/`ringColor` overrides that with a
// value on a different scale (residual risk's severity-derived fill) so the
// card doesn't imply the number itself is a percentage.
export function StatTile({ label, value, sub, color, pct, ring, ringColor, muted }) {
  const ringPct = ring !== undefined ? ring : pct;
  const ringCol = ringColor || color || (muted ? C.muted : C.accent);
  return (
    <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="min-w-0">
        <div className="text-2xl font-semibold" style={{ color: color || C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
        <div className="text-xs mt-1" style={{ color: C.muted }}>{label}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</div>}
      </div>
      {ringPct !== undefined && ringPct !== null && <StatRing pct={ringPct} color={ringCol} />}
    </div>
  );
}
