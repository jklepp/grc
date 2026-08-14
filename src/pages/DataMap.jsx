import React, { useMemo, useState } from "react";
import { Network, ArrowRight, ArrowDown, AlertTriangle, X } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { SYSTEM_MAPS, TOTAL_ASSET_COUNT, TOTAL_RELATIONSHIP_COUNT, weakestLink, flowAssurancePct, getNode } from "../data/dataMap";
import { ASSURANCE_CATEGORIES, assuranceBand } from "../data/assuranceModel";

function colorFor(key) {
  return { color: C[key], bg: C[`${key}Bg`] };
}

function AssuranceChip({ label, value, band }) {
  const { color, bg } = colorFor(band.color);
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: C.panel2 }}>
      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{value}</span>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color, background: bg }}>{band.label}</span>
      </div>
    </div>
  );
}

function AssuranceCategoryBar({ label, score }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 shrink-0 text-[11px]" style={{ color: C.ink }}>{label}</div>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: C.accent }} />
      </div>
      <div className="w-6 text-[11px] text-right font-medium" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{score}</div>
    </div>
  );
}

function AssuranceRiskCard({ title, risk }) {
  const { color, bg } = colorFor(risk.band.color);
  return (
    <div className="rounded-lg p-2.5 flex-1" style={{ background: C.panel2 }}>
      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.muted }}>{title}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{risk.score}<span className="text-[10px] font-normal" style={{ color: C.muted }}> /25</span></div>
      <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-1" style={{ color, background: bg }}>{risk.band.label}</span>
    </div>
  );
}

const PROFILE_STATUS_META = {
  met: { label: "Met", color: C.green, bg: C.greenBg },
  partial: { label: "Partial", color: C.amber, bg: C.amberBg },
  gap: { label: "Gap", color: C.red, bg: C.redBg },
};

function AssuranceSection({ node }) {
  const a = node.asset;
  return (
    <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Cyber Assurance</div>
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ color: C.accent, background: C.accentBg }}>
          Asset Register
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <AssuranceChip label="Criticality" value={a.criticality} band={a.criticalityBand} />
        <AssuranceChip label="Control Assurance" value={a.overallAssurance} band={a.assuranceBand} />
        <AssuranceChip label="Evidence Confidence" value={a.evidenceConfidence} band={a.evidenceConfidenceBand} />
        <AssuranceChip
          label="Compliance Coverage"
          value={`${a.complianceCoveragePct}%`}
          band={a.complianceCoveragePct >= 90 ? { label: "Strong", color: "green" } : a.complianceCoveragePct >= 75 ? { label: "Adequate", color: "amber" } : { label: "Weak", color: "red" }}
        />
      </div>

      <div className="space-y-2 mb-4">
        {ASSURANCE_CATEGORIES.map((c) => <AssuranceCategoryBar key={c} label={c} score={a.categoryScores[c]} />)}
      </div>

      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Criticality factors</div>
        {Object.entries(a.criticalityFactors).map(([key, factor]) => (
          <div key={key} className="flex items-start justify-between gap-2 py-1 text-[11px]">
            <span style={{ color: C.muted }}>{factor.reason}</span>
            <span className="font-medium shrink-0" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{factor.score}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <AssuranceRiskCard title="Inherent Risk" risk={a.inherentRisk} />
        <AssuranceRiskCard title="Residual Risk" risk={a.residualRisk} />
      </div>
    </div>
  );
}

// Fixed hues per pipeline stage — purely categorical (which hop is this?),
// deliberately distinct from the green/amber/red vocabulary used for grade
// bands so a stage badge is never mistaken for a health signal.
const STAGE_COLORS = {
  Ingress: "#7C6FEE",
  "Primary Custody": "#2E8B96",
  Processing: "#B0559E",
  Delivery: "#5B6EA8",
};

function NodeCard({ node, stageName, selected, onSelect }) {
  const { color } = colorFor(node.asset.assuranceBand.color);
  return (
    <button
      onClick={() => onSelect(node.key)}
      className="rounded-xl overflow-hidden shrink-0 text-left transition-colors"
      style={{ background: C.panel, border: `1px solid ${selected ? C.accent : C.border}`, width: 168 }}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: STAGE_COLORS[stageName], color: "#fff" }}
          >
            {node.code}
          </span>
          <span className="text-sm font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{node.asset.overallAssurance}%</span>
        </div>
        <div className="text-sm font-semibold leading-tight" style={{ color: C.ink }}>{node.name}</div>
        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{node.subtitle}</div>
      </div>
      <div style={{ height: 3, background: color }} />
    </button>
  );
}

