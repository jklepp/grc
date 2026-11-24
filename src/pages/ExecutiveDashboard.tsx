import React, { useMemo } from "react";
import {
  AlertTriangle, ArrowRight, Building2, Cloud, LayoutDashboard, Server, ShieldCheck,
} from "lucide-react";
import { upcomingComplianceDates } from "../data/complianceMilestones";
import type { UpcomingComplianceDate } from "../data/complianceMilestones";
import { parseLocalDate } from "../data/scheduledActivities";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { useLiveEngine } from "../engine/useLiveEngine";
import type { SystemId } from "../graph/ids";
import {
  ALL_FINDINGS, COMPLIANCE_TARGET, cockpitSummary,
  getAllSystems, getEnterprise,
} from "../engine";


const OPERATIONAL_DOMAINS = new Set([
  "Security Testing", "Resilience", "Incident Response", "Vendor Assurance",
  "Identity & Access", "Vulnerability", "Exposure",
]);

type AttentionTone = "urgent" | "high" | "medium";

interface AttentionItem {
  id: string;
  priority: number;
  tone: AttentionTone;
  status: string;
  title: string;
  detail: string;
  /** "Finding", or the operational domain the cockpit raised it under. */
  source: string;
  systemName: string;
  owner?: string;
  due?: string;
  target: "data-estate";
  systemId?: SystemId;
}

// Everything this page derives, in one pass, keyed on the live engine.
//
// All of it used to sit at module scope, which cost twice over. It ran when
// the App chunk evaluated — cockpitSummary fans out to ten uncached domain
// calls per system, paid for before anyone had opened the dashboard — and it
// captured the engine's `export let` bindings at import time. publish()
// reassigns those on every commit, so a module-level snapshot kept answering
// from the first engine forever: a save would update the workspace and leave
// this page quietly stale.
//
// Escalated risks used to appear here, linking into the Risk Register. That
// page is deprecated and no longer navigable, so the rows are gone rather
// than left pointing at somewhere the user can't reach.
function useDashboardData() {
  const liveEngine = useLiveEngine();
  // liveEngine is the cache key, not an input: the barrel functions below read
  // whichever engine is currently published, and that is exactly when this
  // should recompute.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const enterprise = getEnterprise();
    const systems = getAllSystems();
    // The headline is the compliance score: every system has one. Cyber
    // Assurance is reported beside it for the HITRUST systems that carry it.
    const enterpriseCompliance = enterprise.compliance ?? 0;
    const complianceCoverage = systems.reduce(
      (acc, s) => ({
        assessed: acc.assessed + (s.complianceCoverage?.scored ?? 0),
        applicable: acc.applicable + (s.complianceCoverage?.required ?? 0),
      }),
      { assessed: 0, applicable: 0 }
    );
    const systemName = (id: SystemId) => systems.find((s) => s.id === id)?.name ?? id;

    // "Important" is a visible, deterministic FIPS 199 rule rather than a
    // hand-maintained dashboard flag. A High-impact boundary belongs here;
    // lower impact systems remain available in the System Register.
    const importantSystems = systems
      .filter((system) => system.overallImpact === "high")
      .map((system) => ({ system }))
      .sort((a, b) => (a.system.complianceScore ?? -1) - (b.system.complianceScore ?? -1));

    const findingAttention: AttentionItem[] = ALL_FINDINGS.map((finding) => {
      return {
        id: `finding:${finding.id}`,
        priority: finding.overdue ? 0 : 3,
        tone: finding.overdue ? "urgent" : "medium",
        status: finding.overdue ? "Overdue" : "Finding",
        title: finding.title,
        detail: finding.systemIds.length > 1 ? `Also affects ${finding.systemIds.slice(1).map(systemName).join(", ")}` : "",
        source: "Finding",
        systemName: systemName(finding.systemIds[0]),
        owner: finding.ownerName,
        due: finding.due,
        target: "data-estate",
        systemId: finding.systemIds[0],
      };
    });

    const operationalAttention: AttentionItem[] = systems.flatMap((system) =>
      cockpitSummary(system.id).attentionRequired
        .filter((item) => OPERATIONAL_DOMAINS.has(item.domain))
        .map((item, index) => ({
          id: `operational:${system.id}:${index}`,
          priority: item.severity === "critical" || item.severity === "high" ? 2 : 4,
          tone: item.severity === "critical" || item.severity === "high" ? "high" as const : "medium" as const,
          status: item.severity === "critical" ? "Critical" : item.severity === "high" ? "High" : "Attention",
          title: item.label,
          detail: item.detail,
          source: item.domain,
          systemName: system.name,
          target: "data-estate" as const,
          systemId: system.id,
        }))
    );

    const attentionItems = [...findingAttention, ...operationalAttention]
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

    // The same milestones the Governance Schedule's calendar draws — ISO
    // 27001, SOC 2, and vendor report dates — so the two never disagree.
    const complianceDates = upcomingComplianceDates(liveEngine.graph.systems, liveEngine.graph.providerCertifications);

    return {
      enterprise,
      systems,
      enterpriseCompliance,
      complianceGap: enterpriseCompliance - COMPLIANCE_TARGET,
      complianceCoverage,
      importantSystems,
      attentionItems,
      complianceDates,
    };
  }, [liveEngine]);
}

