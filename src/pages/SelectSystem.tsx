import React, { useEffect, useMemo, useState } from "react";
import { Server, Plus, AlertTriangle, Search, Pencil, Copy, Trash2, Download } from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag, badgeColorFor } from "../components/SystemBadges";
import AddSystemWizard from "../components/AddSystemWizard";
import Modal, { ModalCloseButton } from "../components/Modal";
import { assuranceBand, baseFacts, commitRuntimeFacts, removeRuntimeSystem, restoreBaselineSystems } from "../engine";
import { loadRuntimeFacts, hasRuntimeFacts } from "../engine/runtimeFactsStore";
import { useLiveEngine } from "../engine/useLiveEngine";
import type { SystemId } from "../graph/ids";
import type { SystemRollup } from "../engine/rollups";
import { useSignedInUser } from "../auth/useUser";
import { canCreateSystem, canDeleteSystem, canEditSystem, allows } from "../auth/gates";

function coverageColor(pct: number): string {
  if (pct >= 90) return C.green;
  if (pct >= 60) return C.amber;
  return C.red;
}

// The table carries a minimum width and scrolls inside its own container
// rather than squeezing tracks to fit the viewport, so the numeric block stays
// aligned at every width.
const TABLE_MIN_WIDTH = 1180;

function SystemAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-md shrink-0 font-semibold text-[11px]"
      style={{ width: 22, height: 22, background: C.accentBg, color: C.accent, fontFamily: "'Source Serif 4', serif" }}
    >
      {initial}
    </div>
  );
}

interface SystemRowProps {
  system: SystemRollup;
  onSelect: (id: SystemId) => void;
  // Each of the three is absent when the signed-in user may not perform it,
  // and the control it draws is simply not rendered.
  onEdit?: (id: SystemId) => void;
  onDuplicate?: (id: SystemId) => void;
  onDelete?: (system: SystemRollup) => void;
}

function SystemRow({ system, onSelect, onEdit, onDuplicate, onDelete }: SystemRowProps) {
  const openFindings = system.findings.filter((f) => f.open).length;
  const assurance = system.overallAssurance;
  return (
    <tr
      className="transition-colors wz-hover"
      style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
      onClick={() => onSelect(system.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(system.id);
        }
      }}
      tabIndex={0}
      aria-label={`Open ${system.name}`}
    >
      <td className="px-4 py-2.5 whitespace-nowrap text-[11px]" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
        {system.id}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <SystemAvatar name={system.name} />
          <div className="text-[13px] font-semibold leading-snug truncate" style={{ color: C.ink }}>{system.name}</div>
          {system.classification && (
            <span className="shrink-0">
              <ClassificationTag level={system.classification} />
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 truncate" style={{ color: C.muted }}>{system.env}</td>
      {/* Assurance and coverage read as one aligned numeric block; an
          unassessed system has no assurance figure at all, and shows an em
          dash rather than a zero. */}
      <td
        className="px-3 py-2.5 text-right tabular-nums font-semibold"
        style={{ color: assurance == null ? C.muted : badgeColorFor(assuranceBand(assurance).color).color }}
      >
        {assurance == null ? "—" : `${assurance}%`}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: coverageColor(system.coverage.assessedPct) }}>
        {system.coverage.assessedPct}%
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.muted }}>{system.assetCount}</td>
      <td className="px-3 py-2.5">
        {openFindings > 0 ? (
          <span className="flex items-center gap-1 whitespace-nowrap" style={{ color: C.amber }}><AlertTriangle size={11} /> {openFindings} open</span>
        ) : (
          <span className="whitespace-nowrap" style={{ color: C.green }}>No open findings</span>
        )}
      </td>
      <td className="px-3 py-2.5 pr-4 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(system)}
              className="flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap"
              style={{ color: C.red, background: C.redBg, border: `1px solid ${C.red}` }}
              aria-label={`Delete ${system.name}`}
            >
              <Trash2 size={10} /> Delete
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(system.id)}
              className="flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap"
              style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
              aria-label={`Duplicate ${system.name}`}
              title="Create a new system as an exact copy of this one"
            >
              <Copy size={10} /> Duplicate
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(system.id)}
              className="flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap"
              style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
              aria-label={`Edit ${system.name}`}
            >
              <Pencil size={10} /> Edit
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// One figure in a card's stat row.
function CardStat({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div>
      <div className="text-[17px] font-semibold tabular-nums leading-none" style={{ color }}>{value}</div>
      <div className="text-[10px] mt-1 leading-tight" style={{ color: C.muted }}>{label}</div>
    </div>
  );
}

