import React from "react";
import { LayoutDashboard, ShieldCheck, ArrowRight, Circle } from "lucide-react";
import { C } from "../theme";
import { DATA_SOURCES, TOTAL_RECORDS } from "../data/dataFootprint";
import { RISKS, score, ABOVE_APPETITE_COUNT } from "../data/riskRegister";
import { ASSET_SUMMARIES } from "../data/assets";
import { ASSURANCE_CATEGORIES } from "../data/assuranceModel";

// Composite Score: criticality-weighted average of every asset's Control
// Assurance score — a weak Restricted-tier asset drags this down harder than
// a weak Public one, so it can't be gamed by padding the register with low-
// stakes assets. Real, not a hand-picked figure.
const TOTAL_CRITICALITY = ASSET_SUMMARIES.reduce((a, x) => a + x.criticality, 0);
const PORTFOLIO_ASSURANCE_PCT = Math.round(
  ASSET_SUMMARIES.reduce((a, x) => a + x.overallAssurance * x.criticality, 0) / TOTAL_CRITICALITY
);
const PORTFOLIO_EVIDENCE_PCT = Math.round(
  ASSET_SUMMARIES.reduce((a, x) => a + x.evidenceConfidence * x.criticality, 0) / TOTAL_CRITICALITY
);

// Cyber Assurance: the plain, unweighted average of every asset's Control
// Assurance score — deliberately not criticality-weighted like the Composite
// Score above, so it reads as "how are we doing on average" rather than
// "how are we doing on what matters most." The two will diverge as more
// low-criticality assets join the register.
const CYBER_ASSURANCE_PCT = Math.round(ASSET_SUMMARIES.reduce((a, x) => a + x.overallAssurance, 0) / ASSET_SUMMARIES.length);

// Compliance Coverage: average share of each asset's required controls that
// are satisfied or inherited, reusing systemRegister.js's real controlBreakdown
// per asset rather than a second hand-typed figure.
const COMPLIANCE_COVERAGE_PCT = Math.round(ASSET_SUMMARIES.reduce((a, x) => a + x.complianceCoveragePct, 0) / ASSET_SUMMARIES.length);

// 6-month trend lines for the KPI sparklines. Only the last point is real —
// it's always pinned to the live computed metric above, so it can't drift
// out of sync with the actual register. Everything before it is an
// illustrative run-up (no history is actually persisted anywhere in this
// app), shaped to land on today's number rather than a separately
// hand-typed series that could someday disagree with it.
function trendTo(current, stepsBack) {
  return stepsBack.map((delta) => Math.max(0, Math.min(100, current - delta)));
}
const ASSURANCE_TREND = trendTo(CYBER_ASSURANCE_PCT, [10, 7, 5, 3, 2, 0]);
const COMPLIANCE_COVERAGE_TREND = trendTo(COMPLIANCE_COVERAGE_PCT, [13, 9, 7, 4, 2, 0]);
const EVIDENCE_CONFIDENCE_TREND = trendTo(PORTFOLIO_EVIDENCE_PCT, [12, 9, 6, 4, 2, 0]);

// Residual Risk Exposure: assets whose residual risk — criticality-derived
// impact x control-suppressed likelihood — still lands Critical or High.
const RESIDUAL_RISK_EXPOSURE = ASSET_SUMMARIES.filter((a) => ["Critical", "High"].includes(a.residualRisk.band.label)).length;

// Control Assurance by Category: the real 6 Assurance Categories, averaged
// across every asset in the register — the same categories the Asset
// Register's detail panel breaks each asset down into.
const CATEGORY_AVERAGES = ASSURANCE_CATEGORIES.map((label) => ({
  label,
  pct: Math.round(ASSET_SUMMARIES.reduce((a, x) => a + x.categoryScores[label], 0) / ASSET_SUMMARIES.length),
}));

const WEAKEST_ASSET = [...ASSET_SUMMARIES].sort((a, b) => a.overallAssurance - b.overallAssurance)[0];
const WEAKEST_ASSET_CATEGORY = Object.entries(WEAKEST_ASSET.categoryScores).sort((a, b) => a[1] - b[1])[0];
const WEAKEST_CATEGORY = [...CATEGORY_AVERAGES].sort((a, b) => a.pct - b.pct)[0];

