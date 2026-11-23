import React, { useMemo } from "react";
import { ClipboardCheck, FileCheck2, Rows3, Target, Wrench } from "lucide-react";
import { C } from "../../../theme";
import { useLiveEngine } from "../../../engine/useLiveEngine";
import { complianceBand } from "../../../engine";
import type { SystemId } from "../../../graph/ids";
import type { WorkspaceSystem } from "../types";
import { SectionHeader } from "../shared/SectionHeader";
import { CoverageBar } from "../shared/CoverageBar";
import { ScoreTile, SpanRail, complianceGradient } from "./PrismaLadder";
import { ReadinessFlow, type ReadinessStep } from "./AssessmentReadiness";
import { colorFor } from "../../Audits/shared";
import { FRAMEWORKS } from "../../../graph/nodes/controls";

// The Overview for a system without HITRUST in scope, drawn with the same
// pieces as the HITRUST Overview — a score tile bracketed to the rows it reads,
// and the four-stage readiness flow — so the two kinds of system read alike.
// The rows are the frameworks the system certifies against instead of PRISMA
// levels, and the stages are the framework baseline's instead of the PRISMA
// walk's.

const ROW_H = 34;
const ROW_GAP = 10;
const RAIL_GUTTER = 30;

function useBaselineFacts(system: WorkspaceSystem) {
  const engine = useLiveEngine();
  const systemId = system.id as SystemId;
  return useMemo(() => {
    const matrix = engine.compliance.systemControlMatrix(systemId);
    // Only frameworks the catalog maps: one with no crosswalk (GDPR) brings no controls to score.
    const frameworks = system.standards.filter((s) => (FRAMEWORKS as readonly string[]).includes(s));
    const byFramework = frameworks.map((fw) => {
      const rows = matrix.filter((r) => r.baseline?.frameworks.includes(fw));
      const assessed = rows.filter((r) => r.status !== "unassessed");
      const met = assessed.filter((r) => r.status === "satisfied" || r.status === "inherited").length;
      return { fw, mapped: rows.length, assessed: assessed.length, met, score: assessed.length ? Math.round((met / assessed.length) * 100) : null };
    });
    const editable = matrix.filter((r) => ["system", "hybrid", "none"].includes(r.baseline?.source ?? "none"));
    const owing = matrix.filter((r) => r.baseline && (r.baseline.requires.evidence || r.baseline.requires.frequency) && ["system", "hybrid"].includes(r.baseline.source));
    const assessed = matrix.filter((r) => r.status !== "unassessed");
    const applicability = engine.compliance.controlApplicabilitySummary(systemId);
    return {
      byFramework,
      editableTotal: editable.length,
      toRecord: editable.filter((r) => r.status === "unassessed").length,
      owingTotal: owing.length,
      owed: matrix.filter((r) => (r.baseline?.missing.length ?? 0) > 0).length,
      assessedTotal: assessed.length,
      gaps: matrix.filter((r) => r.status === "partial" || r.status === "not-implemented").length,
      pending: applicability.pending,
      scopeTotal: applicability.applicable + applicability.pending,
      audits: engine.engagements.openForSystem(systemId).map((e) => e.name),
    };
  }, [engine, systemId, system.standards]);
}

export function BaselinePostureLadder({ system }: { system: WorkspaceSystem }) {
  const f = useBaselineFacts(system);
  const n = Math.max(f.byFramework.length, 1);
  const height = n * ROW_H + (n - 1) * ROW_GAP;
  const score = system.complianceScore;
  return (
    <div>
      <SectionHeader
        icon={Rows3}
        title="System Posture"
        description="Compliance across the frameworks this system certifies against — of the controls each one maps that are assessed, the share that is met. Partial earns nothing."
      />
      <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-4 lg:gap-0">
        <div className="w-full lg:w-[220px] shrink-0">
          <ScoreTile
            label="Compliance"
            sub={`${system.complianceCoverage.scored} of ${system.complianceCoverage.required} controls assessed`}
            value={score == null ? "—" : `${score}%`}
            pct={score}
            gradient={complianceGradient()}
            height={Math.max(height, 96)}
          />
        </div>
        <div className="relative shrink-0 hidden lg:block" style={{ width: RAIL_GUTTER, height: Math.max(height, 96) }}>
          <SpanRail height={Math.max(height, 96)} railX={18} leaderY={Math.max(height, 96) / 2} color={C.amber} />
        </div>
        <div className="flex flex-col w-full lg:w-auto lg:flex-1 min-w-0 lg:max-w-[520px]" style={{ gap: ROW_GAP, paddingTop: height < 96 ? (96 - height) / 2 : 0 }}>
          {f.byFramework.map((row) => (
            <div key={row.fw} className="flex items-center gap-2.5" style={{ height: ROW_H }}>
              <div className="w-[92px] shrink-0 text-xs font-semibold" style={{ color: C.ink }}>{row.fw}</div>
              <div className="flex-1 min-w-0"><CoverageBar pct={row.score} color={colorFor(complianceBand(row.score).color).color} barHeight={7} /></div>
              <div className="w-[150px] shrink-0 text-[11px] text-right" style={{ color: C.muted }}>{row.met} met of {row.assessed} assessed</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BaselineReadiness({ system, onScopeClick, onControlsClick }: {
  system: WorkspaceSystem;
  onScopeClick: () => void;
  onControlsClick: () => void;
}) {
  const f = useBaselineFacts(system);
  const steps: ReadinessStep[] = [
    {
      id: "scope", icon: Target, title: "Confirm Scope", note: "Controls awaiting confirmation",
      complete: f.pending === 0, count: f.pending, done: f.scopeTotal - f.pending, total: f.scopeTotal, onClick: onScopeClick,
    },
    {
      id: "record", icon: ClipboardCheck, title: "Record Controls", note: "System-owned controls not yet recorded",
      complete: f.toRecord === 0, count: f.toRecord, done: f.editableTotal - f.toRecord, total: f.editableTotal, onClick: onControlsClick,
    },
    {
      id: "evidence", icon: FileCheck2, title: "Provide Evidence", note: "Owing evidence or frequency",
      complete: f.owed === 0, count: f.owed, done: f.owingTotal - f.owed, total: f.owingTotal, onClick: onControlsClick,
    },
    {
      id: "gaps", icon: Wrench, title: "Close Gaps", note: "Controls partial or not implemented",
      complete: f.gaps === 0, count: f.gaps, done: f.assessedTotal - f.gaps, total: f.assessedTotal, onClick: onControlsClick,
    },
  ];
  return (
    <ReadinessFlow
      title="Audit Readiness"
      description={f.audits.length
        ? `What the system's own records still need before an auditor looks. In audit: ${f.audits.join(", ")}.`
        : "What the system's own records still need before an auditor looks."}
      steps={steps}
    />
  );
}
