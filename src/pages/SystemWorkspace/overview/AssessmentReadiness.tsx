import React, { useLayoutEffect, useRef, useState } from "react";
import { Check, ClipboardCheck, FileWarning, ShieldCheck, Target, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../../theme";
import { SectionHeader } from "../shared/SectionHeader";
import { Callout, StatusPill, TX, WizardTokens, WZ } from "../../../components/wizard/WizardUI";
import type { FormalAssessmentStatus } from "../../../engine/review";
import type { ControlMatrixRow, ApplicabilitySummary } from "../types";

type ControlStatus = ControlMatrixRow["status"];

interface AssessmentReadinessProps {
  statusCounts: Record<ControlStatus, number>;
  applicabilitySummary: ApplicabilitySummary;
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
const BOARD = { w: 910, h: 312 };
// Below this the board stops shrinking and the container scrolls instead —
// past roughly three-quarters, the 11px note line stops being readable.
const MIN_SCALE = 0.72;

const SPINE_Y = 129;
const UPPER_Y = 48;
const LOWER_Y = 210;
const X = { scope: 96, assess: 300, split: 428, branch: 600, end: 806 };

// Every node stacks the same way around its glyph — title above, figure and
// its one line below — so the three rows read as one rhythm. Offsets are from
// the glyph centre.
const TITLE_DY = -45;
const NOTE_DY = 63;
const NODE_W = 176;
const NODE_H = 140;
const END_R = 26;

// The gauge is deliberately smaller than a comfortable standalone dial. This
// panel is one block on a busy overview, not the page — at 60px the ring of
// four read as the subject of the screen rather than a status strip.
const GAUGE = 48;
const RING_R = 21.5;
const RING_C = 2 * Math.PI * RING_R;
const HALF_DIAMOND = 24;

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

const CHECKS = ["scope", "assess", "gaps", "remediate"] as const;
type CheckId = (typeof CHECKS)[number];
// "Formally assessed" needs only these three — a gap is allowed to still be
// open, as long as it's on record with a Finding/CAP. Remediation is a further
// bar tracked alongside it, which is why the two sit on separate branches.
const FORMAL_ASSESSMENT_CHECKS = ["scope", "assess", "gaps"] as const;

// Every count is READ, never derived here: Scope from the applicability
// summary, Assessment from statusCounts.unassessed, and Gaps + Remediation
// from review.formalAssessmentForSystem — four independent Complete/Deficient
// checks, not a sequential wizard. The first deficient check in
// scope->assess->gaps->remediate order (the natural workflow sequence) is
// marked as next; the order on screen never reshuffles.
export function AssessmentReadiness({ statusCounts, applicabilitySummary, formalAssessment, onScopeClick, onAssessClick, onGapsClick, onRemediateClick }: AssessmentReadinessProps) {
  const pendingCount = applicabilitySummary?.pending ?? 0;
  const assessmentCount = statusCounts.unassessed ?? 0;
  const gapsMissingCount = formalAssessment.gapControlsMissingFinding.length;
  const remediationCount = formalAssessment.remediationCount;

  // Denominators for the gauges. Each one is the population its own check runs
  // over, so an arc never mixes two questions:
  //   scope     — every control the tier baseline matched, decided or not
  //   assess    — every applicable control, i.e. the whole control matrix
  //   gaps      — every control carrying a gap, recorded or not
  //   remediate — assessed controls, of which the clean ones are the progress
  const decidedCount = (applicabilitySummary?.applicable ?? 0) + (applicabilitySummary?.notApplicable ?? 0);
  const matchedCount = decidedCount + pendingCount;
  const matrixCount = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const assessedCount = matrixCount - assessmentCount;

  const checks: Record<CheckId, {
    icon: LucideIcon; title: string; note: string; complete: boolean; count: number;
    done: number; total: number; onClick: () => void;
  }> = {
    scope: {
      icon: Target,
      title: "Scope Review",
      note: "Controls awaiting a decision",
      complete: pendingCount === 0,
      count: pendingCount,
      done: decidedCount,
      total: matchedCount,
      onClick: onScopeClick,
    },
    assess: {
      icon: ClipboardCheck,
      title: "Control Assessment",
      note: "Controls not yet assessed",
      complete: assessmentCount === 0,
      count: assessmentCount,
      done: assessedCount,
      total: matrixCount,
      onClick: onAssessClick,
    },
    gaps: {
      icon: FileWarning,
      title: "Gaps & CAPs Recorded",
      note: "Gaps without a Finding",
      complete: gapsMissingCount === 0,
      count: gapsMissingCount,
      done: remediationCount - gapsMissingCount,
      total: remediationCount,
      onClick: onGapsClick,
    },
    remediate: {
      icon: Wrench,
      title: "Remediation",
      note: "Items still to fix",
      complete: remediationCount === 0,
      count: remediationCount,
      done: assessedCount - remediationCount,
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
  const splitOpen = checks.assess.complete;

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
        description="Every gap is recorded or fixed. Keep all four clear and the system stays assurance-ready."
        aside={<StatusPill tone={allClear ? "success" : "neutral"}>{doneCount} of {CHECKS.length} complete</StatusPill>}
      />

      <div className="flex flex-col gap-3">
        {allClear ? (
          <Callout tone="success" title="Scoped, assessed, recorded, and remediated.">
            This system is assurance-ready.
          </Callout>
        ) : formallyAssessed ? (
          <Callout tone="success" title="Formally assessed.">
            Scope is decided, every applicable control has been evaluated, and every gap has a Finding/CAP on record.
            {remediationCount > 0 ? ` ${remediationCount} remediation item${remediationCount === 1 ? "" : "s"} still open.` : ""}
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
              <path d={`M124 ${SPINE_Y}H272`} />
            </g>
            <path d={`m268 ${SPINE_Y - 4} 4 4-4 4`} stroke={flow(checks.scope.complete).stroke} />

            <g {...flow(checks.assess.complete)}>
              <path d={`M328 ${SPINE_Y}H400`} />
            </g>
            <path d={`m396 ${SPINE_Y - 4} 4 4-4 4`} stroke={flow(checks.assess.complete).stroke} />

            <g {...flow(splitOpen)}>
              <path d={`M456 ${SPINE_Y}H496V${UPPER_Y}H572`} />
              <path d={`M456 ${SPINE_Y}H496V${LOWER_Y}H572`} />
            </g>
            <path d={`m568 ${UPPER_Y - 4} 4 4-4 4`} stroke={flow(splitOpen).stroke} />
            <path d={`m568 ${LOWER_Y - 4} 4 4-4 4`} stroke={flow(splitOpen).stroke} />

            <g {...flow(checks.gaps.complete)}>
              <path d={`M624 ${UPPER_Y}H706V${SPINE_Y}`} />
            </g>
            <g {...flow(checks.remediate.complete)}>
              <path d={`M624 ${LOWER_Y}H706V${SPINE_Y}`} />
            </g>

            <g {...flow(allClear)}>
              <path d={`M706 ${SPINE_Y}H776`} />
            </g>
            <path d={`m772 ${SPINE_Y - 4} 4 4-4 4`} stroke={flow(allClear).stroke} />

            {/* Parallel split: both tracks run, and both have to come back in. */}
            <path
              d={`M${X.split} ${SPINE_Y - HALF_DIAMOND} ${X.split + HALF_DIAMOND} ${SPINE_Y} ${X.split} ${SPINE_Y + HALF_DIAMOND} ${X.split - HALF_DIAMOND} ${SPINE_Y}Z`}
              fill={splitOpen ? C.greenBg : C.panel}
              stroke={splitOpen ? C.green : C.border}
            />
            <path
              d={`M${X.split} ${SPINE_Y - 8}v16M${X.split - 8} ${SPINE_Y}h16`}
              stroke={splitOpen ? C.green : C.muted}
              strokeWidth={2}
            />
          </svg>

          {node("scope", X.scope, SPINE_Y)}
          {node("assess", X.assess, SPINE_Y)}
          {node("gaps", X.branch, UPPER_Y)}
          {node("remediate", X.branch, LOWER_Y)}

          <div
            className="absolute truncate text-center"
            style={{
              left: X.end - NODE_W / 2,
              top: SPINE_Y + TITLE_DY,
              width: NODE_W,
              fontFamily: WZ.serif,
              fontSize: 13.5,
              fontWeight: 600,
              lineHeight: "17px",
              color: allClear ? C.ink : C.muted,
            }}
          >
            Assurance Ready
          </div>
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: X.end - END_R,
              top: SPINE_Y - END_R,
              width: END_R * 2,
              height: END_R * 2,
              borderRadius: WZ.radius.pill,
              border: `2.5px ${allClear ? "solid" : "dashed"} ${allClear ? C.green : C.border}`,
              background: allClear ? C.greenBg : C.panel,
              color: allClear ? C.green : C.muted,
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div
            className={`${TX.help} absolute text-center`}
            style={{ left: X.end - NODE_W / 2, top: SPINE_Y + NOTE_DY, width: NODE_W, color: C.muted }}
          >
            All four checks clear
          </div>
        </ScaleToFit>
      </div>
    </WizardTokens>
  );
}
