import React, { useState } from "react";
import { Server, Plus, AlertTriangle } from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag, AssuranceBadge } from "../components/SystemBadges";
import AddSystemWizard from "../components/AddSystemWizard";
import { getAllSystems } from "../engine";

const SYSTEMS = getAllSystems();

function coverageColor(pct) {
  if (pct >= 90) return C.green;
  if (pct >= 60) return C.amber;
  return C.red;
}

function SystemCard({ system, onSelect }) {
  const openFindings = system.findings.filter((f) => f.status !== "closed" && f.status !== "verified").length;
  return (
    <button
      onClick={() => onSelect(system.id)}
      className="w-full text-left rounded-xl p-4 transition-colors"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{system.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{system.id} · {system.env}</div>
        </div>
        <ClassificationTag level={system.classification} />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <AssuranceBadge pct={system.overallAssurance} size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-xs" style={{ color: C.muted }}>
            Coverage {system.coverage.assessedPct}% ({system.coverage.assessed}/{system.coverage.applicable})
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: C.border }}>
            <div className="h-full rounded-full" style={{ width: `${system.coverage.assessedPct}%`, background: coverageColor(system.coverage.assessedPct) }} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs" style={{ color: C.muted }}>
        <span>{system.assetCount} asset{system.assetCount === 1 ? "" : "s"}</span>
        {openFindings > 0 ? (
          <span className="flex items-center gap-1" style={{ color: C.amber }}><AlertTriangle size={11} /> {openFindings} open finding{openFindings === 1 ? "" : "s"}</span>
        ) : (
          <span style={{ color: C.green }}>No open findings</span>
        )}
      </div>
    </button>
  );
}

// The system-level index: every boundary ACME assesses, in one list, with the
// entry point for onboarding a new one. Selecting a card hands its id up to
// Data Estate, which switches to System Security Profile already open on it —
// this page itself carries no per-system detail, only enough to pick one.
export default function SystemsRegister({ onSelectSystem }) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="w-full">
      <PageHeader
        icon={Server}
        title="System Register"
        description="Every system inside ACME's assessment boundary. Select one to open its full security profile, or add a new system to bring it into scope."
        right={
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3.5 py-2"
            style={{ background: C.accent, color: "#fff" }}
          >
            <Plus size={14} /> Add System
          </button>
        }
      />

      <div className="px-8 py-6">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {SYSTEMS.map((system) => (
            <SystemCard key={system.id} system={system} onSelect={onSelectSystem} />
          ))}
        </div>
      </div>

      <AddSystemWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
