import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Network, AlertTriangle, X, Workflow, Waypoints, Maximize2, Download, Loader2, RotateCcw } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag, AssuranceBadge, SystemPicker } from "../components/SystemBadges";
import {
  getAsset, getAllDataTypes, dataForAsset,
  INSTANCE_STATUS_META, PRISMA_LEVELS, ASSURANCE_TARGET,
  IMPACT_LEVEL_LABELS, IMPACT_LEVEL_SHORT,
} from "../engine";
import { buildDataFlowDiagram, buildControlPlaneMatrix } from "../utils/flowDiagramLayout";
import FlowDiagramSVG, { FlowDiagramLegend } from "../components/FlowDiagramSVG";
import FlowMatrixSVG, { FlowMatrixLegend } from "../components/FlowMatrixSVG";
import { exportFlowDiagramPdf } from "../utils/exportFlowDiagramPdf";
import Modal, { ModalCloseButton } from "../components/Modal";
import { SectionHeader } from "./SystemWorkspace/shared/SectionHeader";
import SystemCanvas from "../components/canvas/SystemCanvas";
import type { CanvasFocus } from "../components/canvas/SystemCanvas";
import { DEFAULT_COLLAPSED_BANDS, DEFAULT_EDGE_KINDS } from "../components/canvas/canvasLayout";
import type { CanvasBandId, EdgeKindFilter } from "../components/canvas/canvasLayout";
import type { AssetRollup, SystemRollup } from "../engine";
import type { AssetId, DataTypeId, SystemId } from "../graph/ids";
import { useLiveEngine } from "../engine/useLiveEngine";

type RolesFor = (assetId: AssetId) => string[] | null;
interface DisplayBand { label: string; color: string }

// Worst first — an asset's problems belong at the top of its own list.
const INSTANCE_ORDER = ["not-implemented", "partial", "undetermined", "implemented", "not-applicable"];

function colorFor(key: string): { color: string; bg: string } {
  if (key === "green") return { color: C.green, bg: C.greenBg };
  if (key === "amber") return { color: C.amber, bg: C.amberBg };
  if (key === "red") return { color: C.red, bg: C.redBg };
  if (key === "accent") return { color: C.accent, bg: C.accentBg };
  return { color: C.muted, bg: C.panel2 };
}

function AssuranceChip({ label, value, band }: { label: string; value: ReactNode; band: DisplayBand }) {
  const { color, bg } = colorFor(band.color);
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: C.panel2 }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{value}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color, background: bg }}>{band.label}</span>
      </div>
    </div>
  );
}

