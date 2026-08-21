import React, { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Link2, BookOpenText, Layers, FileCheck2, Wrench, Gauge, Plus, Pencil, Trash2, Check, ChevronRight,
  ScrollText, Network, ClipboardCheck, ShieldCheck,
} from "lucide-react";
import { C } from "../../theme";
import {
  PRISMA_LEVELS, COMPLIANCE_LABELS,
  FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META, FINDING_SEVERITIES, FINDING_SOURCES, REMEDIATION_STATUSES,
  isGapRating, suggestedFindingSeverity,
  INSTANCE_STATUS_META,
  EVIDENCE_TYPES, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS,
  EVIDENCE_COLLECTOR_TYPES, ARTIFACT_SENSITIVITIES, EVIDENCE_REVIEW_DECISIONS,
  assetsForSystem, getDataFlows, ORGS,
  evaluateControl, addPrismaOverride, updateEvidence, removeEvidence, addFinding, updateFinding, commitRuntimeFacts,
} from "../../engine";
import { upsertControlReview } from "../../engine/runtimeMutations";
import { buildLiveEngine } from "../../engine/liveGraph";
import { YAML_FACTS } from "../../graph/sources/yaml";
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
import {
  Button, Callout, CheckRow, ChoiceChip, CompletionScreen, DisclosureButton, EmptyState, Field, FieldGrid, InlineField, InlineHint,
  ProgressBar, RailGroup, RailItem, SaveErrorCallout, Section, Select, StatusPill, TextInput, toneColor, TX, Well,
  WizardBanner, WizardBody, WizardChrome, WizardFooter, WizardRail, WZ,
} from "../../components/wizard/WizardUI";
import type { Tone } from "../../components/wizard/WizardUI";
import { selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";
import type { ControlAssessment, ControlEvidenceDraft, ControlInstance, EvidenceDraft, Engine, EngineFinding, FindingDraft, LevelRating, ScoredEvidence } from "../../engine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { AssetId, ControlId, EvidenceId, FindingId, SystemId } from "../../graph/ids";
import type { ComplianceRating, EvidenceType, PrismaLevel } from "../../graph/nodes/taxonomy";
import type { EvidenceCollectorType, EvidenceResult, IndependenceLevel } from "../../graph/nodes/evidence";
import type { ArtifactSensitivity, EvidenceReviewDecision } from "../../graph/nodes/evidenceProvenance";
import type { FindingSeverity, FindingSource, RemediationStatus } from "../../graph/nodes/findings";
import type { SecurityPrinciple } from "../../data/securityPrinciples";
import type { ControlMatrixRow, WorkspaceSystem } from "./types";

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

// The control metas (status, instance status, severity, remediation) name a
// theme color key. Mapping those keys onto the wizard kit's tone vocabulary
// lets every badge in the panel be the same StatusPill, without losing the
// meaning the meta color already carries.
function toneForColorKey(colorKey?: string): Tone {
  if (colorKey === "green") return "success";
  if (colorKey === "amber") return "warning";
  if (colorKey === "red") return "danger";
  if (colorKey === "accent") return "info";
  return "neutral";
}

function GlancePill({ Icon, label, value, color }: { Icon: LucideIcon; label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5"
      style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: WZ.radius.control }}
    >
      <Icon size={12} color={C.muted} className="shrink-0" />
      <span className={TX.label} style={{ color: C.muted }}>{label}</span>
      <span className={`${TX.help} font-semibold`} style={{ color: color ?? C.ink }}>{value}</span>
    </div>
  );
}

