import React, { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Link2, BookOpenText, Layers, FileCheck2, Wrench, Gauge, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Check, ScrollText, Network, ClipboardCheck,
} from "lucide-react";
import { C } from "../../theme";
import {
  PRISMA_LEVELS, COMPLIANCE_LABELS, findingsForSystem,
  FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META, FINDING_SEVERITIES, FINDING_SOURCES, REMEDIATION_STATUSES,
  INSTANCE_STATUS_META,
  EVIDENCE_TYPES, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS,
  EVIDENCE_COLLECTOR_TYPES, ARTIFACT_SENSITIVITIES, EVIDENCE_REVIEW_DECISIONS,
  getEvidence, getEvidenceArtifacts, getEvidenceReviews, resolveProgramApplicability, assetsForSystem, getDataFlows, ORGS,
  evaluateControl, addPrismaOverride, updateEvidence, removeEvidence, addFinding, updateFinding, commitRuntimeFacts,
} from "../../engine";
import { upsertControlReview } from "../../engine/runtimeMutations";
import { PrismaLaneGrader } from "./PrismaLaneGrader";
import type { LaneGrade } from "./PrismaLaneGrader";
import { RecordAssessmentSection } from "./recordAssessment";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { PRINCIPLE_DOMAINS, STATUS_META as PRINCIPLE_STATUS_META } from "../../data/securityPrinciples";
import { STATUS_META, IMPLEMENTATION_META, RESPONSIBILITY_META, ratingColor, assetName, evidenceHealthForRow } from "./controlMeta";
import { POLICY_BY_CONTROL, PROCEDURE_BY_CONTROL } from "./policyLookup";
import { BasisTag } from "../../components/BasisTag";
import Modal, { ModalCloseButton } from "../../components/Modal";
import { fieldLabel, inputStyle, selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";
import type { ControlAssessment, ControlEvidenceDraft, ControlInstance, EvidenceDraft, EngineFinding, FindingDraft, LevelRating, ScoredEvidence } from "../../engine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { AssetId, ControlId, EvidenceId, FindingId, SystemId } from "../../graph/ids";
import type { ComplianceRating, EvidenceType, PrismaLevel } from "../../graph/nodes/taxonomy";
import type { EvidenceCollectorType, EvidenceResult, IndependenceLevel } from "../../graph/nodes/evidence";
import type { ArtifactSensitivity, EvidenceReviewDecision } from "../../graph/nodes/evidenceProvenance";
import type { FindingSeverity, FindingSource, RemediationStatus } from "../../graph/nodes/findings";
import type { SecurityPrinciple } from "../../data/securityPrinciples";
import type { ControlMatrixRow, WorkspaceSystem } from "./types";

function themeColor(key?: string): string {
  if (key === "green" || key === "amber" || key === "red" || key === "accent" || key === "muted" || key === "ink" || key === "na") return C[key];
  return C.muted;
}

function themeBackground(key?: string): string {
  if (key === "green") return C.greenBg;
  if (key === "amber") return C.amberBg;
  if (key === "red") return C.redBg;
  if (key === "accent") return C.accentBg;
  return C.panel2;
}

// The single worst-rated PRISMA lane, paired with its level name — the
// bottleneck that a one-click "Save Assessment" acts on, and the sentence
// that answers "why isn't this Satisfied" when no finding has been filed yet
// to answer it more concretely.
function worstLevelEntry(assessment: ControlAssessment | null): [PrismaLevel, LevelRating] | null {
  if (!assessment?.assessed) return null;
  return PRISMA_LEVELS
    .map((level): [PrismaLevel, LevelRating] => [level, assessment.levels[level]])
    .sort((a, b) => a[1].rating - b[1].rating)[0] ?? null;
}

// Which architecture layer each asset sits in, reusing the exact same
// request-path classification the Architecture tab's data-flow diagram
// already derives (engine/rollups.ts's flowLayoutForSystem, via
// getDataFlows) — not a second taxonomy invented for this panel. Labels
// match DataMap.jsx's stageLabel()/section headers verbatim so a control's
// coverage groups the same way an operator already reads the Architecture
// tab.
function assetLayerMap(systemId: SystemId): Partial<Record<AssetId, string>> {
  const layout = getDataFlows(systemId);
  const map: Partial<Record<AssetId, string>> = {};
  layout.stages.forEach((s) => {
    const label = s.depth === 0 ? "Web Ingress" : `Stage ${s.depth}`;
    s.nodes.forEach((n) => { map[n.id] = label; });
  });
  layout.dataPlane.forEach((d) => { map[d.asset.id] = "Data Plane"; });
  layout.egress.forEach((e) => { map[e.asset.id] = "Web Egress"; });
  layout.softwareDeployment.forEach((s) => { map[s.asset.id] = "Software Deployment"; });
  layout.workforceIngress.forEach((w) => { map[w.asset.id] = "Ingress - Workforce"; });
  layout.backupRecovery.forEach((b) => { map[b.asset.id] = "Backup & Restore"; });
  layout.branches.forEach((b) => { map[b.asset.id] = "Control Plane"; });
  return map;
}

const LAYER_RANK = {
  "Web Ingress": 0, "Data Plane": 1000, "Web Egress": 1001,
  "Control Plane": 1002, "Software Deployment": 1003, "Ingress - Workforce": 1004,
  "Backup & Restore": 1005,
  Unmapped: 9999,
};
function layerRank(label: string): number {
  const fixedRank = Object.entries(LAYER_RANK).find(([key]) => key === label)?.[1];
  if (fixedRank != null) return fixedRank;
  const stage = /^Stage (\d+)$/.exec(label);
  return stage ? 1 + Number(stage[1]) : 9998;
}

// Groups a control's per-asset instances by architecture layer, sorted
// Web Ingress -> Stage 1..N -> Data Plane -> Web Egress -> Control Plane ->
// Software Deployment -> Ingress - Workforce -> Unmapped (assets with no
// data-flow edges recorded, e.g. isolated stores) last rather than dropped.
function groupInstancesByLayer(instances: ControlInstance[], systemId: SystemId): Array<[string, ControlInstance[]]> {
  const layerMap = assetLayerMap(systemId);
  const groups: Record<string, ControlInstance[]> = {};
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
function principlesForControl(controlId: ControlId): Array<SecurityPrinciple & { domainTitle: string }> {
  const out: Array<SecurityPrinciple & { domainTitle: string }> = [];
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
const REMEDIATION_URGENCY = ["Blocked", "In Progress", "Planned", "Complete"] as const satisfies readonly RemediationStatus[];
function mostUrgentRemediation(findings: EngineFinding[]): RemediationStatus | null {
  if (findings.length === 0) return null;
  return REMEDIATION_URGENCY.find((s) => findings.some((f) => f.remediationStatus === s)) ?? findings[0].remediationStatus;
}

function remediationBadgeStyle(colorKey: string): CSSProperties {
  return { background: themeBackground(colorKey), color: themeColor(colorKey) };
}

function GlancePill({ Icon, label, value, color }: { Icon: LucideIcon; label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <Icon size={12} color={C.muted} className="shrink-0" />
      <span className="text-[9.5px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: color ?? C.ink }}>{value}</span>
    </div>
  );
}

function SectionLabel({ icon: Icon, children, action }: { icon?: LucideIcon; children: ReactNode; action?: ReactNode }) {
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
function isRuntimeEvidence(evidenceId: EvidenceId): boolean {
  return evidenceId.startsWith("EVD-USR-");
}

// Compact evidence card: source, result, coverage, freshness, independence at
// a glance, with edit/delete for records this panel itself added, and the
// full provenance drill-down (collection details, artifact integrity, review
// decision) behind a toggle — this absorbed the retired Evidence step's
// table, so the lane list is the panel's only evidence surface.
function EvidenceCard({ e, assetLabel, governing, onEdit, onDelete, readOnly }: {
  e: ScoredEvidence;
  assetLabel?: string;
  governing?: boolean;
  onEdit?: (evidence: ScoredEvidence) => void;
  onDelete?: (evidence: ScoredEvidence) => void;
  readOnly?: boolean;
}) {
  const [showProvenance, setShowProvenance] = useState(false);
  const editable = !readOnly && isRuntimeEvidence(e.id);
  const artifacts = getEvidenceArtifacts(e.id);
  const reviews = getEvidenceReviews(e.id);
  const latestReview = reviews.at(-1);
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
      <div className="flex items-center gap-3 mt-1.5">
        <button
          className="flex items-center gap-1 text-[10.5px] font-semibold"
          style={{ color: latestReview?.decision === "accepted" ? C.green : latestReview?.decision === "rejected" ? C.red : C.muted }}
          onClick={() => setShowProvenance((open) => !open)}
        >
          {showProvenance ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {latestReview ? latestReview.decision.replace("-", " ") : "Needs review"}
          <span className="font-normal" style={{ color: C.muted }}>
            &middot; {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"} &middot; {e.collectorType ?? e.independence}
          </span>
        </button>
        {editable ? (
          <>
            <button className="flex items-center gap-1 text-[10.5px] ml-auto" style={{ color: C.muted }} onClick={() => onEdit?.(e)}><Pencil size={10} /> Edit</button>
            <button className="flex items-center gap-1 text-[10.5px]" style={{ color: C.red }} onClick={() => onDelete?.(e)}><Trash2 size={10} /> Delete</button>
          </>
        ) : (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded ml-auto" style={{ background: C.panel2, color: C.muted }}>REFERENCE</span>
        )}
      </div>
      {showProvenance && (
        <div className="grid grid-cols-3 gap-4 text-[10.5px] mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <div>
            <SectionLabel>Collection</SectionLabel>
            <div style={{ color: C.ink }}>{e.collectorIdentity ?? "Collector identity not recorded"}</div>
            <div style={{ color: C.muted }}>{e.collectionRunId ?? "No run ID"}{e.methodVersion ? ` · ${e.methodVersion}` : ""}</div>
            <div style={{ color: C.muted }}>{e.periodStart && e.periodEnd ? `${e.periodStart.slice(0, 10)} to ${e.periodEnd.slice(0, 10)}` : "Coverage period not recorded"}</div>
          </div>
          <div>
            <SectionLabel>Artifact integrity</SectionLabel>
            {artifacts.length > 0 ? artifacts.map((artifact) => (
              <div key={artifact.id} className="mb-1">
                <div style={{ color: C.ink }}>{artifact.name} · v{artifact.version}</div>
                <div className="font-mono truncate" title={artifact.sha256} style={{ color: C.muted }}>SHA-256 {artifact.sha256.slice(0, 14)}…</div>
                <div style={{ color: C.muted }}>{artifact.sensitivity} · retained at {artifact.storageRef}</div>
              </div>
            )) : <div style={{ color: C.muted }}>No retained artifact metadata</div>}
          </div>
          <div>
            <SectionLabel>Review</SectionLabel>
            {latestReview ? (
              <>
                <div className="font-semibold capitalize" style={{ color: latestReview.decision === "accepted" ? C.green : latestReview.decision === "rejected" ? C.red : C.amber }}>{latestReview.decision.replace("-", " ")}</div>
                <div style={{ color: C.ink }}>{latestReview.reviewer} · {latestReview.reviewedAt.slice(0, 10)}</div>
                <div style={{ color: C.muted }}>{latestReview.comments ?? "No review comments"}</div>
              </>
            ) : <div style={{ color: C.amber }}>No review decision recorded</div>}
          </div>
        </div>
      )}
    </div>
  );
}

interface EvidenceFormState {
  source: string;
  evidenceType: EvidenceType;
  result: EvidenceResult;
  coveragePct: number | string;
  exceptions: number | string;
  population: number | string;
  independence: IndependenceLevel;
  note: string;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  collectorType: EvidenceCollectorType;
  collectorIdentity: string;
  collectionRunId: string;
  methodVersion: string;
  sourceConfigurationVersion: string;
  artifactName: string;
  artifactMediaType: string;
  artifactStorageRef: string;
  artifactSha256: string;
  artifactSensitivity: ArtifactSensitivity;
  reviewer: string;
  reviewDecision: EvidenceReviewDecision;
  reviewComments: string;
  reviewValidThrough: string;
  reviewIndependenceDeclared: boolean;
}

const EMPTY_EVIDENCE_FORM: EvidenceFormState = {
  source: "", evidenceType: EVIDENCE_TYPES[0], result: "pass", coveragePct: 100,
  exceptions: "", population: "", independence: "automated", note: "",
  collectedAt: new Date().toISOString().slice(0, 10), periodStart: "", periodEnd: "",
  collectorType: "manual", collectorIdentity: "", collectionRunId: "", methodVersion: "", sourceConfigurationVersion: "",
  artifactName: "", artifactMediaType: "application/pdf", artifactStorageRef: "", artifactSha256: "", artifactSensitivity: "Confidential",
  reviewer: "", reviewDecision: "accepted", reviewComments: "", reviewValidThrough: "", reviewIndependenceDeclared: false,
};

interface EvidenceFormProps {
  initial?: Partial<EvidenceFormState> & { assetIds?: AssetId[] };
  assetOptions: AssetOption[];
  isProgramScoped: boolean;
  // Tags the record to a PRISMA lane (see RawEvidence.prismaLevel). Set by
  // the per-lane attach/edit flow; absent from the flat Evidence step, where
  // records keep whatever lane they already carry (Implemented by default).
  prismaLevel?: PrismaLevel;
  onCancel: () => void;
  onSubmit: (draft: ControlEvidenceDraft) => void;
}

function EvidenceForm({ initial, assetOptions, isProgramScoped, prismaLevel, onCancel, onSubmit }: EvidenceFormProps) {
  const [form, setForm] = useState<EvidenceFormState>({ ...EMPTY_EVIDENCE_FORM, ...initial });
  const [showProvenance, setShowProvenance] = useState(false);
  const [assetIds, setAssetIds] = useState<AssetId[]>(
    isProgramScoped ? [] : (initial?.assetIds ?? assetOptions.map((a) => a.assetId))
  );
  function setField<K extends keyof EvidenceFormState>(key: K, value: EvidenceFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const artifactReady = !form.artifactName.trim() || (
    Boolean(form.artifactStorageRef.trim()) && /^[a-f0-9]{64}$/i.test(form.artifactSha256.trim())
  );
  const reviewReady = !form.reviewer.trim() || form.reviewIndependenceDeclared;

  return (
    <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="grid grid-cols-2 gap-2">
        <div>{fieldLabel("Source")}<input style={inputStyle()} value={form.source} onChange={(e) => setField("source", e.target.value)} placeholder="e.g. Vanta, Auditor name" /></div>
        <div>{fieldLabel("Evidence type")}
          <select style={inputStyle()} value={form.evidenceType} onChange={(e) => setField("evidenceType", selectedValue(EVIDENCE_TYPES, e.target.value, form.evidenceType))}>
            {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Result")}
          <select style={inputStyle()} value={form.result} onChange={(e) => setField("result", selectedValue(EVIDENCE_RESULTS, e.target.value, form.result))}>
            {EVIDENCE_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Independence")}
          <select style={inputStyle()} value={form.independence} onChange={(e) => setField("independence", selectedValue(INDEPENDENCE_LEVELS, e.target.value, form.independence))}>
            {INDEPENDENCE_LEVELS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Coverage %")}<input type="number" min={0} max={100} style={inputStyle()} value={form.coveragePct} onChange={(e) => setField("coveragePct", e.target.value)} /></div>
        <div />
        <div>{fieldLabel("Exceptions (optional)")}<input type="number" min={0} style={inputStyle()} value={form.exceptions} onChange={(e) => setField("exceptions", e.target.value)} /></div>
        <div>{fieldLabel("Population (optional)")}<input type="number" min={0} style={inputStyle()} value={form.population} onChange={(e) => setField("population", e.target.value)} /></div>
      </div>
      <div className="mt-2">{fieldLabel("Note")}<input style={inputStyle()} value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Optional context" /></div>
      <button type="button" className="mt-2 text-[11px] font-semibold flex items-center gap-1" style={{ color: C.accent }} onClick={() => setShowProvenance((open) => !open)}>
        {showProvenance ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Collection, artifact &amp; review provenance
      </button>
      {showProvenance && (
        <div className="mt-2 rounded-lg p-3 space-y-3" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
          <div>
            <SectionLabel>Collection details</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <div>{fieldLabel("Collected date")}<input type="date" style={inputStyle()} value={form.collectedAt} onChange={(e) => setField("collectedAt", e.target.value)} /></div>
              <div>{fieldLabel("Collector type")}<select style={inputStyle()} value={form.collectorType} onChange={(e) => setField("collectorType", selectedValue(EVIDENCE_COLLECTOR_TYPES, e.target.value, form.collectorType))}>{EVIDENCE_COLLECTOR_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
              <div>{fieldLabel("Period start")}<input type="date" style={inputStyle()} value={form.periodStart} onChange={(e) => setField("periodStart", e.target.value)} /></div>
              <div>{fieldLabel("Period end")}<input type="date" style={inputStyle()} value={form.periodEnd} onChange={(e) => setField("periodEnd", e.target.value)} /></div>
              <div>{fieldLabel("Collector identity")}<input style={inputStyle()} value={form.collectorIdentity} onChange={(e) => setField("collectorIdentity", e.target.value)} placeholder="Connector, account, or person" /></div>
              <div>{fieldLabel("Collection run ID")}<input style={inputStyle()} value={form.collectionRunId} onChange={(e) => setField("collectionRunId", e.target.value)} /></div>
              <div>{fieldLabel("Method / script version")}<input style={inputStyle()} value={form.methodVersion} onChange={(e) => setField("methodVersion", e.target.value)} /></div>
              <div>{fieldLabel("Source config version")}<input style={inputStyle()} value={form.sourceConfigurationVersion} onChange={(e) => setField("sourceConfigurationVersion", e.target.value)} /></div>
            </div>
          </div>
          <div>
            <SectionLabel>Retained artifact (optional)</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <div>{fieldLabel("Artifact name")}<input style={inputStyle()} value={form.artifactName} onChange={(e) => setField("artifactName", e.target.value)} placeholder="report.pdf or snapshot.json" /></div>
              <div>{fieldLabel("Media type")}<input style={inputStyle()} value={form.artifactMediaType} onChange={(e) => setField("artifactMediaType", e.target.value)} /></div>
              <div>{fieldLabel("Immutable storage reference")}<input style={inputStyle()} value={form.artifactStorageRef} onChange={(e) => setField("artifactStorageRef", e.target.value)} placeholder="grc://evidence/..." /></div>
              <div>{fieldLabel("Sensitivity")}<select style={inputStyle()} value={form.artifactSensitivity} onChange={(e) => setField("artifactSensitivity", selectedValue(ARTIFACT_SENSITIVITIES, e.target.value, form.artifactSensitivity))}>{ARTIFACT_SENSITIVITIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
              <div className="col-span-2">{fieldLabel("SHA-256")}<input style={inputStyle()} value={form.artifactSha256} onChange={(e) => setField("artifactSha256", e.target.value)} placeholder="64-character hexadecimal digest" /></div>
            </div>
          </div>
          <div>
            <SectionLabel>Review decision (optional)</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <div>{fieldLabel("Reviewer")}<input style={inputStyle()} value={form.reviewer} onChange={(e) => setField("reviewer", e.target.value)} placeholder="Name or accountable team" /></div>
              <div>{fieldLabel("Decision")}<select style={inputStyle()} value={form.reviewDecision} onChange={(e) => setField("reviewDecision", selectedValue(EVIDENCE_REVIEW_DECISIONS, e.target.value, form.reviewDecision))}>{EVIDENCE_REVIEW_DECISIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
              <div>{fieldLabel("Valid through")}<input type="date" style={inputStyle()} value={form.reviewValidThrough} onChange={(e) => setField("reviewValidThrough", e.target.value)} /></div>
              <div className="col-span-2">{fieldLabel("Review comments")}<input style={inputStyle()} value={form.reviewComments} onChange={(e) => setField("reviewComments", e.target.value)} /></div>
              <label className="col-span-2 flex items-center gap-2 text-[10.5px]" style={{ color: C.ink }}>
                <input type="checkbox" checked={form.reviewIndependenceDeclared} onChange={(e) => setField("reviewIndependenceDeclared", e.target.checked)} />
                Reviewer declares any independence conflict has been considered and recorded.
              </label>
            </div>
          </div>
        </div>
      )}
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
            ...(prismaLevel ? { prismaLevel } : {}),
            evidenceType: form.evidenceType,
            result: form.result,
            coveragePct: Number(form.coveragePct) || 0,
            exceptions: form.exceptions === "" ? undefined : Number(form.exceptions),
            population: form.population === "" ? undefined : Number(form.population),
            independence: form.independence,
            note: form.note.trim() || undefined,
            collectedAt: form.collectedAt,
            periodStart: form.periodStart || undefined,
            periodEnd: form.periodEnd || undefined,
            ingestedAt: new Date().toISOString(),
            collectorType: form.collectorType,
            collectorIdentity: form.collectorIdentity.trim() || undefined,
            collectionRunId: form.collectionRunId.trim() || undefined,
            methodVersion: form.methodVersion.trim() || undefined,
            sourceConfigurationVersion: form.sourceConfigurationVersion.trim() || undefined,
            artifacts: form.artifactName.trim() ? [{
              name: form.artifactName.trim(), mediaType: form.artifactMediaType.trim() || "application/octet-stream",
              storageRef: form.artifactStorageRef.trim(), sha256: form.artifactSha256.trim().toLowerCase(),
              createdAt: new Date().toISOString(), ingestedAt: new Date().toISOString(), createdBy: form.collectorIdentity.trim() || "Manual upload",
              sensitivity: form.artifactSensitivity, version: "1",
            }] : undefined,
            review: form.reviewer.trim() ? {
              reviewer: form.reviewer.trim(), reviewedAt: new Date().toISOString(), decision: form.reviewDecision,
              comments: form.reviewComments.trim() || undefined, validThrough: form.reviewValidThrough || undefined,
              independenceDeclared: form.reviewIndependenceDeclared,
            } : undefined,
            assetIds,
          })}
          disabled={!form.source.trim() || !artifactReady || !reviewReady}
        >
          Save evidence
        </button>
        {!artifactReady && <span className="text-[10px]" style={{ color: C.red }}>An artifact needs an immutable storage reference and a 64-character SHA-256 digest.</span>}
        {!reviewReady && <span className="text-[10px]" style={{ color: C.red }}>A reviewer must complete the independence declaration.</span>}
        <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

interface FindingFormState {
  title: string;
  detail: string;
  assetId: string;
  severity: FindingSeverity;
  source: FindingSource | "";
  ownerId: string;
  remediationStatus: RemediationStatus;
  due: string;
  remediationPlan: string;
  remediationOwnerId: string;
  targetDate: string;
}

const EMPTY_FINDING_FORM: FindingFormState = {
  title: "", detail: "", assetId: "", severity: "medium", source: "",
  ownerId: "", remediationStatus: "Planned", due: "", remediationPlan: "", remediationOwnerId: "", targetDate: "",
};

interface FindingFormProps {
  initial?: Partial<FindingFormState>;
  assetOptions: AssetOption[];
  onCancel: () => void;
  onSubmit: (draft: Omit<FindingDraft, "controlId">) => void;
}

function FindingForm({ initial, assetOptions, onCancel, onSubmit }: FindingFormProps) {
  const [form, setForm] = useState<FindingFormState>({
    ...EMPTY_FINDING_FORM,
    assetId: assetOptions[0]?.assetId ?? "",
    ownerId: ORGS[0]?.id ?? "",
    due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    ...initial,
  });
  function setField<K extends keyof FindingFormState>(key: K, value: FindingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const ready = form.title.trim() && form.assetId && form.ownerId && form.remediationStatus && form.due;

  function submitFinding() {
    const asset = assetOptions.find((option) => option.assetId === form.assetId);
    const owner = ORGS.find((org) => org.id === form.ownerId);
    if (!asset || !owner) return;
    const remediationOwner = form.remediationOwnerId
      ? ORGS.find((org) => org.id === form.remediationOwnerId)
      : undefined;
    onSubmit({
      title: form.title.trim(), detail: form.detail.trim(), assetId: asset.assetId,
      severity: form.severity, source: form.source || undefined, ownerId: owner.id,
      remediationStatus: form.remediationStatus, due: form.due,
      remediationPlan: form.remediationPlan.trim() || undefined,
      remediationOwnerId: remediationOwner?.id, targetDate: form.targetDate || undefined,
    });
  }

  return (
    <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div>{fieldLabel("Title")}<input style={inputStyle()} value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="What was found" /></div>
      <div className="mt-2">{fieldLabel("Detail (optional)")}<input style={inputStyle()} value={form.detail} onChange={(e) => setField("detail", e.target.value)} placeholder="What's actually wrong" /></div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>{fieldLabel("Asset")}
          <select style={inputStyle()} value={form.assetId} onChange={(e) => setField("assetId", e.target.value)}>
            {assetOptions.map((a) => <option key={a.assetId} value={a.assetId}>{a.label}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Severity")}
          <select style={inputStyle()} value={form.severity} onChange={(e) => setField("severity", selectedValue(FINDING_SEVERITIES, e.target.value, form.severity))}>
            {FINDING_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Source")}
          <select style={inputStyle()} value={form.source} onChange={(e) => setField("source", e.target.value === "" ? "" : selectedValue(FINDING_SOURCES, e.target.value, form.source || "control-gap"))}>
            <option value="">control-gap (default)</option>
            {FINDING_SOURCES.filter((s) => s !== "control-gap").map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Owner")}
          <select style={inputStyle()} value={form.ownerId} onChange={(e) => setField("ownerId", e.target.value)}>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Remediation status")}
          <select style={inputStyle()} value={form.remediationStatus} onChange={(e) => setField("remediationStatus", selectedValue(REMEDIATION_STATUSES, e.target.value, form.remediationStatus))}>
            {REMEDIATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Due")}<input type="date" style={inputStyle()} value={form.due} onChange={(e) => setField("due", e.target.value)} /></div>
        <div>{fieldLabel("Remediation owner (optional)")}
          <select style={inputStyle()} value={form.remediationOwnerId} onChange={(e) => setField("remediationOwnerId", e.target.value)}>
            <option value="">Same as owner</option>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>{fieldLabel("Target date (optional)")}<input type="date" style={inputStyle()} value={form.targetDate} onChange={(e) => setField("targetDate", e.target.value)} /></div>
      </div>
      <div className="mt-2">{fieldLabel("Remediation plan (optional)")}<input style={inputStyle()} value={form.remediationPlan} onChange={(e) => setField("remediationPlan", e.target.value)} placeholder="What will fix this" /></div>
      <div className="flex items-center gap-2 mt-3">
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: ready ? C.accent : C.border, color: "#fff" }}
          disabled={!ready}
          onClick={submitFinding}
        >
          {initial ? "Save finding" : "Create finding"}
        </button>
        <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const STEPS = [
  { id: "requirements", label: "Control Requirements", icon: BookOpenText },
  { id: "scoring", label: "Scoring and Evidence", icon: Gauge },
  { id: "implementation", label: "Implementation Coverage", icon: Layers },
  { id: "findings", label: "Findings & Remediation", icon: Wrench },
] as const;
type EvaluationStep = (typeof STEPS)[number]["id"];

export interface WalkDomainProgress {
  domain: string;
  total: number;
  remaining: number;
}

// Everything the key-control walk (ControlAssessmentWalk) layers onto this
// panel: the domain rail with per-domain progress, the assessed-so-far strip,
// the reviewer of record, and the save/skip advance hooks. Absent for the
// standalone row-click open — the panel itself is identical either way, so
// the walk and the deep-dive can never drift into two different assessment
// UIs again.
export interface PanelWalkState {
  domains: WalkDomainProgress[];
  activeDomain: string;
  onSelectDomain: (domain: string) => void;
  decidedCount: number;
  initialTotal: number;
  reviewer: string;
  onReviewerChange: (value: string) => void;
  onRecorded: (rating: ComplianceRating, continueWalk: boolean) => void;
  onSkip: (() => void) | null;
}

interface ControlEvaluationPanelProps {
  row: ControlMatrixRow;
  system: WorkspaceSystem;
  onClose: () => void;
  walk?: PanelWalkState;
}

// Full-space operator panel for a single control row, organized as the
// workflow an operator actually follows: understand the requirement, review
// how it's implemented, review the evidence behind that, record an
// assessment, then track findings/remediation — one step at a time down a
// left rail, mirroring the Add System panel's shape. Every write goes
// through the same dry-run-then-save path as that wizard: mutate a
// RuntimeFacts copy, validate it with buildLiveEngine, and only persist +
// reload once that comes back clean.
export function ControlEvaluationPanel({
  row, system, onClose, walk,
}: ControlEvaluationPanelProps) {
  // Lands on Scoring and Evidence — the operator's stated job — with the
  // requirement context one step up the rail rather than in the way.
  const [activeStep, setActiveStep] = useState<EvaluationStep>("scoring");
  const [attachingLane, setAttachingLane] = useState<PrismaLevel | null>(null);
  const [editingLaneEvidenceId, setEditingLaneEvidenceId] = useState<EvidenceId | null>(null);
  const [showMaturityDetails, setShowMaturityDetails] = useState(false);
  const [creatingFinding, setCreatingFinding] = useState(false);
  const [editingFindingId, setEditingFindingId] = useState<FindingId | null>(null);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const liveEngine = useLiveEngine();
  const walkRemaining = walk ? walk.domains.reduce((sum, d) => sum + d.remaining, 0) : 0;
  const walkReviewerMissing = Boolean(walk) && !walk!.reviewer.trim();

  const governingPolicy = POLICY_BY_CONTROL[row.control.id];
  const governingProcedure = PROCEDURE_BY_CONTROL[row.control.id];
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
  const assessment = row.assessment;
  const assessed = Boolean(assessment?.assessed);
  const assetOptions = row.instances.length > 0
    ? row.instances.map((inst) => ({ assetId: inst.assetId, label: assetName(system, inst.assetId) }))
    : assetsForSystem(system.id).map((a) => ({ assetId: a.id, label: a.name }));
  // An unassessed control has no instances yet (assessment.ts only builds
  // them in scope), so recording a first fact needs the applicability-derived
  // asset list — the same population the walk queue itself is built from.
  const recordAssetOptions = (liveEngine.graph.assetsBySystem[system.id] ?? [])
    .filter((asset) => liveEngine.applicability.resolveApplicability(asset.id, row.control.id).required)
    .map((asset) => ({ assetId: asset.id, label: asset.name }));
  const assessorOfRecord = liveEngine.graph.assessmentScopeBySystem[system.id]?.assessor ?? "";
  // The record that governs an instance's status, so the lane list can badge
  // it. Program-scoped controls have no instances and never badged one in the
  // old flat table either, so their pool intentionally stays unmarked.
  const governingEvidenceIds = new Set(
    row.instances.map((inst) => inst.governing?.id).filter((id): id is EvidenceId => Boolean(id))
  );
  const linkedPrinciples = principlesForControl(row.control.id);
  const programReasons = programApplicability?.reasons ?? [];
  const laneEvidence = liveEngine.evidence.laneEvidenceForControl(system.id, row.control.id);

  // Every instance's applicability reasons are usually identical (the same
  // rule matched every asset the same way) — say it once at the section
  // level instead of repeating the same sentence per asset.
  const applicabilityRationales = [...new Set(
    row.instances.flatMap((inst) => (inst.applicability?.reasons ?? []).map((r) => r.rationale))
  )];

  function saveMutation(mutate: (existing: RuntimeFacts) => RuntimeFacts): boolean {
    setSaveError(null);
    const existing = loadRuntimeFacts();
    const runtime = mutate(existing);
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setSaveError(problems);
      return false;
    }
    setAttachingLane(null);
    setEditingLaneEvidenceId(null);
    setCreatingFinding(false);
    setEditingFindingId(null);
    return true;
  }

  function handleAttachEvidence(draft: ControlEvidenceDraft) {
    saveMutation((existing) => evaluateControl(existing, {
      systemId: system.id,
      controlId: row.control.id,
      evidenceEntries: [draft],
    }));
  }

  function handleUpdateEvidence(evidenceId: EvidenceId, patch: Partial<EvidenceDraft>) {
    saveMutation((existing) => updateEvidence(existing, evidenceId, patch));
  }

  function handleDeleteEvidence(evidenceId: EvidenceId) {
    saveMutation((existing) => removeEvidence(existing, evidenceId));
  }

  function handleLaneGrades({ grades, assessedBy, note, comment }: { grades: LaneGrade[]; assessedBy: string; note: string; comment: string }) {
    saveMutation((existing) => {
      let next = existing;
      grades.forEach((grade) => {
        if (grade.rating === grade.derived) return;
        next = addPrismaOverride(next, {
          systemId: system.id,
          controlId: row.control.id,
          level: grade.level,
          rating: grade.rating,
          note: note || comment,
          assessedBy,
          assessedAt: new Date().toISOString().slice(0, 10),
        });
      });
      return upsertControlReview(next, {
        systemId: system.id,
        controlId: row.control.id,
        bucket: "system-owned",
        stance: "confirm",
        note: comment,
        reviewedBy: assessedBy,
        reviewedAt: new Date().toISOString().slice(0, 10),
      });
    });
  }

  function handleCreateFinding(draft: Omit<FindingDraft, "controlId">) {
    saveMutation((existing) => addFinding(existing, { ...draft, controlId: row.control.id }, system.id));
  }

  function handleUpdateFinding(findingId: FindingId, patch: Omit<FindingDraft, "controlId">) {
    saveMutation((existing) => updateFinding(existing, findingId, patch));
  }

  return (
    <Modal open onClose={onClose} width={1180} height={840}>
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between px-6 py-4 gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{row.control.id} · {row.control.domain}</div>
            <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{row.control.name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
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

      {/* ---- Walk strip: overall progress + reviewer of record ---- */}
      {walk && (
        <div className="flex items-center gap-3 px-6 py-2.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
          <ClipboardCheck size={13} color={C.accent} className="shrink-0" />
          <span className="text-[10.5px] uppercase tracking-wide font-semibold shrink-0" style={{ color: C.muted }}>
            Assessed {walk.decidedCount} of {walk.initialTotal}
          </span>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
            <div
              className="h-full rounded-full"
              style={{
                background: C.accent,
                width: `${walk.initialTotal ? Math.round((walk.decidedCount / walk.initialTotal) * 100) : 0}%`,
                transition: "width 320ms ease",
              }}
            />
          </div>
          <span className="text-[10.5px] shrink-0" style={{ color: C.muted }}>Reviewer</span>
          <input
            value={walk.reviewer}
            onChange={(e) => walk.onReviewerChange(e.target.value)}
            className="rounded-lg px-2.5 py-1.5 text-[12px] shrink-0"
            style={{ background: C.panel, border: `1px solid ${walkReviewerMissing ? C.amber : C.border}`, color: C.ink, width: 190 }}
            placeholder="Assessor of record"
          />
        </div>
      )}

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "220px 1fr" }}>
        {/* ---- Rail: walk domains (walk mode only), then this control's steps ---- */}
        <nav className="p-3 overflow-y-auto" style={{ borderRight: `1px solid ${C.border}`, background: C.panel2 }}>
          {walk && (
            <>
              <div className="text-[9.5px] uppercase tracking-wide font-semibold px-2.5 pb-1.5" style={{ color: C.muted }}>Domains</div>
              {walk.domains.map((d) => {
                const isDone = d.remaining === 0;
                const isActive = d.domain === walk.activeDomain && !isDone;
                return (
                  <button
                    key={d.domain}
                    type="button"
                    onClick={() => { if (!isDone) walk.onSelectDomain(d.domain); }}
                    className="w-full rounded-lg px-2.5 py-2 mb-1 flex items-center gap-2 text-left"
                    style={{
                      background: isDone ? C.greenBg : isActive ? C.accentBg : "transparent",
                      cursor: isDone ? "default" : "pointer",
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: isDone ? C.green : isActive ? C.accent : C.border, color: isDone || isActive ? "#fff" : C.muted }}
                    >
                      {isDone ? <Check size={11} /> : <ClipboardCheck size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-semibold truncate" style={{ color: isDone ? C.green : isActive ? C.accent : C.ink }}>{d.domain}</span>
                      <span className="block text-[10px] mt-0.5" style={{ color: isDone ? C.green : isActive ? C.accent : C.muted }}>
                        {isDone ? `${d.total} decided` : `${d.remaining} of ${d.total} remaining`}
                      </span>
                    </span>
                  </button>
                );
              })}
              <div className="text-[9.5px] uppercase tracking-wide font-semibold px-2.5 pt-3 pb-1.5 mt-2" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
                This control
              </div>
            </>
          )}
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === activeStep;
            const badge = s.id === "findings" ? controlFindings.length : null;
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
                {saveError.map((problem, i) => <li key={i} className="text-[11px]" style={{ color: C.red }}>{problem}</li>)}
              </ul>
            </div>
          )}

          {/* ===== Control Requirements ===== */}
          {activeStep === "requirements" && (
            <div className="space-y-4">
              <div>
                <SectionLabel icon={BookOpenText}>Common Control Requirement</SectionLabel>
                <div className="rounded-lg p-4" style={{ background: C.panel2 }}>
                  <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.control.description}</div>
                </div>
              </div>

              {(governingPolicy || governingProcedure) && (
                <div>
                  <SectionLabel icon={ScrollText}>Policies and Procedures</SectionLabel>
                  <div className="space-y-2">
                    {governingPolicy && (
                      <div className="rounded-lg p-3" style={{ border: `1px solid ${C.border}` }}>
                        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Governing Policy</div>
                        <div className="text-sm" style={{ color: C.ink }}>{governingPolicy.code} · {governingPolicy.title}</div>
                      </div>
                    )}

                    {governingProcedure && (
                      <div className="rounded-lg p-3" style={{ border: `1px solid ${C.border}` }}>
                        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Governing Procedure</div>
                        <div className="text-sm" style={{ color: C.ink }}>{governingProcedure.procedure.code} · {governingProcedure.procedure.title}</div>
                        {governingProcedure.step && (
                          <div className="text-[11px] mt-1" style={{ color: C.muted }}>Step: {governingProcedure.step}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <SectionLabel icon={Network}>Framework Clauses Satisfied ({system.standards.join(", ")})</SectionLabel>
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

              <button
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: C.accent }}
                onClick={() => setShowMaturityDetails((v) => !v)}
              >
                {showMaturityDetails ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                View maturity scoring details
              </button>

              {showMaturityDetails && assessment?.assessed && (
                <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="space-y-2">
                    {PRISMA_LEVELS.map((level) => {
                      const L = assessment.levels[level];
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
                          </div>
                          <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>
                            {L.rating !== L.derived && <span className="font-semibold" style={{ color: C.amber }}>Overridden from {L.derived}. </span>}
                            {L.rationale}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {assessment.ladderInversions.length > 0 && (
                    <div className="text-[11px] mt-2" style={{ color: C.amber }}>
                      Rated above the level beneath it: {assessment.ladderInversions.join(", ")}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== Scoring and Evidence ===== */}
          {/* The step renders the same sections whether or not a fact exists,
              so the walk and the table open an identical page. Unassessed
              controls add a banner naming WHY every lane reads 0 (nobody has
              looked — the score is null, not zero), put the record-a-fact
              form first, and lock the grader and per-lane attach until the
              first fact commits. */}
          {activeStep === "scoring" && assessment && (
            <div className="space-y-4">
              {!assessed && (
                <div className="rounded-lg p-4" style={{ background: C.amberBg, border: `1px solid ${C.amber}55` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide shrink-0" style={{ background: C.amber, color: "#fff" }}>Not Assessed</span>
                    <span className="text-[13px] font-semibold" style={{ color: C.ink }}>The lanes below read 0 because nobody has assessed this control — not because it failed.</span>
                  </div>
                  <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: C.ink }}>
                    No fact is recorded for {row.control.id} on this boundary, so its score is null and every PRISMA lane sits at 0 — Not Assessed. Record an assessment below to derive real lane ratings and unlock grading and evidence.
                  </div>
                </div>
              )}

              {!assessed && (
                <div>
                  <SectionLabel icon={ClipboardCheck}>Record assessment</SectionLabel>
                  <RecordAssessmentSection
                    key={row.control.id}
                    systemId={system.id}
                    controlId={row.control.id}
                    isProgramScoped={Boolean(isProgramScoped)}
                    assetOptions={recordAssetOptions}
                    reviewer={walk ? walk.reviewer : assessorOfRecord}
                    showContinue={Boolean(walk)}
                    continueLabel={walk ? (walkRemaining === 1 ? "Save and finish" : "Save and continue") : "Save assessment"}
                    disabled={walkReviewerMissing}
                    onSaved={(rating, continueWalk) => walk?.onRecorded(rating, continueWalk)}
                  />
                  {walkReviewerMissing && (
                    <div className="text-[10.5px] mt-2" style={{ color: C.amber }}>
                      Enter the reviewer of record above before recording assessments.
                    </div>
                  )}
                </div>
              )}

              <>
                  <div>
                    <SectionLabel icon={Gauge}>PRISMA lanes</SectionLabel>
                    <p className="text-[11px] leading-snug mb-2" style={{ color: C.muted }}>
                      {assessed
                        ? "Derived ratings are suggestions. Accept them, or pick 0 / 25 / 50 / 75 / 100 on each lane."
                        : "Locked at 0 — Not Assessed. The lanes unlock once a fact is recorded above."}
                    </p>
                    <PrismaLaneGrader
                      levels={assessment.levels}
                      assessedBy={assessorOfRecord}
                      note=""
                      comment=""
                      disabled={!assessed}
                      onSubmit={handleLaneGrades}
                    />
                  </div>

                  {/* One evidence slot per PRISMA lane, in ladder order.
                      Implemented-lane records are the ones the engine samples
                      for scoring; records attached to the other four lanes
                      document that lane's claim (the policy PDF, the SOP
                      extract, the metric export, the review minutes) without
                      entering the implementation pool — see
                      RawEvidence.prismaLevel. */}
                  <div>
                    <SectionLabel icon={FileCheck2}>Evidence by lane</SectionLabel>
                    <p className="text-[11px] leading-snug mb-2" style={{ color: C.muted }}>
                      Substantiate each lane with an artifact — the policy document, the SOP extract, the test output, the metric, the review minutes. Implemented-lane records are sampled for scoring; the other lanes&rsquo; records document the claim behind the derived rating.
                    </p>
                    <div className="space-y-2">
                      {PRISMA_LEVELS.map((level, idx) => {
                        const L = assessment.levels[level];
                        const records = laneEvidence[level];
                        return (
                          <div key={level} className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                                style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-[12.5px] font-semibold" style={{ color: C.ink }}>{level}</span>
                              <span className="text-[11px] font-semibold tabular-nums" style={{ color: assessed ? ratingColor(L.rating) : C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
                                {assessed ? `${L.rating} — ${COMPLIANCE_LABELS[L.rating]}` : "0 — Not Assessed"}
                              </span>
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase"
                                style={records.length === 0 ? { background: C.amberBg, color: C.amber } : { background: C.greenBg, color: C.green }}
                              >
                                {records.length === 0 ? "None attached" : `${records.length} attached`}
                              </span>
                              {attachingLane !== level && (
                                <button
                                  className="ml-auto flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                                  style={assessed
                                    ? { background: C.accentBg, color: C.accent }
                                    : { background: C.panel, color: C.muted, border: `1px solid ${C.border}`, cursor: "not-allowed" }}
                                  disabled={!assessed}
                                  title={assessed ? undefined : "Record an assessment first"}
                                  onClick={() => { setAttachingLane(level); setEditingLaneEvidenceId(null); }}
                                >
                                  <Plus size={11} /> Attach evidence
                                </button>
                              )}
                            </div>
                            {records.length > 0 && (
                              <div className="space-y-1.5 mt-2.5">
                                {records.map((e) => editingLaneEvidenceId === e.id ? (
                                  <EvidenceForm
                                    key={e.id}
                                    initial={{ ...e, exceptions: e.exceptions ?? "", population: e.population ?? "" }}
                                    assetOptions={assetOptions}
                                    isProgramScoped={isProgramScoped}
                                    prismaLevel={level}
                                    onCancel={() => setEditingLaneEvidenceId(null)}
                                    onSubmit={(patch) => handleUpdateEvidence(e.id, patch)}
                                  />
                                ) : (
                                  <EvidenceCard
                                    key={e.id}
                                    e={e}
                                    governing={governingEvidenceIds.has(e.id)}
                                    assetLabel={e.assetIds.length > 0
                                      ? e.assetIds.slice(0, 2).map((id) => assetName(system, id)).join(", ")
                                        + (e.assetIds.length > 2 ? ` +${e.assetIds.length - 2} more` : "")
                                      : undefined}
                                    onEdit={() => { setEditingLaneEvidenceId(e.id); setAttachingLane(null); }}
                                    onDelete={() => handleDeleteEvidence(e.id)}
                                  />
                                ))}
                              </div>
                            )}
                            {attachingLane === level && (
                              <div className="mt-2.5">
                                <EvidenceForm
                                  assetOptions={assetOptions}
                                  isProgramScoped={isProgramScoped}
                                  prismaLevel={level}
                                  onCancel={() => setAttachingLane(null)}
                                  onSubmit={(draft) => handleAttachEvidence(draft)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>

              {row.control.toolHint && (
                <div className="rounded-lg p-3" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Enforced By</div>
                  <div className="text-sm" style={{ color: C.ink }}>{row.control.toolHint}</div>
                </div>
              )}

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

              {/* ===== Assessment ===== */}
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
                    <div className="text-xs" style={{ color: C.ink }}>{assessment && assessment.owners.length > 0 ? assessment.owners.map((o) => o.name).join(", ") : "Unassigned"}</div>
                  </div>
                  <div>
                    {fieldLabel("Evidence confidence")}
                    <div className="text-xs font-semibold" style={{ color: evidenceHealth.color }}>{evidenceHealth.label}</div>
                  </div>
                </div>
              </div>
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
                  {programReasons.length > 0 && (
                    <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>
                      {programReasons.map((r) => r.rationale).join(" ")}
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
                                  <span className="text-[10px] font-semibold px-2 py-1 rounded shrink-0" style={{ background: themeBackground(instMeta?.color), color: themeColor(instMeta?.color) }}>
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

          {/* ===== Findings & Remediation ===== */}
          {activeStep === "findings" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {urgentRemediation && (
                  <GlancePill
                    Icon={Wrench}
                    label="Most urgent"
                    value={urgentRemediation}
                    color={themeColor(FINDING_REMEDIATION_STATUS_META[urgentRemediation]?.color)}
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
                    if (editingFindingId === f.id) {
                      return (
                        <FindingForm
                          key={f.id}
                          initial={{
                            title: f.title, detail: f.detail, assetId: f.assetId, severity: f.severity ?? "medium",
                            source: f.source ?? "", ownerId: f.ownerId, remediationStatus: f.remediationStatus,
                            due: f.due, remediationPlan: f.remediationPlan ?? "",
                            remediationOwnerId: f.remediationOwnerId ?? "", targetDate: f.targetDate ?? "",
                          }}
                          assetOptions={assetOptions}
                          onCancel={() => setEditingFindingId(null)}
                          onSubmit={(patch) => handleUpdateFinding(f.id, patch)}
                        />
                      );
                    }
                    const remMeta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus];
                    const severityMetaF = f.severity ? FINDING_SEVERITY_META[f.severity] : null;
                    const closureEvidenceIds = f.closureEvidenceIds ?? [];
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
                        {f.id.startsWith("FND-USR-") && (
                          <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                            <button type="button" className="flex items-center gap-1 text-[10.5px]" style={{ color: C.accent }} onClick={() => { setEditingFindingId(f.id); setCreatingFinding(false); }}><Pencil size={10} /> Edit / assign</button>
                            {f.remediationStatus !== "In Progress" && f.remediationStatus !== "Complete" && <button type="button" className="text-[10.5px]" style={{ color: C.accent }} onClick={() => saveMutation((existing) => updateFinding(existing, f.id, { remediationStatus: "In Progress" }))}>Start work</button>}
                            {f.remediationStatus !== "Blocked" && f.remediationStatus !== "Complete" && <button type="button" className="text-[10.5px]" style={{ color: C.red }} onClick={() => saveMutation((existing) => updateFinding(existing, f.id, { remediationStatus: "Blocked" }))}>Block</button>}
                            {f.remediationStatus !== "Complete" && <button type="button" className="text-[10.5px] font-semibold" style={{ color: C.green }} onClick={() => saveMutation((existing) => updateFinding(existing, f.id, { remediationStatus: "Complete", closedDate: new Date().toISOString().slice(0, 10) }))}>Mark complete</button>}
                          </div>
                        )}
                        {f.remediationStatus === "Complete" && (
                          <div className="text-[11px] mt-1" style={{ color: C.green }}>
                            Closed {f.closedDate}
                            {closureEvidenceIds.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {closureEvidenceIds.map((id) => {
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

      {/* Footer only exists in walk mode: the standalone panel closes when
          you're done, but the walk needs a way past a control you can't
          decide yet without recording a fact you don't stand behind. */}
      {walk && (
        <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: `1px solid ${C.border}`, background: C.panel2 }}>
          <span className="text-[11px] font-mono uppercase" style={{ color: C.muted }}>
            {walk.activeDomain} · {walk.domains.find((d) => d.domain === walk.activeDomain)?.remaining ?? 0} left
          </span>
          {walk.onSkip && (
            <button
              type="button"
              onClick={walk.onSkip}
              className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
              style={{ border: `1px solid ${C.border}`, color: C.ink }}
            >
              Skip for now <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
