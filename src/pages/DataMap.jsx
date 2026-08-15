import React, { useEffect, useMemo, useRef, useState } from "react";
import { Network, AlertTriangle, X, KeyRound, User, Cpu, Database, Search, ChevronDown, Workflow, LayoutList, Download, Loader2 } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag } from "../components/SystemBadges";
import {
  getAllSystems, getAsset, getDataFlows, getAllDataTypes, dataTypesForSystem, dataForAsset,
  ASSURANCE_CATEGORIES, assuranceBand, evaluateAssetAgainstProfile, IMPLEMENTATION_STATUS_META,
  ACTOR_KINDS,
} from "../engine";
import { buildDataFlowDiagram, buildControlPlaneMatrix } from "../utils/flowDiagramLayout";
import FlowDiagramSVG, { FlowDiagramLegend } from "../components/FlowDiagramSVG";
import FlowMatrixSVG, { FlowMatrixLegend } from "../components/FlowMatrixSVG";
import { exportFlowDiagramPdf } from "../utils/exportFlowDiagramPdf";

const SYSTEMS = getAllSystems();

function colorFor(key) {
  return { color: C[key], bg: C[`${key}Bg`] };
}

// The shared `na` token is a light-to-medium grey tuned for small dots and
// borders elsewhere in the app; on the flow diagram's Control Plane rail and
// MACHINE badge it's a solid fill behind white text, where that lighter grey
// reads low-contrast. Darkened here rather than in theme.js so the shared
// token (and its other, smaller uses) is untouched.
function naFill() {
  return `color-mix(in srgb, ${C.na} 60%, black)`;
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
// name to print. Depth 0 is whatever nothing else in the boundary feeds
// (seeded from ingress-kind assets, so it's a role, not a coincidence of
// position). Everything else is labelled by how many hops from ingress it
// sits — Egress is deliberately NOT one of these labels: it's a separate,
// explicit role (BOUNDARY_EGRESS_KINDS) rendered in its own section below,
// because the deepest stage the walk reaches is just as often an internal
// worker or log feed as an actual boundary component.
function stageLabel(depth) {
  if (depth === 0) return "Ingress";
  return `Stage ${depth}`;
}

// Fixed height + single-line truncation (with a title tooltip for the full
// text) keeps every card in a wrapped row the same height regardless of name
// length or whether it carries a footer line — so a row's height is set by
// the layout, not by whichever card happens to have the longest name.
//
// `compact` drops that fixed height instead of reserving footer space: Data
// Plane / Control Plane cards almost always carry a fed-by/protects footer,
// so pinning it to the bottom of a fixed-height card keeps that section
// aligned. Ingress/Stage/Egress cards only grow a footer when a data-type
// filter is active — reserving space for one they don't have most of the
// time just made every path-stage tile taller than it needed to be.
const NODE_CARD_WIDTH = 200;
const NODE_CARD_HEIGHT = 98;
// ActorCard keeps its own constant rather than sharing NODE_CARD_WIDTH, so it
// can be tuned independently of the stage cards.
const ACTOR_CARD_WIDTH = 176;
// Data Plane / Control Plane cards carry the same content as a stage card
// plus a near-always-present fed-by/protects footer, so they get their own,
// wider-and-shorter footprint instead of inheriting the stage card's — that
// footer line (often a long code list) needs the width, and the fixed height
// only needs to fit 2-3 short lines, not the taller box a stage card reserves.
const WIDE_NODE_CARD_WIDTH = 240;
const WIDE_NODE_CARD_HEIGHT = 72;

// Left rail carries identity (code) and status (score) as two color-coded
// bands rather than inline text, so both read at a glance without adding a
// line to the card. The bottom border repeats the score color a second time
// — redundant with the rail, but it's what lets a whole row of cards read as
// a strip of status color even when you're not close enough to read digits.
function NodeCard({ asset, footer, selected, onSelect, isBranch, compact, width = NODE_CARD_WIDTH, height }) {
  const { color } = colorFor(asset.assuranceBand.color);
  const cardHeight = height !== undefined ? height : (compact ? undefined : NODE_CARD_HEIGHT);
  return (
    <button
      onClick={() => onSelect(asset.id)}
      className="rounded-xl overflow-hidden shrink-0 text-left transition-colors flex flex-col"
      style={{ background: C.panel, border: `1px solid ${selected ? C.accent : C.border}`, width, height: cardHeight }}
    >
      <div className="flex flex-1 min-w-0">
        <div className="flex flex-col shrink-0" style={{ width: 40 }}>
          <div className="flex-1 flex items-center justify-center" style={{ background: isBranch ? naFill() : C.accent }}>
            <span className="text-[10px] font-bold" style={{ color: "#fff" }}>{asset.code}</span>
          </div>
          <div className="flex-1 flex items-center justify-center" style={{ background: color }}>
            <span className="text-[10px] font-bold" style={{ color: "#fff" }}>{asset.overallAssurance}%</span>
          </div>
        </div>
        <div className="p-2 flex-1 flex flex-col min-w-0 justify-center">
          <div className="text-xs font-semibold leading-tight truncate" style={{ color: C.ink }} title={asset.name}>{asset.name}</div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }} title={asset.type}>{asset.type}</div>
          {footer && (
            <div className="text-[10px] mt-0.5 truncate" style={{ color: C.accent }} title={footer}>{footer}</div>
          )}
        </div>
      </div>
      <div className="shrink-0" style={{ height: 3, background: color }} />
    </button>
  );
}

