import React from "react";
import { Calendar, ChevronRight, ClipboardCheck, FileWarning, Wrench } from "lucide-react";
import { C } from "../../theme";
import { Panel } from "./shared/Panel";
import { SectionHeader } from "./shared/SectionHeader";
import { Button, StatusPill } from "../../components/wizard/WizardUI";
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

// ---- Panel 1: Due & Recurring ------------------------------------------------

function DueRecurringPanel({ items, onNavigate }: {
  items: DueRecurringItem[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
}) {
  const overdueCount = items.filter((i) => i.cadence.overdue).length;
  const sorted = [...items].sort((a, b) => (a.cadence.dueAt ?? "").localeCompare(b.cadence.dueAt ?? ""));

  return (
    <Panel>
      <SectionHeader
        icon={Calendar}
        title="Due & Recurring"
        description="Cadence-based obligations this system owes on a schedule — access reviews, testing, DR, IR, and vendor reassessment."
        aside={items.length > 0 ? <StatusPill tone={overdueCount > 0 ? "danger" : "neutral"}>{items.length}</StatusPill> : undefined}
      />
      {sorted.length === 0 ? (
        <EmptyNote>Nothing scheduled for this system yet.</EmptyNote>
      ) : (
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
      )}
    </Panel>
  );
}

// ---- Panel 2: Controls to Assess --------------------------------------------

function ControlsToAssessPanel({ matrix, onSelectControl, onStartAssessment, onSelectControlsGroup }: {
  matrix: ControlMatrixRow[];
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
  onStartAssessment?: () => void;
  onSelectControlsGroup: (selection: ControlSelection) => void;
}) {
  const rows = matrix.filter((r) => r.status === "unassessed");

  return (
    <Panel>
      <SectionHeader
        icon={ClipboardCheck}
        title="Controls to Assess"
        description="Applicable controls with no PRISMA score on record yet for this system."
        aside={(
          <div className="flex items-center gap-2">
            {rows.length > 0 && <StatusPill tone="neutral">{rows.length}</StatusPill>}
            {rows.length > 0 && (
              <Button size="sm" onClick={onStartAssessment ?? (() => onSelectControlsGroup(ASSESSMENT_SELECTION))}>
                {onStartAssessment ? "Start Assessment" : "Open in Controls"}
              </Button>
            )}
          </div>
        )}
      />
      {rows.length === 0 ? (
        <EmptyNote>Every applicable control has been assessed.</EmptyNote>
      ) : (
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
      )}
    </Panel>
  );
}

// ---- Panel 3: Gaps Needing a Finding -----------------------------------------

function GapsPanel({ matrix, gapControlsMissingFinding, onSelectControl, onSelectControlsGroup }: {
  matrix: ControlMatrixRow[];
  gapControlsMissingFinding: FormalAssessmentStatus["gapControlsMissingFinding"];
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
  onSelectControlsGroup: (selection: ControlSelection) => void;
}) {
  const statusByControl = new Map(matrix.map((r) => [r.controlId, r.status]));

  return (
    <Panel>
      <SectionHeader
        icon={FileWarning}
        title="Gaps Needing a Finding"
        description="Controls scored partial, deficient, or not implemented with nothing filed against them yet."
        aside={(
          <div className="flex items-center gap-2">
            {gapControlsMissingFinding.length > 0 && <StatusPill tone="danger">{gapControlsMissingFinding.length}</StatusPill>}
            {gapControlsMissingFinding.length > 0 && (
              <Button size="sm" onClick={() => onSelectControlsGroup(DEFAULT_SELECTION)}>Open in Controls</Button>
            )}
          </div>
        )}
      />
      {gapControlsMissingFinding.length === 0 ? (
        <EmptyNote>Every gap on this system has a Finding on record.</EmptyNote>
      ) : (
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
      )}
    </Panel>
  );
}

// ---- Panel 4: Remediation Pipeline -------------------------------------------

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

function RemediationPipelinePanel({ findings, onSelectControl, onNavigate }: {
  findings: EngineFinding[];
  onSelectControl: (controlId: ControlId, step?: EvaluationStep) => void;
  onNavigate: (tab: SystemWorkspaceTab) => void;
}) {
  const open = findings.filter((f) => f.open);
  const needsCap = open.filter((f) => !f.remediationPlan);
  const overdue = open.filter((f) => f.remediationPlan && f.overdue);
  const inRemediation = open.filter((f) => f.remediationPlan && !f.overdue);

  return (
    <Panel>
      <SectionHeader
        icon={Wrench}
        title="Remediation Pipeline"
        description="Every open Finding for this system, staged by what it needs next."
        aside={(
          <div className="flex items-center gap-2">
            {open.length > 0 && <StatusPill tone="danger">{open.length} open</StatusPill>}
            <Button size="sm" onClick={() => onNavigate("findings")}>Open Findings &amp; CAPs</Button>
          </div>
        )}
      />
      {open.length === 0 ? (
        <EmptyNote>No open findings on this system.</EmptyNote>
      ) : (
        <RowList>
          {needsCap.length > 0 && <SubLabel>Needs a CAP</SubLabel>}
          {needsCap.map((f) => <FindingRow key={f.id} f={f} onSelectControl={onSelectControl} />)}
          {overdue.length > 0 && <SubLabel tone="danger">Overdue</SubLabel>}
          {overdue.map((f) => <FindingRow key={f.id} f={f} onSelectControl={onSelectControl} />)}
          {inRemediation.length > 0 && <SubLabel>In Remediation</SubLabel>}
          {inRemediation.map((f) => <FindingRow key={f.id} f={f} onSelectControl={onSelectControl} />)}
        </RowList>
      )}
    </Panel>
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
  return (
    <div className="px-8 pb-10 space-y-6">
      <DueRecurringPanel items={dueRecurring} onNavigate={onNavigate} />
      <ControlsToAssessPanel
        matrix={matrix}
        onSelectControl={onSelectControl}
        onStartAssessment={onStartAssessment}
        onSelectControlsGroup={onSelectControlsGroup}
      />
      <GapsPanel
        matrix={matrix}
        gapControlsMissingFinding={formalAssessment.gapControlsMissingFinding}
        onSelectControl={onSelectControl}
        onSelectControlsGroup={onSelectControlsGroup}
      />
      <RemediationPipelinePanel findings={findings} onSelectControl={onSelectControl} onNavigate={onNavigate} />
    </div>
  );
}
