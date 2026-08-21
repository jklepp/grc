import React from "react";
import { Check, ChevronRight, ClipboardCheck, FileWarning, ShieldCheck, Target, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../../theme";
import { SectionHeader } from "../shared/SectionHeader";
import { Callout, StatusPill, TX, WizardTokens, WZ } from "../../../components/wizard/WizardUI";
import { REMEDIATION_STATUSES } from "../SystemControls";
import type { ControlMatrixRow, ApplicabilitySummary } from "../types";

type ControlStatus = ControlMatrixRow["status"];

interface FormalAssessmentStatus {
  scopeDecided: boolean;
  controlsAssessed: boolean;
  gapsRecorded: boolean;
  gapControlsMissingFinding: ControlMatrixRow[];
  complete: boolean;
}

interface AssessmentReadinessProps {
  statusCounts: Record<ControlStatus, number>;
  applicabilitySummary: ApplicabilitySummary;
  formalAssessment: FormalAssessmentStatus;
  onScopeClick: () => void;
  onAssessClick: () => void;
  onGapsClick: () => void;
  onRemediateClick: () => void;
}

// One row per check — the same marker, title, description, status pill and
// affordance whether the check is next up or not. "Next" is carried by the
// accent border and filled marker, exactly the way a wizard rail marks its
// active step, rather than by a second component with its own type scale.
function CheckRow({ icon: Icon, title, description, complete, count, next, onClick }: {
  icon: LucideIcon;
  title: string;
  description: string;
  complete: boolean;
  count: number;
  next: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} — ${complete ? "complete" : `${count} open`}`}
      className="wz-focusable wz-hover w-full flex items-start gap-3 px-3.5 py-3 text-left transition-colors"
      style={{
        background: next ? C.accentBg : C.bg,
        border: `1px solid ${next ? C.accent : C.border}`,
        borderRadius: WZ.radius.control,
      }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{
          border: `1.5px solid ${complete ? C.green : next ? C.accent : C.border}`,
          background: complete ? C.greenBg : next ? C.accent : "transparent",
          color: complete ? C.green : next ? WZ.onAccent : C.muted,
        }}
      >
        {complete ? <Check size={13} /> : <Icon size={13} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`${TX.itemTitle} block`} style={{ color: C.ink }}>{title}</span>
        <span className={`${TX.help} block mt-1.5`} style={{ color: C.muted }}>{description}</span>
      </span>
      <span className="shrink-0 flex items-center gap-2 mt-0.5">
        <StatusPill tone={complete ? "success" : "danger"} icon={complete ? Check : undefined}>
          {complete ? "Complete" : `${count} open`}
        </StatusPill>
        <ChevronRight size={14} color={C.muted} />
      </span>
    </button>
  );
}

const CHECKS = ["scope", "assess", "gaps", "remediate"] as const;
type CheckId = (typeof CHECKS)[number];
// "Formally assessed" (Completion, stage 4) needs only these three — a gap is
// allowed to still be open, as long as it's on record with a Finding/CAP.
// "remediate" is a further, optional bar (closing those gaps) tracked
// alongside it but not required for the system to count as formally assessed.
const FORMAL_ASSESSMENT_CHECKS = ["scope", "assess", "gaps"] as const;

// A read of every count already exists elsewhere (Scope from
// applicability.pendingControlsForSystem, Assessment from statusCounts.unassessed,
// Gaps from formalAssessment.gapControlsMissingFinding, Remediation from the
// same REMEDIATION_STATUSES SystemControls' work-queue tile uses) — four
// independent Complete/Deficient checks, not a sequential wizard. The first
// deficient check in scope->assess->gaps->remediate order (the natural
// workflow sequence) is marked as next; the order on screen never reshuffles.
export function AssessmentReadiness({ statusCounts, applicabilitySummary, formalAssessment, onScopeClick, onAssessClick, onGapsClick, onRemediateClick }: AssessmentReadinessProps) {
  const pendingCount = applicabilitySummary?.pending ?? 0;
  const assessmentCount = statusCounts.unassessed ?? 0;
  const gapsMissingCount = formalAssessment.gapControlsMissingFinding.length;
  const remediationCount = REMEDIATION_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);

  const checks: Record<CheckId, { icon: LucideIcon; title: string; description: string; complete: boolean; count: number; onClick: () => void }> = {
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
    gaps: {
      icon: FileWarning,
      title: "Gaps & CAPs Recorded",
      description: "Every partial, deficient, or not-implemented control has a Finding filed with a corrective action plan.",
      complete: gapsMissingCount === 0,
      count: gapsMissingCount,
      onClick: onGapsClick,
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
  const nextId = CHECKS.find((id) => !checks[id].complete);
  const doneCount = CHECKS.filter((id) => checks[id].complete).length;
  const formallyAssessed = FORMAL_ASSESSMENT_CHECKS.every((id) => checks[id].complete);

  return (
    <WizardTokens>
      <SectionHeader
        icon={ShieldCheck}
        title="System Readiness"
        description="Four independent checks toward an audit-ready system: has scope been decided, has it been evaluated, is every gap on record, and does what was found still need fixing."
        aside={<StatusPill tone={nextId ? "neutral" : "success"}>{doneCount} of {CHECKS.length} complete</StatusPill>}
      />
      {!nextId ? (
        <Callout tone="success" title="Scoped, assessed, recorded, and remediated.">
          This system is audit-ready.
        </Callout>
      ) : (
        <div className="flex flex-col gap-2.5">
          {formallyAssessed && (
            <Callout tone="success" title="Formally assessed.">
              Scope is decided, every applicable control has been evaluated, and every gap has a Finding/CAP on record.
              {remediationCount > 0 ? ` ${remediationCount} remediation item${remediationCount === 1 ? "" : "s"} still open.` : ""}
            </Callout>
          )}
          {CHECKS.map((id) => <CheckRow key={id} {...checks[id]} next={id === nextId} />)}
        </div>
      )}
    </WizardTokens>
  );
}
