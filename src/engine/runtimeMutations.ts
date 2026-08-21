// Evaluating a control on a runtime-created system — the missing half of the
// Add System wizard's lifecycle. Creating a system + its assets already
// produces a real, scored system (provider-inheritance only, see
// AddSystemWizard.jsx); this is what lets a control move from
// provider-inherited-only to individually assessed with real evidence.
//
// Every function here is pure: it takes a RuntimeFacts object and returns a
// new one. Nothing here saves or reloads — callers dry-run the result through
// buildLiveEngine() exactly like AddSystemWizard.handleCreate() does, and
// only call saveRuntimeFacts() once that dry run is clean. That's what keeps
// this from becoming a second scoring path: the same validateGraph /
// validateDerivations that check every YAML-authored fact check these too.
//
// validateDerivations.ts's assessment-scope check is bidirectional (see its
// "declared, unsupported" / "supported, undeclared" comment) — a controlId in
// AssessmentScope.controlIds with nothing behind it fails as an "empty
// claim," and evidence/a mechanism/a not-implemented declaration with no
// matching scope entry fails as "scope creep." evaluateControl() below is the
// only function meant to be called directly for that reason: it always pairs
// the scope entry with at least one supporting fact in the same call.
import type { RuntimeFacts } from "./liveGraph";
import { YAML_FACTS } from "../graph/sources/yaml";
import type { AssetId, ControlId, EvidenceArtifactId, EvidenceId, SystemId } from "../graph/ids";
import type { ImplementationMechanism, NotImplemented, Responsibility } from "../graph/edges/controlImplementations";
import type { RawEvidence } from "../graph/nodes/evidence";
import type { EvidenceArtifact, EvidenceReview } from "../graph/nodes/evidenceProvenance";
import type { PrismaLevelOverride } from "../graph/edges/prismaOverrides";
import type { ControlReview } from "../graph/edges/controlReviews";
import type { Finding } from "../graph/nodes/findings";
import { nextEvidenceArtifactId, nextEvidenceId, nextEvidenceReviewId, nextFindingId } from "./runtimeFactsStore";

// Removes a wizard-created system and every runtime fact scoped to it. Baseline
// systems never reach this function from the UI; their authored graph records
// remain protected in YAML.
export function removeRuntimeSystem(runtime: RuntimeFacts, systemId: SystemId): RuntimeFacts {
  const assetIds = new Set(
    runtime.assets.filter((asset) => asset.systemId === systemId).map((asset) => asset.id)
  );
  const expectedClassification = { ...runtime.expectedClassification };
  const removedEvidenceIds = new Set(
    runtime.evidence
      .filter((entry) => entry.assetIds.some((assetId) => assetIds.has(assetId)))
      .map((entry) => entry.id)
  );
  const removedArtifactIds = new Set(
    runtime.evidence
      .filter((entry) => removedEvidenceIds.has(entry.id))
      .flatMap((entry) => entry.artifactIds ?? [])
  );
  const removedActorIds = new Set(
    runtime.actorAccess.filter((edge) => assetIds.has(edge.assetId)).map((edge) => edge.actorId)
  );
  delete expectedClassification[systemId];

  return {
    ...runtime,
    systems: runtime.systems.filter((system) => system.id !== systemId),
    assets: runtime.assets.filter((asset) => asset.systemId !== systemId),
    assetDataTypes: runtime.assetDataTypes.filter((edge) => !assetIds.has(edge.assetId)),
    actors: runtime.actors.filter((actor) => !removedActorIds.has(actor.id)),
    actorAccess: runtime.actorAccess.filter((edge) => !assetIds.has(edge.assetId)),
    dataFlows: runtime.dataFlows.filter((flow) => !assetIds.has(flow.from) && !assetIds.has(flow.to)),
    agenticIdentities: runtime.agenticIdentities.filter((agent) => agent.systemId !== systemId),
    assessmentScopes: runtime.assessmentScopes.filter((scope) => scope.systemId !== systemId),
    expectedClassification,
    implementationMechanisms: runtime.implementationMechanisms.filter((mechanism) => !assetIds.has(mechanism.assetId)),
    evidence: runtime.evidence.filter((entry) => !entry.assetIds.some((assetId) => assetIds.has(assetId))),
    evidenceArtifacts: runtime.evidenceArtifacts.filter((artifact) => !removedArtifactIds.has(artifact.id)),
    evidenceReviews: runtime.evidenceReviews.filter((review) => !removedEvidenceIds.has(review.evidenceId)),
    notImplemented: runtime.notImplemented.filter((entry) => !assetIds.has(entry.assetId)),
    prismaOverrides: runtime.prismaOverrides.filter((override) => override.systemId !== systemId),
    controlReviews: runtime.controlReviews.filter((review) => review.systemId !== systemId),
    findings: runtime.findings.filter((finding) => !assetIds.has(finding.assetId)),
    // System Register cockpit domains are keyed by system id alone, not by
    // asset — without these the rows outlive the system and the graph
    // validator rejects the delete ("systemId … is not a system").
    backupConfigs: runtime.backupConfigs.filter((config) => config.systemId !== systemId),
    drTests: runtime.drTests.filter((test) => test.systemId !== systemId),
    sdlcPostures: runtime.sdlcPostures.filter((posture) => posture.systemId !== systemId),
  };
}

