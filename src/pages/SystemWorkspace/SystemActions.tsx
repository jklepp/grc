import React, { useState } from "react";
import { Calendar, Check, ChevronRight, ClipboardCheck, FileWarning, ListChecks, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../theme";
import { Panel } from "./shared/Panel";
import { SectionHeader } from "./shared/SectionHeader";
import { Button, Callout, StatusPill, TX, WizardTokens, WZ } from "../../components/wizard/WizardUI";
import type { Tone } from "../../components/wizard/WizardUI";
import { STATUS_META, RESPONSIBILITY_META } from "./controlMeta";
import { DOMAIN_TO_TAB } from "./overview/AttentionRequired";
import { ASSESSMENT_SELECTION, DEFAULT_SELECTION } from "./SystemControls";
import type { ControlSelection } from "./SystemControls";
import { FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META } from "../../engine";
import type { EngineFinding } from "../../engine";
import type { FormalAssessmentStatus } from "../../engine/review";
import type { DueRecurringItem } from "../../engine/cockpit";
import type { CadenceStatus } from "../../engine/assurance";
import type { ControlMatrixRow } from "./types";
import type { SystemWorkspaceTab } from "./tabs";
import type { EvaluationStep } from "./ControlEvaluationPanel";
import type { ControlId } from "../../graph/ids";

// A row list that can genuinely run long (every unassessed control, every
// open finding) scrolls inside a fixed height instead of pushing the rest of
// the tab down — the same maxHeight/overflow-y treatment the Controls table
// already uses (SystemControls.tsx), not a new convention.
const ROW_LIST_MAX_HEIGHT = 320;

const COLOR_TO_TONE: Record<string, Tone> = {
  green: "success", red: "danger", amber: "warning", accent: "info", na: "neutral", muted: "neutral",
};

function ActionRow({ onClick, left, right }: { onClick: () => void; left: React.ReactNode; right: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-2.5 py-2.5 text-left rounded-lg transition-colors wz-hover"
    >
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        <ChevronRight size={14} color={C.muted} />
      </div>
    </button>
  );
}

function RowList({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 mt-2 pr-1" style={{ maxHeight: ROW_LIST_MAX_HEIGHT, overflowY: "auto" }}>
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="text-sm mt-2" style={{ color: C.muted }}>{children}</div>;
}

// A cadence reads as urgent (danger), soon (warning), or on track (neutral) —
// shared by the Due & Recurring row list and the finding severity/status
// pills below.
function cadenceTone(cadence: CadenceStatus): Tone {
  if (cadence.overdue) return "danger";
  if ((cadence.daysUntilDue ?? 999) <= 14) return "warning";
  return "neutral";
}

// ---- Group 1: Due & Recurring ------------------------------------------------

function DueRecurringList({ items, onNavigate }: {
  items: DueRecurringItem[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
}) {
  const sorted = [...items].sort((a, b) => (a.cadence.dueAt ?? "").localeCompare(b.cadence.dueAt ?? ""));

  if (sorted.length === 0) return <EmptyNote>Nothing scheduled for this system yet.</EmptyNote>;

  return (
    <RowList>
      {sorted.map((item) => {
        const tab = DOMAIN_TO_TAB[item.domain] ?? "testing";
        const tone = cadenceTone(item.cadence);
        const label = item.cadence.overdue
          ? `Overdue${item.cadence.dueAt ? ` · was due ${item.cadence.dueAt}` : ""}`
          : item.cadence.daysUntilDue != null ? `Due in ${item.cadence.daysUntilDue}d` : "Not tracked";
        return (
          <ActionRow
            key={item.key}
            onClick={() => onNavigate(tab)}
            left={(
              <>
                <div className="text-sm font-semibold" style={{ color: C.ink }}>{item.title}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                  {item.domain}{item.cadence.lastAt ? ` · Last performed ${item.cadence.lastAt}` : " · Never performed"}
                </div>
              </>
            )}
            right={<StatusPill tone={tone}>{label}</StatusPill>}
          />
        );
      })}
    </RowList>
  );
}

// ---- Group 2: Controls to Assess --------------------------------------------

function ControlsToAssessList({ rows, onSelectControl }: {
  rows: ControlMatrixRow[];
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
}) {
  if (rows.length === 0) return <EmptyNote>Every applicable control has been assessed.</EmptyNote>;

  return (
    <RowList>
      {rows.map((row) => {
        const respMeta = RESPONSIBILITY_META[row.responsibility];
        return (
          <ActionRow
            key={row.controlId}
            onClick={() => onSelectControl(row.controlId)}
            left={(
              <div className="text-sm truncate" style={{ color: C.ink }}>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded mr-1.5" style={{ background: C.accentBg, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {row.control.id}
                </span>
                {row.control.name}
                <span className="text-xs ml-2" style={{ color: C.muted }}>{row.control.domain}</span>
              </div>
            )}
            right={respMeta ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: respMeta.bg, color: respMeta.color }}>
                <respMeta.Icon size={11} /> {respMeta.label}
              </span>
            ) : null}
          />
        );
      })}
    </RowList>
  );
}

