import React, { useState } from "react";
import {
  Link2, AlertTriangle, MapPin, FileCheck2, Wrench, Gauge, Plus, Pencil, Trash2,
} from "lucide-react";
import { C } from "../../theme";
import {
  PRISMA_LEVELS, COMPLIANCE_LABELS, COMPLIANCE_RATINGS, findingsForSystem,
  FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META, BASIS_META,
  EVIDENCE_TYPES, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS,
  getEvidence, resolveProgramApplicability,
  evaluateControl, addPrismaOverride, updateEvidence, removeEvidence,
} from "../../engine";
import { buildLiveEngine } from "../../engine/liveGraph";
import { loadRuntimeFacts, saveRuntimeFacts } from "../../engine/runtimeFactsStore";
import { YAML_FACTS } from "../../graph/sources/yaml";
import { STATUS_META, IMPLEMENTATION_META, RESPONSIBILITY_META, ratingColor, assetName, evidenceHealthForRow } from "./controlMeta";
import { POLICY_BY_CONTROL } from "./policyLookup";
import { BasisTag } from "../../components/BasisTag";
import Modal, { ModalCloseButton } from "../../components/Modal";

// Worst-rated PRISMA level for a control's assessment — the single sentence
// that best answers "what's wrong" or "what to improve" when no finding has
// been filed yet to answer it more concretely.
function worstLevel(assessment) {
  if (!assessment?.assessed) return null;
  return PRISMA_LEVELS.map((level) => assessment.levels[level]).sort((a, b) => a.rating - b.rating)[0];
}

// The single most urgent remediation status across a control's findings —
// Blocked beats In Progress beats Planned beats Complete — so the glance
// strip can show one badge instead of forcing a scroll to find out.
const REMEDIATION_URGENCY = ["Blocked", "In Progress", "Planned", "Complete"];
function mostUrgentRemediation(findings) {
  if (findings.length === 0) return null;
  return REMEDIATION_URGENCY.find((s) => findings.some((f) => f.remediationStatus === s)) ?? findings[0].remediationStatus;
}

function remediationBadgeStyle(colorKey) {
  return { background: C[`${colorKey}Bg`] ?? C.panel2, color: C[colorKey] ?? C.muted };
}

function GlancePill({ Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <Icon size={12} color={C.muted} className="shrink-0" />
      <span className="text-[9.5px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: color ?? C.ink }}>{value}</span>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {Icon && <Icon size={13} color={C.accent} />}
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent }}>{children}</div>
    </div>
  );
}

// Evidence records added through this panel carry the EVD-USR- prefix
// (see nextEvidenceId in runtimeFactsStore.ts); YAML-authored evidence never
// enters RuntimeFacts, so there is nothing for updateEvidence/removeEvidence
// to reach even if a user tried. This check just decides whether to show the
// edit/delete affordance.
function isRuntimeEvidence(evidenceId) {
  return typeof evidenceId === "string" && evidenceId.startsWith("EVD-USR-");
}

function fieldLabel(children) {
  return <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>{children}</div>;
}

const inputStyle = {
  background: C.panel, border: `1px solid ${C.border}`, color: C.ink,
  borderRadius: 8, padding: "6px 8px", fontSize: 12, width: "100%",
};

function EvidenceRow({ e, assetLabel, governing, onEdit, onDelete, readOnly }) {
  const editable = !readOnly && isRuntimeEvidence(e.id);
  return (
    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: C.muted }}>
      <Link2 size={10} className="shrink-0" />
      <span className="min-w-0 truncate">
        {assetLabel && <span style={{ color: C.ink }}>{assetLabel} · </span>}
        {e.source} · {e.result.toUpperCase()}
        {e.exceptionRate != null && ` (${e.exceptions}/${e.population})`} · {e.coveragePct}%
      </span>
      <span className="shrink-0">{e.ageDays === 0 ? "today" : `${e.ageDays}d ago`}</span>
      {e.stale && <span className="font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: C.amberBg, color: C.amber }}>STALE</span>}
      {governing && <span className="font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: C.accentBg, color: C.accent }}>GOVERNING</span>}
      {editable ? (
        <span className="flex items-center gap-1 shrink-0 ml-1">
          <button onClick={() => onEdit(e)} title="Edit"><Pencil size={11} color={C.muted} /></button>
          <button onClick={() => onDelete(e)} title="Delete"><Trash2 size={11} color={C.red} /></button>
        </span>
      ) : (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: C.panel2, color: C.muted }}>REFERENCE</span>
      )}
    </div>
  );
}