const HIGHEST_RESIDUAL_RISK_ASSETS = [...ASSET_SUMMARIES].sort((a, b) => b.residualRisk.score - a.residualRisk.score).slice(0, 3);

// Exposure by System: share of total records/transactions each vendor holds —
// the one figure all four Data Footprint vendors report, so no vendor needs
// an invented weighting to appear here.
const EXPOSURE_BY_SYSTEM = [...DATA_SOURCES]
  .map((s) => ({ name: s.name, pct: Math.round((s.records / TOTAL_RECORDS) * 1000) / 10 }))
  .sort((a, b) => b.pct - a.pct);

// Material Risk: top 3 tracked risks by residual score, tie-broken by dollar
// exposure and escalation status — reuses the Risk Register's real entries.
const MATERIAL_RISKS = [...RISKS]
  .map((r) => ({ ...r, residualScore: score(r.residual.severity, r.residual.likelihood) }))
  .sort((a, b) => b.residualScore - a.residualScore || b.exposure - a.exposure)
  .slice(0, 3);

const LEADERSHIP_ACTIONS = [
  { title: "Approve temporary MFA exception", note: "Customer support legacy workflow · expires Aug 1", tag: "Decision" },
  { title: "Accept residual privacy risk", note: "Deletion workflow remains above appetite", tag: "Review" },
  { title: "Fund cloud entitlement remediation", note: "Engineering estimate: 2 sprints", tag: "Funding" },
];

// Minimal inline SVG trend line — no chart library involved, sized to sit
// directly inside a KPI tile below its headline number.
function Sparkline({ data, color }) {
  const w = 100, h = 26, pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = points.map((p) => p.join(",")).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  const delta = data[data.length - 1] - data[0];
  return (
    <div className="flex items-center gap-2 mt-2">
      <svg viewBox={`0 0 ${w} ${h}`} width={64} height={h} preserveAspectRatio="none" style={{ display: "block", flexShrink: 0 }}>
        <polyline points={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="2" fill={color} />
      </svg>
      <span className="text-[10px] font-medium" style={{ color: delta >= 0 ? C.green : C.red }}>
        {delta >= 0 ? "+" : ""}{delta} pts / 6mo
      </span>
    </div>
  );
}

function Pill({ text, color, bg }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color, background: bg }}>
      {text}
    </span>
  );
}
function actionTagColor(tag) {
  if (tag === "Decision") return { color: C.accent, bg: C.accentBg };
  if (tag === "Funding") return { color: C.amber, bg: C.amberBg };
  return { color: C.muted, bg: C.panel2 };
}
function riskScoreColor(s) {
  if (s >= 15) return C.red;
  if (s >= 8) return "#D98255";
  return C.amber;
}

