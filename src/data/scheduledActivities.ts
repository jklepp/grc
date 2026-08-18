// Control-timeliness tracking, split by cadence — the recurring GRC
// activities that have to happen on a fixed schedule, grouped by operational
// activity type rather than lumped into one generic "control review" bucket.
// Each activity is a real control already owned by a real SOP in
// procedures.js — this file doesn't invent new controls or new procedures,
// it schedules existing ones.
//
// Nothing here starts with no real backing data:
//  - Monthly: SOP-05's tiered risk-review cadence ("Critical risks reviewed
//    monthly, High quarterly, Medium/Low annually") is the only real
//    monthly-cadence activity anywhere in this app — so the Monthly view has
//    exactly one row, on purpose, not because coverage is thin.
//  - Quarterly: privileged/physical access review (SOP-04/SOP-13),
//    vulnerability scanning ("quarterly at minimum" per
//    consolidatedControls.js), monitoring signal review (SOP-03), and the
//    High-tier slice of SOP-05's risk cadence.
//  - Annual: penetration testing, IR plan testing, Tier 1 backup restore
//    testing, security awareness training completion, and critical-vendor
//    reassessment — each "at least annually" per its owning SOP.
// Cadences that exist in the real data but aren't one of these three
// (semi-annual standard access recert, biennial standard-vendor reassessment,
// trigger-based reviews) are deliberately left out rather than force-fit into
// the nearest tab — see the page's footer note.
//
// What IS necessarily illustrative: this app has no real historical
// completion log anywhere, so specific `completedAt` dates are seed data,
// not a real audit trail — same convention already used for this app's trend
// charts (see ExecutiveDashboard.jsx's trendTo()). What's NOT illustrative:
// status is never hand-typed. It's computed from each instance's real due
// date against today's real date by deriveStatus() below, so "Overdue"
// always means the due date has actually passed.
import { CCF_VISIBLE_CONTROLS } from "./ccfControls";
import { PROCEDURES } from "./procedures";
import { getApplicableStandards, getFrameworkClauses } from "./policies";
import type { ActivityFrequency } from "../graph/nodes/scheduledActivities";

export const FREQUENCIES = ["Monthly", "Quarterly", "Annual"] as const satisfies readonly ActivityFrequency[];
export const PERIODS_PER_YEAR: Record<ActivityFrequency, number> = { Monthly: 12, Quarterly: 4, Annual: 1 };
export const PERIOD_LABELS: Record<ActivityFrequency, string[]> = {
  Monthly: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  Quarterly: ["Q1", "Q2", "Q3", "Q4"],
  Annual: ["FY"],
};

export const ACTIVITY_TYPES = [
  "Access & Identity", "Physical Security", "Vulnerability Management", "Detection & Monitoring",
  "Governance & Risk", "Incident Response", "Resilience & Continuity", "Workforce & Awareness", "Third-Party & Vendor",
];

export const ACTIVITY_STATUSES = ["completed", "in_progress", "upcoming", "at_risk", "overdue"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export type ActivityStatusColor = "green" | "accent" | "muted" | "amber" | "red";

export const STATUS_META: Record<ActivityStatus, { symbol: string; label: string; color: ActivityStatusColor }> = {
  completed: { symbol: "✓", label: "Completed on time", color: "green" },
  in_progress: { symbol: "●", label: "In progress", color: "accent" },
  upcoming: { symbol: "○", label: "Upcoming", color: "muted" },
  at_risk: { symbol: "⚠", label: "At risk", color: "amber" },
  overdue: { symbol: "✕", label: "Overdue", color: "red" },
};

interface ActivityInstanceDefinition {
  period: number;
  dueDate: string;
  completedAt?: string;
  inProgress?: boolean;
  note?: string;
}

interface ActivityDefinition {
  id: string;
  title: string;
  type: string;
  frequency: ActivityFrequency;
  controls: string[];
  procedureId: string;
  description: string;
  instances: ActivityInstanceDefinition[];
}

const TODAY = new Date();
const AT_RISK_WINDOW_DAYS = 14;

// `new Date("YYYY-MM-DD")` parses as UTC midnight, but every display/compare
// call runs in the browser's local timezone — for any timezone behind UTC
// that silently shows/compares one day earlier than the string says. Every
// "YYYY-MM-DD" in this file goes through this instead, so a due date always
// means the same calendar day everywhere it's used.
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0)) / 86400000);
}

