import React, { useState } from "react";
import {
  Link2, BookOpenText, Layers, FileCheck2, Wrench, Gauge, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { C } from "../../theme";
import {
  PRISMA_LEVELS, COMPLIANCE_LABELS, COMPLIANCE_RATINGS, findingsForSystem,
  FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META, FINDING_SEVERITIES, FINDING_SOURCES, REMEDIATION_STATUSES,
  INSTANCE_STATUS_META,
  EVIDENCE_TYPES, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS,
  getEvidence, resolveProgramApplicability, assetsForSystem, getDataFlows, ORGS,
  evaluateControl, addPrismaOverride, updateEvidence, removeEvidence, addFinding,
} from "../../engine";
import { buildLiveEngine } from "../../engine/liveGraph";
import { loadRuntimeFacts, saveRuntimeFacts } from "../../engine/runtimeFactsStore";
import { YAML_FACTS } from "../../graph/sources/yaml";
import { PRINCIPLE_DOMAINS, STATUS_META as PRINCIPLE_STATUS_META } from "../../data/securityPrinciples";
import { STATUS_META, IMPLEMENTATION_META, RESPONSIBILITY_META, ratingColor, assetName, evidenceHealthForRow } from "./controlMeta";
import { POLICY_BY_CONTROL } from "./policyLookup";
import { BasisTag } from "../../components/BasisTag";
import Modal, { ModalCloseButton } from "../../components/Modal";

// The single worst-rated PRISMA lane, paired with its level name — the
// bottleneck that a one-click "Save Assessment" acts on, and the sentence
// that answers "why isn't this Satisfied" when no finding has been filed yet
// to answer it more concretely.
function worstLevelEntry(assessment) {
  if (!assessment?.assessed) return null;
  return PRISMA_LEVELS.map((level) => [level, assessment.levels[level]]).sort((a, b) => a[1].rating - b[1].rating)[0];
}

// Which architecture layer each asset sits in, reusing the exact same
// request-path classification the Architecture tab's data-flow diagram
// already derives (engine/rollups.ts's flowLayoutForSystem, via
// getDataFlows) — not a second taxonomy invented for this panel. Labels
// match DataMap.jsx's stageLabel()/section headers verbatim so a control's
// coverage groups the same way an operator already reads the Architecture
// tab.
function assetLayerMap(systemId) {
  const layout = getDataFlows(systemId);
  const map = {};
  layout.stages.forEach((s) => {
    const label = s.depth === 0 ? "Web Ingress" : `Stage ${s.depth}`;
    s.nodes.forEach((n) => { map[n.id] = label; });
  });
  layout.dataPlane.forEach((d) => { map[d.asset.id] = "Data Plane"; });
  layout.egress.forEach((e) => { map[e.asset.id] = "Web Egress"; });
  layout.softwareDeployment.forEach((s) => { map[s.asset.id] = "Software Deployment"; });
  layout.workforceIngress.forEach((w) => { map[w.asset.id] = "Ingress - Workforce"; });
  layout.branches.forEach((b) => { map[b.asset.id] = "Control Plane"; });
  return map;
}

const LAYER_RANK = {
  "Web Ingress": 0, "Data Plane": 1000, "Web Egress": 1001,
  "Control Plane": 1002, "Software Deployment": 1003, "Ingress - Workforce": 1004,
  Unmapped: 9999,
};
function layerRank(label) {
  if (label in LAYER_RANK) return LAYER_RANK[label];
  const stage = /^Stage (\d+)$/.exec(label);
  return stage ? 1 + Number(stage[1]) : 9998;
}

// Groups a control's per-asset instances by architecture layer, sorted
// Web Ingress -> Stage 1..N -> Data Plane -> Web Egress -> Control Plane ->
// Software Deployment -> Ingress - Workforce -> Unmapped (assets with no
// data-flow edges recorded, e.g. isolated stores) last rather than dropped.
function groupInstancesByLayer(instances, systemId) {
  const layerMap = assetLayerMap(systemId);
  const groups = {};
  instances.forEach((inst) => {
    const label = layerMap[inst.assetId] ?? "Unmapped";
    (groups[label] ??= []).push(inst);
  });
  return Object.entries(groups).sort(([a], [b]) => layerRank(a) - layerRank(b));
}

// Security Principles carry their own controlIds, derived from the SOP steps
// that implement them (see data/securityPrinciples.js) — this just inverts
// that into "which principles does THIS control implement," a lookup nothing
// upstream needed until now.
function principlesForControl(controlId) {
  const out = [];
  PRINCIPLE_DOMAINS.forEach((domain) => {
    domain.principles.forEach((p) => {
      if (p.controlIds.includes(controlId)) out.push({ domainTitle: domain.title, ...p });
    });
  });
  return out;
}

// The single most urgent remediation status across a control's findings —
// Blocked beats In Progress beats Planned beats Complete — so the header can
// show one badge instead of forcing a scroll to find out.
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

function SectionLabel({ icon: Icon, children, action }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {Icon && <Icon size={13} color={C.accent} />}
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent }}>{children}</div>
      {action && <span className="ml-auto">{action}</span>}
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