function StageColumn({ stage, selectedKey, onSelectNode }) {
  const primary = stage.nodes.filter((n) => !n.branch);
  const branches = stage.nodes.filter((n) => n.branch);

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 168 }}>
      <div className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
        {stage.name}
      </div>
      {stage.nodes.length === 0 ? (
        <div
          className="rounded-xl flex items-center justify-center text-[11px] text-center px-3"
          style={{ width: 168, height: 74, border: `1px dashed ${C.border}`, color: C.muted }}
        >
          No assets at this stage
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {primary.map((n) => (
            <NodeCard key={n.key} node={getNode(n.key)} stageName={stage.name} selected={n.key === selectedKey} onSelect={onSelectNode} />
          ))}
          {branches.map((n) => (
            <React.Fragment key={n.key}>
              <ArrowDown size={13} color={C.border} />
              <NodeCard node={getNode(n.key)} stageName={stage.name} selected={n.key === selectedKey} onSelect={onSelectNode} />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function FlowChart({ flow, selectedKey, onSelectNode }) {
  const stages = flow.stages;
  return (
    <div className="rounded-2xl p-6 overflow-x-auto" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="flex items-start" style={{ minWidth: "fit-content" }}>
        {stages.map((s, i) => (
          <React.Fragment key={s.name}>
            <StageColumn stage={s} selectedKey={selectedKey} onSelectNode={onSelectNode} />
            {i < stages.length - 1 && (
              <div className="flex items-center justify-center shrink-0" style={{ width: 32, marginTop: 44 }}>
                {s.nodes.some((n) => !n.branch) && stages[i + 1].nodes.some((n) => !n.branch) ? (
                  <ArrowRight size={16} color={C.muted} />
                ) : (
                  <div style={{ width: 20, height: 1, background: C.border }} />
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function joinAnd(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function WeakestLinkBanner({ flow }) {
  const weak = weakestLink(flow);
  if (!weak) return null;
  const asset = weak.asset;
  const gapCats = Object.entries(asset.profileEvaluation).filter(([, v]) => v.status === "gap").map(([cat]) => cat);
  const reason = gapCats.length > 0
    ? `${joinAnd(gapCats)} ${gapCats.length > 1 ? "fall" : "falls"} short of the ${weak.classification} control profile.`
    : "Some categories only partially meet the required control profile.";
  const strong = asset.overallAssurance >= 90;
  return (
    <div
      className="rounded-lg px-4 py-3 flex items-center gap-3"
      style={{ background: strong ? C.panel2 : C.redBg, border: `1px solid ${strong ? C.border : C.red + "4D"}` }}
    >
      <AlertTriangle size={16} color={strong ? C.muted : C.red} className="shrink-0" />
      <div className="text-sm" style={{ color: C.ink }}>
        {strong ? (
          <>Every asset in this system scores <span style={{ fontWeight: 600 }}>90% Cyber Assurance or better</span> — no weak link to flag right now.</>
        ) : (
          <><span style={{ fontWeight: 600 }}>Weakest link: {weak.name}</span> <span style={{ color: C.muted }}>({asset.overallAssurance}%)</span> · {reason}</>
        )}
      </div>
    </div>
  );
}

// Docked to the right of the flow chart rather than a bottom sheet or modal —
// mirrors the app's own left nav rail (a persistent side panel, not an
// overlay), and it can stay open while browsing the chart.
function SystemDetailPanel({ node, onClose }) {
  const asset = node.asset;
  const { color } = colorFor(asset.assuranceBand.color);

  return (
    <div className="shrink-0 flex flex-col" style={{ width: 320, borderLeft: `1px solid ${C.border}`, background: C.panel, position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto" }}>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{node.code}</span>
          <div className="text-base font-semibold mt-2 leading-tight" style={{ color: C.ink }}>{node.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {node.subtitle}
            <br />{node.system.name} · {node.system.id} · {node.classification}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: C.muted, background: C.panel2 }} title="Close">
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-3xl font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.overallAssurance}%</div>
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{asset.assuranceBand.label} Cyber Assurance</div>
          <div className="text-[11px]" style={{ color: C.muted }}>{asset.complianceCoveragePct}% compliance coverage against tier</div>
        </div>
      </div>

      <AssuranceSection node={node} />

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Standards in scope</div>
        <div className="flex flex-wrap gap-1.5">
          {node.system.standards.map((s) => (
            <span key={s} className="text-[11px] px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{s}</span>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Required Control Profile ({node.classification})</div>
        <div className="space-y-1.5">
          {ASSURANCE_CATEGORIES.map((c) => {
            const evalRow = asset.profileEvaluation[c];
            const meta = PROFILE_STATUS_META[evalRow.status];
            return (
              <div key={c} className="flex items-center gap-2 text-xs">
                <span className="shrink-0" style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }} />
                <span className="flex-1" style={{ color: C.ink }}>{c}</span>
                <span style={{ color: meta.color }}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SystemTile({ system, active, onSelect }) {
  const meta = CLASS_META[system.classification];
  const flow = system.dataTypes.all;
  const pct = flowAssurancePct(flow);
  const band = pct != null ? assuranceBand(pct) : null;
  return (
    <button
      onClick={() => onSelect(system.id)}
      className="rounded-xl p-4 text-left transition-colors"
      style={{
        background: active ? C.accentBg : C.panel,
        border: `1px solid ${active ? C.accent : C.border}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{system.name}</span>
        {band ? (
          <span className="text-sm font-bold shrink-0" style={{ color: colorFor(band.color).color }}>{pct}%</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.color }}>{system.classification}</span>
        <span style={{ color: C.muted }}>{system.id} · {system.assetCount} assets</span>
      </div>
    </button>
  );
}

export default function DataMap() {
  const [systemId, setSystemId] = useState(SYSTEM_MAPS[0]?.id ?? null);
  const [selectedKey, setSelectedKey] = useState(null);

  const system = SYSTEM_MAPS.find((s) => s.id === systemId);
  const flow = useMemo(() => system?.dataTypes.all, [system]);

  function selectSystem(id) {
    setSystemId(id);
    setSelectedKey(null);
  }

  function toggleSelectedNode(key) {
    setSelectedKey((cur) => (cur === key ? null : key));
  }

  return (
    <div className="w-full flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-1 min-w-0">
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                <Network size={13} /> Enterprise Data Map
              </div>
              <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>Enterprise Data Map</h1>
            </div>
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
              {SYSTEM_MAPS.length} systems · {TOTAL_ASSET_COUNT} assets mapped · {TOTAL_RELATIONSHIP_COUNT} custody relationships mapped
            </div>
          </div>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
            Choose a system to see how data moves through its real assets, from ingress to primary custody to processing and delivery. Grades are computed live from the Asset Register — the same data behind the System Security Plan. Click any asset in the chart for details.
          </p>
        </div>

        <div className="px-8 grid grid-cols-4 gap-3 mb-6">
          {SYSTEM_MAPS.map((s) => (
            <SystemTile key={s.id} system={s} active={s.id === systemId} onSelect={selectSystem} />
          ))}
        </div>

        {flow && (
          <>
            <div className="px-8 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{system.name}</h2>
                <span className="text-xs" style={{ color: C.muted }}>{system.classification} · {flowAssurancePct(flow)}% Cyber Assurance</span>
              </div>
              <FlowChart flow={flow} selectedKey={selectedKey} onSelectNode={toggleSelectedNode} />
            </div>

            <div className="px-8 pb-6">
              <WeakestLinkBanner flow={flow} />
            </div>
          </>
        )}
      </div>

      {selectedKey && <SystemDetailPanel node={getNode(selectedKey)} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
