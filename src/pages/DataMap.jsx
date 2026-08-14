import React, { useMemo, useState } from "react";
import { Network, ArrowRight, ArrowDown, AlertTriangle, X, KeyRound } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { PageHeader } from "../components/Headings";
import {
  getAllSystems, getAsset, getDataFlows, getAllDataTypes, dataTypesForSystem, dataForAsset,
  ASSURANCE_CATEGORIES, assuranceBand, evaluateAssetAgainstProfile, IMPLEMENTATION_STATUS_META, TOTAL_FLOW_COUNT, getAllAssets,
} from "../engine";

const SYSTEMS = getAllSystems();

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

function AssuranceCategoryBar({ label, rollup, weight }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: rollup.basis === "measured" ? C.green : C.na }} />
      <div className="w-20 shrink-0 text-[11px] truncate" style={{ color: C.ink }}>{label}</div>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: C.panel2, height: 2 + (weight / 25) * 5 }}>
        <div className="h-full rounded-full" style={{ width: `${rollup.score}%`, background: C.accent }} />
      </div>
      <div className="w-6 text-[10px] text-right shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{weight}%</div>
      <div className="w-6 text-[11px] text-right font-medium shrink-0" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{rollup.score}</div>
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
  met: { label: "Met", color: C.green },
  partial: { label: "Partial", color: C.amber },
  gap: { label: "Gap", color: C.red },
};

// Depth is derived by walking inbound data edges, so a stage has no stored
// name to print. Depth 0 is whatever nothing else in the boundary feeds; the
// rest are labelled by how many hops from there they sit.
function stageLabel(depth) {
  return depth === 0 ? "Ingress" : `Hop ${depth}`;
}

function NodeCard({ asset, roles, selected, onSelect, isBranch }) {
  const { color } = colorFor(asset.assuranceBand.color);
  return (
    <button
      onClick={() => onSelect(asset.id)}
      className="rounded-xl overflow-hidden shrink-0 text-left transition-colors"
      style={{ background: C.panel, border: `1px solid ${selected ? C.accent : C.border}`, width: 168 }}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: isBranch ? C.na : C.accent, color: "#fff" }}>
            {asset.code}
          </span>
          <span className="text-sm font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.overallAssurance}%</span>
        </div>
        <div className="text-sm font-semibold leading-tight" style={{ color: C.ink }}>{asset.name}</div>
        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{asset.type}</div>
        {roles && roles.length > 0 && (
          <div className="text-[10px] mt-1" style={{ color: C.accent }}>{roles.join(" · ")}</div>
        )}
      </div>
      <div style={{ height: 3, background: color }} />
    </button>
  );
}

function StageColumn({ stage, selectedKey, onSelectNode, rolesFor }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 168 }}>
      <div className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
        {stageLabel(stage.depth)}
      </div>
      <div className="flex flex-col items-center gap-2">
        {stage.nodes.map((asset) => (
          <NodeCard key={asset.id} asset={asset} roles={rolesFor(asset.id)} selected={asset.id === selectedKey} onSelect={onSelectNode} />
        ))}
      </div>
    </div>
  );
}