// Completed always wins (we're not modeling "completed late" as its own
// state); otherwise a due date in the past is always Overdue regardless of
// an in-progress flag — being actively worked doesn't un-overdue something.
export function deriveStatus(instance: ActivityInstanceDefinition, today = new Date(TODAY)): ActivityStatus {
  if (instance.completedAt) return "completed";
  const due = parseLocalDate(instance.dueDate);
  const daysUntilDue = daysBetween(new Date(today), due);
  if (daysUntilDue < 0) return "overdue";
  if (instance.inProgress) return "in_progress";
  if (daysUntilDue <= AT_RISK_WINDOW_DAYS) return "at_risk";
  return "upcoming";
}

export function currentPeriod(frequency: ActivityFrequency, today = TODAY): number {
  if (frequency === "Monthly") return today.getMonth() + 1;
  if (frequency === "Quarterly") return Math.floor(today.getMonth() / 3) + 1;
  return 1;
}
export const CURRENT_YEAR = TODAY.getFullYear();

const ACTIVITY_DEFS: ActivityDefinition[] = [
  // ---- Monthly ---------------------------------------------------------
  {
    id: "critical-tier-risk-review",
    title: "Critical-Tier Risk Register Review",
    type: "Governance & Risk",
    frequency: "Monthly",
    controls: ["RSK-05", "RSK-07"],
    procedureId: "control-ownership-assurance-review",
    description: "SOP-05's risk review cadence is tiered by severity — this tracks the Critical-tier slice, reviewed monthly. High-tier is quarterly and Medium/Low is annual; see those tabs.",
    instances: [
      { period: 1, dueDate: "2026-01-31", completedAt: "2026-01-09" },
      { period: 2, dueDate: "2026-02-28", completedAt: "2026-02-06" },
      { period: 3, dueDate: "2026-03-31", completedAt: "2026-03-10" },
      { period: 4, dueDate: "2026-04-30", completedAt: "2026-04-08" },
      { period: 5, dueDate: "2026-05-31", completedAt: "2026-05-07" },
      { period: 6, dueDate: "2026-06-30", completedAt: "2026-06-09" },
      { period: 7, dueDate: "2026-07-31", completedAt: "2026-07-08" },
      { period: 8, dueDate: "2026-08-31", inProgress: true, note: "This month's review is in progress." },
      { period: 9, dueDate: "2026-09-30" },
      { period: 10, dueDate: "2026-10-31" },
      { period: 11, dueDate: "2026-11-30" },
      { period: 12, dueDate: "2026-12-31" },
    ],
  },

  // ---- Quarterly ---------------------------------------------------------
  {
    id: "privileged-access-recert",
    title: "Privileged Access Recertification",
    type: "Access & Identity",
    frequency: "Quarterly",
    controls: ["IAC-16", "IAC-17"],
    procedureId: "access-provisioning-review",
    description: "Confirm every standing privileged grant is still needed and owner-reconfirmed, or revoke it — the quarterly half of SOP-04's recertification cadence.",
    instances: [
      { period: 1, dueDate: "2026-03-31", completedAt: "2026-03-18" },
      { period: 2, dueDate: "2026-06-30", completedAt: "2026-06-22" },
      { period: 3, dueDate: "2026-07-25", note: "Manager-role reassessment missed its window — tracked as remediation ticket SEC-2210." },
      { period: 4, dueDate: "2026-12-31" },
    ],
  },
  {
    id: "restricted-access-list-review",
    title: "Restricted-Area Access List Review",
    type: "Physical Security",
    frequency: "Quarterly",
    controls: ["PES-05"],
    procedureId: "physical-environmental-security",
    description: "Facilities and the area owner confirm the badge access list for server/network rooms still matches who actually needs to be on it.",
    instances: [
      { period: 1, dueDate: "2026-03-31", completedAt: "2026-03-25" },
      { period: 2, dueDate: "2026-06-30", completedAt: "2026-06-28" },
      { period: 3, dueDate: "2026-09-30", inProgress: true, note: "Facilities is mid-review against the current badge system export." },
      { period: 4, dueDate: "2026-12-31" },
    ],
  },
  {
    id: "external-vuln-scan",
    title: "External Vulnerability Scan",
    type: "Vulnerability Management",
    frequency: "Quarterly",
    controls: ["VPM-06"],
    procedureId: "vulnerability-patch-management",
    description: "Quarterly external scan via a reputable provider, rescanned until every High/Critical finding is resolved.",
    instances: [
      { period: 1, dueDate: "2026-02-15", completedAt: "2026-02-10" },
      { period: 2, dueDate: "2026-05-15", completedAt: "2026-05-12" },
      { period: 3, dueDate: "2026-08-20", note: "Scheduled with the external provider; scan window opens next week." },
      { period: 4, dueDate: "2026-11-20" },
    ],
  },
  {
    id: "internal-vuln-scan",
    title: "Internal Vulnerability Scan",
    type: "Vulnerability Management",
    frequency: "Quarterly",
    controls: ["VPM-06"],
    procedureId: "vulnerability-patch-management",
    description: "Quarterly internal scan covering every internal network segment, rescanned until High/Critical findings close.",
    instances: [
      { period: 1, dueDate: "2026-03-10", completedAt: "2026-03-08" },
      { period: 2, dueDate: "2026-06-10", completedAt: "2026-06-05" },
      { period: 3, dueDate: "2026-09-15" },
      { period: 4, dueDate: "2026-12-15" },
    ],
  },
  {
    id: "monitoring-signal-review",
    title: "Monitoring Signal Quality Review",
    type: "Detection & Monitoring",
    frequency: "Quarterly",
    controls: ["MON-06"],
    procedureId: "monitoring-alert-triage",
    description: "Review alert volume and false-positive rate so detection stays usable instead of becoming noise everyone tunes out.",
    instances: [
      { period: 1, dueDate: "2026-03-31", completedAt: "2026-03-30" },
      { period: 2, dueDate: "2026-06-30", completedAt: "2026-06-29" },
      { period: 3, dueDate: "2026-09-30" },
      { period: 4, dueDate: "2026-12-31" },
    ],
  },
  {
    id: "high-tier-risk-review",
    title: "High-Tier Risk Register Review",
    type: "Governance & Risk",
    frequency: "Quarterly",
    controls: ["RSK-05", "RSK-07"],
    procedureId: "control-ownership-assurance-review",
    description: "SOP-05's risk review cadence is tiered by severity — this tracks the High-tier slice, reviewed quarterly. Critical-tier is monthly; see that tab.",
    instances: [
      { period: 1, dueDate: "2026-03-31", completedAt: "2026-03-20" },
      { period: 2, dueDate: "2026-06-30", completedAt: "2026-06-24" },
      { period: 3, dueDate: "2026-09-30" },
      { period: 4, dueDate: "2026-12-31" },
    ],
  },

  // ---- Annual -------------------------------------------------------------
  {
    id: "penetration-test",
    title: "Penetration Testing",
    type: "Vulnerability Management",
    frequency: "Annual",
    controls: ["VPM-07"],
    procedureId: "vulnerability-patch-management",
    description: "A qualified third party tests production environments at least annually; findings feed the same remediation process as any other vulnerability.",
    instances: [{ period: 1, dueDate: "2026-04-30", completedAt: "2026-04-14" }],
  },
  {
    id: "ir-plan-test",
    title: "Incident Response Plan Test",
    type: "Incident Response",
    frequency: "Annual",
    controls: ["IRO-05", "IRO-06"],
    procedureId: "incident-response-procedure",
    description: "ISIRT completes incident response training and exercises the IR plan itself through a tabletop or live drill — a plan that's only ever been read isn't a tested plan.",
    instances: [{ period: 1, dueDate: "2026-06-30", completedAt: "2026-05-20" }],
  },
  {
    id: "tier1-restore-test",
    title: "Tier 1 Backup Restore Test",
    type: "Resilience & Continuity",
    frequency: "Annual",
    controls: ["BCD-04"],
    procedureId: "backup-recovery-continuity",
    description: "Restoration is tested at least annually for every Tier 1 asset — a backup that's never been restored isn't a proven backup, it's an assumption.",
    instances: [{ period: 1, dueDate: "2026-08-25", note: "Test window is booked with Infrastructure; not yet run." }],
  },
  {
    id: "security-awareness-training",
    title: "Security Awareness Training Completion",
    type: "Workforce & Awareness",
    frequency: "Annual",
    controls: ["SAT-01", "SAT-02"],
    procedureId: "hr-security-awareness",
    description: "All employees complete security awareness training at hire and annually thereafter through KnowBe4, with completion tracked, not assumed.",
    instances: [{ period: 1, dueDate: "2026-03-31", completedAt: "2026-02-28" }],
  },
  {
    id: "critical-vendor-reassessment",
    title: "Critical Vendor Reassessment",
    type: "Third-Party & Vendor",
    frequency: "Annual",
    controls: ["TPM-08"],
    procedureId: "third-party-vendor-risk",
    description: "Critical vendors are reassessed annually — a full questionnaire-plus-evidence review, not just a check-in. Standard-tier vendors run on a 2-year cycle, out of scope for this view.",
    instances: [{ period: 1, dueDate: "2026-12-31" }],
  },
];