// A function, not a hoisted object literal — C's values are mutated in place
// by theme.js's applyTheme() on every theme change, so a plain object built
// once at module load would freeze whatever C.panel held before the app's
// default theme was ever applied (see controlMeta.js's meta() for the same
// problem). Calling this at render time reads the live values instead.
function inputStyle() {
  return {
    background: C.panel, border: `1px solid ${C.border}`, color: C.ink,
    borderRadius: 8, padding: "6px 8px", fontSize: 12, width: "100%",
  };
}

// Compact evidence card: source, result, coverage, freshness, independence at
// a glance, with edit/delete for records this panel itself added.
function EvidenceCard({ e, assetLabel, governing, onEdit, onDelete, readOnly }) {
  const editable = !readOnly && isRuntimeEvidence(e.id);
  return (
    <div className="rounded-lg p-2.5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <Link2 size={11} color={C.muted} className="shrink-0" />
        <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: C.ink }}>{e.source}</span>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 uppercase"
          style={{ background: e.result === "pass" ? C.greenBg : e.result === "partial" ? C.amberBg : C.redBg, color: e.result === "pass" ? C.green : e.result === "partial" ? C.amber : C.red }}
        >
          {e.result}
        </span>
        {governing && <span className="font-semibold px-1.5 py-0.5 rounded shrink-0 text-[9px]" style={{ background: C.accentBg, color: C.accent }}>GOVERNING</span>}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10.5px] flex-wrap" style={{ color: C.muted }}>
        {assetLabel && <span>{assetLabel}</span>}
        <span>Coverage {e.coveragePct}%{e.exceptionRate != null && ` (${e.exceptions}/${e.population})`}</span>
        <span>{e.ageDays === 0 ? "Collected today" : `Collected ${e.ageDays}d ago`}{e.stale && <span className="font-semibold ml-1" style={{ color: C.amber }}>STALE</span>}</span>
        <span className="capitalize">{e.independence} independence</span>
      </div>
      {editable ? (
        <div className="flex items-center gap-3 mt-1.5">
          <button className="flex items-center gap-1 text-[10.5px]" style={{ color: C.muted }} onClick={() => onEdit(e)}><Pencil size={10} /> Edit</button>
          <button className="flex items-center gap-1 text-[10.5px]" style={{ color: C.red }} onClick={() => onDelete(e)}><Trash2 size={10} /> Delete</button>
        </div>
      ) : (
        <div className="mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded inline-block" style={{ background: C.panel2, color: C.muted }}>REFERENCE</div>
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
    <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="grid grid-cols-2 gap-2">
        <div>{fieldLabel("Source")}<input style={inputStyle()} value={form.source} onChange={set("source")} placeholder="e.g. Vanta, Auditor name" /></div>
        <div>{fieldLabel("Evidence type")}
          <select style={inputStyle()} value={form.evidenceType} onChange={set("evidenceType")}>
            {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Result")}
          <select style={inputStyle()} value={form.result} onChange={set("result")}>
            {EVIDENCE_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Independence")}
          <select style={inputStyle()} value={form.independence} onChange={set("independence")}>
            {INDEPENDENCE_LEVELS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Coverage %")}<input type="number" min={0} max={100} style={inputStyle()} value={form.coveragePct} onChange={set("coveragePct")} /></div>
        <div />
        <div>{fieldLabel("Exceptions (optional)")}<input type="number" min={0} style={inputStyle()} value={form.exceptions} onChange={set("exceptions")} /></div>
        <div>{fieldLabel("Population (optional)")}<input type="number" min={0} style={inputStyle()} value={form.population} onChange={set("population")} /></div>
      </div>
      <div className="mt-2">{fieldLabel("Note")}<input style={inputStyle()} value={form.note} onChange={set("note")} placeholder="Optional context" /></div>
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
        <div>{fieldLabel(level ? `Assessor rating for ${level}` : "Assessor rating")}
          <select style={inputStyle()} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {COMPLIANCE_RATINGS.map((r) => <option key={r} value={r}>{r} — {COMPLIANCE_LABELS[r]}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Assessed by")}<input style={inputStyle()} value={assessedBy} onChange={(e) => setAssessedBy(e.target.value)} placeholder="Your name" /></div>
      </div>
      <div className="mt-2">{fieldLabel("Rationale (required)")}<input style={inputStyle()} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why does this differ from the derived rating?" /></div>
      <div className="flex items-center gap-2 mt-3">
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: ready ? C.accent : C.border, color: "#fff" }}
          disabled={!ready}
          onClick={() => onSubmit({ rating, note: note.trim(), assessedBy: assessedBy.trim() })}
        >
          Save
        </button>
        <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const EMPTY_FINDING_FORM = {
  title: "", detail: "", assetId: "", severity: "medium", source: "",
  ownerId: "", remediationStatus: "Planned", due: "", remediationPlan: "", remediationOwnerId: "", targetDate: "",
};

function FindingForm({ assetOptions, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    ...EMPTY_FINDING_FORM,
    assetId: assetOptions[0]?.assetId ?? "",
    ownerId: ORGS[0]?.id ?? "",
    due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ready = form.title.trim() && form.assetId && form.ownerId && form.remediationStatus && form.due;

  return (
    <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div>{fieldLabel("Title")}<input style={inputStyle()} value={form.title} onChange={set("title")} placeholder="What was found" /></div>
      <div className="mt-2">{fieldLabel("Detail (optional)")}<input style={inputStyle()} value={form.detail} onChange={set("detail")} placeholder="What's actually wrong" /></div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>{fieldLabel("Asset")}
          <select style={inputStyle()} value={form.assetId} onChange={set("assetId")}>
            {assetOptions.map((a) => <option key={a.assetId} value={a.assetId}>{a.label}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Severity")}
          <select style={inputStyle()} value={form.severity} onChange={set("severity")}>
            {FINDING_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Source")}
          <select style={inputStyle()} value={form.source} onChange={set("source")}>
            <option value="">control-gap (default)</option>
            {FINDING_SOURCES.filter((s) => s !== "control-gap").map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Owner")}
          <select style={inputStyle()} value={form.ownerId} onChange={set("ownerId")}>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Remediation status")}
          <select style={inputStyle()} value={form.remediationStatus} onChange={set("remediationStatus")}>
            {REMEDIATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Due")}<input type="date" style={inputStyle()} value={form.due} onChange={set("due")} /></div>
        <div>{fieldLabel("Remediation owner (optional)")}
          <select style={inputStyle()} value={form.remediationOwnerId} onChange={set("remediationOwnerId")}>
            <option value="">Same as owner</option>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Target date (optional)")}<input type="date" style={inputStyle()} value={form.targetDate} onChange={set("targetDate")} /></div>
      </div>
      <div className="mt-2">{fieldLabel("Remediation plan (optional)")}<input style={inputStyle()} value={form.remediationPlan} onChange={set("remediationPlan")} placeholder="What will fix this" /></div>
      <div className="flex items-center gap-2 mt-3">
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: ready ? C.accent : C.border, color: "#fff" }}
          disabled={!ready}
          onClick={() => onSubmit({
            title: form.title.trim(),
            detail: form.detail.trim(),
            assetId: form.assetId,
            severity: form.severity || undefined,
            source: form.source || undefined,
            ownerId: form.ownerId,
            remediationStatus: form.remediationStatus,
            due: form.due,
            remediationPlan: form.remediationPlan.trim() || undefined,
            remediationOwnerId: form.remediationOwnerId || undefined,
            targetDate: form.targetDate || undefined,
          })}
        >
          Create finding
        </button>
        <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const STEPS = [
  { id: "requirement", label: "Requirement", icon: BookOpenText },
  { id: "implementation", label: "Implementation Coverage", icon: Layers },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "assessment", label: "Assessment", icon: Gauge },
  { id: "findings", label: "Findings & Remediation", icon: Wrench },
];

// Full-space operator panel for a single control row, organized as the
// workflow an operator actually follows: understand the requirement, review
// how it's implemented, review the evidence behind that, record an
// assessment, then track findings/remediation — one step at a time down a
// left rail, mirroring the Add System panel's shape. Every write goes
// through the same dry-run-then-save path as that wizard: mutate a
// RuntimeFacts copy, validate it with buildLiveEngine, and only persist +
// reload once that comes back clean.
export function ControlEvaluationPanel({ row, system, onClose }) {
  const [activeStep, setActiveStep] = useState("requirement");
  const [attachingEvidence, setAttachingEvidence] = useState(false);
  const [editingEvidenceId, setEditingEvidenceId] = useState(null);
  const [overridingLevel, setOverridingLevel] = useState(null);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [showMaturityDetails, setShowMaturityDetails] = useState(false);
  const [creatingFinding, setCreatingFinding] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (!row) return null;

  const governingPolicy = POLICY_BY_CONTROL[row.control.id];
  const drawerClauses = row.control.frameworks.filter((f) => system.standards.includes(f.standard));
  const statusMeta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const implMeta = IMPLEMENTATION_META.find((m) => m.type === row.control.implementationType);
  const controlFindings = findingsForSystem(system.id).filter((f) => f.controlId === row.control.id);
  const urgentRemediation = mostUrgentRemediation(controlFindings);
  const worstEntry = worstLevelEntry(row.assessment);
  const worst = worstEntry?.[1] ?? null;
  const isProgramScoped = row.keyControl?.scope === "program";
  const programApplicability = isProgramScoped ? resolveProgramApplicability(system.id, row.control.id) : null;
  const evidenceHealth = evidenceHealthForRow(row);
  const assetOptions = row.instances.length > 0
    ? row.instances.map((inst) => ({ assetId: inst.assetId, label: assetName(system, inst.assetId) }))
    : assetsForSystem(system.id).map((a) => ({ assetId: a.id, label: a.name }));
  // A single evidence record can cover many assets at once (assetIds: [...]),
  // so it appears once per instance here — the same e.id repeats, and needs a
  // per-instance key of its own rather than e.id alone.
  const allEvidence = row.instances.flatMap((inst) => inst.evidence.map((e) => ({ ...e, key: `${e.id}::${inst.assetId}`, assetLabel: assetName(system, inst.assetId), governing: inst.governing?.id === e.id })));
  const linkedPrinciples = principlesForControl(row.control.id);

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

  function handleCreateFinding(draft) {
    saveMutation((existing) => addFinding(existing, { ...draft, controlId: row.control.id }));
  }

  return (
    <Modal open onClose={onClose} width={1180} height={840}>
      {/* ---- Header ---- */}
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
            <GlancePill Icon={Gauge} label="Assurance" value={row.score != null ? `${row.score}${row.assessment?.band?.label ? ` · ${row.assessment.band.label}` : ""}` : "—"} />
          </div>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "220px 1fr" }}>
        {/* ---- Step rail ---- */}
        <nav className="p-3 overflow-y-auto" style={{ borderRight: `1px solid ${C.border}`, background: C.panel2 }}>
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === activeStep;
            const badge = s.id === "evidence" ? allEvidence.length
              : s.id === "findings" ? controlFindings.length
              : null;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className="w-full text-left flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 mb-1 transition-colors"
                style={{ background: isActive ? C.accentBg : "transparent" }}
              >
                <Icon size={15} color={isActive ? C.accent : C.muted} className="shrink-0" />
                <span className="text-[12.5px] font-semibold flex-1" style={{ color: isActive ? C.accent : C.ink }}>{s.label}</span>
                {badge != null && badge > 0 && (
                  <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: C.panel, color: C.muted }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ---- Content pane ---- */}
        <div className="p-6 overflow-y-auto">
          {saveError && (
            <div className="rounded-lg p-3 mb-4" style={{ background: C.redBg, border: `1px solid ${C.red}4D` }}>
              <div className="text-xs font-semibold mb-1" style={{ color: C.red }}>Couldn't save — the change would leave the assessment inconsistent:</div>
              <ul className="list-disc pl-4">
                {saveError.map((p, i) => <li key={i} className="text-[11px]" style={{ color: C.red }}>{typeof p === "string" ? p : p.message}</li>)}
              </ul>
            </div>
          )}

          {/* ===== Requirement ===== */}
          {activeStep === "requirement" && (
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ background: C.panel2 }}>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>SCF Control Description</div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.control.description}</div>
              </div>

              {row.control.toolHint && (
                <div className="rounded-lg p-3" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Enforced By</div>
                  <div className="text-sm" style={{ color: C.ink }}>{row.control.toolHint}</div>
                </div>
              )}

              {governingPolicy && (
                <div className="rounded-lg p-3" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Governing Policy</div>
                  <div className="text-sm" style={{ color: C.ink }}>{governingPolicy.code} · {governingPolicy.title}</div>
                </div>
              )}

              <div>
                <SectionLabel>Framework Clauses Satisfied ({system.standards.join(", ")})</SectionLabel>
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

              {linkedPrinciples.length > 0 && (
                <div>
                  <SectionLabel>Linked Assurance Practices</SectionLabel>
                  <div className="space-y-1.5">
                    {linkedPrinciples.map((p) => (
                      <div key={`${p.domainTitle}-${p.id}`} className="rounded-lg p-2.5" style={{ background: C.panel2 }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[9.5px] uppercase tracking-wide" style={{ color: C.muted }}>{p.domainTitle}</span>
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded ml-auto"
                            style={{ background: p.status === "operationalized" ? C.greenBg : p.status === "partial" ? C.amberBg : C.redBg, color: p.status === "operationalized" ? C.green : p.status === "partial" ? C.amber : C.red }}
                          >
                            {PRINCIPLE_STATUS_META[p.status]?.label ?? p.status}
                          </span>
                        </div>
                        <div className="text-xs mt-1" style={{ color: C.ink }}>{p.statement}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== Implementation Coverage ===== */}
          {activeStep === "implementation" && (
            <div>
              {isProgramScoped ? (
                <div className="rounded-lg p-4" style={{ border: `1px solid ${C.border}` }}>
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
                    <div className="text-[11px] mb-3 leading-snug" style={{ color: C.muted }}>
                      Applies because: {applicabilityRationales[0]}
                    </div>
                  )}
                  <div className="space-y-4">
                    {groupInstancesByLayer(row.instances, system.id).map(([layerLabel, insts]) => (
                      <div key={layerLabel}>
                        <SectionLabel>{layerLabel}</SectionLabel>
                        <div className="space-y-1.5">
                          {insts.map((inst) => {
                            const instMeta = INSTANCE_STATUS_META[inst.status];
                            const label = inst.status === "undetermined" ? "Missing Evidence" : instMeta?.label ?? inst.status;
                            return (
                              <div key={`${inst.assetId}-${inst.controlId}`} className="rounded-lg px-3 py-2.5" style={{ background: C.panel2 }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold flex-1" style={{ color: C.ink }}>{assetName(system, inst.assetId)}</span>
                                  <span className="text-[10px] font-semibold px-2 py-1 rounded shrink-0" style={{ background: C[`${instMeta?.color}Bg`] ?? C.panel, color: C[instMeta?.color] ?? C.muted }}>
                                    {label}
                                  </span>
                                </div>
                                <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{inst.statement}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {applicabilityRationales.length > 1 && (
                    <div className="text-[11px] mt-3 leading-snug" style={{ color: C.muted }}>
                      Applies for different reasons per asset: {applicabilityRationales.join(" · ")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm" style={{ color: C.muted }}>No in-scope assets carry this control.</div>
              )}
            </div>
          )}

          {/* ===== Evidence ===== */}
          {activeStep === "evidence" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: evidenceHealth.bg, color: evidenceHealth.color }}>
                  {evidenceHealth.label}
                </span>
                {!attachingEvidence && (
                  <button
                    className="ml-auto flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ background: C.accentBg, color: C.accent }}
                    onClick={() => { setAttachingEvidence(true); setEditingEvidenceId(null); }}
                  >
                    <Plus size={11} /> Add Evidence
                  </button>
                )}
              </div>
              {allEvidence.length > 0 ? (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {allEvidence.map((e) => (
                    editingEvidenceId === e.id ? (
                      <div key={e.key} style={{ gridColumn: "1 / -1" }}>
                        <EvidenceForm
                          initial={{ ...e, exceptions: e.exceptions ?? "", population: e.population ?? "" }}
                          assetOptions={assetOptions}
                          isProgramScoped={isProgramScoped}
                          onCancel={() => setEditingEvidenceId(null)}
                          onSubmit={(patch) => handleUpdateEvidence(e.id, patch)}
                        />
                      </div>
                    ) : (
                      <EvidenceCard
                        key={e.key}
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
                <div className="mt-2">
                  <EvidenceForm
                    assetOptions={assetOptions}
                    isProgramScoped={isProgramScoped}
                    onCancel={() => setAttachingEvidence(false)}
                    onSubmit={(draft) => handleAttachEvidence(draft)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ===== Assessment ===== */}
          {activeStep === "assessment" && (
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                    <statusMeta.Icon size={13} /> {statusMeta.label}
                  </span>
                  <span className="ml-auto"><BasisTag basis={row.basis} /></span>
                </div>
                <div>
                  {fieldLabel("Assessment rationale")}
                  <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
                    {worst ? worst.rationale : row.explanation}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    {fieldLabel("Control owner")}
                    <div className="text-xs" style={{ color: C.ink }}>{(row.assessment?.owners ?? []).length > 0 ? row.assessment.owners.map((o) => o.name).join(", ") : "Unassigned"}</div>
                  </div>
                  <div>
                    {fieldLabel("Evidence confidence")}
                    <div className="text-xs font-semibold" style={{ color: evidenceHealth.color }}>{evidenceHealth.label}</div>
                  </div>
                </div>

                {!showAssessmentForm ? (
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg mt-4"
                    style={{ background: C.accent, color: "#fff" }}
                    onClick={() => setShowAssessmentForm(true)}
                  >
                    Save Assessment
                  </button>
                ) : (
                  <div className="mt-4">
                    <OverrideForm
                      level={null}
                      current={worst}
                      onCancel={() => setShowAssessmentForm(false)}
                      onSubmit={(o) => { setShowAssessmentForm(false); handleOverride(worstEntry[0], o); }}
                    />
                    <div className="text-[10.5px] mt-1.5 leading-snug" style={{ color: C.muted }}>
                      Applies to the {worstEntry?.[0]} lane — the one currently holding this control's score down.
                    </div>
                  </div>
                )}
              </div>

              {row.assessment?.assessed && (
                <div>
                  <SectionLabel icon={Gauge}>PRISMA Scoring</SectionLabel>
                  <div className="grid grid-cols-5 gap-2">
                    {PRISMA_LEVELS.map((level) => {
                      const L = row.assessment.levels[level];
                      return (
                        <div key={level} className="rounded-lg p-2.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                          <div className="text-[10px] font-semibold" style={{ color: C.muted }}>{level}</div>
                          <div className="text-lg font-semibold tabular-nums mt-0.5" style={{ color: ratingColor(L.rating), fontFamily: "'IBM Plex Mono', monospace" }}>{L.rating}</div>
                          <div className="text-[9.5px] mt-0.5 leading-tight" style={{ color: C.muted }}>{COMPLIANCE_LABELS[L.rating]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: C.accent }}
                onClick={() => setShowMaturityDetails((v) => !v)}
              >
                {showMaturityDetails ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                View maturity scoring details
              </button>

              {showMaturityDetails && row.assessment?.assessed && (
                <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
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
            </div>
          )}

          {/* ===== Findings & Remediation ===== */}
          {activeStep === "findings" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {urgentRemediation && (
                  <GlancePill
                    Icon={Wrench}
                    label="Most urgent"
                    value={urgentRemediation}
                    color={C[FINDING_REMEDIATION_STATUS_META[urgentRemediation]?.color] ?? C.ink}
                  />
                )}
                {!creatingFinding && (
                  <button
                    className="ml-auto flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ background: C.accentBg, color: C.accent }}
                    onClick={() => setCreatingFinding(true)}
                  >
                    <Plus size={11} /> Create Finding
                  </button>
                )}
              </div>

              {creatingFinding && (
                <div className="mb-3">
                  <FindingForm
                    assetOptions={assetOptions}
                    onCancel={() => setCreatingFinding(false)}
                    onSubmit={handleCreateFinding}
                  />
                </div>
              )}

              {controlFindings.length > 0 ? (
                <div className="space-y-3">
                  {controlFindings.map((f) => {
                    const remMeta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus];
                    const severityMetaF = FINDING_SEVERITY_META[f.severity];
                    return (
                      <div key={f.id} className="rounded-lg p-3" style={{ background: C.panel2 }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: C.ink }}>{f.title}</span>
                          {severityMetaF && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: C.panel, color: C.muted }}>{severityMetaF.label}</span>
                          )}
                          {remMeta && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={remediationBadgeStyle(remMeta.color)}>{remMeta.label}</span>
                          )}
                        </div>
                        {f.detail && (
                          <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{f.detail}</div>
                        )}
                        <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                          {assetName(system, f.assetId)}
                          {f.source && f.source !== "control-gap" && ` · Source: ${f.source.replace(/-/g, " ")}`}
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
                              <div className="mt-1 space-y-1">
                                {f.closureEvidenceIds.map((id) => {
                                  const ev = getEvidence(id);
                                  return ev ? <EvidenceCard key={id} e={ev} readOnly /> : null;
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm" style={{ color: C.muted }}>No open findings for this control.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
