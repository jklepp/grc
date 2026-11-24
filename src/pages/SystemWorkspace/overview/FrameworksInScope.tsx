import React, { useMemo } from "react";
import { Award, BookOpen, ShieldCheck } from "lucide-react";
import { C } from "../../../theme";
import { useLiveEngine } from "../../../engine/useLiveEngine";
import { HITRUST_R2_STANDARD } from "../../../graph/nodes/providerCertifications";
import { FRAMEWORKS } from "../../../graph/nodes/controls";
import { AUDIT_TYPE_LABELS, CERTIFICATION_KIND_LABELS } from "../../../graph/nodes/engagements";
import { upcomingComplianceDates } from "../../../data/complianceMilestones";
import type { SystemId } from "../../../graph/ids";
import type { WorkspaceSystem } from "../types";
import { SectionHeader } from "../shared/SectionHeader";
import { Badge, CELL, cellDivider } from "../shared/ControlTable";
import { TableHeaderCell } from "../shared/TableHeaderCell";

// The frameworks a system is in scope for: how many of its controls each one
// maps, where the system stands against it (certified, in audit, or neither),
// and the next dates that matter — an audit's due date, a certificate's
// expiry, the compliance calendar's next milestone — with how far away each is.
//
// Sources, nothing typed here: certifications.yaml (what ACME holds and which
// systems it covers), engagements.yaml (open audits), and the compliance
// calendar (src/data/complianceMilestones.ts) for the program milestones.

const DAY = 86_400_000;
const CALENDAR_KEY: Record<string, string> = { "ISO 27001": "iso-27001:", "SOC 2": "soc-2:" };

const themed = (key: "accent" | "ink" | "muted" | "green" | "amber" | "red") => ({
  get color() { return key === "ink" ? C.ink : C[key]; },
  get bg() { return key === "ink" || key === "muted" ? C.panel2 : C[`${key}Bg` as "greenBg"]; },
});

// "certificate" reads as a common noun mid-sentence; "Type II report" keeps its capitals.
const kindNoun = (kind: keyof typeof CERTIFICATION_KIND_LABELS) => (kind === "certificate" || kind === "audit-report" ? CERTIFICATION_KIND_LABELS[kind].toLowerCase() : CERTIFICATION_KIND_LABELS[kind]);

// Status word for a current certificate/report. HIPAA has no certification,
// so a completed annual audit reads "Audited", never "Certified".
const heldLabel = (kind: keyof typeof CERTIFICATION_KIND_LABELS) => (kind === "certificate" ? "Certified" : kind === "audit-report" ? "Audited" : "Report current");

interface Action { label: string; kind: string; date: string; days: number }

// "ISO 27001 Recertification 2026" -> "Recertification"; "SOC 2 Observation
// Period Closes (FY2026)" -> "Observation period closes". The row already
// names the framework, and the chip's date says which year.
function shortName(title: string, std: string): string {
  const words = title.replace(std, "").replace(/\s+/g, " ").trim().split(" ");
  // Sentence case, but acronyms (II, SOC, RTO) keep their capitals.
  return words.map((w, i) => (i === 0 || w === w.toUpperCase() ? w : w.toLowerCase())).join(" ");
}

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const urgency = (days: number) => (days <= 0 ? "red" : days <= 30 ? "amber" : "muted") as "red" | "amber" | "muted";

