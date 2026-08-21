import React, { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, ShieldCheck, ArrowRight, AlertTriangle, DollarSign, ClipboardCheck,
  Download, ArrowUpRight, ArrowDownRight, Database, ShieldAlert, PieChart, HardDrive,
  ChevronDown, ChevronUp, Layers, Boxes, Server,
} from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { DATA_SOURCES, TOTAL_RECORDS, TOTAL_DATA_TB, formatRecords, formatTB } from "../data/dataFootprint";
import {
  getAllRisks, ABOVE_APPETITE_COUNT, MATERIAL_RISKS, MATERIAL_RISK_EXPOSURE, QUANTIFIED_EXPOSURE,
  getAllAssets, getAllSystems, getAllDataTypes, getAllEvidence, ALL_FINDINGS, IN_SCOPE_CONTROLS,
  getCategoryAverages, getEnterprise, ENTERPRISE_COVERAGE, ASSURANCE_TARGET, ADEQUATE_THRESHOLD,
  assuranceBand, profileSummary, modelHealth, FINDING_REMEDIATION_STATUS_META, cockpitSummary,
} from "../engine";
import type { SeverityLevel } from "../graph/nodes/risks";
import { PRINCIPLE_DOMAINS, PRINCIPLE_STATUS_COUNTS } from "../data/securityPrinciples";
import { loadExecutions, computeReliability } from "../data/procedureExecutions";
import type { CockpitItem } from "../engine/cockpit";

const RISKS = getAllRisks();
const ASSET_SUMMARIES = getAllAssets();
const CATEGORY_PORTFOLIO_AVERAGES = getCategoryAverages();

// Enterprise Assurance: weighted by each system's FIPS 199 overall impact, so
// a weak High system drags it down harder than a weak Low one and it can't be
// gamed by padding the register with low-impact boundaries.
//
// This page used to compute that weighting here, over the asset list. Correct
// arithmetic, but a second implementation of a rollup the engine also performs
// — and the engine's version rolls up through systems rather than flattening
// every asset into one pool, so the two would not have agreed. Now there is one
// enterprise assurance figure and this is a read of it.
const ENTERPRISE = getEnterprise();
const PORTFOLIO_ASSURANCE_PCT = ENTERPRISE.assurance ?? 0;
const ASSURANCE_GAP = PORTFOLIO_ASSURANCE_PCT - ASSURANCE_TARGET;

// How much of the applicable control estate the number above is speaking for.
//
// This is the figure that has to sit beside the score from now on. Under the
// old model every in-scope control fell back to a category judgment, so
// "covered" was near 100% and said almost nothing. Now a control is scored only
// if it was actually assessed, and the honest answer is that roughly a fifth of
// the applicable set has been — which is what a real engagement looks like, and
// what the old single number was concealing.
const ASSESSMENT_COVERAGE_PCT = ENTERPRISE.coverage.assessedPct;
const ASSESSED_COUNT = ENTERPRISE.coverage.assessed;
const APPLICABLE_COUNT = ENTERPRISE.coverage.applicable;
const INHERITED_COUNT = ENTERPRISE.coverage.inherited;

// Of the controls that WERE assessed, how many are holding.
const COMPLIANCE_COVERAGE_PCT = ENTERPRISE_COVERAGE.coveredPct;

// Only the last point is real — pinned to the live computed metric above, so
// it can't drift out of sync with the actual register. Everything before it
// is an illustrative run-up (no history is actually persisted anywhere in
// this app), shaped to land on today's number rather than a separately
// hand-typed series that could someday disagree with it. Used for the one
// headline delta this page shows ("+N pts vs last quarter"), not a sparkline.
function trendTo(current: number, stepsBack: number[]): number[] {
  return stepsBack.map((delta) => Math.max(0, Math.min(100, current - delta)));
}
const ASSURANCE_TREND = trendTo(PORTFOLIO_ASSURANCE_PCT, [10, 7, 5, 3, 2, 0]);
const ASSURANCE_DELTA = ASSURANCE_TREND[ASSURANCE_TREND.length - 1] - ASSURANCE_TREND[0];

// Control Assurance by Category: the real 6 Assurance Categories, averaged
// across every asset in the register — the same categories the Asset
// Register's detail panel breaks each asset down into. Computed once in
// assets.js (portfolioCategoryAverages) so the Risk Register's board view
// can cite the identical numbers for its per-risk assurance figure.
const CATEGORY_AVERAGES = CATEGORY_PORTFOLIO_AVERAGES;
const WEAKEST_CATEGORY = [...CATEGORY_AVERAGES].sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))[0];
const STRONGEST_CATEGORY = [...CATEGORY_AVERAGES].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))[0];

// WEAKEST_ASSET and ASSETS_BELOW_TARGET are gone. An asset no longer carries a
// score to be weakest by or to fall below a target, and naming a container was
// always the vaguer statement: "the vector database is weakest" does not tell
// anybody what to fix. The weakest CONTROL names the requirement that is
// failing, and its sampled instances name the asset anyway.
const WEAKEST_CONTROL = ENTERPRISE.weakestControl;
const CONTROLS_BELOW_TARGET = ENTERPRISE.controlsBelowTarget;

