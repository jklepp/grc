import React, { useCallback, useMemo, useState } from "react";
import { AlertCircle, Circle, ListTodo, Plus } from "lucide-react";
import { C } from "../../theme";
import { SectionHeader } from "./shared/SectionHeader";
import { TableHeaderCell } from "./shared/TableHeaderCell";
import type { TableSortState } from "./shared/TableHeaderCell";
import { FilterSelect } from "./shared/FilterSelect";
import { FindingEditorModal } from "./FindingEditor";
import { Button, SaveErrorCallout, SearchInput, StatusPill } from "../../components/wizard/WizardUI";
import {
  addFinding, updateFinding, commitRuntimeFacts,
  FINDING_SEVERITIES, FINDING_SOURCES,
  FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META,
} from "../../engine";
import { addClosureEvidence } from "../../engine/runtimeMutations";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { EngineFinding } from "../../engine/findings";
import type { AssetOption } from "./formHelpers";
import type { ControlId, FindingId, SystemId } from "../../graph/ids";
import type { RemediationStatus } from "../../graph/nodes/findings";

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// Open / Complete / All. Defaults to open because the list exists to be worked,
// not browsed — the closed ones are history and stay one click away.
type StatusFilter = "open" | "complete" | "all";
const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "complete", label: "Complete" },
  { id: "all", label: "All" },
];

// The next status a one-click advance offers. Blocked is deliberately absent:
// blocking is a judgment with a reason behind it, so it goes through the editor
// rather than a button that records it silently.
const NEXT_STATUS: Partial<Record<RemediationStatus, RemediationStatus>> = {
  Planned: "In Progress",
  Blocked: "In Progress",
};

const THEME_COLOR: Record<string, string> = {
  na: C.muted, accent: C.accent, red: C.red, green: C.green, amber: C.amber, muted: C.muted,
};

// Finding | Severity | Status | Owner | Target | Action — the same six-column
// read the Controls table uses: what is wrong, how bad, where it stands, who
// owns it, when it is owed, and the one move that advances it. Everything
// lower-priority (asset, ticket, control name) rides as a sub-line rather
// than claiming a column, exactly as CONTROL does over there.
const FINDING_GRID = "2fr 96px 136px 150px 104px 132px";

type FindingSortKey = "severity" | "status" | "owner" | "target";
type FindingSort = TableSortState<FindingSortKey>;

// Lifecycle order, not severity order: this column answers "where is it in the
// process", so Planned reads before Complete.
const REMEDIATION_RANK: Record<string, number> = {
  Planned: 0, "In Progress": 1, Blocked: 2, Complete: 3,
};