export function FrameworksInScope({ system }: { system: WorkspaceSystem }) {
  const engine = useLiveEngine();
  const systemId = system.id as SystemId;
  const graph = engine.graph;
  const now = engine.ctx.now;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysTo = (date: string) => Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00`) - today) / DAY);

  const applicable = useMemo(() => engine.applicability.applicableControlsForSystem(systemId), [engine, systemId]);
  const calendar = useMemo(() => upcomingComplianceDates(graph.systems, graph.providerCertifications, now), [graph, now]);
  const mapped = new Set<string>(FRAMEWORKS);

  const rows = system.standards.map((std) => {
    const hitrust = std === HITRUST_R2_STANDARD;
    const count = applicable.filter((c) => c.frameworks.some((f) => f.standard === std)).length;
    const certs = graph.certifications
      .filter((c) => c.standard === std && Date.parse(c.validUntil) >= today)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    const cert = certs.find((c) => c.systemIds.includes(systemId)) ?? null;
    const certElsewhere = !cert ? certs[0] ?? null : null;
    const audits = graph.engagements.filter((e) => e.status !== "closed" && e.systemIds.includes(systemId) && e.frameworks.includes(std));

    const actions: Action[] = [
      ...audits.map((e) => ({ label: `${e.name} due`, kind: `Audit · ${AUDIT_TYPE_LABELS[e.auditType].replace(/ (audit|examination|assessment)$/, "")}`, date: e.dueDate, days: daysTo(e.dueDate) })),
      ...(cert ? [{
        label: cert.kind === "certificate" ? "Current certificate expires" : cert.kind === "audit-report" ? "Next annual audit due" : `Next ${CERTIFICATION_KIND_LABELS[cert.kind]} due`,
        kind: cert.kind === "certificate" ? "Certificate" : cert.kind === "audit-report" ? "Audit" : "Report",
        date: cert.validUntil, days: daysTo(cert.validUntil),
      }] : []),
      ...calendar
        .filter((u) => CALENDAR_KEY[std] && u.entry.key.startsWith(CALENDAR_KEY[std]))
        // An audit already listed covers the calendar's entry for the same day.
        .filter((u) => !audits.some((e) => e.dueDate === u.entry.dueDate))
        // The calendar also carries certificate and report dates; label them as such.
        .map((u) => ({
          label: shortName(u.entry.title, std).replace(/^Certificate expires$/, "Current certificate expires"),
          kind: /certificate/i.test(u.entry.title) ? "Certificate" : /report issued|bridge letter/i.test(u.entry.title) ? "Report" : "Milestone",
          date: u.entry.dueDate, days: u.daysUntil,
        })),
    ]
      // One item per date. Sources are listed most specific first — the audit,
      // then ACME's own certificate or report, then the calendar — so where two
      // describe the same day (an audit that is the report's due date, a
      // certificate expiry the calendar also carries) the specific one stays.
      .filter((a, i, all) => all.findIndex((b) => b.date === a.date) === i)
      .sort((a, b) => a.days - b.days);

    const status = hitrust
      ? { label: "Cyber Assurance", ...themed("accent"), note: "Graded on all five PRISMA levels; no validated assessment on record yet." }
      : cert
        ? { label: heldLabel(cert.kind), ...themed("green"), note: `${CERTIFICATION_KIND_LABELS[cert.kind]} from ${cert.auditFirm}, valid until ${cert.validUntil}.` }
        : audits.length
          ? { label: "In audit", ...themed("accent"), note: certElsewhere ? `Not yet covered by the current ${std} ${kindNoun(certElsewhere.kind)}; joins its scope with ${audits[0].name}.` : `First audit under way: ${audits[0].name}.` }
          : std === "HIPAA"
            ? { label: "No certification", ...themed("muted"), note: "HIPAA has no certification; compliance rests on the risk analysis and documentation." }
            : { label: "Not certified", ...themed("muted"), note: certElsewhere ? `The current ${std} ${kindNoun(certElsewhere.kind)} does not cover this system.` : "No certificate, report or open audit on record." };

    return { std, hitrust, count, isMapped: mapped.has(std), status, actions };
  });

  // One row per dated item, grouped under its framework; a framework with
  // nothing dated still gets a row so its status is visible.
  const lines = rows.flatMap((r) => (r.actions.length ? r.actions : [null]).map((a, i) => ({ r, a, first: i === 0, last: i === Math.max(r.actions.length, 1) - 1 })));

  return (
    <div>
      <SectionHeader
        icon={Award}
        title="Framework Compliance"
        description="Where this system stands against each framework it is in scope for, and every dated item coming up."
      />
      <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-left text-xs" style={{ minWidth: 820, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead className="text-[10px] font-semibold uppercase tracking-wide">
            <tr>
              <TableHeaderCell label="FRAMEWORK" first width={170} />
              <TableHeaderCell label="STATUS" width={150} />
              <TableHeaderCell label="ITEM" />
              <TableHeaderCell label="KIND" width={190} />
              <TableHeaderCell label="DUE" width={120} />
              <TableHeaderCell label="DAYS AWAY" align="right" width={110} last />
            </tr>
          </thead>
          <tbody>
            {lines.map(({ r, a, first, last }) => {
              const divider = last ? cellDivider() : {};
              const tone = a ? themed(urgency(a.days)) : null;
              return (
                <tr key={`${r.std}-${a?.label ?? "none"}-${a?.date ?? ""}`}>
                  <td className={`${CELL} pl-4 pr-3 align-top`} style={divider}>
                    {first && (
                      <div>
                        <div className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: C.ink }}>
                          {r.hitrust ? <ShieldCheck size={13} color={C.accent} /> : <BookOpen size={13} color={C.muted} />} {r.std}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                          {r.hitrust ? "All controls, five levels" : r.isMapped ? `${r.count} controls mapped` : "Not mapped in the catalog"}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={`${CELL} px-3 align-top`} style={divider}>
                    {first && <Badge meta={r.status} title={r.status.note} />}
                  </td>
                  <td className={`${CELL} px-3 text-[13px]`} style={{ ...cellDivider(), color: a ? C.ink : C.muted }}>
                    {a ? a.label : "Nothing scheduled"}
                  </td>
                  <td className={`${CELL} px-3 text-[12px]`} style={{ ...cellDivider(), color: C.muted }}>{a?.kind ?? "—"}</td>
                  <td className={`${CELL} px-3 text-[12px] tabular-nums whitespace-nowrap`} style={{ ...cellDivider(), color: C.ink }}>{a ? shortDate(a.date) : "—"}</td>
                  <td className={`${CELL} pl-3 pr-4 text-right`} style={cellDivider()}>
                    {a && tone ? (
                      <span className="inline-flex text-[11px] font-semibold px-2 py-0.5 rounded tabular-nums" style={{ color: tone.color, background: tone.bg }}>
                        {a.days < 0 ? `${-a.days} days overdue` : a.days === 0 ? "Today" : `${a.days} day${a.days === 1 ? "" : "s"}`}
                      </span>
                    ) : <span style={{ color: C.muted }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