// The three riskiest scenarios, from the register, rather than the three assets
// with the highest residual score — residual risk is computed per risk now,
// from the controls mapped to it.
const HIGHEST_RESIDUAL_RISKS = [...RISKS].sort((a, b) => b.residualScore - a.residualScore).slice(0, 3);

// Exposure by System: share of total records/transactions each vendor holds —
// the one figure all four Data Footprint vendors report, so no vendor needs
// an invented weighting to appear here.
const EXPOSURE_BY_SYSTEM = [...DATA_SOURCES]
  .map((s) => ({ name: s.name, pct: Math.round((s.records / TOTAL_RECORDS) * 1000) / 10 }))
  .sort((a, b) => b.pct - a.pct);
const TOP2_SYSTEM_CONCENTRATION = Math.round(EXPOSURE_BY_SYSTEM.slice(0, 2).reduce((a, s) => a + s.pct, 0) * 10) / 10;
const RESTRICTED_ASSET_COUNT = ASSET_SUMMARIES.filter((a) => a.classification === "Restricted").length;

// Decisions Required: risks already flagged `escalated` in the real Risk
// Register — not a hand-typed action list that can drift from what the
// register actually says needs leadership attention.
const DECISIONS_REQUIRED = [...RISKS].filter((r) => r.escalated).sort((a, b) => b.exposure - a.exposure);
// ---- New headline data (see plan: everything below is a page-level join over
// existing engine exports, not a new derivation) ---------------------------

// Each system judged against ITS OWN tier target, not the flat enterprise
// ASSURANCE_TARGET — a Public boundary and a Restricted one don't clear the
// same bar, and profileSummary() already knows which applies.
const SYSTEMS = getAllSystems();
const SYSTEM_PROFILES = SYSTEMS.map((system) => ({ system, summary: profileSummary(system.id) }));
const SYSTEMS_BELOW_TARGET = SYSTEM_PROFILES.filter(({ summary }) => summary && !summary.clears);

// Evidence Confidence / Evidence Health: the model's own two-state freshness
// split (each record's `stale` flag, judged against ITS OWN validForDays) —
// not an invented fixed-day bucket scheme the model doesn't otherwise use.
// Computed once and shown twice (the KPI and the donut) so they can't disagree.
const ALL_EVIDENCE = getAllEvidence();
const EVIDENCE_CURRENT = ALL_EVIDENCE.filter((e) => !e.stale);
const EVIDENCE_CURRENT_PCT = ALL_EVIDENCE.length === 0 ? 0 : Math.round((EVIDENCE_CURRENT.length / ALL_EVIDENCE.length) * 100);
const EVIDENCE_BAND = assuranceBand(EVIDENCE_CURRENT_PCT);

// Findings ranked overdue-first, each carrying whether it's tied to a
// board-material risk — both real facts (`overdue` and `riskIds` already come
// off the finding), not an invented severity field.
const MATERIAL_RISK_IDS = new Set(MATERIAL_RISKS.map((r) => r.id));
const PRIORITIZED_FINDINGS = [...ALL_FINDINGS]
  .map((f) => ({ ...f, material: f.riskIds.some((id) => MATERIAL_RISK_IDS.has(id)) }))
  .sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });

// ---- Operational Readiness lane: how ready the operation behind the score
// is — procedures, principles, and system-level hygiene — a second
// page-level join, same convention as the section above, over exports that
// already exist for the Procedure Library, Security Principles, and System
// Register cockpit pages. Nothing here is a new derivation.

// The same "clean run" definition ProcedureLibrary uses for one procedure at
// a time, rolled up across every procedure's execution history. Null (not a
// fabricated 0%) until at least one run has completed anywhere.
const ALL_EXECUTIONS = Object.values(loadExecutions()).flat();
const SOP_RELIABILITY = computeReliability(ALL_EXECUTIONS);

// The Security Principles library's own operationalized/partial/not-yet
// split — read here, not re-derived.
const PRINCIPLES_OPERATIONALIZED_PCT = Math.round((100 * PRINCIPLE_STATUS_COUNTS.operationalized) / PRINCIPLE_STATUS_COUNTS.total);
const PRINCIPLES_PARTIAL_PCT = Math.round((100 * PRINCIPLE_STATUS_COUNTS.partial) / PRINCIPLE_STATUS_COUNTS.total);
const PRINCIPLES_NOT_OPERATIONALIZED_PCT = Math.round((100 * PRINCIPLE_STATUS_COUNTS["not-operationalized"]) / PRINCIPLE_STATUS_COUNTS.total);
const PRINCIPLE_DOMAINS_WITH_GAP = PRINCIPLE_DOMAINS.filter((d) => d.principles.some((p) => p.status !== "operationalized")).length;

// Each system's own "attention required" list, already computed by
// cockpitSummary() for the System Overview page — filtered to the
// operational domains (security testing, resilience, IR, vendor assurance,
// identity review cadence, vulnerability SLAs, network exposure) rather than
// the control-assurance/risk/findings domains the Assurance lane above
// already covers, so nothing repeats what's already on screen.
const OPERATIONAL_DOMAINS = new Set([
  "Security Testing", "Resilience", "Incident Response", "Vendor Assurance", "Identity & Access", "Vulnerability", "Exposure",
]);
const SYSTEM_OPERATIONAL_ITEMS: { system: (typeof SYSTEMS)[number]; items: CockpitItem[] }[] = SYSTEMS
  .map((system) => ({ system, items: cockpitSummary(system.id).attentionRequired.filter((item) => OPERATIONAL_DOMAINS.has(item.domain)) }))
  .filter(({ items }) => items.length > 0);

