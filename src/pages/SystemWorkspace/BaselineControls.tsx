import React, { useMemo, useState } from "react";
import { X, History, ClipboardCheck, Layers, AlertTriangle } from "lucide-react";
import { C } from "../../theme";
import { Button } from "../../components/wizard/WizardUI";
import { ControlRecordForm, frequencyLabel, type ControlRecordValues } from "../../components/ControlRecordForm";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { useSignedInUser } from "../../auth/useUser";
import { allows, canEditControlRecord } from "../../auth/gates";
import { saveSystemControlRecord } from "../../engine/runtimeMutations";
import { complianceBand } from "../../engine";
import {
  CONTROL_RECORD_STATUSES, CONTROL_RECORD_STATUS_META, IMPLEMENTATION_TYPE_LABELS, systemRecordKey, versionAsOf, versionsOf,
  type ControlRecordStatus, type SystemControlRecord,
} from "../../graph/nodes/controlRecords";
import { AUDITOR_RESULT_META } from "../../graph/nodes/engagements";
import type { ControlCoverage } from "../../engine/compliance";
import type { SystemId } from "../../graph/ids";
import type { WorkspaceSystem } from "./types";
import { FilterSelect } from "./shared/FilterSelect";
import { TableHeaderCell } from "./shared/TableHeaderCell";
import { Badge, CardAction, CELL, FilterBand, SearchFilter, TableCard, cellDivider } from "./shared/ControlTable";
import { STATUS_META, STATUS_RANK, sourceMeta } from "./controlMeta";
import { FRAMEWORKS } from "../../graph/nodes/controls";
import { Callout } from "../../components/wizard/WizardUI";
import { Panel } from "./shared/Panel";
import { SectionHeader } from "./shared/SectionHeader";
import { StatRing } from "./shared/StatRing";
import { BarRow, Chip } from "./SystemControls";
import { commit, domainOptions, nowIso, today, Pill, RecordStatusPill, SOURCE_LABELS, colorFor } from "../Audits/shared";

// The Controls tab for a system without HITRUST in scope: its system of record.
//
// One grid of every applicable control, with where each answer comes from.
// The rows the system writes itself (system-specific controls and its part of
// hybrid ones) are edited in place; every save is a new version, so the
// "As of" date can show the records exactly as they stood on any earlier day.
// Common, enterprise and provider rows are read-only here — they are written
// centrally or relied on through someone else's report.

type SortKey = "status" | "type" | "owner" | "reviewed";

// What the card's bars and chips select. Clicking the active one again falls
// back to the default rather than to nothing, as on the HITRUST tab.
type Selection =
  | { kind: "needs-work" }
  | { kind: "all" }
  | { kind: "status"; key: string }
  | { kind: "owed" }
  | { kind: "type"; key: string };

interface Row {
  coverage: ControlCoverage;
  controlId: string;
  editable: boolean;
  source: string;
  record: SystemControlRecord | null;
  missing: string[];
  status: string;
}

// A function-backed chip for "evidence or frequency owed", read at render time like every theme colour.
const OWED_META = { label: "Owed", Icon: AlertTriangle, get color() { return C.amber; }, get bg() { return C.amberBg; } };


