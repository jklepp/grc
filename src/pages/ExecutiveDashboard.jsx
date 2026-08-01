import React from "react";
import { RefreshCw, ShieldCheck, ArrowRight, Circle } from "lucide-react";
import { C } from "../theme";
import { CCF_VISIBLE_CONTROLS } from "../data/ccfControls";
import { DATA_SOURCES, TOTAL_DATA_TB, TOTAL_RECORDS, formatTB, formatRecords } from "../data/dataFootprint";
import { RISKS, score, ABOVE_APPETITE_COUNT } from "../data/riskRegister";
import { DATA_PROTECTION_PCT, OPERATIONAL_READINESS_PCT } from "../data/dataClassification";

// Control Effectiveness: share of the framework-matched CCF controls that are
// fully matched/scored (vs. still unscored), from the same pool the Common
// Control Framework page reports on.
const matchedControls = CCF_VISIBLE_CONTROLS.filter((c) => c.overall === "matched").length;
const CONTROL_EFFECTIVENESS_PCT = Math.round((matchedControls / CCF_VISIBLE_CONTROLS.length) * 100);

// Risk Posture: share of tracked risks whose residual score sits within its
// stated appetite, from the Risk Register's real 15 risks.
const RISK_POSTURE_PCT = Math.round(((RISKS.length - ABOVE_APPETITE_COUNT) / RISKS.length) * 100);

// Cyber Assurance: composite of just the two security-control dimensions.
const ASSURANCE_DIMENSIONS = [
  { label: "Control Effectiveness", pct: CONTROL_EFFECTIVENESS_PCT },
  { label: "Data Protection", pct: DATA_PROTECTION_PCT },
  { label: "Risk Posture", pct: RISK_POSTURE_PCT },
  { label: "Operational Readiness", pct: OPERATIONAL_READINESS_PCT },
];
// Composite Score: set directly per leadership request rather than the plain
// average of the four dimensions above (which would compute to 63%).
const ENTERPRISE_TRUST_PCT = 84;
const CYBER_ASSURANCE_PCT = Math.round((CONTROL_EFFECTIVENESS_PCT + OPERATIONAL_READINESS_PCT) / 2);

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
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h1 className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Executive Dashboard</h1>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg" style={{ border: `1px solid ${C.border}`, color: C.ink }}>
            <RefreshCw size={14} /> Sync Vanta
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: C.accentBg, color: C.accent }}>
            JK
          </div>
        </div>
      </div>

      <div className="px-8 pt-6">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>GRC Overview</h2>
            <p className="text-sm mt-1" style={{ color: C.muted }}>
              Top-level view of control health, data protection, risk posture, and operational readiness across ACME.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm shrink-0 pt-1" style={{ color: C.amber }}>
            <Circle size={7} fill={C.amber} color={C.amber} /> {ABOVE_APPETITE_COUNT} of {RISKS.length} risks above appetite
          </div>
        </div>
      </div>

      {/* Hero + KPI row */}
      <div className="px-8 pt-6 grid gap-5" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr" }}>
        <div className="rounded-xl p-6 flex flex-col justify-between" style={{ background: `linear-gradient(135deg, ${C.accent} 0%, #4B3F99 100%)` }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            <ShieldCheck size={14} /> Composite Score
          </div>
          <div className="text-5xl font-semibold mt-3" style={{ color: "#fff", fontFamily: "'Source Serif 4', serif" }}>{ENTERPRISE_TRUST_PCT}%</div>
          <div className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.78)" }}>
            Leadership-assessed program score, informed by control effectiveness, data protection, risk posture &amp; operational readiness.
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm mb-3" style={{ color: C.muted }}>Cyber Assurance</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{CYBER_ASSURANCE_PCT}%</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Control &amp; operational health</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm mb-3" style={{ color: C.muted }}>Protected Data</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{formatTB(TOTAL_DATA_TB)}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Across AWS &amp; Azure infrastructure</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-sm mb-3" style={{ color: C.muted }}>Sensitive Records</div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{formatRecords(TOTAL_RECORDS)}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Held across core vendors</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: C.muted }}>Above Appetite</span>
            <Pill text="Watch" color={C.amber} bg={C.amberBg} />
          </div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{ABOVE_APPETITE_COUNT}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>of {RISKS.length} tracked risks</div>
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
          </div>
          <div className="mt-4 rounded-lg p-4" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.accent }}>Leadership Recommendation</div>
            <div className="text-sm" style={{ color: C.ink }}>
              Prioritize closure of the cross-tenant authorization defect (RISK-001) — it is both the top-scoring risk on
              the register and its largest dollar exposure.
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
      <div className="px-8 pt-5 pb-12 grid grid-cols-3 gap-5">
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
          <div className="text-sm font-semibold mb-4" style={{ color: C.ink }}>Assurance Dimensions</div>
          <div className="space-y-4">
            {ASSURANCE_DIMENSIONS.map((d) => (
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
    </div>
  );
}
