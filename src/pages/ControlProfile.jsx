import React, { useState } from "react";
import { SlidersHorizontal, Check, Minus, X as XIcon, ClipboardList, Boxes } from "lucide-react";
import { C, CLASS_META, CLASS_ORDER } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { CONTROL_PROFILES, ASSURANCE_CATEGORIES, getAllSystems, evaluateSystemAgainstProfile, tierTargetScore } from "../engine";

const SYSTEMS = getAllSystems();

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
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{category}</span>
        <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{requirement.weight}%</span>
      </div>
      {/* The weight bar reads against a 25% ceiling — the heaviest any category
          gets at any tier — so the bars are comparable across tiers rather than
          each tier rescaling to its own maximum. */}
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: C.panel2 }}>
        <div className="h-full rounded-full" style={{ width: `${(requirement.weight / 25) * 100}%`, background: C.accent }} />
      </div>
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

// A SYSTEM against its tier's bar, not an asset.
//
// This row used to be one asset, comparing its category self-assessment against
// the tier's required maturity and evidence. Both halves of that comparison are
// gone: an asset carries no score, and the self-assessment it was compared
// against was retired. The system is the thing that is assessed now, and it is
// judged against the tier its most sensitive data earns.
function SystemComplianceRow({ system }) {
  const evaluation = evaluateSystemAgainstProfile(system.id);
  if (!evaluation) return null;
  const failing = ASSURANCE_CATEGORIES.flatMap((c) => evaluation[c].failingControls);
  const target = tierTargetScore(system.classification);
  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{system.name}</div>
          <div className="text-xs" style={{ color: C.muted }}>
            {system.hostingType} · {system.coverage.assessed} of {system.coverage.applicable} controls assessed ({system.coverage.assessedPct}%)
          </div>
        </div>
        <div className="text-xs shrink-0 tabular-nums" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
          {system.overallAssurance} / {target}
        </div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {ASSURANCE_CATEGORIES.map((category) => (
          <div key={category} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate" style={{ color: C.muted }}>
              {category}
              <span className="ml-1" style={{ color: C.border }}>→ {evaluation[category].requiredLevel}</span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="tabular-nums" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{evaluation[category].weight}%</span>
              <StatusPill status={evaluation[category].status} />
            </span>
          </div>
        ))}
      </div>
      {failing.length > 0 && (
        <div className="text-[11px] mt-2 pt-2 leading-relaxed" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
          Held below profile by {[...new Set(failing.map((f) => f.controlId))].slice(0, 8).join(", ")}
          {failing.length > 8 ? ` and ${failing.length - 8} more.` : "."}
        </div>
      )}
    </div>
  );
}

export default function ControlProfile() {
  const [tier, setTier] = useState(CLASS_ORDER[CLASS_ORDER.length - 1]);
  const profile = CONTROL_PROFILES[tier];
  // Classification is derived bottom-up from the data a system's assets hold,
  // so a system appears under the tier its own contents earn rather than one
  // somebody typed on it.
  const systemsAtTier = SYSTEMS.filter((s) => s.classification === tier);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={SlidersHorizontal}
        title="Control Profile"
        description="The PRISMA maturity level every control must reach per data classification tier, weighted by category, and how each system measures against the tier its own data earns."
      />

      <div className="px-8">
        <div className="flex items-center gap-2 mt-4">
          {CLASS_ORDER.map((t) => <TierTab key={t} tier={t} active={t === tier} onSelect={setTier} />)}
        </div>
      </div>

      <div className="px-8 pt-6">
        <SectionHeading icon={ClipboardList} right={<span className="text-xs" style={{ color: C.muted }}>Clearing every category scores {tierTargetScore(tier)}</span>}>
          Required Control Profile — {tier}
        </SectionHeading>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {ASSURANCE_CATEGORIES.map((category) => (
            <RequirementCard key={category} category={category} requirement={profile[category]} />
          ))}
        </div>
      </div>

      <div className="px-8 py-6 pb-12">
        <SectionHeading icon={Boxes} right={<div className="text-xs" style={{ color: C.muted }}>{systemsAtTier.length} systems</div>}>
          Systems at {tier}
        </SectionHeading>
        {systemsAtTier.length === 0 ? (
          <div className="text-sm rounded-xl p-6 text-center" style={{ color: C.muted, background: C.panel, border: `1px solid ${C.border}` }}>
            No systems currently classified {tier}.
          </div>
        ) : (
          <div className="space-y-2">
            {systemsAtTier.map((system) => <SystemComplianceRow key={system.id} system={system} />)}
          </div>
        )}
      </div>
    </div>
  );
}
