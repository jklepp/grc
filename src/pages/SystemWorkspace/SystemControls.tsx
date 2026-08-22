import React, { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { RadioTower, Layers, ChevronUp, ChevronDown, ChevronsUpDown, ClipboardCheck } from "lucide-react";
import { C } from "../../theme";
import { SectionHeader } from "./shared/SectionHeader";
import { FilterSelect } from "./shared/FilterSelect";
import { GAP_CONTROL_STATUSES } from "../../engine/review";
import {
  STATUS_META, STATUS_ORDER, STATUS_RANK, RESPONSIBILITY_META, APPLICABILITY_META,
  EVIDENCE_HEALTH_META, EVIDENCE_HEALTH_ORDER, evidenceHealthForRow,
} from "./controlMeta";
import { StatRing } from "./shared/StatRing";
import type { ControlMatrixRow, ApplicabilitySummary } from "./types";
import type { ControlId } from "../../graph/ids";
import type { Responsibility } from "../../graph/edges/controlImplementations";
import type { EvidenceHealthLevel } from "./controlMeta";
import type { Control } from "../../graph/nodes/controls";
import type { ReviewWave } from "../../engine/review";

type ControlStatus = ControlMatrixRow["status"];
type SelectionKind = "status" | "responsibility" | "remediation-group" | "assessment-group" | "all";

export interface ControlSelection {
  kind: SelectionKind;
  key?: string;
  label: string;
}

interface ControlFilters {
  domain: string | null;
  framework: string | null;
  status: ControlStatus | null;
  responsibility: Responsibility | null;
  evidenceHealth: EvidenceHealthLevel | null;
}

type SortKey = "assurance" | "status" | "responsibility" | "evidence" | "findings";
interface SortState { key: SortKey; dir: "asc" | "desc" }
type FindingsByControl = Partial<Record<ControlId, number>>;

// Control | Status | Assurance | Responsibility | Evidence | Findings — the
// operational read: what's weak, why, who owns it, what proves it, is there
// an open finding. SCF #, governing policy and framework clause mappings are
// still real data, just lower priority than these six answers, so they moved
// into ControlEvaluationPanel instead of occupying columns here.
const CONTROL_GRID = "2fr 130px 90px 160px 130px 80px";

function SortIcon({ dir }: { dir: SortState["dir"] | null }) {
  if (!dir) return <ChevronsUpDown size={11} style={{ opacity: 0.5 }} />;
  return dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

interface HeaderCellProps {
  label: ReactNode;
  sortKey?: SortKey;
  sort?: SortState | null;
  onSort?: (key: SortKey) => void;
  first?: boolean;
}

function HeaderCell({ label, sortKey, sort, onSort, first = false }: HeaderCellProps) {
  const style: CSSProperties = { borderLeft: first ? "none" : `1px solid ${C.border}`, paddingLeft: first ? 0 : 12, color: C.muted };
  if (sortKey == null) {
    return <div style={style}>{label}</div>;
  }
  const active = sort?.key === sortKey;
  return (
    <button
      onClick={() => onSort?.(sortKey)}
      className="flex items-center gap-1 text-left"
      style={{ ...style, color: active ? C.ink : C.muted }}
    >
      {label} <SortIcon dir={active ? sort.dir : null} />
    </button>
  );
}

function ControlRow({ row, onSelect, findingsCount }: { row: ControlMatrixRow; onSelect: (row: ControlMatrixRow) => void; findingsCount?: number }) {
  const meta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const evidence = evidenceHealthForRow(row);
  const count = findingsCount ?? 0;
  return (
    <button
      onClick={() => onSelect(row)}
      className="w-full grid px-4 text-left wz-hover transition-colors"
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
const RESOLVED_STATUSES = ["inherited", "satisfied"] as const satisfies readonly ControlStatus[];
const NOT_APPLICABLE_META = APPLICABILITY_META["not-applicable"];

// The punch list a system owner actually needs to work: applicable controls
// not yet at a resolved good state (Inherited/Satisfied). Pending applicability
// calls are a separate concern — see APPLICABILITY REVIEW below — because
// "nobody decided if this applies" is not the same claim as "this failed."
// The gap statuses come from the engine now (GAP_CONTROL_STATUSES). They used
// to be declared here as REMEDIATION_STATUSES — the same name graph/nodes/
// findings.ts uses for the CAP lifecycle, which is how a page could end up
// comparing control statuses against CAP statuses and silently matching none.
const REMEDIATION_STATUS_SET: ReadonlySet<ControlStatus> = new Set(GAP_CONTROL_STATUSES);

// The default table view and its escape hatch. Landing on "everything that's
// wrong" beats landing on an empty table or a 162-row unfiltered dump.
export const DEFAULT_SELECTION: ControlSelection = { kind: "remediation-group", label: "Remediation Required" };
export const ASSESSMENT_SELECTION: ControlSelection = { kind: "assessment-group", label: "Assessment Required" };
const ALL_SELECTION: ControlSelection = { kind: "all", label: "All Applicable Controls" };

// Every chip on the summary card is a drill-down trigger. `selection` is
// { kind: "status" | "responsibility" | "remediation-group" |
// "assessment-group" | "all", key, label } or null; clicking the active chip
// again falls back to the default view rather than clearing to empty — this
// table is never supposed to show nothing. Applicability (Not Applicable /
// Applicability Review) isn't part of this local selection at all — those
// chips navigate straight into the Scope Review screen instead, since that's
// the only place a pending or excluded call can actually be resolved.
// No icon: this chip is always read alongside its own colored group (the
// Control Status legend groups chips by the same color as their bar
// segment), so the color already carries the meaning an icon would repeat.
interface ChipProps {
  label: ReactNode;
  count: number;
  color: string;
  bg: string;
  active: boolean;
  onClick: () => void;
  flat?: boolean;
}

function Chip({ label, count, color, bg, active, onClick, flat = false }: ChipProps) {
  // The neutral (panel2-backed) variants — Not Assessed, System Owned — sit
  // too close in value to the card behind them to read as a pill on their
  // own; give just those a border so they don't wash out.
  const neutral = bg === C.panel2;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded shrink-0 transition-colors"
      style={{
        background: flat ? "transparent" : bg,
        color,
        border: flat || !neutral ? "1px solid transparent" : `1px solid ${C.borderStrong}`,
        boxShadow: active ? `0 0 0 1.5px ${color}` : "none",
      }}
    >
      <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: 999, background: color, display: "inline-block" }} />
      {count} {label}
    </button>
  );
}

// The assurance figure, with the caveat attached rather than implied. This
// number is weighted across the controls that were actually examined, so the
// examined count belongs next to it — see compliance.ts's note that the
// coverage figure is "the honesty check" on any posture percentage.
function PostureAnchor({ assurance, assessed, applicable, notApplicable, pending, onOpenScopeReview }: {
  assurance: number | null;
  assessed: number;
  applicable: number;
  notApplicable: number;
  pending: number;
  onOpenScopeReview?: (wave: ReviewWave) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3.5 min-w-0">
        {assurance != null && <StatRing pct={assurance} color={C.accent} trackColor={C.panel2} size={46} stroke={5} />}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] leading-none font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
              {assurance == null ? "—" : `${assurance}%`}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Assurance</span>
          </div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>
            Operating confidence, weighted across the {assessed} control{assessed === 1 ? "" : "s"} examined
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{applicable} applicable controls</div>
        <button
          onClick={() => onOpenScopeReview?.("not-applicable")}
          className="text-[11px] mt-1"
          style={{ color: C.muted }}
        >
          {notApplicable} {NOT_APPLICABLE_META.label} · {pending} in applicability review
        </button>
      </div>
    </div>
  );
}

