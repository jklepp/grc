import React from "react";
import { AlertCircle, Boxes, Circle, Clock, Link2, User } from "lucide-react";
import { C } from "../../../theme";
import { FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META } from "../../../engine";
import type { EngineFinding } from "../../../engine/findings";

const THEME_COLOR: Record<string, string> = {
  na: C.muted,
  accent: C.accent,
  red: C.red,
  green: C.green,
  amber: C.amber,
  muted: C.muted,
};

// One finding, as a POA&M row. Read-only by default — that is how the Testing
// tab's pen-test and tabletop sections use it.
//
// `onOpen` and `actions` are what Findings & CAPs adds on top: the same row,
// made operable. Extended rather than forked so a change to how a finding reads
// lands everywhere at once (CONTRACT 1.2/1.4).
export function POAMRow({ item, onOpen, actions, selected = false }: {
  item: EngineFinding;
  onOpen?: () => void;
  actions?: React.ReactNode;
  selected?: boolean;
}) {
  const statusMeta = FINDING_REMEDIATION_STATUS_META[item.remediationStatus];
  const meta = { color: THEME_COLOR[statusMeta?.color] ?? C.muted, label: statusMeta?.label ?? item.remediationStatus };
  const sevMeta = item.severity ? FINDING_SEVERITY_META[item.severity] : null;
  return (
    <div
      className={`rounded-lg p-4 mb-2${onOpen ? " cursor-pointer" : ""}`}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      style={{
        background: C.panel,
        border: `1px solid ${selected ? C.accent : C.border}`,
      }}
    >
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
        {/* The asset is a locator now, not the anchor — say so when it is
            absent rather than leaving a gap where a name used to be. */}
        <span className="flex items-center gap-1" style={{ color: C.muted }}>
          <Boxes size={11} /> {item.assetName ?? "No asset named"}
        </span>
        <span className="flex items-center gap-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}><Link2 size={11} /> {item.jira}</span>
      </div>
      {actions && (
        <div
          className="flex items-center gap-2 flex-wrap mt-3 pt-3"
          style={{ borderTop: `1px solid ${C.border}` }}
          // The row itself opens the editor; a click on an action button must
          // not do both.
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
