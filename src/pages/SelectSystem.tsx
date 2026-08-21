import React, { useMemo, useState } from "react";
import { Server, Plus, AlertTriangle, Search, Pencil, Copy, Trash2 } from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag, AssuranceBadge } from "../components/SystemBadges";
import AddSystemWizard from "../components/AddSystemWizard";
import Modal, { ModalCloseButton } from "../components/Modal";
import { commitRuntimeFacts, removeRuntimeSystem, restoreBaselineSystems } from "../engine";
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

// No content-sized tracks: the table fills the page width instead of scrolling.
// Fixed last track so Edit-only rows share a column with Delete+Edit rows.
const COLUMNS = "minmax(0, 1.3fr) minmax(0, 1.2fr) 68px 72px 56px minmax(0, 1fr) 208px";

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
  onDuplicate: (id: SystemId) => void;
  onDelete?: (system: SystemRollup) => void;
}

function SystemRow({ system, onSelect, onEdit, onDuplicate, onDelete }: SystemRowProps) {
  const openFindings = system.findings.filter((f) => f.open).length;
  return (
    <div
      className="w-full min-w-0 grid items-center gap-3 pl-3.5 pr-4 py-3.5 text-left transition-colors group wz-hover"
      style={{
        gridTemplateColumns: COLUMNS,
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
      }}
      onClick={() => onSelect(system.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(system.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${system.name}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <SystemAvatar name={system.name} />
        <div className="min-w-0 text-left">
          <div className="text-sm font-semibold leading-snug break-words" style={{ color: C.ink }}>{system.name}</div>
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            <div className="text-[11px] truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{system.id}</div>
            {system.classification && (
              <span className="shrink-0">
                <ClassificationTag level={system.classification} />
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-xs truncate min-w-0" style={{ color: C.muted }}>{system.env}</div>
      <div className="flex items-center min-w-0">
        <AssuranceBadge pct={system.overallAssurance} size={34} />
      </div>
      <div className="text-sm font-semibold min-w-0">
        <span style={{ color: coverageColor(system.coverage.assessedPct) }}>{system.coverage.assessedPct}%</span>
      </div>
      <div className="text-xs min-w-0" style={{ color: C.muted }}>{system.assetCount}</div>
      <div className="text-xs truncate min-w-0">
        {openFindings > 0 ? (
          <span className="flex items-center gap-1" style={{ color: C.amber }}><AlertTriangle size={11} /> {openFindings} open</span>
        ) : (
          <span style={{ color: C.green }}>No open findings</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5 min-w-0" onClick={(event) => event.stopPropagation()}>
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
          onClick={() => onDuplicate(system.id)}
          className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold"
          style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
          aria-label={`Duplicate ${system.name}`}
          title="Create a new system as an exact copy of this one"
        >
          <Copy size={11} /> Duplicate
        </button>
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
export interface SystemSelectOptions {
  startAssessment?: boolean;
}

export default function SelectSystem({ onSelectSystem }: { onSelectSystem: (id: SystemId, options?: SystemSelectOptions) => void }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingSystemId, setEditingSystemId] = useState<SystemId | null>(null);
  const [cloneFromSystemId, setCloneFromSystemId] = useState<SystemId | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SystemRollup | null>(null);
  const [deleteProblems, setDeleteProblems] = useState<string[]>([]);
  const [restoreProblems, setRestoreProblems] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const liveEngine = useLiveEngine();
  const systems = liveEngine.rollups.systemRollups;
  const runtimeFacts = loadRuntimeFacts();
  const baselineSystemIds = new Set(YAML_FACTS.systems.map((system) => system.id));
  const deletableSystemIds = new Set(
    runtimeFacts.systems.filter((system) => !baselineSystemIds.has(system.id)).map((system) => system.id)
  );
  const hasDemoOverrides = runtimeFacts.systems.some((system) => baselineSystemIds.has(system.id));

  function openAddSystem() {
    setEditingSystemId(null);
    setCloneFromSystemId(null);
    setWizardOpen(true);
  }

  function openEditSystem(systemId: SystemId) {
    setEditingSystemId(systemId);
    setCloneFromSystemId(null);
    setWizardOpen(true);
  }

  function openDuplicateSystem(systemId: SystemId) {
    setEditingSystemId(null);
    setCloneFromSystemId(systemId);
    setWizardOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
    setEditingSystemId(null);
    setCloneFromSystemId(null);
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

  function restoreDemoSystems() {
    const candidate = restoreBaselineSystems(loadRuntimeFacts(), baselineSystemIds);
    const { engine, problems } = commitRuntimeFacts(candidate);
    if (!engine) {
      setRestoreProblems(problems);
      return;
    }
    setRestoreProblems([]);
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
    if (created) onSelectSystem(systemId, { startAssessment: true });
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={Server}
        title="Select a System"
        description="Every system inside ACME's assessment boundary. Select one to open its full security profile, or add a new system to bring it into scope."
        right={
          <div className="flex items-center gap-2">
            {hasDemoOverrides && (
              <button
                type="button"
                onClick={restoreDemoSystems}
                className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3.5 py-2"
                style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
              >
                Restore demo systems
              </button>
            )}
            <button
              onClick={openAddSystem}
              className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3.5 py-2"
              style={{ background: C.accent, color: "#fff" }}
            >
              <Plus size={14} /> Add System
            </button>
          </div>
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

        {restoreProblems.length > 0 && (
          <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ color: C.red, background: C.redBg }}>
            Could not restore demo systems: {restoreProblems.join(" · ")}
          </div>
        )}

        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <div
            className="grid gap-3 pl-3.5 pr-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ gridTemplateColumns: COLUMNS, background: C.panel2, color: C.muted, borderBottom: `1px solid ${C.border}` }}
          >
            <div className="min-w-0">System</div>
            <div className="min-w-0">Env</div>
            <div className="min-w-0">Assurance</div>
            <div className="min-w-0">Coverage</div>
            <div className="min-w-0">Assets</div>
            <div className="min-w-0">Findings</div>
            <div className="min-w-0 text-right">Actions</div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: C.muted, background: C.panel }}>
              No systems match "{query}"
            </div>
          ) : (
            <div style={{ background: C.panel }}>
              {filtered.map((system) => (
                <SystemRow
                  key={system.id}
                  system={system}
                  onSelect={onSelectSystem}
                  onEdit={openEditSystem}
                  onDuplicate={openDuplicateSystem}
                  onDelete={deletableSystemIds.has(system.id) ? setPendingDelete : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddSystemWizard
        open={wizardOpen}
        onClose={closeWizard}
        onCreated={handleWizardSaved}
        editingSystemId={editingSystemId}
        cloneFromSystemId={cloneFromSystemId}
      />

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