// The register's narrow-viewport reading. The table above needs 1180px to
// keep its numeric tracks aligned, which on a phone means showing under a
// third of a row at a time -- and because every row is also a tap target,
// swiping to read it fights opening it. A card sizes to the screen instead:
// the same fields, the same derived colours, one unambiguous tap.
//
// Edit/Duplicate/Delete are not drawn here. All three open the Add System
// wizard, which needs a desktop-width window, so they would be three dead
// ends per card. That is a viewport decision, not a permission one -- the
// table's own cluster keeps its gates.ts checks exactly as they are.
function SystemCard({ system, onSelect }: { system: SystemRollup; onSelect: (id: SystemId) => void }) {
  const openFindings = system.findings.filter((f) => f.open).length;
  const assurance = system.overallAssurance;
  return (
    <button
      type="button"
      onClick={() => onSelect(system.id)}
      className="w-full text-left px-4 py-3.5 wz-hover transition-colors"
      style={{ borderTop: `1px solid ${C.border}` }}
      aria-label={`Open ${system.name}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <SystemAvatar name={system.name} />
        <div className="min-w-0 flex-1">
          {/* Wraps rather than truncates: half a system's name answers the
              question worse than a second line costs. */}
          <div className="text-sm font-semibold leading-snug" style={{ color: C.ink }}>{system.name}</div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
            {system.id} · {system.env}
          </div>
        </div>
        {system.classification && (
          <span className="shrink-0"><ClassificationTag level={system.classification} /></span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        {/* An unassessed system has no assurance figure at all, and shows an
            em dash rather than a zero. */}
        <CardStat
          label="Assurance"
          value={assurance == null ? "—" : `${assurance}%`}
          color={assurance == null ? C.muted : badgeColorFor(assuranceBand(assurance).color).color}
        />
        <CardStat label="Coverage" value={`${system.coverage.assessedPct}%`} color={coverageColor(system.coverage.assessedPct)} />
        <CardStat label="Assets" value={system.assetCount} color={C.ink} />
        <CardStat
          label={openFindings === 1 ? "Open finding" : "Open findings"}
          value={openFindings}
          color={openFindings > 0 ? C.amber : C.green}
        />
      </div>
    </button>
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
  const [pendingOpenId, setPendingOpenId] = useState<SystemId | null>(null);
  const liveEngine = useLiveEngine();
  const user = useSignedInUser();
  // Hidden rather than disabled: no system a reader could click on would make
  // any of these allowed, so rendering them greyed out would only be furniture
  // (gates.ts). Editing is per-system and lives on the row itself.
  const mayCreate = allows(canCreateSystem(user));
  const mayDelete = allows(canDeleteSystem(user));
  const systems = liveEngine.rollups.systemRollups;
  const runtimeFacts = loadRuntimeFacts();
  const baselineSystemIds = new Set(baseFacts().systems.map((system) => system.id));
  const deletableSystemIds = new Set(
    mayDelete
      ? runtimeFacts.systems.filter((system) => !baselineSystemIds.has(system.id)).map((system) => system.id)
      : []
  );
  const hasDemoOverrides = mayDelete && runtimeFacts.systems.some((system) => baselineSystemIds.has(system.id));

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

  // The way anything built in this browser gets out of it. Everything the
  // wizard writes lives in one localStorage blob, so a system authored here is
  // invisible to the repo until it is exported and promoted:
  //
  //   node scripts/promote-runtime-facts.mjs --from <this file> --write
  //
  // which renames the ids into the authored namespace, appends the records to
  // src/graph/facts/*.yaml, and proves the facts survived the trip.
  function exportRuntimeFacts() {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(loadRuntimeFacts(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `grc-runtime-facts-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
    // commitRuntimeFacts publishes the new engine in the same event as this
    // callback, and Systems validates the route against systemRollups — so
    // asking it to open the id right here can be answered against the previous
    // engine snapshot, leaving the picker on screen with the hash already
    // naming the workspace. Wait for the condition that actually matters,
    // below, rather than for a frame: requestAnimationFrame did this job on
    // screen but never fires in a background tab, so a wizard finished on a tab
    // the operator had switched away from stranded them on the picker.
    if (created) setPendingOpenId(systemId);
  }

  useEffect(() => {
    if (!pendingOpenId || !systems.some((system) => system.id === pendingOpenId)) return;
    setPendingOpenId(null);
    onSelectSystem(pendingOpenId, { startAssessment: true });
  }, [onSelectSystem, pendingOpenId, systems]);

  return (
    <div className="w-full">
      <PageHeader
        icon={Server}
        title="Select a System"
        description="Every system inside ACME's assessment boundary. Select one to open its full security profile, or add a new system to bring it into scope."
        right={
          <div className="flex items-center gap-2 max-lg:flex-wrap">
            {hasRuntimeFacts(runtimeFacts) && (
              <button
                type="button"
                onClick={exportRuntimeFacts}
                title="Download everything created in this browser, for promotion into the authored dataset"
                className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3.5 py-2"
                style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
              >
                <Download size={14} /> Export runtime facts
              </button>
            )}
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
            {mayCreate && (
              <button
                onClick={openAddSystem}
                className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3.5 py-2"
                style={{ background: C.accent, color: "#fff" }}
              >
                <Plus size={14} /> Add System
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 lg:px-8 pb-8">
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

        <div className="rounded-xl overflow-hidden hidden lg:block" style={{ border: `1px solid ${C.border}`, background: C.panel }}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs" style={{ minWidth: TABLE_MIN_WIDTH }}>
              <thead
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: C.panel2, color: C.muted, borderBottom: `1px solid ${C.border}` }}
              >
                <tr>
                  <th className="px-4 py-2 font-semibold">System ID</th>
                  <th className="px-3 py-2 font-semibold">System</th>
                  <th className="px-3 py-2 font-semibold">Env</th>
                  <th className="px-3 py-2 text-right font-semibold">Assurance</th>
                  <th className="px-3 py-2 text-right font-semibold">Coverage</th>
                  <th className="px-3 py-2 text-right font-semibold">Assets</th>
                  <th className="px-3 py-2 font-semibold">Findings</th>
                  <th className="px-3 py-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <div className="text-sm font-semibold" style={{ color: C.ink }}>No systems match "{query}"</div>
                      <div className="mt-1 text-xs" style={{ color: C.muted }}>
                        Search matches a system's name, id, or classification.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((system) => (
                    <SystemRow
                      key={system.id}
                      system={system}
                      onSelect={onSelectSystem}
                      onEdit={allows(canEditSystem(user, system)) ? openEditSystem : undefined}
                      onDuplicate={mayCreate ? openDuplicateSystem : undefined}
                      onDelete={deletableSystemIds.has(system.id) ? setPendingDelete : undefined}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden lg:hidden" style={{ border: `1px solid ${C.border}`, background: C.panel }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-sm font-semibold" style={{ color: C.ink }}>No systems match "{query}"</div>
              <div className="mt-1 text-xs" style={{ color: C.muted }}>
                Search matches a system's name, id, or classification.
              </div>
            </div>
          ) : (
            filtered.map((system) => (
              <SystemCard key={system.id} system={system} onSelect={onSelectSystem} />
            ))
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