function operationalSeverityColor(severity: CockpitItem["severity"]): { color: string; bg: string } {
  if (severity === "critical" || severity === "high") return { color: C.red, bg: C.redBg };
  if (severity === "medium") return { color: C.amber, bg: C.amberBg };
  return { color: C.muted, bg: C.panel2 };
}

function dashboardColor(key: string): string {
  if (key === "green" || key === "amber" || key === "red" || key === "accent" || key === "muted" || key === "ink" || key === "na") return C[key];
  return C.muted;
}

function dashboardBackground(key: string): string {
  if (key === "green") return C.greenBg;
  if (key === "amber") return C.amberBg;
  if (key === "red") return C.redBg;
  if (key === "accent") return C.accentBg;
  return C.panel2;
}

function findingPriority(f: (typeof PRIORITIZED_FINDINGS)[number]): { label: string; color: string; bg: string } {
  if (f.overdue) return { label: "Overdue", color: C.red, bg: C.redBg };
  if (f.material) return { label: "Material Risk", color: C.red, bg: C.redBg };
  const meta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus] ?? { label: f.remediationStatus, color: "muted" };
  return { label: meta.label, color: dashboardColor(meta.color), bg: dashboardBackground(meta.color) };
}

// Enterprise-wide mean per PRISMA level, across every scored assessment —
// already computed by modelHealth() as its "which rung is the programme
// missing" gap detector. Reused here rather than re-averaged, so this page and
// modelHealth() can't report two different Policy/Procedure/.../Managed splits.
const PRISMA_LEVEL_AVERAGES = modelHealth().levelWeakness;

function prismaLevelColor(mean: number | null): string {
  if (mean == null) return C.na;
  if (mean >= 90) return C.green;
  if (mean >= 60) return C.accent;
  if (mean >= 25) return C.amber;
  return C.red;
}

const DATA_TYPES_COUNT = getAllDataTypes().length;

function severityColor(sev: SeverityLevel): string {
  if (sev === "Severe") return C.red;
  if (sev === "Major") return C.amber;
  return C.green;
}
function formatUSD(n: number): string {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`;
}

function handleExport() {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    enterpriseAssurance: PORTFOLIO_ASSURANCE_PCT,
    assuranceTarget: ASSURANCE_TARGET,
    systemsBelowTarget: SYSTEMS_BELOW_TARGET.length,
    systemCount: SYSTEMS.length,
    evidenceConfidencePct: EVIDENCE_CURRENT_PCT,
    materialRisks: MATERIAL_RISKS.map((r) => ({ id: r.id, scenario: r.boardLabel, severity: r.residual.severity, exposure: r.exposure, owner: r.owner })),
    materialRiskExposure: MATERIAL_RISK_EXPOSURE,
    totalExposure: QUANTIFIED_EXPOSURE,
    risksAboveAppetite: ABOVE_APPETITE_COUNT,
    openFindings: PRIORITIZED_FINDINGS.length,
    decisionsRequired: DECISIONS_REQUIRED.map((r) => ({ id: r.id, scenario: r.scenario, owner: r.owner, exposure: r.exposure })),
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acme-assurance-overview-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function Pill({ text, color, bg }: { text: ReactNode; color: string; bg: string }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color, background: bg }}>
      {text}
    </span>
  );
}

// Hand-rolled SVG ring, same "no chart library" convention the rest of this
// app already uses (see the old Sparkline this replaced) rather than pulling
// in the unused recharts dependency for one shape. trackColor/textColor are
// overridable so the same ring can sit on the dark hero tile below as well as
// the plain panel background in Assurance Overview.
function AssuranceRing({ pct, color, size = 112, trackColor, textColor }: { pct: number; color: string; size?: number; trackColor?: string; textColor?: string }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor ?? C.panel2} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0 }} className="flex items-center justify-center">
        <span className="text-2xl font-semibold" style={{ color: textColor ?? C.ink, fontFamily: "'Source Serif 4', serif" }}>{pct}%</span>
      </div>
    </div>
  );
}

// A multi-segment version of the ring above, for the two headline donuts
// (Assessment Coverage, Evidence Health) that need to show a split rather than
// one value against its remainder.
interface DonutSegment { pct: number; color: string }
function Donut({ segments, size = 104, centerValue, centerLabel }: { segments: DonutSegment[]; size?: number; centerValue: ReactNode; centerLabel?: ReactNode }) {
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let drawn = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.panel2} strokeWidth={stroke} />
        {segments.filter((s) => s.pct > 0).map((s, i) => {
          const len = circumference * (s.pct / 100);
          const dashoffset = -drawn;
          drawn += len;
          return (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${circumference - len}`} strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0 }} className="flex flex-col items-center justify-center">
        <span className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{centerValue}</span>
        {centerLabel && <span className="text-[10px] mt-0.5" style={{ color: C.muted }}>{centerLabel}</span>}
      </div>
    </div>
  );
}