export function BaselineControls({ system, onOpenScopeReview }: { system: WorkspaceSystem; onOpenScopeReview?: () => void }) {
  const engine = useLiveEngine();
  const user = useSignedInUser();
  const canEdit = allows(canEditControlRecord(user, system));
  const [selection, setSelection] = useState<Selection>({ kind: "needs-work" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [framework, setFramework] = useState("all");
  const [domain, setDomain] = useState("all");
  const [asOf, setAsOf] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const systemId = system.id as SystemId;
  const graph = engine.graph;
  const matrix = useMemo(() => engine.compliance.systemControlMatrix(systemId), [engine, systemId]);

  const rows: Row[] = useMemo(() => matrix.map((c) => {
    const b = c.baseline;
    const source = b?.source ?? "none";
    const editable = source === "system" || source === "hybrid" || source === "none";
    const key = `${systemId}::${c.controlId}`;
    // "As of" swaps in the version that was current then. Only this system's
    // own records are versioned per system; inherited rows show as they are.
    const record = asOf && editable ? versionAsOf(graph.systemControlRecordVersions, systemRecordKey, key, `${asOf}T23:59:59Z`) : b?.record ?? null;
    const status = asOf && editable
      ? (record ? (record.status === "implemented" ? "satisfied" : record.status) : "unassessed")
      : c.status;
    return { coverage: c, controlId: c.controlId, editable, source, record, missing: asOf ? [] : b?.missing ?? [], status };
  }), [matrix, asOf, graph, systemId]);

  const isGap = (r: Row) => r.status === "partial" || r.status === "not-implemented" || r.status === "deficient" || r.missing.length > 0;
  const typeOf = (r: Row) => (r.source === "none" ? "system" : r.source);
  const selected = (r: Row) => {
    switch (selection.kind) {
      case "needs-work": return isGap(r) || (r.editable && r.status === "unassessed");
      case "status": return (selection.key === "not-implemented" ? ["not-implemented", "deficient"].includes(r.status) : r.status === selection.key);
      case "owed": return r.missing.length > 0;
      case "type": return typeOf(r) === selection.key;
      default: return true;
    }
  };
  const same = (a: Selection, b: Selection) => JSON.stringify(a) === JSON.stringify(b);
  const toggle = (next: Selection) => setSelection((cur) => (same(cur, next) ? (next.kind === "needs-work" ? { kind: "all" } : { kind: "needs-work" }) : next));
  const selectionLabel = selection.kind === "needs-work" ? "Needs work — gaps and controls to record"
    : selection.kind === "all" ? "All applicable controls"
    : selection.kind === "owed" ? "Evidence or frequency owed"
    : selection.kind === "type" ? `${SOURCE_LABELS[selection.key] ?? selection.key} controls`
    : `${STATUS_META[selection.key as keyof typeof STATUS_META]?.label ?? selection.key} controls`;
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) =>
    selected(r)
    && (framework === "all" || r.coverage.baseline?.frameworks.includes(framework))
    && (domain === "all" || r.coverage.control.domain === domain)
    && (!q || r.controlId.toLowerCase().includes(q) || r.coverage.control.name.toLowerCase().includes(q))
  );
  const active = rows.find((r) => r.controlId === activeId) ?? null;
  const openAudits = engine.engagements.openForSystem(systemId);
  const org = (id?: string | null) => (id ? graph.orgById[id]?.name ?? id : "—");

  function saveVersion(controlId: string, v: Pick<SystemControlRecord, "statement" | "status" | "ownerId" | "frequency" | "evidence" | "reviewedAt">): string[] {
    const errs = commit((rt) => saveSystemControlRecord(rt, {
      systemId, controlId: controlId as SystemControlRecord["controlId"],
      statement: v.statement, status: v.status, ownerId: v.ownerId,
      ...(v.frequency ? { frequency: v.frequency } : {}),
      ...(v.evidence?.length ? { evidence: v.evidence } : {}),
      reviewedAt: v.reviewedAt, recordedAt: nowIso(), recordedBy: user.id,
    }));
    setProblems(errs);
    return errs;
  }

  function quickStatus(r: Row, status: ControlRecordStatus) {
    if (!r.record) { setActiveId(r.controlId); return; }
    saveVersion(r.controlId, { ...r.record, status, reviewedAt: today() });
  }

  const frameworks = system.standards.filter((s) => (FRAMEWORKS as readonly string[]).includes(s));
  const domains = domainOptions(matrix.map((r) => r.control));
  const filtersActive = Boolean(q || framework !== "all" || domain !== "all");

  // Sorting, with the HITRUST table's affordance (TableHeaderCell). Default:
  // worst first while working the "Needs work" list, catalog order otherwise.
  const valueOf = (r: Row, key: SortKey): number | string => {
    switch (key) {
      case "status": return STATUS_RANK[r.status] ?? 99;
      case "type": return sourceMeta(r.source).label;
      case "owner": return org(r.editable ? r.record?.ownerId : r.coverage.baseline?.common?.ownerId);
      case "reviewed": return (r.editable ? r.record?.reviewedAt : r.coverage.baseline?.common?.reviewedAt) ?? "";
    }
  };
  const sorted = sort
    ? [...shown].sort((a, b) => { const va = valueOf(a, sort.key), vb = valueOf(b, sort.key); return (va < vb ? -1 : va > vb ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); })
    : selection.kind === "needs-work" ? [...shown].sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99)) : shown;
  const onSort = (key: SortKey) => setSort((prev) => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  return (
    <div className="px-4 lg:px-8 pb-10 space-y-8">
      <PostureCard
        system={system}
        rows={rows}
        selection={selection}
        onToggle={toggle}
        openAudits={openAudits.map((e) => e.name)}
        onOpenScopeReview={onOpenScopeReview}
        asOf={asOf}
      />

      {asOf && (
        <Callout tone="info" title={`As of ${asOf}`}>
          This system's own records as they stood at the end of that day. Read-only; inherited rows show their current source.
        </Callout>
      )}
      {problems.length > 0 && <Callout tone="danger" title="Not saved">{problems.slice(0, 3).map((p) => <div key={p}>{p}</div>)}</Callout>}

      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: active ? "minmax(0,1fr) 460px" : "minmax(0,1fr)" }}>
        <TableCard
          title={selectionLabel}
          count={sorted.length}
          action={selection.kind !== "all" ? <CardAction onClick={() => setSelection({ kind: "all" })}>View all applicable controls</CardAction> : undefined}
          band={(
            <FilterBand
              onClear={filtersActive ? () => { setQuery(""); setFramework("all"); setDomain("all"); } : null}
              trailing={(
                <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                  <History size={11} /> As of
                  <input type="date" value={asOf} max={today()} onChange={(e) => setAsOf(e.target.value)} className="text-[11px] font-medium rounded px-1.5 py-0.5" style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }} />
                  {asOf && <button type="button" onClick={() => setAsOf("")} className="font-medium" style={{ color: C.accent }}>Today</button>}
                </label>
              )}
            >
              <SearchFilter value={query} onChange={setQuery} />
              <FilterSelect label="Domain" value={domain === "all" ? null : domain} onChange={(v) => setDomain(v ?? "all")} options={domains.map((d) => ({ value: d.name, label: `${d.prefixes} · ${d.name}` }))} />
              <FilterSelect label="Framework" value={framework === "all" ? null : framework} onChange={(v) => setFramework(v ?? "all")} options={frameworks.map((f) => ({ value: f, label: f }))} />
            </FilterBand>
          )}
        >
          <table className="w-full text-left text-xs" style={{ minWidth: 1080, borderCollapse: "separate", borderSpacing: 0 }}>
            <thead className="text-[10px] font-semibold uppercase tracking-wide" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <TableHeaderCell label="CONTROL ID" first />
                <TableHeaderCell label="DOMAIN" width={150} />
                <TableHeaderCell label="CONTROL" />
                <TableHeaderCell label="TYPE" sortKey="type" sort={sort} onSort={onSort} width={160} />
                <TableHeaderCell label="STATUS" sortKey="status" sort={sort} onSort={onSort} width={150} />
                <TableHeaderCell label="OWNER" sortKey="owner" sort={sort} onSort={onSort} width={130} />
                <TableHeaderCell label="FREQUENCY" width={100} />
                <TableHeaderCell label="EVIDENCE" align="right" width={80} />
                <TableHeaderCell label="REVIEWED" sortKey="reviewed" sort={sort} onSort={onSort} width={104} last />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const statement = r.editable ? r.record?.statement ?? "" : r.coverage.explanation;
                const statusMeta = STATUS_META[r.status as keyof typeof STATUS_META] ?? STATUS_META.unassessed;
                const quickEdit = r.editable && canEdit && !asOf && r.record;
                const isActive = r.controlId === activeId;
                return (
                  <tr key={r.controlId} onClick={() => setActiveId(isActive ? null : r.controlId)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setActiveId(isActive ? null : r.controlId); }}
                    className="wz-hover transition-colors" style={{ cursor: "pointer", background: isActive ? C.accentBg : undefined }}>
                    <td className={`${CELL} pl-4 pr-3 whitespace-nowrap text-[13px]`} style={{ ...cellDivider(), color: C.ink }}>{r.controlId}</td>
                    <td className={`${CELL} px-3 text-[13px]`} style={{ ...cellDivider(), color: C.ink }}>{r.coverage.control.domain}</td>
                    <td className={`${CELL} px-3 min-w-0 text-[13px] leading-snug`} style={{ ...cellDivider(), color: C.ink }}>
                      {r.coverage.control.name}
                      <div className="text-[11px] mt-0.5 truncate max-w-[360px]" style={{ color: C.muted }} title={statement}>{statement || "Not recorded yet"}</div>
                      {r.missing.length > 0 && <div className="mt-1 flex gap-1">{r.missing.map((m) => <Badge key={m} meta={OWED_META} title={`${m} owed`} />)}</div>}
                    </td>
                    <td className={`${CELL} px-3`} style={cellDivider()}><Badge meta={sourceMeta(r.source)} /></td>
                    <td className={`${CELL} px-3`} style={cellDivider()} onClick={(e) => { if (quickEdit) e.stopPropagation(); }}>
                      {quickEdit ? (
                        <select
                          value={r.record!.status}
                          onChange={(e) => quickStatus(r, e.target.value as ControlRecordStatus)}
                          aria-label={`Status of ${r.controlId}`}
                          className="text-[11px] font-semibold rounded px-1.5 py-0.5"
                          style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${C.border}` }}
                        >
                          {CONTROL_RECORD_STATUSES.map((st) => <option key={st} value={st}>{CONTROL_RECORD_STATUS_META[st].label}</option>)}
                        </select>
                      ) : <Badge meta={statusMeta} />}
                    </td>
                    <td className={`${CELL} px-3 text-[13px]`} style={{ ...cellDivider(), color: C.ink }}>{r.editable ? org(r.record?.ownerId) : org(r.coverage.baseline?.common?.ownerId)}</td>
                    <td className={`${CELL} px-3 text-[13px]`} style={{ ...cellDivider(), color: C.ink }}>{r.editable ? frequencyLabel(r.record?.frequency) : "—"}</td>
                    <td className={`${CELL} px-3 text-right tabular-nums text-[13px] font-semibold`} style={{ ...cellDivider(), color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{r.editable ? (r.record?.evidence?.length ?? 0) : "—"}</td>
                    <td className={`${CELL} pl-3 pr-4 whitespace-nowrap text-[13px]`} style={{ ...cellDivider(), color: C.muted }}>{(r.editable ? r.record?.reviewedAt : r.coverage.baseline?.common?.reviewedAt) ?? "—"}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && <tr><td colSpan={9} className="p-6 text-xs text-center" style={{ color: C.muted }}>No controls match this filter.</td></tr>}
            </tbody>
          </table>
        </TableCard>

        {active && (
          <RecordPanel key={`${active.controlId}-${asOf}`} row={active} system={system} canEdit={canEdit && !asOf} onSave={saveVersion} onClose={() => setActiveId(null)} />
        )}
      </div>
    </div>
  );
}

// The same card the HITRUST Controls tab leads with — an anchor figure, one
// bar per status on a shared baseline, and a quiet footer of chips — so the two
// kinds of system navigate alike. Every bar and chip is a filter on the table.
const TYPE_ORDER = ["system", "hybrid", "common", "enterprise-attestation", "provider"];

function PostureCard({ system, rows, selection, onToggle, openAudits, onOpenScopeReview, asOf }: {
  system: WorkspaceSystem;
  rows: Row[];
  selection: Selection;
  onToggle: (s: Selection) => void;
  openAudits: string[];
  onOpenScopeReview?: () => void;
  asOf: string;
}) {
  const engine = useLiveEngine();
  const applicability = engine.compliance.controlApplicabilitySummary(system.id as SystemId);
  const applicable = rows.length;
  const count = (...statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;
  const unrecorded = count("unassessed");
  const assessed = applicable - unrecorded;
  const met = count("satisfied", "inherited");
  const score = asOf ? (assessed ? Math.round((met / assessed) * 100) : null) : system.complianceScore;
  const band = complianceBand(score);
  const owed = rows.filter((r) => r.missing.length > 0).length;

  const examined = [
    { key: "satisfied", label: STATUS_META.satisfied.label, n: count("satisfied"), fill: C.green },
    { key: "inherited", label: STATUS_META.inherited.label, n: count("inherited"), fill: C.green },
    { key: "partial", label: STATUS_META.partial.label, n: count("partial"), fill: C.amber },
    { key: "not-implemented", label: STATUS_META["not-implemented"].label, n: count("not-implemented", "deficient"), fill: C.amber },
  ].sort((a, b) => b.n - a.n);
  const present = examined.filter((x) => x.n > 0);
  const zeroed = examined.filter((x) => x.n === 0);
  const isActive = (s: Selection) => JSON.stringify(s) === JSON.stringify(selection);
  const hatch = `repeating-linear-gradient(135deg, ${C.muted} 0 4px, ${C.panel2} 4px 10px)`;
  const types = TYPE_ORDER.map((t) => ({ t, n: rows.filter((r) => (r.source === "none" ? "system" : r.source) === t).length })).filter((x) => x.n > 0);

  return (
    <Panel>
      <SectionHeader
        icon={Layers}
        title="Control Posture"
        description={asOf ? `This system's own records as they stood at the end of ${asOf}.` : "What is met, what is still unrecorded, and the work between the two."}
      />
      <div className="flex items-center justify-between gap-6 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3.5 min-w-0">
          {score != null && <StatRing pct={score} color={colorFor(band.color).color} trackColor={C.panel2} size={46} stroke={5} />}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] leading-none font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{score == null ? "—" : `${score}%`}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Compliance</span>
              <span className="text-xs" style={{ color: colorFor(band.color).color }}>{band.label}</span>
            </div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              Met across the {assessed} control{assessed === 1 ? "" : "s"} assessed. Partial earns nothing; unrecorded controls are left out.
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{applicable} applicable controls</div>
          <button type="button" onClick={onOpenScopeReview} disabled={!onOpenScopeReview} className="text-[11px] mt-1" style={{ color: C.muted }}>
            {applicability.notApplicable} not applicable · {applicability.pending} in applicability review
          </button>
        </div>
      </div>

      <div className="pt-4">
        {unrecorded > 0 && (
          <BarRow label={STATUS_META.unassessed.label} count={unrecorded} applicable={applicable} fill={hatch}
            active={isActive({ kind: "status", key: "unassessed" })} onClick={() => onToggle({ kind: "status", key: "unassessed" })} />
        )}
        <div style={{ marginTop: unrecorded > 0 ? 14 : 0 }}>
          {present.map((x) => (
            <BarRow key={x.key} label={x.label} count={x.n} applicable={applicable} fill={x.fill}
              active={isActive({ kind: "status", key: x.key })} onClick={() => onToggle({ kind: "status", key: x.key })} />
          ))}
        </div>
        {zeroed.length > 0 && (
          <div className="grid items-center mt-1.5 gap-3 grid-cols-[92px_minmax(0,1fr)] lg:grid-cols-[140px_minmax(0,1fr)]">
            <span />
            <span className="text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
              {zeroed.map((x) => x.label).join(", ")} — 0 {zeroed.length === 1 ? "" : "each"}
            </span>
          </div>
        )}
        {owed > 0 && (
          <div style={{ marginTop: 14 }}>
            <BarRow label="Evidence owed" count={owed} applicable={applicable} fill={C.amber}
              active={isActive({ kind: "owed" })} onClick={() => onToggle({ kind: "owed" })}
              trailing={<span className="text-[11px]" style={{ color: C.muted }}>frequency or evidence a framework in scope asks for</span>} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
        <span className="text-[10px] uppercase tracking-wide font-semibold shrink-0" style={{ color: C.muted }}>Type</span>
        {types.map(({ t, n }) => (
          <Chip key={t} label={SOURCE_LABELS[t] ?? t} count={n} color={C.muted} bg={C.panel2}
            active={isActive({ kind: "type", key: t })} onClick={() => onToggle({ kind: "type", key: t })} flat />
        ))}
        {openAudits.length > 0 && (
          <span className="ml-auto text-[11px] flex items-center gap-1.5" style={{ color: C.muted }}>
            <ClipboardCheck size={12} /> In audit: {openAudits.join(", ")}
          </span>
        )}
      </div>
    </Panel>
  );
}

function RecordPanel({ row: r, system, canEdit, onSave, onClose }: {
  row: Row; system: WorkspaceSystem; canEdit: boolean;
  onSave: (controlId: string, v: ControlRecordValues) => string[];
  onClose: () => void;
}) {
  const engine = useLiveEngine();
  const graph = engine.graph;
  const [editing, setEditing] = useState(false);
  const b = r.coverage.baseline;
  const common = b?.common ?? null;
  const owners = Object.values(graph.orgById).map((o) => ({ id: o.id, name: o.name })).sort((a, z) => a.name.localeCompare(z.name));
  const defaultOwner = system.roles.find((x) => x.role === "Technical Administrator")?.ownerId ?? system.roles[0]?.ownerId ?? "grc";
  const history = versionsOf(graph.systemControlRecordVersions, systemRecordKey, `${system.id}::${r.controlId}`).reverse();
  const audits = engine.engagements.openForSystem(system.id as SystemId)
    .map((e) => ({ e, row: graph.engagementControlByKey[`${e.id}::${system.id}::${r.controlId}`], draft: graph.engagementDraftByKey[`${e.id}::${system.id}::${r.controlId}`] }))
    .filter(({ e }) => r.coverage.control.frameworks.some((f) => e.frameworks.includes(f.standard)));

  const initial: ControlRecordValues = {
    statement: r.record?.statement ?? "",
    status: r.record?.status ?? "implemented",
    ownerId: r.record?.ownerId ?? defaultOwner,
    frequency: r.record?.frequency,
    evidence: r.record?.evidence ?? [],
    reviewedAt: today(),
  };

  return (
    <aside className="rounded-xl flex flex-col max-h-[calc(100vh-140px)] sticky top-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <div className="text-[11px] font-mono" style={{ color: C.accent }}>{r.controlId}</div>
          <div className="text-[15px] font-semibold mt-0.5" style={{ color: C.ink }}>{r.coverage.control.name}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <Pill color={r.editable ? "accent" : "muted"}>{b ? IMPLEMENTATION_TYPE_LABELS[b.implementationType] : "System-specific"}</Pill>
            {(b?.frameworks ?? []).map((f) => <Pill key={f}>{f}</Pill>)}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ color: C.muted }}><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 text-xs">
        <p className="m-0 leading-relaxed" style={{ color: C.muted }}>{r.coverage.control.description}</p>

        {!r.editable ? (
          <section className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
              {b?.source === "provider" ? "Run by the provider" : b?.source === "common" ? "Common control — written centrally" : "Run by a central ACME program"}
            </h3>
            <div className="leading-relaxed" style={{ color: C.ink }}>{r.coverage.explanation}</div>
            {common && (
              <div className="flex flex-wrap gap-x-4" style={{ color: C.muted }}>
                <span>Owner: <span style={{ color: C.ink }}>{graph.orgById[common.ownerId]?.name ?? common.ownerId}</span></span>
                <span>Status: <RecordStatusPill status={common.status} /></span>
                <span>Reviewed: <span style={{ color: C.ink }}>{common.reviewedAt}</span></span>
              </div>
            )}
            {(common?.evidence ?? []).length > 0 && <div className="flex flex-wrap gap-1">{common!.evidence!.map((e) => <Pill key={e}>{e}</Pill>)}</div>}
          </section>
        ) : editing ? (
          <ControlRecordForm
            initial={initial}
            owners={owners}
            requires={b?.requires ?? { frequency: false, evidence: false }}
            centralMethod={common?.type === "hybrid" ? { statement: common.statement, systemPart: common.systemPart } : null}
            saveLabel="Save record"
            onSave={(v) => { const errs = onSave(r.controlId, v); if (!errs.length) setEditing(false); return errs; }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>Record</h3>
              {canEdit && <Button size="sm" onClick={() => setEditing(true)}>{r.record ? "Update" : "Record it"}</Button>}
            </div>
            {common?.type === "hybrid" && (
              <div className="rounded-md px-2.5 py-2" style={{ background: C.panel2, color: C.muted }}>
                <span className="font-semibold" style={{ color: C.ink }}>Central method: </span>{common.statement}
                {common.systemPart && <div className="mt-1"><span className="font-semibold" style={{ color: C.ink }}>This system's part: </span>{common.systemPart}</div>}
              </div>
            )}
            {r.record ? (
              <>
                <div className="leading-relaxed" style={{ color: C.ink }}>{r.record.statement}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.muted }}>
                  <span>Status: <RecordStatusPill status={r.record.status} /></span>
                  <span>Owner: <span style={{ color: C.ink }}>{graph.orgById[r.record.ownerId]?.name ?? r.record.ownerId}</span></span>
                  <span>Frequency: <span style={{ color: C.ink }}>{frequencyLabel(r.record.frequency)}</span></span>
                  <span>Reviewed: <span style={{ color: C.ink }}>{r.record.reviewedAt}</span></span>
                </div>
                {(r.record.evidence ?? []).length > 0 && <div className="flex flex-wrap gap-1">{r.record.evidence!.map((e) => <Pill key={e}>{e}</Pill>)}</div>}
                {r.missing.length > 0 && <div className="flex gap-1">{r.missing.map((m) => <Pill key={m} color="amber">{m} owed for {b?.frameworks.filter((f) => f === "SOC 2" || f === "PCI DSS").join(", ")}</Pill>)}</div>}
              </>
            ) : (
              <div style={{ color: C.muted }}>Nothing recorded yet. Until it is, this control counts as unassessed — left out of the compliance score, not scored as zero.</div>
            )}
          </section>
        )}

        {audits.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: C.muted }}><ClipboardCheck size={12} /> In open audits</h3>
            {audits.map(({ e, row, draft }) => (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <span style={{ color: C.ink }}>{e.name}</span>
                <span className="flex gap-1">
                  {draft && <Pill color="amber">Draft in audit</Pill>}
                  <Pill color={AUDITOR_RESULT_META[row?.result ?? "not-assessed"].color}>{AUDITOR_RESULT_META[row?.result ?? "not-assessed"].label}</Pill>
                </span>
              </div>
            ))}
          </section>
        )}

        {history.length > 0 && (
          <section>
            <h3 className="m-0 mb-1.5 text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: C.muted }}><History size={12} /> History</h3>
            <ol className="m-0 p-0 list-none flex flex-col gap-2">
              {history.map((h, i) => (
                <li key={`${h.recordedAt ?? h.reviewedAt}-${i}`} className="flex gap-2">
                  <span className="font-mono text-[10.5px] shrink-0 w-[86px]" style={{ color: C.muted }}>{(h.recordedAt ?? h.reviewedAt).slice(0, 10)}</span>
                  <span className="min-w-0">
                    <RecordStatusPill status={h.status} />
                    {i === 0 && <span className="ml-1"><Pill color="accent">Current</Pill></span>}
                    {h.engagementId && <span className="ml-1"><Pill>via {graph.engagementById[h.engagementId]?.name ?? h.engagementId}</Pill></span>}
                    <span className="block mt-0.5" style={{ color: C.muted }}>{h.statement}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </aside>
  );
}
