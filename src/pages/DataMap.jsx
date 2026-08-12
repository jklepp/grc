import React, { useMemo, useState } from "react";
import { Network, ArrowRight, ArrowDown, AlertTriangle, Layers, X } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { DOMAINS, MAPPED_DATA_TYPE_COUNT, MAPPED_RELATIONSHIP_COUNT, weakestLink, gradeBand, dataTypeGrade, getNode } from "../data/dataMap";

function statusColor(status) {
  if (status === "compliant") return C.green;
  if (status === "partial") return C.amber;
  return C.red;
}

// Fixed hues per pipeline stage — purely categorical (which hop is this?),
// deliberately distinct from the green/amber/red vocabulary used for grade
// bands so a stage badge is never mistaken for a health signal.
const STAGE_COLORS = {
  Source: "#3E7CB1",
  Ingress: "#7C6FEE",
  "Primary Custody": "#2E8B96",
  Processing: "#B0559E",
  Delivery: "#5B6EA8",
};

function bandColor(band) {
  if (band === "good") return { color: C.green, bg: C.greenBg };
  if (band === "watch") return { color: C.amber, bg: C.amberBg };
  return { color: C.red, bg: C.redBg };
}

function NodeCard({ node, stageName, selected, onSelect }) {
  const { color } = bandColor(node.band);
  const envLabel = node.system ? node.system.env.replace(/^Production — /, "") : null;
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
          <span className="text-sm font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{node.letter}</span>
        </div>
        <div className="text-sm font-semibold leading-tight" style={{ color: C.ink }}>{node.name}</div>
        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{envLabel || node.subtitle}</div>
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
          None for this data type
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

function FlowChart({ dataType, selectedKey, onSelectNode }) {
  const stages = dataType.stages;
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

function WeakestLinkBanner({ dataType }) {
  const weak = weakestLink(dataType);
  if (!weak) return null;
  const gapControls = weak.gaps.filter((g) => g.status === "gap").map((g) => g.control);
  const reason = gapControls.length > 0
    ? `${gapControls.join(" and ")} ${gapControls.length > 1 ? "do" : "does"} not satisfy the Restricted data baseline.`
    : "Some tracked controls are only partially in place.";
  const strong = weak.band === "good";
  return (
    <div
      className="rounded-lg px-4 py-3 flex items-center gap-3"
      style={{ background: strong ? C.panel2 : C.redBg, border: `1px solid ${strong ? C.border : C.red + "4D"}` }}
    >
      <AlertTriangle size={16} color={strong ? C.muted : C.red} className="shrink-0" />
      <div className="text-sm" style={{ color: C.ink }}>
        {strong ? (
          <>Every system in this chain grades <span style={{ fontWeight: 600 }}>B or better</span> — no weak link to flag right now.</>
        ) : (
          <><span style={{ fontWeight: 600 }}>Weakest link: {weak.name}</span> <span style={{ color: C.muted }}>({weak.letter})</span> · {reason}</>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span className="font-semibold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
    </div>
  );
}

const STATUS_LABEL = { compliant: "Compliant", partial: "Partial", gap: "Gap" };

// Docked to the right of the flow chart rather than a bottom sheet or modal —
// mirrors the app's own left nav rail (a persistent side panel, not an
// overlay), and it can stay open across data-type tab switches so you can
// keep browsing the chart while comparing systems.
function SystemDetailPanel({ node, onClose }) {
  const { color } = bandColor(node.band);
  const envLabel = node.system ? node.system.env : null;

  const statRows = node.breakdown
    ? [
        { label: "Applicable Controls", value: node.breakdown.required, color: C.ink },
        { label: "Inherited", value: node.breakdown.inherited, color: C.green },
        { label: "Satisfied", value: node.breakdown.satisfied, color: C.green },
        { label: "Open Gaps", value: node.breakdown.openGaps, color: C.amber },
        { label: "Not Implemented", value: node.breakdown.notImplemented, color: C.red },
      ]
    : [
        { label: "Tracked Controls", value: node.controlRows.length, color: C.ink },
        { label: "Compliant", value: node.controlRows.filter((c) => c.status === "compliant").length, color: C.green },
        { label: "Partial", value: node.controlRows.filter((c) => c.status === "partial").length, color: C.amber },
        { label: "Gaps", value: node.controlRows.filter((c) => c.status === "gap").length, color: C.red },
      ];

  return (
    <div className="shrink-0 flex flex-col" style={{ width: 320, borderLeft: `1px solid ${C.border}`, background: C.panel, position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto" }}>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{node.code}</span>
          <div className="text-base font-semibold mt-2 leading-tight" style={{ color: C.ink }}>{node.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {envLabel || node.subtitle}
            {node.system && <><br />{node.system.id} · {node.system.classification}</>}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: C.muted, background: C.panel2 }} title="Close">
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-3xl font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{node.letter}</div>
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{Math.round(node.pct)}% compliant</div>
          <div className="text-[11px]" style={{ color: C.muted }}>Overall control health</div>
        </div>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        {statRows.map((r) => <StatRow key={r.label} {...r} />)}
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Standards in scope</div>
        {node.system ? (
          <div className="flex flex-wrap gap-1.5">
            {node.system.standards.map((s) => (
              <span key={s} className="text-[11px] px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{s}</span>
            ))}
          </div>
        ) : (
          <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
            Pipeline component, not a system of record in the compliance register — only the {node.controlRows.length} core tracked controls apply, no standards crosswalk.
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Tracked controls</div>
        <div className="space-y-1.5">
          {node.controlRows.map((row) => (
            <div key={row.control} className="flex items-center gap-2 text-xs">
              <span className="shrink-0" style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(row.status) }} />
              <span className="flex-1" style={{ color: C.ink }}>{row.control}</span>
              <span style={{ color: statusColor(row.status) }}>{STATUS_LABEL[row.status]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DomainTile({ domain, active, onSelect }) {
  const meta = CLASS_META[domain.classification];
  return (
    <button
      onClick={() => onSelect(domain.id)}
      className="rounded-xl p-4 text-left transition-colors"
      style={{
        background: active ? C.accentBg : C.panel,
        border: `1px solid ${active ? C.accent : C.border}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{domain.name}</span>
        {domain.grade ? (
          <span className="text-sm font-bold shrink-0" style={{ color: bandColor(gradeBand(domain.grade)).color }}>{domain.grade}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.color }}>{domain.classification}</span>
        <span style={{ color: C.muted }}>{domain.mapped ? `${domain.systemCount} systems` : "Not yet mapped"}</span>
      </div>
    </button>
  );
}

export default function DataMap() {
  const [domainId, setDomainId] = useState(DOMAINS[0].id);
  const [typeKey, setTypeKey] = useState("all");
  const [selectedKey, setSelectedKey] = useState(null);

  const domain = DOMAINS.find((d) => d.id === domainId);

  const dataType = useMemo(() => {
    if (!domain.mapped) return null;
    return domain.dataTypes[typeKey] || domain.dataTypes.all;
  }, [domain, typeKey]);

  function selectDomain(id) {
    setDomainId(id);
    setTypeKey("all");
    setSelectedKey(null);
  }

  // Switching data types keeps the panel open — it's about a system, not tied
  // to being visible in the current chart, so you can compare it across tabs.
  // Switching domains closes it, since the node set underneath changes entirely.
  function selectType(key) {
    setTypeKey(key);
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
            <div className="text-xs text-right" style={{ color: C.muted }}>
              {DOMAINS.length} domains · {MAPPED_DATA_TYPE_COUNT} data types mapped · {MAPPED_RELATIONSHIP_COUNT} custody relationships mapped
            </div>
          </div>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
            Choose a domain, then focus the map on a specific data type. Grades are computed live from each system's tracked controls — the same data behind the Data Classification Register and System Security Plan. Click any system in the chart for details.
          </p>
        </div>

        <div className="px-8 grid grid-cols-4 gap-3 mb-6">
          {DOMAINS.map((d) => (
            <DomainTile key={d.id} domain={d} active={d.id === domainId} onSelect={selectDomain} />
          ))}
        </div>

        {!domain.mapped ? (
          <div className="px-8 pb-12">
            <div className="rounded-xl p-8 text-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <Layers size={22} color={C.muted} className="mx-auto mb-3" />
              <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>{domain.name} hasn't been mapped yet</div>
              <div className="text-xs" style={{ color: C.muted }}>Its custody chain isn't walked yet, so there's no flow chart to show. Select Customer &amp; End-User to see a fully mapped domain.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-8 flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest font-semibold shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
                {domain.name.toUpperCase()} TYPES
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(domain.dataTypes).map(([key, dt]) => {
                  const isActive = key === typeKey;
                  return (
                    <button
                      key={key}
                      onClick={() => selectType(key)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                      style={{
                        background: isActive ? C.accent : C.panel,
                        color: isActive ? "#fff" : C.muted,
                        border: `1px solid ${isActive ? C.accent : C.border}`,
                      }}
                    >
                      {dt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-8 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>
                  {domain.dataTypes[typeKey]?.label || "All Data"}
                </h2>
                <span className="text-xs" style={{ color: C.muted }}>{domain.classification} · Grade {dataTypeGrade(dataType)}</span>
              </div>
              <FlowChart dataType={dataType} selectedKey={selectedKey} onSelectNode={toggleSelectedNode} />
            </div>

            <div className="px-8 pb-6">
              <WeakestLinkBanner dataType={dataType} />
            </div>
          </>
        )}
      </div>

      {selectedKey && <SystemDetailPanel node={getNode(selectedKey)} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