function FlowChart({ layout, selectedKey, onSelectNode, rolesFor }) {
  if (layout.stages.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center text-sm" style={{ background: C.panel2, border: `1px dashed ${C.border}`, color: C.muted }}>
        No asset in this boundary carries the selected data type.
      </div>
    );
  }
  return (
    <div className="rounded-2xl p-6 overflow-x-auto" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="flex items-start" style={{ minWidth: "fit-content" }}>
        {layout.stages.map((s, i) => (
          <React.Fragment key={s.depth}>
            <StageColumn stage={s} selectedKey={selectedKey} onSelectNode={onSelectNode} rolesFor={rolesFor} />
            {i < layout.stages.length - 1 && (
              <div className="flex items-center justify-center shrink-0" style={{ width: 32, marginTop: 44 }}>
                <ArrowRight size={16} color={C.muted} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {layout.branches.length > 0 && (
        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={12} color={C.muted} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
              Control plane
            </span>
            <span className="text-[11px]" style={{ color: C.muted }}>
              — not in the request path; these protect the assets above rather than carrying data through them
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {layout.branches.map(({ asset, protects }) => (
              <div key={asset.id} className="flex flex-col items-center gap-1">
                <NodeCard asset={asset} selected={asset.id === selectedKey} onSelect={onSelectNode} isBranch />
                {protects.length > 0 && (
                  <>
                    <ArrowDown size={12} color={C.border} />
                    <div className="text-[10px] text-center max-w-[168px]" style={{ color: C.muted }}>
                      {protects.map((p) => p.code).join(" · ")}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function joinAnd(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function WeakestLinkBanner({ system }) {
  const weak = system.weakestAsset;
  if (!weak) return null;
  const evaluation = evaluateAssetAgainstProfile(weak.id);
  const gapCats = ASSURANCE_CATEGORIES.filter((c) => evaluation[c].status === "gap");
  const failing = gapCats.flatMap((c) => evaluation[c].failingControls);
  const strong = weak.overallAssurance >= 90;

  const reason = failing.length > 0
    ? `${joinAnd([...new Set(failing.map((f) => f.control.friendlyName))])} ${failing.length > 1 ? "are" : "is"} failing against evidence.`
    : gapCats.length > 0
      ? `${joinAnd(gapCats)} ${gapCats.length > 1 ? "fall" : "falls"} short of the ${weak.classification} control profile.`
      : "Some categories only partially meet the required control profile.";

  return (
    <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: strong ? C.panel2 : C.redBg, border: `1px solid ${strong ? C.border : C.red + "4D"}` }}>
      <AlertTriangle size={16} color={strong ? C.muted : C.red} className="shrink-0" />
      <div className="text-sm" style={{ color: C.ink }}>
        {strong ? (
          <>Every asset in this system scores <span style={{ fontWeight: 600 }}>90% Cyber Assurance or better</span> — no weak link to flag right now.</>
        ) : (
          <><span style={{ fontWeight: 600 }}>Weakest link: {weak.name}</span> <span style={{ color: C.muted }}>({weak.overallAssurance}%)</span> · {reason}</>
        )}
      </div>
    </div>
  );
}

function SystemDetailPanel({ assetId, onClose }) {
  const asset = getAsset(assetId);
  const { color } = colorFor(asset.assuranceBand.color);
  const evaluation = evaluateAssetAgainstProfile(assetId);
  const held = dataForAsset(assetId);

  return (
    <div className="shrink-0 flex flex-col" style={{ width: 320, borderLeft: `1px solid ${C.border}`, background: C.panel, position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto" }}>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{asset.code}</span>
          <div className="text-base font-semibold mt-2 leading-tight" style={{ color: C.ink }}>{asset.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {asset.type}
            <br />{asset.system.name} · {asset.system.id} · {asset.classification}
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
          <div className="text-[11px]" style={{ color: C.muted }}>{asset.evidencedControlCount} of {asset.requiredControlCount} tracked controls evidenced</div>
        </div>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Data handled</div>
        <div className="space-y-1.5">
          {held.map((h) => (
            <div key={h.dataTypeId} className="flex items-center gap-2 text-[11px]">
              <span className="px-1.5 py-0.5 rounded shrink-0" style={{ background: CLASS_META[h.dataType.sensitivity].bg, color: CLASS_META[h.dataType.sensitivity].color }}>
                {h.dataType.sensitivity}
              </span>
              <span className="flex-1 min-w-0 truncate" style={{ color: C.ink }}>{h.dataType.name}</span>
              <span className="shrink-0" style={{ color: C.muted }}>{h.role}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] mt-2 leading-relaxed" style={{ color: C.muted }}>
          This is what sets the asset's {asset.classification} tier — it isn't inherited from the system.
        </div>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: C.muted }}>Cyber Assurance</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <AssuranceChip label="Criticality" value={asset.criticality} band={asset.criticalityBand} />
          <AssuranceChip label="Control Assurance" value={asset.overallAssurance} band={asset.assuranceBand} />
          <AssuranceChip label="Evidence Confidence" value={asset.evidenceConfidence} band={asset.evidenceConfidenceBand} />
          <AssuranceChip
            label="Control-Backed"
            value={`${asset.controlBackedPct}%`}
            band={asset.controlBackedPct >= 90 ? { label: "Strong", color: "green" } : asset.controlBackedPct >= 75 ? { label: "Adequate", color: "amber" } : { label: "Partial", color: "red" }}
          />
        </div>
        <div className="space-y-2 mb-4">
          {ASSURANCE_CATEGORIES.map((c) => <AssuranceCategoryBar key={c} label={c} rollup={asset.categories[c]} weight={asset.categoryWeights[c]} />)}
        </div>
        <div className="flex gap-2">
          <AssuranceRiskCard title="Inherent Risk" risk={asset.inherentRisk} />
          <AssuranceRiskCard title="Residual Risk" risk={asset.residualRisk} />
        </div>
      </div>

      {asset.deficientControls.length > 0 && (
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Failing controls</div>
          <div className="space-y-1.5">
            {asset.deficientControls.map((i) => (
              <div key={i.controlId} className="rounded-lg px-2.5 py-2" style={{ background: C.panel2 }}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: C.ink }}>{i.control.friendlyName}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: C.red, background: C.redBg }}>
                    {IMPLEMENTATION_STATUS_META[i.status].label}
                  </span>
                </div>
                {i.note && <div className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{i.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-4">
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Required Control Profile ({asset.classification})</div>
        <div className="space-y-1.5">
          {ASSURANCE_CATEGORIES.map((c) => {
            const meta = PROFILE_STATUS_META[evaluation[c].status];
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
  const band = assuranceBand(system.overallAssurance);
  return (
    <button
      onClick={() => onSelect(system.id)}
      className="rounded-xl p-4 text-left transition-colors"
      style={{ background: active ? C.accentBg : C.panel, border: `1px solid ${active ? C.accent : C.border}` }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{system.name}</span>
        <span className="text-sm font-bold shrink-0" style={{ color: colorFor(band.color).color }}>{system.overallAssurance}%</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.color }}>{system.classification}</span>
        <span style={{ color: C.muted }}>{system.id} · {system.assetCount} assets</span>
      </div>
    </button>
  );
}

export default function DataMap() {
  const [systemId, setSystemId] = useState(SYSTEMS[0]?.id ?? null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [dataTypeId, setDataTypeId] = useState("all");

  const system = SYSTEMS.find((s) => s.id === systemId);
  const systemDataTypes = useMemo(() => dataTypesForSystem(systemId), [systemId]);
  const fullLayout = useMemo(() => getDataFlows(systemId), [systemId]);

  // Filtering to one data type is a real query over the edges, not a second
  // dataset: keep the assets that touch it and the flows that carry it. The
  // previous model had nothing to filter on, which is why its per-data-type
  // view collapsed into a single combined chart.
  const layout = useMemo(() => {
    if (dataTypeId === "all") return fullLayout;
    const carries = (id) => dataForAsset(id).some((h) => h.dataTypeId === dataTypeId);
    return {
      ...fullLayout,
      stages: fullLayout.stages
        .map((s) => ({ ...s, nodes: s.nodes.filter((n) => carries(n.id)) }))
        .filter((s) => s.nodes.length > 0),
      branches: fullLayout.branches.filter((b) => carries(b.asset.id) || b.protects.some((p) => carries(p.id))),
      edges: fullLayout.edges.filter((e) => e.dataTypeIds.includes(dataTypeId)),
    };
  }, [fullLayout, dataTypeId]);

  const rolesFor = useMemo(() => (assetId) => {
    if (dataTypeId === "all") return null;
    return dataForAsset(assetId).filter((h) => h.dataTypeId === dataTypeId).map((h) => h.role);
  }, [dataTypeId]);

  function selectSystem(id) {
    setSystemId(id);
    setSelectedKey(null);
    setDataTypeId("all");
  }

  return (
    <div className="w-full flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-1 min-w-0">
        <PageHeader
          icon={Network}
          title="Enterprise Data Map"
          description="How data actually moves between a system's assets. Every connection here is a stored relationship carrying named data types, and each asset's position is derived by walking those connections — not a layout someone maintained alongside them. Grades come from the same graph as every other page. Click any asset for detail."
          right={
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
              {SYSTEMS.length} systems · {getAllAssets().length} assets · {TOTAL_FLOW_COUNT} data flows
            </div>
          }
        />

        <div className="px-8 grid grid-cols-4 gap-3 mb-5">
          {SYSTEMS.map((s) => (
            <SystemTile key={s.id} system={s} active={s.id === systemId} onSelect={selectSystem} />
          ))}
        </div>

        {system && (
          <>
            <div className="px-8 pb-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{system.name}</h2>
                <span className="text-xs" style={{ color: C.muted }}>{system.classification} · {system.overallAssurance}% Cyber Assurance</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-[11px] mr-1" style={{ color: C.muted }}>Filter by data type:</span>
                {[{ id: "all", name: "All data" }, ...systemDataTypes].map((dt) => (
                  <button
                    key={dt.id}
                    onClick={() => setDataTypeId(dt.id)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
                    style={{
                      background: dataTypeId === dt.id ? C.accentBg : "transparent",
                      color: dataTypeId === dt.id ? C.accent : C.muted,
                      border: `1px solid ${dataTypeId === dt.id ? C.accent : C.border}`,
                    }}
                  >
                    {dt.name}
                  </button>
                ))}
              </div>

              <FlowChart layout={layout} selectedKey={selectedKey} onSelectNode={(k) => setSelectedKey((cur) => (cur === k ? null : k))} rolesFor={rolesFor} />

              <div className="text-[11px] mt-3" style={{ color: C.muted }}>
                {layout.edges.length} data flow{layout.edges.length === 1 ? "" : "s"} shown
                {dataTypeId !== "all" && ` carrying ${getAllDataTypes().find((d) => d.id === dataTypeId)?.name}`}
                {layout.controlPlaneEdges.length > 0 && ` · ${layout.controlPlaneEdges.length} control-plane relationships`}
              </div>
            </div>

            <div className="px-8 pb-6">
              <WeakestLinkBanner system={system} />
            </div>
          </>
        )}
      </div>

      {selectedKey && <SystemDetailPanel assetId={selectedKey} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
