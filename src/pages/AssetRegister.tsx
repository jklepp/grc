import React, { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { X, Boxes, Search, Rows3, Waypoints } from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { ClassificationTag } from "../components/SystemBadges";
import { getAllAssets, getControl, getDataFlows, INSTANCE_STATUS_META } from "../engine";
import type { AssetRollup } from "../engine/rollups";
import type { AssetId, SystemId } from "../graph/ids";
import { useLiveEngine } from "../engine/useLiveEngine";

interface DisplayBand {
  label: string;
  color: string;
}

const ARCHITECTURE_LANES = [
  { id: "web-ingress", label: "Web Ingress" },
  { id: "web-egress", label: "Web Egress" },
  { id: "workforce-access", label: "Workforce Access" },
  { id: "processing-path", label: "Processing Path" },
  { id: "data-plane", label: "Data Plane" },
  { id: "control-plane", label: "Control Plane" },
  { id: "software-deployment", label: "Software Deployment" },
  { id: "unmapped", label: "Other / Unmapped" },
] as const;

type ArchitectureLaneId = (typeof ARCHITECTURE_LANES)[number]["id"];

interface AssetLaneGroup {
  id: ArchitectureLaneId;
  label: string;
  assets: AssetRollup[];
}

function colorFor(key: string): { color: string; bg: string } {
  const colors: Record<string, { color: string; bg: string }> = {
    green: { color: C.green, bg: C.greenBg },
    amber: { color: C.amber, bg: C.amberBg },
    red: { color: C.red, bg: C.redBg },
    accent: { color: C.accent, bg: C.accentBg },
    muted: { color: C.muted, bg: "transparent" },
    na: { color: C.muted, bg: "transparent" },
  };
  return colors[key] ?? colors.na;
}

function MetricChip({ label, value, band }: { label: string; value: ReactNode; band: DisplayBand }) {
  const { color, bg } = colorFor(band.color);
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-lg font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color, background: bg }}>{band.label}</span>
      </div>
    </div>
  );
}

interface AssetSelectProps {
  asset: AssetRollup;
  selected: boolean;
  onSelect: (id: AssetId) => void;
}

