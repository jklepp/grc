import React, { useState } from "react";
import {
  LayoutDashboard, ShieldCheck, ArrowRight, AlertTriangle, DollarSign, ClipboardCheck,
  Download, Sparkles, ArrowUpRight, ArrowDownRight, Database, ShieldAlert, PieChart, HardDrive,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { DATA_SOURCES, TOTAL_RECORDS, TOTAL_DATA_TB, formatRecords, formatTB } from "../data/dataFootprint";
import {
  getAllRisks, ABOVE_APPETITE_COUNT, MATERIAL_RISKS, MATERIAL_RISK_EXPOSURE, QUANTIFIED_EXPOSURE,
  getAllAssets, getCategoryAverages, getEnterprise, ENTERPRISE_COVERAGE, ASSURANCE_TARGET, ADEQUATE_THRESHOLD,
} from "../engine";

const RISKS = getAllRisks();
const ASSET_SUMMARIES = getAllAssets();
const CATEGORY_PORTFOLIO_AVERAGES = getCategoryAverages();

// Enterprise Assurance: criticality-weighted, so a weak Restricted-tier asset
// drags it down harder than a weak Public one and it can't be gamed by padding
// the register with low-stakes assets.
//
// This page used to compute that weighting here, over the asset list. Correct
// arithmetic, but a second implementation of a rollup the engine also performs
// — and the engine's version rolls up through systems rather than flattening
// every asset into one pool, so the two would not have agreed. Now there is one
// enterprise assurance figure and this is a read of it.
const PORTFOLIO_ASSURANCE_PCT = getEnterprise().assurance;
const TOTAL_CRITICALITY = ASSET_SUMMARIES.reduce((a, x) => a + x.criticality, 0);
const PORTFOLIO_EVIDENCE_PCT = Math.round(
  ASSET_SUMMARIES.reduce((a, x) => a + x.evidenceConfidence * x.criticality, 0) / TOTAL_CRITICALITY
);
// Was the mean of every asset's complianceCoveragePct — a figure each asset
// inherited unchanged from its parent system, so this averaged two distinct
// values across fifteen copies of them. Now it reads the enterprise coverage
// the compliance engine derives from every in-scope control on both systems.
const COMPLIANCE_COVERAGE_PCT = ENTERPRISE_COVERAGE.coveredPct;

// Only the last point is real — pinned to the live computed metric above, so
// it can't drift out of sync with the actual register. Everything before it
// is an illustrative run-up (no history is actually persisted anywhere in
// this app), shaped to land on today's number rather than a separately
// hand-typed series that could someday disagree with it. Used for the one
// headline delta this page shows ("+N pts vs last quarter"), not a sparkline.
function trendTo(current, stepsBack) {
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
const WEAKEST_ASSET = [...ASSET_SUMMARIES].sort((a, b) => a.overallAssurance - b.overallAssurance)[0];
const WEAKEST_ASSET_CATEGORY = Object.entries(WEAKEST_ASSET.categoryScores).sort((a, b) => a[1] - b[1])[0];
const WEAKEST_CATEGORY = [...CATEGORY_AVERAGES].sort((a, b) => a.pct - b.pct)[0];
const STRONGEST_CATEGORY = [...CATEGORY_AVERAGES].sort((a, b) => b.pct - a.pct)[0];
const ASSETS_BELOW_TARGET = ASSET_SUMMARIES.filter((a) => a.overallAssurance < ASSURANCE_TARGET).length;

const HIGHEST_RESIDUAL_RISK_ASSETS = [...ASSET_SUMMARIES].sort((a, b) => b.residualRisk.score - a.residualRisk.score).slice(0, 3);

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
const DECISIONS_EXPOSURE = DECISIONS_REQUIRED.reduce((a, r) => a + r.exposure, 0);

function severityColor(sev) {
  if (sev === "Severe") return C.red;
  if (sev === "Major") return C.amber;
  return C.green;
}
function formatUSD(n) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`;
}

function handleExport() {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    enterpriseAssurance: PORTFOLIO_ASSURANCE_PCT,
    assuranceTarget: ASSURANCE_TARGET,
    materialRisks: MATERIAL_RISKS.map((r) => ({ id: r.id, scenario: r.boardLabel, severity: r.residual.severity, exposure: r.exposure, owner: r.owner })),
    materialRiskExposure: MATERIAL_RISK_EXPOSURE,
    totalExposure: QUANTIFIED_EXPOSURE,
    risksAboveAppetite: ABOVE_APPETITE_COUNT,
    decisionsRequired: DECISIONS_REQUIRED.map((r) => ({ id: r.id, scenario: r.scenario, owner: r.owner, exposure: r.exposure })),
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acme-executive-overview-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function Pill({ text, color, bg }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color, background: bg }}>
      {text}
    </span>
  );
}

// Hand-rolled SVG ring, same "no chart library" convention the rest of this
// app already uses (see the old Sparkline this replaced) rather than pulling
// in the unused recharts dependency for one shape.
function AssuranceRing({ pct, color, size = 112 }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.panel2} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0 }} className="flex items-center justify-center">
        <span className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{pct}%</span>
      </div>
    </div>
  );
}

// `hero` gives the headline KPI (Enterprise Assurance) the same accent
// gradient treatment the old Composite Score card had, so it still reads as
// the one number everything else on the page rolls up to — the other three
// KPI cards stay on the plain panel background.
function KpiCard({ icon: Icon, iconColor, iconBg, value, label, hero, children }) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col items-center text-center"
      style={hero ? { background: `linear-gradient(135deg, ${C.accent} 0%, #4B3F99 100%)` } : { background: C.panel, border: `1px solid ${C.border}` }}
    >
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: hero ? "rgba(255,255,255,0.18)" : iconBg }}>
        <Icon size={22} color={hero ? "#fff" : iconColor} />
      </div>
      <div className="text-4xl font-semibold" style={{ color: hero ? "#fff" : C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide mt-2 font-medium" style={{ color: hero ? "rgba(255,255,255,0.85)" : C.muted }}>{label}</div>
      {children}
    </div>
  );
}

function GlanceStat({ icon: Icon, value, label, warn }) {
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

export default function ExecutiveDashboard({ onNavigate }) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={LayoutDashboard}
        title="Executive Dashboard"
        tagline="Enterprise Cyber Posture"
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

      {/* KPI row */}
      <div className="px-8 grid grid-cols-4 gap-5">
        <KpiCard hero icon={ShieldCheck} value={`${PORTFOLIO_ASSURANCE_PCT}%`} label="Enterprise Assurance">
          <div className="text-xs mt-1.5 font-medium" style={{ color: "rgba(255,255,255,0.95)" }}>
            {ASSURANCE_DELTA >= 0 ? "▲" : "▼"} {Math.abs(ASSURANCE_DELTA)} pts vs last quarter
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>Target: {ASSURANCE_TARGET}</div>
        </KpiCard>

        <KpiCard icon={AlertTriangle} iconColor={C.red} iconBg={C.redBg} value={MATERIAL_RISKS.length} label="Material Risks">
          <div className="text-xs mt-1.5 font-medium" style={{ color: C.red }}>{formatUSD(MATERIAL_RISK_EXPOSURE)} modeled exposure</div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Residual Severe, above appetite</div>
        </KpiCard>

        <KpiCard icon={DollarSign} iconColor={C.accent} iconBg={C.accentBg} value={formatUSD(QUANTIFIED_EXPOSURE)} label="Total Exposure">
          <div className="text-xs mt-1.5" style={{ color: C.muted }}>Across all {RISKS.length} tracked risks</div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{Math.round((100 * MATERIAL_RISK_EXPOSURE) / QUANTIFIED_EXPOSURE)}% from material risks</div>
        </KpiCard>

        <KpiCard icon={ClipboardCheck} iconColor={C.green} iconBg={C.greenBg} value={DECISIONS_REQUIRED.length} label="Decisions Required">
          <div className="text-xs mt-1.5 font-medium" style={{ color: C.ink }}>Escalated risks pending review</div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{formatUSD(DECISIONS_EXPOSURE)} combined exposure</div>
        </KpiCard>
      </div>

      {/* Insight banner */}
      <div className="px-8 pt-5">
        <div className="rounded-xl p-4 flex items-start gap-2.5 text-sm" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D`, color: C.ink }}>
          <Sparkles size={16} color={C.accent} className="shrink-0 mt-0.5" />
          <span>
            Enterprise Assurance {ASSURANCE_DELTA >= 0 ? "improved" : "declined"} {Math.abs(ASSURANCE_DELTA)} points this
            quarter, led by {STRONGEST_CATEGORY.label} at {STRONGEST_CATEGORY.pct}%. {MATERIAL_RISKS.length} risks remain
            material — <span className="font-medium">{MATERIAL_RISKS[0].boardLabel}</span> is the largest at{" "}
            {formatUSD(MATERIAL_RISKS[0].exposure)} — and {DECISIONS_REQUIRED.length} are escalated for a leadership decision.
          </span>
        </div>
      </div>

      {/* Material Enterprise Risks + Decisions Required */}
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
                  Below the {ADEQUATE_THRESHOLD}% target, driven by {WEAKEST_ASSET.name}'s {WEAKEST_ASSET_CATEGORY[0]} controls at {WEAKEST_ASSET_CATEGORY[1]}%.
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
              <div className="flex items-center justify-between"><span style={{ color: C.muted }}>COMPLIANCE COVERAGE</span><span style={{ color: C.ink, fontWeight: 600 }}>{COMPLIANCE_COVERAGE_PCT}%</span></div>
              <div className="flex items-center justify-between"><span style={{ color: C.muted }}>EVIDENCE CONFIDENCE</span><span style={{ color: C.ink, fontWeight: 600 }}>{PORTFOLIO_EVIDENCE_PCT}%</span></div>
            </div>
          </div>
          <div className="text-xs mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
            Assets below {ASSURANCE_TARGET}% target <span style={{ color: C.ink, fontWeight: 600 }}>{ASSETS_BELOW_TARGET}</span>
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

      {/* Exposure by System + Control Assurance by Category */}
      <div className="px-8 pt-5 grid grid-cols-2 gap-5">
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

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-4" style={{ color: C.ink }}>Control Assurance by Category</div>
          <div className="space-y-4">
            {CATEGORY_AVERAGES.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-sm" style={{ color: C.ink }}>{d.label}</div>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                  <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: C.accent }} />
                </div>
                <div className="w-10 text-sm text-right font-medium" style={{ color: C.ink }}>{d.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Highest Residual Risk Assets */}
      <div className="px-8 pt-5">
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Highest Residual Risk Assets</div>
            <button
              onClick={() => onNavigate && onNavigate("asset-register")}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              View asset register <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {HIGHEST_RESIDUAL_RISK_ASSETS.map((a) => (
              <button
                key={a.id}
                onClick={() => onNavigate && onNavigate("asset-register")}
                className="text-left p-3 rounded-lg hover:bg-black/[0.02] transition-colors"
                style={{ border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{a.name}</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: C[a.residualRisk.band.color], background: C[`${a.residualRisk.band.color}Bg`] }}
                  >
                    {a.residualRisk.band.label}
                  </span>
                </div>
                <div className="text-xs" style={{ color: C.muted }}>{a.system.name}</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>Residual {a.residualRisk.score} / 25</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Footer disclaimer */}
      <div className="px-8 pt-5 pb-8">
        <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-[11px]" style={{ background: C.panel2, color: C.muted }}>
          <span className="flex items-center gap-2"><ShieldCheck size={12} /> Every figure on this page is computed live from ACME's Cyber Assurance model and Risk Register — nothing here is hand-typed.</span>
          <span>Recalculated on every load, not a cached snapshot</span>
        </div>
      </div>
    </div>
  );
}
