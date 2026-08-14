import React, { useState } from "react";
import { X, Boxes } from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { ClassificationTag } from "../components/SystemBadges";
import { getAllAssets, ASSURANCE_CATEGORIES, IMPLEMENTATION_STATUS_META, BASIS_META } from "../engine";

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
        <MetricChip label="Assurance" value={asset.overallAssurance} band={asset.assuranceBand} />
        <MetricChip label="Residual Risk" value={asset.residualRisk.score} band={asset.residualRisk.band} />
      </div>
    </button>
  );
}

// The dot marks whether this category's score rests on evidenced control
// implementations or only on the category-level assessment. Same number either
// way; very different strength of claim, which used to be invisible.
function CategoryBar({ label, rollup, weight }) {
  const measured = rollup.basis === "measured";
  return (
    <div className="flex items-center gap-2" title={BASIS_META[rollup.basis]?.detail}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: measured ? C.green : C.na }} />
      <div className="w-24 shrink-0 text-xs truncate" style={{ color: C.ink }}>{label}</div>
      {/* Bar height tracks the category's weight in this asset's tier profile,
          so a heavily-weighted shortfall is visibly heavier than a light one
          rather than every category drawing the same bar. */}
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: C.panel2, height: 2 + (weight / 25) * 6 }}>
        <div className="h-full rounded-full" style={{ width: `${rollup.score}%`, background: C.accent }} />
      </div>
      <div className="w-7 text-[10px] text-right shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{weight}%</div>
      <div className="w-7 text-xs text-right font-medium shrink-0" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{rollup.score}</div>
    </div>
  );
}

// The view the pre-graph register had no way to show: this control, on this
// asset, with the evidence behind it. A control's assurance is contextual, so
// the only place a real number for it can live is here.
function ImplementationRow({ impl }) {
  const meta = IMPLEMENTATION_STATUS_META[impl.status];
  const { color, bg } = colorFor(meta.color === "muted" ? "na" : meta.color);
  const strongest = impl.evidence.reduce((best, e) => (best === null || e.confidence > best.confidence ? e : best), null);
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
      <div className="flex items-center gap-2">
        <span className="text-xs min-w-0 flex-1 truncate" style={{ color: C.ink }}>{impl.control.friendlyName}</span>
        <span className="text-[10px] shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{impl.controlId}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: meta.color === "muted" ? C.muted : color, background: meta.color === "muted" ? "transparent" : bg }}>
          {meta.label}
        </span>
        <span className="text-xs font-semibold w-7 text-right shrink-0" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{impl.score}</span>
      </div>
      {strongest && (
        <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>
          {strongest.source} · {strongest.coveragePct}% coverage · {strongest.ageDays}d ago{strongest.stale ? " (stale)" : ""}
          {impl.evidenceAllocation.length > 1 && ` · +${impl.evidenceAllocation.length - 1} more composing coverage`}
        </div>
      )}
      {/* Prevalence, not just the pass/fail label. "1 of 10,000" and "9,000 of
          10,000" are both failures and are not the same condition. */}
      {impl.exceptionSummary && (
        <div className="text-[11px] mt-1" style={{ color: impl.exceptionSummary.rate >= 0.5 ? C.red : impl.exceptionSummary.rate >= 0.1 ? C.amber : C.muted }}>
          {impl.exceptionSummary.exceptions} of {impl.exceptionSummary.population} {impl.exceptionSummary.unit} in breach
          {" "}({(impl.exceptionSummary.rate * 100).toFixed(impl.exceptionSummary.rate < 0.01 ? 2 : 1)}%)
          {impl.exceptionSummary.rate >= 0.5 ? " — systemic" : impl.exceptionSummary.rate < 0.05 ? " — isolated" : ""}
        </div>
      )}
      {impl.note && <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{impl.note}</div>}
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
        {/* Replaces the old Compliance Coverage chip, which showed this asset's
            PARENT SYSTEM's coverage — identical across every asset in the
            boundary, and so unable to say anything about this one. */}
        <MetricChip
          label="Control-Backed"
          value={`${asset.controlBackedPct}%`}
          band={asset.controlBackedPct >= 90 ? { label: "Strong", color: "green" } : asset.controlBackedPct >= 75 ? { label: "Adequate", color: "amber" } : { label: "Partial", color: "red" }}
        />
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: C.muted }}>Control Assurance by Category</div>
        <div className="space-y-2.5">
          {ASSURANCE_CATEGORIES.map((c) => <CategoryBar key={c} label={c} rollup={asset.categories[c]} weight={asset.categoryWeights[c]} />)}
        </div>
        <div className="text-[11px] mt-3 leading-relaxed" style={{ color: C.muted }}>
          Weighted by the {asset.classification} control profile — thicker bars count for more. A filled dot means the score is backed by evidenced
          control implementations; a grey one means it rests on the category-level assessment alone.
        </div>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>
          Tracked Controls — {asset.evidencedControlCount} of {asset.requiredControlCount} evidenced
        </div>
        <div className="text-[11px] mb-3 leading-relaxed" style={{ color: C.muted }}>
          Each control scored against this specific asset. The same control can be strong here and weak elsewhere, which is why no score is stored on the control itself.
        </div>
        <div className="space-y-1.5">
          {[...asset.implementations].sort((a, b) => a.score - b.score).map((impl) => (
            <ImplementationRow key={impl.controlId} impl={impl} />
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
  const [selectedId, setSelectedId] = useState(ASSETS[0]?.id ?? null);
  const selected = ASSETS.find((a) => a.id === selectedId) || null;

  const groups = [];
  ASSETS.forEach((asset) => {
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
              {ASSETS.length} assets across {groups.length} systems
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
