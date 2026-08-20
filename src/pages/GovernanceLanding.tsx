import React from "react";
import { ArrowRight, AlertTriangle, CheckCircle2, Landmark } from "lucide-react";
import { PageHeader } from "../components/Headings";
import { C } from "../theme";
import { POLICIES, POLICY_TIERS } from "../data/policies";
import { PROCEDURES } from "../data/procedures";
import { PRINCIPLE_STATUS_COUNTS } from "../data/securityPrinciples";
import { FREQUENCIES, currentPeriod, statusCountsForPeriod } from "../data/scheduledActivities";
import { EXCEPTION_SUMMARY } from "../engine";
import { GOVERNANCE_AREAS } from "./governanceAreas";
import type { GovernanceAreaId } from "./governanceAreas";

interface AreaMetric {
  value: number;
  label: string;
  tone?: "default" | "good" | "attention";
}

interface AreaSummary {
  metrics: AreaMetric[];
  attention: number;
  attentionLabel: string;
}

const scheduleCounts = FREQUENCIES.reduce(
  (totals, frequency) => {
    const counts = statusCountsForPeriod(frequency, currentPeriod(frequency));
    totals.completed += counts.completed;
    totals.upcoming += counts.upcoming + counts.in_progress;
    totals.attention += counts.at_risk + counts.overdue;
    return totals;
  },
  { completed: 0, upcoming: 0, attention: 0 },
);

const AREA_SUMMARIES: Record<GovernanceAreaId, AreaSummary> = {
  policy: {
    metrics: [
      { value: POLICIES.length, label: "Published" },
      { value: POLICIES.filter((policy) => policy.tier === POLICY_TIERS.CORE).length, label: "Core", tone: "good" },
      { value: new Set(POLICIES.flatMap((policy) => policy.controlIds)).size, label: "Controls mapped" },
    ],
    attention: 0,
    attentionLabel: "No policy action signals",
  },
  procedures: {
    metrics: [
      { value: PROCEDURES.length, label: "Procedures" },
      { value: PROCEDURES.reduce((total, procedure) => total + procedure.steps.length, 0), label: "Defined steps" },
      { value: new Set(PROCEDURES.map((procedure) => procedure.policyId)).size, label: "Policies supported", tone: "good" },
    ],
    attention: 0,
    attentionLabel: "Open a procedure to review executions",
  },
  principles: {
    metrics: [
      { value: PRINCIPLE_STATUS_COUNTS.total, label: "Principles" },
      { value: PRINCIPLE_STATUS_COUNTS.operationalized, label: "Operationalized", tone: "good" },
      { value: PRINCIPLE_STATUS_COUNTS.partial + PRINCIPLE_STATUS_COUNTS["not-operationalized"], label: "Need maturity", tone: "attention" },
    ],
    attention: PRINCIPLE_STATUS_COUNTS.partial + PRINCIPLE_STATUS_COUNTS["not-operationalized"],
    attentionLabel: "principles need further operationalization",
  },
  schedule: {
    metrics: [
      { value: scheduleCounts.completed, label: "Completed" , tone: "good" },
      { value: scheduleCounts.upcoming, label: "Open this period" },
      { value: scheduleCounts.attention, label: "At risk / overdue", tone: "attention" },
    ],
    attention: scheduleCounts.attention,
    attentionLabel: "scheduled activities require attention",
  },
  exceptions: {
    metrics: [
      { value: EXCEPTION_SUMMARY.active, label: "Active", tone: "good" },
      { value: EXCEPTION_SUMMARY.expiring, label: "Expiring", tone: "attention" },
      { value: EXCEPTION_SUMMARY.reviewDue, label: "Review required", tone: "attention" },
    ],
    attention: EXCEPTION_SUMMARY.expiring + EXCEPTION_SUMMARY.expired + EXCEPTION_SUMMARY.reviewDue,
    attentionLabel: "exception lifecycle actions required",
  },
};

function metricColor(tone: AreaMetric["tone"]): string {
  if (tone === "good") return C.green;
  if (tone === "attention") return C.amber;
  return C.ink;
}

export function GovernanceLanding({ onSelect }: { onSelect: (area: GovernanceAreaId) => void }) {
  return (
    <div className="w-full pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={Landmark}
        title="Select a Governance Area"
        description="Choose the governance workflow you want to work in. Each area uses the same connected control, system, evidence, and accountability model."
      />

      <div className="px-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {GOVERNANCE_AREAS.map((area) => {
          const summary = AREA_SUMMARIES[area.id];
          const Icon = area.icon;
          const hasAttention = summary.attention > 0;
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelect(area.id)}
              className="group text-left transition-transform hover:-translate-y-0.5"
            >
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: C.panel, border: `1px solid ${hasAttention ? `${C.amber}55` : C.border}`, minHeight: 205 }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ background: `linear-gradient(135deg, ${C.accentStrong} 0%, ${C.accent} 140%)` }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.14)" }}>
                      <Icon size={15} color="#FFFFFF" />
                    </div>
                    <h2 className="text-base leading-snug min-w-0 truncate" style={{ color: "#FFFFFF", fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{area.label}</h2>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "rgba(255,255,255,0.88)" }}>Open <ArrowRight size={13} /></span>
                </div>
                <div className="p-4 pt-3">
                  <p className="text-xs leading-relaxed min-h-10" style={{ color: C.muted }}>{area.description}</p>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    {summary.metrics.map((metric) => (
                      <div key={metric.label}>
                        <div className="text-xl font-semibold tabular-nums" style={{ color: metricColor(metric.tone), fontFamily: "'Source Serif 4', serif" }}>{metric.value}</div>
                        <div className="text-[10px] leading-tight mt-1" style={{ color: C.muted }}>{metric.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: hasAttention ? C.amber : C.green }}>
                    {hasAttention ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                    {hasAttention ? `${summary.attention} ${summary.attentionLabel}` : summary.attentionLabel}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
