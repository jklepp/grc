import React from "react";
import { Landmark } from "lucide-react";
import { PageHeader } from "../components/Headings";
import { AreaSelectList } from "../components/AreaSelectList";
import type { AreaListItem } from "../components/AreaSelectList";
import { POLICIES, POLICY_TIERS } from "../data/policies";
import { PROCEDURES } from "../data/procedures";
import { PRINCIPLE_STATUS_COUNTS } from "../data/securityPrinciples";
import { FREQUENCIES, currentPeriod, statusCountsForPeriod } from "../data/scheduledActivities";
import { EXCEPTION_SUMMARY, IN_SCOPE_CONTROLS } from "../engine";
import { GOVERNANCE_AREAS } from "./governanceAreas";
import type { GovernanceAreaId } from "./governanceAreas";

interface AreaSummary {
  metrics: AreaListItem["metrics"];
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

const DOMAIN_COUNT = new Set(IN_SCOPE_CONTROLS.map((control) => control.domain)).size;
const STANDARD_COUNT = new Set(IN_SCOPE_CONTROLS.flatMap((control) => control.frameworks.map((f) => f.standard))).size;

const AREA_SUMMARIES: Record<GovernanceAreaId, AreaSummary> = {
  ccf: {
    metrics: [
      { value: IN_SCOPE_CONTROLS.length, label: "Controls in scope" },
      { value: DOMAIN_COUNT, label: "Domains" },
      { value: STANDARD_COUNT, label: "Standards mapped" },
    ],
    attention: 0,
    attentionLabel: "Browse the control catalog",
  },
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
      { value: scheduleCounts.completed, label: "Completed", tone: "good" },
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

const AREA_GROUPS: Partial<Record<GovernanceAreaId, string>> = {
  ccf: "Controls",
  policy: "Policies and Procedures",
  procedures: "Policies and Procedures",
  principles: "Operations",
  schedule: "Operations",
  exceptions: "Operations",
};

const AREAS: AreaListItem<GovernanceAreaId>[] = GOVERNANCE_AREAS.map((area) => {
  const summary = AREA_SUMMARIES[area.id];
  return {
    id: area.id,
    icon: area.icon,
    label: area.label,
    description: area.description,
    metrics: summary.metrics,
    attention: { count: summary.attention, label: summary.attentionLabel },
    group: AREA_GROUPS[area.id],
  };
});

// List layout matches SelectSystem's system table (bordered row list, avatar,
// stat readouts) so this landing page and the system picker read as the same
// "pick one of these" pattern instead of a table on one page and cards on
// another.
export function GovernanceLanding({ onSelect }: { onSelect: (area: GovernanceAreaId) => void }) {
  return (
    <div className="w-full pb-12">
      <PageHeader
        icon={Landmark}
        title="Select a Governance Area"
        description="Choose the governance workflow you want to work in. Each area uses the same connected control, system, evidence, and accountability model."
      />

      <div className="px-4 lg:px-8">
        <AreaSelectList areas={AREAS} onSelect={onSelect} />
      </div>
    </div>
  );
}