function ActorCard({ actor }) {
  const isHuman = actor.kind === ACTOR_KINDS.HUMAN;
  const Icon = isHuman ? User : Cpu;
  return (
    <div
      className="rounded-xl overflow-hidden shrink-0 text-left p-2 flex flex-col"
      style={{ background: C.panel, border: `1px solid ${C.border}`, width: ACTOR_CARD_WIDTH, height: 76 }}
    >
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: isHuman ? C.accent : naFill(), color: "#fff" }}>
          {isHuman ? "HUMAN" : "MACHINE"}
        </span>
        <Icon size={13} color={C.muted} className="shrink-0" />
      </div>
      <div className="text-xs font-semibold leading-tight truncate" style={{ color: C.ink }} title={actor.name}>{actor.name}</div>
      <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }} title={actor.description}>{actor.description}</div>
    </div>
  );
}

function SectionLabel({ children, hint }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span
        className="text-[10px] uppercase tracking-widest font-semibold leading-none"
        style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}
        title={hint}
      >
        {children}
      </span>
    </div>
  );
}

function ActorRow({ actorAccess, title, hint, isFirst }) {
  if (actorAccess.length === 0) return null;
  return (
    <div className="flex flex-col items-start w-full" style={isFirst ? undefined : { marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <SectionLabel hint={hint}>{title}</SectionLabel>
      <div className="flex flex-wrap items-start justify-center gap-3 w-full">
        {actorAccess.map(({ actor }) => (
          <ActorCard key={actor.id} actor={actor} />
        ))}
      </div>
    </div>
  );
}

function StageRow({ stage, isFirst, selectedKey, onSelectNode, rolesFor }) {
  return (
    <div className="flex flex-col items-start w-full" style={isFirst ? undefined : { marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <SectionLabel>{stageLabel(stage.depth)}</SectionLabel>
      <div className="flex flex-wrap items-start justify-center gap-3 w-full">
        {stage.nodes.map((asset) => (
          <NodeCard key={asset.id} asset={asset} footer={rolesFor(asset.id)?.join(" · ")} selected={asset.id === selectedKey} onSelect={onSelectNode} compact />
        ))}
      </div>
    </div>
  );
}

function EgressRow({ egress, isFirst, selectedKey, onSelectNode, rolesFor }) {
  return (
    <div className="flex flex-col items-start w-full" style={isFirst ? undefined : { marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <SectionLabel>Egress</SectionLabel>
      <div className="flex flex-wrap items-start justify-center gap-3 w-full">
        {egress.map(({ asset }) => (
          <NodeCard key={asset.id} asset={asset} footer={rolesFor(asset.id)?.join(" · ")} selected={asset.id === selectedKey} onSelect={onSelectNode} compact />
        ))}
      </div>
    </div>
  );
}

function FlowChart({ layout, selectedKey, onSelectNode, rolesFor }) {
  if (layout.stages.length === 0 && layout.dataPlane.length === 0 && layout.egress.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center text-sm" style={{ background: C.panel2, border: `1px dashed ${C.border}`, color: C.muted }}>
        No asset in this boundary carries the selected data type.
      </div>
    );
  }
  const hasIngressActors = layout.ingressActors && layout.ingressActors.length > 0;
  const hasEgressActors = layout.egressActors && layout.egressActors.length > 0;
  return (
    <div className="rounded-2xl p-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="flex flex-col items-stretch">
        {hasIngressActors && <ActorRow actorAccess={layout.ingressActors} title="Actors - Ingress" isFirst />}
        {layout.stages.map((s, i) => (
          <StageRow key={s.depth} stage={s} isFirst={!hasIngressActors && i === 0} selectedKey={selectedKey} onSelectNode={onSelectNode} rolesFor={rolesFor} />
        ))}
        {layout.egress.length > 0 && (
          <EgressRow egress={layout.egress} isFirst={!hasIngressActors && layout.stages.length === 0} selectedKey={selectedKey} onSelectNode={onSelectNode} rolesFor={rolesFor} />
        )}
        {hasEgressActors && (
          <ActorRow
            actorAccess={layout.egressActors}
            title="Actors - Egress"
            hint="external destinations reached from within the request path — not always from the Egress stage itself"
          />
        )}
      </div>

      {layout.dataPlane.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Database size={12} color={C.accent} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              Data plane
            </span>
            <span className="text-[11px]" style={{ color: C.muted }}>
              — persistent and stateful stores used by the system
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {layout.dataPlane.map(({ asset, fedBy }) => (
              <NodeCard
                key={asset.id}
                asset={asset}
                footer={fedBy.length > 0 ? `fed by ${fedBy.map((p) => p.code).join(" · ")}` : null}
                selected={asset.id === selectedKey}
                onSelect={onSelectNode}
                width={WIDE_NODE_CARD_WIDTH}
                height={WIDE_NODE_CARD_HEIGHT}
              />
            ))}
          </div>
        </div>
      )}

      {layout.branches.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <KeyRound size={12} color={C.accent} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              Control plane
            </span>
            <span className="text-[11px]" style={{ color: C.muted }}>
              — not in the request path; these protect the assets above rather than carrying data through them
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {layout.branches.map(({ asset, protects }) => (
              <NodeCard
                key={asset.id}
                asset={asset}
                footer={protects.length > 0 ? `protects ${protects.map((p) => p.code).join(" · ")}` : null}
                selected={asset.id === selectedKey}
                onSelect={onSelectNode}
                isBranch
                width={WIDE_NODE_CARD_WIDTH}
                height={WIDE_NODE_CARD_HEIGHT}
              />
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

// Tiles worked when there were two systems to lay out side by side; at
// production scale (100+ systems) a grid like that is just a long scroll.
// A search-and-select combobox keeps the footprint constant regardless of
// how many systems are in the register, while still surfacing the one fact
// that matters most before and after picking one — its classification tier
// — right in the control itself rather than requiring a click to find out.
function SystemPicker({ systems, systemId, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = systems.find((s) => s.id === systemId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) =>
      s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.classification.toLowerCase().includes(q)
    );
  }, [systems, query]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function choose(id) {
    onSelect(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef} style={{ width: 380 }}>
      <div
        className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg cursor-text"
        style={{ background: C.panel, border: `1px solid ${open ? C.accent : C.border}` }}
        onClick={() => setOpen(true)}
      >
        <Search size={14} color={C.muted} className="shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected ? selected.name : "Search systems…"}
          className="bg-transparent text-sm outline-none w-full min-w-0"
          style={{ color: C.ink }}
        />
        <ChevronDown size={14} color={C.muted} className="shrink-0" />
      </div>

      {open && (
        <div
          className="absolute z-10 mt-1.5 w-full rounded-lg overflow-y-auto"
          style={{ background: C.panel, border: `1px solid ${C.border}`, maxHeight: 320, boxShadow: "0 12px 28px rgba(0,0,0,0.28)" }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: C.muted }}>No systems match "{query}"</div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => choose(s.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                style={{ background: s.id === systemId ? C.accentBg : "transparent", borderBottom: `1px solid ${C.border}` }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: C.ink }}>{s.name}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>{s.id} · {s.assetCount} assets</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ClassificationTag level={s.classification} />
                  <span className="text-xs font-semibold w-9 text-right" style={{ color: colorFor(assuranceBand(s.overallAssurance).color).color }}>{s.overallAssurance}%</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DataMap() {
  const [systemId, setSystemId] = useState(SYSTEMS[0]?.id ?? null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [dataTypeId, setDataTypeId] = useState("all");
  const [viewMode, setViewMode] = useState("cards");
  const [exporting, setExporting] = useState(false);
  const dataSvgRef = useRef(null);
  const controlSvgRef = useRef(null);

  const system = SYSTEMS.find((s) => s.id === systemId);
  const systemDataTypes = useMemo(() => (systemId ? dataTypesForSystem(systemId) : []), [systemId]);
  const fullLayout = useMemo(
    () => (systemId ? getDataFlows(systemId) : { stages: [], branches: [], dataPlane: [], egress: [], edges: [], controlPlaneEdges: [], ingressActors: [], egressActors: [] }),
    [systemId]
  );

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
      dataPlane: fullLayout.dataPlane.filter((d) => carries(d.asset.id) || d.fedBy.some((p) => carries(p.id))),
      egress: fullLayout.egress.filter((d) => carries(d.asset.id) || d.fedBy.some((p) => carries(p.id))),
      edges: fullLayout.edges.filter((e) => e.dataTypeIds.includes(dataTypeId)),
    };
  }, [fullLayout, dataTypeId]);

  const rolesFor = useMemo(() => (assetId) => {
    if (dataTypeId === "all") return null;
    return dataForAsset(assetId).filter((h) => h.dataTypeId === dataTypeId).map((h) => h.role);
  }, [dataTypeId]);

  // The true diagrams: real point-to-point edges instead of stage buckets,
  // split into a data-movement page and a control-plane page (see
  // utils/flowDiagramLayout.js) so the control layer's fan-out doesn't bury
  // the request path. Built from the same (possibly data-type-filtered)
  // layout the card view uses, so switching views never changes what's
  // actually being shown.
  const dataFlowDiagram = useMemo(() => buildDataFlowDiagram(layout), [layout]);
  const controlPlaneMatrix = useMemo(() => buildControlPlaneMatrix(layout, getAsset), [layout]);

  function selectSystem(id) {
    setSystemId(id);
    setSelectedKey(null);
    setDataTypeId("all");
  }

  async function handleExportPdf() {
    if (!dataSvgRef.current || !system) return;
    setExporting(true);
    try {
      const dataTypeLabel = dataTypeId !== "all" ? getAllDataTypes().find((d) => d.id === dataTypeId)?.name : null;
      await exportFlowDiagramPdf({
        dataSvgEl: dataSvgRef.current,
        dataDiagram: dataFlowDiagram,
        controlSvgEl: controlPlaneMatrix ? controlSvgRef.current : null,
        controlDiagram: controlPlaneMatrix,
        system,
        dataTypeLabel,
        layout,
        getAssetLabel: (assetId) => {
          const a = getAsset(assetId);
          return a ? `${a.code} — ${a.name}` : assetId;
        },
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="w-full flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-1 min-w-0">
        <PageHeader
          icon={Network}
          title="Systems Data Flow"
          description="How data moves between a system's assets, from ingress to egress."
          right={<SystemPicker systems={SYSTEMS} systemId={systemId} onSelect={selectSystem} />}
        />

        <div className="px-8 pb-4">
          {system && (
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{system.name}</h2>
              <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                <ClassificationTag level={system.classification} />
                <span>{system.overallAssurance}% Cyber Assurance</span>
              </div>
            </div>
          )}

          {system ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                  <span className="text-[11px] mr-1 shrink-0" style={{ color: C.muted }}>Filter by data type:</span>
                  {[{ id: "all", name: "All data" }, ...systemDataTypes].map((dt) => (
                    <button
                      key={dt.id}
                      onClick={() => setDataTypeId(dt.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0"
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

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center rounded-lg p-0.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => setViewMode("cards")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                      style={{ background: viewMode === "cards" ? C.panel : "transparent", color: viewMode === "cards" ? C.ink : C.muted }}
                    >
                      <LayoutList size={12} /> Cards
                    </button>
                    <button
                      onClick={() => setViewMode("diagram")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                      style={{ background: viewMode === "diagram" ? C.panel : "transparent", color: viewMode === "diagram" ? C.ink : C.muted }}
                      title="Real point-to-point edges, laid out from the graph — not stage buckets."
                    >
                      <Workflow size={12} /> Diagram
                    </button>
                  </div>
                  {viewMode === "diagram" && (
                    <button
                      onClick={handleExportPdf}
                      disabled={exporting}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}`, opacity: exporting ? 0.6 : 1 }}
                    >
                      {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      {exporting ? "Exporting…" : "Export PDF"}
                    </button>
                  )}
                </div>
              </div>

              {viewMode === "cards" ? (
                <FlowChart layout={layout} selectedKey={selectedKey} onSelectNode={(k) => setSelectedKey((cur) => (cur === k ? null : k))} rolesFor={rolesFor} />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                    <SectionLabel hint="Ingress actors through the request path to egress — the request-path story only.">
                      Data Movement
                    </SectionLabel>
                    <div className="mb-3 mt-2 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                      <FlowDiagramSVG
                        ref={dataSvgRef}
                        diagram={dataFlowDiagram}
                        selectedKey={selectedKey}
                        onSelectNode={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
                      />
                    </div>
                    <FlowDiagramLegend kinds={["data", "actor-in", "actor-out"]} />
                  </div>

                  {controlPlaneMatrix && (
                    <div className="rounded-2xl p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <SectionLabel hint="Every protector against everything it protects. Shown as a matrix rather than a diagram: this relationship is dense many-to-many (several protectors cover nearly identical asset sets), which no line-based layout can draw without crossings.">
                        Control Plane
                      </SectionLabel>
                      <div className="mb-3 mt-2 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                        <FlowMatrixSVG
                          ref={controlSvgRef}
                          matrix={controlPlaneMatrix}
                          selectedKey={selectedKey}
                          onSelectNode={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
                        />
                      </div>
                      <FlowMatrixLegend />
                    </div>
                  )}
                </div>
              )}

              <div className="text-[11px] mt-3" style={{ color: C.muted }}>
                {layout.edges.length} data flow{layout.edges.length === 1 ? "" : "s"} shown
                {dataTypeId !== "all" && ` carrying ${getAllDataTypes().find((d) => d.id === dataTypeId)?.name}`}
                {layout.controlPlaneEdges.length > 0 && ` · ${layout.controlPlaneEdges.length} control-plane relationships`}
              </div>
            </>
          ) : (
            <div className="rounded-2xl p-10 text-center text-sm" style={{ background: C.panel2, border: `1px dashed ${C.border}`, color: C.muted }}>
              Search for a system above to see how data moves through it.
            </div>
          )}
        </div>

        {system && (
          <div className="px-8 pb-6">
            <WeakestLinkBanner system={system} />
          </div>
        )}
      </div>

      {selectedKey && <SystemDetailPanel assetId={selectedKey} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
