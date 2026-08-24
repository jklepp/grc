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

// Ladder geometry — everything in this card (rail spans, tile heights, leader
// positions) derives from these two numbers so the columns can never drift
// out of alignment when a size is tweaked.
const ROW_H = 34;
const ROW_GAP = 10;
const rowSpan = (n: number) => n * ROW_H + (n - 1) * ROW_GAP;
const LADDER_H = rowSpan(PRISMA_LEVELS.length);
const COMPLIANCE_H = rowSpan(3); // Policy through Implemented

// Both tiles stack in one column to the left of the lanes, splitting the
// ladder's height between them, so each rail's leader can leave level with
// the vertical center of the tile it runs to.
const TILE_GAP = 10;
const TILE_H = (LADDER_H - TILE_GAP) / 2;
const COMPLIANCE_LEADER_Y = TILE_H / 2;
const ASSURANCE_LEADER_Y = TILE_H + TILE_GAP + TILE_H / 2;

// Both rails live in one gutter, and the order is load-bearing: Assurance's
// runs on the INSIDE against the lanes because it spans all five rows, and
// Compliance's sits outside it covering only the top three. That way the
// Assurance leader crosses the Compliance rail's column at a height where
// that rail has already ended — no line ever crosses another.
const RAIL_W = 2;
const TICK_W = 5;
const RAIL_GUTTER = 46;
const ASSURANCE_RAIL_X = 34;
const COMPLIANCE_RAIL_X = 18;

// A hero-style tile matching the app's existing gradient "Current Assurance"
// card style — a fixed brand color per metric, not score-driven, so
// Compliance and Assurance stay visually distinct from each other no matter
// what the numbers do. Both tiles are the same fixed height (half the ladder)
// so the pair reads as one stack and each leader has a fixed target.
function ScoreTile({ label, sub, value, pct, gradient }: { label: string; sub: string; value: ReactNode; pct: number | null; gradient: string }) {
  return (
    <div className="rounded-xl px-4 py-3 w-full flex items-center justify-between gap-3" style={{ background: gradient, height: TILE_H }}>
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

// A span rail: a rounded vertical line marking which rungs a tile reads, end
// ticks fixing where that span starts and stops, and a leader running left
// from the rail to the tile's edge. The leader leaves the rail level with its
// tile's center rather than at the rail's own midpoint — a straight rail
// carries an off-center exit without looking lopsided, which is exactly what
// a curly brace could not do once both tiles stacked into one column.
function SpanRail({ height, railX, leaderY, color }: { height: number; railX: number; leaderY: number; color: string }) {
  const bar = (style: React.CSSProperties) => (
    <div className="absolute rounded-full" style={{ background: color, ...style }} />
  );
  return (
    <>
      {bar({ left: railX, top: 0, width: RAIL_W, height })}
      {bar({ left: railX, top: 0, width: TICK_W, height: RAIL_W })}
      {bar({ left: railX, top: height - RAIL_W, width: TICK_W, height: RAIL_W })}
      {bar({ left: 0, top: leaderY - RAIL_W / 2, width: railX + RAIL_W, height: RAIL_W })}
    </>
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
      <div className="flex items-start">
        <div className="w-[220px] shrink-0 flex flex-col" style={{ height: LADDER_H, gap: TILE_GAP }}>
          <ScoreTile label="Compliance" sub="Through Implemented" value={compliance == null ? "—" : `${compliance}%`} pct={compliance} gradient={COMPLIANCE_GRADIENT} />
          <ScoreTile label="Assurance" sub="All five levels" value={assurance == null ? "—" : `${assurance}%`} pct={assurance} gradient={ASSURANCE_GRADIENT} />
        </div>

        <div className="relative shrink-0" style={{ width: RAIL_GUTTER, height: LADDER_H }}>
          <SpanRail height={LADDER_H} railX={ASSURANCE_RAIL_X} leaderY={ASSURANCE_LEADER_Y} color={C.accent} />
          <SpanRail height={COMPLIANCE_H} railX={COMPLIANCE_RAIL_X} leaderY={COMPLIANCE_LEADER_Y} color={C.amber} />
        </div>

        <div className="flex flex-col flex-1 min-w-0 max-w-[420px]" style={{ gap: ROW_GAP }}>
          {rows.map((row) => (
            <div key={row.level} className="flex items-center gap-2.5" style={{ height: ROW_H }}>
              <div className="w-[92px] shrink-0 text-xs font-semibold" style={{ color: C.ink }}>{row.level}</div>
              <div className="flex-1 min-w-0"><CoverageBar pct={row.pct} color={row.color} barHeight={7} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
