import React, { useCallback, useMemo, useState } from "react";
import { AlertCircle, Calendar, Check, ChevronRight, Circle, ClipboardCheck, FileWarning, Plus, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../theme";
import { Panel } from "./shared/Panel";
import { SectionHeader } from "./shared/SectionHeader";
import { TableHeaderCell } from "./shared/TableHeaderCell";
import type { TableSortState } from "./shared/TableHeaderCell";
import { FilterSelect } from "./shared/FilterSelect";
import { defaultFindingOwnerId, FindingEditorModal } from "./FindingEditor";
import { Button, Callout, SaveErrorCallout, SearchInput, StatusPill, TX, WizardTokens, WZ } from "../../components/wizard/WizardUI";
import { RESPONSIBILITY_META } from "./controlMeta";
import { DOMAIN_TO_TAB } from "./overview/AttentionRequired";
import { ASSESSMENT_SELECTION, DEFAULT_SELECTION } from "./SystemControls";
import type { ControlSelection } from "./SystemControls";
import { buildWorkItems, countsByGroup, WORK_GROUPS } from "./actions/workItems";
import type { WorkGroupId, WorkItem, WorkTone } from "./actions/workItems";
import {
  addFinding, updateFinding, commitRuntimeFacts,
  FINDING_SEVERITIES, FINDING_SOURCES, FINDING_SEVERITY_META,
} from "../../engine";
import { addClosureEvidence } from "../../engine/runtimeMutations";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { EngineFinding } from "../../engine";
import type { FormalAssessmentStatus } from "../../engine/review";
import type { DueRecurringItem } from "../../engine/cockpit";
import type { AssetOption } from "./formHelpers";
import type { ControlMatrixRow } from "./types";
import type { SystemWorkspaceTab } from "./tabs";
import type { EvaluationStep } from "./ControlEvaluationPanel";
import type { ControlId, FindingId, SystemId } from "../../graph/ids";
import type { RemediationStatus } from "../../graph/nodes/findings";
import { useSignedInUser } from "../../auth/useUser";
import { canEditFinding, canRaiseFinding, allows } from "../../auth/gates";

// Actions — every outstanding assurance action for this system, and the surface
// where the Findings among them are actually worked.
//
// The four groups on top are a filter, not an accordion: they orient you (what
// is due, what is unassessed, what is unfiled, what is in remediation) and
// selecting one narrows the single table below to that group. Findings, gaps,
// unassessed controls and cadence obligations all answer the same six columns,
// so they share one table rather than four inline lists (actions/workItems.ts).
//
// SAVE MODEL: immediate (CONTRACT 5.6). There is no page-level draft, so every
// act here commits on press and is reversible by the opposite act — a status
// advance, or a save from the editor. Deliberately NOT the staged model
// ControlEvaluationPanel uses for the same editor: that panel is a staged
// surface with a footer to hold pending work, and this page is not.

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// Open / Complete / All. Defaults to open because the list exists to be worked,
// not browsed — the closed ones are history and stay one click away. Only
// Findings are ever complete; the other kinds are outstanding by nature.
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

const THEME_COLOR: Record<WorkTone, string> = {
  na: C.muted, accent: C.accent, red: C.red, green: C.green, amber: C.amber, muted: C.muted,
};

// Action item | Severity | Status | Owner | Due | Next move — what is
// outstanding, how bad, where it stands, who owns it, when it is owed, and the
// one move that advances it. The same six-column read the Controls table uses;
// everything lower-priority (control name, asset, domain) rides as a sub-line.
// Column widths live on the header cells now (see the table below).

type WorkSortKey = "severity" | "status" | "owner" | "due";
type WorkSort = TableSortState<WorkSortKey>;

// Lifecycle order across every kind, not severity order: this column answers
// "where is it in the process", so a scheduled obligation reads before an
// unassessed control, which reads before an unfiled gap.
const KIND_RANK: Record<WorkItem["kind"], number> = {
  due: 0, unassessed: 1, "gap-no-finding": 2, "gap-no-cap": 3, finding: 4, reassess: 5,
};
const REMEDIATION_RANK: Record<string, number> = {
  Planned: 0, "In Progress": 1, Blocked: 2, Complete: 3,
};

function statusRank(item: WorkItem): number {
  const within = item.finding ? REMEDIATION_RANK[item.finding.remediationStatus] ?? 9 : 0;
  return KIND_RANK[item.kind] * 10 + within;
}

function sortWorkItems(rows: WorkItem[], sort: WorkSort | null): WorkItem[] {
  // No column picked: overdue first, then severity, then the nearest due date.
  // Undated work (an unassessed control owes nothing on a calendar) sorts last
  // rather than ahead of everything as an empty string would.
  if (!sort) {
    return [...rows].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const rank = (SEVERITY_RANK[a.severity ?? ""] ?? 99) - (SEVERITY_RANK[b.severity ?? ""] ?? 99);
      if (rank !== 0) return rank;
      if (a.due !== b.due) return (a.due ?? "9999").localeCompare(b.due ?? "9999");
      return a.title.localeCompare(b.title);
    });
  }
  const dir = sort.dir === "asc" ? 1 : -1;
  const valueOf = (item: WorkItem): number | string => {
    switch (sort.key) {
      case "severity": return SEVERITY_RANK[item.severity ?? ""] ?? 99;
      case "status": return statusRank(item);
      case "owner": return item.owner ?? "";
      case "due": return item.due ?? "9999-99-99";
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

// ---- The four groups ---------------------------------------------------------

const GROUP_META: Record<WorkGroupId, { icon: LucideIcon; title: string; description: string }> = {
  due: {
    icon: Calendar,
    title: "Due & Recurring",
    description: "Cadence-based obligations this system owes on a schedule — access reviews, testing, DR, IR, and vendor reassessment.",
  },
  assess: {
    icon: ClipboardCheck,
    title: "Controls to Assess",
    description: "Applicable controls with no PRISMA score on record yet for this system.",
  },
  gaps: {
    icon: FileWarning,
    title: "Gaps Needing a Finding or CAP",
    description: "Controls scored partial, deficient, or not implemented with nothing filed against them yet, or whose open Finding still has no corrective action plan.",
  },
  remediate: {
    icon: Wrench,
    title: "Remediation Pipeline",
    description: "Findings in flight for this system, staged by what each needs next — and, once every finding on a control is Complete, the reassessment that clears the gap.",
  },
};

// Each row reads like the System Readiness checklist (AssessmentReadiness.tsx):
// marker, title, description, count. These four are independent buckets rather
// than sequential steps, so selecting one filters the table below instead of
// navigating away; selecting the chosen one again clears back to every action.
function GroupRow({ group, count, selected, onSelect }: {
  group: WorkGroupId;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { icon: Icon, title, description } = GROUP_META[group];
  const clear = count === 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${title} — ${clear ? "clear" : `${count} open`}`}
      className="wz-focusable wz-hover w-full flex items-start gap-3 px-3.5 py-3 text-left transition-colors"
      style={{
        background: selected ? C.accentBg : C.bg,
        border: `1px solid ${selected ? C.accent : C.border}`,
        borderRadius: WZ.radius.control,
      }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{
          border: `1.5px solid ${clear ? C.green : selected ? C.accent : C.border}`,
          background: clear ? C.greenBg : selected ? C.accent : "transparent",
          color: clear ? C.green : selected ? WZ.onAccent : C.muted,
        }}
      >
        {clear ? <Check size={13} /> : <Icon size={13} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`${TX.itemTitle} block`} style={{ color: C.ink }}>{title}</span>
        <span className={`${TX.help} block mt-1.5`} style={{ color: C.muted }}>{description}</span>
      </span>
      <span className="shrink-0 flex items-center gap-2 mt-0.5">
        <StatusPill tone={clear ? "success" : "danger"} icon={clear ? Check : undefined}>
          {clear ? "Clear" : `${count} open`}
        </StatusPill>
        <ChevronRight size={14} color={selected ? C.accent : C.muted} />
      </span>
    </button>
  );
}

// ---- The table ---------------------------------------------------------------

// The table carries a minimum width and scrolls inside its own container
// rather than squeezing tracks to fit.
const WORK_TABLE_MIN_WIDTH = 1040;
const CELL = "py-2.5";

// One work item as a table row. The row opens on click or Enter/Space, and the
// Next move cell carries its own button.
function WorkItemRow({ item, selected, onOpen, action }: {
  item: WorkItem;
  selected: boolean;
  onOpen: () => void;
  action: React.ReactNode;
}) {
  const statusColor = THEME_COLOR[item.statusTone];
  const sevMeta = item.severity ? FINDING_SEVERITY_META[item.severity] : null;
  const sevColor = sevMeta?.color === "red" ? C.red : sevMeta?.color === "amber" ? C.amber : C.muted;
  const sevBg = sevMeta?.color === "red" ? C.redBg : sevMeta?.color === "amber" ? C.amberBg : C.panel2;
  const cell = { borderBottom: `1px solid ${C.border}`, background: selected ? C.accentBg : undefined };
  return (
    <tr
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      aria-label={`Open ${item.title}`}
      className="wz-hover transition-colors"
      style={{ cursor: "pointer" }}
    >
      <td className={`${CELL} pl-4 pr-3 whitespace-nowrap text-[13px]`} style={{ ...cell, color: item.controlIds.length ? C.ink : C.muted }}>
        {item.controlIds.length ? item.controlIds.join(" · ") : "—"}
      </td>
      <td className={`${CELL} px-3 min-w-0`} style={cell}>
        <div className="text-[13px] leading-snug truncate" style={{ color: C.ink }}>{item.title}</div>
        <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
          {item.detail}
        </div>
      </td>
      <td className={`${CELL} px-3`} style={cell}>
        {sevMeta ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap" style={{ color: sevColor, background: sevBg }}>
            {sevMeta.label}
          </span>
        ) : (
          // Work with no severity leaves a hole in a column the eye scans down;
          // say so the way the Controls table's assurance column does.
          <span className="text-[11px]" style={{ color: C.muted }}>—</span>
        )}
      </td>
      <td className={`${CELL} px-3 min-w-0`} style={cell}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap" style={{ color: statusColor }}>
          <Circle size={7} fill={statusColor} color={statusColor} /> {item.statusLabel}
        </span>
        {item.finding && !item.finding.open && item.finding.closedDate && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }}>
            Closed {item.finding.closedDate}
            {item.finding.closureEvidenceIds && item.finding.closureEvidenceIds.length > 0 && ` · ${item.finding.closureEvidenceIds.length} evidence`}
          </div>
        )}
      </td>
      <td className={`${CELL} px-3 min-w-0`} style={cell}>
        <div className="text-xs truncate" style={{ color: item.owner ? C.ink : C.muted }}>{item.owner ?? "—"}</div>
        {item.finding && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{item.finding.jira}</div>
        )}
      </td>
      <td className={`${CELL} px-3 text-right`} style={cell}>
        <div className="text-[11px] font-semibold tabular-nums" style={{ color: item.overdue ? C.red : item.due ? C.ink : C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
          {item.due ?? "—"}
        </div>
        {item.overdue && (
          <div className="flex items-center justify-end gap-1 text-[10px] font-semibold mt-0.5" style={{ color: C.red }}>
            <AlertCircle size={10} /> Overdue
          </div>
        )}
      </td>
      {/* The row itself opens the work; a press on the action button must not
          do both. Keydown as well as click: without it the row's handler
          preventDefault()s Enter and Space before the button can act on them,
          so the keyboard path opens the editor instead of advancing status. */}
      <td
        className={`${CELL} pl-3 pr-4`}
        style={cell}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {action}
      </td>
    </tr>
  );
}

// ---- Tab root -----------------------------------------------------------------

interface SystemActionsProps {
  systemId: SystemId;
  matrix: ControlMatrixRow[];
  formalAssessment: FormalAssessmentStatus;
  findings: EngineFinding[];
  dueRecurring: DueRecurringItem[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
  onSelectControlsGroup: (selection: ControlSelection) => void;
  onStartAssessment?: () => void;
}

export function SystemActions({
  systemId, matrix, formalAssessment, findings, dueRecurring,
  onNavigate, onSelectControl, onSelectControlsGroup, onStartAssessment,
}: SystemActionsProps) {
  const liveEngine = useLiveEngine();
  const [group, setGroup] = useState<WorkGroupId | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [severity, setSeverity] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingForControlId, setCreatingForControlId] = useState<ControlId | null>(null);
  const [editingId, setEditingId] = useState<FindingId | null>(null);
  const [completingId, setCompletingId] = useState<FindingId | null>(null);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [sort, setSort] = useState<WorkSort | null>(null);

  // Raising a finding is open to anyone who works the system; changing one is
  // the owner's or an assessor's call. The row action and the editor's primary
  // both ask per-finding, because "your own" is the whole distinction.
  const user = useSignedInUser();
  const mayRaise = allows(canRaiseFinding(user));

  const items = useMemo(
    () => buildWorkItems({
      dueRecurring,
      matrix,
      findings,
      formalAssessment,
      responsibilityLabel: (row) => RESPONSIBILITY_META[row.responsibility]?.label ?? null,
    }),
    [dueRecurring, matrix, findings, formalAssessment]
  );

  // Counts describe the WHOLE system, never the filtered view — a group that
  // moved with the filters would report "0 open" for a list you had just
  // narrowed to low severity, which is the opposite of what a count is for.
  const counts = useMemo(() => countsByGroup(items), [items]);
  const doneCount = WORK_GROUPS.filter((id) => counts[id] === 0).length;
  const allClear = doneCount === WORK_GROUPS.length;

  // Third click on a column clears back to the default order rather than
  // cycling asc/desc forever — same gesture as the Controls table.
  function onSort(key: WorkSortKey) {
    setSort((prev) => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  }

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
    () => [...new Set(items.map((i) => i.domain).filter((d): d is string => Boolean(d)))].sort(),
    [items]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = items.filter((item) => {
      if (group && item.group !== group) return false;
      if (statusFilter === "open" && !item.outstanding) return false;
      if (statusFilter === "complete" && item.outstanding) return false;
      if (overdueOnly && !item.overdue) return false;
      if (severity && item.severity !== severity) return false;
      // Source is a Finding's own field; asking for one excludes work that has
      // no Finding behind it, which is what the filter is being asked to do.
      // A Finding that names no source IS a control gap — the default the
      // authored dataset leans on, so it must not filter down to nothing.
      if (source && (item.finding ? item.finding.source ?? "control-gap" : null) !== source) return false;
      if (domain && item.domain !== domain) return false;
      if (!q) return true;
      // Control ids explicitly: they used to lead the detail line and were
      // searchable through it, and now that they have their own column the
      // detail line no longer repeats them.
      return (
        item.title.toLowerCase().includes(q)
        || item.detail.toLowerCase().includes(q)
        || item.controlIds.some((id) => id.toLowerCase().includes(q))
        || (item.owner ?? "").toLowerCase().includes(q)
      );
    });
    return sortWorkItems(matched, sort);
  }, [items, group, query, statusFilter, severity, source, domain, overdueOnly, sort]);

  const filtersActive = Boolean(severity || source || domain || overdueOnly || query.trim());

  // The finding the editor is open on. Resolved from the live list rather
  // than held in state, so a commit that changes it re-seeds the header from
  // the saved record instead of the values it was opened with.
  const editing = editingId ? findings.find((f) => f.id === editingId) ?? null : null;
  const creatingControl = creatingForControlId
    ? matrix.find((row) => row.controlId === creatingForControlId)?.control ?? null
    : null;

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

  function beginFinding(controlId: ControlId | null = null) {
    setCreatingForControlId(controlId);
    setCreating(true);
    setEditingId(null);
    setCompletingId(null);
    setSaveError(null);
  }

  function beginFindingEdit(findingId: FindingId) {
    setEditingId(findingId);
    setCreating(false);
    setCreatingForControlId(null);
    setCompletingId(null);
    setSaveError(null);
  }

  // What one click does to a row, by kind. Every destination is a surface that
  // already does the work (ControlEvaluationPanel, the Finding editor, the tab
  // that explains a cadence) — this table reads and routes.
  function openItem(item: WorkItem) {
    switch (item.kind) {
      case "due":
        onNavigate((item.domain ? DOMAIN_TO_TAB[item.domain] : undefined) ?? "testing");
        return;
      case "unassessed":
      case "reassess":
        // Reassessing opens Control Scoring, not Findings: every finding on
        // the control is already Complete, so scoring is the move left.
        if (item.controlId) onSelectControl(item.controlId);
        return;
      case "gap-no-finding":
        if (item.controlId) beginFinding(item.controlId);
        return;
      case "gap-no-cap":
      case "finding":
        if (item.finding) beginFindingEdit(item.finding.id);
        return;
    }
  }

  function actionFor(item: WorkItem): React.ReactNode {
    switch (item.kind) {
      case "due":
        return <Button size="sm" onClick={() => openItem(item)}>Open</Button>;
      case "unassessed":
        return <Button size="sm" onClick={() => openItem(item)}>Assess</Button>;
      case "reassess":
        return <Button size="sm" variant="primary" onClick={() => openItem(item)}>Reassess</Button>;
      case "gap-no-finding":
        return mayRaise ? <Button size="sm" variant="primary" onClick={() => openItem(item)}>File finding</Button> : null;
      case "gap-no-cap":
        return item.finding && allows(canEditFinding(user, item.finding))
          ? <Button size="sm" variant="primary" onClick={() => openItem(item)}>Add CAP</Button>
          : null;
      case "finding": {
        const f = item.finding;
        if (!f || !f.open || !allows(canEditFinding(user, f))) return null;
        const next = NEXT_STATUS[f.remediationStatus];
        return next
          ? <Button size="sm" onClick={() => advanceStatus(f, next)}>Mark {next}</Button>
          : <Button size="sm" variant="primary" onClick={() => { setEditingId(f.id); setCompletingId(f.id); }}>Complete…</Button>;
      }
    }
  }

  const tableTitle = group ? GROUP_META[group].title : "All actions";
  // The group that is showing decides which Controls view "Open in Controls"
  // lands on — the same two selections the group lists used to offer.
  const controlsSelection = group === "assess" ? ASSESSMENT_SELECTION : group === "gaps" ? DEFAULT_SELECTION : null;

  return (
    <div className="px-8 pb-10 space-y-8">
      {saveError && <SaveErrorCallout problems={saveError} />}

      <Panel>
        <WizardTokens>
          <SectionHeader
            icon={ClipboardCheck}
            title="Outstanding Work"
            description="Every outstanding action for this system, grouped by what it needs. Pick a group to narrow the table below; pick it again to see everything."
            aside={<StatusPill tone={allClear ? "success" : "neutral"}>{doneCount} of {WORK_GROUPS.length} clear</StatusPill>}
          />
          {allClear ? (
            <Callout tone="success" title="Nothing outstanding.">
              No scheduled work is due, every applicable control is assessed, and every gap has a Finding with a CAP on record.
            </Callout>
          ) : (
            <div className="flex flex-col gap-2.5">
              {WORK_GROUPS.map((id) => (
                <GroupRow
                  key={id}
                  group={id}
                  count={counts[id]}
                  selected={group === id}
                  onSelect={() => setGroup((cur) => (cur === id ? null : id))}
                />
              ))}
            </div>
          )}
        </WizardTokens>
      </Panel>

      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>{tableTitle}</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>{visible.length} item{visible.length !== 1 ? "s" : ""}</div>
          </div>
          {group && (
            <button onClick={() => setGroup(null)} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.panel2, color: C.muted }}>
              View all actions
            </button>
          )}
          {controlsSelection && (
            <Button size="sm" onClick={() => onSelectControlsGroup(controlsSelection)}>Open in Controls</Button>
          )}
          {group === "assess" && onStartAssessment && (
            <Button size="sm" variant="primary" onClick={onStartAssessment}>Start Assessment</Button>
          )}
          {mayRaise && (
            <Button size="sm" variant="primary" icon={Plus} disabled={controlOptions.length === 0} onClick={() => beginFinding()}>
              New finding
            </Button>
          )}
        </div>

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
            placeholder="Search action, control, or owner…"
            ariaLabel="Search actions"
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

        <div className="overflow-x-auto">
          <table
            className="w-full text-left text-xs"
            style={{ minWidth: WORK_TABLE_MIN_WIDTH, borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead className="text-[10px] font-semibold uppercase tracking-wide">
              <tr>
                <TableHeaderCell label="CONTROL ID" first />
                <TableHeaderCell label="ACTION ITEM" />
                <TableHeaderCell label="SEVERITY" sortKey="severity" sort={sort} onSort={onSort} width={96} />
                <TableHeaderCell label="STATUS" sortKey="status" sort={sort} onSort={onSort} width={150} />
                <TableHeaderCell label="OWNER" sortKey="owner" sort={sort} onSort={onSort} width={150} />
                {/* The column is the item's DUE date — it is what `overdue` is
                    computed from, and calling it "Target" while the editor beside
                    it also has a separate Target date field made two different
                    dates share one word (CONTRACT 2.7). */}
                <TableHeaderCell label="DUE" sortKey="due" sort={sort} onSort={onSort} align="right" width={104} />
                <TableHeaderCell label="NEXT MOVE" width={132} last />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-xs text-center" style={{ color: C.muted }}>
                    {items.length === 0
                      ? "Nothing outstanding on this system."
                      : filtersActive || statusFilter !== "open" || group
                        ? "No actions match these filters."
                        : "No actions to show."}
                  </td>
                </tr>
              ) : (
                visible.map((item) => (
                  <WorkItemRow
                    key={item.key}
                    item={item}
                    selected={Boolean(item.finding && editingId === item.finding.id)}
                    onOpen={() => openItem(item)}
                    action={actionFor(item)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* One editor, opened for whichever act is in hand. Keyed on the subject
          so switching rows remounts the form instead of carrying the previous
          finding's values into the next one. */}
      {(creating || editing) && (
        <FindingEditorModal
          key={editing?.id ?? creatingForControlId ?? "new"}
          open
          controlOptions={controlOptions}
          assetOptionsFor={assetOptionsFor}
          closureEvidence={editingClosureEvidence}
          problems={saveError}
          eyebrow={editing ? `${editing.id} · ${editing.controlId}` : undefined}
          heading={editing ? editing.title : creatingControl ? `File finding for ${creatingControl.name}` : "New finding"}
          submitLabel={editing ? "Save finding" : "Create finding"}
          blocker={
            editing
              ? (allows(canEditFinding(user, editing)) ? null : `This finding is ${editing.ownerId}'s to change. You are signed in as ${user.name}.`)
              : (mayRaise ? null : `Findings are raised by an assessor or the system's owner. You are signed in as ${user.name}.`)
          }
          initial={editing ? {
            title: editing.title, detail: editing.detail, controlId: editing.controlId,
            assetId: editing.assetId ?? "", severity: editing.severity ?? "medium",
            source: editing.source ?? "", ownerId: editing.ownerId,
            remediationStatus: completingId === editing.id ? "Complete" : editing.remediationStatus, due: editing.due,
            remediationPlan: editing.remediationPlan ?? "",
            remediationOwnerId: editing.remediationOwnerId ?? "", targetDate: editing.targetDate ?? "",
          } : {
            ownerId: defaultFindingOwnerId(liveEngine.graph.systemById[systemId]?.roles),
            ...(creatingControl ? {
              controlId: creatingControl.id,
              title: `${creatingControl.name} gap`,
              source: "control-gap" as const,
            } : {}),
          }}
          onCancel={() => { setCreating(false); setCreatingForControlId(null); setEditingId(null); setCompletingId(null); setSaveError(null); }}
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
            if (ok) { setCreating(false); setCreatingForControlId(null); setEditingId(null); setCompletingId(null); }
          }}
        />
      )}
    </div>
  );
}
