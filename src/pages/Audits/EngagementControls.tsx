import React, { useMemo, useState } from "react";
import { X, Pencil, History, Check, PenLine, AlertTriangle, Lightbulb, Clock } from "lucide-react";
import { C } from "../../theme";
import { Button, Field, Select, TextArea } from "../../components/wizard/WizardUI";
import { ControlRecordForm, frequencyLabel, type ControlRecordValues } from "../../components/ControlRecordForm";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { ROW_FLAG_LABELS, type EngagementRow, type RowFlag } from "../../engine/engagements";
import { FilterSelect } from "../SystemWorkspace/shared/FilterSelect";
import { TableHeaderCell } from "../SystemWorkspace/shared/TableHeaderCell";
import { Badge, CardAction, CELL, CheckFilter, FilterBand, SearchFilter, TableCard, cellDivider } from "../SystemWorkspace/shared/ControlTable";
import { AUDITOR_RESULT_BADGE, STATUS_META, STATUS_RANK, sourceMeta } from "../SystemWorkspace/controlMeta";
import type { LucideIcon } from "lucide-react";
import { COVERAGE_STATUS_META } from "../../engine/compliance";
import { discardEngagementDraft, saveEngagementControl, saveEngagementDraft } from "../../engine/runtimeMutations";
import { systemRecordKey, versionsOf } from "../../graph/nodes/controlRecords";
import {
  AUDITOR_RESULTS, AUDITOR_RESULT_META, NONCONFORMITY_GRADES, NONCONFORMITY_LABELS,
  type AuditorResult, type Engagement, type EngagementControl, type NonconformityGrade,
} from "../../graph/nodes/engagements";
import { commit, domainOptions, nowIso, today, Pill, RecordStatusPill, ResultPill, SOURCE_LABELS } from "./shared";

export type SourceFilter = "all" | "yours" | "central" | "provider" | "prisma";
const SOURCE_FILTERS: { id: SourceFilter; label: string; match: (r: EngagementRow) => boolean }[] = [
  { id: "all", label: "All sources", match: () => true },
  { id: "yours", label: "System-specific & hybrid", match: (r) => r.editable },
  { id: "central", label: "Common & enterprise", match: (r) => r.source === "common" || r.source === "enterprise-attestation" },
  { id: "provider", label: "Provider", match: (r) => r.source === "provider" },
  { id: "prisma", label: "Cyber Assurance (HITRUST)", match: (r) => r.prisma },
];

/** Write one engagement row's auditor/scoping fields, keeping whatever else it already holds. */
function saveRow(r: EngagementRow, patch: Partial<EngagementControl>): string[] {
  const base: EngagementControl = r.row ?? {
    engagementId: r.engagementId, systemId: r.systemId, controlId: r.controlId, inScope: true, result: "not-assessed", updatedAt: nowIso(),
  };
  const next: EngagementControl = { ...base, ...patch, updatedAt: nowIso() };
  if (next.result === "in-place" && next.nonconformity && next.nonconformity !== "ofi") delete next.nonconformity;
  return commit((rt) => saveEngagementControl(rt, next));
}

/** The grid's filters, owned by the audit page so the tracker card above can set them. */
export interface EngagementFilters {
  result: AuditorResult | null;
  source: SourceFilter;
}
export const DEFAULT_ENGAGEMENT_FILTERS: EngagementFilters = { result: null, source: "all" };

type SortKey = "status" | "source" | "result" | "owner";
const RECORD_RANK: Record<string, number> = { "not-implemented": 0, partial: 1, implemented: 2 };
const RESULT_RANK: Record<AuditorResult, number> = { "not-in-place": 0, partial: 1, "not-assessed": 2, "in-place": 3 };