function AssetCard({ asset, selected, onSelect }: AssetSelectProps) {
  return (
    <button
      onClick={() => onSelect(asset.id)}
      className="w-full text-left rounded-xl p-4 transition-colors"
      style={{ background: C.panel, border: `1px solid ${selected ? C.accent : C.border}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{asset.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{asset.type} · {asset.provider}</div>
        </div>
        {asset.classification && <ClassificationTag level={asset.classification} />}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <MetricChip label="Criticality" value={asset.criticality} band={asset.criticalityBand} />
        {/* Not a score. How many of the controls that apply here were actually
            verified on this asset — the sampling result, not a judgment about
            the asset itself. */}
        <MetricChip
          label="Verified"
          value={`${asset.implementedCount}/${asset.applicableControlCount}`}
          band={verificationBand(asset)}
        />
        <MetricChip label="Inherent Risk" value={asset.inherentRisk.score} band={asset.inherentRisk.band} />
      </div>
    </button>
  );
}

// Same row-table treatment as the Select a System list — an asset register
// reads the same way a system register does, and it's the pattern this asset
// list is asked to match. Kept as its own component rather than reusing
// SelectSystem's SystemRow: the columns and click target (opens the slideout
// here, navigates there) are different enough that sharing would mean a prop
// escape hatch on both sides for no real reuse.
const ASSET_COLUMNS = "110px 2.2fr 110px 130px 130px";

function StatCell({ value, band }: { value: ReactNode; band: DisplayBand }) {
  const { color } = colorFor(band.color);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs font-semibold tabular-nums" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
      <span className="text-[10px]" style={{ color }}>{band.label}</span>
    </div>
  );
}

function AssetRow({ asset, onSelect, selected }: AssetSelectProps) {
  return (
    <button
      onClick={() => onSelect(asset.id)}
      className="w-full grid items-center gap-3 pl-3.5 pr-4 py-2 text-left transition-colors"
      style={{
        gridTemplateColumns: ASSET_COLUMNS,
        borderBottom: `1px solid ${C.border}`,
        borderLeft: `2px solid ${selected ? C.accent : "transparent"}`,
        background: selected ? C.accentBg : "transparent",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = C.panel2; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <span className="text-[11px] truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.id}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs truncate" style={{ color: C.ink }}>{asset.name}</span>
          {asset.classification && <ClassificationTag level={asset.classification} />}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{asset.type} · {asset.provider}</div>
      </div>
      <StatCell value={asset.criticality} band={asset.criticalityBand} />
      <StatCell value={`${asset.implementedCount}/${asset.applicableControlCount}`} band={verificationBand(asset)} />
      <StatCell value={asset.inherentRisk.score} band={asset.inherentRisk.band} />
    </button>
  );
}

function AssetTable({ assets, groups, selectedId, onSelect }: { assets: AssetRollup[]; groups?: AssetLaneGroup[]; selectedId: AssetId | null; onSelect: (id: AssetId) => void }) {
  const rowGroups = groups ?? [{ id: "unmapped" as const, label: "", assets }];
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
      <div
        className="grid gap-3 pl-3.5 pr-4 py-2 text-[10px] font-semibold uppercase tracking-wide"
        style={{ gridTemplateColumns: ASSET_COLUMNS, background: C.panel2, color: C.muted, borderBottom: `1px solid ${C.border}` }}
      >
        <div>ID</div>
        <div>Asset</div>
        <div>Criticality</div>
        <div>Verified</div>
        <div>Inherent Risk</div>
      </div>
      {assets.length === 0 ? (
        <div className="px-4 py-6 text-sm text-center" style={{ color: C.muted, background: C.panel }}>
          No assets registered for this system.
        </div>
      ) : (
        <div style={{ background: C.panel }}>
          {rowGroups.map((group) => (
            <React.Fragment key={group.id}>
              {group.label && (
                <div className="flex items-center justify-between px-3.5 py-2" style={{ background: C.amberBg, borderBottom: `1px solid ${C.border}`, borderTop: `1px solid ${C.border}` }}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.amber }}>{group.label}</span>
                  <span className="text-[10px] font-medium" style={{ color: C.amber }}>{group.assets.length} asset{group.assets.length === 1 ? "" : "s"}</span>
                </div>
              )}
              {group.assets.map((asset) => (
                <AssetRow key={asset.id} asset={asset} selected={asset.id === selectedId} onSelect={onSelect} />
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// A verification ratio is a coverage figure, not a score, so it gets a band
// only to colour it — deliberately not assuranceBand, whose thresholds mean
// something about posture rather than about how much was looked at.
function verificationBand(asset: AssetRollup): DisplayBand {
  if (asset.applicableControlCount === 0) return { label: "None applicable", color: "muted" };
  const pct = (asset.implementedCount / asset.applicableControlCount) * 100;
  if (pct >= 90) return { label: "Verified", color: "green" };
  if (pct >= 60) return { label: "Mostly", color: "amber" };
  return { label: "Sparse", color: "red" };
}

// CategoryBar is gone with the per-asset category rollups it drew. Categories
// are still scored, once per system, and the bars for them live on the pages
// that show a system.
//
// Worst first — an asset's problems should be at the top of its own list.
const INSTANCE_ORDER = ["not-implemented", "partial", "undetermined", "implemented", "not-applicable"];

// One control, as seen from this asset. Carries a status and a sentence, never
// a score: the score for this control exists once, at the system boundary.
type AssetControlInstance = AssetRollup["controls"][number];

function InstanceRow({ inst }: { inst: AssetControlInstance }) {
  const meta = INSTANCE_STATUS_META[inst.status];
  const { color, bg } = colorFor(meta.color === "muted" ? "na" : meta.color);
  const strongest = inst.evidence.length > 0
    ? inst.evidence.reduce((best, evidence) => evidence.confidence > best.confidence ? evidence : best)
    : null;
  const prevalent = inst.governing?.exceptionRate != null
    ? { ...inst.governing, exceptionRate: inst.governing.exceptionRate }
    : null;
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
      <div className="flex items-center gap-2">
        <span className="text-xs min-w-0 flex-1 truncate" style={{ color: C.ink }}>{getControl(inst.controlId)?.name ?? inst.controlId}</span>
        <span className="text-[10px] shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{inst.controlId}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: meta.color === "muted" ? C.muted : color, background: meta.color === "muted" ? "transparent" : bg }}>
          {meta.label}
        </span>
      </div>
      <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{inst.statement}</div>
      {strongest && (
        <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>
          {strongest.source} · {strongest.coveragePct}% coverage · {strongest.ageDays}d ago{strongest.stale ? " (stale)" : ""}
          {inst.evidence.length > 1 && ` · +${inst.evidence.length - 1} more`}
        </div>
      )}
      {/* Prevalence, not just the pass/fail label. "1 of 10,000" and "9,000 of
          10,000" are both failures and are not the same condition. */}
      {prevalent && (
        <div className="text-[11px] mt-1" style={{ color: prevalent.exceptionRate >= 0.5 ? C.red : prevalent.exceptionRate >= 0.1 ? C.amber : C.muted }}>
          {prevalent.exceptions} of {prevalent.population} {prevalent.populationUnit ?? "items"} in breach
          {" "}({(prevalent.exceptionRate * 100).toFixed(prevalent.exceptionRate < 0.01 ? 2 : 1)}%)
          {prevalent.exceptionRate >= 0.5 ? " — systemic" : prevalent.exceptionRate < 0.05 ? " — isolated" : ""}
        </div>
      )}
      {inst.mechanism && <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{inst.mechanism.mechanism}</div>}
    </div>
  );
}

type CriticalityFactor = AssetRollup["criticalityFactors"][keyof AssetRollup["criticalityFactors"]];

function FactorRow({ label, factor }: { label: string; factor: CriticalityFactor }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-xs font-medium" style={{ color: C.ink }}>{label}</div>
        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{factor.reason}</div>
      </div>
      <div className="text-sm font-semibold shrink-0" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{factor.score}</div>
    </div>
  );
}

function RiskCard({ title, risk }: { title: string; risk: AssetRollup["inherentRisk"] }) {
  const { color, bg } = colorFor(risk.band.color);
  return (
    <div className="rounded-lg p-3 flex-1" style={{ background: C.panel2 }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{title}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{risk.score}</span>
        <span className="text-xs" style={{ color: C.muted }}>/ 25</span>
      </div>
      <div className="text-[11px] mt-1" style={{ color: C.muted }}>Likelihood {risk.likelihood} × Impact {risk.impact}</div>
      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2" style={{ color, background: bg }}>{risk.band.label}</span>
    </div>
  );
}

function AssetDetailPanel({ asset, onClose }: { asset: AssetRollup; onClose: () => void }) {
  const [showAllControls, setShowAllControls] = useState(false);
  const factorLabels: Record<keyof AssetRollup["criticalityFactors"], string> = {
    confidentiality: "Confidentiality",
    integrity: "Integrity",
    availability: "Availability",
    regulatory: "Regulatory Sensitivity",
    businessDependency: "Business Dependency",
  };
  const sortedControls = [...asset.controls]
    .sort((a, b) => INSTANCE_ORDER.indexOf(a.status) - INSTANCE_ORDER.indexOf(b.status));
  const visibleControls = showAllControls ? sortedControls : sortedControls.slice(0, 5);

  return (
    <div className="shrink-0 flex flex-col" style={{ width: 360, borderLeft: `1px solid ${C.border}`, background: C.panel, position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto" }}>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{asset.name}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>{asset.type} · {asset.provider}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{asset.system.name} ({asset.system.id})</div>
          <div className="mt-2">{asset.classification && <ClassificationTag level={asset.classification} />}</div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: C.muted, background: C.panel2 }} title="Close">
          <X size={16} />
        </button>
      </div>

      {/* An asset has no assurance score. It is not scored at all — the
          controls that apply to it are scored once against its system, and this
          asset is one of the samples behind that. What it can honestly report
          is consequence (criticality, intrinsic) and what each control actually
          showed here. */}
      <div className="px-5 py-4 grid grid-cols-2 gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
        <MetricChip label="Asset Criticality" value={asset.criticality} band={asset.criticalityBand} />
        <MetricChip
          label="Controls Verified"
          value={`${asset.implementedCount} / ${asset.applicableControlCount}`}
          band={verificationBand(asset)}
        />
        <MetricChip
          label="Evidence Coverage"
          value={`${asset.evidenceCoveragePct}%`}
          band={asset.evidenceCoveragePct >= 90 ? { label: "Strong", color: "green" } : asset.evidenceCoveragePct >= 60 ? { label: "Partial", color: "amber" } : { label: "Sparse", color: "red" }}
        />
        <MetricChip label="Inherent Risk" value={asset.inherentRisk.score} band={asset.inherentRisk.band} />
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>
          Controls on this asset — {asset.implementedCount} verified, {asset.partialCount} partial,
          {" "}{asset.notImplementedCount} not implemented, {asset.undeterminedCount} uncollected
        </div>
        <div className="space-y-1.5 mt-3">
          {visibleControls.map((inst) => <InstanceRow key={inst.controlId} inst={inst} />)}
        </div>
        {sortedControls.length > 5 && (
          <button type="button" onClick={() => setShowAllControls((current) => !current)} className="w-full mt-2 py-2 rounded-lg text-xs font-semibold" style={{ color: C.accent, background: C.accentBg }}>
            {showAllControls ? "Show fewer controls" : `Show all ${sortedControls.length} controls`}
          </button>
        )}
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Asset Criticality Factors</div>
        <div className="divide-y" style={{ borderColor: C.border }}>
          {(Object.keys(asset.criticalityFactors) as Array<keyof AssetRollup["criticalityFactors"]>).map((k) => (
            <FactorRow key={k} label={factorLabels[k]} factor={asset.criticalityFactors[k]} />
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Inherent Risk</div>
        <div className="text-[11px] mb-2" style={{ color: C.muted }}>
          Impact is fixed to this asset&apos;s criticality — what happens if it is compromised, which
          does not move because controls improved. Residual risk is no longer computed per asset:
          it needed an asset score, and it is answered properly on the Risk Register from the
          controls actually mapped to each scenario.
        </div>
        <div className="flex gap-3">
          <RiskCard title="Inherent Risk" risk={asset.inherentRisk} />
        </div>
      </div>
    </div>
  );
}

interface AssetGroup {
  system: AssetRollup["system"];
  assets: AssetRollup[];
}

export default function AssetRegister({ systemId }: { systemId?: SystemId }) {
  useLiveEngine();
  const allAssets = getAllAssets();
  const assets = systemId ? allAssets.filter((a) => a.system.id === systemId) : allAssets;
  const [selectedId, setSelectedId] = useState<AssetId | null>(null);
  const [search, setSearch] = useState("");
  const [assetView, setAssetView] = useState<"lanes" | "flat">(systemId ? "lanes" : "flat");
  const selected = assets.find((a) => a.id === selectedId) || null;
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => [asset.id, asset.name, asset.type, asset.provider]
      .some((value) => value.toLowerCase().includes(query)));
  }, [assets, search]);
  const criticalCount = assets.filter((asset) => asset.criticalityBand.label === "Critical").length;
  const sparseVerificationCount = assets.filter((asset) => verificationBand(asset).label === "Sparse").length;
  const laneByAsset = useMemo(() => {
    const lanes = new Map<AssetId, ArchitectureLaneId>();
    if (!systemId) return lanes;
    const layout = getDataFlows(systemId);
    layout.stages.forEach((stage) => stage.nodes.forEach((asset) => lanes.set(asset.id, stage.depth === 0 ? "web-ingress" : "processing-path")));
    layout.egress.forEach(({ asset }) => lanes.set(asset.id, "web-egress"));
    layout.workforceIngress.forEach(({ asset }) => lanes.set(asset.id, "workforce-access"));
    layout.dataPlane.forEach(({ asset }) => lanes.set(asset.id, "data-plane"));
    layout.branches.forEach(({ asset }) => lanes.set(asset.id, "control-plane"));
    layout.softwareDeployment.forEach(({ asset }) => lanes.set(asset.id, "software-deployment"));
    return lanes;
  }, [systemId]);
  const laneGroups = useMemo<AssetLaneGroup[]>(() => ARCHITECTURE_LANES
    .map((lane) => ({ ...lane, assets: filteredAssets.filter((asset) => (laneByAsset.get(asset.id) ?? "unmapped") === lane.id) }))
    .filter((lane) => lane.assets.length > 0), [filteredAssets, laneByAsset]);

  const groups: AssetGroup[] = [];
  filteredAssets.forEach((asset) => {
    let group = groups.find((g) => g.system.id === asset.system.id);
    if (!group) {
      group = { system: asset.system, assets: [] };
      groups.push(group);
    }
    group.assets.push(asset);
  });

  return (
    <div className="w-full flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-1 min-w-0">
        {!systemId && (
          <PageHeader
            icon={Boxes}
            title="Asset Register"
            description="Individual resources inside each system's boundary. An asset carries no assurance score of its own — the controls that apply to it are assessed once against its system, and each asset is one of the samples behind that. What it reports here is consequence, and what every applicable control actually showed on it."
            right={
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
                {assets.length} assets across {groups.length} systems
              </div>
            }
          />
        )}

        <div className="px-8 py-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}>
              <span><b style={{ color: C.ink }}>{assets.length}</b> assets</span>
              <span><b style={{ color: C.ink }}>{criticalCount}</b> critical</span>
              <span><b style={{ color: C.ink }}>{sparseVerificationCount}</b> sparse verification</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {systemId && (
                <div className="flex items-center rounded-lg p-0.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <button type="button" onClick={() => setAssetView("lanes")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium" style={{ background: assetView === "lanes" ? C.panel : "transparent", color: assetView === "lanes" ? C.ink : C.muted }}>
                    <Waypoints size={12} /> Architecture lanes
                  </button>
                  <button type="button" onClick={() => setAssetView("flat")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium" style={{ background: assetView === "flat" ? C.panel : "transparent", color: assetView === "flat" ? C.ink : C.muted }}>
                    <Rows3 size={12} /> Flat view
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 rounded-lg px-3 py-2 min-w-64" style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.muted }}>
                <Search size={14} />
                <input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setSelectedId(null); }}
                  placeholder="Search assets…"
                  className="w-full bg-transparent outline-none text-xs"
                  style={{ color: C.ink }}
                />
              </label>
            </div>
          </div>
          {systemId ? (
            <AssetTable assets={filteredAssets} groups={assetView === "lanes" ? laneGroups : undefined} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            groups.map((group) => (
              <div key={group.system.id}>
                <SectionHeading
                  icon={Boxes}
                  right={<span className="text-xs" style={{ color: C.muted }}>{group.system.id} · {group.system.env}</span>}
                >
                  {group.system.name}
                </SectionHeading>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {group.assets.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} selected={asset.id === selectedId} onSelect={setSelectedId} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selected && <AssetDetailPanel asset={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