function SummaryTile({ icon: Icon, iconColor, iconBg, label, value, children }: { icon: LucideIcon; iconColor: string; iconBg: string; label: ReactNode; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon size={20} color={iconColor} />
        </div>
        <div className="text-sm font-medium leading-tight" style={{ color: C.muted }}>{label}</div>
      </div>
      <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      {children}
    </div>
  );
}

// Enterprise Assurance is the one figure everything else on the page rolls up
// to, so it gets the dark gradient treatment and the ring visual (rather than
// the flat SummaryTile the other three KPIs use) and spans two grid columns
// instead of one — the same accent gradient the old Composite Score hero card
// used, brought back specifically for this tile.
function HeroAssuranceTile({ pct, target, gap }: { pct: number; target: number; gap: number }) {
  return (
    <div
      className="col-span-2 rounded-xl p-6 flex items-center gap-6"
      style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentStrong} 100%)` }}
    >
      <AssuranceRing pct={pct} color="#FFFFFF" trackColor="rgba(255,255,255,0.25)" textColor="#FFFFFF" size={104} />
      <div>
        <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>Enterprise Assurance</div>
        <div className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.75)" }}>Target {target}</div>
        <div className="text-base font-semibold mt-1" style={{ color: "#FFFFFF" }}>
          {gap >= 0 ? `+${gap}` : gap} vs target
        </div>
      </div>
    </div>
  );
}

// A left-to-right bar, same shape as the "Exposure by System" / "Control
// Assurance by Category" bars elsewhere on this page, with a tick marking
// where the system's own tier target sits — so a system's score reads at a
// glance against its bar rather than as two bare numbers.
function ScoreBar({ score, target, clears }: { score: number | null; target: number | null; clears: boolean }) {
  const color = clears ? C.green : C.red;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const targetPct = target == null ? null : Math.max(0, Math.min(100, target));
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        {targetPct != null && (
          <div className="absolute top-0 bottom-0" style={{ left: `${targetPct}%`, width: 2, background: C.ink, opacity: 0.6 }} />
        )}
      </div>
      <div className="w-16 shrink-0 text-right text-sm font-semibold" style={{ color: C.ink }}>{score} / {target ?? "—"}</div>
    </div>
  );
}

function GlanceStat({ icon: Icon, value, label, warn = false }: { icon: LucideIcon; value: ReactNode; label: ReactNode; warn?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center p-3">
      <div className="w-11 h-11 rounded-full flex items-center justify-center mb-2" style={{ background: warn ? C.amberBg : C.accentBg }}>
        <Icon size={18} color={warn ? C.amber : C.accent} />
      </div>
      <div className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      <div className="text-[11px] mt-1" style={{ color: C.muted }}>{label}</div>
    </div>
  );
}

export default function ExecutiveDashboard({ onNavigate }: { onNavigate?: (pageId: string) => void }) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={LayoutDashboard}
        title="Assurance Overview"
        right={
          <div className="flex items-center gap-2">
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>2026</div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
              style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}
              title="Download a JSON snapshot of the numbers on this page"
            >
              <Download size={13} /> Export
            </button>
          </div>
        }
      />

      {/* Lane 1: Assurance — how strong is the control environment. */}
      <div className="px-8 pt-2 pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} color={C.accent} />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.accent }}>Assurance</span>
        </div>
        <div className="text-xs mt-1" style={{ color: C.muted, marginLeft: 23 }}>How strong is the control environment — scores, coverage, and risk exposure.</div>
      </div>

      {/* KPI strip — Enterprise Assurance is the hero everything else rolls up
          to, so it gets a double-wide dark tile; the other three stay flat. */}
      <div className="px-8 grid grid-cols-5 gap-5">
        <HeroAssuranceTile pct={PORTFOLIO_ASSURANCE_PCT} target={ASSURANCE_TARGET} gap={ASSURANCE_GAP} />

        <SummaryTile
          icon={AlertTriangle} iconColor={C.red} iconBg={C.redBg}
          label="Systems Below Target"
          value={<>{SYSTEMS_BELOW_TARGET.length}<span className="text-lg font-normal" style={{ color: C.muted }}> / {SYSTEMS.length}</span></>}
        >
          <div className="text-[11px] mt-2" style={{ color: C.muted }}>
            {SYSTEMS_BELOW_TARGET.length === 0 ? "Every system clears its tier target" : "of tracked systems"}
          </div>
        </SummaryTile>

        <SummaryTile
          icon={DollarSign} iconColor={C.amber} iconBg={C.amberBg}
          label="Material Risks Above Appetite"
          value={MATERIAL_RISKS.length}
        >
          <div className="text-xs mt-2 font-medium" style={{ color: C.red }}>{formatUSD(MATERIAL_RISK_EXPOSURE)} exposure</div>
        </SummaryTile>

        <SummaryTile
          icon={ClipboardCheck} iconColor={C.green} iconBg={C.greenBg}
          label="Evidence Confidence"
          value={`${EVIDENCE_CURRENT_PCT}%`}
        >
          <div className="text-xs mt-2 font-medium" style={{ color: dashboardColor(EVIDENCE_BAND.color) }}>{EVIDENCE_BAND.label}</div>
        </SummaryTile>
      </div>

      {/* System Exposure + What Needs Attention */}
      <div className="px-8 pt-5 grid grid-cols-5 gap-5">
        <div className="col-span-3 rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>System Exposure</div>
          <div className="text-[11px] mb-3" style={{ color: C.muted }}>Each system's assurance against the target its own data classification sets. The tick marks the target.</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>
                <th className="text-left font-medium pb-2">System</th>
                <th className="text-left font-medium pb-2 pl-3">Score</th>
                <th className="text-right font-medium pb-2 pl-3">Gap</th>
                <th className="text-right font-medium pb-2 pl-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_PROFILES.map(({ system, summary }) => {
                const target = summary?.target ?? null;
                const gap = target == null ? null : (system.overallAssurance ?? 0) - target;
                const clears = !!summary?.clears;
                return (
                  <tr key={system.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="py-3 pr-2 whitespace-nowrap" style={{ color: C.ink, fontWeight: 500 }}>{system.name}</td>
                    <td className="py-3 pl-3" style={{ minWidth: 180 }}>
                      <ScoreBar score={system.overallAssurance} target={target} clears={clears} />
                    </td>
                    <td className="py-3 text-right pl-3 font-medium" style={{ color: gap == null ? C.muted : gap >= 0 ? C.green : C.red }}>
                      {gap == null ? "—" : gap >= 0 ? `+${gap}` : gap}
                    </td>
                    <td className="py-3 text-right pl-3">
                      <Pill text={clears ? "On Target" : "Needs Attention"} color={clears ? C.green : C.red} bg={clears ? C.greenBg : C.redBg} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="col-span-2 rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>What Needs Attention</div>
          <div className="text-[11px] mb-3" style={{ color: C.muted }}>Open findings, overdue and material-risk-linked first.</div>
          {PRIORITIZED_FINDINGS.length === 0 ? (
            <div className="text-xs" style={{ color: C.muted }}>No open findings right now.</div>
          ) : (
            <div className="space-y-2.5">
              {PRIORITIZED_FINDINGS.slice(0, 3).map((f) => {
                const priority = findingPriority(f);
                return (
                  <div key={f.id} className="flex items-start gap-2.5 rounded-lg p-3" style={{ background: C.panel2 }}>
                    <AlertTriangle size={14} color={priority.color} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-snug" style={{ color: C.ink }}>{f.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: C.muted }}>{f.systemId} · {f.ownerName} · due {f.due}</div>
                    </div>
                    <Pill text={priority.label} color={priority.color} bg={priority.bg} />
                  </div>
                );
              })}
              {PRIORITIZED_FINDINGS.length > 3 && (
                <div className="text-[11px] pt-0.5" style={{ color: C.muted }}>+{PRIORITIZED_FINDINGS.length - 3} more open finding{PRIORITIZED_FINDINGS.length - 3 === 1 ? "" : "s"}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assessment Coverage + Control Maturity + Control Assurance by Category */}
      <div className="px-8 pt-5 grid grid-cols-3 gap-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-4" style={{ color: C.ink }}>Assessment Coverage</div>
          <div className="flex items-center gap-5">
            <Donut segments={[{ pct: ASSESSMENT_COVERAGE_PCT, color: C.accent }]} centerValue={`${ASSESSMENT_COVERAGE_PCT}%`} />
            <div className="text-xs" style={{ color: C.muted }}>
              <div className="text-base" style={{ color: C.ink, fontWeight: 600 }}>{ASSESSED_COUNT} / {APPLICABLE_COUNT}</div>
              Assessed Controls
            </div>
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Control Maturity</div>
            <span className="text-[10px]" style={{ color: C.muted }}>Enterprise Average</span>
          </div>
          <div className="space-y-3">
            {PRISMA_LEVEL_AVERAGES.map((l) => (
              <div key={l.level}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: C.ink }}>{l.level}</span>
                  <span style={{ color: C.muted, fontWeight: 600 }}>{l.mean == null ? "—" : `${l.mean}%`}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                  <div className="h-full rounded-full" style={{ width: `${l.mean ?? 0}%`, background: prismaLevelColor(l.mean) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-4" style={{ color: C.ink }}>Control Assurance by Category</div>
          <div className="space-y-3">
            {CATEGORY_AVERAGES.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs" style={{ color: C.ink }}>{d.label}</div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                  <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: C.accent }} />
                </div>
                <div className="w-9 text-right text-xs font-medium" style={{ color: C.ink }}>{d.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enterprise Visibility */}
      <div className="px-8 pt-5">
        <div className="rounded-xl p-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="grid grid-cols-5">
            <GlanceStat icon={Layers} value={ENTERPRISE.systemCount} label="Systems" />
            <GlanceStat icon={Boxes} value={ENTERPRISE.assetCount} label="Assets" />
            <GlanceStat icon={Database} value={DATA_TYPES_COUNT} label="Sensitive Data Types" />
            <GlanceStat icon={ShieldCheck} value={IN_SCOPE_CONTROLS.length} label="Controls" />
            <GlanceStat icon={ClipboardCheck} value={`${ENTERPRISE.controlBackedPct}%`} label="Evidence Coverage" />
          </div>
        </div>
      </div>

      {/* Footer CTAs */}
      <div className="px-8 pt-5 flex items-center gap-3">
        <button
          onClick={() => onNavigate && onNavigate("risk-register")}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg"
          style={{ border: `1px solid ${C.border}`, color: C.ink }}
        >
          <AlertTriangle size={13} /> View Risk
        </button>
      </div>

      {/* Lane divider */}
      <div className="px-8 pt-8">
        <div style={{ height: 1, background: C.border }} />
      </div>

      {/* Lane 2: Operational Readiness — how ready is the operation behind
          the score. */}
      <div className="px-8 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <Server size={15} color={C.accent} />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.accent }}>Operational Readiness</span>
        </div>
        <div className="text-xs mt-1" style={{ color: C.muted, marginLeft: 23 }}>How ready is the operation behind the score — procedures, principles, and system hygiene.</div>
      </div>

      {/* SOP Reliability + Security Principles + Systems Flagged */}
      <div className="px-8 grid grid-cols-3 gap-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>SOP Reliability</div>
          <div className="text-[11px] mb-3" style={{ color: C.muted }}>Clean vs. exception-flagged runs recorded this session.</div>
          {SOP_RELIABILITY === null ? (
            <div className="text-xs" style={{ color: C.muted }}>No procedure runs completed yet — reliability has no empirical basis until at least one run finishes.</div>
          ) : (
            <div className="flex items-center gap-5">
              <Donut
                segments={[
                  { pct: SOP_RELIABILITY.reliabilityPct, color: C.green },
                  { pct: 100 - SOP_RELIABILITY.reliabilityPct, color: C.amber },
                ]}
                centerValue={`${SOP_RELIABILITY.reliabilityPct}%`}
              />
              <div className="text-xs space-y-1.5" style={{ color: C.muted }}>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.green }} /> Clean ({SOP_RELIABILITY.cleanRuns})</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.amber }} /> Exception flagged ({SOP_RELIABILITY.completedRuns - SOP_RELIABILITY.cleanRuns})</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Security Principles Operationalized</div>
          <div className="text-[11px] mb-3" style={{ color: C.muted }}>{PRINCIPLE_STATUS_COUNTS.total} principles across {PRINCIPLE_DOMAINS.length} domains.</div>
          <div className="flex items-center gap-5">
            <Donut
              segments={[
                { pct: PRINCIPLES_OPERATIONALIZED_PCT, color: C.green },
                { pct: PRINCIPLES_PARTIAL_PCT, color: C.amber },
                { pct: PRINCIPLES_NOT_OPERATIONALIZED_PCT, color: C.red },
              ]}
              centerValue={`${PRINCIPLES_OPERATIONALIZED_PCT}%`}
            />
            <div className="text-xs space-y-1.5" style={{ color: C.muted }}>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.green }} /> Operationalized ({PRINCIPLE_STATUS_COUNTS.operationalized})</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.amber }} /> Partial ({PRINCIPLE_STATUS_COUNTS.partial})</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.red }} /> Not yet ({PRINCIPLE_STATUS_COUNTS["not-operationalized"]})</div>
            </div>
          </div>
          <div className="text-[11px] mt-3 pt-2.5" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
            {PRINCIPLE_DOMAINS_WITH_GAP} of {PRINCIPLE_DOMAINS.length} domains carry a gap
          </div>
        </div>

        <SummaryTile
          icon={Server} iconColor={C.red} iconBg={C.redBg}
          label="Systems Flagged"
          value={<>{SYSTEM_OPERATIONAL_ITEMS.length}<span className="text-lg font-normal" style={{ color: C.muted }}> / {SYSTEMS.length}</span></>}
        >
          <div className="text-[11px] mt-2" style={{ color: C.muted }}>
            {SYSTEM_OPERATIONAL_ITEMS.length === 0 ? "no system carries an open operational-readiness flag" : "carry an open operational-readiness flag — see below"}
          </div>
        </SummaryTile>
      </div>

      {/* Systems Needing Operational Attention */}
      <div className="px-8 pt-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Systems Needing Operational Attention</div>
          <div className="text-[11px] mb-3" style={{ color: C.muted }}>From the System Register cockpit — resilience, vulnerability, testing, vendor, and identity posture per system.</div>
          {SYSTEM_OPERATIONAL_ITEMS.length === 0 ? (
            <div className="text-xs" style={{ color: C.muted }}>No system carries an open operational-readiness flag right now.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>
                  <th className="text-left font-medium pb-2">System</th>
                  <th className="text-left font-medium pb-2 pl-3">Flags</th>
                </tr>
              </thead>
              <tbody>
                {SYSTEM_OPERATIONAL_ITEMS.map(({ system, items }) => (
                  <tr key={system.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td className="py-3 pr-2 align-top whitespace-nowrap" style={{ color: C.ink, fontWeight: 500 }}>{system.name}</td>
                    <td className="py-3 pl-3">
                      <div className="flex flex-col gap-2">
                        {items.map((item, i) => {
                          const sev = operationalSeverityColor(item.severity);
                          return (
                            <div key={i} className="flex items-start gap-2">
                              <Pill text={item.label} color={sev.color} bg={sev.bg} />
                              <span className="text-xs" style={{ color: C.muted }}>{item.detail}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Supporting detail toggle */}
      <div className="px-8 pt-6">
        <button
          onClick={() => setShowDetail((v) => !v)}
          className="w-full flex items-center gap-3"
        >
          <span style={{ flex: 1, height: 1, background: C.border }} />
          <span
            className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: C.muted }}
          >
            {showDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showDetail ? "Hide" : "Show"} supporting detail
          </span>
          <span style={{ flex: 1, height: 1, background: C.border }} />
        </button>
      </div>

      {showDetail && (
      <>
      {/* Material Enterprise Risks + Decisions Required — the risk-register-level
          detail behind the headline Material Risks KPI and What Needs Attention
          list above. */}
      <div className="px-8 pt-5 grid grid-cols-5 gap-5">
        <div className="col-span-3 rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Material Enterprise Risks</div>
            <button
              onClick={() => onNavigate && onNavigate("risk-register")}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              View Risk Register <ArrowRight size={12} />
            </button>
          </div>
          <div className="text-[11px] mb-3" style={{ color: C.muted }}>Residual severity Severe and still above the org's appetite for that risk.</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>
                <th className="text-left font-medium pb-2">Risk</th>
                <th className="text-left font-medium pb-2">Severity</th>
                <th className="text-right font-medium pb-2">Exposure</th>
                <th className="text-right font-medium pb-2 pl-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {MATERIAL_RISKS.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onNavigate && onNavigate("risk-register")}
                  className="cursor-pointer hover:bg-black/[0.02]"
                  style={{ borderTop: `1px solid ${C.border}` }}
                >
                  <td className="py-3 pr-2" style={{ color: C.ink, fontWeight: 500 }}>{r.boardLabel}</td>
                  <td className="py-3"><Pill text={r.residual.severity.toUpperCase()} color={severityColor(r.residual.severity)} bg={`${severityColor(r.residual.severity)}22`} /></td>
                  <td className="py-3 text-right" style={{ color: C.ink, fontWeight: 600 }}>{formatUSD(r.exposure)}</td>
                  <td className="py-3 text-right pl-3">
                    {r.treatmentAtRisk ? <ArrowUpRight size={16} color={C.red} className="inline" /> : <ArrowDownRight size={16} color={C.green} className="inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs mt-3 flex items-center gap-1.5" style={{ color: C.red }}>
            <AlertTriangle size={12} /> {MATERIAL_RISKS.length} risks exceed enterprise appetite
          </div>
        </div>

        <div className="col-span-2 rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Decisions Required</div>
            <button
              onClick={() => onNavigate && onNavigate("risk-register")}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              View All <ArrowRight size={12} />
            </button>
          </div>
          {DECISIONS_REQUIRED.length === 0 ? (
            <div className="text-xs" style={{ color: C.muted }}>No escalated risks pending review right now.</div>
          ) : (
            <div className="space-y-3">
              {DECISIONS_REQUIRED.map((r) => (
                <div key={r.id} className="rounded-lg p-3.5" style={{ background: C.redBg, border: `1px solid ${C.red}33` }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} color={C.red} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: C.ink }}>{r.scenario}</div>
                      <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                        Escalated · residual {r.residual.severity}/{r.residual.likelihood}{r.treatmentAtRisk ? " · mitigation behind schedule" : ""}
                      </div>
                      <div className="text-xs mt-1 flex items-center justify-between">
                        <span style={{ color: C.ink, fontWeight: 600 }}>{formatUSD(r.exposure)} exposure</span>
                        <button
                          onClick={() => onNavigate && onNavigate("risk-register")}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-md"
                          style={{ background: C.red, color: "#fff" }}
                        >
                          Review Decision
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* What Changed + Assurance Overview */}
      <div className="px-8 pt-5 grid grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-4" style={{ color: C.ink }}>What Changed</div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {ASSURANCE_DELTA >= 0 ? <ArrowUpRight size={16} color={C.green} className="shrink-0 mt-0.5" /> : <ArrowDownRight size={16} color={C.red} className="shrink-0 mt-0.5" />}
              <div>
                <div className="text-sm font-medium" style={{ color: C.ink }}>Enterprise Assurance {ASSURANCE_DELTA >= 0 ? "improved" : "declined"} {Math.abs(ASSURANCE_DELTA)} points</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{STRONGEST_CATEGORY.label} is the strongest category platform-wide at {STRONGEST_CATEGORY.pct}%.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} color={C.amber} className="shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium" style={{ color: C.ink }}>{WEAKEST_CATEGORY.label} remains the weakest category at {WEAKEST_CATEGORY.pct}%</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                  Below the {ADEQUATE_THRESHOLD}% target
                  {WEAKEST_CONTROL ? <>, weakest at {WEAKEST_CONTROL.controlId} — {WEAKEST_CONTROL.control.name} ({WEAKEST_CONTROL.score}) on {WEAKEST_CONTROL.systemId}</> : null}.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign size={16} color={C.red} className="shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium" style={{ color: C.ink }}>{MATERIAL_RISKS[0].boardLabel} remains the top material risk</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{formatUSD(MATERIAL_RISKS[0].exposure)} modeled exposure, owned by {MATERIAL_RISKS[0].owner}.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Assurance Overview</div>
            <button
              onClick={() => onNavigate && onNavigate("control-profile")}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              Explore Assurance <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex items-center gap-6">
            <AssuranceRing pct={PORTFOLIO_ASSURANCE_PCT} color={C.accent} />
            <div className="flex-1 space-y-2.5 text-xs">
              <div className="flex items-center justify-between"><span style={{ color: C.muted }}>TARGET</span><span style={{ color: C.ink, fontWeight: 600 }}>{ASSURANCE_TARGET}%</span></div>
              <div className="flex items-center justify-between"><span style={{ color: C.muted }}>WEAKEST AREA</span><span style={{ color: C.red, fontWeight: 600 }}>{WEAKEST_CATEGORY.label} {WEAKEST_CATEGORY.pct}%</span></div>
              <div className="flex items-center justify-between"><span style={{ color: C.muted }}>STRONGEST AREA</span><span style={{ color: C.green, fontWeight: 600 }}>{STRONGEST_CATEGORY.label} {STRONGEST_CATEGORY.pct}%</span></div>
              <div className="flex items-center justify-between"><span style={{ color: C.muted }}>OF ASSESSED, HOLDING</span><span style={{ color: C.ink, fontWeight: 600 }}>{COMPLIANCE_COVERAGE_PCT}%</span></div>
              <div className="flex items-center justify-between"><span style={{ color: C.muted }}>ASSESSMENT COVERAGE</span><span style={{ color: C.ink, fontWeight: 600 }}>{ASSESSMENT_COVERAGE_PCT}%</span></div>
            </div>
          </div>
          <div className="text-xs mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
            Controls below {ASSURANCE_TARGET} target <span style={{ color: C.ink, fontWeight: 600 }}>{CONTROLS_BELOW_TARGET}</span>
          </div>
          <div className="text-[11px] mt-2 leading-relaxed" style={{ color: C.muted }}>
            Derived from {ASSESSED_COUNT} of {APPLICABLE_COUNT} applicable controls ({INHERITED_COUNT} inherited
            from providers). The remainder were not assessed and are reported as gaps, not scored as zero.
          </div>
        </div>
      </div>

      {/* Data Exposure at a Glance */}
      <div className="px-8 pt-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Data Exposure at a Glance</div>
            <button
              onClick={() => onNavigate && onNavigate("data-footprint")}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              Explore Data Footprint <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <GlanceStat icon={Database} value={formatRecords(TOTAL_RECORDS)} label="Total Records Tracked" />
            <GlanceStat icon={ShieldAlert} value={RESTRICTED_ASSET_COUNT} label="Restricted-Tier Systems" />
            <GlanceStat icon={PieChart} value={`${TOP2_SYSTEM_CONCENTRATION}%`} label="Data in Top 2 Systems" warn />
            <GlanceStat icon={HardDrive} value={formatTB(TOTAL_DATA_TB)} label="Total Data Footprint" />
          </div>
        </div>
      </div>

      {/* Exposure by System */}
      <div className="px-8 pt-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-4" style={{ color: C.ink }}>Exposure by System</div>
          <div className="space-y-4">
            {EXPOSURE_BY_SYSTEM.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-16 shrink-0 text-sm" style={{ color: C.ink }}>{s.name}</div>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: C.accent }} />
                </div>
                <div className="w-12 text-sm text-right font-medium" style={{ color: C.ink }}>{s.pct}%</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] mt-4" style={{ color: C.muted }}>Share of total sensitive records/transactions held per vendor.</div>
        </div>
      </div>

      {/* Highest residual risks. Was "highest residual risk assets", ranked by
          a per-asset residual score. That score needed an asset assurance
          number to compute; residual risk is now derived per scenario from the
          controls actually mapped to it, which is both more precise and the
          thing a board asks about. */}
      <div className="px-8 pt-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Highest Residual Risks</div>
            <button
              onClick={() => onNavigate && onNavigate("risk-register")}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              View risk register <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {HIGHEST_RESIDUAL_RISKS.map((r) => (
              <button
                key={r.id}
                onClick={() => onNavigate && onNavigate("risk-register")}
                className="text-left p-3 rounded-lg hover:bg-black/[0.02] transition-colors"
                style={{ border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{r.id}</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: severityColor(r.residual.severity), background: C.panel2 }}
                  >
                    {r.residual.severity}
                  </span>
                </div>
                <div className="text-xs leading-snug" style={{ color: C.muted }}>{r.scenario}</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>
                  Residual {r.residualScore} / 25
                  {r.assurance.pct != null && ` · controls at ${r.assurance.pct}`}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Footer disclaimer */}
      <div className="px-8 pt-5 pb-8">
        <div className="rounded-lg px-4 py-3 flex flex-col gap-1.5 text-[11px]" style={{ background: C.panel2, color: C.muted }}>
          <span className="flex items-center gap-2"><ShieldCheck size={12} /> Assurance-lane figures are computed live from ACME's Cyber Assurance model and Risk Register — recalculated on every load, not a cached snapshot.</span>
          <span style={{ marginLeft: 20 }}>Operational Readiness draws from the Security Principles library and System Register cockpit; SOP reliability reflects procedure runs recorded in this browser session.</span>
        </div>
      </div>
    </div>
  );
}