export function EngagementControls({ engagement, canManage, filters, onFilters }: {
  engagement: Engagement;
  canManage: boolean;
  filters: EngagementFilters;
  onFilters: (f: EngagementFilters) => void;
}) {
  const engine = useLiveEngine();
  const rows = useMemo(() => engine.engagements.rowsFor(engagement.id), [engine, engagement.id]);
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const domains = useMemo(() => domainOptions(rows.map((r) => r.control)), [rows]);
  const [needsWork, setNeedsWork] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<AuditorResult>("in-place");
  const open = engagement.status !== "closed";
  const { result, source } = filters;

  const sourceMatch = SOURCE_FILTERS.find((f) => f.id === source)!.match;
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) =>
    (!system || r.systemId === system)
    && (!domain || r.control.domain === domain)
    && sourceMatch(r)
    && (!result || r.result === result)
    && (!needsWork || r.flags.length > 0 || r.draft)
    && (!q || r.controlId.toLowerCase().includes(q) || r.control.name.toLowerCase().includes(q))
  );
  const org = (id: string | null) => (id ? engine.graph.orgById[id]?.name ?? id : "—");
  const valueOf = (r: EngagementRow, key: SortKey): number | string => {
    switch (key) {
      case "status": return r.prisma ? (STATUS_RANK[r.coverage.status] ?? 99) : r.editable ? (RECORD_RANK[r.effective.status ?? ""] ?? -1) : 3;
      case "source": return sourceMeta(r.source).label;
      case "result": return RESULT_RANK[r.result];
      case "owner": return org(r.effective.ownerId);
    }
  };
  const sorted = sort
    ? [...shown].sort((a, b) => { const va = valueOf(a, sort.key), vb = valueOf(b, sort.key); return (va < vb ? -1 : va > vb ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); })
    : shown;
  const onSort = (key: SortKey) => setSort((prev) => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  const active = rows.find((r) => r.key === activeKey) ?? null;

  const toggleOne = (k: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const allShownSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.key));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(sorted.map((r) => r.key)));

  function applyBulk(patch: Partial<EngagementControl>) {
    const picked = rows.filter((r) => selected.has(r.key));
    // One commit for the whole set, so a refusal leaves nothing half-applied.
    commit((rt) => picked.reduce((acc, r) => saveEngagementControl(acc, {
      ...(r.row ?? { engagementId: r.engagementId, systemId: r.systemId, controlId: r.controlId, inScope: true, result: "not-assessed" as AuditorResult }),
      ...patch,
      updatedAt: nowIso(),
    }), rt));
    setSelected(new Set());
  }

  const systems = engagement.systemIds.map((id) => engine.graph.systemById[id]).filter(Boolean);
  const filtersActive = Boolean(q || system || domain || needsWork || result || source !== "all");
  const title = result ? `${AUDITOR_RESULT_BADGE[result].label} controls`
    : source !== "all" ? `${SOURCE_FILTERS.find((f) => f.id === source)!.label} controls`
    : "Controls in scope";
  const selectable = canManage && open;

  return (
    <div className="grid gap-4 items-start" style={{ gridTemplateColumns: active ? "minmax(0,1fr) 460px" : "minmax(0,1fr)" }}>
      <TableCard
        title={title}
        count={sorted.length}
        action={(result || source !== "all") ? <CardAction onClick={() => onFilters(DEFAULT_ENGAGEMENT_FILTERS)}>View all controls in scope</CardAction> : undefined}
        band={(
          <>
            <FilterBand onClear={filtersActive ? () => { setQuery(""); setSystem(null); setDomain(null); setNeedsWork(false); onFilters(DEFAULT_ENGAGEMENT_FILTERS); } : null}>
              <SearchFilter value={query} onChange={setQuery} />
              <FilterSelect label="System" value={system} onChange={setSystem} options={systems.map((x) => ({ value: x.id, label: x.name }))} />
              <FilterSelect label="Domain" value={domain} onChange={setDomain} options={domains.map((d) => ({ value: d.name, label: `${d.prefixes} · ${d.name}` }))} />
              <FilterSelect label="Source" value={source === "all" ? null : source} onChange={(v) => onFilters({ ...filters, source: (v ?? "all") as SourceFilter })} options={SOURCE_FILTERS.filter((f) => f.id !== "all").map((f) => ({ value: f.id, label: f.label }))} />
              <FilterSelect label="Result" value={result} onChange={(v) => onFilters({ ...filters, result: v as AuditorResult | null })} options={AUDITOR_RESULTS.map((x) => ({ value: x, label: AUDITOR_RESULT_BADGE[x].label }))} />
              <CheckFilter label="Needs work" checked={needsWork} onChange={setNeedsWork} />
            </FilterBand>
            {selectable && selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-[11px]" style={{ background: C.accentBg, color: C.ink, borderBottom: `1px solid ${C.border}` }}>
                <span className="font-semibold">{selected.size} selected</span>
                <span style={{ color: C.muted }}>e.g. a common control tested once for every system in scope</span>
                <FilterSelect label="Set result" value={bulkResult} onChange={(v) => v && setBulkResult(v as AuditorResult)} options={AUDITOR_RESULTS.map((x) => ({ value: x, label: AUDITOR_RESULT_BADGE[x].label }))} />
                <Button size="sm" onClick={() => applyBulk({ result: bulkResult })}>Apply</Button>
                <Button size="sm" icon={Check} onClick={() => applyBulk({ requestAccepted: true })}>Accept requests</Button>
                <button type="button" onClick={() => setSelected(new Set())} className="font-medium ml-auto" style={{ color: C.accent }}>Clear selection</button>
              </div>
            )}
          </>
        )}
      >
        <table className="w-full text-left text-xs" style={{ minWidth: 1080, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead className="text-[10px] font-semibold uppercase tracking-wide" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              {selectable && (
                <th className="pl-4 pr-1 py-2" style={{ background: C.panel2, borderBottom: `1px solid ${C.border}`, width: 32 }}>
                  <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all shown" />
                </th>
              )}
              <TableHeaderCell label="CONTROL ID" first={!selectable} />
              <TableHeaderCell label="CONTROL" />
              <TableHeaderCell label="SOURCE" sortKey="source" sort={sort} onSort={onSort} width={170} />
              <TableHeaderCell label="STATUS" sortKey="status" sort={sort} onSort={onSort} width={150} />
              <TableHeaderCell label="OWNER" sortKey="owner" sort={sort} onSort={onSort} width={130} />
              <TableHeaderCell label="REQUEST" width={96} />
              <TableHeaderCell label="AUDITOR RESULT" sortKey="result" sort={sort} onSort={onSort} width={170} />
              <TableHeaderCell label="NEEDS" width={170} last />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isActive = r.key === activeKey;
              const statusBadge = r.prisma
                ? STATUS_META[r.coverage.status as keyof typeof STATUS_META] ?? STATUS_META.unassessed
                : r.editable ? recordBadge(r.effective.status) : STATUS_META.inherited;
              return (
                <tr key={r.key} onClick={() => setActiveKey(isActive ? null : r.key)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setActiveKey(isActive ? null : r.key); }}
                  className="wz-hover transition-colors"
                  style={{ cursor: "pointer", background: isActive ? C.accentBg : undefined, opacity: r.inScope ? 1 : 0.5 }}>
                  {selectable && (
                    <td className={`${CELL} pl-4 pr-1`} style={cellDivider()} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggleOne(r.key)} aria-label={`Select ${r.controlId} on ${r.systemName}`} />
                    </td>
                  )}
                  <td className={`${CELL} ${selectable ? "pl-3" : "pl-4"} pr-3 whitespace-nowrap text-[13px]`} style={{ ...cellDivider(), color: C.ink }}>{r.controlId}</td>
                  <td className={`${CELL} px-3 min-w-0 text-[13px] leading-snug`} style={{ ...cellDivider(), color: C.ink }}>
                    {r.control.name}
                    <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{r.systemName} · {r.control.domain}{!r.inScope ? " · excluded" : ""}</div>
                  </td>
                  <td className={`${CELL} px-3`} style={cellDivider()}><Badge meta={sourceMeta(r.source)} /></td>
                  <td className={`${CELL} px-3`} style={cellDivider()}>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge meta={statusBadge} />
                      {r.draft && <Badge meta={DRAFT_META} />}
                    </div>
                  </td>
                  <td className={`${CELL} px-3 text-[13px]`} style={{ ...cellDivider(), color: C.ink }}>{org(r.effective.ownerId)}</td>
                  <td className={`${CELL} px-3 text-[13px]`} style={{ ...cellDivider(), color: r.request.accepted ? C.green : C.muted }} title={r.request.label}>
                    {r.request.accepted ? "Accepted" : "Open"}
                  </td>
                  <td className={`${CELL} px-3`} style={cellDivider()}>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge meta={AUDITOR_RESULT_BADGE[r.result]} />
                      {r.nonconformity && <Badge meta={ncBadge(r.nonconformity)} />}
                    </div>
                  </td>
                  <td className={`${CELL} pl-3 pr-4`} style={cellDivider()}>
                    <div className="flex flex-wrap gap-1">
                      {r.flags.slice(0, 2).map((f) => <Badge key={f} meta={flagBadge(f)} />)}
                      {r.flags.length > 2 && <span className="text-[11px]" style={{ color: C.muted }}>+{r.flags.length - 2}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={9} className="p-6 text-xs text-center" style={{ color: C.muted }}>No controls match this filter.</td></tr>}
          </tbody>
        </table>
      </TableCard>

      {active && (
        <RowPanel key={active.key} row={active} engagement={engagement} canManage={canManage && open} onClose={() => setActiveKey(null)} />
      )}
    </div>
  );
}

