import React from "react";
import { Landmark, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "../components/Headings";
import { AreaSelectList } from "../components/AreaSelectList";
import type { AreaListItem } from "../components/AreaSelectList";
import { POLICIES, POLICY_TIERS } from "../data/policies";
import { PROCEDURES } from "../data/procedures";
import { PRINCIPLE_STATUS_COUNTS } from "../data/securityPrinciples";
import { EXCEPTION_SUMMARY, IN_SCOPE_CONTROLS, OBLIGATION_SUMMARY, getLiveEngine } from "../engine";
import { SOURCE_DOCUMENTS, isStructural } from "../engine/sourceText";
import { GOVERNANCE_AREAS } from "./governanceAreas";
import type { GovernanceAreaId } from "./governanceAreas";
import { COMPLIANCE_AREAS } from "./complianceAreas";
import type { ComplianceAreaId } from "./complianceAreas";

interface AreaSummary {
  metrics: AreaListItem["metrics"];
  attention: number;
  attentionLabel: string;
}


const DOMAIN_COUNT = new Set(IN_SCOPE_CONTROLS.map((control) => control.domain)).size;
const STANDARD_COUNT = new Set(IN_SCOPE_CONTROLS.flatMap((control) => control.frameworks.map((f) => f.standard))).size;

const SOURCE_PARAGRAPHS = Object.values(SOURCE_DOCUMENTS).flatMap((doc) => doc.sections.flatMap((s) => s.paragraphs)).filter((p) => !isStructural(p));

// Read at the same moment as the barrel values above: when this chunk loads.
const OPEN_AUDITS = getLiveEngine().graph.engagements.filter((e) => e.status !== "closed");
const AUDITS_DUE_SOON = OPEN_AUDITS.filter((e) => Date.parse(e.dueDate) - Date.now() <= 30 * 86_400_000).length;

// Both landing pages (Governance and Compliance) read from this one table.
const AREA_SUMMARIES: Record<GovernanceAreaId | ComplianceAreaId, AreaSummary> = {
  audits: {
    metrics: [
      { value: OPEN_AUDITS.length, label: "Open audits" },
      { value: getLiveEngine().graph.certifications.length, label: "Certificates & reports" },
    ],
    attention: AUDITS_DUE_SOON,
    attentionLabel: AUDITS_DUE_SOON === 1 ? "audit due within 30 days" : "audits due within 30 days",
  },
  ccf: {
    metrics: [
      { value: IN_SCOPE_CONTROLS.length, label: "Controls in scope" },
      { value: DOMAIN_COUNT, label: "Domains" },
      { value: STANDARD_COUNT, label: "Standards mapped" },
    ],
    attention: 0,
    attentionLabel: "Browse the control catalog",
  },
  frameworks: {
    metrics: [
      { value: Object.keys(SOURCE_DOCUMENTS).length, label: "Frameworks with source text" },
      { value: SOURCE_PARAGRAPHS.length, label: "Requirement paragraphs" },
    ],
    attention: 0,
    attentionLabel: "Read the source requirements",
  },
  obligations: {
    metrics: [
      { value: OBLIGATION_SUMMARY.total, label: "Obligations" },
      { value: OBLIGATION_SUMMARY.proven, label: "Proven", tone: "good" },
      { value: OBLIGATION_SUMMARY.notProven + OBLIGATION_SUMMARY.noProof, label: "Not proven", tone: "attention" },
    ],
    attention: OBLIGATION_SUMMARY.notProven + OBLIGATION_SUMMARY.noProof,
    attentionLabel: "external obligations not yet proven",
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

const AREA_GROUPS: Record<GovernanceAreaId | ComplianceAreaId, string> = {
  ccf: "Controls",
  frameworks: "Controls",
  audits: "Audits and Obligations",
  obligations: "Audits and Obligations",
  policy: "Policies and Procedures",
  procedures: "Policies and Procedures",
  principles: "Operations",
  exceptions: "Operations",
};

function toListItems<Id extends GovernanceAreaId | ComplianceAreaId>(
  areas: readonly { id: Id; icon: LucideIcon; label: string; description: string }[],
): AreaListItem<Id>[] {
  return areas.map((area) => {
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
}

const GOVERNANCE_ITEMS = toListItems(GOVERNANCE_AREAS);
const COMPLIANCE_ITEMS = toListItems(COMPLIANCE_AREAS);

function Landing<Id extends string>({ icon, title, description, areas, onSelect }: {
  icon: LucideIcon; title: string; description: string; areas: AreaListItem<Id>[]; onSelect: (area: Id) => void;
}) {
  return (
    <div className="w-full pb-12">
      <PageHeader icon={icon} title={title} description={description} />
      <div className="px-4 lg:px-8">
        <AreaSelectList areas={areas} onSelect={onSelect} />
      </div>
    </div>
  );
}

// List layout matches SelectSystem's system table (bordered row list, avatar,
// stat readouts) so this landing page and the system picker read as the same
// "pick one of these" pattern instead of a table on one page and cards on
// another.
export function GovernanceLanding({ onSelect }: { onSelect: (area: GovernanceAreaId) => void }) {
  return (
    <Landing
      icon={Landmark}
      title="Select a Governance Area"
      description="Choose the governance workflow you want to work in. Each area uses the same connected control, system, evidence, and accountability model."
      areas={GOVERNANCE_ITEMS}
      onSelect={onSelect}
    />
  );
}

export function ComplianceLanding({ onSelect }: { onSelect: (area: ComplianceAreaId) => void }) {
  return (
    <Landing
      icon={ShieldCheck}
      title="Select a Compliance Area"
      description="The controls ACME is held to, the frameworks behind them, and the audits and outside obligations that test them."
      areas={COMPLIANCE_ITEMS}
      onSelect={onSelect}
    />
  );
}
