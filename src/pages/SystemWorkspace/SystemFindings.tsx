import React, { useCallback, useMemo, useState } from "react";
import { ListTodo, Plus } from "lucide-react";
import { C } from "../../theme";
import { POAMRow } from "./shared/POAMRow";
import { SectionHeader } from "./shared/SectionHeader";
import { FilterSelect } from "./shared/FilterSelect";
import { FindingEditorModal } from "./FindingEditor";
import { Button, EmptyState, SaveErrorCallout, SearchInput, StatusPill, Well } from "../../components/wizard/WizardUI";
import {
  addFinding, updateFinding, commitRuntimeFacts,
  FINDING_SEVERITIES, FINDING_SOURCES,
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
  const [saveError, setSaveError] = useState<string[] | null>(null);

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
    return findings
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
      })
      // Overdue first, then severity, then the nearest due date — the order the
      // list was already sorted in before it gained filters.
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        const rank = (SEVERITY_RANK[a.severity ?? ""] ?? 99) - (SEVERITY_RANK[b.severity ?? ""] ?? 99);
        if (rank !== 0) return rank;
        return a.due.localeCompare(b.due);
      });
  }, [findings, query, statusFilter, severity, source, domain, overdueOnly]);

  const filtersActive = Boolean(severity || source || domain || overdueOnly || query.trim());

  // The finding the editor is open on. Resolved from the live list rather
  // than held in state, so a commit that changes it re-seeds the header from
  // the saved record instead of the values it was opened with.
  const editing = editingId ? findings.find((f) => f.id === editingId) ?? null : null;

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
                onClick={() => { setCreating(true); setEditingId(null); }}
              >
                New finding
              </Button>
            </div>
          )}
        />

        {saveError && <SaveErrorCallout problems={saveError} />}

        <div
          className="flex items-center gap-4 flex-wrap px-4 py-2.5 mb-4 rounded-lg"
          style={{ border: `1px solid ${C.border}`, background: C.panel2 }}
        >
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

        {visible.length === 0 ? (
          <EmptyState>
            {findings.length === 0
              ? "No findings recorded on this system yet. Assess a control and log what you find, or create one directly."
              : filtersActive || statusFilter !== "all"
                ? "No findings match these filters."
                : "No findings to show."}
          </EmptyState>
        ) : (
          visible.map((f) => {
            const next = NEXT_STATUS[f.remediationStatus];
            return (
              <POAMRow
                key={f.id}
                item={f}
                selected={editingId === f.id}
                onOpen={() => { setEditingId(f.id); setCreating(false); }}
                actions={(
                  <>
                    <Button size="sm" onClick={() => { setEditingId(f.id); setCreating(false); }}>Edit / CAP</Button>
                    {next && <Button size="sm" onClick={() => advanceStatus(f, next)}>Mark {next}</Button>}
                    {f.open && f.remediationStatus !== "Blocked" && (
                      <Button size="sm" variant="danger" onClick={() => setEditingId(f.id)}>Block…</Button>
                    )}
                    {/* Completing goes through the editor so closure evidence is
                        offered at the moment it means something. */}
                    {f.open && <Button size="sm" variant="primary" onClick={() => setEditingId(f.id)}>Complete…</Button>}
                    {!f.open && (
                      <Well hollow className="text-[11px]" >
                        <span style={{ color: C.green }}>Closed {f.closedDate}</span>
                        {f.closureEvidenceIds && f.closureEvidenceIds.length > 0 && (
                          <span style={{ color: C.muted }}> · {f.closureEvidenceIds.length} closure evidence record{f.closureEvidenceIds.length === 1 ? "" : "s"}</span>
                        )}
                      </Well>
                    )}
                  </>
                )}
              />
            );
          })
        )}
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
          problems={saveError}
          eyebrow={editing ? `${editing.id} · ${editing.controlId}` : "New finding"}
          heading={editing ? editing.title : "New finding"}
          submitLabel={editing ? "Save finding" : "Create finding"}
          initial={editing ? {
            title: editing.title, detail: editing.detail, controlId: editing.controlId,
            assetId: editing.assetId ?? "", severity: editing.severity ?? "medium",
            source: editing.source ?? "", ownerId: editing.ownerId,
            remediationStatus: editing.remediationStatus, due: editing.due,
            remediationPlan: editing.remediationPlan ?? "",
            remediationOwnerId: editing.remediationOwnerId ?? "", targetDate: editing.targetDate ?? "",
          } : undefined}
          onCancel={() => { setCreating(false); setEditingId(null); setSaveError(null); }}
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
            if (ok) { setCreating(false); setEditingId(null); }
          }}
        />
      )}
    </div>
  );
}
