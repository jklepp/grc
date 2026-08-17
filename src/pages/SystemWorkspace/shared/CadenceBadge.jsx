import React from "react";
import { C } from "../../../theme";

export function CadenceBadge({ cadence }) {
  if (!cadence) return <span className="text-xs" style={{ color: C.muted }}>Not tracked</span>;
  if (cadence.overdue) return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.redBg, color: C.red }}>OVERDUE</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.greenBg, color: C.green }}>Due in {cadence.daysUntilDue}d</span>;
}
