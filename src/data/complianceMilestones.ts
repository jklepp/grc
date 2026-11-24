// Compliance milestones for the Governance Schedule's calendar: the dates a
// certificate or report ACME relies on has to be renewed by, next to the
// recurring activities in scheduledActivities.ts.
//
// Two sources, deliberately different in how much is authored:
//
//  - ACME's own programs: the ISO 27001 certificate and the SOC 2 Type II
//    report. Each is ACME-wide — one certificate, one report — and its
//    systems in scope are the ones whose `standards` list that standard. This
//    app has no record of either anywhere else, so both cycles below are
//    ILLUSTRATIVE seed data for the demo company — the same convention as
//    scheduledActivities.ts's completion dates.
//
//  - Vendor report expiries. Nothing authored here: each date is derived from
//    provider-certifications.yaml's issuedAt + validForDays, by the same rule
//    engine/assessment.ts's certificationExpired() scores inheritance with
//    (a report is current through issuedAt + validForDays). A later report
//    from the same provider for the same standard marks the earlier one
//    renewed.
//
// Status is never hand-typed: deriveStatus() computes it from each due date
// against today, exactly as it does for activities.
import { deriveStatus, parseLocalDate } from "./scheduledActivities";
import type { ScheduleCalendarEntry } from "./scheduledActivities";
import type { ProviderCertification } from "../graph/nodes/providerCertifications";
import type { System } from "../graph/nodes/systems";

const COMPLIANCE_OWNER = "Security & Compliance Team";
const VENDOR_OWNER = "Procurement / Security & Compliance Team";
const DAY_MS = 86_400_000;

// ---- ACME's own programs (illustrative) ---------------------------------

interface ProgramMilestone {
  id: string;
  title: string;
  dueDate: string;
  completedAt?: string;
  note: string;
}

interface ProgramCycle {
  key: string;
  // Matched against each system's `standards` to name the scope.
  standard: string;
  type: string;
  cadence: string;
  milestones: ProgramMilestone[];
}

// The current three-year certificate, issued 22 January 2024. Surveillance
// audits run in years one and two; the recertification audit has to close
// before the expiry date or the certificate lapses.
const ISO_27001_CYCLE: ProgramCycle = {
  key: "iso-27001",
  standard: "ISO 27001",
  type: "ISO 27001 certification",
  cadence: "3-year cycle",
  milestones: [
    {
      id: "surveillance-2",
      title: "ISO 27001 Surveillance Audit (Year 2)",
      dueDate: "2026-01-30",
      completedAt: "2026-01-27",
      note: "Second surveillance audit of the 2024–2027 certificate. Closed with two minor nonconformities, both remediated.",
    },
    {
      id: "recertification-audit",
      title: "ISO 27001 Recertification Audit",
      dueDate: "2026-12-11",
      note: "Stage 2 recertification audit for the next three-year certificate. It has to close before the current certificate expires on 21 January 2027.",
    },
    {
      id: "certificate-expiry",
      title: "ISO 27001 Certificate Expires",
      dueDate: "2027-01-21",
      note: "The 2024–2027 certificate lapses on this date unless the recertification audit has closed and the new certificate is issued.",
    },
  ],
};

// A calendar-year Type II report: the observation period runs 1 January to
// 31 December, the auditor's report follows by the end of February, and a
// bridge letter covers customers across the gap in between.
const SOC_2_CYCLE: ProgramCycle = {
  key: "soc-2",
  standard: "SOC 2",
  type: "SOC 2 Type II report",
  cadence: "Annual · calendar-year period",
  milestones: [
    {
      id: "bridge-letter-fy2025",
      title: "SOC 2 Bridge Letter (FY2025)",
      dueDate: "2026-01-15",
      completedAt: "2026-01-12",
      note: "Management's letter covering 1 January 2026 until the FY2025 report is issued, for customers who need assurance across the gap.",
    },
    {
      id: "report-fy2025",
      title: "SOC 2 Type II Report Issued (FY2025)",
      dueDate: "2026-02-27",
      completedAt: "2026-02-20",
      note: "Covers 1 January – 31 December 2025. Unqualified opinion; three exceptions noted, each with a management response.",
    },
    {
      id: "period-close-fy2026",
      title: "SOC 2 Observation Period Closes (FY2026)",
      dueDate: "2026-12-31",
      note: "Last day of the FY2026 Type II period. Controls have to keep operating through it; the auditor's evidence requests for fieldwork follow in January.",
    },
    {
      id: "bridge-letter-fy2026",
      title: "SOC 2 Bridge Letter (FY2026)",
      dueDate: "2027-01-15",
      note: "Covers 1 January 2027 until the FY2026 report is issued.",
    },
    {
      id: "report-fy2026",
      title: "SOC 2 Type II Report Issued (FY2026)",
      dueDate: "2027-02-26",
      note: "The FY2026 report is due to customers by this date. Until then the FY2025 report, with the bridge letter, is the current one.",
    },
  ],
};

