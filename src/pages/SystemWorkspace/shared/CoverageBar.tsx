import React from "react";
import { C } from "../../../theme";

export function CoverageBar({ pct, color }: { pct?: number | null; color?: string }) {
  if (pct == null) return <span className="text-xs" style={{ color: C.muted }}>—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border, minWidth: 40 }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color || C.accent }} />
      </div>
      <span className="text-xs tabular-nums w-9 text-right" style={{ color: C.muted }}>{pct}%</span>
    </div>
  );
}