// ---- Group 3: Gaps Needing a Finding -----------------------------------------

function GapsList({ matrix, gapControlsMissingFinding, onSelectControl }: {
  matrix: ControlMatrixRow[];
  gapControlsMissingFinding: FormalAssessmentStatus["gapControlsMissingFinding"];
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
}) {
  const statusByControl = new Map(matrix.map((r) => [r.controlId, r.status]));

  if (gapControlsMissingFinding.length === 0) return <EmptyNote>Every gap on this system has a Finding on record.</EmptyNote>;

  return (
    <RowList>
      {gapControlsMissingFinding.map(({ controlId, control }) => {
        const status = statusByControl.get(controlId);
        const meta = status ? STATUS_META[status] : null;
        return (
          <ActionRow
            key={controlId}
            // Lands straight on Findings & Remediation — this row exists
            // because there's nothing filed yet, so that's the step that
            // matters, not Control Scoring.
            onClick={() => onSelectControl(controlId, "findings")}
            left={(
              <div className="text-sm truncate" style={{ color: C.ink }}>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded mr-1.5" style={{ background: C.accentBg, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {control.id}
                </span>
                {control.name}
              </div>
            )}
            right={meta ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>
                <meta.Icon size={11} /> {meta.label}
              </span>
            ) : null}
          />
        );
      })}
    </RowList>
  );
}

// ---- Group 4: Remediation Pipeline -------------------------------------------

// Three real buckets, not four — "ready to remediate" would need something
// on record that says the fix is actually done, and nothing does. Overdue
// (open, has a plan, past its own due date) is the honest stand-in: it's the
// same `overdue` the rest of the app already computes off Finding.due, not a
// second date invented for this page.
function FindingRow({ f, onSelectControl }: { f: EngineFinding; onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void }) {
  const sevMeta = f.severity ? FINDING_SEVERITY_META[f.severity] : null;
  const statusMeta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus];
  return (
    <ActionRow
      onClick={() => onSelectControl(f.controlId, "findings")}
      left={(
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>
            <span className="text-[10px] mr-1.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{f.id}</span>
            {f.title}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: f.overdue ? C.red : C.muted }}>
            {f.ownerName} · target {f.targetDate ?? f.due}{f.overdue ? " · overdue" : ""}
          </div>
        </div>
      )}
      right={(
        <>
          {sevMeta && <StatusPill tone={COLOR_TO_TONE[sevMeta.color] ?? "neutral"}>{sevMeta.label}</StatusPill>}
          {statusMeta && <StatusPill tone={COLOR_TO_TONE[statusMeta.color] ?? "neutral"}>{statusMeta.label}</StatusPill>}
        </>
      )}
    />
  );
}

