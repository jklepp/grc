import React, { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Link2, BookOpenText, Layers, FileCheck2, Wrench, Gauge, Plus, Pencil, Trash2, Check, ChevronRight,
  ScrollText, Network, ClipboardCheck, ShieldCheck, Ban,
} from "lucide-react";
import { C } from "../../theme";
import {
  PRISMA_LEVELS, COMPLIANCE_LABELS,
  FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META,
  isGapRating, suggestedFindingSeverity,
  INSTANCE_STATUS_META,
  EVIDENCE_TYPES, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS,
  EVIDENCE_COLLECTOR_TYPES, ARTIFACT_SENSITIVITIES, EVIDENCE_REVIEW_DECISIONS,
  assetsForSystem, getDataFlows, baseFacts,
  evaluateControl, addPrismaOverride, updateEvidence, removeEvidence, addFinding, updateFinding, commitRuntimeFacts,
} from "../../engine";
import { upsertControlReview, addClosureEvidence } from "../../engine/runtimeMutations";
import { FindingEditor } from "./FindingEditor";
import type { ClosureEvidenceRef, FindingFormState } from "./FindingEditor";
import { buildLiveEngine } from "../../engine/liveGraph";
import { effectiveRating, initialLaneGraderState, laneGraderBlocker, laneGrades, PrismaLaneGrader } from "./PrismaLaneGrader";
import type { LaneGraderState } from "./PrismaLaneGrader";
import { implementedFactInput, previewFactInput, recordKeyControlAssessment } from "./recordAssessment";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { PRINCIPLE_DOMAINS, STATUS_META as PRINCIPLE_STATUS_META } from "../../data/securityPrinciples";
import { STATUS_META, IMPLEMENTATION_META, RESPONSIBILITY_META, ratingColor, assetName, evidenceHealthForRow, parseControlRequirement } from "./controlMeta";
import { POLICY_BY_CONTROL, PROCEDURE_BY_CONTROL } from "./policyLookup";
import { BasisTag } from "../../components/BasisTag";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Brief, Button, Callout, CheckRow, ChoiceChip, CompletionScreen, DisclosureButton, EmptyState, Field, FieldGrid, InlineField, InlineHint,
  ProgressBar, RailGroup, RailItem, SaveErrorCallout, Section, Select, StatusPill, TextInput, toneColor, TX, Well,
  WizardBanner, WizardBody, WizardChrome, WizardFooter, WizardHeader, WizardOutcomePane, WizardPane, WizardRail, WizardStrip, WZ,
} from "../../components/wizard/WizardUI";
import type { Tone } from "../../components/wizard/WizardUI";
import { selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";
import type { ControlAssessment, ControlEvidenceDraft, ControlInstance, EvidenceDraft, Engine, EngineFinding, FindingDraft, LevelRating, ScoredEvidence } from "../../engine";
import type { RuntimeFacts } from "../../engine/liveGraph";
import type { AssetId, ControlId, EvidenceId, FindingId, SystemId } from "../../graph/ids";
import type { Basis, ComplianceRating, EvidenceType, PrismaLevel } from "../../graph/nodes/taxonomy";
import type { EvidenceCollectorType, EvidenceResult, IndependenceLevel } from "../../graph/nodes/evidence";
import type { ArtifactSensitivity, EvidenceReviewDecision } from "../../graph/nodes/evidenceProvenance";
import type { RemediationStatus } from "../../graph/nodes/findings";
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

// The document a lane's rating was derived FROM, shown inside that lane.
//
// Policy and Procedure do not sample evidence — they read the policy and SOP
// libraries, and the record they read is already in the graph. Without this the
// panel contradicted itself: it named POL-05 as the governing policy one step
// away, rated the Policy lane 100 because POL-05 cites the control by name, and
// then reported "None attached" on that same lane, which reads as "nobody has
// substantiated this" when the substantiation is what produced the rating.
//
// Deliberately NOT an Evidence record. Minting one would put a document nobody
// collected into the evidence store, where it would be sampled, aged and
// counted as a collection — the derivation's source and a collected artifact
// are different things and must stay so. The supporting line is the lane's own
// rationale, quoted from the engine rather than restated here (2.7).
function LaneDerivedFrom({ code, title, detail, rationale, basis }: {
  code: string; title: string; detail?: string | null; rationale: string; basis?: Basis | null;
}) {
  return (
    <Well hollow className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <ScrollText size={13} color={C.muted} className="shrink-0" />
        <span className={TX.body} style={{ color: C.ink }}>{code} &middot; {title}</span>
        <span className="ml-auto shrink-0"><BasisTag basis={basis} /></span>
      </div>
      {detail && <div className={TX.help} style={{ color: C.muted }}>{detail}</div>}
      <div className={TX.help} style={{ color: C.muted }}>{rationale}</div>
    </Well>
  );
}

// The catalog's requirement, rendered so a clamp has somewhere sensible to
// land: the lead-in as prose, then one row per numbered clause. The controls
// written as a single sentence — most of them — parse to no clauses and render
// as the paragraph they already were.
function RequirementText({ description }: { description: string }) {
  const { lead, clauses } = parseControlRequirement(description);
  return (
    <div className="flex flex-col gap-2.5">
      <p className={TX.lead} style={{ color: C.ink }}>{lead}</p>
      {clauses.length > 0 && (
        <div className="flex flex-col gap-2">
          {clauses.map((clause, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span
                className={`${TX.code} w-[18px] h-[18px] mt-0.5 rounded-full flex items-center justify-center shrink-0`}
                style={{ border: `1.5px solid ${C.border}`, color: C.muted }}
              >
                {i + 1}
              </span>
              <span className={TX.lead} style={{ color: C.ink }}>{clause}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Declared order, and the rail reads it top to bottom (4.1). Scoring leads
// because it is the job; the requirement it is graded against rides above the
// lanes inside that step (see RequirementText), so nothing has to be looked up
// before the work can start. Authority & Mapping follows as the material an
// assessor goes and consults — the written authority, the clause mappings, the
// scoring breakdown — which is what it is named for (2.1).
const STEPS = [
  { id: "scoring", label: "Control Scoring", icon: Gauge },
  { id: "authority", label: "Authority & Mapping", icon: ScrollText },
  { id: "implementation", label: "Implementation Coverage", icon: Layers },
  { id: "findings", label: "Findings & Remediation", icon: Wrench },
] as const;
export type EvaluationStep = (typeof STEPS)[number]["id"];

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
  // Lands the panel on a step other than Control Scoring — used when a
  // caller already knows the operator is here to file or work a finding
  // (the Outstanding Actions tab), not to re-score the control.
  initialStep?: EvaluationStep;
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
  row: committedRow, system, onClose, walk, initialStep,
}: ControlEvaluationPanelProps) {
  // Lands on Control Scoring — the operator's stated job, and now the first
  // step in the rail, so the landing place and the declared order agree —
  // unless a caller asked to land somewhere else (initialStep).
  const [activeStep, setActiveStep] = useState<EvaluationStep>(initialStep ?? "scoring");
  const [attachingLane, setAttachingLane] = useState<PrismaLevel | null>(null);
  const [editingLaneEvidenceId, setEditingLaneEvidenceId] = useState<EvidenceId | null>(null);
  const [showMaturityDetails, setShowMaturityDetails] = useState(false);
  const [creatingFinding, setCreatingFinding] = useState(false);
  const [creatingFindingInitial, setCreatingFindingInitial] = useState<Partial<FindingFormState> | null>(null);
  const [editingFindingId, setEditingFindingId] = useState<FindingId | null>(null);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [gapNudge, setGapNudge] = useState<{ level: PrismaLevel; rating: ComplianceRating } | null>(null);
  // Scope-exclusion state: the reason disclosure is open, and whether an
  // exclusion is already staged. `excludeStaged` is not cosmetic — see
  // savingAssessment, which has to stop routing Save through the grader once
  // the operator has said this control does not apply at all.
  const [excluding, setExcluding] = useState(false);
  const [excludeNote, setExcludeNote] = useState("");
  const [excludeStaged, setExcludeStaged] = useState(false);
  const liveEngine = useLiveEngine();

  // Every edit below — evidence, findings — stages into this local copy
  // instead of committing immediately, so the operator can make several
  // changes and then Save or Discard them as one decision. The lane grader
  // holds its own form state (laneState) and joins the same commit, so a first
  // assessment and everything staged around it go out as one write.
  const [draftFacts, setDraftFacts] = useState<RuntimeFacts>(() => loadRuntimeFacts());
  const [pendingChanges, setPendingChanges] = useState<string[]>([]);
  const [savedSummary, setSavedSummary] = useState<string[] | null>(null);
  const draftEngine = useMemo(() => buildLiveEngine(baseFacts(), draftFacts).engine, [draftFacts]);

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

  // Assets in this boundary that require this control. An unassessed control
  // has no instances yet (assessment.ts only builds them in scope), so a first
  // assessment records against the applicability-derived population — the same
  // one the walk queue is built from.
  const recordAssetOptions = useMemo(
    () => (liveEngine.graph.assetsBySystem[system.id] ?? [])
      .filter((asset) => liveEngine.applicability.resolveApplicability(asset.id, committedRow.control.id).required)
      .map((asset) => ({ assetId: asset.id, label: asset.name })),
    [liveEngine, system.id, committedRow.control.id]
  );
  const assessorOfRecord = liveEngine.graph.assessmentScopeBySystem[system.id]?.assessor ?? "";

  // Closure evidence already on a finding, in the shape the editor renders.
  // Read off the staged draft engine so a record created earlier in this same
  // staged session is visible too.
  const closureEvidenceFor = useCallback(
    (f: EngineFinding): ClosureEvidenceRef[] => (draftEngine ? f.closureEvidenceIds ?? [] : [])
      .map((id) => draftEngine!.selectors.getEvidence(id))
      .filter((ev): ev is NonNullable<typeof ev> => Boolean(ev))
      .map((ev) => ({ id: ev.id, source: ev.source, collectedAt: ev.collectedAt, evidenceType: ev.evidenceType })),
    [draftEngine]
  );

  // Assets a given control is actually required on — what FindingEditor offers
  // as the optional locator. Anything else would produce a draft the dry run
  // refuses on applicability grounds.
  const findingAssetOptions = useCallback(
    (controlId: ControlId): AssetOption[] => (liveEngine.graph.assetsBySystem[system.id] ?? [])
      .filter((asset) => liveEngine.applicability.resolveApplicability(asset.id, controlId).required)
      .map((asset) => ({ assetId: asset.id, label: asset.name })),
    [liveEngine, system.id]
  );

  // The whole assessment form, in one place. Seeded from the walk's reviewer
  // when there is one, so a name typed on the first control carries to every
  // control after it instead of resetting with each remount.
  // Whether the operator has touched the grader this session. An already
  // assessed control seeds its existing overrides into the form, so "has
  // ratings" is not the same question — without this, saving an unrelated
  // staged evidence edit would demand a fresh comment.
  const [laneDirty, setLaneDirty] = useState(false);
  const [laneState, setLaneState] = useState<LaneGraderState>(() => initialLaneGraderState({
    levels: committedRow.assessment?.levels,
    assessed: Boolean(committedRow.assessment?.assessed),
    assessedBy: (walk?.reviewer ?? "").trim() || assessorOfRecord,
    assetOptions: recordAssetOptions,
  }));

  // The derived baseline the grid grades against.
  //
  // An unassessed control's five lanes are all forced to a fake 0 by
  // assessment.ts's out-of-scope early return, so there is nothing honest to
  // grade against until the control is in scope. This dry-runs the fact the
  // form is about to write and reads the real lanes back off it — the same
  // buildLiveEngine pass Save uses, just before submit instead of after, which
  // is what lets the attested-vs-derived disagreement show on the chips rather
  // than in a modal that ambushes you afterwards.
  //
  // Deps are the discrete fields only. Source and reason text cannot change a
  // derivation, so typing them does not rebuild the graph.
  const previewLevels = useMemo(() => {
    const committed = row.assessment?.levels ?? null;
    if (row.assessment?.assessed) return committed;
    try {
      const candidate = recordKeyControlAssessment(draftFacts, {
        systemId: system.id,
        controlId: row.control.id,
        isProgramScoped: row.keyControl?.scope === "program",
        recordAssetOptions,
        input: previewFactInput(laneState),
      });
      const preview = buildLiveEngine(baseFacts(), candidate).engine;
      return preview?.assessment.assessmentFor(system.id, row.control.id)?.levels ?? committed;
    } catch {
      // A half-filled form that cannot yet make a valid fact (no asset to hang
      // a Not Implemented on, say) just keeps the committed baseline.
      return committed;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    row, system.id, draftFacts, recordAssetOptions,
    laneState.ratings.Implemented, laneState.evidenceType, laneState.evidencePending, laneState.assetId,
  ]);

  if (!draftEngine) return null;

  // Only used to label the brief; the clause rows themselves come from the
  // same parse inside RequirementText.
  const requirementClauseCount = parseControlRequirement(row.control.description).clauses.length;
  const governingPolicy = POLICY_BY_CONTROL[row.control.id];
  const governingProcedure = PROCEDURE_BY_CONTROL[row.control.id];
  // Which lanes have a document behind them at all. Only the two that read
  // libraries rather than sample: Implemented, Measured and Managed derive from
  // evidence prevalence and the review calendar, so an empty lane there really
  // does mean nothing is attached.
  const laneDerivedDoc: Partial<Record<PrismaLevel, { code: string; title: string; detail: string | null }>> = {
    ...(governingPolicy && {
      Policy: {
        code: governingPolicy.code,
        title: governingPolicy.title,
        detail: `Last reviewed ${governingPolicy.lastReviewed}.`,
      },
    }),
    ...(governingProcedure && {
      Procedure: {
        code: governingProcedure.procedure.code,
        title: governingProcedure.procedure.title,
        detail: governingProcedure.step
          ? `Step: ${governingProcedure.step} · owned by ${governingProcedure.procedure.owner}.`
          : `Owned by ${governingProcedure.procedure.owner}.`,
      },
    }),
  };
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
  // What the grid grades against: the live preview while a control is still
  // unassessed, the control's own lanes once it is.
  const gradingLevels = previewLevels ?? assessment?.levels ?? null;
  const laneBlocker = gradingLevels
    ? laneGraderBlocker({
        value: laneState, levels: gradingLevels, assessed,
        isProgramScoped: Boolean(isProgramScoped), assetOptions: recordAssetOptions,
      })
    : "This control has no assessment to grade.";
  // An unassessed control has nothing on record, so the grader IS the save.
  // An assessed one only routes through it when the operator actually touched
  // it; otherwise the footer is just committing staged evidence or findings.
  //
  // A staged exclusion overrides all of that. Saying "this control does not
  // apply here" is the opposite of grading it, and on an unassessed control the
  // grader's own blocker would otherwise refuse the save — demanding a rating
  // for a control the operator has just declared out of scope.
  const savingAssessment = !excludeStaged && (!assessed || laneDirty);
  const saveBlocker = savingAssessment ? laneBlocker : null;
  const canSave = savingAssessment ? saveBlocker === null : pendingChanges.length > 0;
  const unsavedCount = pendingChanges.length + (laneDirty ? 1 : 0);
  // Two acts, two labels, and no more: in the walk the primary commits *and*
  // advances, so it names both; in the editor it is the one final commit, so
  // it carries one label whatever happens to be staged behind it. The three
  // variants this used to cycle through read as three different buttons (2.6).
  const saveLabel = walk
    ? walkRemaining === 1 ? "Save and finish" : "Save and continue"
    : "Save changes";
  const assetOptions = row.instances.length > 0
    ? row.instances.map((inst) => ({ assetId: inst.assetId, label: assetName(system, inst.assetId) }))
    : assetsForSystem(system.id).map((a) => ({ assetId: a.id, label: a.name }));
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
    const { engine: trial, problems } = buildLiveEngine(baseFacts(), next);
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
    setLaneState(initialLaneGraderState({
      levels: committedRow.assessment?.levels,
      assessed: Boolean(committedRow.assessment?.assessed),
      assessedBy: (walk?.reviewer ?? "").trim() || assessorOfRecord,
      assetOptions: recordAssetOptions,
    }));
    setLaneDirty(false);
    setAttachingLane(null);
    setEditingLaneEvidenceId(null);
    setCreatingFinding(false);
    setCreatingFindingInitial(null);
    setEditingFindingId(null);
    setExcluding(false);
    setExcludeNote("");
    setExcludeStaged(false);
  }

  function requestClose() {
    if (unsavedCount > 0 && !window.confirm(`Discard ${unsavedCount} unsaved change${unsavedCount === 1 ? "" : "s"}?`)) return;
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

  function handleLaneChange(patch: Partial<LaneGraderState>) {
    // Walk mode keeps the assessor at the walk level so a name typed on the
    // first control survives the remount onto the next one.
    if (patch.assessedBy !== undefined && walk) walk.onReviewerChange(patch.assessedBy);
    setLaneDirty(true);
    setSaveError(null);
    setLaneState((current) => ({ ...current, ...patch }));
  }

  // The one commit an assessment makes. Everything the operator decided on
  // this control goes out as a single write: the Implemented fact that puts it
  // in assessment scope, a PRISMA override for every lane they moved off its
  // derived rating, the control review that signs the lot, and whatever else
  // was already staged in the draft. Nothing commits behind the footer's back
  // any more — recording a first assessment used to, which is why the "N
  // unsaved" count could reset without the operator pressing Save.
  function commitAssessment(continueWalk: boolean) {
    if (!gradingLevels || laneBlocker) return;
    setSaveError(null);
    const grades = laneGrades(laneState, gradingLevels, assessed);
    const implemented = grades.find((g) => g.level === "Implemented")!;
    const assessedBy = laneState.assessedBy.trim();
    const stamp = new Date().toISOString().slice(0, 10);

    let runtime: RuntimeFacts;
    try {
      if (assessed) {
        runtime = draftFacts;
      } else {
        const input = implementedFactInput(laneState);
        if (!input) return;
        runtime = recordKeyControlAssessment(draftFacts, {
          systemId: system.id,
          controlId: row.control.id,
          isProgramScoped: Boolean(isProgramScoped),
          recordAssetOptions,
          input,
          reviewer: assessedBy,
        });
      }
      grades.forEach((grade) => {
        if (grade.rating === grade.derived) return;
        runtime = addPrismaOverride(runtime, {
          systemId: system.id,
          controlId: row.control.id,
          level: grade.level,
          rating: grade.rating,
          note: laneState.note.trim() || laneState.comment.trim(),
          assessedBy,
          assessedAt: stamp,
        });
      });
      runtime = upsertControlReview(runtime, {
        systemId: system.id,
        controlId: row.control.id,
        bucket: "system-owned",
        stance: "confirm",
        note: laneState.comment.trim(),
        reviewedBy: assessedBy,
        reviewedAt: stamp,
      });
    } catch (e) {
      setSaveError([e instanceof Error ? e.message : String(e)]);
      return;
    }

    const { engine: committed, problems } = commitRuntimeFacts(runtime);
    if (!committed) {
      setSaveError(problems);
      return;
    }

    const overridden = grades.filter((g) => g.rating !== g.derived);
    const summary = [
      ...pendingChanges,
      assessed
        ? overridden.length > 0
          ? `Updated PRISMA lanes — ${overridden.map((g) => g.level).join(", ")}`
          : "Confirmed PRISMA lane grading"
        : `Recorded assessment — Implemented ${implemented.rating} (${COMPLIANCE_LABELS[implemented.rating]})`,
    ];

    setDraftFacts(loadRuntimeFacts());
    setPendingChanges([]);
    setLaneDirty(false);

    // Nudge off the grades just committed, not row.assessment — that prop has
    // not caught up with this write yet. Skipped once a finding already tracks
    // this control's gap, so re-saving the same low grade doesn't re-nag.
    const worst = [...grades].sort((a, b) => a.rating - b.rating)[0];
    const alreadyTracked = controlFindings.some((f) => f.open);
    setGapNudge(worst && isGapRating(worst.rating) && !alreadyTracked ? { level: worst.level, rating: worst.rating } : null);

    if (walk) walk.onRecorded(implemented.rating, continueWalk);
    else setSavedSummary(summary);
  }

  // The panel supplies both anchor fields: the control it is open on, and the
  // boundary it is open in. A finding is a gap in that (system, control) — the
  // form only describes it.
  function handleCreateFinding(draft: Omit<FindingDraft, "systemId">, closureEvidence: string) {
    stageMutation(`Created finding — ${draft.title}`, (existing) => {
      let next = addFinding(existing, { ...draft, systemId: system.id }, system.id);
      if (!closureEvidence) return next;
      const created = next.findings[next.findings.length - 1];
      return addClosureEvidence(next, {
        findingId: created.id, text: closureEvidence,
        fallbackAssetIds: findingAssetOptions(draft.controlId).map((o) => o.assetId),
      });
    });
  }

  function handleUpdateFinding(findingId: FindingId, patch: Omit<FindingDraft, "systemId">, closureEvidence: string, label: string) {
    stageMutation(label, (existing) => {
      const next = updateFinding(existing, findingId, patch);
      if (!closureEvidence) return next;
      return addClosureEvidence(next, {
        findingId, text: closureEvidence,
        fallbackAssetIds: findingAssetOptions(patch.controlId).map((o) => o.assetId),
      });
    });
  }

  // Scope's other direction, recorded where the operator already is. The three
  // Scope Review sections only ask about controls the engine surfaced — a
  // control that simply applies and was never questioned is reachable from none
  // of them, which is what the All Controls browser used to cover. It belongs on
  // the control rather than in a catalog list: this is the screen someone is
  // reading when they work out the premise does not hold here.
  //
  // Same ControlReview record Scope Review writes (bucket "not-applicable",
  // stance "confirm"), staged like every other edit so it goes out through the
  // same dry run and the same Save.
  function handleMarkOutOfScope(reason: string) {
    const staged = stageMutation(
      `Marked out of scope — ${row.control.id}`,
      (existing) => upsertControlReview(existing, {
        systemId: system.id,
        controlId: row.control.id,
        bucket: "not-applicable",
        stance: "confirm",
        note: reason,
        reviewedBy: laneState.assessedBy.trim() || assessorOfRecord,
        reviewedAt: new Date().toISOString().slice(0, 10),
      }),
    );
    if (!staged) return;
    setExcluding(false);
    setExcludeNote("");
    setExcludeStaged(true);
  }

  return (
    <Modal open onClose={requestClose} width={1180} height={840}>
      <WizardChrome>
      {walk
        ? <WizardBanner icon={ClipboardCheck} title="Control Assessment Wizard" />
        : <WizardBanner icon={ShieldCheck} title="System Control Editor" />}
      {/* ---- Header ----
           The subject here is one specific control, so its id and domain ride
           in the kit's `eyebrow` slot rather than in a header this file draws
           for itself. */}
      <WizardHeader
        icon={walk ? ClipboardCheck : ShieldCheck}
        eyebrow={`${row.control.id} · ${row.control.domain}`}
        title={row.control.name}
        aside={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {unsavedCount > 0 && <StatusPill tone="warning">{unsavedCount} unsaved</StatusPill>}
            <StatusPill color={statusMeta.color} surface={statusMeta.bg} icon={statusMeta.Icon}>{statusMeta.label}</StatusPill>
            {respMeta && <StatusPill color={respMeta.color} surface={respMeta.bg} icon={respMeta.Icon}>{respMeta.label}</StatusPill>}
            {implMeta && <StatusPill color={implMeta.color} surface={implMeta.bg} icon={implMeta.Icon}>{implMeta.type}</StatusPill>}
            <GlancePill Icon={Gauge} label="Assurance" value={row.score != null ? `${row.score}${row.assessment?.band?.label ? ` · ${row.assessment.band.label}` : ""}` : "—"} />
          </div>
        }
        onClose={<ModalCloseButton onClose={requestClose} />}
      />

      {/* ---- Walk strip: overall progress + who is signing ----
           The assessor used to be typed here, in the chrome, where it read as
           decoration while silently disabling Save. It is a labelled, required
           field in the grader now; this only reports it. */}
      {walk && (
        <WizardStrip icon={ClipboardCheck}>
          <span className={`${TX.label} shrink-0`} style={{ color: C.muted }}>
            Assessed {walk.decidedCount} of {walk.initialTotal}
          </span>
          <ProgressBar value={walk.decidedCount} total={walk.initialTotal} label="Key controls assessed" />
          <InlineField label="Assessor">
            <span className={TX.body} style={{ color: laneState.assessedBy.trim() ? C.ink : C.amber }}>
              {laneState.assessedBy.trim() || "not named yet"}
            </span>
          </InlineField>
        </WizardStrip>
      )}

      {savedSummary ? (
        <WizardOutcomePane>
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
          />
        </WizardOutcomePane>
      ) : (
      <WizardBody enter={Boolean(walk)}>
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
        <WizardPane>
          {saveError && <SaveErrorCallout problems={saveError} />}

          {/* ===== Authority & Mapping ===== */}
          {activeStep === "authority" && (
            <>
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

          {/* ===== Control Scoring ===== */}
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
              {/* What the catalog asks, directly above the lanes that answer
                  it. This used to be a step of its own, which meant the walk
                  opened on Scoring with the requirement one rail click away in
                  the bottom-left — the operator graded against a control they
                  had to go and read somewhere else. `Brief` measures rather
                  than assumes: only the handful of controls written as long
                  enumerated lists clamp, and those clamp on a clause boundary
                  with the count in view. */}
              <Brief
                icon={BookOpenText}
                label="What this control asks"
                expandLabel={requirementClauseCount > 0 ? "Read the rest" : "Read it in full"}
                aside={
                  <>
                    {requirementClauseCount > 0 && (
                      <StatusPill tone="neutral">{requirementClauseCount} requirements</StatusPill>
                    )}
                    <Button size="sm" iconRight={ChevronRight} onClick={() => setActiveStep("authority")}>
                      Authority &amp; Mapping
                    </Button>
                  </>
                }
              >
                <RequirementText description={row.control.description} />
              </Brief>

              {!assessed && (
                <Callout tone="warning" title="Nothing is on record for this control yet — the score is null, not zero.">
                  No fact backs {row.control.id} on this boundary. The lanes below show what the graph <i>would</i> derive
                  once it is in scope: Policy and Procedure read the policy and SOP libraries, Measured and Managed read
                  evidence prevalence and the review calendar. Grade every lane you can, answer Implemented, and save.
                </Callout>
              )}

              <Section
                icon={Gauge}
                title="PRISMA lanes"
                description={assessed
                  ? "Derived ratings are suggestions. Accept them, or pick 0 / 25 / 50 / 75 / 100 on each lane."
                  : "Grade all five. Untouched lanes save at their derived rating; Implemented is the one call only you can make."}
                aside={assessed
                  ? undefined
                  : <StatusPill tone="warning">Not assessed</StatusPill>}
              >
                {gradingLevels && (
                  <PrismaLaneGrader
                    levels={gradingLevels}
                    assessed={assessed}
                    isProgramScoped={Boolean(isProgramScoped)}
                    assetOptions={recordAssetOptions}
                    value={laneState}
                    onChange={handleLaneChange}
                    dirty={laneDirty}
                  />
                )}
              </Section>

              {/* One evidence slot per PRISMA lane, in ladder order.
                  Implemented-lane records are the ones the engine samples for
                  scoring; records attached to the other four lanes document
                  that lane's claim (the policy PDF, the SOP extract, the
                  metric export, the review minutes) without entering the
                  implementation pool — see RawEvidence.prismaLevel. */}
              <Section
                icon={FileCheck2}
                title="Evidence by lane"
                description="Policy and Procedure already carry the library record their rating was derived from; attach an artifact to the others — the test output, the metric, the review minutes. Implemented-lane records are sampled for scoring; the other lanes' records document the claim behind the derived rating."
              >
                {PRISMA_LEVELS.map((level, idx) => {
                  const laneLevels = gradingLevels ?? assessment.levels;
                  // The preview seeds Implemented with a placeholder so the
                  // other four lanes can derive; it is not a rating anybody
                  // has claimed yet, so this row says so rather than quoting
                  // a number the operator never picked.
                  const laneRating = effectiveRating(laneState, laneLevels, level, assessed);
                  const records = laneEvidence[level];
                  const derivedFrom = laneDerivedDoc[level];
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
                          style={{ color: laneRating == null ? C.muted : ratingColor(laneRating) }}
                        >
                          {laneRating == null ? "Not yet assessed" : `${laneRating} — ${COMPLIANCE_LABELS[laneRating]}`}
                        </span>
                        {/* A lane with a derived source is substantiated even
                            with nothing attached, so it must not wear the same
                            amber "None attached" as a lane nothing backs. */}
                        <StatusPill tone={records.length > 0 ? "success" : derivedFrom ? "neutral" : "warning"}>
                          {records.length > 0
                            ? `${records.length} attached`
                            : derivedFrom ? `Derived from ${derivedFrom.code}` : "None attached"}
                        </StatusPill>
                        {attachingLane !== level && (
                          <span className="ml-auto">
                            <Button
                              size="sm"
                              icon={Plus}
                              onClick={() => { setAttachingLane(level); setEditingLaneEvidenceId(null); }}
                            >
                              Attach evidence
                            </Button>
                          </span>
                        )}
                      </div>
                      {derivedFrom && (
                        <LaneDerivedFrom
                          code={derivedFrom.code}
                          title={derivedFrom.title}
                          detail={derivedFrom.detail}
                          rationale={laneLevels[level].rationale}
                          basis={laneLevels[level].basis}
                        />
                      )}
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

              {/* The scope escape hatch, at the bottom of Scoring because it is
                  what you reach for when grading turns out to be the wrong
                  question. Same three labels Scope Review settled on — `Mark
                  out of scope…` opens the reason, `Confirm out of scope`
                  records it — so the two surfaces read as one decision made in
                  two places, not two different ones. */}
              <Section
                icon={Ban}
                title="Scope"
                description="This control is in scope for this boundary. Record an exclusion if its premise does not hold here."
              >
                {excludeStaged ? (
                  <Callout tone="warning" title="Marked out of scope — not saved yet">
                    Goes out with the rest of your changes when you save. The control then leaves this
                    system's applicable set and appears under Out of Scope in Scope Review, which is where
                    it can be pulled back in.
                  </Callout>
                ) : excluding ? (
                  <Well hollow className="flex flex-col gap-3.5">
                    {/* Said before the decision, not after. An assessed control
                        keeps everything it carries — the engine exempts a
                        scoped-out pair from the checks that assume it is still
                        live (see DORMANT ASSESSMENTS in validateDerivations)
                        rather than deleting the record to stay consistent. */}
                    {assessed && (
                      <Callout tone="warning" title="This control has been assessed.">
                        Its PRISMA ratings, evidence and findings stay on record and remain readable, but
                        stop counting toward this system's scores once it leaves the applicable set.
                        Pulling the control back into scope restores them.
                      </Callout>
                    )}
                    <Field
                      label="Reason"
                      note="Required — why this control does not apply to this boundary."
                      error={excludeNote.trim() ? null : "Enter a reason before recording the exclusion."}
                    >
                      <TextInput
                        value={excludeNote}
                        onChange={(e) => setExcludeNote(e.target.value)}
                        placeholder="e.g. No physical facility inside this boundary"
                        aria-label={`Reason ${row.control.id} is out of scope`}
                      />
                    </Field>
                    <div className="flex items-center justify-end gap-2.5">
                      <Button size="sm" onClick={() => { setExcluding(false); setExcludeNote(""); }}>Cancel</Button>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Check}
                        disabled={!excludeNote.trim()}
                        onClick={() => handleMarkOutOfScope(excludeNote.trim())}
                      >
                        Confirm out of scope
                      </Button>
                    </div>
                  </Well>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Ban}
                    onClick={() => { setExcluding(true); setExcludeNote(""); }}
                  >
                    Mark out of scope…
                  </Button>
                )}
              </Section>
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
                <FindingEditor
                  initial={{ ...creatingFindingInitial, controlId: row.control.id }}
                  assetOptionsFor={findingAssetOptions}
                  onCancel={() => { setCreatingFinding(false); setCreatingFindingInitial(null); }}
                  onSubmit={handleCreateFinding}
                />
              )}

              {controlFindings.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {controlFindings.map((f) => {
                    if (editingFindingId === f.id) {
                      return (
                        <FindingEditor
                          key={f.id}
                          initial={{
                            title: f.title, detail: f.detail, controlId: f.controlId, assetId: f.assetId ?? "",
                            severity: f.severity ?? "medium",
                            source: f.source ?? "", ownerId: f.ownerId, remediationStatus: f.remediationStatus,
                            due: f.due, remediationPlan: f.remediationPlan ?? "",
                            remediationOwnerId: f.remediationOwnerId ?? "", targetDate: f.targetDate ?? "",
                          }}
                          assetOptionsFor={findingAssetOptions}
                          // The card below carries these, and the editor replaces
                          // the card — without them, editing a closed finding
                          // hides what closed it and invites a second record
                          // saying what the first already said.
                          closureEvidence={closureEvidenceFor(f)}
                          onCancel={() => setEditingFindingId(null)}
                          onSubmit={(patch, closureEvidence) => handleUpdateFinding(f.id, patch, closureEvidence, `Updated finding — ${patch.title}`)}
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
                          {f.assetId ? assetName(system, f.assetId) : "No asset named — tracked against the control"}
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
        </WizardPane>
      </WizardBody>
      )}

      {/* Save/Discard always live at the bottom — every edit above stages
          into the draft rather than committing, so this is the one place
          that actually persists (or throws away) what changed. Walk mode
          keeps its domain position and Skip alongside them, and gets the same
          Discard: it stages the identical draft, so withholding it there left
          a staged surface with no way back (5.7). */}
      {savedSummary ? (
        <WizardFooter
          position={`${savedSummary.length} change${savedSummary.length === 1 ? "" : "s"} recorded`}
          close={<Button onClick={onClose}>Close</Button>}
          primary={<Button variant="primary" onClick={() => setSavedSummary(null)}>Continue</Button>}
        />
      ) : (
        <WizardFooter
          position={walk
            ? `${walk.activeDomain} · ${walk.domains.find((d) => d.domain === walk.activeDomain)?.remaining ?? 0} left`
            : unsavedCount > 0
              ? `${unsavedCount} unsaved change${unsavedCount === 1 ? "" : "s"}`
              : "No unsaved changes"}
          hint={saveBlocker
            ? <InlineHint tone="warning">{saveBlocker}</InlineHint>
            : undefined}
          close={<Button onClick={requestClose}>Close</Button>}
          skip={walk?.onSkip ? <Button iconRight={ChevronRight} onClick={walk.onSkip}>Skip for now</Button> : undefined}
          discard={<Button disabled={unsavedCount === 0} onClick={discardDraft}>Discard</Button>}
          primary={(
            <Button
              variant="primary"
              icon={walk ? undefined : Check}
              iconRight={walk ? ChevronRight : undefined}
              disabled={!canSave}
              onClick={() => (savingAssessment ? commitAssessment(Boolean(walk)) : saveDraft())}
            >
              {saveLabel}
            </Button>
          )}
        />
      )}
      </WizardChrome>
    </Modal>
  );
}