// A label for a group *inside* a card. Card-level headings are `Section`;
// this is the one smaller rung beneath it, matching a Field's label exactly
// so the panel has two label sizes total rather than five.
function GroupLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={TX.label} style={{ color: C.muted }}>{children}</div>
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
function EvidenceCard({ e, assetLabel, governing, onEdit, onDelete, readOnly, getArtifacts, getReviews }: {
  e: ScoredEvidence;
  assetLabel?: string;
  governing?: boolean;
  onEdit?: (evidence: ScoredEvidence) => void;
  onDelete?: (evidence: ScoredEvidence) => void;
  readOnly?: boolean;
  // Bound to the panel's draft engine, not the committed global one — a
  // record staged but not yet saved has no artifacts/reviews in the real
  // graph yet, so a global lookup would come back empty until Save.
  getArtifacts: Engine["selectors"]["getEvidenceArtifacts"];
  getReviews: Engine["selectors"]["getEvidenceReviews"];
}) {
  const [showProvenance, setShowProvenance] = useState(false);
  const editable = !readOnly && isRuntimeEvidence(e.id);
  const artifacts = getArtifacts(e.id);
  const reviews = getReviews(e.id);
  const latestReview = reviews.at(-1);
  const reviewTone: Tone = latestReview?.decision === "accepted" ? "success"
    : latestReview?.decision === "rejected" ? "danger"
      : latestReview ? "warning" : "neutral";
  return (
    <Well className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Link2 size={12} color={C.muted} className="shrink-0" />
        <span className={`${TX.body} font-semibold flex-1 min-w-0 truncate`} style={{ color: C.ink }}>{e.source}</span>
        <StatusPill tone={e.result === "pass" ? "success" : e.result === "partial" ? "warning" : "danger"}>{e.result}</StatusPill>
        {governing && <StatusPill tone="info">Governing</StatusPill>}
      </div>
      <div className={`${TX.help} flex items-center gap-x-3 gap-y-1 flex-wrap`} style={{ color: C.muted }}>
        {assetLabel && <span>{assetLabel}</span>}
        <span>Coverage {e.coveragePct}%{e.exceptionRate != null && ` (${e.exceptions}/${e.population})`}</span>
        <span>
          {e.ageDays === 0 ? "Collected today" : `Collected ${e.ageDays}d ago`}
          {e.stale && <span className="font-semibold ml-1" style={{ color: C.amber }}>STALE</span>}
        </span>
        <span className="capitalize">{e.independence} independence</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <DisclosureButton
          open={showProvenance}
          onToggle={() => setShowProvenance((open) => !open)}
          tone={reviewTone}
          summary={<>&middot; {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"} &middot; {e.collectorType ?? e.independence}</>}
        >
          <span className="capitalize">{latestReview ? latestReview.decision.replace("-", " ") : "Needs review"}</span>
        </DisclosureButton>
        {editable ? (
          <span className="ml-auto flex items-center gap-2">
            <Button size="sm" icon={Pencil} onClick={() => onEdit?.(e)}>Edit</Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete?.(e)}>Delete</Button>
          </span>
        ) : (
          <span className="ml-auto"><StatusPill tone="neutral">Reference</StatusPill></span>
        )}
      </div>
      {showProvenance && (
        <div
          className={`${TX.help} grid gap-4 grid-cols-1 md:grid-cols-3 pt-3`}
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <div className="min-w-0">
            <GroupLabel>Collection</GroupLabel>
            <div style={{ color: C.ink }}>{e.collectorIdentity ?? "Collector identity not recorded"}</div>
            <div style={{ color: C.muted }}>{e.collectionRunId ?? "No run ID"}{e.methodVersion ? ` · ${e.methodVersion}` : ""}</div>
            <div style={{ color: C.muted }}>{e.periodStart && e.periodEnd ? `${e.periodStart.slice(0, 10)} to ${e.periodEnd.slice(0, 10)}` : "Coverage period not recorded"}</div>
          </div>
          <div className="min-w-0">
            <GroupLabel>Artifact integrity</GroupLabel>
            {artifacts.length > 0 ? artifacts.map((artifact) => (
              <div key={artifact.id} className="mb-1.5">
                <div style={{ color: C.ink }}>{artifact.name} · v{artifact.version}</div>
                <div className="font-mono truncate" title={artifact.sha256} style={{ color: C.muted }}>SHA-256 {artifact.sha256.slice(0, 14)}…</div>
                <div style={{ color: C.muted }}>{artifact.sensitivity} · retained at {artifact.storageRef}</div>
              </div>
            )) : <div style={{ color: C.muted }}>No retained artifact metadata</div>}
          </div>
          <div className="min-w-0">
            <GroupLabel>Review</GroupLabel>
            {latestReview ? (
              <>
                <div className="font-semibold capitalize" style={{ color: toneColor(reviewTone) }}>{latestReview.decision.replace("-", " ")}</div>
                <div style={{ color: C.ink }}>{latestReview.reviewer} · {latestReview.reviewedAt.slice(0, 10)}</div>
                <div style={{ color: C.muted }}>{latestReview.comments ?? "No review comments"}</div>
              </>
            ) : <div style={{ color: C.amber }}>No review decision recorded</div>}
          </div>
        </div>
      )}
    </Well>
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
    <Well className="flex flex-col gap-3.5">
      <FieldGrid cols={2}>
        <Field label="Source" error={form.source.trim() ? null : "Required — name where this evidence came from."}>
          <TextInput value={form.source} onChange={(e) => setField("source", e.target.value)} placeholder="e.g. Vanta, Auditor name" />
        </Field>
        <Field label="Evidence type">
          <Select value={form.evidenceType} aria-label="Evidence type" onChange={(e) => setField("evidenceType", selectedValue(EVIDENCE_TYPES, e.target.value, form.evidenceType))}>
            {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Result">
          <Select value={form.result} aria-label="Result" onChange={(e) => setField("result", selectedValue(EVIDENCE_RESULTS, e.target.value, form.result))}>
            {EVIDENCE_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Independence">
          <Select value={form.independence} aria-label="Independence" onChange={(e) => setField("independence", selectedValue(INDEPENDENCE_LEVELS, e.target.value, form.independence))}>
            {INDEPENDENCE_LEVELS.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Coverage %">
          <TextInput type="number" min={0} max={100} value={form.coveragePct} onChange={(e) => setField("coveragePct", e.target.value)} />
        </Field>
        <div />
        <Field label="Exceptions" note="Optional.">
          <TextInput type="number" min={0} value={form.exceptions} onChange={(e) => setField("exceptions", e.target.value)} />
        </Field>
        <Field label="Population" note="Optional.">
          <TextInput type="number" min={0} value={form.population} onChange={(e) => setField("population", e.target.value)} />
        </Field>
        <Field label="Note" span2>
          <TextInput value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Optional context" />
        </Field>
      </FieldGrid>

      <DisclosureButton open={showProvenance} onToggle={() => setShowProvenance((open) => !open)}>
        Collection, artifact &amp; review provenance
      </DisclosureButton>
      {showProvenance && (
        <Well hollow className="flex flex-col gap-4">
          <div>
            <GroupLabel>Collection details</GroupLabel>
            <FieldGrid cols={2}>
              <Field label="Collected date"><TextInput type="date" value={form.collectedAt} aria-label="Collected date" onChange={(e) => setField("collectedAt", e.target.value)} /></Field>
              <Field label="Collector type">
                <Select value={form.collectorType} aria-label="Collector type" onChange={(e) => setField("collectorType", selectedValue(EVIDENCE_COLLECTOR_TYPES, e.target.value, form.collectorType))}>
                  {EVIDENCE_COLLECTOR_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </Field>
              <Field label="Period start"><TextInput type="date" value={form.periodStart} aria-label="Period start" onChange={(e) => setField("periodStart", e.target.value)} /></Field>
              <Field label="Period end"><TextInput type="date" value={form.periodEnd} aria-label="Period end" onChange={(e) => setField("periodEnd", e.target.value)} /></Field>
              <Field label="Collector identity"><TextInput value={form.collectorIdentity} onChange={(e) => setField("collectorIdentity", e.target.value)} placeholder="Connector, account, or person" /></Field>
              <Field label="Collection run ID"><TextInput value={form.collectionRunId} aria-label="Collection run ID" onChange={(e) => setField("collectionRunId", e.target.value)} /></Field>
              <Field label="Method / script version"><TextInput value={form.methodVersion} aria-label="Method or script version" onChange={(e) => setField("methodVersion", e.target.value)} /></Field>
              <Field label="Source config version"><TextInput value={form.sourceConfigurationVersion} aria-label="Source configuration version" onChange={(e) => setField("sourceConfigurationVersion", e.target.value)} /></Field>
            </FieldGrid>
          </div>
          <div>
            <GroupLabel>Retained artifact (optional)</GroupLabel>
            <FieldGrid cols={2}>
              <Field label="Artifact name"><TextInput value={form.artifactName} onChange={(e) => setField("artifactName", e.target.value)} placeholder="report.pdf or snapshot.json" /></Field>
              <Field label="Media type"><TextInput value={form.artifactMediaType} aria-label="Media type" onChange={(e) => setField("artifactMediaType", e.target.value)} /></Field>
              <Field
                label="Immutable storage reference"
                error={!form.artifactName.trim() || form.artifactStorageRef.trim() ? null : "Required once an artifact is named."}
              >
                <TextInput value={form.artifactStorageRef} onChange={(e) => setField("artifactStorageRef", e.target.value)} placeholder="grc://evidence/..." />
              </Field>
              <Field label="Sensitivity">
                <Select value={form.artifactSensitivity} aria-label="Artifact sensitivity" onChange={(e) => setField("artifactSensitivity", selectedValue(ARTIFACT_SENSITIVITIES, e.target.value, form.artifactSensitivity))}>
                  {ARTIFACT_SENSITIVITIES.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </Field>
              <Field
                label="SHA-256"
                span2
                note="64-character hexadecimal digest."
                error={!form.artifactName.trim() || /^[a-f0-9]{64}$/i.test(form.artifactSha256.trim()) ? null : "Enter a 64-character hexadecimal digest."}
              >
                <TextInput value={form.artifactSha256} aria-label="Artifact SHA-256" onChange={(e) => setField("artifactSha256", e.target.value)} placeholder="64-character hexadecimal digest" />
              </Field>
            </FieldGrid>
          </div>
          <div>
            <GroupLabel>Review decision (optional)</GroupLabel>
            <FieldGrid cols={2}>
              <Field label="Reviewer"><TextInput value={form.reviewer} onChange={(e) => setField("reviewer", e.target.value)} placeholder="Name or accountable team" /></Field>
              <Field label="Decision">
                <Select value={form.reviewDecision} aria-label="Review decision" onChange={(e) => setField("reviewDecision", selectedValue(EVIDENCE_REVIEW_DECISIONS, e.target.value, form.reviewDecision))}>
                  {EVIDENCE_REVIEW_DECISIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </Field>
              <Field label="Valid through"><TextInput type="date" value={form.reviewValidThrough} aria-label="Valid through" onChange={(e) => setField("reviewValidThrough", e.target.value)} /></Field>
              <Field label="Review comments"><TextInput value={form.reviewComments} aria-label="Review comments" onChange={(e) => setField("reviewComments", e.target.value)} /></Field>
              <Field label="Independence declaration" span2 error={reviewReady ? null : "A named reviewer must complete this declaration."}>
                <CheckRow
                  checked={form.reviewIndependenceDeclared}
                  onChange={(checked) => setField("reviewIndependenceDeclared", checked)}
                  ariaLabel="Reviewer independence declaration"
                  label="Reviewer declares any independence conflict has been considered and recorded."
                />
              </Field>
            </FieldGrid>
          </div>
        </Well>
      )}
      {!isProgramScoped && assetOptions.length > 0 && (
        <Field label="Applies to assets">
          <div className="flex flex-wrap gap-2">
            {assetOptions.map((a) => {
              const checked = assetIds.includes(a.assetId);
              return (
                <ChoiceChip
                  key={a.assetId}
                  selected={checked}
                  ariaLabel={a.label}
                  onClick={() => setAssetIds((ids) => checked ? ids.filter((id) => id !== a.assetId) : [...ids, a.assetId])}
                >
                  <span className="normal-case">{a.label}</span>
                </ChoiceChip>
              );
            })}
          </div>
        </Field>
      )}
      <div className="flex items-center justify-end gap-2.5">
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          icon={Check}
          disabled={!form.source.trim() || !artifactReady || !reviewReady}
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
        >
          Save evidence
        </Button>
      </div>
    </Well>
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
    <Well className="flex flex-col gap-3.5">
      <FieldGrid cols={2}>
        <Field label="Title" span2 error={form.title.trim() ? null : "Required — say what was found."}>
          <TextInput value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="What was found" />
        </Field>
        <Field label="Detail" span2 note="Optional.">
          <TextInput value={form.detail} onChange={(e) => setField("detail", e.target.value)} placeholder="What's actually wrong" />
        </Field>
        <Field label="Asset">
          <Select value={form.assetId} aria-label="Asset" onChange={(e) => setField("assetId", e.target.value)}>
            {assetOptions.map((a) => <option key={a.assetId} value={a.assetId}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Severity">
          <Select value={form.severity} aria-label="Severity" onChange={(e) => setField("severity", selectedValue(FINDING_SEVERITIES, e.target.value, form.severity))}>
            {FINDING_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={form.source} aria-label="Source" onChange={(e) => setField("source", e.target.value === "" ? "" : selectedValue(FINDING_SOURCES, e.target.value, form.source || "control-gap"))}>
            <option value="">control-gap (default)</option>
            {FINDING_SOURCES.filter((s) => s !== "control-gap").map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
          </Select>
        </Field>
        <Field label="Owner">
          <Select value={form.ownerId} aria-label="Owner" onChange={(e) => setField("ownerId", e.target.value)}>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label="Remediation status">
          <Select value={form.remediationStatus} aria-label="Remediation status" onChange={(e) => setField("remediationStatus", selectedValue(REMEDIATION_STATUSES, e.target.value, form.remediationStatus))}>
            {REMEDIATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Due" error={form.due ? null : "Required."}>
          <TextInput type="date" value={form.due} aria-label="Due date" onChange={(e) => setField("due", e.target.value)} />
        </Field>
        <Field label="Remediation owner" note="Optional.">
          <Select value={form.remediationOwnerId} aria-label="Remediation owner" onChange={(e) => setField("remediationOwnerId", e.target.value)}>
            <option value="">Same as owner</option>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label="Target date" note="Optional.">
          <TextInput type="date" value={form.targetDate} aria-label="Target date" onChange={(e) => setField("targetDate", e.target.value)} />
        </Field>
        <Field label="Remediation plan" span2 note="Optional.">
          <TextInput value={form.remediationPlan} onChange={(e) => setField("remediationPlan", e.target.value)} placeholder="What will fix this" />
        </Field>
      </FieldGrid>
      <div className="flex items-center justify-end gap-2.5">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon={Check} disabled={!ready} onClick={submitFinding}>
          {initial ? "Save finding" : "Create finding"}
        </Button>
      </div>
    </Well>
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
  row: committedRow, system, onClose, walk,
}: ControlEvaluationPanelProps) {
  // Lands on Scoring and Evidence — the operator's stated job — with the
  // requirement context one step up the rail rather than in the way.
  const [activeStep, setActiveStep] = useState<EvaluationStep>("scoring");
  const [attachingLane, setAttachingLane] = useState<PrismaLevel | null>(null);
  const [editingLaneEvidenceId, setEditingLaneEvidenceId] = useState<EvidenceId | null>(null);
  const [showMaturityDetails, setShowMaturityDetails] = useState(false);
  const [creatingFinding, setCreatingFinding] = useState(false);
  const [creatingFindingInitial, setCreatingFindingInitial] = useState<Partial<FindingFormState> | null>(null);
  const [editingFindingId, setEditingFindingId] = useState<FindingId | null>(null);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [gapNudge, setGapNudge] = useState<{ level: PrismaLevel; rating: ComplianceRating } | null>(null);
  const liveEngine = useLiveEngine();

  // Every edit below — lane overrides, evidence, findings — stages into this
  // local copy instead of committing immediately, so the operator can make
  // several changes and then Save or Discard them as one decision. Recording
  // the first assessment (RecordAssessmentSection) still commits for real —
  // it builds on this same draft, so anything already staged rides along —
  // because it's what unlocks everything else here; there's nothing to stage
  // before it.
  const [draftFacts, setDraftFacts] = useState<RuntimeFacts>(() => loadRuntimeFacts());
  const [pendingChanges, setPendingChanges] = useState<string[]>([]);
  const [savedSummary, setSavedSummary] = useState<string[] | null>(null);
  const draftEngine = useMemo(() => buildLiveEngine(YAML_FACTS, draftFacts).engine, [draftFacts]);

  // The row this panel actually renders — the committed prop patched forward
  // by whatever is staged but not yet saved, so an unsaved lane override or
  // evidence attach shows up immediately instead of waiting for Save.
  const row: ControlMatrixRow = useMemo(() => {
    if (!draftEngine) return committedRow;
    const draftMatrixRow = draftEngine.compliance.systemControlMatrix(system.id).find((r) => r.controlId === committedRow.controlId);
    if (!draftMatrixRow) return committedRow;
    return { ...draftMatrixRow, responsibility: draftEngine.compliance.responsibilityForControl(system.id, committedRow.controlId) };
  }, [draftEngine, system.id, committedRow]);

  const walkRemaining = walk ? walk.domains.reduce((sum, d) => sum + d.remaining, 0) : 0;
  const walkReviewerMissing = Boolean(walk) && !walk!.reviewer.trim();

  if (!draftEngine) return null;

  const governingPolicy = POLICY_BY_CONTROL[row.control.id];
  const governingProcedure = PROCEDURE_BY_CONTROL[row.control.id];
  const drawerClauses = row.control.frameworks.filter((f) => system.standards.includes(f.standard));
  const statusMeta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const implMeta = IMPLEMENTATION_META.find((m) => m.type === row.control.implementationType);
  const controlFindings = draftEngine.findings.findingsForSystem(system.id).filter((f) => f.controlId === row.control.id);
  const urgentRemediation = mostUrgentRemediation(controlFindings);
  const worstEntry = worstLevelEntry(row.assessment);
  const worst = worstEntry?.[1] ?? null;
  const isProgramScoped = row.keyControl?.scope === "program";
  const programApplicability = isProgramScoped ? draftEngine.applicability.resolveProgramApplicability(system.id, row.control.id) : null;
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
  const laneEvidence = draftEngine.evidence.laneEvidenceForControl(system.id, row.control.id);

  // Every instance's applicability reasons are usually identical (the same
  // rule matched every asset the same way) — say it once at the section
  // level instead of repeating the same sentence per asset.
  const applicabilityRationales = [...new Set(
    row.instances.flatMap((inst) => (inst.applicability?.reasons ?? []).map((r) => r.rationale))
  )];

  // Stages a mutation into the draft: validates it against a dry-run engine
  // (same buildLiveEngine pass Save will use for real) and, if clean, folds
  // it into draftFacts with a human-readable label for the Save summary.
  // Nothing here touches committed storage — see saveDraft.
  function stageMutation(label: string, mutate: (existing: RuntimeFacts) => RuntimeFacts): boolean {
    setSaveError(null);
    const next = mutate(draftFacts);
    const { engine: trial, problems } = buildLiveEngine(YAML_FACTS, next);
    if (!trial) {
      setSaveError(problems);
      return false;
    }
    setDraftFacts(next);
    setPendingChanges((list) => [...list, label]);
    setAttachingLane(null);
    setEditingLaneEvidenceId(null);
    setCreatingFinding(false);
    setCreatingFindingInitial(null);
    setEditingFindingId(null);
    return true;
  }

  function saveDraft() {
    const { engine: committed, problems } = commitRuntimeFacts(draftFacts);
    if (!committed) {
      setSaveError(problems);
      return;
    }
    setSavedSummary(pendingChanges);
    setPendingChanges([]);
  }

  function discardDraft() {
    setSaveError(null);
    setDraftFacts(loadRuntimeFacts());
    setPendingChanges([]);
    setAttachingLane(null);
    setEditingLaneEvidenceId(null);
    setCreatingFinding(false);
    setCreatingFindingInitial(null);
    setEditingFindingId(null);
  }

  function requestClose() {
    if (pendingChanges.length > 0 && !window.confirm(`Discard ${pendingChanges.length} unsaved change${pendingChanges.length === 1 ? "" : "s"}?`)) return;
    onClose();
  }

  function handleAttachEvidence(draft: ControlEvidenceDraft) {
    stageMutation(`Attached evidence — ${draft.source}`, (existing) => evaluateControl(existing, {
      systemId: system.id,
      controlId: row.control.id,
      evidenceEntries: [draft],
    }));
  }

  function handleUpdateEvidence(evidenceId: EvidenceId, patch: Partial<EvidenceDraft>, label: string) {
    stageMutation(label, (existing) => updateEvidence(existing, evidenceId, patch));
  }

  function handleDeleteEvidence(evidence: ScoredEvidence) {
    stageMutation(`Removed evidence — ${evidence.source}`, (existing) => removeEvidence(existing, evidence.id));
  }

  function handleLaneGrades({ grades, assessedBy, note, comment }: { grades: LaneGrade[]; assessedBy: string; note: string; comment: string }) {
    const overridden = grades.filter((g) => g.rating !== g.derived);
    const label = overridden.length > 0
      ? `Updated PRISMA lane grading — ${overridden.map((g) => g.level).join(", ")}`
      : "Confirmed PRISMA lane grading";
    const staged = stageMutation(label, (existing) => {
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
    if (!staged) return;
    // Nudge off the ratings just submitted, not row.assessment — that prop
    // may not have caught up with this save yet. Skipped once a finding
    // already tracks this control's gap, so re-saving the same low grade
    // doesn't re-nag.
    const worst = [...grades].sort((a, b) => a.rating - b.rating)[0];
    const alreadyTracked = controlFindings.some((f) => f.open);
    setGapNudge(worst && isGapRating(worst.rating) && !alreadyTracked ? { level: worst.level, rating: worst.rating } : null);
  }

  function handleCreateFinding(draft: Omit<FindingDraft, "controlId">) {
    stageMutation(`Created finding — ${draft.title}`, (existing) => addFinding(existing, { ...draft, controlId: row.control.id }, system.id));
  }

  function handleUpdateFinding(findingId: FindingId, patch: Omit<FindingDraft, "controlId">, label: string) {
    stageMutation(label, (existing) => updateFinding(existing, findingId, patch));
  }

  return (
    <Modal open onClose={requestClose} width={1180} height={840}>
      <WizardChrome>
      {walk
        ? <WizardBanner icon={ClipboardCheck} title="Control Assessment Wizard" />
        : <WizardBanner icon={ShieldCheck} title="System Control Editor" />}
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between px-6 py-4 gap-4" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel }}>
        <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
          <div className="min-w-0">
            <div className={`${TX.eyebrow} mb-1.5`} style={{ color: C.accent }}>{row.control.id} · {row.control.domain}</div>
            <h2 className={TX.modalTitle} style={{ color: C.ink, fontFamily: WZ.serif }}>{row.control.name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {pendingChanges.length > 0 && <StatusPill tone="warning">{pendingChanges.length} unsaved</StatusPill>}
            <StatusPill color={statusMeta.color} surface={statusMeta.bg} icon={statusMeta.Icon}>{statusMeta.label}</StatusPill>
            {respMeta && <StatusPill color={respMeta.color} surface={respMeta.bg} icon={respMeta.Icon}>{respMeta.label}</StatusPill>}
            {implMeta && <StatusPill color={implMeta.color} surface={implMeta.bg} icon={implMeta.Icon}>{implMeta.type}</StatusPill>}
            <GlancePill Icon={Gauge} label="Assurance" value={row.score != null ? `${row.score}${row.assessment?.band?.label ? ` · ${row.assessment.band.label}` : ""}` : "—"} />
          </div>
        </div>
        <ModalCloseButton onClose={requestClose} />
      </div>

      {/* ---- Walk strip: overall progress + reviewer of record ---- */}
      {walk && (
        <div className="flex items-center gap-3 px-6 py-2.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel }}>
          <ClipboardCheck size={13} color={C.accent} className="shrink-0" />
          <span className={`${TX.label} shrink-0`} style={{ color: C.muted }}>
            Assessed {walk.decidedCount} of {walk.initialTotal}
          </span>
          <ProgressBar value={walk.decidedCount} total={walk.initialTotal} label="Key controls assessed" />
          <InlineField label="Reviewer">
            <TextInput
              value={walk.reviewer}
              onChange={(e) => walk.onReviewerChange(e.target.value)}
              placeholder="Assessor of record"
              aria-label="Reviewer of record"
              style={{ width: 190, borderColor: walkReviewerMissing ? C.amber : C.border }}
            />
          </InlineField>
        </div>
      )}

      {savedSummary ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-8 flex flex-col" style={{ background: C.bg }}>
          <CompletionScreen
            title="Changes saved"
            description={`${savedSummary.length} change${savedSummary.length === 1 ? "" : "s"} recorded on ${row.control.id} · ${row.control.name}.`}
            tiles={
              <Well className="flex flex-col gap-2 text-left">
                {savedSummary.map((change, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Check size={13} color={C.green} className="shrink-0" />
                    <span className={TX.body} style={{ color: C.ink }}>{change}</span>
                  </div>
                ))}
              </Well>
            }
          >
            <Button variant="primary" onClick={() => setSavedSummary(null)}>Continue editing</Button>
            <Button onClick={onClose}>Close</Button>
          </CompletionScreen>
        </div>
      ) : (
      <WizardBody>
        {/* ---- Rail: walk domains (walk mode only), then this control's steps ---- */}
        <WizardRail label="Assessment steps">
          {walk && (
            <RailGroup label="Domains">
              {walk.domains.map((d) => {
                const isDone = d.remaining === 0;
                return (
                  <RailItem
                    key={d.domain}
                    icon={ClipboardCheck}
                    title={d.domain}
                    detail={isDone ? `${d.total} decided` : `${d.remaining} of ${d.total} remaining`}
                    state={isDone ? "done" : d.domain === walk.activeDomain ? "active" : "pending"}
                    disabled={isDone}
                    onClick={() => walk.onSelectDomain(d.domain)}
                  />
                );
              })}
            </RailGroup>
          )}
          <RailGroup label={walk ? "This control" : undefined}>
            {STEPS.map((s) => {
              const badge = s.id === "findings" ? controlFindings.length : null;
              return (
                <RailItem
                  key={s.id}
                  icon={s.icon}
                  title={s.label}
                  detail={badge != null && badge > 0 ? `${badge} open` : undefined}
                  state={s.id === activeStep ? "active" : "pending"}
                  onClick={() => setActiveStep(s.id)}
                />
              );
            })}
          </RailGroup>
        </WizardRail>

        {/* ---- Content pane ---- */}
        <div className="p-6 overflow-y-auto flex flex-col gap-4" style={{ background: C.bg }}>
          {saveError && <SaveErrorCallout problems={saveError} />}

          {/* ===== Control Requirements ===== */}
          {activeStep === "requirements" && (
            <>
              <Section icon={BookOpenText} title="Common control requirement" description="What the catalog asks of any system this control applies to.">
                <p className={TX.lead} style={{ color: C.ink }}>{row.control.description}</p>
              </Section>

              {(governingPolicy || governingProcedure) && (
                <Section icon={ScrollText} title="Policies and procedures" description="The written authority this control is evidenced against.">
                  {governingPolicy && (
                    <Well>
                      <GroupLabel>Governing policy</GroupLabel>
                      <div className={TX.body} style={{ color: C.ink }}>{governingPolicy.code} · {governingPolicy.title}</div>
                    </Well>
                  )}
                  {governingProcedure && (
                    <Well>
                      <GroupLabel>Governing procedure</GroupLabel>
                      <div className={TX.body} style={{ color: C.ink }}>{governingProcedure.procedure.code} · {governingProcedure.procedure.title}</div>
                      {governingProcedure.step && (
                        <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>Step: {governingProcedure.step}</div>
                      )}
                    </Well>
                  )}
                </Section>
              )}

              <Section
                icon={Network}
                title="Framework clauses satisfied"
                description={`Mapped against this system's in-scope standards: ${system.standards.join(", ")}.`}
                aside={<StatusPill tone={drawerClauses.length > 0 ? "success" : "neutral"}>{drawerClauses.length} mapped</StatusPill>}
              >
                {drawerClauses.length === 0 ? (
                  <EmptyState>No direct clause mapping for this system&rsquo;s in-scope standards.</EmptyState>
                ) : (
                  <Well padded={false} className="overflow-hidden">
                    {drawerClauses.map((f, i) => (
                      <div
                        key={i}
                        className="px-3.5 py-2.5"
                        style={{ borderBottom: i < drawerClauses.length - 1 ? `1px solid ${C.border}` : undefined }}
                      >
                        <div className={`${TX.body} font-semibold`} style={{ color: C.ink }}>{f.standard}</div>
                        <div className={`${TX.help} font-mono mt-1`} style={{ color: C.muted }}>{f.clauses.join(", ")}</div>
                      </div>
                    ))}
                  </Well>
                )}
              </Section>

              <Section
                icon={Gauge}
                title="Maturity scoring detail"
                description="How each PRISMA lane was rated, weighted, and where the number came from."
                aside={
                  <DisclosureButton open={showMaturityDetails} onToggle={() => setShowMaturityDetails((v) => !v)}>
                    {showMaturityDetails ? "Hide" : "Show"}
                  </DisclosureButton>
                }
              >
                {!showMaturityDetails ? null : !assessment?.assessed ? (
                  <EmptyState>No fact is recorded for this control yet, so there is nothing to break down.</EmptyState>
                ) : (
                  <>
                    {PRISMA_LEVELS.map((level) => {
                      const L = assessment.levels[level];
                      return (
                        <Well key={level}>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`${TX.body} font-semibold w-24 shrink-0`} style={{ color: C.ink }}>{level}</span>
                            <ProgressBar value={L.rating} total={100} color={ratingColor(L.rating)} label={`${level} rating`} className="min-w-[80px]" />
                            <span className={`${TX.help} shrink-0 text-right`} style={{ color: C.muted }}>{COMPLIANCE_LABELS[L.rating]}</span>
                            <span className={`${TX.help} font-mono font-semibold tabular-nums shrink-0`} style={{ color: C.ink }}>{L.rating} ×{L.weight}</span>
                            <BasisTag basis={L.basis} />
                          </div>
                          <div className={`${TX.help} mt-2`} style={{ color: C.muted }}>
                            {L.rating !== L.derived && <span className="font-semibold" style={{ color: C.amber }}>Overridden from {L.derived}. </span>}
                            {L.rationale}
                          </div>
                        </Well>
                      );
                    })}
                    {assessment.ladderInversions.length > 0 && (
                      <Callout tone="warning" title="Rated above the level beneath it:">
                        {assessment.ladderInversions.join(", ")}.
                      </Callout>
                    )}
                  </>
                )}
              </Section>
            </>
          )}

          {/* ===== Scoring and Evidence ===== */}
          {/* The step renders the same sections whether or not a fact exists,
              so the walk and the table open an identical page. Unassessed
              controls add a banner naming WHY every lane reads 0 (nobody has
              looked — the score is null, not zero), put the record-a-fact
              form first, and lock the grader and per-lane attach until the
              first fact commits. */}
          {activeStep === "scoring" && assessment && (
            <>
              {gapNudge && (
                <Callout
                  tone="danger"
                  title={`${gapNudge.level} scored ${gapNudge.rating} — ${COMPLIANCE_LABELS[gapNudge.rating]}.`}
                >
                  <span className="block">Log a finding to track remediation?</span>
                  <span className="flex items-center gap-2.5 mt-2.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setActiveStep("findings");
                        setCreatingFinding(true);
                        setCreatingFindingInitial({
                          title: `${gapNudge.level} below threshold`,
                          detail: `${gapNudge.level} lane scored ${gapNudge.rating} — ${COMPLIANCE_LABELS[gapNudge.rating]}.`,
                          severity: suggestedFindingSeverity(gapNudge.rating),
                          source: "control-gap",
                        });
                        setGapNudge(null);
                      }}
                    >
                      Log finding
                    </Button>
                    <Button size="sm" onClick={() => setGapNudge(null)}>Dismiss</Button>
                  </span>
                </Callout>
              )}
              {!assessed && (
                <Callout tone="warning" title="The lanes below read 0 because nobody has assessed this control — not because it failed.">
                  No fact is recorded for {row.control.id} on this boundary, so its score is null and every PRISMA lane sits at 0 — Not Assessed. Record an assessment below to derive real lane ratings and unlock grading and evidence.
                </Callout>
              )}

              {!assessed && (
                <Section
                  icon={ClipboardCheck}
                  title="Record assessment"
                  description="Attest the Implemented lane, then back the claim with evidence. Nothing else unlocks until this is on record."
                  aside={<StatusPill tone="warning">Not assessed</StatusPill>}
                >
                  <RecordAssessmentSection
                    key={row.control.id}
                    systemId={system.id}
                    controlId={row.control.id}
                    isProgramScoped={Boolean(isProgramScoped)}
                    assetOptions={recordAssetOptions}
                    baseFacts={draftFacts}
                    reviewer={walk ? walk.reviewer : assessorOfRecord}
                    showContinue={Boolean(walk)}
                    continueLabel={walk ? (walkRemaining === 1 ? "Save and finish" : "Save and continue") : "Save assessment"}
                    disabled={walkReviewerMissing}
                    onSaved={(rating, continueWalk) => {
                      // RecordAssessmentSection committed on top of draftFacts
                      // (see baseFacts), so storage now holds everything that
                      // was staged plus the new assessment — reseeding here
                      // just picks that up as the new clean baseline.
                      setDraftFacts(loadRuntimeFacts());
                      if (walk) {
                        setPendingChanges([]);
                        walk.onRecorded(rating, continueWalk);
                      } else {
                        setSavedSummary([...pendingChanges, `Recorded assessment — ${rating} (${COMPLIANCE_LABELS[rating]})`]);
                        setPendingChanges([]);
                      }
                    }}
                  />
                  {walkReviewerMissing && (
                    <InlineHint tone="warning">Enter the reviewer of record above before recording assessments.</InlineHint>
                  )}
                </Section>
              )}

              <Section
                icon={Gauge}
                title="PRISMA lanes"
                description={assessed
                  ? "Derived ratings are suggestions. Accept them, or pick 0 / 25 / 50 / 75 / 100 on each lane."
                  : "Locked at 0 — Not Assessed. The lanes unlock once a fact is recorded above."}
                aside={assessed ? undefined : <StatusPill tone="neutral">Locked</StatusPill>}
              >
                <PrismaLaneGrader
                  levels={assessment.levels}
                  assessedBy={assessorOfRecord}
                  note=""
                  comment=""
                  disabled={!assessed}
                  onSubmit={handleLaneGrades}
                />
              </Section>

                  {/* One evidence slot per PRISMA lane, in ladder order.
                      Implemented-lane records are the ones the engine samples
                      for scoring; records attached to the other four lanes
                      document that lane's claim (the policy PDF, the SOP
                      extract, the metric export, the review minutes) without
                      entering the implementation pool — see
                      RawEvidence.prismaLevel. */}
              {/* One evidence slot per PRISMA lane, in ladder order.
                  Implemented-lane records are the ones the engine samples for
                  scoring; records attached to the other four lanes document
                  that lane's claim (the policy PDF, the SOP extract, the
                  metric export, the review minutes) without entering the
                  implementation pool — see RawEvidence.prismaLevel. */}
              <Section
                icon={FileCheck2}
                title="Evidence by lane"
                description="Substantiate each lane with an artifact — the policy document, the SOP extract, the test output, the metric, the review minutes. Implemented-lane records are sampled for scoring; the other lanes' records document the claim behind the derived rating."
              >
                {PRISMA_LEVELS.map((level, idx) => {
                  const L = assessment.levels[level];
                  const records = laneEvidence[level];
                  return (
                    <Well key={level} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`${TX.code} w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0`}
                          style={{ background: "transparent", border: `1.5px solid ${C.border}`, color: C.muted }}
                        >
                          {idx + 1}
                        </span>
                        <span className={TX.itemTitle} style={{ color: C.ink }}>{level}</span>
                        <span
                          className={`${TX.help} font-mono font-semibold tabular-nums`}
                          style={{ color: assessed ? ratingColor(L.rating) : C.muted }}
                        >
                          {assessed ? `${L.rating} — ${COMPLIANCE_LABELS[L.rating]}` : "0 — Not Assessed"}
                        </span>
                        <StatusPill tone={records.length === 0 ? "warning" : "success"}>
                          {records.length === 0 ? "None attached" : `${records.length} attached`}
                        </StatusPill>
                        {attachingLane !== level && (
                          <span className="ml-auto">
                            <Button
                              size="sm"
                              icon={Plus}
                              disabled={!assessed}
                              title={assessed ? undefined : "Record an assessment first"}
                              onClick={() => { setAttachingLane(level); setEditingLaneEvidenceId(null); }}
                            >
                              Attach evidence
                            </Button>
                          </span>
                        )}
                      </div>
                      {records.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {records.map((e) => editingLaneEvidenceId === e.id ? (
                            <EvidenceForm
                              key={e.id}
                              initial={{ ...e, exceptions: e.exceptions ?? "", population: e.population ?? "" }}
                              assetOptions={assetOptions}
                              isProgramScoped={isProgramScoped}
                              prismaLevel={level}
                              onCancel={() => setEditingLaneEvidenceId(null)}
                              onSubmit={(patch) => handleUpdateEvidence(e.id, patch, `Updated evidence — ${patch.source || e.source}`)}
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
                              getArtifacts={draftEngine.selectors.getEvidenceArtifacts}
                              getReviews={draftEngine.selectors.getEvidenceReviews}
                              onEdit={() => { setEditingLaneEvidenceId(e.id); setAttachingLane(null); }}
                              onDelete={() => handleDeleteEvidence(e)}
                            />
                          ))}
                        </div>
                      )}
                      {attachingLane === level && (
                        <EvidenceForm
                          assetOptions={assetOptions}
                          isProgramScoped={isProgramScoped}
                          prismaLevel={level}
                          onCancel={() => setAttachingLane(null)}
                          onSubmit={(draft) => handleAttachEvidence(draft)}
                        />
                      )}
                    </Well>
                  );
                })}
              </Section>

              <Section
                icon={ClipboardCheck}
                title="Assessment"
                description="The status this control currently carries on this boundary, and what it rests on."
                aside={
                  <span className="flex items-center gap-2">
                    <StatusPill color={statusMeta.color} surface={statusMeta.bg} icon={statusMeta.Icon}>{statusMeta.label}</StatusPill>
                    <BasisTag basis={row.basis} />
                  </span>
                }
              >
                <Field label="Assessment rationale">
                  <p className={TX.lead} style={{ color: C.ink }}>{worst ? worst.rationale : row.explanation}</p>
                </Field>
                <FieldGrid cols={2}>
                  <Field label="Control owner">
                    <div className={TX.body} style={{ color: C.ink }}>
                      {assessment && assessment.owners.length > 0 ? assessment.owners.map((o) => o.name).join(", ") : "Unassigned"}
                    </div>
                  </Field>
                  <Field label="Evidence confidence">
                    <div className={`${TX.body} font-semibold`} style={{ color: evidenceHealth.color }}>{evidenceHealth.label}</div>
                  </Field>
                </FieldGrid>
              </Section>

              {row.control.toolHint && (
                <Section icon={Wrench} title="Enforced by" description="The tooling the catalog expects to carry this control.">
                  <p className={TX.lead} style={{ color: C.ink }}>{row.control.toolHint}</p>
                </Section>
              )}

              {linkedPrinciples.length > 0 && (
                <Section
                  icon={ShieldCheck}
                  title="Linked assurance practices"
                  description="Security principles this control puts into practice, and how far each one is operationalized."
                  aside={<StatusPill tone="neutral">{linkedPrinciples.length} linked</StatusPill>}
                >
                  {linkedPrinciples.map((p) => (
                    <Well key={`${p.domainTitle}-${p.id}`}>
                      <div className="flex items-center gap-2">
                        <span className={TX.label} style={{ color: C.muted }}>{p.domainTitle}</span>
                        <span className="ml-auto">
                          <StatusPill tone={p.status === "operationalized" ? "success" : p.status === "partial" ? "warning" : "danger"}>
                            {PRINCIPLE_STATUS_META[p.status]?.label ?? p.status}
                          </StatusPill>
                        </span>
                      </div>
                      <div className={`${TX.body} mt-2`} style={{ color: C.ink }}>{p.statement}</div>
                    </Well>
                  ))}
                </Section>
              )}
            </>
          )}

          {/* ===== Implementation Coverage ===== */}
          {activeStep === "implementation" && (
            isProgramScoped ? (
              <Section icon={Layers} title="Implementation coverage" description={`Program-scoped — evaluated once for the whole ${system.name} boundary, not per asset.`}>
                {programReasons.length > 0 ? (
                  <Callout tone="info" title="Scoped to the program because:">
                    {programReasons.map((r) => r.rationale).join(" ")}
                  </Callout>
                ) : (
                  <EmptyState>No per-asset breakdown applies to a program-scoped control.</EmptyState>
                )}
              </Section>
            ) : row.instances.length === 0 ? (
              <Section icon={Layers} title="Implementation coverage" description="Which assets in this boundary carry the control, and where each one stands.">
                <EmptyState>No in-scope assets carry this control.</EmptyState>
              </Section>
            ) : (
              <Section
                icon={Layers}
                title="Implementation coverage"
                description="Which assets in this boundary carry the control, and where each one stands."
                aside={<StatusPill tone="neutral">{row.instances.length} asset{row.instances.length === 1 ? "" : "s"}</StatusPill>}
              >
                {applicabilityRationales.length === 1 && (
                  <Callout tone="info" title="Applies because:">{applicabilityRationales[0]}</Callout>
                )}
                {groupInstancesByLayer(row.instances, system.id).map(([layerLabel, insts]) => (
                  <div key={layerLabel}>
                    <GroupLabel>{layerLabel}</GroupLabel>
                    <div className="flex flex-col gap-2">
                      {insts.map((inst) => {
                        const instMeta = INSTANCE_STATUS_META[inst.status];
                        const label = inst.status === "undetermined" ? "Missing Evidence" : instMeta?.label ?? inst.status;
                        return (
                          <Well key={`${inst.assetId}-${inst.controlId}`}>
                            <div className="flex items-center gap-2">
                              <span className={`${TX.itemTitle} flex-1 min-w-0 truncate`} style={{ color: C.ink }}>{assetName(system, inst.assetId)}</span>
                              <StatusPill tone={toneForColorKey(instMeta?.color)}>{label}</StatusPill>
                            </div>
                            <div className={`${TX.help} mt-2`} style={{ color: C.muted }}>{inst.statement}</div>
                          </Well>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {applicabilityRationales.length > 1 && (
                  <Callout tone="info" title="Applies for different reasons per asset:">
                    {applicabilityRationales.join(" · ")}
                  </Callout>
                )}
              </Section>
            )
          )}

          {/* ===== Findings & Remediation ===== */}
          {activeStep === "findings" && (
            <Section
              icon={Wrench}
              title="Findings & remediation"
              description="Open gaps recorded against this control, who owns them, and when they are due."
              aside={
                <span className="flex items-center gap-2">
                  {urgentRemediation && (
                    <StatusPill tone={toneForColorKey(FINDING_REMEDIATION_STATUS_META[urgentRemediation]?.color)}>
                      {urgentRemediation}
                    </StatusPill>
                  )}
                  {!creatingFinding && (
                    <Button size="sm" icon={Plus} onClick={() => setCreatingFinding(true)}>Create finding</Button>
                  )}
                </span>
              }
            >
              {creatingFinding && (
                <FindingForm
                  initial={creatingFindingInitial ?? undefined}
                  assetOptions={assetOptions}
                  onCancel={() => { setCreatingFinding(false); setCreatingFindingInitial(null); }}
                  onSubmit={handleCreateFinding}
                />
              )}

              {controlFindings.length > 0 ? (
                <div className="flex flex-col gap-3">
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
                          onSubmit={(patch) => handleUpdateFinding(f.id, patch, `Updated finding — ${patch.title}`)}
                        />
                      );
                    }
                    const remMeta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus];
                    const severityMetaF = f.severity ? FINDING_SEVERITY_META[f.severity] : null;
                    const closureEvidenceIds = f.closureEvidenceIds ?? [];
                    return (
                      <Well key={f.id} className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`${TX.itemTitle} flex-1 min-w-0 truncate`} style={{ color: C.ink }}>{f.title}</span>
                          {severityMetaF && <StatusPill tone={toneForColorKey(severityMetaF.color)}>{severityMetaF.label}</StatusPill>}
                          {remMeta && <StatusPill tone={toneForColorKey(remMeta.color)}>{remMeta.label}</StatusPill>}
                        </div>
                        {f.detail && <div className={TX.help} style={{ color: C.muted }}>{f.detail}</div>}
                        <div className={TX.help} style={{ color: C.muted }}>
                          {assetName(system, f.assetId)}
                          {f.source && f.source !== "control-gap" && ` · Source: ${f.source.replace(/-/g, " ")}`}
                        </div>
                        {f.remediationPlan && <div className={TX.help} style={{ color: C.ink }}>{f.remediationPlan}</div>}
                        <div className={TX.help} style={{ color: f.overdue ? C.amber : C.muted }}>
                          {f.remediationOwnerName ?? f.ownerName} · target {f.targetDate ?? f.due}{f.overdue && " · OVERDUE"}
                        </div>
                        {f.id.startsWith("FND-USR-") && (
                          <div className="flex items-center gap-2 flex-wrap pt-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                            <Button size="sm" icon={Pencil} onClick={() => { setEditingFindingId(f.id); setCreatingFinding(false); }}>Edit / assign</Button>
                            {f.remediationStatus !== "In Progress" && f.remediationStatus !== "Complete" && (
                              <Button size="sm" onClick={() => stageMutation(`Started remediation — ${f.title}`, (existing) => updateFinding(existing, f.id, { remediationStatus: "In Progress" }))}>Start work</Button>
                            )}
                            {f.remediationStatus !== "Blocked" && f.remediationStatus !== "Complete" && (
                              <Button size="sm" variant="danger" onClick={() => stageMutation(`Blocked remediation — ${f.title}`, (existing) => updateFinding(existing, f.id, { remediationStatus: "Blocked" }))}>Block</Button>
                            )}
                            {f.remediationStatus !== "Complete" && (
                              <Button size="sm" variant="primary" icon={Check} onClick={() => stageMutation(`Marked complete — ${f.title}`, (existing) => updateFinding(existing, f.id, { remediationStatus: "Complete", closedDate: new Date().toISOString().slice(0, 10) }))}>Mark complete</Button>
                            )}
                          </div>
                        )}
                        {f.remediationStatus === "Complete" && (
                          <>
                            <div className={TX.help} style={{ color: C.green }}>Closed {f.closedDate}</div>
                            {closureEvidenceIds.length > 0 && (
                              <div className="flex flex-col gap-2">
                                {closureEvidenceIds.map((id) => {
                                  const ev = draftEngine.selectors.getEvidence(id);
                                  return ev ? (
                                    <EvidenceCard
                                      key={id}
                                      e={ev}
                                      readOnly
                                      getArtifacts={draftEngine.selectors.getEvidenceArtifacts}
                                      getReviews={draftEngine.selectors.getEvidenceReviews}
                                    />
                                  ) : null;
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </Well>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>No open findings for this control.</EmptyState>
              )}
            </Section>
          )}
        </div>
      </WizardBody>
      )}

      {/* Save/Discard always live at the bottom — every edit above stages
          into the draft rather than committing, so this is the one place
          that actually persists (or throws away) what changed. Walk mode
          keeps its domain position and Skip alongside them. */}
      {!savedSummary && (
        <WizardFooter
          position={walk
            ? `${walk.activeDomain} · ${walk.domains.find((d) => d.domain === walk.activeDomain)?.remaining ?? 0} left`
            : pendingChanges.length > 0
              ? `${pendingChanges.length} unsaved change${pendingChanges.length === 1 ? "" : "s"}`
              : "No unsaved changes"}
          hint={walkReviewerMissing
            ? <InlineHint tone="warning">Name a reviewer of record before recording an assessment.</InlineHint>
            : undefined}
        >
          {walk?.onSkip && <Button iconRight={ChevronRight} onClick={walk.onSkip}>Skip for now</Button>}
          <Button disabled={pendingChanges.length === 0} onClick={discardDraft}>Discard</Button>
          <Button variant="primary" icon={Check} disabled={pendingChanges.length === 0} onClick={saveDraft}>
            {pendingChanges.length > 0 ? `Save ${pendingChanges.length} change${pendingChanges.length === 1 ? "" : "s"}` : "Save"}
          </Button>
        </WizardFooter>
      )}
      </WizardChrome>
    </Modal>
  );
}
