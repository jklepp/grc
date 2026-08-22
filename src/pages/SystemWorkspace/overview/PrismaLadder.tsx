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

// Ladder geometry — everything in this card (brace spans, tile heights, brace
// tip positions) derives from these two numbers so the columns can never
// drift out of alignment when a size is tweaked.
const ROW_H = 34;
const ROW_GAP = 10;
const rowSpan = (n: number) => n * ROW_H + (n - 1) * ROW_GAP;
const LADDER_H = rowSpan(PRISMA_LEVELS.length);
const COMPLIANCE_H = rowSpan(3); // Policy through Implemented

// A hero-style tile matching the app's existing gradient "Current Assurance"
// card style — a fixed brand color per metric, not score-driven, so
// Compliance and Assurance stay visually distinct from each other no matter
// what the numbers do. Sized to its content and centered by its flex parent,
// not stretched — each tile now sits alone against the span of rows it reads.
function ScoreTile({ label, sub, value, pct, gradient }: { label: string; sub: string; value: ReactNode; pct: number | null; gradient: string }) {
  return (
    <div className="rounded-xl px-4 py-3 w-full flex items-center justify-between gap-3" style={{ background: gradient }}>
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
// left). Color-matching to the tile does the tile↔brace linking. `tipY`
// lets the tip sit off-center within the curve so it can land level with
// the vertical center of the row range it's bracketing, independent of
// where the tile itself sits. Wrap in `transform: scaleX(-1)` to flip it —
// flat back on the left against the rows, tip poking right toward a tile
// on the other side.
function CurlyBrace({ height, width, color, strokeWidth = 2, tipY }: { height: number; width: number; color: string; strokeWidth?: number; tipY?: number }) {
  const tip = tipY ?? height / 2;
  const r = Math.min(width, tip, height - tip) * 0.9;
  const d = `
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
        description="Two readings of one five-level ladder — Compliance stops at Implemented, Assurance weighs all five."
      />
      <div className="flex gap-3 items-start">
        <div className="w-[220px] shrink-0 flex items-start justify-center" style={{ height: LADDER_H }}>
          <ScoreTile label="Assurance" sub="All five levels" value={assurance == null ? "—" : `${assurance}%`} pct={assurance} gradient={ASSURANCE_GRADIENT} />
        </div>

        <div className="relative w-[20px] shrink-0" style={{ height: LADDER_H }}>
          <div className="absolute" style={{ left: 6, top: 0 }}>
            <CurlyBrace height={LADDER_H} width={14} color={C.accent} tipY={LADDER_H / 2} />
          </div>
        </div>

        <div className="flex flex-col flex-1 min-w-0 max-w-[420px]" style={{ gap: ROW_GAP }}>
          {rows.map((row) => (
            <div key={row.level} className="flex items-center gap-2.5" style={{ height: ROW_H }}>
              <div className="w-[92px] shrink-0 text-xs font-semibold" style={{ color: C.ink }}>{row.level}</div>
              <div className="flex-1 min-w-0"><CoverageBar pct={row.pct} color={row.color} barHeight={7} /></div>
            </div>
          ))}
        </div>

        <div className="relative w-[20px] shrink-0" style={{ height: COMPLIANCE_H }}>
          <div className="absolute" style={{ left: 0, top: 0, transform: "scaleX(-1)" }}>
            <CurlyBrace height={COMPLIANCE_H} width={14} color={C.amber} tipY={COMPLIANCE_H / 2} />
          </div>
        </div>

        <div className="w-[220px] shrink-0 flex items-start justify-center" style={{ height: COMPLIANCE_H }}>
          <ScoreTile label="Compliance" sub="Through Implemented" value={compliance == null ? "—" : `${compliance}%`} pct={compliance} gradient={COMPLIANCE_GRADIENT} />
        </div>
      </div>
    </div>
  );
}