function sortFindings(rows: EngineFinding[], sort: FindingSort | null): EngineFinding[] {
  // No column picked: overdue first, then severity, then the nearest due date —
  // the order the list was already in before it became a table.
  if (!sort) {
    return [...rows].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const rank = (SEVERITY_RANK[a.severity ?? ""] ?? 99) - (SEVERITY_RANK[b.severity ?? ""] ?? 99);
      if (rank !== 0) return rank;
      return a.due.localeCompare(b.due);
    });
  }
  const dir = sort.dir === "asc" ? 1 : -1;
  const valueOf = (f: EngineFinding): number | string => {
    switch (sort.key) {
      case "severity": return SEVERITY_RANK[f.severity ?? ""] ?? 99;
      case "status": return REMEDIATION_RANK[f.remediationStatus] ?? 99;
      case "owner": return f.ownerName ?? "";
      case "target": return f.due;
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

// One finding as a table row. A div rather than a button because the Action
// cell carries its own button, and the row still opens the editor on click or
// Enter/Space the way the Controls table's rows do.
function FindingRow({ item, selected, onOpen, action }: {
  item: EngineFinding;
  selected: boolean;
  onOpen: () => void;
  action: React.ReactNode;
}) {
  const statusMeta = FINDING_REMEDIATION_STATUS_META[item.remediationStatus];
  const statusColor = THEME_COLOR[statusMeta?.color] ?? C.muted;
  const sevMeta = item.severity ? FINDING_SEVERITY_META[item.severity] : null;
  const sevColor = sevMeta?.color === "red" ? C.red : sevMeta?.color === "amber" ? C.amber : C.muted;
  const sevBg = sevMeta?.color === "red" ? C.redBg : sevMeta?.color === "amber" ? C.amberBg : C.panel2;
  const sourceLabel = item.source && item.source !== "control-gap" ? item.source.replace(/-/g, " ") : null;
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="w-full grid px-4 text-left wz-hover transition-colors cursor-pointer"
      style={{
        gridTemplateColumns: FINDING_GRID,
        borderBottom: `1px solid ${C.border}`,
        background: selected ? C.accentBg : undefined,
      }}
    >
      <div className="py-3 pr-3 min-w-0">
        <div className="text-sm leading-snug truncate" style={{ color: C.ink }}>{item.title}</div>
        <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
          {item.controlId}
          <span style={{ fontFamily: "inherit" }}>
            {" · "}{item.controlName}
            {/* The asset is a locator, not the anchor — say so when it is absent
                rather than leaving a gap where a name used to be. */}
            {" · "}{item.assetName ?? "no asset named"}
            {sourceLabel && ` · ${sourceLabel}`}
          </span>
        </div>
      </div>
      <div className="py-3 pl-3 flex items-center" style={{ borderLeft: `1px solid ${C.border}` }}>
        {sevMeta ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ color: sevColor, background: sevBg }}>
            {sevMeta.label}
          </span>
        ) : (
          // An ungraded finding leaves a hole in a column the eye scans down;
          // say "not set" the way the Controls table's assurance column does.
          <span className="text-[11px]" style={{ color: C.muted }}>—</span>
        )}
      </div>
      <div className="py-3 pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: statusColor }}>
          <Circle size={7} fill={statusColor} color={statusColor} /> {statusMeta?.label ?? item.remediationStatus}
        </span>
        {!item.open && item.closedDate && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }}>
            Closed {item.closedDate}
            {item.closureEvidenceIds && item.closureEvidenceIds.length > 0 && ` · ${item.closureEvidenceIds.length} evidence`}
          </div>
        )}
      </div>
      <div className="py-3 pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
        <div className="text-xs truncate" style={{ color: C.ink }}>{item.ownerName}</div>
        <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{item.jira}</div>
      </div>
      <div className="py-3 pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-semibold tabular-nums" style={{ color: item.overdue ? C.red : C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
          {item.due}
        </div>
        {item.overdue && (
          <div className="flex items-center gap-1 text-[10px] font-semibold mt-0.5" style={{ color: C.red }}>
            <AlertCircle size={10} /> Overdue
          </div>
        )}
      </div>
      {/* The row itself opens the editor; a click on the action button must
          not do both. */}
      <div
        className="py-3 pl-3 flex items-center"
        style={{ borderLeft: `1px solid ${C.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {action}
      </div>
    </div>
  );
}

// Findings & CAPs — every gap recorded against this system, and the surface
// where they are actually worked.
//
// SAVE MODEL: immediate (CONTRACT 5.6). There is no page-level draft, so every
// act here commits on press and is reversible by the opposite act — a status
// advance, or a save from the editor. Deliberately NOT the staged model
// ControlEvaluationPanel uses for the same editor: that panel is a staged
// surface with a footer to hold pending work, and this page is not. Mixing the
// two inside one surface is what 5.6 forbids; hosting one component under both
// models is not, because the editor never writes — it hands back a draft and
// the host commits it.
export function SystemFindings({ systemId, findings }: { systemId: SystemId; findings: EngineFinding[] }) {
  const liveEngine = useLiveEngine();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [severity, setSeverity] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<FindingId | null>(null);
  const [completingId, setCompletingId] = useState<FindingId | null>(null);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [sort, setSort] = useState<FindingSort | null>(null);

  // Third click on a column clears back to the default order rather than
  // cycling asc/desc forever — same gesture as the Controls table.
  function onSort(key: FindingSortKey) {
    setSort((prev) => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  }

  // Counts describe the WHOLE system, never the filtered view — a header that
  // moved with the filters would report "0 overdue" for a list you had just
  // narrowed to low severity, which is the opposite of what a count is for.
  const openCount = findings.filter((f) => f.open).length;
  const overdueCount = findings.filter((f) => f.overdue).length;
  const seriousCount = findings.filter((f) => f.open && (f.severity === "critical" || f.severity === "high")).length;
  const completeCount = findings.filter((f) => !f.open).length;

  const matrix = useMemo(() => liveEngine.compliance.systemControlMatrix(systemId), [liveEngine, systemId]);

  // Only key controls: validate.ts refuses a finding against anything else, so
  // offering the rest would build drafts the dry run rejects.
  const controlOptions = useMemo(
    () => matrix
      .filter((row) => row.keyControl)
      .map((row) => ({ id: row.control.id, label: `${row.control.id} · ${row.control.name}` }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    [matrix]
  );

  const assetOptionsFor = useCallback(
    (controlId: ControlId): AssetOption[] => (liveEngine.graph.assetsBySystem[systemId] ?? [])
      .filter((asset) => liveEngine.applicability.resolveApplicability(asset.id, controlId).required)
      .map((asset) => ({ assetId: asset.id, label: asset.name })),
    [liveEngine, systemId]
  );

  const domainOptions = useMemo(
    () => [...new Set(findings.map((f) => f.control?.domain).filter((d): d is string => Boolean(d)))].sort(),
    [findings]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = findings
      .filter((f) => {
        if (statusFilter === "open" && !f.open) return false;
        if (statusFilter === "complete" && f.open) return false;
        if (overdueOnly && !f.overdue) return false;
        if (severity && f.severity !== severity) return false;
        if (source && (f.source ?? "control-gap") !== source) return false;
        if (domain && f.control?.domain !== domain) return false;
        if (!q) return true;
        return (
          f.title.toLowerCase().includes(q)
          || f.controlId.toLowerCase().includes(q)
          || (f.controlName ?? "").toLowerCase().includes(q)
          || (f.ownerName ?? "").toLowerCase().includes(q)
        );
      });
    return sortFindings(matched, sort);
  }, [findings, query, statusFilter, severity, source, domain, overdueOnly, sort]);

  const filtersActive = Boolean(severity || source || domain || overdueOnly || query.trim());

  // The finding the editor is open on. Resolved from the live list rather
  // than held in state, so a commit that changes it re-seeds the header from
  // the saved record instead of the values it was opened with.
  const editing = editingId ? findings.find((f) => f.id === editingId) ?? null : null;

  // What already closed this finding, resolved here rather than in the form —
  // the editor has no engine access, same rule that keeps systemId out of it.
  const editingClosureEvidence = useMemo(
    () => (editing?.closureEvidenceIds ?? [])
      .map((id) => liveEngine.selectors.getEvidence(id))
      .filter((ev): ev is NonNullable<typeof ev> => Boolean(ev))
      .map((ev) => ({ id: ev.id, source: ev.source, collectedAt: ev.collectedAt, evidenceType: ev.evidenceType })),
    [editing, liveEngine]
  );

  // Dry-run, then commit (CONTRACT 5.4). Nothing here hand-assembles a fact
  // record — every mutation goes through engine/runtimeMutations.
  function commit(mutate: (runtime: RuntimeFacts) => RuntimeFacts): boolean {
    setSaveError(null);
    let next: RuntimeFacts;
    try {
      next = mutate(loadRuntimeFacts());
    } catch (e) {
      setSaveError([e instanceof Error ? e.message : String(e)]);
      return false;
    }
    const { engine, problems } = commitRuntimeFacts(next);
    if (!engine) {
      setSaveError(problems);
      return false;
    }
    return true;
  }

  function advanceStatus(finding: EngineFinding, to: RemediationStatus) {
    commit((runtime) => updateFinding(runtime, finding.id, { remediationStatus: to }));
  }

  return (
    <div className="px-8 pb-10 space-y-8">
      <div>
        <SectionHeader
          icon={ListTodo}
          title="Findings & CAPs"
          description="Every gap recorded against this system, with its corrective action plan, responsible resource, and target date. A finding is a gap in a control; the asset, where named, is where it was observed."
          aside={(
            <div className="flex items-center gap-2">
              <StatusPill tone="neutral">{openCount} open</StatusPill>
              {overdueCount > 0 && <StatusPill tone="danger">{overdueCount} overdue</StatusPill>}
              {seriousCount > 0 && <StatusPill tone="warning">{seriousCount} critical/high</StatusPill>}
              <StatusPill tone="success">{completeCount} complete</StatusPill>
              <Button
                size="sm"
                variant="primary"
                icon={Plus}
                disabled={controlOptions.length === 0}
                onClick={() => { setCreating(true); setEditingId(null); setCompletingId(null); }}
              >
                New finding
              </Button>
            </div>
          )}
        />

        {saveError && <SaveErrorCallout problems={saveError} />}

        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-4 flex-wrap px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className="text-[11px] font-semibold px-2 py-1 rounded"
                  style={{
                    background: statusFilter === s.id ? C.accentBg : "transparent",
                    color: statusFilter === s.id ? C.accent : C.muted,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={FINDING_SEVERITIES.map((s) => ({ value: s, label: s }))} />
            <FilterSelect label="Source" value={source} onChange={setSource} options={FINDING_SOURCES.map((s) => ({ value: s, label: s.replace(/-/g, " ") }))} />
            <FilterSelect label="Domain" value={domain} onChange={setDomain} options={domainOptions.map((d) => ({ value: d, label: d }))} />
            <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
              Overdue only
            </label>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search title, control, or owner…"
              ariaLabel="Search findings"
              className="md:max-w-[280px]"
            />
            {filtersActive && (
              <button
                onClick={() => { setSeverity(null); setSource(null); setDomain(null); setOverdueOnly(false); setQuery(""); }}
                className="text-[11px] font-medium ml-auto"
                style={{ color: C.accent }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div
            className="grid text-[10px] font-semibold uppercase tracking-wide px-4 py-2.5"
            style={{ gridTemplateColumns: FINDING_GRID, background: C.panel2, borderBottom: `1px solid ${C.border}`, color: C.muted }}
          >
            <TableHeaderCell label="FINDING" first />
            <TableHeaderCell label="SEVERITY" sortKey="severity" sort={sort} onSort={onSort} />
            <TableHeaderCell label="STATUS" sortKey="status" sort={sort} onSort={onSort} />
            <TableHeaderCell label="OWNER" sortKey="owner" sort={sort} onSort={onSort} />
            <TableHeaderCell label="TARGET" sortKey="target" sort={sort} onSort={onSort} />
            <TableHeaderCell label="ACTION" />
          </div>

          {visible.length === 0 ? (
            <div className="p-6 text-xs text-center" style={{ color: C.muted }}>
              {findings.length === 0
                ? "No findings recorded on this system yet. Assess a control and log what you find, or create one directly."
                : filtersActive || statusFilter !== "all"
                  ? "No findings match these filters."
                  : "No findings to show."}
            </div>
          ) : (
            visible.map((f) => {
              const next = NEXT_STATUS[f.remediationStatus];
              return (
                <FindingRow
                  key={f.id}
                  item={f}
                  selected={editingId === f.id}
                  onOpen={() => { setEditingId(f.id); setCompletingId(null); setCreating(false); }}
                  // One move per row. Everything else a finding needs — the CAP,
                  // blocking with a reason, completing with closure evidence —
                  // is the editor the row itself opens, so the table does not
                  // carry a strip of buttons that all lead to the same place.
                  action={
                    !f.open ? null
                      : next
                        ? <Button size="sm" onClick={() => advanceStatus(f, next)}>Mark {next}</Button>
                        : <Button size="sm" variant="primary" onClick={() => { setEditingId(f.id); setCompletingId(f.id); }}>Complete…</Button>
                  }
                />
              );
            })
          )}
        </div>
      </div>

      {/* One editor, opened for whichever act is in hand. Keyed on the subject
          so switching rows remounts the form instead of carrying the previous
          finding's values into the next one. */}
      {(creating || editing) && (
        <FindingEditorModal
          key={editing?.id ?? "new"}
          open
          controlOptions={controlOptions}
          assetOptionsFor={assetOptionsFor}
          closureEvidence={editingClosureEvidence}
          problems={saveError}
          eyebrow={editing ? `${editing.id} · ${editing.controlId}` : undefined}
          heading={editing ? editing.title : "New finding"}
          submitLabel={editing ? "Save finding" : "Create finding"}
          initial={editing ? {
            title: editing.title, detail: editing.detail, controlId: editing.controlId,
            assetId: editing.assetId ?? "", severity: editing.severity ?? "medium",
            source: editing.source ?? "", ownerId: editing.ownerId,
            remediationStatus: completingId === editing.id ? "Complete" : editing.remediationStatus, due: editing.due,
            remediationPlan: editing.remediationPlan ?? "",
            remediationOwnerId: editing.remediationOwnerId ?? "", targetDate: editing.targetDate ?? "",
          } : undefined}
          onCancel={() => { setCreating(false); setEditingId(null); setCompletingId(null); setSaveError(null); }}
          onSubmit={(draft, closureEvidence) => {
            const ok = commit((runtime) => {
              const fallbackAssetIds = assetOptionsFor(draft.controlId).map((o) => o.assetId);
              if (editing) {
                const updated = updateFinding(runtime, editing.id, draft);
                if (!closureEvidence) return updated;
                return addClosureEvidence(updated, { findingId: editing.id, text: closureEvidence, fallbackAssetIds });
              }
              const withFinding = addFinding(runtime, { ...draft, systemId }, systemId);
              if (!closureEvidence) return withFinding;
              const created = withFinding.findings[withFinding.findings.length - 1];
              return addClosureEvidence(withFinding, { findingId: created.id, text: closureEvidence, fallbackAssetIds });
            });
            if (ok) { setCreating(false); setEditingId(null); setCompletingId(null); }
          }}
        />
      )}
    </div>
  );
}
