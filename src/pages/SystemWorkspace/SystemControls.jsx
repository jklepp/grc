import React, { useState } from "react";
import { RadioTower, Layers, AlertTriangle } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import { STATUS_META, RESPONSIBILITY_META, APPLICABILITY_META } from "./controlMeta";
import { POLICY_BY_CONTROL } from "./policyLookup";
import { StatRing } from "./shared/StatRing";

function ControlRow({ row, onSelect }) {
  const meta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const policy = POLICY_BY_CONTROL[row.control.id];
  return (
    <button
      onClick={() => onSelect(row)}
      className="w-full grid px-4 text-left hover:bg-white/[0.02] transition-colors"
      style={{ gridTemplateColumns: "90px 2fr 150px 170px 150px", borderBottom: `1px solid ${C.border}` }}
    >
      <div className="py-3 text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{row.control.id}</div>
      <div className="py-3 pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
        <div className="text-sm leading-snug" style={{ color: C.ink }}>{row.control.name}</div>
        <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>
          {row.control.domain}{row.control.toolHint && <span> · Enforced by {row.control.toolHint}</span>}
        </div>
      </div>
      <div className="py-3 pl-3 flex items-center gap-2" style={{ borderLeft: `1px solid ${C.border}` }}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>
          <meta.Icon size={11} /> {meta.label}
        </span>
        {row.keyControl && <RadioTower size={12} color={C.muted} />}
        {row.score != null && (
          <span className="text-[11px] ml-auto tabular-nums" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{row.score}</span>
        )}
      </div>
      <div className="py-3 pl-3" style={{ borderLeft: `1px solid ${C.border}` }}>
        {respMeta && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: respMeta.bg, color: respMeta.color }}>
            <respMeta.Icon size={11} /> {respMeta.label}
          </span>
        )}
      </div>
      <div className="py-3 pl-3 text-[11px] truncate" style={{ borderLeft: `1px solid ${C.border}`, color: C.muted }}>
        {policy ? policy.code : "—"}
      </div>
    </button>
  );
}

// Split once so Controls Satisfied and Controls Outstanding never repeat
// the same status chip: Controls Satisfied is the "resolved" read (good
// state, or ruled out entirely), Outstanding is everything still owed.
const RESOLVED_STATUSES = ["inherited", "satisfied"];
const NOT_APPLICABLE_META = APPLICABILITY_META["not-applicable"];

// The punch list a system owner actually needs to work: applicable controls
// not yet at a resolved good state (Inherited/Satisfied), plus Pending
// applicability calls still waiting on a decision.
const OUTSTANDING_STATUSES = ["partial", "deficient", "not-implemented", "unassessed"];

// Every chip on the summary card is a drill-down trigger. `selection` is
// { kind: "status" | "responsibility" | "not-applicable" | "pending", key, label }
// or null; clicking the active chip again clears it. Kept as one shape so the
// table at the bottom of the page only needs one switch, not four.
function Chip({ meta, count, active, onClick }) {
  // The neutral (panel2-backed) variants — Not Assessed, System Owned — sit
  // too close in value to the card behind them to read as a pill on their
  // own; give just those a border so they don't wash out.
  const neutral = meta.bg === C.panel2;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded shrink-0 transition-colors"
      style={{
        background: meta.bg,
        color: meta.color,
        border: neutral ? `1px solid ${C.borderStrong}` : "1px solid transparent",
        boxShadow: active ? `0 0 0 1.5px ${meta.color}` : "none",
      }}
    >
      <meta.Icon size={11} /> {count} {meta.label}
    </button>
  );
}

// One row of this tri-split: a fixed-width label, the row's own subtotal
// (the number the chips beside it add up to), then the chips themselves. The
// three subtotals — this row's, Outstanding's, and Not Applicable's — always
// sum to the system's full in-scope catalog; see TallyBar below.
function TallyRow({ label, count, color, borderTop, highlight, icon: Icon, hint, children }) {
  return (
    <div
      className={`flex items-center gap-3 py-1 ${highlight ? "rounded-lg" : "px-2"}`}
      style={{
        ...(borderTop ? { marginTop: 6, paddingTop: 7, borderTop: `1px solid ${C.border}` } : {}),
        // Full-bleed so the pill's border runs edge-to-edge with the card
        // (and the control table below it), instead of sitting inset like
        // the plain rows above/below it — the outer p-5/px-2 insets are
        // cancelled here and rebuilt as padding so the label still lines up.
        ...(highlight
          ? { marginLeft: -20, marginRight: -20, paddingLeft: 28, paddingRight: 28, background: C.amberBg, border: `1px solid ${C.amber}4D` }
          : {}),
      }}
    >
      <span className="text-[10px] uppercase tracking-wide font-semibold w-40 shrink-0 whitespace-nowrap" style={{ color: highlight ? color : C.muted }}>
        {label}
      </span>
      <span className="text-sm font-semibold w-8 shrink-0 tabular-nums" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{count}</span>
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">{children}</div>
      {hint && (
        <span className="text-[11px] ml-auto shrink-0 font-medium inline-flex items-center gap-1" style={{ color }}>
          {Icon && <Icon size={12} />} {hint}
        </span>
      )}
    </div>
  );
}