// Every control cited here is validated against the real matched-control
// list, and every procedureId against the real procedure list — a typo or a
// stale id fails the build instead of silently pointing at nothing, the same
// discipline procedures.js already applies to its own control citations.
const CONTROL_ID_SET = new Set(CCF_VISIBLE_CONTROLS.map((c) => c.id));
export const SCHEDULED_ACTIVITIES = ACTIVITY_DEFS.map((a) => {
  const procedure = PROCEDURES.find((p) => p.id === a.procedureId);
  if (!procedure) {
    throw new Error(`scheduledActivities.js: "${a.id}" references procedureId "${a.procedureId}", which isn't in procedures.js`);
  }
  a.controls.forEach((id) => {
    if (!CONTROL_ID_SET.has(id)) {
      throw new Error(`scheduledActivities.js: "${a.id}" cites control ${id}, which isn't one of the real matched SCF controls`);
    }
  });
  if (a.instances.length !== PERIODS_PER_YEAR[a.frequency]) {
    throw new Error(`scheduledActivities.js: "${a.id}" is ${a.frequency} but has ${a.instances.length} instances, expected ${PERIODS_PER_YEAR[a.frequency]}`);
  }
  // Which frameworks this activity's controls actually map to, derived from
  // the same real SCF crosswalk every other framework badge in this app
  // reads from — never a hand-picked "this is a SOC 2 thing" label.
  const standards = getApplicableStandards(a.controls);
  const frameworkClauses = Object.fromEntries(standards.map((std) => [std, getFrameworkClauses(a.controls, std)]));
  return {
    ...a,
    owner: procedure.owner,
    procedureCode: procedure.code,
    procedureTitle: procedure.title,
    standards,
    frameworkClauses,
    instances: a.instances.map((inst) => ({ ...inst, status: deriveStatus(inst) })),
  };
});

export function activitiesForFrequency(frequency: ActivityFrequency) {
  return SCHEDULED_ACTIVITIES.filter((a) => a.frequency === frequency);
}

export function statusCountsForPeriod(frequency: ActivityFrequency, period: number): Record<ActivityStatus, number> {
  const counts: Record<ActivityStatus, number> = { completed: 0, in_progress: 0, upcoming: 0, at_risk: 0, overdue: 0 };
  activitiesForFrequency(frequency).forEach((a) => {
    const inst = a.instances.find((i) => i.period === period);
    if (inst) counts[inst.status] += 1;
  });
  return counts;
}