// Drop runtime overrides of YAML-authored systems (SYS-003, SYS-042, …) so
// demo topology comes back, without deleting wizard-created test systems.
export function restoreBaselineSystems(runtime: RuntimeFacts, baselineSystemIds: ReadonlySet<SystemId>): RuntimeFacts {
  return [...baselineSystemIds].reduce(
    (current, systemId) => (current.systems.some((system) => system.id === systemId) ? removeRuntimeSystem(current, systemId) : current),
    runtime
  );
}

// Adds controlId to the given system's declared assessment scope, if it
// isn't there already. Runtime-created systems already carry a scope row.
// YAML-authored systems do not, so the YAML engagement is copied into
// runtime on first expansion — mergeFacts then replaces that system's YAML
// scope, which is what lets evaluateControl / addFinding close an unassessed
// control on a demo system without failing "scope creep."
export function addControlToScope(runtime: RuntimeFacts, systemId: SystemId, controlId: ControlId): RuntimeFacts {
  const scope = runtime.assessmentScopes.find((s) => s.systemId === systemId);
  if (scope) {
    if (scope.controlIds.includes(controlId)) return runtime;
    return {
      ...runtime,
      assessmentScopes: runtime.assessmentScopes.map((s) =>
        s.systemId === systemId ? { ...s, controlIds: [...s.controlIds, controlId] } : s
      ),
    };
  }
  const yamlScope = YAML_FACTS.assessmentScopes.find((s) => s.systemId === systemId);
  if (!yamlScope || yamlScope.controlIds.includes(controlId)) return runtime;
  return {
    ...runtime,
    assessmentScopes: [...runtime.assessmentScopes, { ...yamlScope, controlIds: [...yamlScope.controlIds, controlId] }],
  };
}

// ImplementationMechanism carries no id — the (assetId, controlId) pair is
// the key (graph.mechanismByPair) — so this replaces any existing record for
// that pair rather than appending a duplicate.
export function upsertImplementationMechanism(
  runtime: RuntimeFacts,
  mechanism: ImplementationMechanism
): RuntimeFacts {
  const withoutExisting = runtime.implementationMechanisms.filter(
    (m) => !(m.assetId === mechanism.assetId && m.controlId === mechanism.controlId)
  );
  return { ...runtime, implementationMechanisms: [...withoutExisting, mechanism] };
}

export type EvidenceArtifactDraft = Omit<EvidenceArtifact, "id">;

