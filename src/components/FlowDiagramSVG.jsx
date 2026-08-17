import React, { forwardRef } from "react";
import { LIGHT } from "../theme";

// The "true" flow diagrams: every node is a real asset or actor, every edge a
// real DATA_FLOWS or ACTOR_ACCESS record (via utils/flowDiagramLayout.js) —
// no stage bucketing, no implied adjacency. Rendered on a fixed light
// palette rather than the app's live theme tokens: this is meant to become a
// standalone printed artifact (on screen or exported to PDF), so it should
// look the same regardless of whether the rest of the app is in dark mode.
//
// Plain SVG only (rect/path/text, no foreignObject or CSS) because the PDF
// export path (svg2pdf.js) can only faithfully convert primitive SVG.

const EDGE_STYLE = {
  data: { stroke: LIGHT.accent, dash: null, marker: "arrow-data", label: "Data flow" },
  "control-plane": { stroke: LIGHT.na, dash: "5,4", marker: "arrow-control", label: "Control plane (protects, not in request path)" },
  "actor-in": { stroke: LIGHT.green, dash: null, marker: "arrow-in", label: "Actor — inbound (calls in)" },
  "actor-out": { stroke: LIGHT.amber, dash: null, marker: "arrow-out", label: "Actor — outbound (we call out)" },
  "actor-internal": { stroke: LIGHT.red, dash: "1,3", marker: "arrow-internal", label: "Actor — internal (standing access, not a request-path call)" },
};

function Markers() {
  const defs = Object.entries(EDGE_STYLE);
  return (
    <defs>
      {defs.map(([kind, s]) => (
        <marker key={kind} id={s.marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={s.stroke} />
        </marker>
      ))}
    </defs>
  );
}

function AssetNode({ node }) {
  const asset = node.ref;
  // Criticality, not assurance. An asset no longer has an assurance score —
  // the control that applies to it is scored at the system boundary instead —
  // so what a node can honestly colour by is how much its compromise would
  // cost, which is derived from the asset's own factors and nothing else.
  const bandColor = { green: LIGHT.green, amber: LIGHT.amber, red: LIGHT.red, na: LIGHT.na }[asset.criticalityBand?.color] || LIGHT.na;
  return (
    <g>
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={8} fill={LIGHT.panel} stroke={node.branch ? LIGHT.na : LIGHT.border} strokeWidth={1} strokeDasharray={node.branch ? "3,3" : undefined} />
      <rect x={node.x} y={node.y} width={4} height={node.h} rx={2} fill={bandColor} />
      <text x={node.x + 12} y={node.y + 20} fontSize={9} fontWeight="bold" fill={LIGHT.accent} fontFamily="Courier New, monospace">{asset.code}</text>
      <text x={node.x + node.w - 10} y={node.y + 20} fontSize={9} fontWeight="bold" fill={bandColor} textAnchor="end" fontFamily="Courier New, monospace">{asset.criticality}</text>
      <text x={node.x + 12} y={node.y + 36} fontSize={11} fontWeight="bold" fill={LIGHT.ink}>
        {asset.name.length > 26 ? asset.name.slice(0, 25) + "…" : asset.name}
      </text>
      <text x={node.x + 12} y={node.y + 50} fontSize={9} fill={LIGHT.muted}>
        {(asset.type || "").length > 32 ? asset.type.slice(0, 31) + "…" : asset.type}
      </text>
    </g>
  );
}

function ActorNode({ node }) {
  const actor = node.ref;
  const isHuman = actor.kind === "human";
  return (
    <g>
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={8} fill={LIGHT.panel2} stroke={LIGHT.border} strokeWidth={1} strokeDasharray="2,3" />
      <rect x={node.x + 8} y={node.y + 8} width={54} height={13} rx={3} fill={isHuman ? LIGHT.accent : LIGHT.na} />
      <text x={node.x + 35} y={node.y + 17.5} fontSize={8} fontWeight="bold" fill="#fff" textAnchor="middle">{isHuman ? "HUMAN" : "MACHINE"}</text>
      <text x={node.x + 10} y={node.y + 34} fontSize={10.5} fontWeight="bold" fill={LIGHT.ink}>
        {actor.name.length > 22 ? actor.name.slice(0, 21) + "…" : actor.name}
      </text>
      <text x={node.x + 10} y={node.y + 46} fontSize={8.5} fill={LIGHT.muted}>{actor.description}</text>
    </g>
  );
}

const FlowDiagramSVG = forwardRef(function FlowDiagramSVG({ diagram, selectedKey, onSelectNode }, ref) {
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      width={diagram.width}
      height={diagram.height}
      style={{ background: LIGHT.bg, borderRadius: 12, maxWidth: "100%", height: "auto" }}
      fontFamily="Helvetica, Arial, sans-serif"
    >
      <Markers />
      <rect x={0} y={0} width={diagram.width} height={diagram.height} fill={LIGHT.bg} />
      {diagram.categoryLabels?.map((c) => (
        <text key={c.label} x={c.x} y={c.y} fontSize={9.5} fontWeight="bold" fill={LIGHT.accent} fontFamily="Courier New, monospace" letterSpacing="0.5">
          {c.label.toUpperCase()}
        </text>
      ))}
      {diagram.edges.map((e) => {
        const style = EDGE_STYLE[e.kind];
        return (
          <path
            key={e.id}
            d={e.path}
            fill="none"
            stroke={style.stroke}
            strokeWidth={1.5}
            strokeDasharray={style.dash || undefined}
            markerEnd={`url(#${style.marker})`}
            opacity={0.85}
          >
            <title>{e.note || e.id}</title>
          </path>
        );
      })}
      {diagram.nodes.map((n) => (
        <g
          key={n.id}
          onClick={() => n.kind === "asset" && onSelectNode?.(n.id)}
          style={{ cursor: n.kind === "asset" ? "pointer" : "default" }}
        >
          {n.kind === "asset" ? <AssetNode node={n} /> : <ActorNode node={n} />}
          {n.id === selectedKey && (
            <rect x={n.x - 2} y={n.y - 2} width={n.w + 4} height={n.h + 4} rx={10} fill="none" stroke={LIGHT.accent} strokeWidth={2} />
          )}
        </g>
      ))}
    </svg>
  );
});

export default FlowDiagramSVG;

// `kinds` lets each page show only the edge styles it actually uses (the
// data-flow page never has control-plane lines and vice versa) instead of a
// static four-item key that half-applies to whichever page it's next to.
export function FlowDiagramLegend({ kinds }) {
  const list = kinds || Object.keys(EDGE_STYLE);
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px]" style={{ color: LIGHT.muted }}>
      {list.map((kind) => {
        const it = EDGE_STYLE[kind];
        if (!it) return null;
        return (
          <div key={kind} className="flex items-center gap-1.5">
            <svg width="20" height="8">
              <line x1="0" y1="4" x2="20" y2="4" stroke={it.stroke} strokeWidth={2} strokeDasharray={it.dash || undefined} />
            </svg>
            {it.label}
          </div>
        );
      })}
    </div>
  );
}