// AssuranceCategoryBar and PROFILE_STATUS_META are gone with the per-asset
// category rollups and per-asset profile evaluation they drew. Categories are
// still scored and still evaluated against the tier profile — once per system,
// in the engine (evaluateSystemAgainstProfile).
function AssuranceRiskCard({ title, risk }: { title: string; risk: AssetRollup["inherentRisk"] }) {
  const { color, bg } = colorFor(risk.band.color);
  return (
    <div className="rounded-lg p-2.5 flex-1" style={{ background: C.panel2 }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{title}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{risk.score}<span className="text-[10px] font-normal" style={{ color: C.muted }}> /25</span></div>
      <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1" style={{ color, background: bg }}>{risk.band.label}</span>
    </div>
  );
}

// Per-kind chips rather than one lines on/off switch. The kinds answer
// different questions and differ by an order of magnitude in count, so a single
// toggle would force you to accept the control plane's fan-out just to see the
// request path.
const EDGE_CHIPS: { key: keyof EdgeKindFilter; label: string; hint: string }[] = [
  { key: "data", label: "Data", hint: "The request path: what moves through the boundary." },
  { key: "actors", label: "Actors", hint: "Who calls in, and what the boundary calls out to." },
  {
    key: "controlPlane",
    label: "Control",
    hint: "Protection relationships. Dense by nature — a few protectors each cover most of the boundary — so these draw faintly until you select an asset, then only that asset's. The Diagram view shows them in full as a matrix, which has no lines to cross.",
  },
  { key: "deploy", label: "Deploy", hint: "What pushes code and configuration into the boundary." },
  { key: "backupRestore", label: "Backup", hint: "Protection copies out, controlled restores back." },
  { key: "vendors", label: "Vendors", hint: "Assets whose provider is a registered third party." },
];

function EdgeKindChips({
  value, counts, onChange,
}: {
  value: EdgeKindFilter;
  counts: Record<keyof EdgeKindFilter, number>;
  onChange: (next: EdgeKindFilter) => void;
}) {
  // Six chips do not fit a phone, and this is a segmented control rather
  // than a wrapping list, so below `lg` it scrolls inside itself instead of
  // pushing the page wider.
  return (
    <div className="flex items-center rounded-lg p-0.5 gap-0.5 max-w-full max-lg:overflow-x-auto" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      {EDGE_CHIPS.map(({ key, label, hint }) => {
        const on = value[key];
        const count = counts[key];
        return (
          <button
            key={key}
            onClick={() => onChange({ ...value, [key]: !on })}
            className="px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap"
            style={{ background: on ? C.accentBg : "transparent", color: on ? C.accent : C.muted }}
            title={hint}
            aria-pressed={on}
          >
            {label}{count > 0 && <span className="opacity-60"> {count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children, hint, icon: Icon }: { children: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      {Icon && <Icon size={12} color={C.accent} />}
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

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// The weakest CONTROL in the boundary, not the weakest asset.
//
// This banner used to name whichever asset scored lowest. That was always a
// vaguer statement than it looked — an asset is a container, and "the vector
// database is weakest" does not tell anybody what to go and fix. Naming the
// requirement that is failing does, and the instances beneath it name the
// asset anyway.
function WeakestLinkBanner({ system }: { system: SystemRollup }) {
  const weak = system.weakestControl;
  if (!weak) return null;
  const strong = (weak.score ?? 0) >= ASSURANCE_TARGET;

  const failingHere = weak.instances.filter((i) => i.status === "not-implemented" || i.status === "partial");
  const worstLevel = PRISMA_LEVELS
    .map((level) => ({ level, rating: weak.levels[level].rating }))
    .reduce((w, l) => (l.rating < w.rating ? l : w));

  const reason = failingHere.length > 0
    ? `${joinAnd([...new Set(failingHere.map((f) => f.asset.name))])} ${failingHere.length > 1 ? "are" : "is"} not holding it.`
    : `Weakest at ${worstLevel.level}: ${weak.levels[worstLevel.level].rationale}`;

  return (
    <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: strong ? C.panel2 : C.redBg, border: `1px solid ${strong ? C.border : C.red + "4D"}` }}>
      <AlertTriangle size={16} color={strong ? C.muted : C.red} className="shrink-0" />
      <div className="text-sm" style={{ color: C.ink }}>
        {strong ? (
          <>Every assessed control in this boundary scores <span style={{ fontWeight: 600 }}>{ASSURANCE_TARGET} or better</span> — no weak link to flag right now.</>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>Weakest control: {weak.controlId} — {weak.control.name}</span>{" "}
            <span style={{ color: C.muted }}>({weak.score})</span> · {reason}
          </>
        )}
      </div>
    </div>
  );
}

function SystemDetailPanel({ assetId, onClose }: { assetId: AssetId; onClose: () => void }) {
  const asset = getAsset(assetId);
  if (!asset) return null;
  const { color } = colorFor(asset.impactLevelBand.color);
  const held = dataForAsset(assetId);

  return (
    // Same list-then-detail move as the Asset Register's rail: below `lg` this
    // is the pane rather than a column beside one.
    <div
      className="shrink-0 flex flex-col w-full lg:w-[320px] overflow-y-auto lg:sticky lg:top-0 lg:max-h-[100vh] lg:border-l"
      style={{ borderColor: C.border, background: C.panel }}
    >
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{asset.code}</span>
          <div className="text-base font-semibold mt-2 leading-tight" style={{ color: C.ink }}>{asset.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {asset.type}
            <br />{asset.systems.length === 1 ? `${asset.systems[0].name} · ${asset.systems[0].id}` : asset.systems.map((s) => s.name).join(", ")} · {asset.classification}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: C.muted, background: C.panel2 }} title="Close">
          <X size={16} />
        </button>
      </div>

      {/* FIPS 199 impact level is the headline an asset can honestly carry. It
          has no assurance score: the controls that apply to it are assessed once
          against its system, and this asset is one of the samples behind that. */}
      <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-3xl font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{IMPACT_LEVEL_SHORT[asset.impactLevel]}</div>
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{IMPACT_LEVEL_LABELS[asset.impactLevel]} Impact</div>
          <div className="text-[11px]" style={{ color: C.muted }}>
            {asset.implementedCount} of {asset.applicableControlCount} applicable controls verified here
          </div>
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
        <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: C.muted }}>Consequence and coverage</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <AssuranceChip label="Impact Level" value={IMPACT_LEVEL_LABELS[asset.impactLevel]} band={asset.impactLevelBand} />
          <AssuranceChip
            label="Controls Verified"
            value={`${asset.implementedCount}/${asset.applicableControlCount}`}
            band={asset.applicableControlCount > 0 && asset.implementedCount / asset.applicableControlCount >= 0.9
              ? { label: "Verified", color: "green" }
              : asset.applicableControlCount > 0 && asset.implementedCount / asset.applicableControlCount >= 0.6
                ? { label: "Mostly", color: "amber" }
                : { label: "Sparse", color: "red" }}
          />
          <AssuranceChip
            label="Evidence Coverage"
            value={`${asset.evidenceCoveragePct}%`}
            band={asset.evidenceCoveragePct >= 90 ? { label: "Strong", color: "green" } : asset.evidenceCoveragePct >= 60 ? { label: "Partial", color: "amber" } : { label: "Sparse", color: "red" }}
          />
          <AssuranceChip label="No evidence yet" value={asset.undeterminedCount} band={asset.undeterminedCount === 0 ? { label: "None", color: "green" } : { label: "Gap", color: "amber" }} />
        </div>
        <div className="flex gap-2">
          <AssuranceRiskCard title="Inherent Risk" risk={asset.inherentRisk} />
        </div>
        <div className="text-[11px] mt-3 leading-relaxed" style={{ color: C.muted }}>
          Impact is intrinsic to this asset. Residual risk is answered on the Risk Register from
          the controls mapped to each scenario, rather than from a score for this box.
        </div>
      </div>

      {/* The drill-down. Every control that applies here and what it showed —
          the same instances the system-level assessment sampled. */}
      <div className="px-5 py-4">
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Controls sampled here</div>
        <div className="space-y-1.5">
          {[...asset.controls]
            .sort((a, b) => INSTANCE_ORDER.indexOf(a.status) - INSTANCE_ORDER.indexOf(b.status))
            .map((i) => {
              const meta = INSTANCE_STATUS_META[i.status];
              const muted = meta.color === "muted";
              return (
                <div key={i.controlId} className="rounded-lg px-2.5 py-2" style={{ background: C.panel2 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: C.ink }}>{i.controlId}</span>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ color: muted ? C.muted : colorFor(meta.color).color, background: muted ? "transparent" : colorFor(meta.color).bg }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{i.statement}</div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

interface DataMapProps {
  systemId?: SystemId | null;
  onSelectSystem?: (systemId: SystemId) => void;
  embedded?: boolean;
  /** Embedded only: the tab's supporting sentence. Owned by the tab that hosts
      this page (Architecture), rendered here so the data-type filter can sit on
      the same row rather than opening a toolbar of its own. */
  description?: string;
}

export default function DataMap({ systemId: controlledSystemId, onSelectSystem, embedded = false, description }: DataMapProps) {
  const liveEngine = useLiveEngine();
  const SYSTEMS = liveEngine.rollups.systemRollups;
  const ALL_ASSETS = SYSTEMS.flatMap((system) => system.assets);
  const defaultSystem = SYSTEMS[0];
  if (!defaultSystem) throw new Error("Data Map requires at least one system.");
  const [localSystemId, setLocalSystemId] = useState<SystemId>(defaultSystem.id);
  const systemId = controlledSystemId ?? localSystemId;
  const [selectedKey, setSelectedKey] = useState<AssetId | null>(null);
  const [dataTypeId, setDataTypeId] = useState<"all" | DataTypeId>("all");
  const [viewMode, setViewMode] = useState<"canvas" | "diagram">("canvas");
  const [exporting, setExporting] = useState(false);
  const dataSvgRef = useRef<SVGSVGElement | null>(null);
  const controlSvgRef = useRef<SVGSVGElement | null>(null);

  // Canvas state lives here rather than inside SystemCanvas so it survives the
  // remount when the view is expanded, and so the toolbar owns the controls.
  const [edgeKinds, setEdgeKinds] = useState<EdgeKindFilter>(DEFAULT_EDGE_KINDS);
  // Lives here for the same reason edgeKinds does: the embedded and expanded
  // canvases are two React Flow instances, so a band opened in one has to stay
  // open when the reader moves to the other.
  const [collapsedBands, setCollapsedBands] = useState<ReadonlySet<CanvasBandId>>(DEFAULT_COLLAPSED_BANDS);
  const [expanded, setExpanded] = useState(false);
  const [edgeStats, setEdgeStats] = useState<{ counts: Record<keyof EdgeKindFilter, number>; visible: number }>(
    { counts: { data: 0, actors: 0, vendors: 0, controlPlane: 0, deploy: 0, backupRestore: 0 }, visible: 0 }
  );
  // A ref, not state: onEnd fires on every pan and zoom settle, and putting
  // that in state would rebuild the whole node array on each one.
  const focusRef = useRef<CanvasFocus | null>(null);

  const system = SYSTEMS.find((s) => s.id === systemId);
  const systemDataTypes = useMemo(() => liveEngine.classification.dataTypesForSystem(systemId), [liveEngine, systemId]);
  const fullLayout = useMemo(() => liveEngine.rollups.flowLayoutForSystem(systemId), [liveEngine, systemId]);
  const vendorPosture = useMemo(() => liveEngine.vendors.vendorsForSystem(systemId), [liveEngine, systemId]);

  // Filtering to one data type is a real query over the edges, not a second
  // dataset: keep the assets that touch it and the flows that carry it. The
  // previous model had nothing to filter on, which is why its per-data-type
  // view collapsed into a single combined chart.
  const layout = useMemo(() => {
    if (dataTypeId === "all") return fullLayout;
    const carries = (id: AssetId) => dataForAsset(id).some((h) => h.dataTypeId === dataTypeId);
    return {
      ...fullLayout,
      stages: fullLayout.stages
        .map((s) => ({ ...s, nodes: s.nodes.filter((n) => carries(n.id)) }))
        .filter((s) => s.nodes.length > 0),
      branches: fullLayout.branches.filter((b) => carries(b.asset.id) || b.protects.some((p) => carries(p.id))),
      dataPlane: fullLayout.dataPlane.filter((d) => carries(d.asset.id) || d.fedBy.some((p) => carries(p.id))),
      egress: fullLayout.egress.filter((d) => carries(d.asset.id) || d.fedBy.some((p) => carries(p.id))),
      backupRecovery: fullLayout.backupRecovery.filter(
        (entry) => carries(entry.asset.id) || entry.backedUpFrom.some((source) => carries(source.id)) || entry.restoresTo.some((target) => carries(target.id))
      ),
      edges: fullLayout.edges.filter((e) => e.dataTypeIds.includes(dataTypeId)),
    };
  }, [fullLayout, dataTypeId]);

  const rolesFor = useMemo<RolesFor>(() => (assetId) => {
    if (dataTypeId === "all") return null;
    return dataForAsset(assetId).filter((h) => h.dataTypeId === dataTypeId).map((h) => h.role);
  }, [dataTypeId]);

  // The true diagrams: real point-to-point edges instead of stage buckets,
  // split into a data-movement page and a control-plane page (see
  // utils/flowDiagramLayout.js) so the control layer's fan-out doesn't bury
  // the request path. Built from the same (possibly data-type-filtered)
  // layout the card view uses, so switching views never changes what's
  // actually being shown.
  const toggleBand = useCallback((bandId: CanvasBandId) => {
    setCollapsedBands((prev) => {
      const next = new Set(prev);
      if (!next.delete(bandId)) next.add(bandId);
      return next;
    });
  }, []);

  const dataFlowDiagram = useMemo(() => buildDataFlowDiagram(layout), [layout]);
  const controlPlaneMatrix = useMemo(() => buildControlPlaneMatrix(layout, getAsset), [layout]);

  // Stable identity, and it bails when nothing moved: the canvas reports counts
  // from an effect, so an unstable setter here would loop.
  const handleCounts = useCallback((counts: Record<keyof EdgeKindFilter, number>, visible: number) => {
    setEdgeStats((prev) =>
      prev.visible === visible && (Object.keys(counts) as (keyof EdgeKindFilter)[]).every((k) => prev.counts[k] === counts[k])
        ? prev
        : { counts, visible }
    );
  }, []);

  function selectSystem(id: SystemId) {
    if (onSelectSystem) onSelectSystem(id);
    else setLocalSystemId(id);
    setSelectedKey(null);
    setDataTypeId("all");
    focusRef.current = null;
  }

  async function handleExportPdf() {
    if (!dataSvgRef.current || !system) return;
    setExporting(true);
    try {
      const dataTypeLabel = dataTypeId !== "all" ? getAllDataTypes().find((d) => d.id === dataTypeId)?.name : undefined;
      await exportFlowDiagramPdf({
        dataSvgEl: dataSvgRef.current,
        dataDiagram: dataFlowDiagram,
        controlSvgEl: controlPlaneMatrix ? controlSvgRef.current : null,
        controlDiagram: controlPlaneMatrix,
        system,
        dataTypeLabel,
        layout,
        getAssetLabel: (assetId) => {
          const a = ALL_ASSETS.find((candidate) => candidate.id === assetId);
          return a ? `${a.code} — ${a.name}` : assetId;
        },
      });
    } finally {
      setExporting(false);
    }
  }

  // Which data type the whole page is filtered to. Rides on the header row —
  // the page title's row when standalone, the tab's sentence when embedded —
  // because it scopes everything below it, view mode included.
  const dataTypeFilter = system ? (
    <div className="flex items-center gap-1.5 shrink-0">
      <select
        value={dataTypeId}
        onChange={(e) => setDataTypeId(systemDataTypes.find((dataType) => dataType.id === e.target.value)?.id ?? "all")}
        className="text-xs pl-3 pr-7 py-2 rounded-lg font-medium"
        style={{ background: C.panel, color: C.ink, border: `1px solid ${C.border}` }}
      >
        <option value="all">All data</option>
        {systemDataTypes.map((dt) => (
          <option key={dt.id} value={dt.id}>{dt.name}</option>
        ))}
      </select>
      {dataTypeId !== "all" && (
        <button
          onClick={() => setDataTypeId("all")}
          className="flex items-center justify-center p-2 rounded-lg shrink-0"
          style={{ background: C.panel, color: C.muted, border: `1px solid ${C.border}` }}
          title="Reset to all data"
        >
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="w-full flex flex-col lg:flex-row" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className={`flex-1 min-w-0 ${selectedKey ? "max-lg:hidden" : ""}`}>
        {embedded ? (
          description && (
            <div className="px-4 lg:px-8">
              <SectionHeader description={description} aside={dataTypeFilter} />
            </div>
          )
        ) : (
          <PageHeader
            icon={Network}
            title={
              system ? (
                <span className="inline-flex items-center gap-3">
                  {system.name}
                  {system.classification && <ClassificationTag level={system.classification} />}
                  <AssuranceBadge pct={system.overallAssurance} />
                </span>
              ) : "Systems Data Flow"
            }
            description="How the system is built, connected, protected, and exposed across its assets and trust boundaries."
            right={
              <div className="flex items-center gap-2">
                {dataTypeFilter}
                <SystemPicker systems={SYSTEMS} systemId={systemId} onSelect={selectSystem} />
              </div>
            }
          />
        )}

        <div className="px-4 lg:px-8 pb-4">
          {system ? (
            <>
              {viewMode === "canvas" ? (
                <SystemCanvas
                  layout={layout}
                  systemProvider={system.provider}
                  vendors={vendorPosture.vendors}
                  edgeKinds={edgeKinds}
                  collapsedBands={collapsedBands}
                  onToggleBand={toggleBand}
                  selectedKey={selectedKey}
                  onSelectNode={setSelectedKey}
                  rolesFor={rolesFor}
                  mode="embedded"
                  initialFocus={focusRef.current}
                  onFocusChange={(f) => { focusRef.current = f; }}
                  onCounts={handleCounts}
                />
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
                    <FlowDiagramLegend kinds={[
                      "data", "actor-in", "actor-out",
                      ...(layout.internalActors?.length ? ["actor-internal" as const] : []),
                      ...(layout.backupRecovery?.length ? ["backup" as const, "restore" as const] : []),
                    ]} />
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

              {/* Everything that acts on the drawing sits under the drawing. The
                  toolbar this replaced ran a fourth bar of chrome between the
                  workspace tabs and the picture; the header row above now
                  carries only the data-type filter, which scopes the whole
                  page rather than the view. */}
              <div className="flex items-end justify-between gap-3 mt-3 flex-wrap">
                {viewMode === "canvas" ? (
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
                      Lines
                    </span>
                    <EdgeKindChips value={edgeKinds} counts={edgeStats.counts} onChange={setEdgeKinds} />
                  </div>
                ) : <div />}

                <div className="flex items-center gap-2 shrink-0">
                  {viewMode === "canvas" && (
                    <button
                      onClick={() => setExpanded(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ background: C.panel, color: C.muted, border: `1px solid ${C.border}` }}
                      title="Fill the window with the canvas"
                    >
                      <Maximize2 size={12} /> Expand
                    </button>
                  )}
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
                  <div className="flex items-center rounded-lg p-0.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => setViewMode("canvas")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                      style={{ background: viewMode === "canvas" ? C.panel : "transparent", color: viewMode === "canvas" ? C.ink : C.muted }}
                      title="The whole boundary on one pannable surface. Click an asset to focus it."
                    >
                      <Waypoints size={12} /> Canvas
                    </button>
                    <button
                      onClick={() => setViewMode("diagram")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                      style={{ background: viewMode === "diagram" ? C.panel : "transparent", color: viewMode === "diagram" ? C.ink : C.muted }}
                      title="Print-shaped diagram, plus the control plane as a matrix. Exports to PDF."
                    >
                      <Workflow size={12} /> Diagram
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-[11px] mt-3" style={{ color: C.muted }}>
                {layout.edges.length} data flow{layout.edges.length === 1 ? "" : "s"} shown
                {dataTypeId !== "all" && ` carrying ${getAllDataTypes().find((d) => d.id === dataTypeId)?.name}`}
                {layout.controlPlaneEdges.length > 0 && ` · ${layout.controlPlaneEdges.length} control-plane relationships`}
                {viewMode === "canvas" && (
                  <>
                    {" · "}Scroll to move the page; use the canvas controls or Expand to zoom
                    {edgeStats.visible > 40 && (
                      <span style={{ color: C.amber }}>
                        {" · "}{edgeStats.visible} lines drawn — denser than it is informative. Select an asset to focus it.
                      </span>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl p-10 text-center text-sm" style={{ background: C.panel2, border: `1px dashed ${C.border}`, color: C.muted }}>
              Search for a system above to see how data moves through it.
            </div>
          )}
        </div>

        {system && (
          <div className="px-4 lg:px-8 pb-6">
            <WeakestLinkBanner system={system} />
          </div>
        )}
      </div>

      {selectedKey && <SystemDetailPanel assetId={selectedKey} onClose={() => setSelectedKey(null)} />}

      {/* Expanded. The canvas cannot survive the move as one instance — React
          treats a change of container as a remount — so ViewportBridge hands
          the flow-space centre and zoom across instead. The detail rail comes
          too, or drilling into an asset would mean collapsing first. */}
      {system && (
        <Modal
          open={expanded}
          onClose={() => setExpanded(false)}
          variant="fullscreen"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 min-w-0">
              <Network size={15} color={C.accent} className="shrink-0" />
              <span className="text-sm font-semibold truncate" style={{ color: C.ink }}>{system.name}</span>
              <span className="text-[11px] shrink-0" style={{ color: C.muted }}>Architecture</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <EdgeKindChips value={edgeKinds} counts={edgeStats.counts} onChange={setEdgeKinds} />
              <ModalCloseButton onClose={() => setExpanded(false)} />
            </div>
          </div>
          <div className="flex flex-col lg:flex-row flex-1 min-h-0">
            <div className="flex-1 min-w-0 min-h-0 p-3">
              <SystemCanvas
                layout={layout}
                systemProvider={system.provider}
                vendors={vendorPosture.vendors}
                edgeKinds={edgeKinds}
                collapsedBands={collapsedBands}
                onToggleBand={toggleBand}
                selectedKey={selectedKey}
                onSelectNode={setSelectedKey}
                rolesFor={rolesFor}
                mode="expanded"
                initialFocus={focusRef.current}
                onFocusChange={(f) => { focusRef.current = f; }}
                onCounts={handleCounts}
              />
            </div>
            {selectedKey && (
              <div className="shrink-0 overflow-y-auto" style={{ borderLeft: `1px solid ${C.border}` }}>
                <SystemDetailPanel assetId={selectedKey} onClose={() => setSelectedKey(null)} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