export type EvidenceReviewDraft = Omit<EvidenceReview, "id" | "evidenceId">;

export interface EvidenceDraft extends Omit<RawEvidence, "id" | "collectedAt" | "artifactIds" | "recordStatus"> {
  collectedAt?: string;
  artifacts?: EvidenceArtifactDraft[];
  existingArtifactIds?: EvidenceArtifactId[];
  review?: EvidenceReviewDraft;
}

export type ControlEvidenceDraft = Omit<EvidenceDraft, "controlId">;

// Assigns an id and defaults collectedAt to today, then appends. Evidence
// records are never upserted-by-pair like a mechanism — a control can (and
// usually does) accumulate more than one evidence record over time.
export function addEvidence(runtime: RuntimeFacts, draft: EvidenceDraft): RuntimeFacts {
  const id = nextEvidenceId(runtime);
  let withProvenance = runtime;
  const artifactIds: EvidenceArtifactId[] = [];
  (draft.artifacts ?? []).forEach((artifactDraft) => {
    const artifactId = nextEvidenceArtifactId(withProvenance);
    withProvenance = {
      ...withProvenance,
      evidenceArtifacts: [...withProvenance.evidenceArtifacts, { ...artifactDraft, id: artifactId }],
    };
    artifactIds.push(artifactId);
  });
  const { artifacts: _artifacts, existingArtifactIds, review, ...observationDraft } = draft;
  const evidence: RawEvidence = {
    ...observationDraft,
    id: id as RawEvidence["id"],
    collectedAt: draft.collectedAt ?? new Date().toISOString().slice(0, 10),
    artifactIds: [...(existingArtifactIds ?? []), ...artifactIds].length > 0
      ? [...(existingArtifactIds ?? []), ...artifactIds]
      : undefined,
    recordStatus: "active",
  };
  let next: RuntimeFacts = { ...withProvenance, evidence: [...withProvenance.evidence, evidence] };
  if (review) {
    next = {
      ...next,
      evidenceReviews: [...next.evidenceReviews, { ...review, id: nextEvidenceReviewId(next), evidenceId: id }],
    };
  }
  return next;
}

// Evidence records are runtime-owned only when they live in runtime.evidence
// (id prefix EVD-USR-, see nextEvidenceId) — YAML-authored evidence is never
// part of RuntimeFacts, so these two functions are structurally incapable of
// reaching it. Updates append a successor and retire the prior version; removal
// records a withdrawal. Neither operation destroys the audit history.
export function updateEvidence(runtime: RuntimeFacts, evidenceId: EvidenceId, patch: Partial<EvidenceDraft>): RuntimeFacts {
  const previous = runtime.evidence.find((e) => e.id === evidenceId);
  if (!previous) return runtime;
  const evidence = runtime.evidence.map((entry) =>
    entry.id === evidenceId ? { ...entry, recordStatus: "superseded" as const } : entry
  );
  const { id: _id, recordStatus: _status, supersedesId: _supersedes, artifactIds: _artifactIds, ...priorDraft } = previous;
  return addEvidence(
    { ...runtime, evidence },
    {
      ...priorDraft,
      ...patch,
      artifacts: patch.artifacts,
      existingArtifactIds: previous.artifactIds,
      review: patch.review,
      supersedesId: evidenceId,
    } as EvidenceDraft
  );
}

export function removeEvidence(runtime: RuntimeFacts, evidenceId: EvidenceId): RuntimeFacts {
  return {
    ...runtime,
    evidence: runtime.evidence.map((entry) =>
      entry.id === evidenceId ? { ...entry, recordStatus: "withdrawn" as const } : entry
    ),
  };
}

