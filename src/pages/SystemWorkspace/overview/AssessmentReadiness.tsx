import React, { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardCheck, FileWarning, ShieldCheck, Target, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../../theme";
import { SectionHeader } from "../shared/SectionHeader";
import { Button, Callout, StatusPill, TX, WizardTokens, WZ } from "../../../components/wizard/WizardUI";
import type { FormalAssessmentStatus } from "../../../engine/review";

interface AssessmentReadinessProps {
  formalAssessment: FormalAssessmentStatus;
  onScopeClick: () => void;
  onAssessClick: () => void;
  onGapsClick: () => void;
  onRemediateClick: () => void;
}

/* ------------------------------------------------------------- geometry -- */

// The flow is drawn once at this intrinsic size and scaled to whatever width
// the panel has, so every coordinate below is in board space, never CSS px.
// Scaling the whole board uniformly is what keeps the connectors meeting the
// nodes: a fluid layout would have to redraw the elbows at every width.
const BOARD = { w: 910, h: 190 };
// Below this the board stops shrinking and the container scrolls instead —
// past roughly three-quarters, the 11px note line stops being readable.
const MIN_SCALE = 0.72;

const SPINE_Y = 90;

// Every node stacks the same way around its glyph — title above, figure and
// its one line below — so the row reads as one rhythm. Offsets are from
// the glyph centre.
const TITLE_DY = -45;
const NODE_W = 176;
const NODE_H = 140;

// The gauge is deliberately smaller than a comfortable standalone dial. This
// panel is one block on a busy overview, not the page — at 60px the ring of
// four read as the subject of the screen rather than a status strip.
const GAUGE = 48;
const RING_R = 21.5;
const RING_C = 2 * Math.PI * RING_R;

/* ---------------------------------------------------------------- pieces -- */

// The ring was being drawn anyway. Making it an arc lets a node report how far
// through its check the system is, not just whether it finished — which is the
// difference between four icons and four instruments.
function Gauge({ icon: Icon, done, total, complete, next }: {
  icon: LucideIcon; done: number; total: number; complete: boolean; next: boolean;
}) {
  // No controls in a population means nothing is outstanding, which is how
  // every one of these checks already reports itself.
  const pct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 1;
  const ink = complete ? C.green : next ? C.accent : C.muted;
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{
        width: GAUGE,
        height: GAUGE,
        borderRadius: WZ.radius.pill,
        color: ink,
        // A second, wider ring is how "in hand" reads on a surface with no
        // boxes to put a border on.
        boxShadow: next ? `0 0 0 4px ${C.accentBg}` : undefined,
      }}
    >
      <svg width={GAUGE} height={GAUGE} viewBox={`0 0 ${GAUGE} ${GAUGE}`} className="absolute inset-0" aria-hidden="true">
        <circle cx={GAUGE / 2} cy={GAUGE / 2} r={22.5} fill={complete ? C.greenBg : next ? C.accentBg : C.panel} />
        <circle cx={GAUGE / 2} cy={GAUGE / 2} r={RING_R} fill="none" stroke={C.border} strokeWidth={2.5} />
        <circle
          cx={GAUGE / 2}
          cy={GAUGE / 2}
          r={RING_R}
          fill="none"
          // Progress is progress whoever is holding it, so the arc stays green
          // even on the stage in hand; the accent is carried by the halo.
          stroke={complete || !next ? C.green : C.accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - pct)}
          transform={`rotate(-90 ${GAUGE / 2} ${GAUGE / 2})`}
        />
      </svg>
      <span className="relative flex">
        {complete ? <Check size={20} strokeWidth={2.5} /> : <Icon size={18} />}
      </span>
    </span>
  );
}

