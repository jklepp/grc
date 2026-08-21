import React from "react";
import type { ReactNode } from "react";
import { Rows3 } from "lucide-react";
import { C } from "../../../theme";
import { StatRing } from "../shared/StatRing";
import { CoverageBar } from "../shared/CoverageBar";
import { SectionHeader } from "../shared/SectionHeader";
import { PRISMA_LEVELS } from "../../../graph/nodes/taxonomy";
import { assuranceBand } from "../../../engine/assurance";
import type { WorkspaceSystem } from "../types";

function bandColor(color?: string): string {
  if (color === "red") return C.red;
  if (color === "amber") return C.amber;
  if (color === "green") return C.green;
  return C.muted;
}

// A hero-style tile matching the app's existing gradient "Current Assurance"
// card style — a fixed brand color per metric, not score-driven, so
// Compliance and Assurance stay visually distinct from each other no matter
// what the numbers do.
function ScoreTile({ label, sub, value, pct, gradient }: { label: string; sub: string; value: ReactNode; pct: number | null; gradient: string }) {
  return (
    <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: gradient }}>
      <div className="min-w-0">
        <div className="text-2xl font-semibold text-white" style={{ fontFamily: "'Source Serif 4', serif" }}>{value}</div>
        <div className="text-xs mt-1 text-white/85">{label}</div>
        <div className="text-[11px] mt-0.5 text-white/65">{sub}</div>
      </div>
      <StatRing pct={pct} color="#FFFFFF" trackColor="rgba(255,255,255,0.25)" />
    </div>
  );
}

const ASSURANCE_GRADIENT = `linear-gradient(135deg, ${C.accent} 0%, ${C.accentStrong} 100%)`;
const COMPLIANCE_GRADIENT = `linear-gradient(135deg, ${C.amber} 0%, #2C4A78 100%)`;

// A real curly-brace path (flat back against the grouped rows, tip poking
// left) with an optional horizontal leader line running from the tip back to
// `leaderX` (negative, reaching across the gap to the Compliance/Assurance
// tile it summarizes). `tipY` lets the tip sit off-center within the curve
// so the leader can land level with its tile while the curve itself still
// spans the full row range it's bracketing — a diagonal leader would need
// the whole curve to shift and drift off the rows, so instead only the tip
// moves within a curve that keeps its top/bottom pinned to the row edges.
function CurlyBrace({ height, width, color, strokeWidth = 2, tipY, leaderX }: { height: number; width: number; color: string; strokeWidth?: number; tipY?: number; leaderX?: number }) {
  const tip = tipY ?? height / 2;
  const r = Math.min(width, tip, height - tip) * 0.9;
  const leaderPath = leaderX != null ? `M 0 ${tip} L ${leaderX} ${tip}` : "";
  const d = `
    ${leaderPath}
    M ${width} 0
    C ${width - r} 0, ${width - r} 0, ${width - r} ${r}
    L ${width - r} ${tip - r}
    C ${width - r} ${tip}, 0 ${tip}, 0 ${tip}
    C ${width - r} ${tip}, ${width - r} ${tip}, ${width - r} ${tip + r}
    L ${width - r} ${height - r}
    C ${width - r} ${height}, ${width - r} ${height}, ${width} ${height}
  `;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PrismaLadderProps {
  system: WorkspaceSystem;
  compliance: number | null;
  assurance: number | null;
}

// The Compliance and Assurance tiles read the same five-rung ladder two ways:
// Compliance rests on the bottom three PRISMA levels' credit (Policy,
// Procedure, Implemented — Implemented alone carries 40% of the weight),
// Assurance is the full weighted blend across all five. Not a new score —
// system.levelAverages is the same per-category PRISMA means the engine
// already computes, rolled up one hop further for display.
export function PrismaLadder({ system, compliance, assurance }: PrismaLadderProps) {
  const rows = PRISMA_LEVELS.map((level) => {
    const pct = system.levelAverages[level];
    return { level, pct, color: bandColor(assuranceBand(pct).color) };
  });

  return (
    <div>
      <SectionHeader
        icon={Rows3}
        title="System Posture"
        description="Compliance and Assurance are two readings of the same five-rung maturity ladder, not two different scores — reading top to bottom, Policy to Managed."
      />
      <div className="flex gap-3 items-start">
        <div className="w-[280px] shrink-0 flex flex-col gap-3">
          <ScoreTile label="Compliance" sub="Implemented level" value={compliance == null ? "—" : `${compliance}%`} pct={compliance} gradient={COMPLIANCE_GRADIENT} />
          <ScoreTile label="Assurance" sub="All five PRISMA levels" value={assurance == null ? "—" : `${assurance}%`} pct={assurance} gradient={ASSURANCE_GRADIENT} />
        </div>

        <div className="flex gap-4 items-stretch pt-1 min-w-0 flex-1">
          <div className="relative w-[44px] shrink-0 h-[210px]">
            <div className="absolute" style={{ left: 6, top: 0 }}>
              <CurlyBrace height={122} width={14} color={C.amber} tipY={50} leaderX={-18} />
            </div>
            <div className="absolute" style={{ left: 26, top: 0 }}>
              <CurlyBrace height={210} width={16} color={C.accent} tipY={160} leaderX={-38} />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 flex-1 min-w-0 max-w-[520px]">
            {rows.map((row) => (
              <div key={row.level} className="flex items-center gap-2.5 h-[34px]">
                <div className="w-[92px] shrink-0 text-xs font-semibold" style={{ color: C.ink }}>{row.level}</div>
                <div className="flex-1 min-w-0"><CoverageBar pct={row.pct} color={row.color} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
