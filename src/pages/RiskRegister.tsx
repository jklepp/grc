import React, { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Search, X, Lock, RefreshCw, AlertTriangle, ChevronDown, Circle, Clock, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { getAllRisks, MATERIAL_RISKS, SEVERITY_VALUE, score, annualProbabilityRange, lossMagnitudeRange } from "../engine";
import type { RiskRollup } from "../engine/risk";
import type { LikelihoodLevel, MilestoneStatus, SeverityLevel } from "../graph/nodes/risks";

const RISKS = getAllRisks();

const SEVERITY_LEVELS = ["Minor", "Moderate", "Major", "Severe"] as const satisfies readonly SeverityLevel[]; // 1-4, bottom to top on heatmap
const LIKELIHOOD_LEVELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"] as const satisfies readonly LikelihoodLevel[]; // 1-5

type MaterialRisk = (typeof MATERIAL_RISKS)[number];
type DisplayRisk = RiskRollup | MaterialRisk;

function formatUSD(n: number): string {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
}

const TREND_ICON: Record<string, LucideIcon> = { Improving: ArrowDownRight, Stalled: ArrowUpRight, Flat: Minus };

function trendColor(color: string): string {
  return color === "green" ? C.green : color === "red" ? C.red : color === "amber" ? C.amber : C.muted;
}

function severityColor(sev: SeverityLevel): string {
  const s = SEVERITY_VALUE[sev];
  if (s >= 4) return C.red;
  if (s >= 3) return C.amber;
  if (s >= 2) return "#3FA6A6";
  return C.green;
}
function cellColor(sev: SeverityLevel, like: LikelihoodLevel): string {
  const s = score(sev, like);
  if (s >= 15) return C.red;
  if (s >= 9) return "#3FA6A6";
  if (s >= 4) return C.amber;
  return C.green;
}
function treatmentColor(t: string): string {
  if (t === "Mitigate") return C.accent;
  if (t === "Accept") return C.green;
  if (t === "Transfer") return "#C9A6E8";
  return C.muted;
}
function milestoneMeta(status: MilestoneStatus): { color: string; label: string } {
  if (status === "done") return { color: C.green, label: "Done" };
  if (status === "in_progress") return { color: C.accent, label: "In progress" };
  if (status === "blocked") return { color: C.red, label: "Blocked" };
  return { color: C.muted, label: "Not started" };
}

function ScorePill({ value, sev }: { value: number; sev: SeverityLevel }) {
  const color = severityColor(sev);
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold"
      style={{ background: `${color}26`, color, fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {value}
    </span>
  );
}

function StatTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>{label}</div>
      <div className="text-base font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );
}

// The next real, incomplete step from the risk's own treatment plan — not an
// invented "management action" string.
function nextAction(r: DisplayRisk): string {
  const next = r.milestones.find((m) => m.status !== "done");
  return next ? next.title : `${r.treatment} — accepted`;
}

function shortLabel(scenario: string): string {
  return scenario.length > 34 ? scenario.slice(0, 33) + "…" : scenario;
}

// Board Visual: likelihood x impact bubble chart for the material risk set.
// Position is derived from each risk's own probability/loss-magnitude bands
// (annual likelihood %, loss magnitude midpoint $) and bubble area from its
// residual exposure — nothing plotted here is a new hand-typed figure.
// Every material risk is, by isMaterial()'s own definition, already above its
// appetite, so a single status color (not a categorical palette) does the
// only job color needs to do: mark that shared status, with the "Above
// Appetite" wash and label carrying the meaning rather than color alone.
function MaterialRiskBubbleChart({ risks, onSelect }: { risks: readonly MaterialRisk[]; onSelect: (risk: MaterialRisk) => void }) {
  const W = 760, H = 400;
  const marginL = 66, marginR = 24, marginT = 28, marginB = 46;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;

  const points = risks.map((r) => ({
    r,
    likelihood: (r.probability[0] + r.probability[1]) / 2,
    impact: (r.lossMagnitude[0] + r.lossMagnitude[1]) / 2,
  }));

  const maxImpact = Math.max(...points.map((p) => p.impact));
  const yMax = Math.ceil((maxImpact * 1.2) / 5000000) * 5000000 || 5000000;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  const expValues = risks.map((r) => r.exposure);
  const expMin = Math.min(...expValues), expMax = Math.max(...expValues);
  const rMin = 9, rMax = 22;
  const radius = (exposure: number) =>
    expMax === expMin ? (rMin + rMax) / 2 : rMin + (rMax - rMin) * Math.sqrt((exposure - expMin) / (expMax - expMin));

  const x = (pct: number) => marginL + (pct / 100) * plotW;
  const y = (val: number) => marginT + plotH - (val / yMax) * plotH;

  // Appetite wash: anchored to the actual plotted cluster (a margin below the
  // lowest likelihood/impact among these already-material risks), not an
  // invented universal dollar threshold.
  const zoneX = Math.max(0, Math.min(...points.map((p) => p.likelihood)) * 0.8);
  const zoneY = Math.max(0, Math.min(...points.map((p) => p.impact)) * 0.8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Material risks by likelihood, impact, and exposure">
      <rect x={x(zoneX)} y={marginT} width={marginL + plotW - x(zoneX)} height={y(zoneY) - marginT} fill={C.red} opacity={0.08} />
      <text x={W - marginR - 6} y={marginT + 14} textAnchor="end" fontSize="10" fontWeight="600" letterSpacing="0.05em" fill={C.red}>
        ABOVE APPETITE
      </text>

      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={marginL} x2={W - marginR} y1={y(t)} y2={y(t)} stroke={C.border} strokeWidth="1" />
          <text x={marginL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill={C.muted}>{formatUSD(t)}</text>
        </g>
      ))}
      <line x1={marginL} x2={marginL} y1={marginT} y2={marginT + plotH} stroke={C.border} strokeWidth="1" />
      <line x1={marginL} x2={W - marginR} y1={marginT + plotH} y2={marginT + plotH} stroke={C.border} strokeWidth="1" />

      <text x={marginL} y={H - 8} fontSize="10" fill={C.muted}>Low</text>
      <text x={W - marginR} y={H - 8} textAnchor="end" fontSize="10" fill={C.muted}>High</text>
      <text x={marginL + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" letterSpacing="0.05em" fill={C.muted}>ANNUAL LIKELIHOOD →</text>
      <text x={14} y={marginT + plotH / 2} textAnchor="middle" fontSize="10" letterSpacing="0.05em" fill={C.muted} transform={`rotate(-90 14 ${marginT + plotH / 2})`}>
        POTENTIAL IMPACT ($) →
      </text>

      {points.map(({ r, likelihood, impact }, i) => {
        const cx = x(likelihood), cy = y(impact), rad = radius(r.exposure);
        const labelAbove = i % 2 === 0;
        const labelY = labelAbove ? cy - rad - 10 : cy + rad + 15;
        return (
          <g key={r.id} className="cursor-pointer" onClick={() => onSelect(r)}>
            <title>{r.boardLabel} — {formatUSD(r.exposure)} residual exposure</title>
            <circle cx={cx} cy={cy} r={rad} fill={C.red} stroke={C.panel} strokeWidth="1.5" opacity={0.75} />
            <text x={cx} y={labelY} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={C.ink}>{shortLabel(r.boardLabel)}</text>
            <text x={cx} y={labelY + 12} textAnchor="middle" fontSize="9.5" fill={C.muted}>{formatUSD(r.exposure)} ALE</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function RiskRegister() {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [heatmapView, setHeatmapView] = useState<"Inherent" | "Residual">("Residual");
  const [view, setView] = useState<"board" | "operational">("board");
  const [selected, setSelected] = useState<DisplayRisk | null>(null);

  const categories = [...new Set(RISKS.map((r) => r.subcategory))].sort();

  const filtered = RISKS.filter(
    (r) =>
      r.scenario.toLowerCase().includes(query.toLowerCase()) &&
      (categoryFilter === "All" || r.subcategory === categoryFilter)
  );

  const productCount = RISKS.filter((r) => r.domain === "Product").length;
  const enterpriseCount = RISKS.filter((r) => r.domain === "Enterprise").length;
  const aboveAppetite = RISKS.filter((r) => score(r.residual.severity, r.residual.likelihood) > r.appetite).length;
  const treatmentsAtRisk = RISKS.filter((r) => r.treatmentAtRisk).length;
  const escalatedCount = RISKS.filter((r) => r.escalated).length;
  const quantifiedExposure = RISKS.reduce((a, r) => a + r.exposure, 0);

  const heatmap = useMemo(() => {
    const emptyRow = (): Record<LikelihoodLevel, number> => ({ Rare: 0, Unlikely: 0, Possible: 0, Likely: 0, "Almost Certain": 0 });
    const grid: Record<SeverityLevel, Record<LikelihoodLevel, number>> = {
      Minor: emptyRow(), Moderate: emptyRow(), Major: emptyRow(), Severe: emptyRow(),
    };
    RISKS.forEach((r) => {
      const view = heatmapView === "Residual" ? r.residual : r.inherent;
      grid[view.severity][view.likelihood] += 1;
    });
    return grid;
  }, [heatmapView]);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={AlertTriangle}
        title="Risk Register"
        description="Scenario-based risk register with appetite thresholds, control linkage, treatment plans, milestones, and accountable owners."
        right={
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            <Lock size={12} /><span>Read-only</span><span style={{ color: C.border }}>|</span><RefreshCw size={12} /><span>Synced from Vanta · 8 min ago</span>
          </div>
        }
      >
        <div className="inline-flex items-center gap-1 rounded-xl p-1 mt-4" style={{ background: C.panel2 }}>
          {([
            { id: "board", label: "Board View" },
            { id: "operational", label: "Operational View" },
          ] as const).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="text-xs px-4 py-1.5 font-medium rounded-lg transition-colors"
              style={{ background: view === v.id ? C.ink : "transparent", color: view === v.id ? C.bg : C.muted }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="px-8 grid grid-cols-4 gap-4 mb-5">
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Open Risks</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{RISKS.length}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>{productCount} product · {enterpriseCount} enterprise</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Above Appetite</div>
          <div className="text-3xl font-semibold" style={{ color: C.red, fontFamily: "'Source Serif 4', serif" }}>{aboveAppetite}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Requires treatment or acceptance</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Treatments At Risk</div>
          <div className="text-3xl font-semibold" style={{ color: C.amber, fontFamily: "'Source Serif 4', serif" }}>{treatmentsAtRisk}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>{escalatedCount} need executive escalation</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Quantified Exposure</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>${(quantifiedExposure / 1000000).toFixed(1)}M</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Annualized modeled loss</div>
        </div>
      </div>

      {view === "board" && (
        <div className="px-8 pb-12">
          <div className="rounded-xl p-5 mb-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="text-sm font-medium mb-1" style={{ color: C.ink }}>Top Material Cyber Risks</div>
            <div className="text-xs mb-4" style={{ color: C.muted }}>
              Bubble position is annual likelihood × potential impact; size is residual exposure (ALE). Click a bubble for the underlying assurance, controls, and remediation plan.
            </div>
            <MaterialRiskBubbleChart risks={MATERIAL_RISKS} onSelect={setSelected} />
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide" style={{ color: C.muted, background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
                  <th className="text-left font-semibold px-3 py-2.5">Material Risk</th>
                  <th className="text-right font-semibold px-3 py-2.5">Exposure</th>
                  <th className="text-right font-semibold px-3 py-2.5">vs. Appetite</th>
                  <th className="text-right font-semibold px-3 py-2.5">Trend</th>
                  <th className="text-left font-semibold px-3 py-2.5">Management Action</th>
                </tr>
              </thead>
              <tbody>
                {MATERIAL_RISKS.map((r) => {
                  const TrendIcon = TREND_ICON[r.trend.label] ?? Minus;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="cursor-pointer wz-hover"
                      style={{ borderTop: `1px solid ${C.border}` }}
                    >
                      <td className="p-3 font-medium" style={{ color: C.ink }}>{r.boardLabel}</td>
                      <td className="p-3 text-right" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{formatUSD(r.exposure)}</td>
                      <td className="p-3 text-right font-medium" style={{ color: C.red }}>{r.appetiteRatio}×</td>
                      <td className="p-3 text-right">
                        <span className="inline-flex items-center gap-1 font-medium" style={{ color: trendColor(r.trend.color) }}>
                          <TrendIcon size={13} /> {r.trend.label}
                        </span>
                      </td>
                      <td className="p-3" style={{ color: C.muted }}>{nextAction(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "operational" && (
      <div className="px-8 grid grid-cols-5 gap-5 pb-12">
        <div className="col-span-3 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-3 p-4 flex-wrap" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="text-sm font-medium" style={{ color: C.ink }}>Risk Register</div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 min-w-[180px]" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
              <Search size={13} color={C.muted} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search risks..." className="bg-transparent text-xs outline-none w-full" style={{ color: C.ink }} />
            </div>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs pl-3 pr-7 py-1.5 rounded-lg font-medium appearance-none"
                style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
              >
                <option value="All">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={12} color={C.muted} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid text-xs font-medium px-4 py-2.5" style={{ gridTemplateColumns: "2fr 110px 70px 70px 70px 90px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <div>RISK SCENARIO</div><div>OWNER</div><div>INHERENT</div><div>RESIDUAL</div><div>APPETITE</div><div>TREATMENT</div>
          </div>

          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full grid items-center px-4 py-3 text-left wz-hover transition-colors"
                style={{ gridTemplateColumns: "2fr 110px 70px 70px 70px 90px", borderBottom: `1px solid ${C.border}` }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: C.ink }}>{r.scenario}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>{r.domain} / {r.subcategory}</div>
                </div>
                <div className="text-xs" style={{ color: C.muted }}>{r.owner}</div>
                <div className="text-sm" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{score(r.inherent.severity, r.inherent.likelihood)}</div>
                <div><ScorePill value={score(r.residual.severity, r.residual.likelihood)} sev={r.residual.severity} /></div>
                <div className="text-xs" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>≤{r.appetite}</div>
                <div className="text-xs font-medium" style={{ color: treatmentColor(r.treatment) }}>{r.treatment}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium" style={{ color: C.ink }}>Risk Heatmap</div>
            <div className="flex items-center rounded-lg p-0.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
              {(["Inherent", "Residual"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setHeatmapView(v)}
                  className="text-[11px] px-2.5 py-1.5 font-medium rounded-md transition-colors"
                  style={{ background: heatmapView === v ? C.panel : "transparent", color: heatmapView === v ? C.ink : C.muted }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "70px repeat(5, 1fr)" }}>
            <div />
            {LIKELIHOOD_LEVELS.map((l) => (
              <div key={l} className="text-[10px] text-center px-1 pb-2" style={{ color: C.muted }}>{l}</div>
            ))}
            {[...SEVERITY_LEVELS].reverse().map((sev) => (
              <React.Fragment key={sev}>
                <div className="text-xs pr-2 flex items-center" style={{ color: C.muted }}>{sev}</div>
                {LIKELIHOOD_LEVELS.map((like) => {
                  const count = heatmap[sev][like];
                  const color = cellColor(sev, like);
                  return (
                    <div key={like} className="aspect-square flex items-center justify-center rounded m-0.5 text-sm font-semibold"
                      style={{ background: `${color}30`, color: count > 0 ? color : C.muted }}>
                      {count}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-[460px] h-full overflow-y-auto shadow-2xl" style={{ background: C.panel }}>
            <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {selected.id} · {selected.domain} / {selected.subcategory}
                  </div>
                  <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{"boardLabel" in selected ? selected.boardLabel : selected.scenario}</h2>
                  {selected.materialLabel && (
                    <div className="text-xs mt-1" style={{ color: C.muted }}>Tracked in the register as: {selected.scenario}</div>
                  )}
                </div>
                <button onClick={() => setSelected(null)}><X size={18} color={C.muted} /></button>
              </div>
              <div className="text-sm mt-3" style={{ color: C.muted }}>{selected.description}</div>
              {selected.escalated && (
                <div className="flex items-center gap-1.5 text-xs mt-3 p-2.5 rounded" style={{ background: C.redBg, color: C.red, border: `1px solid ${C.red}4D` }}>
                  <AlertTriangle size={12} /> Escalated for executive review
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
                  <div className="text-xs mb-1" style={{ color: C.muted }}>Inherent</div>
                  <div className="text-xl font-semibold" style={{ color: severityColor(selected.inherent.severity), fontFamily: "'Source Serif 4', serif" }}>
                    {score(selected.inherent.severity, selected.inherent.likelihood)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>{selected.inherent.severity} · {selected.inherent.likelihood}</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
                  <div className="text-xs mb-1" style={{ color: C.muted }}>Residual</div>
                  <div className="text-xl font-semibold" style={{ color: severityColor(selected.residual.severity), fontFamily: "'Source Serif 4', serif" }}>
                    {score(selected.residual.severity, selected.residual.likelihood)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>{selected.residual.severity} · {selected.residual.likelihood}</div>
                </div>
              </div>

              {selected.assurance && (
                <div className="mb-6">
                  <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Board Metrics</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <StatTile label="Probability" value={`${("probability" in selected ? selected.probability : annualProbabilityRange(selected.residual.likelihood))[0]}-${("probability" in selected ? selected.probability : annualProbabilityRange(selected.residual.likelihood))[1]}%`} sub="annual" />
                    <StatTile label="Loss Magnitude" value={formatUSD(("lossMagnitude" in selected ? selected.lossMagnitude : lossMagnitudeRange(selected.exposure, selected.residual.likelihood))[0])} sub={`to ${formatUSD(("lossMagnitude" in selected ? selected.lossMagnitude : lossMagnitudeRange(selected.exposure, selected.residual.likelihood))[1])}`} />
                    <StatTile label="Residual Exposure" value={formatUSD(selected.exposure)} sub="Annualized loss expectancy" />
                    {/* Was an enterprise-wide average for whichever assurance
                        category this risk's free-text linkedControl mapped to —
                        the same number for every risk in that category, unable
                        to move when the assets involved moved. Now it's read
                        from the controls holding THIS scenario down and the
                        assets that carry it. */}
                    <StatTile
                      label="Control Assurance"
                      value={selected.assurance.pct == null ? "—" : `${selected.assurance.pct}%`}
                      sub={selected.assurance.pct == null ? "unassessed" : `target ${selected.assurance.target}% · ${selected.assurance.band.label}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-lg" style={{ background: C.redBg, color: C.red, border: `1px solid ${C.red}33` }}>
                    <span className="font-medium">{selected.appetiteRatio}× above appetite</span>
                    <span className="flex items-center gap-1" style={{ color: trendColor(selected.trend.color) }}>
                      {React.createElement(TREND_ICON[selected.trend.label] ?? Minus, { size: 12 })} {selected.trend.label}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-sm mb-6 p-3 rounded-lg" style={{ background: C.panel2 }}>
                <span style={{ color: C.muted }}>Appetite threshold</span>
                <span style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>≤ {selected.appetite}</span>
              </div>

              <div className="flex items-center justify-between text-sm mb-1" style={{ color: C.muted }}>
                <span>Owner</span><span style={{ color: C.ink }}>{selected.owner}</span>
              </div>
              {/* The traceability chain the register never had: which controls
                  hold this scenario down, which assets carry it, and — for the
                  weakest control — the specific implementation dragging it. */}
              {selected.assurance.controls.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Controls holding this down</div>
                  <div className="space-y-1.5">
                    {selected.assurance.controls.map((c) => (
                      <div key={c.control.id} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs flex-1 min-w-0 truncate" style={{ color: C.ink }}>{c.control.friendlyName}</span>
                          <span className="text-[10px]" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{c.control.id}</span>
                          <span className="text-xs font-semibold tabular-nums" style={{ color: c.score == null ? C.muted : c.score >= 75 ? C.green : c.score >= 60 ? C.amber : C.red, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {c.score ?? "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] mt-2" style={{ color: C.muted }}>
                    Each control is scored at its weakest implementation — a defect on one component exposes the scenario regardless of how the others score.
                  </div>
                </div>
              )}

              {selected.contributingAssets.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Assets carrying this risk</div>
                  <div className="space-y-1.5">
                    {selected.contributingAssets.map((c) => (
                      <div key={c.assetId} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs flex-1 min-w-0 truncate" style={{ color: C.ink }}>{c.asset.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: c.role === "primary" ? C.accent : C.muted, background: c.role === "primary" ? C.accentBg : "transparent" }}>{c.role}</span>
                          {/* Which controls actually hold on this asset, rather
                              than a score for the asset itself. The residual
                              position comes from the controls mapped to the
                              risk; the asset's part in that is how many of them
                              it was verified for. */}
                          <span className="text-[11px] tabular-nums shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {c.asset.implementedCount}/{c.asset.applicableControlCount} verified
                          </span>
                        </div>
                        {c.note && <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{c.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.assurance.noAssetsReason && (
                <div className="text-[11px] mb-6 p-3 rounded-lg leading-relaxed" style={{ background: C.panel2, color: C.muted }}>
                  <span style={{ color: C.ink, fontWeight: 600 }}>No asset edges: </span>{selected.assurance.noAssetsReason}
                </div>
              )}

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Treatment Plan · {selected.treatment}</div>
              <div className="space-y-2">
                {selected.milestones.map((m, i) => {
                  const meta = milestoneMeta(m.status);
                  return (
                    <div key={i} className="p-3 rounded-lg" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div className="text-sm" style={{ color: C.ink }}>{m.title}</div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="flex items-center gap-1" style={{ color: meta.color }}><Circle size={7} fill={meta.color} color={meta.color} /> {meta.label}</span>
                        <span className="flex items-center gap-1" style={{ color: C.muted }}><Clock size={11} /> Due {m.due}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