// Chips for things the shared metadata does not cover, built the same way —
// colours read at render time — so they sit beside STATUS_META chips unchanged.
const themed = (label: string, Icon: LucideIcon, color: "amber" | "red" | "muted" | "accent") => ({
  label, Icon,
  get color() { return color === "muted" ? C.muted : C[color]; },
  get bg() { return color === "muted" ? C.panel2 : C[`${color}Bg` as "amberBg"]; },
});
const DRAFT_META = themed("Draft", PenLine, "accent");
function recordBadge(status: string | null) {
  if (status === "implemented") return STATUS_META.satisfied;
  if (status === "partial") return STATUS_META.partial;
  if (status === "not-implemented") return STATUS_META["not-implemented"];
  return STATUS_META.unassessed;
}
function ncBadge(nc: NonconformityGrade) {
  return nc === "major" ? themed("Major NC", AlertTriangle, "red") : nc === "minor" ? themed("Minor NC", AlertTriangle, "amber") : themed("OFI", Lightbulb, "muted");
}
function flagBadge(f: RowFlag) {
  return themed(ROW_FLAG_LABELS[f], f === "draft-conflict" ? AlertTriangle : Clock, f === "draft-conflict" ? "red" : "amber");
}

function RowPanel({ row: r, engagement, canManage, onClose }: { row: EngagementRow; engagement: Engagement; canManage: boolean; onClose: () => void }) {
  const engine = useLiveEngine();
  const [editing, setEditing] = useState(false);
  const [inScope, setInScope] = useState(r.inScope);
  const [justification, setJustification] = useState(r.justification);
  const [result, setResult] = useState<AuditorResult>(r.result);
  const [nonconformity, setNonconformity] = useState<NonconformityGrade | "">(r.nonconformity ?? "");
  const [note, setNote] = useState(r.resultNote);
  const [accepted, setAccepted] = useState(r.request.accepted);
  const [problems, setProblems] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const graph = engine.graph;
  const system = graph.systemById[r.systemId];
  const owners = Object.values(graph.orgById).map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name));
  const defaultOwner = system?.roles.find((x) => x.role === "Technical Administrator")?.ownerId ?? system?.roles[0]?.ownerId ?? "grc";
  const common = r.coverage.baseline?.common ?? null;
  const history = versionsOf(graph.systemControlRecordVersions, systemRecordKey, `${r.systemId}::${r.controlId}`).reverse();
  const isoInScope = engagement.frameworks.includes("ISO 27001") || engagement.frameworks.some((f) => f.startsWith("ISO"));

  const initial: ControlRecordValues = {
    statement: r.draft?.statement ?? r.record?.statement ?? "",
    status: r.effective.status ?? "implemented",
    ownerId: r.effective.ownerId ?? defaultOwner,
    frequency: r.effective.frequency,
    evidence: r.effective.evidence,
    reviewedAt: today(),
  };

  function saveDraft(v: ControlRecordValues): string[] {
    const errs = commit((rt) => saveEngagementDraft(rt, {
      engagementId: engagement.id, systemId: r.systemId, controlId: r.controlId,
      statement: v.statement, status: v.status, ownerId: v.ownerId,
      ...(v.frequency ? { frequency: v.frequency } : {}),
      ...(v.evidence.length ? { evidence: v.evidence } : {}),
      reviewedAt: v.reviewedAt, updatedAt: nowIso(),
    }));
    if (!errs.length) setEditing(false);
    return errs;
  }

  function saveAuditor() {
    if (!inScope && !justification.trim()) { setProblems(["An exclusion needs a justification — the SoA has to say why."]); return; }
    const errs = saveRow(r, {
      inScope, justification: justification.trim() || undefined, result,
      nonconformity: nonconformity || undefined, resultNote: note.trim() || undefined, requestAccepted: accepted,
    });
    setProblems(errs);
    if (!errs.length) setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <aside className="rounded-xl flex flex-col max-h-[calc(100vh-140px)] sticky top-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <div className="text-[11px] font-mono" style={{ color: C.accent }}>{r.controlId} · {r.systemName}</div>
          <div className="text-[15px] font-semibold mt-0.5" style={{ color: C.ink }}>{r.control.name}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <Pill color={r.editable ? "accent" : "muted"}>{SOURCE_LABELS[r.source] ?? r.source}</Pill>
            {r.clauses.map((c) => <Pill key={c.standard}>{c.standard} {c.clauses.slice(0, 3).join(", ")}{c.clauses.length > 3 ? "…" : ""}</Pill>)}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ color: C.muted }}><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 text-xs">
        <p className="m-0 leading-relaxed" style={{ color: C.muted }}>{r.control.description}</p>

        {r.flags.length > 0 && (
          <div className="flex flex-wrap gap-1">{r.flags.map((f) => <Pill key={f} color={f === "draft-conflict" ? "red" : "amber"}>{ROW_FLAG_LABELS[f]}</Pill>)}</div>
        )}

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="m-0 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
              {r.editable ? (r.draft ? "Record · draft in this audit" : "Record · system of record") : "How it is met"}
            </h3>
            {r.editable && canManage && !editing && (
              <div className="flex gap-1.5">
                {r.draft && <Button size="sm" variant="ghost" onClick={() => commit((rt) => discardEngagementDraft(rt, r))}>Discard draft</Button>}
                <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>{r.draft ? "Edit draft" : "Draft a change"}</Button>
              </div>
            )}
          </div>
          {editing ? (
            <ControlRecordForm
              initial={initial}
              owners={owners}
              requires={r.coverage.baseline?.requires ?? { frequency: false, evidence: false }}
              centralMethod={common?.type === "hybrid" ? { statement: common.statement, systemPart: common.systemPart } : null}
              saveLabel="Save draft"
              onSave={saveDraft}
              onCancel={() => setEditing(false)}
            />
          ) : r.prisma ? (
            <div style={{ color: C.muted }}>
              {r.systemName} has HITRUST in scope and is graded on the Cyber Assurance levels. Its status here is {(COVERAGE_STATUS_META[r.coverage.status]?.label ?? r.coverage.status).toLowerCase()}; grade it from the system's Controls tab.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="leading-relaxed" style={{ color: C.ink }}>{r.effective.statement || <span style={{ color: C.muted }}>Nothing recorded yet.</span>}</div>
              {r.editable && (
                <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.muted }}>
                  <span>Status: <RecordStatusPill status={r.effective.status} /></span>
                  <span>Frequency: <span style={{ color: C.ink }}>{frequencyLabel(r.effective.frequency)}</span></span>
                  <span>Reviewed: <span style={{ color: C.ink }}>{r.effective.reviewedAt ?? "—"}</span></span>
                </div>
              )}
              {r.effective.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1">{r.effective.evidence.map((e) => <Pill key={e}>{e}</Pill>)}</div>
              )}
              {r.draft && r.record && (
                <div className="mt-1 rounded-md px-2.5 py-2" style={{ background: C.panel2, color: C.muted }}>
                  <span className="font-semibold" style={{ color: C.ink }}>System of record says: </span>{r.record.statement}
                </div>
              )}
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section>
            <h3 className="m-0 mb-1.5 text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: C.muted }}><History size={12} /> History</h3>
            <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
              {history.map((h, i) => (
                <li key={`${h.recordedAt ?? h.reviewedAt}-${i}`} className="flex gap-2">
                  <span className="font-mono text-[10.5px] shrink-0 w-[86px]" style={{ color: C.muted }}>{(h.recordedAt ?? h.reviewedAt).slice(0, 10)}</span>
                  <span className="min-w-0">
                    <RecordStatusPill status={h.status} />
                    {i === 0 && <span className="ml-1"><Pill color="accent">Current</Pill></span>}
                    {h.engagementId && <span className="ml-1"><Pill>{graph.engagementById[h.engagementId]?.name ?? h.engagementId}</Pill></span>}
                    <span className="block mt-0.5" style={{ color: C.muted }}>{h.statement}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <h3 className="m-0 text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>Auditor</h3>
          <div style={{ color: C.muted }}>Request: <span style={{ color: C.ink }}>{r.request.label}</span></div>
          {canManage ? (
            <>
              <label className="flex items-center gap-1.5" style={{ color: C.ink }}>
                <input type="checkbox" checked={inScope} onChange={(e) => setInScope(e.target.checked)} /> In scope for this audit
              </label>
              {!inScope && (
                <Field label="Why excluded"><TextArea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} /></Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Result">
                  <Select value={result} onChange={(e) => setResult(e.target.value as AuditorResult)}>
                    {AUDITOR_RESULTS.map((x) => <option key={x} value={x}>{AUDITOR_RESULT_META[x].label}</option>)}
                  </Select>
                </Field>
                {isoInScope && (
                  <Field label="ISO grading">
                    <Select value={nonconformity} onChange={(e) => setNonconformity(e.target.value as NonconformityGrade | "")}>
                      <option value="">None</option>
                      {NONCONFORMITY_GRADES.map((g) => <option key={g} value={g}>{NONCONFORMITY_LABELS[g]}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
              <Field label="Auditor's note"><TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></Field>
              <label className="flex items-center gap-1.5" style={{ color: C.ink }}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> Evidence request accepted
              </label>
              {problems.length > 0 && <div className="rounded-md px-2.5 py-2" style={{ color: C.red, background: C.redBg }}>{problems.slice(0, 3).map((p) => <div key={p}>{p}</div>)}</div>}
              <div className="flex items-center justify-end gap-2">
                {savedAt && <span style={{ color: C.green }}>Saved {savedAt}</span>}
                <Button size="sm" variant="primary" onClick={saveAuditor}>Save result</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <div><ResultPill result={r.result} /> {r.nonconformity && <Pill>{NONCONFORMITY_LABELS[r.nonconformity]}</Pill>}</div>
              {r.resultNote && <div style={{ color: C.ink }}>{r.resultNote}</div>}
              {!r.inScope && <div style={{ color: C.muted }}>Excluded: {r.justification}</div>}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
