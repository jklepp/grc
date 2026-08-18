import React, { useMemo, useState } from "react";
import { RadioTower, Layers, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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
// into ControlEvaluationPanel instead of occupying columns here.
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
// No icon: this chip is always read alongside its own colored group (the
// Control Status legend groups chips by the same color as their bar
// segment), so the color already carries the meaning an icon would repeat.
function Chip({ label, count, color, bg, active, onClick }) {
  // The neutral (panel2-backed) variants — Not Assessed, System Owned — sit
  // too close in value to the card behind them to read as a pill on their
  // own; give just those a border so they don't wash out.
  const neutral = bg === C.panel2;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded shrink-0 transition-colors"
      style={{
        background: bg,
        color,
        border: neutral ? `1px solid ${C.borderStrong}` : "1px solid transparent",
        boxShadow: active ? `0 0 0 1.5px ${color}` : "none",
      }}
    >
      <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: 999, background: color, display: "inline-block" }} />
      {count} {label}
    </button>
  );
}

// A matched posture tile for the KPI row. `primary` marks Assurance: same
// tile shape as its neighbors, but the ring chart + accent color keep it the
// visual anchor rather than an oversized card fighting two plain numbers.
function PostureTile({ value, label, sublabel, primary }) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4"
      style={
        primary
          ? { background: `linear-gradient(135deg, ${C.accent} 0%, #4B3F99 100%)` }
          : { background: C.panel, border: `1px solid ${C.border}` }
      }
    >
      {primary && <StatRing pct={value} color="#FFFFFF" trackColor="rgba(255,255,255,0.25)" size={44} />}
      <div className="min-w-0">
        <div className="text-3xl font-semibold" style={{ color: primary ? "#FFFFFF" : C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}%</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide mt-1" style={{ color: primary ? "rgba(255,255,255,0.85)" : C.muted }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: primary ? "rgba(255,255,255,0.7)" : C.muted }}>{sublabel}</div>
      </div>
    </div>
  );
}

// The one tile that answers "does this system need action" on its own,
// without reading the table below it. Same size as its neighbors so it
// doesn't just look like the loudest thing on the page — the color does
// that work. Clicking it (or clicking it again) toggles the same
// attention-group selection the table already defaults to.
function AttentionTile({ count, statusCounts, selection, onToggle }) {
  const active = selection?.kind === "attention-group";
  const breakdown = OUTSTANDING_STATUSES
    .map((s) => `${statusCounts[s] ?? 0} ${STATUS_META[s].label.toLowerCase()}`)
    .join(" · ");
  return (
    <button
      onClick={() => onToggle(DEFAULT_SELECTION)}
      className="rounded-xl p-5 flex items-center gap-4 text-left transition-colors"
      style={{ background: C.amberBg, border: `1px solid ${active ? C.amber : C.border}` }}
    >
      <AlertTriangle size={28} color={C.amber} style={{ flexShrink: 0 }} />
      <div className="min-w-0">
        <div className="text-3xl font-semibold" style={{ color: C.amber, fontFamily: "'Source Serif 4', serif" }}>{count}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide mt-1" style={{ color: C.amber }}>Attention Required</div>
        <div className="text-xs mt-0.5 truncate" style={{ color: C.amber, opacity: 0.8 }}>{breakdown}</div>
      </div>
    </button>
  );
}