const PROGRAM_CYCLES = [ISO_27001_CYCLE, SOC_2_CYCLE];

function programEntries(cycle: ProgramCycle, systems: readonly System[]): ScheduleCalendarEntry[] {
  const inScope = systems.filter((s) => s.standards.includes(cycle.standard)).map((s) => s.name);
  const scope = inScope.length === 1 ? "1 system in scope" : `${inScope.length} systems in scope`;
  return cycle.milestones.map((m) => ({
    key: `${cycle.key}:${m.id}`,
    kind: "milestone" as const,
    title: m.title,
    type: cycle.type,
    standard: cycle.standard,
    cadence: `${cycle.cadence} · ACME-wide · ${scope}`,
    owner: COMPLIANCE_OWNER,
    dueDate: m.dueDate,
    completedAt: m.completedAt,
    status: deriveStatus(m),
    note: `${m.note}${inScope.length ? ` In scope: ${inScope.join(", ")}.` : ""}`,
  }));
}

// ---- Vendor report expiries (derived) -----------------------------------

function isoDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

// The last day a report is current: issuedAt + validForDays.
function reportValidThrough(cert: ProviderCertification): string {
  return isoDay(new Date(parseLocalDate(cert.issuedAt).getTime() + cert.validForDays * DAY_MS));
}

function reportLabel(cert: ProviderCertification): string {
  const type = cert.reportType === "type-2" ? " Type II" : cert.reportType === "type-1" ? " Type I" : "";
  return `${cert.standard}${type}`;
}

function vendorReportEntries(certs: readonly ProviderCertification[]): ScheduleCalendarEntry[] {
  return certs.map((cert) => {
    const dueDate = reportValidThrough(cert);
    // Renewed if the same provider has issued a later report for the same
    // standard by the time this one runs out.
    const renewal = certs
      .filter((c) => c.provider === cert.provider && c.standard === cert.standard && c.issuedAt > cert.issuedAt && c.issuedAt <= dueDate)
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))[0];
    const label = reportLabel(cert);
    return {
      key: `vendor-report:${cert.id}`,
      kind: "milestone" as const,
      title: `${cert.provider} ${label} Report Expires`,
      type: "Vendor report",
      cadence: `${cert.provider} · ${label} · covers ${cert.domains.join(", ")}`,
      owner: VENDOR_OWNER,
      dueDate,
      completedAt: renewal?.issuedAt,
      status: deriveStatus({ dueDate, completedAt: renewal?.issuedAt }),
      note: renewal
        ? `Replaced by ${renewal.id}, issued ${renewal.issuedAt}.`
        : `Issued ${cert.issuedAt}, current for ${cert.validForDays} days. Request the next report from ${cert.provider} before then.`,
    };
  });
}

// Every compliance milestone, in due-date order.
export function complianceCalendarEntries(
  systems: readonly System[],
  providerCertifications: readonly ProviderCertification[],
): ScheduleCalendarEntry[] {
  return [...PROGRAM_CYCLES.flatMap((c) => programEntries(c, systems)), ...vendorReportEntries(providerCertifications)]
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.title.localeCompare(y.title));
}

// The compliance dates still ahead (or missed), soonest first, each with the
// days left until it — what the Overview's "Upcoming compliance dates" strip
// leads with. Completed milestones drop out; overdue ones stay, at the front,
// with a negative count.
export interface UpcomingComplianceDate {
  entry: ScheduleCalendarEntry;
  daysUntil: number;
}

export function upcomingComplianceDates(
  systems: readonly System[],
  providerCertifications: readonly ProviderCertification[],
  today = new Date(),
): UpcomingComplianceDate[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return complianceCalendarEntries(systems, providerCertifications)
    .filter((entry) => entry.status !== "completed")
    .map((entry) => ({ entry, daysUntil: Math.round((parseLocalDate(entry.dueDate).getTime() - start) / DAY_MS) }));
}