function FlowNode({ cx, cy, icon, title, figure, note, done, total, complete, next, onClick }: {
  cx: number; cy: number; icon: LucideIcon; title: string; figure: string; note: string;
  done: number; total: number; complete: boolean; next: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} — ${complete ? "complete" : `${figure} open`}`}
      className="wz-focusable wz-hover absolute flex flex-col items-center text-center transition-colors"
      style={{
        left: cx - NODE_W / 2,
        top: cy + TITLE_DY,
        width: NODE_W,
        height: NODE_H,
        border: "1px solid transparent",
        borderRadius: WZ.radius.card,
      }}
    >
      <span
        className="block truncate w-full"
        style={{ fontFamily: WZ.serif, fontSize: 13.5, fontWeight: 600, lineHeight: "17px", color: C.ink }}
      >
        {title}
      </span>
      <span className="block" style={{ marginTop: 4 }}>
        <Gauge icon={icon} done={done} total={total} complete={complete} next={next} />
      </span>
      <span
        className="block"
        style={{ marginTop: 11, fontFamily: WZ.serif, fontSize: 22, fontWeight: 600, lineHeight: "22px", color: complete ? C.green : C.red }}
      >
        {figure}
      </span>
      <span className={`${TX.help} block`} style={{ marginTop: 6, color: C.muted }}>{note}</span>
    </button>
  );
}

// Scales the board to the panel's width. ResizeObserver rather than a
// breakpoint because the panel reflows with the workspace, not with the
// viewport — the same reason Brief measures instead of assuming.
function ScaleToFit({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, Math.max(MIN_SCALE, el.clientWidth / BOARD.w)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="overflow-x-auto">
      <div style={{ width: BOARD.w * scale, height: BOARD.h * scale }}>
        <div style={{ width: BOARD.w, height: BOARD.h, position: "relative", transformOrigin: "top left", transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- flow -- */

const CHECKS = ["scope", "assess", "record", "remediate"] as const;
type CheckId = (typeof CHECKS)[number];
const X: Record<CheckId, number> = { scope: 120, assess: 340, record: 570, remediate: 790 };
// "Formally assessed" needs the first three stages — a gap may remain open as
// long as its Finding and CAP are on record. Remediation remains the ongoing
// stage after the assessment engagement closes.
const FORMAL_ASSESSMENT_CHECKS = ["scope", "assess", "record"] as const;

// Every count is READ, never derived here: Scope from the applicability
// summary, Assessment from statusCounts.unassessed, and filing + remediation
// from review.formalAssessmentForSystem. The first incomplete stage in the
// natural workflow sequence is marked as next; the row never reshuffles.
export function AssessmentReadiness({ formalAssessment, onScopeClick, onAssessClick, onGapsClick, onRemediateClick }: AssessmentReadinessProps) {
  const pendingCount = formalAssessment.scopeRemainingCount;
  const assessmentCount = formalAssessment.assessmentRemainingCount;
  // Filing counts both halves of "recorded": gaps with no Finding at all, and
  // gaps whose open Finding still has no CAP. Disjoint sets (see
  // formalAssessmentForSystem), so the sum never double-counts a control.
  const gapsMissingCount = formalAssessment.gapControlsMissingFinding.length
    + formalAssessment.gapControlsMissingCap.length;
  const reassessCount = formalAssessment.controlsAwaitingReassessment.length;
  const remediationCount = formalAssessment.remediationCount;
  // Remediation asks a different question than filing and counts a different
  // population — every control with a gap status OR an open Finding on it.
  // See review.formalAssessmentForSystem.
  const residualCount = formalAssessment.residualCount;

  // Denominators for the gauges. Each one is the population its own check runs
  // over, so an arc never mixes two questions:
  //   scope     — every exclusion and inheritance claim Scope Review presents,
  //               decided or not (see formalAssessmentForSystem)
  //   assess    — every applicable key control, the population the assessment
  //               walk and evidence/Findings models can work directly
  //   record    — every control carrying a gap, recorded or not
  //   remediate — assessed controls, of which the ones with nothing residual
  //               open on them are the progress
  const matchedCount = formalAssessment.scopeTotalCount;
  const decidedCount = matchedCount - pendingCount;
  const assessmentTotal = formalAssessment.assessmentTotalCount;
  const assessedCount = assessmentTotal - assessmentCount;

  const checks: Record<CheckId, {
    icon: LucideIcon; title: string; note: string; complete: boolean; count: number;
    done: number; total: number; onClick: () => void;
  }> = {
    scope: {
      icon: Target,
      title: "Confirm Scope",
      note: "Controls awaiting confirmation",
      complete: pendingCount === 0,
      count: pendingCount,
      done: decidedCount,
      total: matchedCount,
      onClick: onScopeClick,
    },
    assess: {
      icon: ClipboardCheck,
      title: "Assess Controls",
      note: "Controls awaiting assessment",
      complete: assessmentCount === 0,
      count: assessmentCount,
      done: assessedCount,
      total: assessmentTotal,
      onClick: onAssessClick,
    },
    record: {
      icon: FileWarning,
      title: "File Findings & CAPs",
      note: "Controls missing records",
      complete: gapsMissingCount === 0,
      count: gapsMissingCount,
      done: remediationCount - gapsMissingCount,
      total: remediationCount,
      onClick: onGapsClick,
    },
    remediate: {
      icon: Wrench,
      title: "Remediate",
      note: "Controls requiring action",
      complete: residualCount === 0,
      count: residualCount,
      done: assessedCount - residualCount,
      total: assessedCount,
      onClick: onRemediateClick,
    },
  };
  const nextId = CHECKS.find((id) => !checks[id].complete);
  const doneCount = CHECKS.filter((id) => checks[id].complete).length;
  const formallyAssessed = FORMAL_ASSESSMENT_CHECKS.every((id) => checks[id].complete);
  const allClear = !nextId;

  // A path is dashed until the stage behind it clears, so an untravelled route
  // never looks like a travelled one.
  const flow = (complete: boolean) => ({
    stroke: complete ? C.green : C.border,
    strokeDasharray: complete ? undefined : "4 5",
  });
  const node = (id: CheckId, cx: number, cy: number) => (
    <FlowNode
      key={id}
      cx={cx}
      cy={cy}
      icon={checks[id].icon}
      title={checks[id].title}
      figure={checks[id].complete ? "0" : String(checks[id].count)}
      note={checks[id].complete ? "Nothing outstanding" : checks[id].note}
      done={checks[id].done}
      total={checks[id].total}
      complete={checks[id].complete}
      next={id === nextId}
      onClick={checks[id].onClick}
    />
  );

  return (
    <WizardTokens>
      <SectionHeader
        icon={ShieldCheck}
        title="System Readiness"
        description="Readiness tracks whether the assurance workflow is complete; the Assurance score separately measures how strong the resulting posture is."
        aside={(
          <div className="flex items-center gap-2">
            <StatusPill tone={allClear ? "success" : "neutral"}>{doneCount} of {CHECKS.length} complete</StatusPill>
            {nextId && (
              <Button size="sm" variant="primary" iconRight={ArrowRight} onClick={checks[nextId].onClick}>
                Continue to {checks[nextId].title}
              </Button>
            )}
          </div>
        )}
      />

      <div className="flex flex-col gap-3">
        {allClear ? (
          <Callout tone="success" title="Scoped, assessed, recorded, and remediated.">
            This system is assurance-ready. Its Assurance percentage may still be below target because readiness measures workflow completion, not control strength.
          </Callout>
        ) : formallyAssessed ? (
          <Callout tone="success" title="Formally assessed.">
            Scope is decided, every applicable key control has been evaluated, and every gap has a Finding/CAP on record.
            {residualCount > 0 ? ` ${residualCount} remediation item${residualCount === 1 ? "" : "s"} still open.` : ""}
            {reassessCount > 0 ? ` ${reassessCount} of them ${reassessCount === 1 ? "has" : "have"} completed remediation and await${reassessCount === 1 ? "s" : ""} reassessment.` : ""}
          </Callout>
        ) : null}

        <ScaleToFit>
          <svg
            width={BOARD.w}
            height={BOARD.h}
            viewBox={`0 0 ${BOARD.w} ${BOARD.h}`}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-0 top-0 pointer-events-none"
            aria-hidden="true"
          >
            <g {...flow(checks.scope.complete)}>
              <path d={`M${X.scope + 28} ${SPINE_Y}H${X.assess - 28}`} />
            </g>
            <path d={`m${X.assess - 32} ${SPINE_Y - 4} 4 4-4 4`} stroke={flow(checks.scope.complete).stroke} />

            <g {...flow(checks.assess.complete)}>
              <path d={`M${X.assess + 28} ${SPINE_Y}H${X.record - 28}`} />
            </g>
            <path d={`m${X.record - 32} ${SPINE_Y - 4} 4 4-4 4`} stroke={flow(checks.assess.complete).stroke} />

            <g {...flow(checks.record.complete)}>
              <path d={`M${X.record + 28} ${SPINE_Y}H${X.remediate - 28}`} />
            </g>
            <path d={`m${X.remediate - 32} ${SPINE_Y - 4} 4 4-4 4`} stroke={flow(checks.record.complete).stroke} />
          </svg>

          {node("scope", X.scope, SPINE_Y)}
          {node("assess", X.assess, SPINE_Y)}
          {node("record", X.record, SPINE_Y)}
          {node("remediate", X.remediate, SPINE_Y)}
        </ScaleToFit>
      </div>
    </WizardTokens>
  );
}
