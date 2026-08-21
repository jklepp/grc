import React from "react";
import { ChevronRight, ClipboardCheck, ShieldCheck, Target, Wrench } from "lucide-react";
import { C } from "../../../theme";
import { SectionHeader } from "../shared/SectionHeader";
import { REMEDIATION_STATUSES } from "../SystemControls";
import type { ControlMatrixRow, ApplicabilitySummary } from "../types";

type ControlStatus = ControlMatrixRow["status"];

interface AssessmentReadinessProps {
  statusCounts: Record<ControlStatus, number>;
  applicabilitySummary: ApplicabilitySummary;
  onScopeClick: () => void;
  onAssessClick: () => void;
  onRemediateClick: () => void;
}

function CheckRow({ icon: Icon, title, description, complete, count, onClick, first = false }: {
  icon: typeof Target;
  title: string;
  description: string;
  complete: boolean;
  count: number;
  onClick: () => void;
  first?: boolean;
}) {
  const color = complete ? C.green : C.red;
  const background = complete ? C.greenBg : C.redBg;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 text-left rounded-lg transition-colors"
      style={{ borderTop: first ? "none" : `1px solid ${C.border}` }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background, color }}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: C.ink }}>{title}</div>
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{description}</div>
      </div>
      <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ color, background }}>
        {complete ? "Complete" : `Deficient · ${count}`}
      </span>
      <ChevronRight size={16} className="shrink-0" color={C.muted} />
    </button>
  );
}

// A new read of data every count already exists elsewhere for (Scope from
// applicability.pendingControlsForSystem, Assessment from statusCounts.unassessed,
// Remediation from the same REMEDIATION_STATUSES SystemControls' work-queue tile
// uses) — three independent Complete/Deficient checks, not a sequential wizard.
export function AssessmentReadiness({ statusCounts, applicabilitySummary, onScopeClick, onAssessClick, onRemediateClick }: AssessmentReadinessProps) {
  const pendingCount = applicabilitySummary?.pending ?? 0;
  const assessmentCount = statusCounts.unassessed ?? 0;
  const remediationCount = REMEDIATION_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);

  return (
    <div>
      <SectionHeader
        icon={ShieldCheck}
        title="System Readiness"
        description="Three independent checks toward an audit-ready system: has scope been decided, has it been evaluated, and does what was found still need fixing."
      />
      <div>
        <CheckRow
          icon={Target}
          title="Scope Determination"
          description="All matched controls have an in-scope / out-of-scope decision on record."
          complete={pendingCount === 0}
          count={pendingCount}
          onClick={onScopeClick}
          first
        />
        <CheckRow
          icon={ClipboardCheck}
          title="Control Assessment"
          description="Applicable controls have been evaluated and PRISMA-scored."
          complete={assessmentCount === 0}
          count={assessmentCount}
          onClick={onAssessClick}
        />
        <CheckRow
          icon={Wrench}
          title="Remediation"
          description={`${statusCounts.deficient ?? 0} deficient · ${statusCounts.partial ?? 0} partial on assessed controls`}
          complete={remediationCount === 0}
          count={remediationCount}
          onClick={onRemediateClick}
        />
      </div>
    </div>
  );
}
