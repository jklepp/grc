import React, { useMemo, useState } from "react";
import { Server, Plus, AlertTriangle, Search } from "lucide-react";
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

const COLUMNS = "2.4fr 90px 120px 100px 90px 150px";

function SystemAvatar({ name }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-lg shrink-0 font-semibold"
      style={{ width: 34, height: 34, background: C.accentBg, color: C.accent, fontFamily: "'Source Serif 4', serif" }}
    >
      {initial}
    </div>
  );
}

function SystemRow({ system, onSelect, striped }) {
  const openFindings = system.findings.filter((f) => f.open).length;
  return (
    <button
      onClick={() => onSelect(system.id)}
      className="w-full grid items-center gap-3 pl-3.5 pr-4 py-3.5 text-left transition-all group"
      style={{
        gridTemplateColumns: COLUMNS,
        borderBottom: `1px solid ${C.border}`,
        borderLeft: "3px solid transparent",
        background: striped ? C.panel2 : "transparent",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderLeftColor = C.accent; e.currentTarget.style.background = C.accentBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = "transparent"; e.currentTarget.style.background = striped ? C.panel2 : "transparent"; }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <SystemAvatar name={system.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{system.name}</div>
            <ClassificationTag level={system.classification} />
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{system.id}</div>
        </div>
      </div>
      <div className="text-xs" style={{ color: C.muted }}>{system.env}</div>
      <div className="flex items-center gap-2">
        <AssuranceBadge pct={system.overallAssurance} size={34} />
      </div>
      <div className="text-sm font-semibold">
        <span style={{ color: coverageColor(system.coverage.assessedPct) }}>{system.coverage.assessedPct}%</span>
      </div>
      <div className="text-xs" style={{ color: C.muted }}>{system.assetCount}</div>
      <div className="text-xs">
        {openFindings > 0 ? (
          <span className="flex items-center gap-1" style={{ color: C.amber }}><AlertTriangle size={11} /> {openFindings} open</span>
        ) : (
          <span style={{ color: C.green }}>No open findings</span>
        )}
      </div>
    </button>
  );
}

// The system-level index: every boundary ACME assesses, in one searchable
// table, with the entry point for onboarding a new one. Selecting a row hands
// its id up to Systems, which opens the full System Security Profile on it —
// this page itself carries no per-system detail, only enough to pick one.
export default function SelectSystem({ onSelectSystem }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SYSTEMS;
    return SYSTEMS.filter((s) =>
      s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.classification.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="w-full">
      <PageHeader
        icon={Server}
        title="Select a System"
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

      <div className="px-8 pb-8">
        <div
          className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg mb-4"
          style={{ background: C.panel, border: `1px solid ${C.border}`, maxWidth: 380 }}
        >
          <Search size={14} color={C.muted} className="shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search systems…"
            className="bg-transparent text-sm outline-none w-full min-w-0"
            style={{ color: C.ink }}
          />
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}`, boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}>
          <div
            className="grid gap-3 pl-3.5 pr-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ gridTemplateColumns: COLUMNS, background: C.panel2, color: C.muted, borderBottom: `2px solid ${C.accent}` }}
          >
            <div>System</div>
            <div>Env</div>
            <div>Assurance</div>
            <div>Coverage</div>
            <div>Assets</div>
            <div>Findings</div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: C.muted, background: C.panel }}>
              No systems match "{query}"
            </div>
          ) : (
            <div style={{ background: C.panel }}>
              {filtered.map((system, i) => (
                <SystemRow key={system.id} system={system} onSelect={onSelectSystem} striped={i % 2 === 1} />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddSystemWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