const EMPTY_EVIDENCE_FORM = {
  source: "", evidenceType: EVIDENCE_TYPES[0], result: "pass", coveragePct: 100,
  exceptions: "", population: "", independence: "automated", note: "",
};

function EvidenceForm({ initial, assetOptions, isProgramScoped, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial ?? EMPTY_EVIDENCE_FORM);
  const [assetIds, setAssetIds] = useState(
    isProgramScoped ? [] : (initial?.assetIds ?? assetOptions.map((a) => a.assetId))
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="grid grid-cols-2 gap-2">
        <div>{fieldLabel("Source")}<input style={inputStyle} value={form.source} onChange={set("source")} placeholder="e.g. Vanta, Auditor name" /></div>
        <div>{fieldLabel("Evidence type")}
          <select style={inputStyle} value={form.evidenceType} onChange={set("evidenceType")}>
            {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Result")}
          <select style={inputStyle} value={form.result} onChange={set("result")}>
            {EVIDENCE_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Independence")}
          <select style={inputStyle} value={form.independence} onChange={set("independence")}>
            {INDEPENDENCE_LEVELS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Coverage %")}<input type="number" min={0} max={100} style={inputStyle} value={form.coveragePct} onChange={set("coveragePct")} /></div>
        <div />
        <div>{fieldLabel("Exceptions (optional)")}<input type="number" min={0} style={inputStyle} value={form.exceptions} onChange={set("exceptions")} /></div>
        <div>{fieldLabel("Population (optional)")}<input type="number" min={0} style={inputStyle} value={form.population} onChange={set("population")} /></div>
      </div>
      <div className="mt-2">{fieldLabel("Note")}<input style={inputStyle} value={form.note} onChange={set("note")} placeholder="Optional context" /></div>
      {!isProgramScoped && assetOptions.length > 0 && (
        <div className="mt-2">
          {fieldLabel("Applies to assets")}
          <div className="flex flex-wrap gap-1.5">
            {assetOptions.map((a) => {
              const checked = assetIds.includes(a.assetId);
              return (
                <button
                  key={a.assetId}
                  onClick={() => setAssetIds((ids) => checked ? ids.filter((id) => id !== a.assetId) : [...ids, a.assetId])}
                  className="text-[10px] px-2 py-1 rounded-full"
                  style={{ background: checked ? C.accentBg : C.panel2, color: checked ? C.accent : C.muted, border: `1px solid ${checked ? C.accent : C.border}` }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: C.accent, color: "#fff" }}
          onClick={() => onSubmit({
            source: form.source.trim(),
            evidenceType: form.evidenceType,
            result: form.result,
            coveragePct: Number(form.coveragePct) || 0,
            exceptions: form.exceptions === "" ? undefined : Number(form.exceptions),
            population: form.population === "" ? undefined : Number(form.population),
            independence: form.independence,
            note: form.note.trim() || undefined,
            assetIds,
          })}
          disabled={!form.source.trim()}
        >
          Save evidence
        </button>
        <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function OverrideForm({ level, current, onCancel, onSubmit }) {
  const [rating, setRating] = useState(current?.rating ?? current?.derived ?? 50);
  const [note, setNote] = useState("");
  const [assessedBy, setAssessedBy] = useState("");
  const ready = note.trim() && assessedBy.trim();

  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="grid grid-cols-2 gap-2">
        <div>{fieldLabel(`Assessor rating for ${level}`)}
          <select style={inputStyle} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {COMPLIANCE_RATINGS.map((r) => <option key={r} value={r}>{r} — {COMPLIANCE_LABELS[r]}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Assessed by")}<input style={inputStyle} value={assessedBy} onChange={(e) => setAssessedBy(e.target.value)} placeholder="Your name" /></div>
      </div>
      <div className="mt-2">{fieldLabel("Rationale (required)")}<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why does this differ from the derived rating?" /></div>
      <div className="flex items-center gap-2 mt-3">
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: ready ? C.accent : C.border, color: "#fff" }}
          disabled={!ready}
          onClick={() => onSubmit({ rating, note: note.trim(), assessedBy: assessedBy.trim() })}
        >
          Save override
        </button>
        <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// Full-space operator panel for a single control row: review its requirements
// and evidence, then act — attach/edit/delete evidence and record an assessor
// override on any PRISMA lane — without leaving the Systems page. Every write
// goes through the same dry-run-then-save path as the Add System wizard:
// mutate a RuntimeFacts copy, validate it with buildLiveEngine, and only
// persist + reload once that comes back clean.
export function ControlEvaluationPanel({ row, system, onClose }) {
  const [attachingEvidence, setAttachingEvidence] = useState(false);
  const [editingEvidenceId, setEditingEvidenceId] = useState(null);
  const [overridingLevel, setOverridingLevel] = useState(null);
  const [saveError, setSaveError] = useState(null);

  if (!row) return null;

  const governingPolicy = POLICY_BY_CONTROL[row.control.id];
  const drawerClauses = row.control.frameworks.filter((f) => system.standards.includes(f.standard));
  const statusMeta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const implMeta = IMPLEMENTATION_META.find((m) => m.type === row.control.implementationType);
  const controlFindings = findingsForSystem(system.id).filter((f) => f.controlId === row.control.id);
  const urgentRemediation = mostUrgentRemediation(controlFindings);
  const worst = worstLevel(row.assessment);
  const isProgramScoped = row.keyControl?.scope === "program";
  const programApplicability = isProgramScoped ? resolveProgramApplicability(system.id, row.control.id) : null;
  const evidenceHealth = evidenceHealthForRow(row);
  const assetOptions = row.instances.map((inst) => ({ assetId: inst.assetId, label: assetName(system, inst.assetId) }));
  const allEvidence = row.instances.flatMap((inst) => inst.evidence.map((e) => ({ ...e, assetLabel: assetName(system, inst.assetId), governing: inst.governing?.id === e.id })));

  // Every instance's applicability reasons are usually identical (the same
  // rule matched every asset the same way) — say it once at the section
  // level instead of repeating the same sentence per asset.
  const applicabilityRationales = [...new Set(
    row.instances.flatMap((inst) => (inst.applicability?.reasons ?? []).map((r) => r.rationale))
  )];

  function saveMutation(mutate) {
    setSaveError(null);
    const existing = loadRuntimeFacts();
    const runtime = mutate(existing);
    const { engine, problems } = buildLiveEngine(YAML_FACTS, runtime);
    if (!engine) {
      setSaveError(problems);
      return;
    }
    saveRuntimeFacts(runtime);
    window.location.reload();
  }

  function handleAttachEvidence(draft) {
    saveMutation((existing) => evaluateControl(existing, {
      systemId: system.id,
      controlId: row.control.id,
      evidenceEntries: [draft],
    }));
  }

  function handleUpdateEvidence(evidenceId, patch) {
    saveMutation((existing) => updateEvidence(existing, evidenceId, patch));
  }

  function handleDeleteEvidence(evidenceId) {
    saveMutation((existing) => removeEvidence(existing, evidenceId));
  }

  function handleOverride(level, { rating, note, assessedBy }) {
    saveMutation((existing) => addPrismaOverride(existing, {
      systemId: system.id,
      controlId: row.control.id,
      level,
      rating,
      note,
      assessedBy,
      assessedAt: new Date().toISOString().slice(0, 10),
    }));
  }

  return (
    <Modal open onClose={onClose} width={1100} height={820}>
      <div className="flex items-start justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{row.control.id} · {row.control.domain}</div>
          <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{row.control.name}</h2>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: statusMeta.bg, color: statusMeta.color }}>
              <statusMeta.Icon size={12} /> {statusMeta.label}
            </span>
            {respMeta && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: respMeta.bg, color: respMeta.color }}>
                <respMeta.Icon size={12} /> {respMeta.label}
              </span>
            )}
            {implMeta && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: implMeta.bg, color: implMeta.color }}>
                <implMeta.Icon size={12} /> {implMeta.type}
              </span>
            )}
          </div>
          {/* Glance strip — the answer to all five questions in one row,
              before reading a word of prose below. */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <GlancePill Icon={FileCheck2} label="Evidence" value={evidenceHealth.label} color={evidenceHealth.color} />
            {urgentRemediation && (
              <GlancePill
                Icon={Wrench}
                label="Remediation"
                value={urgentRemediation}
                color={C[FINDING_REMEDIATION_STATUS_META[urgentRemediation]?.color] ?? C.ink}
              />
            )}
            {row.assessment?.assessed && (
              <GlancePill Icon={Gauge} label="Basis" value={BASIS_META[row.basis]?.label ?? row.basis} />
            )}
          </div>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {saveError && (
          <div className="rounded-lg p-3 mb-4" style={{ background: C.redBg, border: `1px solid ${C.red}4D` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: C.red }}>Couldn't save — the change would leave the assessment inconsistent:</div>
            <ul className="list-disc pl-4">
              {saveError.map((p, i) => <li key={i} className="text-[11px]" style={{ color: C.red }}>{typeof p === "string" ? p : p.message}</li>)}
            </ul>
          </div>
        )}

        {/* 1. What's wrong */}
        <div className="rounded-lg p-4 mb-6" style={{ background: controlFindings.length > 0 ? C.redBg : C.panel2, border: controlFindings.length > 0 ? `1px solid ${C.red}4D` : `1px solid ${C.border}` }}>
          <SectionLabel icon={AlertTriangle}>What's wrong</SectionLabel>
          {controlFindings.length > 0 ? (
            <div className="space-y-2">
              {controlFindings.map((f) => {
                const severityMetaF = FINDING_SEVERITY_META[f.severity];
                return (
                  <div key={f.id} className="rounded p-2" style={{ background: C.panel }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: C.ink }}>{f.title}</span>
                      {severityMetaF && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: C.panel2, color: C.muted }}>{severityMetaF.label}</span>
                      )}
                    </div>
                    <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{f.detail}</div>
                    <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                      {assetName(system, f.assetId)}
                      {f.source && f.source !== "control-gap" && ` · Source: ${f.source.replace(/-/g, " ")}`}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : worst && worst.rating < 100 ? (
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
              No finding has been filed yet. The assessment shows: {worst.rationale}
            </div>
          ) : (
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.explanation}</div>
          )}
        </div>

        {/* 2. Where it's wrong */}
        <div className="rounded-lg p-4 mb-6" style={{ border: `1px solid ${C.border}` }}>
          <SectionLabel icon={MapPin}>Where it's wrong</SectionLabel>
          {isProgramScoped ? (
            <div>
              <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
                Program-scoped — evaluated once for the whole {system.name} boundary, not per asset.
              </div>
              {programApplicability?.reasons?.length > 0 && (
                <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>
                  {programApplicability.reasons.map((r) => r.rationale).join(" ")}
                </div>
              )}
            </div>
          ) : row.instances.length > 0 ? (
            <div>
              {applicabilityRationales.length === 1 && (
                <div className="text-[11px] mb-2 leading-snug" style={{ color: C.muted }}>
                  Applies because: {applicabilityRationales[0]}
                </div>
              )}
              <div className="space-y-1.5">
                {row.instances.map((inst) => (
                  <div key={`${inst.assetId}-${inst.controlId}`} className="rounded px-2.5 py-1.5" style={{ background: C.panel2 }}>
                    <span className="text-xs font-semibold" style={{ color: C.ink }}>{assetName(system, inst.assetId)}</span>
                    <span className="text-[11px] leading-snug" style={{ color: C.muted }}> — {inst.statement}</span>
                  </div>
                ))}
              </div>
              {applicabilityRationales.length > 1 && (
                <div className="text-[11px] mt-2 leading-snug" style={{ color: C.muted }}>
                  Applies for different reasons per asset: {applicabilityRationales.join(" · ")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm" style={{ color: C.muted }}>No in-scope assets carry this control.</div>
          )}
        </div>

        {/* 3. What evidence proves it */}
        <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-2">
            <SectionLabel icon={FileCheck2}>What evidence proves it</SectionLabel>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ml-2" style={{ background: evidenceHealth.bg, color: evidenceHealth.color }}>
              {evidenceHealth.label}
            </span>
            {!attachingEvidence && (
              <button
                className="ml-auto flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: C.accentBg, color: C.accent }}
                onClick={() => { setAttachingEvidence(true); setEditingEvidenceId(null); }}
              >
                <Plus size={11} /> Attach evidence
              </button>
            )}
          </div>
          {allEvidence.length > 0 ? (
            <div className="space-y-1">
              {allEvidence.map((e) => (
                editingEvidenceId === e.id ? (
                  <EvidenceForm
                    key={e.id}
                    initial={{ ...e, exceptions: e.exceptions ?? "", population: e.population ?? "" }}
                    assetOptions={assetOptions}
                    isProgramScoped={isProgramScoped}
                    onCancel={() => setEditingEvidenceId(null)}
                    onSubmit={(patch) => handleUpdateEvidence(e.id, patch)}
                  />
                ) : (
                  <EvidenceRow
                    key={e.id}
                    e={e}
                    assetLabel={e.assetLabel}
                    governing={e.governing}
                    onEdit={(ev) => { setEditingEvidenceId(ev.id); setAttachingEvidence(false); }}
                    onDelete={(ev) => handleDeleteEvidence(ev.id)}
                  />
                )
              ))}
            </div>
          ) : (
            <div className="text-sm" style={{ color: C.muted }}>No evidence records are on file for this control.</div>
          )}
          {attachingEvidence && (
            <EvidenceForm
              assetOptions={assetOptions}
              isProgramScoped={isProgramScoped}
              onCancel={() => setAttachingEvidence(false)}
              onSubmit={(draft) => handleAttachEvidence(draft)}
            />
          )}
        </div>

        {/* 4. What should we improve */}
        <div className="rounded-lg p-4 mb-6" style={{ border: `1px solid ${C.border}` }}>
          <SectionLabel icon={Wrench}>What should we improve</SectionLabel>
          {controlFindings.length > 0 ? (
            <div className="space-y-3">
              {controlFindings.map((f) => {
                const remMeta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus];
                return (
                  <div key={f.id} className="rounded p-2" style={{ background: C.panel2 }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: C.ink }}>{f.title}</span>
                      {remMeta && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={remediationBadgeStyle(remMeta.color)}>{remMeta.label}</span>
                      )}
                    </div>
                    {f.remediationPlan && (
                      <div className="text-[11px] mt-1 leading-snug" style={{ color: C.ink }}>{f.remediationPlan}</div>
                    )}
                    <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                      {f.remediationOwnerName ?? f.ownerName} · target {f.targetDate ?? f.due}{f.overdue && " · OVERDUE"}
                    </div>
                    {f.remediationStatus === "Complete" && (
                      <div className="text-[11px] mt-1" style={{ color: C.green }}>
                        Closed {f.closedDate}
                        {(f.closureEvidenceIds ?? []).length > 0 && (
                          <div className="mt-1">
                            {f.closureEvidenceIds.map((id) => {
                              const ev = getEvidence(id);
                              return ev ? <EvidenceRow key={id} e={ev} readOnly /> : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : worst && worst.rating < 100 ? (
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
              No remediation plan has been filed yet. Based on the assessment: {worst.rationale}
            </div>
          ) : (
            <div className="text-sm" style={{ color: C.muted }}>No outstanding remediation.</div>
          )}
        </div>

        {/* 5. How was it scored */}
        {row.assessment?.assessed && (
          <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <SectionLabel icon={Gauge}>How was it scored</SectionLabel>
              <span className="ml-auto"><BasisTag basis={row.basis} /></span>
            </div>
            <div className="space-y-2">
              {PRISMA_LEVELS.map((level) => {
                const L = row.assessment.levels[level];
                return (
                  <div key={level} className="rounded p-2" style={{ background: C.panel }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold w-24 shrink-0" style={{ color: C.ink }}>{level}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                        <div className="h-full rounded-full" style={{ width: `${L.rating}%`, background: ratingColor(L.rating) }} />
                      </div>
                      <span className="text-[10px] w-28 shrink-0 text-right" style={{ color: C.muted }}>
                        {COMPLIANCE_LABELS[L.rating]}
                      </span>
                      <span className="text-xs font-semibold tabular-nums w-14 shrink-0 text-right" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {L.rating} ×{L.weight}
                      </span>
                      <BasisTag basis={L.basis} />
                      {overridingLevel !== level && (
                        <button
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0"
                          style={{ background: C.accentBg, color: C.accent }}
                          onClick={() => setOverridingLevel(level)}
                        >
                          Override
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>
                      {L.rating !== L.derived && <span className="font-semibold" style={{ color: C.amber }}>Overridden from {L.derived}. </span>}
                      {L.rationale}
                    </div>
                    {overridingLevel === level && (
                      <OverrideForm
                        level={level}
                        current={L}
                        onCancel={() => setOverridingLevel(null)}
                        onSubmit={(o) => handleOverride(level, o)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {row.assessment.ladderInversions.length > 0 && (
              <div className="text-[11px] mt-2" style={{ color: C.amber }}>
                Rated above the level beneath it: {row.assessment.ladderInversions.join(", ")}.
              </div>
            )}
          </div>
        )}

        {/* Reference: what this control is, not part of the narrative above */}
        <div className="text-[10px] uppercase tracking-wide mb-3 mt-8 pt-4" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
          Control Reference
        </div>

        <div className="rounded-lg p-3 mb-4" style={{ background: C.panel2 }}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>SCF Control Description</div>
          <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.control.description}</div>
        </div>

        {row.control.toolHint && (
          <div className="rounded-lg p-3 mb-4" style={{ border: `1px solid ${C.border}` }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Enforced By</div>
            <div className="text-sm" style={{ color: C.ink }}>{row.control.toolHint}</div>
          </div>
        )}

        {governingPolicy && (
          <div className="rounded-lg p-3 mb-4" style={{ border: `1px solid ${C.border}` }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Governing Policy</div>
            <div className="text-sm" style={{ color: C.ink }}>{governingPolicy.code} · {governingPolicy.title}</div>
          </div>
        )}

        <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>
          Framework Clauses Satisfied ({system.standards.join(", ")})
        </div>
        <div className="rounded-lg" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
          <div className="px-3 py-1">
            {drawerClauses.length === 0 && (
              <div className="py-3 text-xs" style={{ color: C.muted }}>No direct clause mapping for this system's in-scope standards.</div>
            )}
            {drawerClauses.map((f, i) => (
              <div key={i} className="py-2.5" style={{ borderBottom: i < drawerClauses.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div className="text-xs font-medium mb-1" style={{ color: C.ink }}>{f.standard}</div>
                <div className="text-[11px]" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{f.clauses.join(", ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
