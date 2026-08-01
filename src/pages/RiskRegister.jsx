import React, { useState, useMemo } from "react";
import { Search, X, Lock, RefreshCw, AlertTriangle, ChevronDown, Circle, Clock } from "lucide-react";
import { C } from "../theme";
import { RISKS, SEVERITY_VALUE, LIKELIHOOD_VALUE, score } from "../data/riskRegister";

const SEVERITY_LEVELS = ["Minor", "Moderate", "Major", "Severe"]; // 1-4, bottom to top on heatmap
const LIKELIHOOD_LEVELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"]; // 1-5

function severityColor(sev) {
  const s = SEVERITY_VALUE[sev];
  if (s >= 4) return C.red;
  if (s >= 3) return C.amber;
  if (s >= 2) return "#D98255";
  return C.green;
}
function cellColor(sev, like) {
  const s = score(sev, like);
  if (s >= 15) return C.red;
  if (s >= 9) return "#D98255";
  if (s >= 4) return C.amber;
  return C.green;
}
function treatmentColor(t) {
  if (t === "Mitigate") return C.accent;
  if (t === "Accept") return C.green;
  if (t === "Transfer") return "#C9A6E8";
  return C.muted;
}
function milestoneMeta(status) {
  if (status === "done") return { color: C.green, label: "Done" };
  if (status === "in_progress") return { color: C.accent, label: "In progress" };
  if (status === "blocked") return { color: C.red, label: "Blocked" };
  return { color: C.muted, label: "Not started" };
}

function ScorePill({ value, sev }) {
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

export default function RiskRegister() {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [heatmapView, setHeatmapView] = useState("Residual");
  const [selected, setSelected] = useState(null);

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
    const grid = {};
    SEVERITY_LEVELS.forEach((sev) => {
      grid[sev] = {};
      LIKELIHOOD_LEVELS.forEach((like) => (grid[sev][like] = 0));
    });
    RISKS.forEach((r) => {
      const view = heatmapView === "Residual" ? r.residual : r.inherent;
      grid[view.severity][view.likelihood] += 1;
    });
    return grid;
  }, [heatmapView]);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              Common Control Framework
            </div>
            <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>
              Product & Enterprise Risk Register
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            <Lock size={12} /><span>Read-only</span><span style={{ color: C.border }}>|</span><RefreshCw size={12} /><span>Synced from Vanta · 8 min ago</span>
          </div>
        </div>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          Scenario-based risk register with appetite thresholds, control linkage, treatment plans, milestones, and accountable owners.
        </p>
      </div>

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
                className="w-full grid items-center px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
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
            <div className="flex rounded-full overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              {["Inherent", "Residual"].map((v) => (
                <button
                  key={v}
                  onClick={() => setHeatmapView(v)}
                  className="text-xs px-3 py-1 font-medium"
                  style={{ background: heatmapView === v ? C.accent : "transparent", color: heatmapView === v ? "#0F1420" : C.muted }}
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
                  <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.scenario}</h2>
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

              <div className="flex items-center justify-between text-sm mb-6 p-3 rounded-lg" style={{ background: C.panel2 }}>
                <span style={{ color: C.muted }}>Appetite threshold</span>
                <span style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>≤ {selected.appetite}</span>
              </div>

              <div className="flex items-center justify-between text-sm mb-1" style={{ color: C.muted }}>
                <span>Owner</span><span style={{ color: C.ink }}>{selected.owner}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-6" style={{ color: C.muted }}>
                <span>Linked control domain</span><span style={{ color: C.accent }}>{selected.linkedControl}</span>
              </div>

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
