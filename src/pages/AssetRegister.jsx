import React, { useState } from "react";
import { X, Boxes } from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { ClassificationTag } from "../components/SystemBadges";
import { getAllAssets, INSTANCE_STATUS_META } from "../engine";

const ASSETS = getAllAssets();

function colorFor(key) {
  return { color: C[key], bg: C[`${key}Bg`] };
}

function MetricChip({ label, value, band }) {
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

function AssetCard({ asset, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(asset.id)}
      className="w-full text-left rounded-xl p-4 transition-colors"
      style={{ background: C.panel, border: `1px solid ${selected ? C.accent : C.border}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{asset.type} · {asset.provider}</div>
        </div>
        <ClassificationTag level={asset.classification} />
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

function StatCell({ value, band }) {
  const { color } = colorFor(band.color);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs font-semibold tabular-nums" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
      <span className="text-[10px]" style={{ color }}>{band.label}</span>
    </div>
  );
}

function AssetRow({ asset, onSelect, selected, striped }) {
  return (
    <button
      onClick={() => onSelect(asset.id)}
      className="w-full grid items-center gap-3 pl-3.5 pr-4 py-2 text-left transition-colors"
      style={{
        gridTemplateColumns: ASSET_COLUMNS,
        borderBottom: `1px solid ${C.border}`,
        borderLeft: `2px solid ${selected ? C.accent : "transparent"}`,
        background: selected ? C.accentBg : striped ? C.panel2 : "transparent",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = C.panel2; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = striped ? C.panel2 : "transparent"; }}
    >
      <span className="text-[11px] truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.id}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.name}</span>
          <ClassificationTag level={asset.classification} />
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{asset.type} · {asset.provider}</div>
      </div>
      <StatCell value={asset.criticality} band={asset.criticalityBand} />
      <StatCell value={`${asset.implementedCount}/${asset.applicableControlCount}`} band={verificationBand(asset)} />
      <StatCell value={asset.inherentRisk.score} band={asset.inherentRisk.band} />
    </button>
  );
}

function AssetTable({ assets, selectedId, onSelect }) {
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
          {assets.map((asset, i) => (
            <AssetRow key={asset.id} asset={asset} selected={asset.id === selectedId} onSelect={onSelect} striped={i % 2 === 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// A verification ratio is a coverage figure, not a score, so it gets a band
// only to colour it — deliberately not assuranceBand, whose thresholds mean
// something about posture rather than about how much was looked at.
function verificationBand(asset) {
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
function InstanceRow({ inst }) {
  const meta = INSTANCE_STATUS_META[inst.status];
  const { color, bg } = colorFor(meta.color === "muted" ? "na" : meta.color);
  const strongest = inst.evidence.reduce((best, e) => (best === null || e.confidence > best.confidence ? e : best), null);
  const prevalent = inst.governing && inst.governing.exceptionRate != null ? inst.governing : null;
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
      <div className="flex items-center gap-2">
        <span className="text-xs min-w-0 flex-1 truncate" style={{ color: C.ink }}>{inst.control?.name ?? inst.controlId}</span>
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

function FactorRow({ label, factor }) {
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

function RiskCard({ title, risk }) {
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

function AssetDetailPanel({ asset, onClose }) {
  const factorLabels = {
    confidentiality: "Confidentiality",
    integrity: "Integrity",
    availability: "Availability",
    regulatory: "Regulatory Sensitivity",
    businessDependency: "Business Dependency",
  };

  return (
    <div className="shrink-0 flex flex-col" style={{ width: 360, borderLeft: `1px solid ${C.border}`, background: C.panel, position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto" }}>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.name}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>{asset.type} · {asset.provider}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{asset.system.name} ({asset.system.id})</div>
          <div className="mt-2"><ClassificationTag level={asset.classification} /></div>
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
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>
          Controls sampled here — {asset.implementedCount} verified, {asset.partialCount} partial,
          {" "}{asset.notImplementedCount} not implemented, {asset.undeterminedCount} uncollected
        </div>
        <div className="text-[11px] mb-3 leading-relaxed" style={{ color: C.muted }}>
          Every control that applies to this asset, and what it showed here. These are the same
          instances the system-level assessment sampled to rate its Implemented level, reached from
          the other end — so this view and the control&apos;s own view cannot disagree.
        </div>
        <div className="space-y-1.5">
          {[...asset.controls]
            .sort((a, b) => INSTANCE_ORDER.indexOf(a.status) - INSTANCE_ORDER.indexOf(b.status))
            .map((inst) => (
              <InstanceRow key={inst.controlId} inst={inst} />
            ))}
        </div>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Asset Criticality Factors</div>
        <div className="divide-y" style={{ borderColor: C.border }}>
          {Object.keys(asset.criticalityFactors).map((k) => (
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

export default function AssetRegister({ systemId }) {
  const assets = systemId ? ASSETS.filter((a) => a.system.id === systemId) : ASSETS;
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? null);
  const selected = assets.find((a) => a.id === selectedId) || null;

  const groups = [];
  assets.forEach((asset) => {
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

        <div className="px-8 py-6 space-y-8">
          {systemId ? (
            <AssetTable assets={assets} selectedId={selectedId} onSelect={setSelectedId} />
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