function OutstandingControls({ statusCounts, pendingCount, count, selection, onToggle }) {
  const chips = [
    ...OUTSTANDING_STATUSES.map((status) => ({ kind: "status", key: status, meta: STATUS_META[status], count: statusCounts[status] })),
    { kind: "pending", key: "pending", meta: APPLICABILITY_META.pending, count: pendingCount },
  ];
  return (
    <TallyRow label="Attention Required" count={count} color={C.amber} borderTop highlight icon={AlertTriangle} hint="Needs review">
      {chips.map(({ kind, key, meta, count }) => (
        <Chip
          key={key}
          meta={meta}
          count={count}
          active={selection?.kind === kind && selection.key === key}
          onClick={() => onToggle({ kind, key, label: `${meta.label} controls` })}
        />
      ))}
    </TallyRow>
  );
}

// The stacked bar and equation that make the tri-split's arithmetic visible
// rather than something a reader has to add up themselves.
function TallyBar({ statusCount, outstandingCount, naCount, total }) {
  const segments = [
    { count: statusCount, color: C.green, label: "Controls Satisfied" },
    { count: outstandingCount, color: C.amber, label: "Attention Required" },
    { count: naCount, color: C.muted, label: "Not Applicable" },
  ];
  return (
    <div className="flex items-start gap-3 px-2 py-1" style={{ marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
      <span className="text-[10px] uppercase tracking-wide font-semibold w-40 shrink-0 pt-0.5 whitespace-nowrap" style={{ color: C.muted }}>Control Catalog</span>
      <div className="flex-1 min-w-0">
        <div className="flex h-2 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
          {segments.map((s) => (
            <div key={s.label} title={`${s.label}: ${s.count}`} style={{ width: `${total ? (s.count / total) * 100 : 0}%`, background: s.color }} />
          ))}
        </div>
        <div className="text-xs mt-2" style={{ color: C.muted }}>
          <span className="font-semibold" style={{ color: C.green }}>{statusCount}</span> +{" "}
          <span className="font-semibold" style={{ color: C.amber }}>{outstandingCount}</span> +{" "}
          <span className="font-semibold" style={{ color: C.ink }}>{naCount}</span> ={" "}
          <span className="font-semibold" style={{ color: C.ink }}>{total}</span> total controls
        </div>
      </div>
    </div>
  );
}

// The dynamic drill-down table: whatever chip is selected up in the summary
// card, its matching controls render here. Status/Responsibility chips carry
// full matrix rows (real status, evidence, drawer detail); Not Applicable/
// Pending only ever had a control + a reason, so they get a lighter table
// instead of forcing a fake status onto them.
function SelectedControlsTable({ selection, matrix, applicabilitySummary, onSelectRow, onClear }) {
  if (!selection) return null;

  const isReasonBased = selection.kind === "not-applicable" || selection.kind === "pending";
  const rows = selection.kind === "status" ? matrix.filter((r) => r.status === selection.key)
    : selection.kind === "responsibility" ? matrix.filter((r) => r.responsibility === selection.key)
    : selection.kind === "not-applicable" ? applicabilitySummary.notApplicableControls
    : applicabilitySummary.pendingControls;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold capitalize" style={{ color: C.ink }}>{selection.label}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{rows.length} control{rows.length !== 1 ? "s" : ""}</div>
        </div>
        <button onClick={onClear} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.panel2, color: C.muted }}>Clear</button>
      </div>
      {isReasonBased ? (
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {rows.map((item) => (
            <div key={item.control.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{item.control.id}</span>
                <span className="text-sm" style={{ color: C.ink }}>{item.control.name}</span>
              </div>
              <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{item.reason}</div>
            </div>
          ))}
          {rows.length === 0 && <div className="p-6 text-xs text-center" style={{ color: C.muted }}>None.</div>}
        </div>
      ) : (
        <>
          <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: "90px 2fr 150px 170px 150px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <div>SCF #</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>CONTROL</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>STATUS</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>RESPONSIBILITY</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>GOVERNING POLICY</div>
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {rows.map((row) => <ControlRow key={row.control.id} row={row} onSelect={onSelectRow} />)}
            {rows.length === 0 && <div className="p-6 text-xs text-center" style={{ color: C.muted }}>No controls match this filter.</div>}
          </div>
        </>
      )}
    </div>
  );
}

