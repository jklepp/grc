import React, { useMemo, useState } from "react";
import { Server, Plus, AlertTriangle, Search, Pencil, Trash2 } from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag, AssuranceBadge } from "../components/SystemBadges";
import AddSystemWizard from "../components/AddSystemWizard";
import Modal, { ModalCloseButton } from "../components/Modal";
import { commitRuntimeFacts, removeRuntimeSystem } from "../engine";
import { loadRuntimeFacts } from "../engine/runtimeFactsStore";
import { YAML_FACTS } from "../graph/sources/yaml";
import { useLiveEngine } from "../engine/useLiveEngine";
import type { SystemId } from "../graph/ids";
import type { SystemRollup } from "../engine/rollups";

function coverageColor(pct: number): string {
  if (pct >= 90) return C.green;
  if (pct >= 60) return C.amber;
  return C.red;
}

const COLUMNS = "2.4fr 90px 120px 100px 90px 150px 142px";

function SystemAvatar({ name }: { name: string }) {
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

interface SystemRowProps {
  system: SystemRollup;
  onSelect: (id: SystemId) => void;
  onEdit: (id: SystemId) => void;
  onDelete?: (system: SystemRollup) => void;
  striped: boolean;
}

function SystemRow({ system, onSelect, onEdit, onDelete, striped }: SystemRowProps) {
  const openFindings = system.findings.filter((f) => f.open).length;
  return (
    <div
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
      <button type="button" onClick={() => onSelect(system.id)} className="contents" aria-label={`Open ${system.name}`}>
        <div className="flex items-center gap-3 min-w-0">
          <SystemAvatar name={system.name} />
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{system.name}</div>
              {system.classification && <ClassificationTag level={system.classification} />}
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
      <div className="flex items-center justify-end gap-1.5">
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(system)}
            className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold"
            style={{ color: C.red, background: C.redBg, border: `1px solid ${C.red}` }}
            aria-label={`Delete ${system.name}`}
          >
            <Trash2 size={11} /> Delete
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(system.id)}
          className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold"
          style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
          aria-label={`Edit ${system.name}`}
        >
          <Pencil size={11} /> Edit
        </button>
      </div>
    </div>
  );
}

// The system-level index: every boundary ACME assesses, in one searchable
// table, with the entry point for onboarding a new one. Selecting a row hands
// its id up to Systems, which opens the full System Security Profile on it —
// this page itself carries no per-system detail, only enough to pick one.
export default function SelectSystem({ onSelectSystem }: { onSelectSystem: (id: SystemId) => void }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingSystemId, setEditingSystemId] = useState<SystemId | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SystemRollup | null>(null);
  const [deleteProblems, setDeleteProblems] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const liveEngine = useLiveEngine();
  const systems = liveEngine.rollups.systemRollups;
  const runtimeFacts = loadRuntimeFacts();
  const baselineSystemIds = new Set(YAML_FACTS.systems.map((system) => system.id));
  const deletableSystemIds = new Set(
    runtimeFacts.systems.filter((system) => !baselineSystemIds.has(system.id)).map((system) => system.id)
  );

  function openAddSystem() {
    setEditingSystemId(null);
    setWizardOpen(true);
  }

  function openEditSystem(systemId: SystemId) {
    setEditingSystemId(systemId);
    setWizardOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
    setEditingSystemId(null);
  }

  function deletePendingSystem() {
    if (!pendingDelete || !deletableSystemIds.has(pendingDelete.id)) return;
    const candidate = removeRuntimeSystem(loadRuntimeFacts(), pendingDelete.id);
    const { engine, problems } = commitRuntimeFacts(candidate);
    if (!engine) {
      setDeleteProblems(problems);
      return;
    }
    setPendingDelete(null);
    setDeleteProblems([]);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) =>
      s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.classification?.toLowerCase() ?? "").includes(q)
    );
  }, [query, systems]);

  function handleWizardSaved(systemId: SystemId) {
    const created = editingSystemId === null;
    closeWizard();
    if (created) onSelectSystem(systemId);
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={Server}
        title="Select a System"
        description="Every system inside ACME's assessment boundary. Select one to open its full security profile, or add a new system to bring it into scope."
        right={
          <button
            onClick={openAddSystem}
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
            <div className="text-right">Actions</div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: C.muted, background: C.panel }}>
              No systems match "{query}"
            </div>
          ) : (
            <div style={{ background: C.panel }}>
              {filtered.map((system, i) => (
                <SystemRow
                  key={system.id}
                  system={system}
                  onSelect={onSelectSystem}
                  onEdit={openEditSystem}
                  onDelete={deletableSystemIds.has(system.id) ? setPendingDelete : undefined}
                  striped={i % 2 === 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddSystemWizard open={wizardOpen} onClose={closeWizard} onCreated={handleWizardSaved} editingSystemId={editingSystemId} />

      <Modal
        open={pendingDelete !== null}
        onClose={() => { setPendingDelete(null); setDeleteProblems([]); }}
        width={520}
        height={330}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: C.ink }}>Delete system?</h2>
            <p className="text-xs mt-1" style={{ color: C.muted }}>This action removes the system and all of its runtime assessment data.</p>
          </div>
          <ModalCloseButton onClose={() => { setPendingDelete(null); setDeleteProblems([]); }} />
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-sm" style={{ color: C.ink }}>
            Permanently delete <b>{pendingDelete?.name}</b>? Its assets, data mappings, assessment scope, evidence, findings, and attestations will also be removed.
          </p>
          {deleteProblems.length > 0 && (
            <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ color: C.red, background: C.redBg }}>
              The graph could not be validated after deletion: {deleteProblems.join(" · ")}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button
            type="button"
            onClick={() => { setPendingDelete(null); setDeleteProblems([]); }}
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ color: C.ink, border: `1px solid ${C.border}` }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={deletePendingSystem}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ color: "#fff", background: C.red }}
          >
            <Trash2 size={13} /> Delete system
          </button>
        </div>
      </Modal>
    </div>
  );
}