function attentionColors(tone: AttentionTone): { color: string; background: string } {
  if (tone === "urgent") return { color: C.red, background: C.redBg };
  if (tone === "high") return { color: C.amber, background: C.amberBg };
  return { color: C.accent, background: C.accentBg };
}

function systemStatusColor(clears: boolean): { color: string; background: string } {
  return clears
    ? { color: C.green, background: C.greenBg }
    : { color: C.red, background: C.redBg };
}

// How many compliance dates the Overview shows; the rest are on the
// Governance Schedule.
const SHOWN_COMPLIANCE_DATES = 3;
const SHOWN_ATTENTION = 8;
// A date this close reads as "act now" rather than "on the horizon".
const COMPLIANCE_SOON_DAYS = 30;

function countdown(daysUntil: number): string {
  if (daysUntil < 0) return `Overdue by ${-daysUntil} day${daysUntil === -1 ? "" : "s"}`;
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil < 60) return `In ${daysUntil} days`;
  return `In ${Math.round(daysUntil / 30)} months`;
}

function countdownColors(daysUntil: number): { color: string; background: string } {
  if (daysUntil < 0) return { color: C.red, background: C.redBg };
  if (daysUntil <= COMPLIANCE_SOON_DAYS) return { color: C.amber, background: C.amberBg };
  return { color: C.accent, background: C.accentBg };
}