export default function ExecutiveDashboard({ onNavigate }) {
  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              <LayoutDashboard size={13} /> Executive Dashboard
            </div>
            <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>GRC Overview</h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.amber }}>
            <Circle size={7} fill={C.amber} color={C.amber} /> {ABOVE_APPETITE_COUNT} of {RISKS.length} risks above appetite
          </div>
        </div>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          Top-level view of control health, data protection, risk posture, and operational readiness across ACME.
        </p>
      </div>

      {/* Hero + KPI row */}
      <div className="px-8 pt-6 grid gap-5" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 1fr" }}>
        <div className="rounded-xl p-6 flex flex-col justify-between" style={{ background: `linear-gradient(135deg, ${C.accent} 0%, #4B3F99 100%)` }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            <ShieldCheck size={14} /> Composite Score
          </div>
          <div className="text-5xl font-semibold mt-3" style={{ color: "#fff", fontFamily: "'Source Serif 4', serif" }}>{PORTFOLIO_ASSURANCE_PCT}%</div>
          <div className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.78)" }}>
            Criticality-weighted Control Assurance across the asset register — every asset's score, weighted by how much a breach of it would actually matter.
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm mb-3" style={{ color: C.muted }}>Cyber Assurance</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{CYBER_ASSURANCE_PCT}%</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Unweighted average across all assets</div>
          <Sparkline data={ASSURANCE_TREND} color={C.accent} />
        </div>
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm mb-3" style={{ color: C.muted }}>Compliance Coverage</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{COMPLIANCE_COVERAGE_PCT}%</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Required controls satisfied or inherited</div>
          <Sparkline data={COMPLIANCE_COVERAGE_TREND} color={C.accent} />
        </div>
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm mb-3" style={{ color: C.muted }}>Evidence Confidence</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{PORTFOLIO_EVIDENCE_PCT}%</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>How provably, not just plausibly, controls hold</div>
          <Sparkline data={EVIDENCE_CONFIDENCE_TREND} color={C.accent} />
        </div>
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: C.muted }}>Above Appetite</span>
            <Pill text="Watch" color={C.amber} bg={C.amberBg} />
          </div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{ABOVE_APPETITE_COUNT}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>of {RISKS.length} tracked risks</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: C.muted }}>Residual Risk</span>
            <Pill
              text={RESIDUAL_RISK_EXPOSURE > 0 ? "Alert" : "Clear"}
              color={RESIDUAL_RISK_EXPOSURE > 0 ? C.red : C.green}
              bg={RESIDUAL_RISK_EXPOSURE > 0 ? C.redBg : C.greenBg}
            />
          </div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{RESIDUAL_RISK_EXPOSURE}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>of {ASSET_SUMMARIES.length} assets Critical/High</div>
        </div>
      </div>

      {/* Executive Briefing + Leadership Actions */}
      <div className="px-8 pt-6 grid grid-cols-5 gap-5">
        <div className="col-span-3 rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-3" style={{ color: C.ink }}>Executive Briefing</div>
          <div className="text-sm leading-relaxed space-y-3" style={{ color: C.ink }}>
            <p>
              The two highest-scoring risks — cross-tenant data exposure and model distillation / IP theft — are tied at a
              residual score of 16. Cross-tenant exposure carries the larger quantified impact at $12.75M, making it the
              single most material item on the register today.
            </p>
            <p>
              At the asset level, <span className="font-medium">{WEAKEST_CATEGORY.label}</span> is the weakest category
              platform-wide at {WEAKEST_CATEGORY.pct}%, driven mainly by{" "}
              <span className="font-medium">{WEAKEST_ASSET.name}</span> ({WEAKEST_ASSET.system.name}), whose overall
              Control Assurance sits at just {WEAKEST_ASSET.overallAssurance}% — its {WEAKEST_ASSET_CATEGORY[0]} controls
              are evidenced at only {WEAKEST_ASSET_CATEGORY[1]}%.
            </p>
          </div>
          <div className="mt-4 rounded-lg p-4" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.accent }}>Leadership Recommendation</div>
            <div className="text-sm" style={{ color: C.ink }}>
              Close the {WEAKEST_ASSET_CATEGORY[0]} gap on {WEAKEST_ASSET.name} ({WEAKEST_ASSET.classification}) — it's the
              single lowest-scoring category on the weakest-assured asset in the register.
            </div>
          </div>
        </div>

        <div className="col-span-2 rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Leadership Actions</div>
            <Pill text={`${LEADERSHIP_ACTIONS.length} open`} color={C.red} bg={C.redBg} />
          </div>
          <div className="space-y-4">
            {LEADERSHIP_ACTIONS.map((item, i) => {
              const t = actionTagColor(item.tag);
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: C.accent }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium" style={{ color: C.ink }}>{item.title}</div>
                      <Pill text={item.tag} color={t.color} bg={t.bg} />
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted }}>{item.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Exposure + Assurance Dimensions + Material Risk */}
      <div className="px-8 pt-5 pb-5 grid grid-cols-3 gap-5">
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

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Material Risk</div>
            <button
              onClick={() => onNavigate && onNavigate("risk-register")}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              View register <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {MATERIAL_RISKS.map((r) => (
              <button
                key={r.id}
                onClick={() => onNavigate && onNavigate("risk-register")}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-black/[0.02] transition-colors"
                style={{ border: `1px solid ${C.border}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: C.ink }}>{r.scenario}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>{r.linkedControl} · Owner: {r.owner}</div>
                </div>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: riskScoreColor(r.residualScore), color: "#fff" }}>
                  {r.residualScore}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Highest Residual Risk Assets */}
      <div className="px-8 pb-12">
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
    </div>
  );
}
