import React, { useMemo, useState } from "react";
import { RadioTower, Layers, AlertTriangle, ClipboardList, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import {
  STATUS_META, STATUS_ORDER, STATUS_RANK, RESPONSIBILITY_META, APPLICABILITY_META,
  EVIDENCE_HEALTH_META, EVIDENCE_HEALTH_ORDER, evidenceHealthForRow,
} from "./controlMeta";
import { StatRing } from "./shared/StatRing";

// Control | Status | Assurance | Responsibility | Evidence | Findings — the
// operational read: what's weak, why, who owns it, what proves it, is there
// an open finding. SCF #, governing policy and framework clause mappings are
// still real data, just lower priority than these six answers, so they moved
// into ControlDetailDrawer instead of occupying columns here.
const CONTROL_GRID = "2fr 130px 90px 160px 130px 80px";

function SortIcon({ dir }) {
  if (!dir) return <ChevronsUpDown size={11} style={{ opacity: 0.5 }} />;
  return dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

function HeaderCell({ label, sortKey, sort, onSort, first }) {
  const style = { borderLeft: first ? "none" : `1px solid ${C.border}`, paddingLeft: first ? 0 : 12, color: C.muted };
  if (sortKey == null) {
    return <div style={style}>{label}</div>;
  }
  const active = sort?.key === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-left"
      style={{ ...style, color: active ? C.ink : C.muted }}
    >
      {label} <SortIcon dir={active ? sort.dir : null} />
    </button>
  );
}

function ControlRow({ row, onSelect, findingsCount }) {
  const meta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const evidence = evidenceHealthForRow(row);
  const count = findingsCount ?? 0;
  return (
    <button
      onClick={() => onSelect(row)}
      className="w-full grid px-4 text-left hover:bg-white/[0.02] transition-colors"
      style={{ gridTemplateColumns: CONTROL_GRID, borderBottom: `1px solid ${C.border}` }}
    >
      <div className="py-3 min-w-0">
        <div className="text-sm leading-snug" style={{ color: C.ink }}>{row.control.name}</div>
        <div className="text-[10px] mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
          {row.control.id} <span style={{ fontFamily: "inherit" }}>· {row.control.domain}</span>
        </div>
      </div>
      <div className="py-3 pl-3 flex items-center gap-2" style={{ borderLeft: `1px solid ${C.border}` }}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>
          <meta.Icon size={11} /> {meta.label}
        </span>
        {row.keyControl && <RadioTower size={12} color={C.muted} />}
      </div>
      <div className="py-3 pl-3 flex items-center" style={{ borderLeft: `1px solid ${C.border}` }}>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: row.score != null ? C.ink : C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
          {row.score != null ? `${row.score}%` : "—"}
        </span>
      </div>
      <div className="py-3 pl-3" style={{ borderLeft: `1px solid ${C.border}` }}>
        {respMeta && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: respMeta.bg, color: respMeta.color }}>
            <respMeta.Icon size={11} /> {respMeta.label}
          </span>
        )}
      </div>
      <div className="py-3 pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
        <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: evidence.bg, color: evidence.color }}>
          <evidence.Icon size={11} /> {evidence.label}
        </div>
        {evidence.detail && <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{evidence.detail}</div>}
      </div>
      <div className="py-3 pl-3 flex items-center" style={{ borderLeft: `1px solid ${C.border}` }}>
        <span className="text-sm font-semibold tabular-nums" style={{ color: count > 0 ? C.red : C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
          {count}
        </span>
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
// not yet at a resolved good state (Inherited/Satisfied). Pending applicability
// calls are a separate concern — see APPLICABILITY REVIEW below — because
// "nobody decided if this applies" is not the same claim as "this failed."
const OUTSTANDING_STATUSES = ["partial", "deficient", "not-implemented", "unassessed"];

// The default table view and its escape hatch. Landing on "everything that's
// wrong" beats landing on an empty table or a 162-row unfiltered dump.
const DEFAULT_SELECTION = { kind: "attention-group", label: "Attention Required" };
const ALL_SELECTION = { kind: "all", label: "All Applicable Controls" };

// Every chip on the summary card is a drill-down trigger. `selection` is
// { kind: "status" | "responsibility" | "not-applicable" | "pending" |
// "attention-group" | "all", key, label } or null; clicking the active chip
// again falls back to the default view rather than clearing to empty — this
// table is never supposed to show nothing.
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
// four subtotals — this row's, Outstanding's, Pending's, and Not Applicable's
// — always sum to the system's full in-scope catalog; see TallyBar below.
function TallyRow({ label, count, color, borderTop, highlight, icon: Icon, hint, onLabelClick, labelActive, children }) {
  const Label = onLabelClick ? "button" : "span";
  return (
    <div
      className="flex items-center gap-3 py-1 px-2"
      style={{
        ...(borderTop ? { marginTop: 6, paddingTop: 7, borderTop: `1px solid ${C.border}` } : {}),
      }}
    >
      <Label
        onClick={onLabelClick}
        className="text-[10px] uppercase tracking-wide font-semibold w-40 shrink-0 whitespace-nowrap text-left"
        style={{
          color: highlight ? color : C.muted,
          cursor: onLabelClick ? "pointer" : "default",
          textDecoration: labelActive ? "underline" : "none",
        }}
      >
        {label}
      </Label>
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

function OutstandingControls({ statusCounts, count, selection, onToggle, borderTop }) {
  const active = selection?.kind === "attention-group";
  return (
    <TallyRow
      label="Attention Required" count={count} color={C.amber} borderTop={borderTop} highlight icon={AlertTriangle} hint="Needs review"
      onLabelClick={() => onToggle(DEFAULT_SELECTION)} labelActive={active}
    >
      {OUTSTANDING_STATUSES.map((status) => {
        const meta = STATUS_META[status];
        return (
          <Chip
            key={status}
            meta={meta}
            count={statusCounts[status]}
            active={selection?.kind === "status" && selection.key === status}
            onClick={() => onToggle({ kind: "status", key: status, label: `${meta.label} controls` })}
          />
        );
      })}
    </TallyRow>
  );
}

// Pending is deliberately not part of Attention Required. It means
// applicability was never decided, not that a control was tried and failed
// — conflating it with Deficient/Not Implemented would make an open review
// question read as an implementation problem.
function ApplicabilityReview({ pendingCount, selection, onToggle }) {
  const meta = APPLICABILITY_META.pending;
  return (
    <TallyRow label="Applicability Review" count={pendingCount} color={C.ink} borderTop icon={ClipboardList} hint="Not yet decided">
      <Chip
        meta={meta}
        count={pendingCount}
        active={selection?.kind === "pending"}
        onClick={() => onToggle({ kind: "pending", key: "pending", label: "Pending applicability" })}
      />
    </TallyRow>
  );
}

// The stacked bar and equation that make the tri-split's arithmetic visible
// rather than something a reader has to add up themselves.
function TallyBar({ statusCount, outstandingCount, pendingCount, naCount, total }) {
  const segments = [
    { count: statusCount, color: C.green, label: "Controls Satisfied" },
    { count: outstandingCount, color: C.amber, label: "Attention Required" },
    { count: pendingCount, color: C.ink, label: "Applicability Review" },
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
          <span className="font-semibold" style={{ color: C.ink }}>{pendingCount}</span> +{" "}
          <span className="font-semibold" style={{ color: C.ink }}>{naCount}</span> ={" "}
          <span className="font-semibold" style={{ color: C.ink }}>{total}</span> total controls
        </div>
      </div>
    </div>
  );
}

const RESPONSIBILITY_ORDER = ["enterprise", "vendor", "shared", "internal"];

// A single <select> filter, styled to match the rest of the card. `null`
// value means "any" and is always the first option.
function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-[11px] font-medium rounded px-1.5 py-1"
        style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
      >
        <option value="">Any</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// Filters layer on top of whichever chip is selected: pick "Shared
// Responsibility" as the base, then narrow to "Deficient" with the Status
// filter, or pick "Not Assessed" as the base and narrow to "AI Security"
// with Domain — two independent lenses instead of one exclusive chip.
function FilterBar({ filters, onChange, domainOptions, frameworkOptions, showStatusFilters }) {
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="flex items-center gap-4 flex-wrap px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
      <FilterSelect label="Domain" value={filters.domain} onChange={(v) => onChange({ ...filters, domain: v })} options={domainOptions.map((d) => ({ value: d, label: d }))} />
      <FilterSelect label="Framework" value={filters.framework} onChange={(v) => onChange({ ...filters, framework: v })} options={frameworkOptions.map((f) => ({ value: f, label: f }))} />
      {showStatusFilters && (
        <>
          <FilterSelect label="Status" value={filters.status} onChange={(v) => onChange({ ...filters, status: v })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
          <FilterSelect label="Responsibility" value={filters.responsibility} onChange={(v) => onChange({ ...filters, responsibility: v })} options={RESPONSIBILITY_ORDER.map((r) => ({ value: r, label: RESPONSIBILITY_META[r].label }))} />
          <FilterSelect label="Evidence" value={filters.evidenceHealth} onChange={(v) => onChange({ ...filters, evidenceHealth: v })} options={EVIDENCE_HEALTH_ORDER.map((e) => ({ value: e, label: EVIDENCE_HEALTH_META[e].label }))} />
        </>
      )}
      {active && (
        <button onClick={() => onChange({ domain: null, framework: null, status: null, responsibility: null, evidenceHealth: null })} className="text-[11px] font-medium ml-auto" style={{ color: C.accent }}>
          Clear filters
        </button>
      )}
    </div>
  );
}

const EVIDENCE_RANK = Object.fromEntries(EVIDENCE_HEALTH_ORDER.map((level, i) => [level, i]));

function applyFilters(rows, filters, reasonBased) {
  return rows.filter((r) => {
    const control = r.control;
    if (filters.domain && control.domain !== filters.domain) return false;
    if (filters.framework && !control.frameworks.some((f) => f.standard === filters.framework)) return false;
    if (!reasonBased) {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.responsibility && r.responsibility !== filters.responsibility) return false;
      if (filters.evidenceHealth && evidenceHealthForRow(r).level !== filters.evidenceHealth) return false;
    }
    return true;
  });
}

function sortRows(rows, sort, findingsByControl) {
  if (!sort) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  const valueOf = (row) => {
    switch (sort.key) {
      case "assurance": return row.score ?? -1;
      case "status": return STATUS_RANK[row.status] ?? 99;
      case "findings": return findingsByControl[row.control.id] ?? 0;
      case "evidence": return EVIDENCE_RANK[evidenceHealthForRow(row).level] ?? 99;
      case "responsibility": return RESPONSIBILITY_META[row.responsibility]?.label ?? "";
      default: return 0;
    }
  };
  return [...rows].sort((a, b) => {
    const va = valueOf(a), vb = valueOf(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

// The dynamic drill-down table: whatever chip is selected up in the summary
// card, its matching controls render here, filtered and sorted further by
// the controls above the header row. Status/Responsibility/Attention/All
// selections carry full matrix rows (real status, assurance, evidence,
// findings, drawer detail); Not Applicable/Pending only ever had a control +
// a reason, so they get a lighter table instead of forcing fake columns onto them.
function SelectedControlsTable({
  selection, matrix, applicabilitySummary, findingsByControl, onSelectRow, onSwitchToAll,
  filters, onFilterChange, domainOptions, frameworkOptions, sort, onSort,
}) {
  if (!selection) return null;

  const isReasonBased = selection.kind === "not-applicable" || selection.kind === "pending";
  const baseRows = selection.kind === "status" ? matrix.filter((r) => r.status === selection.key)
    : selection.kind === "responsibility" ? matrix.filter((r) => r.responsibility === selection.key)
    : selection.kind === "attention-group" ? matrix.filter((r) => OUTSTANDING_STATUSES.includes(r.status))
    : selection.kind === "all" ? matrix
    : selection.kind === "not-applicable" ? applicabilitySummary.notApplicableControls
    : applicabilitySummary.pendingControls;

  const filtered = applyFilters(baseRows, filters, isReasonBased);
  // Attention Required's whole point is not burying real deficiencies under
  // a pile of Not Assessed rows — default to worst-first unless the user
  // picked a column to sort by instead.
  const defaultSorted = selection.kind === "attention-group" && !sort
    ? [...filtered].sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))
    : filtered;
  const rows = isReasonBased ? filtered : sortRows(defaultSorted, sort, findingsByControl);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{selection.label}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{rows.length} control{rows.length !== 1 ? "s" : ""}</div>
        </div>
        {selection.kind !== "all" && (
          <button onClick={onSwitchToAll} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.panel2, color: C.muted }}>
            View all applicable controls
          </button>
        )}
      </div>
      <FilterBar filters={filters} onChange={onFilterChange} domainOptions={domainOptions} frameworkOptions={frameworkOptions} showStatusFilters={!isReasonBased} />
      {isReasonBased ? (
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {rows.map((item) => (
            <div key={item.control.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{item.control.id}</span>
                <span className="text-sm" style={{ color: C.ink }}>{item.control.name}</span>
                <span className="text-[10px]" style={{ color: C.muted }}>· {item.control.domain}</span>
              </div>
              <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{item.reason}</div>
            </div>
          ))}
          {rows.length === 0 && <div className="p-6 text-xs text-center" style={{ color: C.muted }}>None.</div>}
        </div>
      ) : (
        <>
          <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: CONTROL_GRID, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <HeaderCell label="CONTROL" first />
            <HeaderCell label="STATUS" sortKey="status" sort={sort} onSort={onSort} />
            <HeaderCell label="ASSURANCE" sortKey="assurance" sort={sort} onSort={onSort} />
            <HeaderCell label="RESPONSIBILITY" sortKey="responsibility" sort={sort} onSort={onSort} />
            <HeaderCell label="EVIDENCE" sortKey="evidence" sort={sort} onSort={onSort} />
            <HeaderCell label="FINDINGS" sortKey="findings" sort={sort} onSort={onSort} />
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {rows.map((row) => (
              <ControlRow key={row.control.id} row={row} onSelect={onSelectRow} findingsCount={findingsByControl[row.control.id]} />
            ))}
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
// (opened by clicking a chip, and open by default on Attention Required) is
// the drill-down, and ControlDetailDrawer (opened from a table row) is the
// full per-control detail.
export function SystemControls({ matrix, statusCounts, applicabilitySummary, posture, findingsByControl = {}, onSelectRow }) {
  const resp = applicabilitySummary?.byResponsibility;
  const controlStatusCount = RESOLVED_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const outstandingCount = OUTSTANDING_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const pendingCount = applicabilitySummary?.pending ?? 0;
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [filters, setFilters] = useState({ domain: null, framework: null, status: null, responsibility: null, evidenceHealth: null });
  const [sort, setSort] = useState(null);

  const domainOptions = useMemo(() => [...new Set(matrix.map((r) => r.control.domain))].sort(), [matrix]);
  const frameworkOptions = useMemo(() => [...new Set(matrix.flatMap((r) => r.control.frameworks.map((f) => f.standard)))].sort(), [matrix]);

  function toggleSelection(next) {
    setSelection((prev) => {
      const isActive = prev && prev.kind === next.kind && prev.key === next.key;
      if (!isActive) return next;
      return next.kind === "attention-group" ? ALL_SELECTION : DEFAULT_SELECTION;
    });
    setSort(null);
  }

  function onSort(key) {
    setSort((prev) => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
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

          <OutstandingControls
            statusCounts={statusCounts}
            count={outstandingCount}
            selection={selection}
            onToggle={toggleSelection}
            borderTop={false}
          />

          <TallyRow label="Controls Satisfied" count={controlStatusCount} color={C.green} borderTop>
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

          <ApplicabilityReview pendingCount={pendingCount} selection={selection} onToggle={toggleSelection} />

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
            pendingCount={pendingCount}
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
        findingsByControl={findingsByControl}
        onSelectRow={onSelectRow}
        onSwitchToAll={() => toggleSelection(ALL_SELECTION)}
        filters={filters}
        onFilterChange={setFilters}
        domainOptions={domainOptions}
        frameworkOptions={frameworkOptions}
        sort={sort}
        onSort={onSort}
      />
    </div>
  );
}