// What controls should exist, are they implemented, and can we prove them?
// Requirement → Control → Implementation → Evidence chain: the summary card's
// chips are the requirement/applicability read, the table at the bottom
// (opened by clicking a chip) is the drill-down, and ControlDetailDrawer
// (opened from a table row) is the full per-control detail.
export function SystemControls({ matrix, statusCounts, applicabilitySummary, posture, onSelectRow }) {
  const resp = applicabilitySummary?.byResponsibility;
  const controlStatusCount = RESOLVED_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const outstandingCount = OUTSTANDING_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0) + (applicabilitySummary?.pending ?? 0);
  const [selection, setSelection] = useState(null);

  function toggleSelection(next) {
    setSelection((prev) => (prev && prev.kind === next.kind && prev.key === next.key ? null : next));
  }

  return (
    <div className="px-8 pb-10 space-y-6">
      <SectionHeading icon={Layers}>Controls</SectionHeading>

      {applicabilitySummary && (
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {posture && (
            <div className="grid grid-cols-3 gap-6 pb-5 mb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div
                className="flex items-center gap-3 rounded-xl p-4"
                style={{ background: `linear-gradient(135deg, ${C.accent} 0%, #4B3F99 100%)` }}
              >
                <StatRing pct={posture.assurance} color="#FFFFFF" trackColor="rgba(255,255,255,0.25)" size={44} />
                <div>
                  <div className="text-3xl font-semibold" style={{ color: "#FFFFFF", fontFamily: "'Source Serif 4', serif" }}>{posture.assurance}%</div>
                  <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>Assurance — confidence controls operate effectively</div>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{posture.compliance}%</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>Compliance — are applicable controls implemented</div>
              </div>
              <div className="flex flex-col justify-center">
                <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{posture.coverage}%</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>Assessment Coverage — have applicable controls been assessed</div>
              </div>
            </div>
          )}

          <TallyRow label="Controls Satisfied" count={controlStatusCount} color={C.green}>
            {RESOLVED_STATUSES.map((status) => {
              const meta = STATUS_META[status];
              return (
                <Chip
                  key={status}
                  meta={meta}
                  count={statusCounts[status]}
                  active={selection?.kind === "status" && selection.key === status}
                  onClick={() => toggleSelection({ kind: "status", key: status, label: `${meta.label} controls` })}
                />
              );
            })}
          </TallyRow>

          <OutstandingControls
            statusCounts={statusCounts}
            pendingCount={applicabilitySummary.pending}
            count={outstandingCount}
            selection={selection}
            onToggle={toggleSelection}
          />

          <TallyRow label="Controls Not Applicable" count={applicabilitySummary.notApplicable} color={C.ink} borderTop>
            <Chip
              meta={NOT_APPLICABLE_META}
              count={applicabilitySummary.notApplicable}
              active={selection?.kind === "not-applicable"}
              onClick={() => toggleSelection({ kind: "not-applicable", key: "not-applicable", label: "Not Applicable controls" })}
            />
          </TallyRow>

          <TallyBar
            statusCount={controlStatusCount}
            outstandingCount={outstandingCount}
            naCount={applicabilitySummary.notApplicable}
            total={applicabilitySummary.total}
          />

          <div className="flex items-center gap-3 px-2 py-1" style={{ marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
            <span className="text-[10px] uppercase tracking-wide font-semibold w-40 shrink-0 whitespace-nowrap" style={{ color: C.muted }}>Responsibility</span>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { respKey: "internal", count: resp?.owned },
                { respKey: "shared", count: resp?.shared },
                { respKey: "enterprise", count: resp?.enterprise },
                { respKey: "vendor", count: resp?.vendor },
              ].map(({ respKey, count }) => (
                <Chip
                  key={respKey}
                  meta={RESPONSIBILITY_META[respKey]}
                  count={count}
                  active={selection?.kind === "responsibility" && selection.key === respKey}
                  onClick={() => toggleSelection({ kind: "responsibility", key: respKey, label: `${RESPONSIBILITY_META[respKey].label} controls` })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <SelectedControlsTable
        selection={selection}
        matrix={matrix}
        applicabilitySummary={applicabilitySummary}
        onSelectRow={onSelectRow}
        onClear={() => setSelection(null)}
      />
    </div>
  );
}