// One card replacing the four stacked tally rows + equation bar: a single
// segmented bar (Satisfied / Attention / Pending / Not Applicable, the same
// four buckets that always summed to the full catalog), a legend of every
// individual status as a drill-down chip, and Responsibility demoted to a
// quieter footer line — still clickable, just not a peer of implementation
// status.
function StatusStrip({ statusCounts, applicabilitySummary, pendingCount, resp, selection, onToggle }) {
  const total = applicabilitySummary.total;
  const controlStatusCount = RESOLVED_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const outstandingCount = OUTSTANDING_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const segments = [
    { count: controlStatusCount, color: C.green, label: "Controls Satisfied" },
    { count: outstandingCount, color: C.amber, label: "Attention Required" },
    { count: pendingCount, color: C.ink, label: "Applicability Review" },
    { count: applicabilitySummary.notApplicable, color: C.muted, label: "Not Applicable" },
  ];
  const responsibilityItems = [
    { respKey: "internal", count: resp?.owned },
    { respKey: "shared", count: resp?.shared },
    { respKey: "enterprise", count: resp?.enterprise },
    { respKey: "vendor", count: resp?.vendor },
  ];

  return (
    <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.muted }}>Control Status</span>
        <span className="text-[11px]" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{total} applicable controls</span>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
        {segments.map((s) => (
          <div key={s.label} title={`${s.label}: ${s.count}`} style={{ width: `${total ? (s.count / total) * 100 : 0}%`, background: s.color }} />
        ))}
      </div>

      {/* Chips grouped and ordered to match the bar's four segments left to
          right — green (resolved) group, then amber (attention) group, then
          the two standalone ink/muted chips — so color, not an icon, is what
          ties a chip back to its slice of the bar. */}
      <div className="flex items-center flex-wrap gap-x-5 gap-y-2 mt-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {RESOLVED_STATUSES.map((status) => {
            const meta = STATUS_META[status];
            return (
              <Chip
                key={status}
                label={meta.label}
                count={statusCounts[status]}
                color={C.green}
                bg={C.greenBg}
                active={selection?.kind === "status" && selection.key === status}
                onClick={() => onToggle({ kind: "status", key: status, label: `${meta.label} controls` })}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {OUTSTANDING_STATUSES.map((status) => {
            const meta = STATUS_META[status];
            return (
              <Chip
                key={status}
                label={meta.label}
                count={statusCounts[status]}
                color={C.amber}
                bg={C.amberBg}
                active={selection?.kind === "status" && selection.key === status}
                onClick={() => onToggle({ kind: "status", key: status, label: `${meta.label} controls` })}
              />
            );
          })}
        </div>
        <Chip
          label={APPLICABILITY_META.pending.label}
          count={pendingCount}
          color={C.ink}
          bg={C.panel2}
          active={selection?.kind === "pending"}
          onClick={() => onToggle({ kind: "pending", key: "pending", label: "Pending applicability" })}
        />
        <Chip
          label={NOT_APPLICABLE_META.label}
          count={applicabilitySummary.notApplicable}
          color={C.muted}
          bg={C.panel2}
          active={selection?.kind === "not-applicable"}
          onClick={() => onToggle({ kind: "not-applicable", key: "not-applicable", label: "Not Applicable controls" })}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
        <span className="text-[10px] uppercase tracking-wide font-semibold shrink-0" style={{ color: C.muted }}>Responsibility</span>
        {responsibilityItems.map(({ respKey, count }) => (
          <Chip
            key={respKey}
            label={RESPONSIBILITY_META[respKey].label}
            count={count}
            color={RESPONSIBILITY_META[respKey].color}
            bg={RESPONSIBILITY_META[respKey].bg}
            active={selection?.kind === "responsibility" && selection.key === respKey}
            onClick={() => onToggle({ kind: "responsibility", key: respKey, label: `${RESPONSIBILITY_META[respKey].label} controls` })}
          />
        ))}
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
// the drill-down, and ControlEvaluationPanel (opened from a table row) is the
// full per-control detail.
export function SystemControls({ matrix, statusCounts, applicabilitySummary, posture, findingsByControl = {}, onSelectRow }) {
  const resp = applicabilitySummary?.byResponsibility;
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

      {applicabilitySummary && posture && (
        <div className="grid grid-cols-4 gap-4">
          <PostureTile value={posture.assurance} label="Assurance" sublabel="Confidence controls operate effectively" primary />
          <AttentionTile count={outstandingCount} statusCounts={statusCounts} selection={selection} onToggle={toggleSelection} />
          <PostureTile value={posture.compliance} label="Compliance" sublabel="Applicable controls implemented" />
          <PostureTile value={posture.coverage} label="Assessment Coverage" sublabel="Applicable controls assessed" />
        </div>
      )}

      {applicabilitySummary && (
        <StatusStrip
          statusCounts={statusCounts}
          applicabilitySummary={applicabilitySummary}
          pendingCount={pendingCount}
          resp={resp}
          selection={selection}
          onToggle={toggleSelection}
        />
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
