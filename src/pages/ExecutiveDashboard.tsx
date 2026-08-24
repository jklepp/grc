import React from "react";
import {
  AlertTriangle, ArrowRight, Building2, Cloud, LayoutDashboard, Server, ShieldCheck,
} from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import type { SystemId } from "../graph/ids";
import {
  ALL_FINDINGS, ASSURANCE_TARGET, MATERIAL_RISKS, cockpitSummary,
  getAllSystems, getEnterprise, profileSummary,
} from "../engine";

const ENTERPRISE = getEnterprise();
const SYSTEMS = getAllSystems();
const ENTERPRISE_ASSURANCE = ENTERPRISE.assurance ?? 0;
const ASSURANCE_GAP = ENTERPRISE_ASSURANCE - ASSURANCE_TARGET;
const MATERIAL_RISK_IDS = new Set(MATERIAL_RISKS.map((risk) => risk.id));

const SYSTEM_PROFILES = SYSTEMS.map((system) => ({
  system,
  profile: profileSummary(system.id),
}));

// "Important" is a visible, deterministic FIPS 199 rule rather than a
// hand-maintained dashboard flag. A High-impact boundary belongs here; lower
// impact systems remain available in the System Register.
const IMPORTANT_SYSTEMS = SYSTEM_PROFILES
  .filter(({ system }) => system.overallImpact === "high")
  .sort((a, b) => (a.system.overallAssurance ?? -1) - (b.system.overallAssurance ?? -1));

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
  target: "data-estate";
  systemId?: SystemId;
}

const FINDING_ATTENTION: AttentionItem[] = ALL_FINDINGS.map((finding) => {
  const material = finding.riskIds.some((id) => MATERIAL_RISK_IDS.has(id));
  return {
    id: `finding:${finding.id}`,
    priority: finding.overdue ? 0 : material ? 1 : 3,
    tone: finding.overdue || material ? "urgent" : "medium",
    status: finding.overdue ? "Overdue" : material ? "Material risk" : "Finding",
    title: finding.title,
    detail: `${finding.systemIds.join(", ")} · ${finding.ownerName} · due ${finding.due}`,
    target: "data-estate",
    systemId: finding.systemIds[0],
  };
});

// Escalated risks used to appear here, linking into the Risk Register. That
// page is deprecated and no longer navigable, so the rows are gone rather than
// left pointing at somewhere the user can't reach.

const OPERATIONAL_ATTENTION: AttentionItem[] = SYSTEMS.flatMap((system) =>
  cockpitSummary(system.id).attentionRequired
    .filter((item) => OPERATIONAL_DOMAINS.has(item.domain))
    .map((item, index) => ({
      id: `operational:${system.id}:${index}`,
      priority: item.severity === "critical" || item.severity === "high" ? 2 : 4,
      tone: item.severity === "critical" || item.severity === "high" ? "high" as const : "medium" as const,
      status: item.severity === "critical" ? "Critical" : item.severity === "high" ? "High" : "Attention",
      title: item.label,
      detail: `${system.name} · ${item.detail}`,
      target: "data-estate" as const,
      systemId: system.id,
    }))
);

const ATTENTION_ITEMS = [
  ...FINDING_ATTENTION,
  ...OPERATIONAL_ATTENTION,
].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

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
  const coverage = ENTERPRISE.coverage;
  const shownAttention = ATTENTION_ITEMS.slice(0, 5);
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
      <div className="px-8">
        <section
          className="rounded-2xl p-7 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8 items-center"
          style={{ background: C.panel, color: C.ink, border: `1px solid ${C.border}` }}
          aria-labelledby="enterprise-assurance-title"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold" style={{ color: C.accent }} id="enterprise-assurance-title">
              Enterprise Assurance
            </div>
            <div className="text-5xl font-semibold mt-1" style={{ fontFamily: "'Source Serif 4', serif" }}>
              {ENTERPRISE_ASSURANCE}%
            </div>
            <div className="text-sm mt-2" style={{ color: C.muted }}>
              {ASSURANCE_GAP >= 0
                ? `${ASSURANCE_GAP} points above the ${ASSURANCE_TARGET}% target`
                : `${Math.abs(ASSURANCE_GAP)} points below the ${ASSURANCE_TARGET}% target`}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: C.muted }}>
              <span>Current assurance</span>
              <span>Target {ASSURANCE_TARGET}%</span>
            </div>
            <div className="h-2.5 rounded-full relative" style={{ background: C.panel2 }}>
              <div className="h-full rounded-full" style={{ width: `${ENTERPRISE_ASSURANCE}%`, background: C.accent }} />
              <span
                className="absolute w-0.5 h-5 -top-[5px]"
                style={{ left: `${ASSURANCE_TARGET}%`, background: C.ink }}
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5">
              <div className="pr-8" style={{ borderRight: `1px solid ${C.border}` }}>
                <div className="text-xl font-semibold">{coverage.assessedPct}%</div>
                <div className="text-xs" style={{ color: C.muted }}>Assessment coverage · {coverage.assessed} of {coverage.applicable}</div>
              </div>
              <div>
                <div className="text-xl font-semibold">{MATERIAL_RISKS.length}</div>
                <div className="text-xs" style={{ color: C.muted }}>Material risks above appetite</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="px-8 pt-8 pb-8 grid grid-cols-1 xl:grid-cols-5 gap-8 items-start">
        <section
          className="xl:col-span-3 rounded-2xl p-5"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}
          aria-labelledby="important-systems-title"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 id="important-systems-title" className="text-xl font-semibold" style={{ color: C.ink }}>Important systems</h2>
              <p className="text-xs mt-1" style={{ color: C.muted }}>High FIPS-impact boundaries, ordered by lowest assurance.</p>
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
            ) : IMPORTANT_SYSTEMS.map(({ system, profile }) => {
              const score = system.overallAssurance;
              const target = profile?.target ?? null;
              const gap = score == null || target == null ? null : score - target;
              const clears = Boolean(profile?.clears);
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
                    <span className="text-xs block mt-0.5" style={{ color: C.muted }}>{system.classification} · {system.provider}</span>
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
            className="flex items-center gap-1.5 text-xs font-semibold mt-3 px-3 py-2 rounded-lg wz-hover"
            style={{ color: C.accent }}
          >
            View all systems <ArrowRight size={13} />
          </button>
        </section>

        <section
          className="xl:col-span-2 rounded-2xl p-5"
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
          <p className="text-xs mt-1 mb-3" style={{ color: C.muted }}>Highest-impact work across findings and operations.</p>

          {shownAttention.length === 0 ? (
            <div className="py-8 text-center">
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
                className="w-full text-left flex items-start gap-3 py-3.5 wz-hover transition-colors"
                style={{ borderTop: `1px solid ${C.border}` }}
              >
                <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: tone.color }} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold leading-snug block" style={{ color: C.ink }}>{item.title}</span>
                  <span className="text-xs mt-1 block" style={{ color: C.muted }}>{item.detail}</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ color: tone.color, background: tone.background }}>
                  {item.status}
                </span>
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

      <div className="mx-8 mb-8 px-4 py-3 rounded-lg flex items-start gap-2 text-[11px]" style={{ color: C.muted, background: C.panel2 }}>
        <Server size={13} className="shrink-0 mt-0.5" />
        <span>Assurance measures assessed control strength. Assessment coverage is reported separately and is never treated as part of the assurance score.</span>
      </div>
    </div>
  );
}
