import React, { useState } from "react";
import { SlidersHorizontal, Check, Minus, X as XIcon, ClipboardList, Boxes } from "lucide-react";
import { C, CLASS_META, CLASS_ORDER } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { CONTROL_PROFILES } from "../data/controlProfiles";
import { ASSURANCE_CATEGORIES } from "../data/assuranceModel";
import { ASSET_SUMMARIES } from "../data/assets";

function colorFor(key) {
  return { color: C[key], bg: C[`${key}Bg`] };
}

const STATUS_META = {
  met: { label: "Met", key: "green", Icon: Check },
  partial: { label: "Partial", key: "amber", Icon: Minus },
  gap: { label: "Gap", key: "red", Icon: XIcon },
};

function TierTab({ tier, active, onSelect }) {
  const meta = CLASS_META[tier];
  return (
    <button
      onClick={() => onSelect(tier)}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{ background: active ? meta.bg : "transparent", color: active ? meta.color : C.muted, border: `1px solid ${active ? meta.color : C.border}` }}
    >
      {tier}
    </button>
  );
}

function RequirementCard({ category, requirement }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="text-sm font-semibold mb-3" style={{ color: C.ink }}>{category}</div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: C.muted }}>Min. maturity</span>
          <span className="font-medium px-2 py-0.5 rounded" style={{ color: C.accent, background: C.accentBg }}>{requirement.maturity}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: C.muted }}>Min. evidence</span>
          <span className="font-medium px-2 py-0.5 rounded" style={{ color: C.accent, background: C.accentBg }}>{requirement.evidence}</span>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status];
  const { color, bg } = colorFor(meta.key);
  const Icon = meta.Icon;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      <Icon size={10} /> {meta.label}
    </span>
  );
}

function AssetComplianceRow({ asset }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{asset.name}</div>
          <div className="text-xs" style={{ color: C.muted }}>{asset.system.name} · {asset.type}</div>
        </div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {ASSURANCE_CATEGORIES.map((category) => (
          <div key={category} className="flex items-center justify-between text-xs">
            <span style={{ color: C.muted }}>{category}</span>
            <StatusPill status={asset.profileEvaluation[category].status} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ControlProfile() {
  const [tier, setTier] = useState(CLASS_ORDER[CLASS_ORDER.length - 1]);
  const profile = CONTROL_PROFILES[tier];
  const assetsAtTier = ASSET_SUMMARIES.filter((a) => a.classification === tier);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={SlidersHorizontal}
        title="Control Profile"
        description="The minimum control maturity and evidence quality required for a given data classification tier — the bar every asset at that tier is judged against before it's considered adequately controlled."
      />

      <div className="px-8">
        <div className="flex items-center gap-2 mt-4">
          {CLASS_ORDER.map((t) => <TierTab key={t} tier={t} active={t === tier} onSelect={setTier} />)}
        </div>
      </div>

      <div className="px-8 pt-6">
        <SectionHeading icon={ClipboardList}>Required Control Profile — {tier}</SectionHeading>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {ASSURANCE_CATEGORIES.map((category) => (
            <RequirementCard key={category} category={category} requirement={profile[category]} />
          ))}
        </div>
      </div>

      <div className="px-8 py-6 pb-12">
        <SectionHeading icon={Boxes} right={<div className="text-xs" style={{ color: C.muted }}>{assetsAtTier.length} assets</div>}>
          Assets at {tier}
        </SectionHeading>
        {assetsAtTier.length === 0 ? (
          <div className="text-sm rounded-xl p-6 text-center" style={{ color: C.muted, background: C.panel, border: `1px solid ${C.border}` }}>
            No assets currently classified {tier}.
          </div>
        ) : (
          <div className="space-y-2">
            {assetsAtTier.map((asset) => <AssetComplianceRow key={asset.id} asset={asset} />)}
          </div>
        )}
      </div>
    </div>
  );
}