// The next few ISO 27001, SOC 2, and vendor report dates, soonest first:
// a date tile, what it is, and how long is left. Deliberately small — the
// full cycle lives on the Governance Schedule, one click away.
function ComplianceDates({ dates, onNavigate }: {
  dates: UpcomingComplianceDate[]; onNavigate?: (pageId: string) => void;
}) {
  const shown = dates.slice(0, SHOWN_COMPLIANCE_DATES);
  const remaining = dates.length - shown.length;
  return (
    <section
      className="xl:col-span-2 rounded-2xl p-5 flex flex-col"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
      aria-labelledby="compliance-dates-title"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck size={17} color={C.accent} />
        <h2 id="compliance-dates-title" className="text-xl font-semibold" style={{ color: C.ink }}>Upcoming compliance dates</h2>
      </div>
      <p className="text-xs mt-1 mb-3" style={{ color: C.muted }}>ISO 27001, SOC 2, and vendor report deadlines, soonest first.</p>

      {shown.length === 0 ? (
        <div className="py-6 text-sm" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>No compliance dates are coming up.</div>
      ) : shown.map(({ entry, daysUntil }) => {
        const due = parseLocalDate(entry.dueDate);
        const tone = countdownColors(daysUntil);
        return (
          <div
            key={entry.key}
            className="flex items-center gap-3 py-2.5"
            style={{ borderTop: `1px solid ${C.border}` }}
            title={entry.note}
          >
            <div className="w-12 shrink-0 rounded-lg text-center py-1.5" style={{ background: C.accentBg, border: `1px solid ${C.accent}66` }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.accent }}>
                {due.toLocaleDateString(undefined, { month: "short" })}
              </div>
              <div className="text-xl leading-tight" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>
                {due.getDate()}
              </div>
              <div className="text-[9px]" style={{ color: C.muted }}>{due.getFullYear()}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-snug" style={{ color: C.ink }}>{entry.title}</div>
              <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{entry.type}</div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={tone}>
              {countdown(daysUntil)}
            </span>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onNavigate?.("activity-timeliness")}
        className="self-start flex items-center gap-1.5 text-xs font-semibold mt-auto pt-3 px-3 pb-2 rounded-lg wz-hover"
        style={{ color: C.accent }}
      >
        {remaining > 0 ? `${remaining} more on the Governance Schedule` : "Governance Schedule"} <ArrowRight size={13} />
      </button>
    </section>
  );
}

function formatGap(gap: number | null): string {
  if (gap == null) return "Target unavailable";
  if (gap === 0) return "At target";
  return gap > 0 ? `${gap} points above target` : `${Math.abs(gap)} points below target`;
}

export default function ExecutiveDashboard({
  onNavigate, onOpenSystem,
}: {
  onNavigate?: (pageId: string) => void;
  onOpenSystem?: (systemId: SystemId) => void;
}) {
  // Destructured to the names the markup below already uses, so this change
  // is where the values come from and nothing else.
  const {
    enterprise: ENTERPRISE,
    systems: SYSTEMS,
    enterpriseCompliance: ENTERPRISE_COMPLIANCE,
    complianceGap: COMPLIANCE_GAP,
    complianceCoverage: COMPLIANCE_COVERAGE,
    importantSystems: IMPORTANT_SYSTEMS,
    attentionItems: ATTENTION_ITEMS,
    complianceDates: COMPLIANCE_DATES,
  } = useDashboardData();

  const coverage = {
    ...COMPLIANCE_COVERAGE,
    assessedPct: COMPLIANCE_COVERAGE.applicable === 0 ? 0 : Math.round((COMPLIANCE_COVERAGE.assessed / COMPLIANCE_COVERAGE.applicable) * 100),
  };
  const shownAttention = ATTENTION_ITEMS.slice(0, SHOWN_ATTENTION);
  const attentionCounts = [
    { label: "Overdue findings", value: ATTENTION_ITEMS.filter((i) => i.status === "Overdue").length, tone: "urgent" as const },
    { label: "Critical / high operational", value: ATTENTION_ITEMS.filter((i) => i.tone === "high").length, tone: "high" as const },
    { label: "Systems affected", value: new Set(ATTENTION_ITEMS.map((i) => i.systemName)).size, tone: null },
  ];
  const remainingAttention = Math.max(0, ATTENTION_ITEMS.length - shownAttention.length);
  const lastSynced = SYSTEMS[0]?.lastSynced ?? "live";

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={LayoutDashboard}
        title="Enterprise Overview"
        description="The posture of ACME's most important systems and the work that needs attention."
        right={(
          <div className="text-xs px-3 py-2 rounded-lg" style={{ color: C.muted, background: C.panel, border: `1px solid ${C.border}` }}>
            Updated {lastSynced}
          </div>
        )}
      />

      {/* The score and the coverage behind it stay adjacent but distinct. */}
      <div className="px-4 lg:px-8">
        <section
          className="rounded-2xl p-7 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8 items-center"
          style={{ background: C.panel, color: C.ink, border: `1px solid ${C.border}` }}
          aria-labelledby="enterprise-compliance-title"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold" style={{ color: C.accent }} id="enterprise-compliance-title">
              Enterprise Compliance
            </div>
            <div className="text-5xl font-semibold mt-1" style={{ fontFamily: "'Source Serif 4', serif" }}>
              {ENTERPRISE_COMPLIANCE}%
            </div>
            <div className="text-sm mt-2" style={{ color: C.muted }}>
              {COMPLIANCE_GAP >= 0
                ? `${COMPLIANCE_GAP} points above the ${COMPLIANCE_TARGET}% target`
                : `${Math.abs(COMPLIANCE_GAP)} points below the ${COMPLIANCE_TARGET}% target`}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: C.muted }}>
              <span>Assessed controls met, weighted by system impact</span>
              <span>Target {COMPLIANCE_TARGET}%</span>
            </div>
            <div className="h-2.5 rounded-full relative" style={{ background: C.panel2 }}>
              <div className="h-full rounded-full" style={{ width: `${ENTERPRISE_COMPLIANCE}%`, background: C.accent }} />
              <span
                className="absolute w-0.5 h-5 -top-[5px]"
                style={{ left: `${COMPLIANCE_TARGET}%`, background: C.ink }}
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5">
              <div className="pr-8" style={{ borderRight: ENTERPRISE.assurance != null ? `1px solid ${C.border}` : undefined }}>
                <div className="text-xl font-semibold">{coverage.assessedPct}%</div>
                <div className="text-xs" style={{ color: C.muted }}>Assessment coverage · {coverage.assessed} of {coverage.applicable}</div>
              </div>
              {ENTERPRISE.assurance != null && (
                <div>
                  <div className="text-xl font-semibold">{ENTERPRISE.assurance}%</div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    Cyber Assurance · {ENTERPRISE.cyberAssuranceSystemCount} HITRUST system{ENTERPRISE.cyberAssuranceSystemCount === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="px-4 lg:px-8 pt-8 pb-8 grid grid-cols-1 xl:grid-cols-5 gap-8">
        <section
          className="xl:col-span-3 rounded-2xl p-5 flex flex-col"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}
          aria-labelledby="important-systems-title"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 id="important-systems-title" className="text-xl font-semibold" style={{ color: C.ink }}>Important systems</h2>
              <p className="text-xs mt-1" style={{ color: C.muted }}>High FIPS-impact boundaries, ordered by lowest compliance.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: C.accent, background: C.accentBg }}>
              {IMPORTANT_SYSTEMS.length} high impact
            </span>
          </div>

          <div className="mt-3">
            {IMPORTANT_SYSTEMS.length === 0 ? (
              <div className="py-8 text-sm" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
                No High-impact systems are currently registered.
              </div>
            ) : IMPORTANT_SYSTEMS.map(({ system }) => {
              const score = system.complianceScore;
              const gap = score == null ? null : score - COMPLIANCE_TARGET;
              const clears = score != null && score >= COMPLIANCE_TARGET;
              const status = systemStatusColor(clears);
              const SystemIcon = system.hostingType === "cloud" ? Cloud : Building2;
              return (
                <button
                  key={system.id}
                  type="button"
                  onClick={() => onOpenSystem ? onOpenSystem(system.id) : onNavigate?.("data-estate")}
                  className="w-full text-left flex items-center gap-4 py-4 wz-hover transition-colors"
                  style={{ borderTop: `1px solid ${C.border}` }}
                  aria-label={`Open ${system.name} in Systems`}
                >
                  <span className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ color: C.accent, background: C.accentBg }}>
                    <SystemIcon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block" style={{ color: C.ink }}>{system.name}</span>
                    <span className="text-xs block mt-0.5" style={{ color: C.muted }}>
                      {system.classification} · {system.provider}
                      {system.overallAssurance != null && ` · Cyber Assurance ${system.overallAssurance}%`}
                    </span>
                  </span>
                  <span className="hidden sm:flex items-center gap-2 w-36 shrink-0">
                    <span className="h-2 rounded-full overflow-hidden flex-1" style={{ background: C.panel2 }}>
                      <span className="h-full rounded-full block" style={{ width: `${score ?? 0}%`, background: C.accent }} />
                    </span>
                    <span className="text-sm font-semibold w-9 text-right" style={{ color: C.ink }}>{score == null ? "—" : `${score}%`}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={status}>
                      {clears ? "On target" : "Needs attention"}
                    </span>
                    <span className="text-[10px] block mt-1" style={{ color: C.muted }}>{formatGap(gap)}</span>
                  </span>
                  <ArrowRight size={15} color={C.muted} className="shrink-0" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.("data-estate")}
            className="self-start flex items-center gap-1.5 text-xs font-semibold mt-auto pt-3 px-3 pb-2 rounded-lg wz-hover"
            style={{ color: C.accent }}
          >
            View all systems <ArrowRight size={13} />
          </button>
        </section>

        <ComplianceDates dates={COMPLIANCE_DATES} onNavigate={onNavigate} />
      </div>

      <div className="px-4 lg:px-8 pb-8">
        <section
          className="rounded-2xl p-5"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}
          aria-labelledby="attention-title"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} color={C.red} />
              <h2 id="attention-title" className="text-xl font-semibold" style={{ color: C.ink }}>Needs attention</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: C.accent, background: C.accentBg }}>
              {ATTENTION_ITEMS.length} priority items
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: C.muted }}>Highest-impact work across findings and operations, most urgent first.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 mb-4">
            {attentionCounts.map((c) => {
              const tone = c.tone ? attentionColors(c.tone) : null;
              return (
                <div key={c.label} className="rounded-xl px-4 py-3" style={{ background: C.panel2 }}>
                  <div className="text-2xl font-semibold" style={{ color: c.value > 0 && tone ? tone.color : C.ink, fontFamily: "'Source Serif 4', serif" }}>{c.value}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{c.label}</div>
                </div>
              );
            })}
          </div>

          {shownAttention.length > 0 && (
            <div className="hidden lg:grid grid-cols-[110px_minmax(0,1fr)_150px_200px_150px_15px] gap-4 pb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
              <span>Status</span><span>Item</span><span>Source</span><span>System</span><span>Owner · Due</span><span />
            </div>
          )}

          {shownAttention.length === 0 ? (
            <div className="py-8 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
              <ShieldCheck size={22} color={C.green} className="mx-auto mb-2" />
              <div className="text-sm font-semibold" style={{ color: C.ink }}>Nothing requires immediate attention</div>
            </div>
          ) : shownAttention.map((item) => {
            const tone = attentionColors(item.tone);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => item.systemId && onOpenSystem ? onOpenSystem(item.systemId) : onNavigate?.(item.target)}
                className="w-full text-left grid grid-cols-[110px_minmax(0,1fr)_15px] lg:grid-cols-[110px_minmax(0,1fr)_150px_200px_150px_15px] gap-4 items-center py-3 wz-hover transition-colors"
                style={{ borderTop: `1px solid ${C.border}` }}
              >
                <span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ color: tone.color, background: tone.background }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.color }} aria-hidden="true" />
                    {item.status}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="text-sm font-semibold leading-snug block truncate" style={{ color: C.ink }}>{item.title}</span>
                  {item.detail && <span className="text-xs mt-0.5 block truncate" style={{ color: C.muted }}>{item.detail}</span>}
                  <span className="lg:hidden text-xs mt-0.5 block" style={{ color: C.muted }}>
                    {[item.source, item.systemName, item.owner, item.due && `due ${item.due}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="hidden lg:block text-xs truncate" style={{ color: C.muted }}>{item.source}</span>
                <span className="hidden lg:block text-xs truncate" style={{ color: C.ink }}>{item.systemName}</span>
                <span className="hidden lg:block text-xs min-w-0">
                  <span className="block truncate" style={{ color: C.ink }}>{item.owner ?? "—"}</span>
                  {item.due && <span className="block text-[11px]" style={{ color: C.muted }}>due {item.due}</span>}
                </span>
                <ArrowRight size={15} color={C.muted} />
              </button>
            );
          })}

          {remainingAttention > 0 && (
            <div className="text-[11px] pt-3" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
              +{remainingAttention} more priority item{remainingAttention === 1 ? "" : "s"} available in Systems.
            </div>
          )}
        </section>
      </div>

      <div className="mx-4 lg:mx-8 mb-8 px-4 py-3 rounded-lg flex items-start gap-2 text-[11px]" style={{ color: C.muted, background: C.panel2 }}>
        <Server size={13} className="shrink-0 mt-0.5" />
        <span>Assurance measures assessed control strength. Assessment coverage is reported separately and is never treated as part of the assurance score.</span>
      </div>
    </div>
  );
}
