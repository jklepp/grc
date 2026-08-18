import React from "react";
import { AlertCircle, Circle, Clock, Link2, User } from "lucide-react";
import { C } from "../../../theme";
import { FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META } from "../../../engine";

export function POAMRow({ item }) {
  const statusMeta = FINDING_REMEDIATION_STATUS_META[item.remediationStatus];
  const meta = { color: C[statusMeta?.color] ?? C.muted, label: statusMeta?.label ?? item.remediationStatus };
  const sevMeta = item.severity ? FINDING_SEVERITY_META[item.severity] : null;
  return (
    <div className="rounded-lg p-4 mb-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{item.title}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>Affected control: {item.controlName}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sevMeta && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sevMeta.color === "red" ? C.red : sevMeta.color === "amber" ? C.amber : C.muted, background: sevMeta.color === "red" ? C.redBg : sevMeta.color === "amber" ? C.amberBg : C.panel2 }}>
              {sevMeta.label.toUpperCase()}
            </span>
          )}
          {item.overdue && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, background: C.redBg }}>
              <AlertCircle size={11} /> OVERDUE
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2.5 text-xs flex-wrap">
        <span className="flex items-center gap-1" style={{ color: meta.color }}><Circle size={7} fill={meta.color} color={meta.color} /> {meta.label}</span>
        {item.source && item.source !== "control-gap" && (
          <span className="text-[11px]" style={{ color: C.muted }}>Source: {item.source.replace(/-/g, " ")}</span>
        )}
        <span className="flex items-center gap-1" style={{ color: C.muted }}><User size={11} /> {item.ownerName}</span>
        <span className="flex items-center gap-1" style={{ color: item.overdue ? C.red : C.muted }}><Clock size={11} /> Target {item.due}</span>
        <span className="flex items-center gap-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}><Link2 size={11} /> {item.jira}</span>
      </div>
    </div>
  );
}
