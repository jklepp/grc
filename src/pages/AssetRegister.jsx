import React, { useState } from "react";
import { X, Boxes } from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { ClassificationTag } from "../components/SystemBadges";
import { ASSET_SUMMARIES } from "../data/assets";
import { ASSURANCE_CATEGORIES } from "../data/assuranceModel";

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
        <MetricChip label="Assurance" value={asset.overallAssurance} band={asset.assuranceBand} />
        <MetricChip label="Residual Risk" value={asset.residualRisk.score} band={asset.residualRisk.band} />
      </div>
    </button>
  );
}

function CategoryBar({ label, score }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-xs" style={{ color: C.ink }}>{label}</div>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: C.accent }} />
      </div>
      <div className="w-8 text-xs text-right font-medium" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{score}</div>
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

      <div className="px-5 py-4 grid grid-cols-2 gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
        <MetricChip label="Asset Criticality" value={asset.criticality} band={asset.criticalityBand} />
        <MetricChip label="Control Assurance" value={asset.overallAssurance} band={asset.assuranceBand} />
        <MetricChip label="Evidence Confidence" value={asset.evidenceConfidence} band={asset.evidenceConfidenceBand} />
        <MetricChip label="Compliance Coverage" value={`${asset.complianceCoveragePct}%`} band={asset.complianceCoveragePct >= 90 ? { label: "Strong", color: "green" } : asset.complianceCoveragePct >= 75 ? { label: "Adequate", color: "amber" } : { label: "Weak", color: "red" }} />
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: C.muted }}>Control Assurance by Category</div>
        <div className="space-y-2.5">
          {ASSURANCE_CATEGORIES.map((c) => <CategoryBar key={c} label={c} score={asset.categoryScores[c]} />)}
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
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Residual Risk</div>
        <div className="text-[11px] mb-2" style={{ color: C.muted }}>Impact stays fixed to the asset's criticality; only likelihood moves as control assurance improves.</div>
        <div className="flex gap-3">
          <RiskCard title="Inherent Risk" risk={asset.inherentRisk} />
          <RiskCard title="Residual Risk" risk={asset.residualRisk} />
        </div>
      </div>
    </div>
  );
}

export default function AssetRegister() {
  const [selectedId, setSelectedId] = useState(ASSET_SUMMARIES[0]?.id ?? null);
  const selected = ASSET_SUMMARIES.find((a) => a.id === selectedId) || null;

  const groups = [];
  ASSET_SUMMARIES.forEach((asset) => {
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
        <PageHeader
          icon={Boxes}
          title="Asset Register"
          description="Criticality, control assurance, evidence confidence, and residual risk for individual resources inside each system's boundary."
          right={
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
              {ASSET_SUMMARIES.length} assets across {groups.length} systems
            </div>
          }
        />

        <div className="px-8 py-6 space-y-8">
          {groups.map((group) => (
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
          ))}
        </div>
      </div>

      {selected && <AssetDetailPanel asset={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