// Same replace-by-key semantics as upsertImplementationMechanism — validate.ts
// rejects more than one override per (systemId, controlId, level), so a
// second override for the same lane replaces the first rather than stacking.
export function addPrismaOverride(runtime: RuntimeFacts, override: PrismaLevelOverride): RuntimeFacts {
  const withoutExisting = runtime.prismaOverrides.filter(
    (o) => !(o.systemId === override.systemId && o.controlId === override.controlId && o.level === override.level)
  );
  return { ...runtime, prismaOverrides: [...withoutExisting, override] };
}

export function upsertControlReview(runtime: RuntimeFacts, review: ControlReview): RuntimeFacts {
  const withoutExisting = runtime.controlReviews.filter(
    (r) => !(r.systemId === review.systemId && r.controlId === review.controlId)
  );
  return { ...runtime, controlReviews: [...withoutExisting, review] };
}

// Same replace-by-pair semantics as upsertImplementationMechanism — a pair is
// either declared not implemented or it isn't, never twice.
export function declareNotImplemented(runtime: RuntimeFacts, notImplemented: NotImplemented): RuntimeFacts {
  const withoutExisting = runtime.notImplemented.filter(
    (n) => !(n.assetId === notImplemented.assetId && n.controlId === notImplemented.controlId)
  );
  return { ...runtime, notImplemented: [...withoutExisting, notImplemented] };
}

export type FindingDraft = Omit<Finding, "id">;

// Assigns an id and appends — findings are never upserted-by-pair, a control
// can accumulate more than one open finding over time same as evidence.
export function addFinding(runtime: RuntimeFacts, draft: FindingDraft, systemId?: SystemId): RuntimeFacts {
  const id = nextFindingId(runtime);
  const finding: Finding = { ...draft, id: id as Finding["id"] };
  const next = { ...runtime, findings: [...runtime.findings, finding] };
  return systemId ? addControlToScope(next, systemId, draft.controlId) : next;
}

export function updateFinding(runtime: RuntimeFacts, findingId: Finding["id"], patch: Partial<FindingDraft>): RuntimeFacts {
  return {
    ...runtime,
    findings: runtime.findings.map((finding) => {
      if (finding.id !== findingId) return finding;
      const remediationStatus = patch.remediationStatus ?? finding.remediationStatus;
      return {
        ...finding,
        ...patch,
        id: finding.id,
        closedDate: remediationStatus === "Complete"
          ? (patch.closedDate ?? finding.closedDate ?? new Date().toISOString().slice(0, 10))
          : undefined,
      };
    }),
  };
}

export interface EvaluateControlInput {
  systemId: SystemId;
  controlId: ControlId;
  mechanism?: { assetId: AssetId; mechanism: string; responsibility?: Responsibility; provider?: string };
  evidenceEntries?: ControlEvidenceDraft[];
  notImplemented?: { assetId: AssetId; reason: string };
}

// The one function a future "evaluate this control" UI actually calls.
// Composes the above so the control always lands in scope together with
// whatever supports that claim — never scope-only, which would fail
// validateDerivations's "empty claim" check the moment this is dry-run.
export function evaluateControl(runtime: RuntimeFacts, input: EvaluateControlInput): RuntimeFacts {
  const { systemId, controlId, mechanism, evidenceEntries, notImplemented } = input;
  if (!mechanism && !(evidenceEntries && evidenceEntries.length > 0) && !notImplemented) {
    throw new Error("evaluateControl: at least one of mechanism, evidenceEntries, or notImplemented is required");
  }

  let next = addControlToScope(runtime, systemId, controlId);

  if (mechanism) {
    next = upsertImplementationMechanism(next, {
      assetId: mechanism.assetId, controlId,
      responsibility: mechanism.responsibility, provider: mechanism.provider,
      mechanism: mechanism.mechanism,
    });
  }

  (evidenceEntries ?? []).forEach((draft) => {
    next = addEvidence(next, { ...draft, controlId });
  });

  if (notImplemented) {
    next = declareNotImplemented(next, { assetId: notImplemented.assetId, controlId, reason: notImplemented.reason });
  }

  return next;
}