// Bars are plotted to 86% of the track so a value label always has room to
// sit just past the tip. Every bar uses the same scale, so the proportions
// are untouched — this is a plot margin, not a distortion.
const BAR_SCALE = 0.86;

// Three fills for the three things a control can be here: holding, not
// holding, or unexamined. Statuses inside a group share a fill and are told
// apart by their row label, which is the same grouping the status chips have
// always used (every remediation status was already one amber).
//
// Worth knowing why it isn't one fill per status. The severity ramp puts
// `partial` at C.amber and `deficient` at C.red, which in this palette are
// #23558F and #2C3B85 — 7.2 ΔE apart in normal vision, against a 15 floor.
// As small chips carrying their own icon and label that passes unnoticed; as
// two adjacent 14px bars it reads as one color used twice. Severity is
// carried by the Status column in the table below, which sorts on
// STATUS_RANK and shows a per-status icon.
//
// Two further departures from STATUS_META: `satisfied` is accent purple
// there, but purple is this card's assurance and action color and a status
// bar wearing it read as progress rather than as a status. And `unassessed`
// is a hatch rather than a flat fill, because "nobody looked" is the absence
// of a finding, not a finding — a solid block half the catalogue long claims
// more than the data does.
function barFill(status: ControlStatus): string {
  if (status === "unassessed") {
    return `repeating-linear-gradient(135deg, ${C.muted} 0 4px, ${C.panel2} 4px 10px)`;
  }
  return REMEDIATION_STATUS_SET.has(status) ? C.amber : C.green;
}

