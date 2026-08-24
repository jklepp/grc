import type { EngineFinding } from "../../../engine/findings";
import type { FormalAssessmentStatus } from "../../../engine/review";
import type { DueRecurringItem } from "../../../engine/cockpit";
import type { ControlMatrixRow } from "../types";
import type { ControlId } from "../../../graph/ids";
import type { FindingSeverity } from "../../../graph/nodes/findings";
import { FINDING_REMEDIATION_STATUS_META } from "../../../engine";

// The Actions tab's row model. Four kinds of outstanding work reach one table:
// a scheduled obligation, an unassessed control, a gap that still needs filing,
// and a Finding in remediation. They answer the same six questions — what is
// it, how bad, where does it stand, who owns it, when is it owed, what is the
// one move that advances it — so they are one row shape, not four tables.
//
// Every Finding lands in exactly one group: without a CAP it is filing work
// (gaps), with one it is remediation work. The two lanes never show the same
// finding twice, which the separate group lists used to do.

export const WORK_GROUPS = ["due", "assess", "gaps", "remediate"] as const;
export type WorkGroupId = (typeof WORK_GROUPS)[number];

export type WorkItemKind =
  | "due"             // a cadence obligation coming due
  | "unassessed"      // an applicable control with no PRISMA score yet
  | "gap-no-finding"  // a scored gap with nothing filed against it
  | "gap-no-cap"      // a filed Finding carrying no corrective action plan
  | "finding"         // a planned Finding, in remediation or closed
  | "reassess";       // every Finding complete, the grade still says gap

/** Theme role, resolved to a colour by the row that draws it. */
export type WorkTone = "na" | "accent" | "red" | "green" | "amber" | "muted";

export interface WorkItem {
  key: string;
  group: WorkGroupId;
  kind: WorkItemKind;
  title: string;
  /** The second line under the title: what it belongs to, in that kind's words. */
  detail: string;
  severity: FindingSeverity | null;
  statusLabel: string;
  statusTone: WorkTone;
  owner: string | null;
  due: string | null;
  overdue: boolean;
  /** Whether this is still work. Complete Findings are the only items that aren't. */
  outstanding: boolean;
  controlId: ControlId | null;
  finding: EngineFinding | null;
  /** Assurance domain, shared vocabulary across all three sources so the domain filter works on every row. */
  domain: string | null;
}

export interface WorkItemInput {
  dueRecurring: DueRecurringItem[];
  matrix: ControlMatrixRow[];
  findings: EngineFinding[];
  formalAssessment: FormalAssessmentStatus;
  /** Responsibility label for a control, so this stays free of UI meta. */
  responsibilityLabel: (row: ControlMatrixRow) => string | null;
}

function cadenceTone(overdue: boolean, daysUntilDue: number | null | undefined): WorkTone {
  if (overdue) return "red";
  if ((daysUntilDue ?? 999) <= 14) return "amber";
  return "muted";
}

export function buildWorkItems(input: WorkItemInput): WorkItem[] {
  const { dueRecurring, matrix, findings, formalAssessment, responsibilityLabel } = input;
  const rowByControl = new Map(matrix.map((r) => [r.controlId, r]));
  const items: WorkItem[] = [];

  // ---- Due & Recurring ------------------------------------------------------
  for (const item of dueRecurring) {
    const { cadence } = item;
    items.push({
      key: `due:${item.key}`,
      group: "due",
      kind: "due",
      title: item.title,
      detail: cadence.lastAt ? `Last performed ${cadence.lastAt}` : "Never performed",
      severity: null,
      statusLabel: cadence.overdue
        ? "Overdue"
        : cadence.daysUntilDue != null ? `Due in ${cadence.daysUntilDue}d` : "Not tracked",
      statusTone: cadenceTone(cadence.overdue, cadence.daysUntilDue),
      owner: null,
      due: cadence.dueAt ?? null,
      overdue: cadence.overdue,
      outstanding: true,
      controlId: null,
      finding: null,
      domain: item.domain,
    });
  }

  // ---- Controls to Assess ---------------------------------------------------
  for (const row of matrix.filter((r) => r.status === "unassessed")) {
    items.push({
      key: `assess:${row.controlId}`,
      group: "assess",
      kind: "unassessed",
      title: row.control.name,
      detail: `${row.control.id} · ${row.control.domain}`,
      severity: null,
      statusLabel: "Unassessed",
      statusTone: "muted",
      owner: responsibilityLabel(row),
      due: null,
      overdue: false,
      outstanding: true,
      controlId: row.controlId,
      finding: null,
      domain: row.control.domain,
    });
  }

  // ---- Gaps Needing a Finding or CAP ---------------------------------------
  for (const { controlId, control } of formalAssessment.gapControlsMissingFinding) {
    const row = rowByControl.get(controlId);
    items.push({
      key: `gap:${controlId}`,
      group: "gaps",
      kind: "gap-no-finding",
      title: control.name,
      detail: `${control.id} · scored a gap with nothing filed against it`,
      severity: null,
      statusLabel: "No Finding",
      statusTone: "red",
      owner: row ? responsibilityLabel(row) : null,
      due: null,
      overdue: false,
      outstanding: true,
      controlId,
      finding: null,
      domain: control.domain ?? null,
    });
  }

  for (const f of findings.filter((x) => x.open && !x.capRecorded)) {
    items.push({
      key: `cap:${f.id}`,
      group: "gaps",
      kind: "gap-no-cap",
      title: f.title,
      detail: `${f.controlId} · ${f.controlName} · no corrective action plan`,
      severity: f.severity ?? null,
      statusLabel: "Needs a CAP",
      statusTone: "amber",
      owner: f.ownerName,
      due: f.due,
      overdue: f.overdue,
      outstanding: true,
      controlId: f.controlId,
      finding: f,
      domain: f.control?.domain ?? null,
    });
  }

  // ---- Remediation Pipeline -------------------------------------------------
  // Planned findings, plus the closed ones the status filter can bring back.
  for (const f of findings.filter((x) => x.capRecorded || !x.open)) {
    const meta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus];
    items.push({
      key: `finding:${f.id}`,
      group: "remediate",
      kind: "finding",
      title: f.title,
      detail: `${f.controlId} · ${f.controlName} · ${f.assetName ?? "no asset named"}`,
      severity: f.severity ?? null,
      statusLabel: meta?.label ?? f.remediationStatus,
      statusTone: (meta?.color as WorkTone) ?? "muted",
      owner: f.ownerName,
      due: f.due,
      overdue: f.overdue,
      outstanding: f.open,
      controlId: f.controlId,
      finding: f,
      domain: f.control?.domain ?? null,
    });
  }

  for (const { controlId, control } of formalAssessment.controlsAwaitingReassessment) {
    const row = rowByControl.get(controlId);
    items.push({
      key: `reassess:${controlId}`,
      group: "remediate",
      kind: "reassess",
      title: control.name,
      detail: `${control.id} · every Finding complete, the grade still says gap`,
      severity: null,
      statusLabel: "Ready to reassess",
      statusTone: "accent",
      owner: row ? responsibilityLabel(row) : null,
      due: null,
      overdue: false,
      outstanding: true,
      controlId,
      finding: null,
      domain: control.domain ?? null,
    });
  }

  return items;
}

export function countsByGroup(items: WorkItem[]): Record<WorkGroupId, number> {
  const counts = { due: 0, assess: 0, gaps: 0, remediate: 0 };
  for (const item of items) if (item.outstanding) counts[item.group] += 1;
  return counts;
}
