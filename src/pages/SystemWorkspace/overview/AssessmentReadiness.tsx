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

function HeroCheckRow({ icon: Icon, title, description, complete, count, onClick }: {
  icon: typeof Target;
  title: string;
  description: string;
  complete: boolean;
  count: number;
  onClick: () => void;
}) {
  const color = complete ? C.green : C.red;
  const background = complete ? C.greenBg : C.redBg;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 text-left rounded-xl transition-colors"
      style={{ background }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.panel, color }}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold" style={{ color: C.ink }}>{title}</div>
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{description}</div>
      </div>
      <span className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap" style={{ color, background: C.panel }}>
        {complete ? "Complete" : `Deficient · ${count}`}
      </span>
      <ChevronRight size={18} className="shrink-0" color={color} />
    </button>
  );
}

function SecondaryCheckRow({ icon: Icon, title, complete, count, onClick, first = false }: {
  icon: typeof Target;
  title: string;
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
      className="w-full flex items-center gap-2.5 py-2.5 text-left transition-colors"
      style={{ borderTop: first ? "none" : `1px solid ${C.border}` }}
    >
      <Icon size={14} color={color} className="shrink-0" />
      <span className="text-xs font-medium flex-1 min-w-0" style={{ color: C.ink }}>{title}</span>
      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ color, background }}>
        {complete ? "Complete" : `Deficient · ${count}`}
      </span>
      <ChevronRight size={14} className="shrink-0" color={C.muted} />
    </button>
  );
}

const CHECKS = ["scope", "assess", "remediate"] as const;
type CheckId = (typeof CHECKS)[number];

// A new read of data every count already exists elsewhere for (Scope from
// applicability.pendingControlsForSystem, Assessment from statusCounts.unassessed,
// Remediation from the same REMEDIATION_STATUSES SystemControls' work-queue tile
// uses) — three independent Complete/Deficient checks, not a sequential wizard.
// One primary CTA: the first deficient check in scope->assess->remediate order
// (the natural workflow sequence) renders as a hero row; the rest stay compact.
export function AssessmentReadiness({ statusCounts, applicabilitySummary, onScopeClick, onAssessClick, onRemediateClick }: AssessmentReadinessProps) {
  const pendingCount = applicabilitySummary?.pending ?? 0;
  const assessmentCount = statusCounts.unassessed ?? 0;
  const remediationCount = REMEDIATION_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);

  const checks: Record<CheckId, { icon: typeof Target; title: string; description: string; complete: boolean; count: number; onClick: () => void }> = {
    scope: {
      icon: Target,
      title: "Scope Determination",
      description: "All matched controls have an in-scope / out-of-scope decision on record.",
      complete: pendingCount === 0,
      count: pendingCount,
      onClick: onScopeClick,
    },
    assess: {
      icon: ClipboardCheck,
      title: "Control Assessment",
      description: "Applicable controls have been evaluated and PRISMA-scored.",
      complete: assessmentCount === 0,
      count: assessmentCount,
      onClick: onAssessClick,
    },
    remediate: {
      icon: Wrench,
      title: "Remediation",
      description: `${statusCounts.deficient ?? 0} deficient · ${statusCounts.partial ?? 0} partial on assessed controls`,
      complete: remediationCount === 0,
      count: remediationCount,
      onClick: onRemediateClick,
    },
  };
  const heroId = CHECKS.find((id) => !checks[id].complete);
  const allComplete = !heroId;

  return (
    <div>
      <SectionHeader
        icon={ShieldCheck}
        title="System Readiness"
        description="Three independent checks toward an audit-ready system: has scope been decided, has it been evaluated, and does what was found still need fixing."
      />
      {allComplete ? (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: C.greenBg, color: C.green }}>
          <ShieldCheck size={16} /> Scoped, assessed, and remediated — this system is audit-ready.
        </div>
      ) : (
        <div className="space-y-1">
          {/* Fixed Scope -> Assess -> Remediate order, always — only the first
              deficient check (heroId) gets the larger hero treatment, in place,
              so the natural workflow sequence never reshuffles on screen. */}
          {CHECKS.map((id, i) => (
            id === heroId
              ? <HeroCheckRow key={id} {...checks[id]} />
              : <SecondaryCheckRow key={id} {...checks[id]} first={i === 0 || CHECKS[i - 1] === heroId} />
          ))}
        </div>
      )}
    </div>
  );
}