// One status, one bar, all of them measured against the same applicable
// total and starting on the same baseline — so two counts are compared by
// length rather than by eyeballing segments of a stack. The count and share
// ride the bar tip instead of a far-right column, so the number never leaves
// the mark it describes.
interface BarRowProps {
  label: string;
  count: number;
  applicable: number;
  fill: string;
  active: boolean;
  onClick: () => void;
  trailing?: ReactNode;
}

function BarRow({ label, count, applicable, fill, active, onClick, trailing }: BarRowProps) {
  const share = applicable === 0 ? 0 : (count / applicable) * 100;
  const width = `${share * BAR_SCALE}%`;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="w-full grid items-center text-left rounded cursor-pointer"
      style={{ gridTemplateColumns: "140px minmax(0, 1fr)", gap: 12, height: 28, background: active ? C.panel2 : "transparent" }}
    >
      <span className="text-xs text-right truncate pr-1" style={{ color: C.ink, fontWeight: active ? 600 : 400 }}>{label}</span>
      <span className="relative block" style={{ height: 14 }}>
        <span className="absolute block" style={{ left: 0, top: 0, height: 14, width, background: fill, borderRadius: "0 4px 4px 0" }} />
        <span
          className="absolute flex items-center gap-1.5 whitespace-nowrap"
          style={{ left: `calc(${width} + 10px)`, top: "50%", transform: "translateY(-50%)" }}
        >
          <span className="text-[13px] font-semibold tabular-nums" style={{ color: C.ink }}>{count}</span>
          <span className="text-[11px] tabular-nums" style={{ color: C.muted }}>{Math.round(share)}%</span>
          {trailing}
        </span>
      </span>
    </div>
  );
}