function SubLabel({ tone, children }: { tone?: "danger"; children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-wide mt-3 mb-1 first:mt-1"
      style={{ color: tone === "danger" ? C.red : C.muted, fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {children}
    </div>
  );
}

function RemediationPipelineList({ open, onSelectControl }: {
  open: EngineFinding[];
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
}) {
  const needsCap = open.filter((f) => !f.remediationPlan);
  const overdue = open.filter((f) => f.remediationPlan && f.overdue);
  const inRemediation = open.filter((f) => f.remediationPlan && !f.overdue);

  if (open.length === 0) return <EmptyNote>No open findings on this system.</EmptyNote>;

  return (
    <RowList>
      {needsCap.length > 0 && <SubLabel>Needs a CAP</SubLabel>}
      {needsCap.map((f) => <FindingRow key={f.id} f={f} onSelectControl={onSelectControl} />)}
      {overdue.length > 0 && <SubLabel tone="danger">Overdue</SubLabel>}
      {overdue.map((f) => <FindingRow key={f.id} f={f} onSelectControl={onSelectControl} />)}
      {inRemediation.length > 0 && <SubLabel>In Remediation</SubLabel>}
      {inRemediation.map((f) => <FindingRow key={f.id} f={f} onSelectControl={onSelectControl} />)}
    </RowList>
  );
}

// ---- Actions Overview: one accordion, grouped by action type -----------------

const GROUPS = ["due", "assess", "gaps", "remediate"] as const;
type GroupId = (typeof GROUPS)[number];

// Each row collapses to a marker/title/description/count, exactly like the
// System Readiness checklist (AssessmentReadiness.tsx) — but these four are
// independent buckets of open work, not sequential steps, so expanding one
// reveals its own row list inline instead of navigating away. Only one group
// is open at a time; clicking the open group's row closes it.
function GroupRow({ icon: Icon, title, description, count, expanded, onToggle, actions, children }: {
  icon: LucideIcon;
  title: string;
  description: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const clear = count === 0;
  return (
    <div
      className="transition-colors"
      style={{
        background: expanded ? C.accentBg : C.bg,
        border: `1px solid ${expanded ? C.accent : C.border}`,
        borderRadius: WZ.radius.control,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${title} — ${clear ? "clear" : `${count} open`}`}
        className="wz-focusable wz-hover w-full flex items-start gap-3 px-3.5 py-3 text-left transition-colors"
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{
            border: `1.5px solid ${clear ? C.green : expanded ? C.accent : C.border}`,
            background: clear ? C.greenBg : expanded ? C.accent : "transparent",
            color: clear ? C.green : expanded ? WZ.onAccent : C.muted,
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
          <ChevronRight size={14} color={C.muted} style={{ transform: expanded ? "rotate(90deg)" : undefined, transition: "transform 120ms" }} />
        </span>
      </button>
      {expanded && (
        <div className="px-3.5 pb-3.5">
          {actions && <div className="flex justify-end mb-1">{actions}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

// ---- Tab root -----------------------------------------------------------------

interface SystemActionsProps {
  matrix: ControlMatrixRow[];
  formalAssessment: FormalAssessmentStatus;
  findings: EngineFinding[];
  dueRecurring: DueRecurringItem[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
  onSelectControlsGroup: (selection: ControlSelection) => void;
  onStartAssessment?: () => void;
}

// Every outstanding assurance/compliance action for this system, in one
// place: what's due on a schedule, what's still unassessed, what gap has no
// Finding filed yet, and where every open Finding sits in its own
// remediation. Deliberately excludes vulnerability/patching work — that
// lives in Testing/Security, not here. Every row opens the real surface that
// already does the work (ControlEvaluationPanel, Findings & CAPs, the guided
// assessment walk) — this tab reads and routes, it does not carry its own
// copy of any of those.
export function SystemActions({
  matrix, formalAssessment, findings, dueRecurring,
  onNavigate, onSelectControl, onSelectControlsGroup, onStartAssessment,
}: SystemActionsProps) {
  const assessRows = matrix.filter((r) => r.status === "unassessed");
  const openFindings = findings.filter((f) => f.open);
  const counts: Record<GroupId, number> = {
    due: dueRecurring.length,
    assess: assessRows.length,
    gaps: formalAssessment.gapControlsMissingFinding.length,
    remediate: openFindings.length,
  };

  const [expandedId, setExpandedId] = useState<GroupId | null>(null);
  const toggle = (id: GroupId) => setExpandedId((cur) => (cur === id ? null : id));

  const doneCount = GROUPS.filter((id) => counts[id] === 0).length;
  const allClear = doneCount === GROUPS.length;

  return (
    <div className="px-8 pb-10">
      <Panel>
        <WizardTokens>
        <SectionHeader
          icon={ListChecks}
          title="Actions"
          description="Every outstanding action for this system, grouped by what it needs: scheduled work coming due, controls still unassessed, gaps with no Finding filed, and open Findings in remediation."
          aside={<StatusPill tone={allClear ? "success" : "neutral"}>{doneCount} of {GROUPS.length} clear</StatusPill>}
        />
        {allClear ? (
          <Callout tone="success" title="Nothing outstanding.">
            No scheduled work is due, every applicable control is assessed, and every gap has a Finding on record.
          </Callout>
        ) : (
          <div className="flex flex-col gap-2.5">
            <GroupRow
              icon={Calendar}
              title="Due & Recurring"
              description="Cadence-based obligations this system owes on a schedule — access reviews, testing, DR, IR, and vendor reassessment."
              count={counts.due}
              expanded={expandedId === "due"}
              onToggle={() => toggle("due")}
            >
              <DueRecurringList items={dueRecurring} onNavigate={onNavigate} />
            </GroupRow>

            <GroupRow
              icon={ClipboardCheck}
              title="Controls to Assess"
              description="Applicable controls with no PRISMA score on record yet for this system."
              count={counts.assess}
              expanded={expandedId === "assess"}
              onToggle={() => toggle("assess")}
              actions={assessRows.length > 0 ? (
                <Button size="sm" onClick={onStartAssessment ?? (() => onSelectControlsGroup(ASSESSMENT_SELECTION))}>
                  {onStartAssessment ? "Start Assessment" : "Open in Controls"}
                </Button>
              ) : undefined}
            >
              <ControlsToAssessList rows={assessRows} onSelectControl={onSelectControl} />
            </GroupRow>

            <GroupRow
              icon={FileWarning}
              title="Gaps Needing a Finding"
              description="Controls scored partial, deficient, or not implemented with nothing filed against them yet."
              count={counts.gaps}
              expanded={expandedId === "gaps"}
              onToggle={() => toggle("gaps")}
              actions={counts.gaps > 0 ? (
                <Button size="sm" onClick={() => onSelectControlsGroup(DEFAULT_SELECTION)}>Open in Controls</Button>
              ) : undefined}
            >
              <GapsList matrix={matrix} gapControlsMissingFinding={formalAssessment.gapControlsMissingFinding} onSelectControl={onSelectControl} />
            </GroupRow>

            <GroupRow
              icon={Wrench}
              title="Remediation Pipeline"
              description="Every open Finding for this system, staged by what it needs next."
              count={counts.remediate}
              expanded={expandedId === "remediate"}
              onToggle={() => toggle("remediate")}
              actions={<Button size="sm" onClick={() => onNavigate("findings")}>Open Findings &amp; CAPs</Button>}
            >
              <RemediationPipelineList open={openFindings} onSelectControl={onSelectControl} />
            </GroupRow>
          </div>
        )}
        </WizardTokens>
      </Panel>
    </div>
  );
}