// One card: the assurance anchor, then a bar per status ranked largest-first,
// then Responsibility as a quiet footer.
//
// This replaces a single segmented bar whose segments shared no baseline —
// only the leftmost one started at zero, so comparing the middle segments was
// guesswork. Ranked bars make the comparison a length. Ranking also puts
// whatever is largest at the top without anyone deciding it belongs there,
// which on a partly-assessed system is Not Assessed, i.e. the thing most
// worth seeing first.
//
// The two groups (examined / not examined) stay in a fixed order and the
// ranking runs inside each, rather than one global sort: a global sort would
// let the groups interleave as soon as coverage climbs past Inherited, and a
// chart whose rows reshuffle between two visits is harder to read than one
// that gives up a little ordering purity.
function StatusChart({
  statusCounts, applicabilitySummary, pendingCount, resp, selection, onToggle,
  onOpenScopeReview, posture, keyControlRemaining, keyControlTotal, onStartAssessment,
}: {
  statusCounts: Record<ControlStatus, number>;
  applicabilitySummary: ApplicabilitySummary;
  pendingCount: number;
  resp: ApplicabilitySummary["byResponsibility"];
  selection: ControlSelection;
  onToggle: (selection: ControlSelection) => void;
  onOpenScopeReview?: (wave: ReviewWave) => void;
  posture: { assurance: number | null; compliance: number; coverage: number };
  keyControlRemaining: number;
  keyControlTotal: number;
  onStartAssessment?: () => void;
}) {
  const applicable = applicabilitySummary.applicable;
  const unassessed = statusCounts.unassessed ?? 0;
  const assessed = applicable - unassessed;
  const holding = RESOLVED_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);

  // Every examined status, largest first. Zeros are pulled out below: an
  // empty track is a row of nothing, and four of them break the rhythm of
  // the bars that do carry data. They still get said, just in one line.
  const examined = [...RESOLVED_STATUSES, ...GAP_CONTROL_STATUSES]
    .map((status) => ({ status, count: statusCounts[status] ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const present = examined.filter((r) => r.count > 0);
  const zeroed = examined.filter((r) => r.count === 0);

  const responsibilityItems: Array<{ respKey: Responsibility; count: number }> = [
    { respKey: "internal", count: resp.owned },
    { respKey: "shared", count: resp.shared },
    { respKey: "enterprise", count: resp.enterprise },
    { respKey: "vendor", count: resp.vendor },
  ];

  const walkAction = onStartAssessment ? (
    <button
      onClick={(e) => { e.stopPropagation(); onStartAssessment(); }}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-md ml-1.5"
      style={{ background: C.accentBg, color: C.accent, padding: "4px 9px" }}
    >
      <ClipboardCheck size={12} /> Assess {keyControlRemaining} key control{keyControlRemaining === 1 ? "" : "s"}
    </button>
  ) : keyControlTotal > 0 ? (
    <span className="text-[11px] font-semibold ml-1.5" style={{ color: C.green }}>Key-control walk complete</span>
  ) : null;

  return (
    <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <PostureAnchor
        assurance={posture.assurance}
        assessed={assessed}
        applicable={applicable}
        notApplicable={applicabilitySummary.notApplicable}
        pending={pendingCount}
        onOpenScopeReview={onOpenScopeReview}
      />

      <div className="pt-4">
        {unassessed > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: C.ink, paddingLeft: 0, width: 140, textAlign: "right" }}>
              Not examined
            </div>
            <BarRow
              label={STATUS_META.unassessed.label}
              count={unassessed}
              applicable={applicable}
              fill={barFill("unassessed")}
              active={selection.kind === "assessment-group"}
              onClick={() => onToggle(ASSESSMENT_SELECTION)}
              trailing={walkAction}
            />
          </>
        )}

        <div className="grid items-baseline mt-4 mb-1" style={{ gridTemplateColumns: "140px minmax(0, 1fr)", gap: 12 }}>
          <span className="text-[10px] uppercase tracking-wide font-semibold text-right" style={{ color: C.ink }}>Examined</span>
          <span className="text-[11px]" style={{ color: C.muted }}>
            <span style={{ fontWeight: 600, color: C.ink }}>{assessed} of {applicable} examined ({posture.coverage}%)</span>
            {" — "}{holding} of them hold ({posture.compliance}%)
          </span>
        </div>

        {present.map(({ status, count }) => (
          <BarRow
            key={status}
            label={STATUS_META[status].label}
            count={count}
            applicable={applicable}
            fill={barFill(status)}
            active={selection?.kind === "status" && selection.key === status}
            onClick={() => onToggle({ kind: "status", key: status, label: `${STATUS_META[status].label} controls` })}
          />
        ))}

        {zeroed.length > 0 && (
          <div className="grid items-center mt-1.5" style={{ gridTemplateColumns: "140px minmax(0, 1fr)", gap: 12 }}>
            <span />
            <span className="text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
              {zeroed.map((r) => STATUS_META[r.status].label).join(", ")} — 0 {zeroed.length === 1 ? "" : "each"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
        <span className="text-[10px] uppercase tracking-wide font-semibold shrink-0" style={{ color: C.muted }}>Responsibility</span>
        {responsibilityItems.map(({ respKey, count }) => (
          <Chip
            key={respKey}
            label={RESPONSIBILITY_META[respKey].label}
            count={count}
            color={C.muted}
            bg={RESPONSIBILITY_META[respKey].bg}
            active={selection?.kind === "responsibility" && selection.key === respKey}
            onClick={() => onToggle({ kind: "responsibility", key: respKey, label: `${RESPONSIBILITY_META[respKey].label} controls` })}
            flat
          />
        ))}
      </div>
    </div>
  );
}

const RESPONSIBILITY_ORDER = ["enterprise", "vendor", "shared", "internal"] as const satisfies readonly Responsibility[];

// A single <select> filter, styled to match the rest of the card. `null`
// Filters layer on top of whichever chip is selected: pick "Shared
// Responsibility" as the base, then narrow to "Deficient" with the Status
// filter, or pick "Not Assessed" as the base and narrow to "AI Security"
// with Domain — two independent lenses instead of one exclusive chip.
function FilterBar({ filters, onChange, domainOptions, frameworkOptions, showStatusFilters }: {
  filters: ControlFilters;
  onChange: (filters: ControlFilters) => void;
  domainOptions: string[];
  frameworkOptions: string[];
  showStatusFilters: boolean;
}) {
  const active = Object.values(filters).some(Boolean);
  const toStatus = (value: string | null): ControlStatus | null => {
    if (value === "inherited" || value === "satisfied" || value === "partial" || value === "deficient" || value === "not-implemented" || value === "unassessed") return value;
    return null;
  };
  const toResponsibility = (value: string | null): Responsibility | null => {
    if (value === "internal" || value === "shared" || value === "enterprise" || value === "vendor") return value;
    return null;
  };
  const toEvidenceHealth = (value: string | null): EvidenceHealthLevel | null => {
    if (value === "missing" || value === "stale" || value === "weak" || value === "adequate" || value === "strong") return value;
    return null;
  };
  return (
    <div className="flex items-center gap-4 flex-wrap px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
      <FilterSelect label="Domain" value={filters.domain} onChange={(v) => onChange({ ...filters, domain: v })} options={domainOptions.map((d) => ({ value: d, label: d }))} />
      <FilterSelect label="Framework" value={filters.framework} onChange={(v) => onChange({ ...filters, framework: v })} options={frameworkOptions.map((f) => ({ value: f, label: f }))} />
      {showStatusFilters && (
        <>
          <FilterSelect label="Status" value={filters.status} onChange={(v) => onChange({ ...filters, status: toStatus(v) })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
          <FilterSelect label="Responsibility" value={filters.responsibility} onChange={(v) => onChange({ ...filters, responsibility: toResponsibility(v) })} options={RESPONSIBILITY_ORDER.map((r) => ({ value: r, label: RESPONSIBILITY_META[r].label }))} />
          <FilterSelect label="Evidence" value={filters.evidenceHealth} onChange={(v) => onChange({ ...filters, evidenceHealth: toEvidenceHealth(v) })} options={EVIDENCE_HEALTH_ORDER.map((e) => ({ value: e, label: EVIDENCE_HEALTH_META[e].label }))} />
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

const EVIDENCE_RANK: Record<EvidenceHealthLevel, number> = {
  missing: 0, stale: 1, weak: 2, adequate: 3, strong: 4,
};

function applySharedFilters<T extends { control: Control }>(rows: T[], filters: ControlFilters): T[] {
  return rows.filter((r) => {
    const control = r.control;
    if (filters.domain && control.domain !== filters.domain) return false;
    if (filters.framework && !control.frameworks.some((f) => f.standard === filters.framework)) return false;
    return true;
  });
}

function applyControlFilters(rows: ControlMatrixRow[], filters: ControlFilters): ControlMatrixRow[] {
  return applySharedFilters(rows, filters).filter((row) => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.responsibility && row.responsibility !== filters.responsibility) return false;
    if (filters.evidenceHealth && evidenceHealthForRow(row).level !== filters.evidenceHealth) return false;
    return true;
  });
}

function sortRows(rows: ControlMatrixRow[], sort: SortState | null, findingsByControl: FindingsByControl): ControlMatrixRow[] {
  if (!sort) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  const valueOf = (row: ControlMatrixRow): number | string => {
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
// the controls above the header row. Applicability (Not Applicable /
// Applicability Review) is deliberately not a selection this table can show —
// those are one-control-plus-a-reason, not a status to work through here, and
// the only place to act on them is Scope Review.
interface SelectedControlsTableProps {
  selection: ControlSelection;
  matrix: ControlMatrixRow[];
  findingsByControl: FindingsByControl;
  onSelectRow: (row: ControlMatrixRow) => void;
  onSwitchToAll: () => void;
  filters: ControlFilters;
  onFilterChange: (filters: ControlFilters) => void;
  domainOptions: string[];
  frameworkOptions: string[];
  sort: SortState | null;
  onSort: (key: SortKey) => void;
}

function SelectedControlsTable({
  selection, matrix, findingsByControl, onSelectRow, onSwitchToAll,
  filters, onFilterChange, domainOptions, frameworkOptions, sort, onSort,
}: SelectedControlsTableProps) {

  const baseRows: ControlMatrixRow[] = selection.kind === "status" ? matrix.filter((r) => r.status === selection.key)
    : selection.kind === "responsibility" ? matrix.filter((r) => r.responsibility === selection.key)
    : selection.kind === "remediation-group" ? matrix.filter((r) => REMEDIATION_STATUS_SET.has(r.status))
    : selection.kind === "assessment-group" ? matrix.filter((r) => r.status === "unassessed")
    : selection.kind === "all" ? matrix
    : [];

  const filtered = applyControlFilters(baseRows, filters);
  // Attention Required's whole point is not burying real deficiencies under
  // a pile of Not Assessed rows — default to worst-first unless the user
  // picked a column to sort by instead.
  const defaultSorted = selection.kind === "remediation-group" && !sort
    ? [...filtered].sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))
    : filtered;
  const rows = sortRows(defaultSorted, sort, findingsByControl);
  const rowCount = rows.length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{selection.label}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{rowCount} control{rowCount !== 1 ? "s" : ""}</div>
        </div>
        {selection.kind !== "all" && (
          <button onClick={onSwitchToAll} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.panel2, color: C.muted }}>
            View all applicable controls
          </button>
        )}
      </div>
      <FilterBar filters={filters} onChange={onFilterChange} domainOptions={domainOptions} frameworkOptions={frameworkOptions} showStatusFilters />
      <div className="grid text-[10px] font-semibold uppercase tracking-wide px-4 py-2.5" style={{ gridTemplateColumns: CONTROL_GRID, background: C.panel2, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
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
    </div>
  );
}

// What controls should exist, are they implemented, and can we prove them?
// Requirement → Control → Implementation → Evidence chain: the summary card's
// chips are the requirement/applicability read, the table at the bottom
// (opened by clicking a chip, and open by default on Remediation Required) is
// the drill-down, and ControlEvaluationPanel (opened from a table row) is the
// full per-control detail.
interface SystemControlsProps {
  matrix: ControlMatrixRow[];
  statusCounts: Record<ControlStatus, number>;
  applicabilitySummary: ApplicabilitySummary;
  posture: { assurance: number | null; compliance: number; coverage: number };
  findingsByControl?: FindingsByControl;
  onSelectRow: (row: ControlMatrixRow) => void;
  keyControlRemaining?: number;
  onStartAssessment?: () => void;
  walkActive?: boolean;
  onOpenScopeReview?: (wave: ReviewWave) => void;
  initialSelection?: ControlSelection;
}

export function SystemControls({
  matrix, statusCounts, applicabilitySummary, posture, findingsByControl = {}, onSelectRow,
  keyControlRemaining = 0, onStartAssessment, walkActive = false, onOpenScopeReview, initialSelection,
}: SystemControlsProps) {
  const resp = applicabilitySummary?.byResponsibility;
  const pendingCount = applicabilitySummary?.pending ?? 0;
  const [selection, setSelection] = useState<ControlSelection>(initialSelection ?? DEFAULT_SELECTION);
  const [filters, setFilters] = useState<ControlFilters>({ domain: null, framework: null, status: null, responsibility: null, evidenceHealth: null });
  const [sort, setSort] = useState<SortState | null>(null);

  const domainOptions = useMemo(() => [...new Set(matrix.map((r) => r.control.domain))].sort(), [matrix]);
  const frameworkOptions = useMemo(() => [...new Set(matrix.flatMap((r) => r.control.frameworks.map((f) => f.standard)))].sort(), [matrix]);
  const keyControlTotal = useMemo(() => matrix.filter((row) => row.keyControl).length, [matrix]);

  useEffect(() => {
    if (walkActive) setSelection(ASSESSMENT_SELECTION);
  }, [walkActive]);

  function toggleSelection(next: ControlSelection) {
    setSelection((prev) => {
      const isActive = prev && prev.kind === next.kind && prev.key === next.key;
      if (!isActive) return next;
      return next.kind === "remediation-group" ? ALL_SELECTION : DEFAULT_SELECTION;
    });
    setSort(null);
  }

  function onSort(key: SortKey) {
    setSort((prev) => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  }

  return (
    <div className="px-8 pb-10 space-y-6">
      {/* No action in the header: the walk button lives on the Not Assessed
          row, next to the count it acts on. Two buttons to one destination is
          the duplication this card was rebuilt to drop. */}
      <SectionHeader
        icon={Layers}
        title="Control Posture"
        description="What holds, what is still unexamined, and the work between the two."
      />

      {applicabilitySummary && posture && (
        <StatusChart
          statusCounts={statusCounts}
          applicabilitySummary={applicabilitySummary}
          pendingCount={pendingCount}
          resp={resp}
          selection={selection}
          onToggle={toggleSelection}
          onOpenScopeReview={onOpenScopeReview}
          posture={posture}
          keyControlRemaining={keyControlRemaining}
          keyControlTotal={keyControlTotal}
          onStartAssessment={onStartAssessment}
        />
      )}

      <SelectedControlsTable
        selection={selection}
        matrix={matrix}
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
