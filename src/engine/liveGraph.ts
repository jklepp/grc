// Merges runtime-created facts (from the Add System wizard) with the YAML
// baseline and builds a real engine over the result — the same assembleGraph
// / validateGraph / createEngine / validateDerivations pipeline every
// YAML-authored system goes through, never a second scoring path.
//
// The two-pass build below exists for two reasons, both the same shape:
// something is true about a new system before anyone declares it, and this
// app's hard rule is that a derived or enterprise-wide fact is never
// hand-typed by a user. Pass one builds an engine (with validateDerivations
// switched off) purely to read off what those facts WOULD be; the answers are
// written into the candidate facts as if they had always been there, and pass
// two builds the real, fully-checked engine over the corrected result.
//
//   classification         the user is never asked what it is, only what the
//                          asset touches — expectedClassification is filled
//                          in from what pass one derives.
//   enterprise-wide scope  four of the seven program-scoped key controls
//                          (see program-applicability.yaml) apply to every
//                          system and already carry enterprise-wide evidence
//                          (assetIds: []) that "supports" any system they
//                          become applicable to — the same fact YAML-authored
//                          systems already declare in their own scope.
//                          A brand-new system's scope starts empty, so
//                          without this correction it would fail
//                          validateDerivations's "supported, undeclared"
//                          check the instant it became applicable to one of
//                          them — not a data problem the user caused, an
//                          enterprise fact nobody told the new system about
//                          yet.
import { assembleGraph } from "../graph/assemble";
import { validateGraph } from "../graph/validate";
import { createEngine, type Engine } from "./create";
import { validateDerivations } from "./validateDerivations";
import type { GraphFacts } from "../graph/types";
import type { System } from "../graph/nodes/systems";
import { BACKUP_RECOVERY_KINDS, type Asset } from "../graph/nodes/assets";
import { FLOW_KINDS, type DataFlow } from "../graph/edges/dataFlows";
import type { AssetDataType } from "../graph/edges/assetDataTypes";
import type { Actor } from "../graph/nodes/actors";
import type { ActorAccess } from "../graph/edges/actorAccess";
import type { AgenticIdentity } from "../graph/nodes/agenticIdentities";
import type { AssessmentScope } from "../graph/nodes/assessmentScope";
import type { ImplementationMechanism, NotImplemented } from "../graph/edges/controlImplementations";
import type { RawEvidence } from "../graph/nodes/evidence";
import type { EvidenceArtifact, EvidenceReview } from "../graph/nodes/evidenceProvenance";
import type { PrismaLevelOverride } from "../graph/edges/prismaOverrides";
import type { ControlReview } from "../graph/edges/controlReviews";
import type { Finding } from "../graph/nodes/findings";
import type { SystemId } from "../graph/ids";
import type { ClassificationTier } from "../graph/nodes/taxonomy";
import type { BackupConfig, DrTest } from "../graph/nodes/resilience";
import type { SdlcPosture } from "../graph/nodes/sdlc";

export interface RuntimeFacts {
  systems: System[];
  assets: Asset[];
  assetDataTypes: AssetDataType[];
  actors: Actor[];
  actorAccess: ActorAccess[];
  dataFlows: DataFlow[];
  agenticIdentities: AgenticIdentity[];
  assessmentScopes: AssessmentScope[];
  expectedClassification: Record<SystemId, ClassificationTier>;
  // What a runtime system's controls are actually evaluated against — absent
  // until someone calls the evaluateControl helpers in runtimeMutations.ts,
  // same as their YAML-authored counterparts being authored sparsely. A YAML
  // system can also grow a runtime scope row when a walk expands it.
  implementationMechanisms: ImplementationMechanism[];
  evidence: RawEvidence[];
  evidenceArtifacts: EvidenceArtifact[];
  evidenceReviews: EvidenceReview[];
  notImplemented: NotImplemented[];
  prismaOverrides: PrismaLevelOverride[];
  controlReviews: ControlReview[];
  findings: Finding[];
  // System Register cockpit posture — sparse (0-or-1 backup config / SDLC
  // posture row per system, any number of DR tests). A brand-new system has
  // none of these until someone runs a DR test or records SDLC controls; a
  // cloned system starts from its source's rows (see AddSystemWizard's
  // buildCandidateRuntimeFacts) rather than silently losing them the way an
  // earlier version of the clone did.
  backupConfigs: BackupConfig[];
  drTests: DrTest[];
  sdlcPostures: SdlcPosture[];
}

export function emptyRuntimeFacts(): RuntimeFacts {
  return {
    systems: [], assets: [], assetDataTypes: [], actors: [], actorAccess: [], dataFlows: [], agenticIdentities: [], assessmentScopes: [], expectedClassification: {},
    implementationMechanisms: [], evidence: [], evidenceArtifacts: [], evidenceReviews: [], notImplemented: [], prismaOverrides: [], controlReviews: [], findings: [],
    backupConfigs: [], drTests: [], sdlcPostures: [],
  };
}

// Runtime system rows are upserts rather than append-only records. This keeps
// user-created systems simple (there is no matching baseline row) while also
// letting the system editor safely replace a YAML-authored boundary, its
// assets, data mappings, and assessment scope after the candidate graph has
// passed the same validation pipeline as every other change.
// Limitation: a curated (YAML) asset shared across more than one system's
// systemIds is entirely dropped from whichever overridden system it's
// filtered out under below — its membership in a system NOT being edited is
// not preserved. Shared assets are curated facts, not wizard-editable, in
// this iteration; the wizard only creates/edits single-system assets (see
// AddSystemWizard.tsx, which always writes a one-element systemIds array).
export function mergeFacts(base: GraphFacts, runtime: RuntimeFacts): GraphFacts {
  const overriddenSystemIds = new Set(runtime.systems.map((s) => s.id));
  const overriddenBaseAssetIds = new Set(
    base.assets.filter((a) => a.systemIds.some((sid) => overriddenSystemIds.has(sid))).map((a) => a.id)
  );
  const runtimeAssetSystemIds = new Map(
    runtime.assets.map((asset) => [asset.id, asset.systemIds[0]] as const)
  );
  const overriddenArchitectureSystemIds = new Set<SystemId>(
    runtime.agenticIdentities.map((identity) => identity.systemId)
  );
  for (const edge of runtime.actorAccess) {
    const systemId = runtimeAssetSystemIds.get(edge.assetId);
    if (systemId) overriddenArchitectureSystemIds.add(systemId);
  }
  for (const flow of runtime.dataFlows) {
    const systemId = runtimeAssetSystemIds.get(flow.from) ?? runtimeAssetSystemIds.get(flow.to);
    if (systemId) overriddenArchitectureSystemIds.add(systemId);
  }
  // Saved overrides created before runtime architecture authoring have empty
  // architecture arrays. Preserve their baseline topology so an old system
  // edit cannot silently erase actors, ingress, or data-flow lanes.
  const overriddenArchitectureAssetIds = new Set(
    base.assets
      .filter((asset) => asset.systemIds.some((sid) => overriddenArchitectureSystemIds.has(sid)))
      .map((asset) => asset.id)
  );
  const runtimeActorIds = new Set(runtime.actors.map((actor) => actor.id));
  const runtimeAssetIds = new Set(runtime.assets.map((asset) => asset.id));
  // The wizard cannot currently re-author recovery infrastructure. Replacing a
  // YAML system used to drop backup-vault assets (and then prune their
  // backup/restore edges), which removed the Backup & Recovery lane from the
  // architecture diagram. Keep those baseline vaults — and the flows that
  // name them — unless the runtime explicitly re-authored the same asset id.
  const preservedRecoveryAssets = base.assets.filter(
    (asset) =>
      asset.systemIds.some((sid) => overriddenSystemIds.has(sid))
      && (BACKUP_RECOVERY_KINDS as readonly string[]).includes(asset.kind)
      && !runtimeAssetIds.has(asset.id)
  );
  const preservedRecoveryIds = new Set(preservedRecoveryAssets.map((asset) => asset.id));
  const isRecoveryFlow = (flow: DataFlow) => flow.kind === FLOW_KINDS.BACKUP || flow.kind === FLOW_KINDS.RESTORE;
  // Scope rows can land in runtime without a matching runtime system — that
  // is how evaluateControl expands a YAML-authored engagement. Replace the
  // YAML scope for those systems the same way a wizard-created system is
  // replaced, so the declared list and the supporting facts stay paired.
  const overriddenScopeSystemIds = new Set([
    ...overriddenSystemIds,
    ...runtime.assessmentScopes.map((scope) => scope.systemId),
  ]);
  return pruneDanglingAssetEdges({
    ...base,
    systems: [...base.systems.filter((s) => !overriddenSystemIds.has(s.id)), ...runtime.systems],
    assets: [
      ...base.assets.filter((a) => !a.systemIds.some((sid) => overriddenSystemIds.has(sid)) || preservedRecoveryIds.has(a.id)),
      ...runtime.assets,
    ],
    assetDataTypes: [
      ...base.assetDataTypes.filter((edge) => !overriddenBaseAssetIds.has(edge.assetId) || preservedRecoveryIds.has(edge.assetId)),
      ...runtime.assetDataTypes,
    ],
    actors: [...base.actors.filter((actor) => !runtimeActorIds.has(actor.id)), ...runtime.actors],
    actorAccess: [...base.actorAccess.filter((edge) => !overriddenArchitectureAssetIds.has(edge.assetId)), ...runtime.actorAccess],
    dataFlows: [
      ...base.dataFlows.filter((flow) => {
        if (isRecoveryFlow(flow) && (preservedRecoveryIds.has(flow.from) || preservedRecoveryIds.has(flow.to))) {
          return !runtime.dataFlows.some((candidate) => candidate.id === flow.id);
        }
        return !overriddenArchitectureAssetIds.has(flow.from) && !overriddenArchitectureAssetIds.has(flow.to);
      }),
      ...runtime.dataFlows,
    ],
    agenticIdentities: [...base.agenticIdentities.filter((agent) => !overriddenArchitectureSystemIds.has(agent.systemId)), ...runtime.agenticIdentities],
    assessmentScopes: [...base.assessmentScopes.filter((scope) => !overriddenScopeSystemIds.has(scope.systemId)), ...runtime.assessmentScopes],
    expectedClassification: { ...base.expectedClassification, ...runtime.expectedClassification },
    implementationMechanisms: [...base.implementationMechanisms, ...runtime.implementationMechanisms],
    evidence: [...base.evidence, ...runtime.evidence],
    evidenceArtifacts: [...base.evidenceArtifacts, ...runtime.evidenceArtifacts],
    evidenceReviews: [...base.evidenceReviews, ...runtime.evidenceReviews],
    notImplemented: [...base.notImplemented, ...runtime.notImplemented],
    prismaOverrides: [...base.prismaOverrides, ...runtime.prismaOverrides],
    controlReviews: [
      ...base.controlReviews.filter((review) => !runtime.controlReviews.some((r) => r.systemId === review.systemId && r.controlId === review.controlId)),
      ...runtime.controlReviews,
    ],
    findings: [...base.findings, ...runtime.findings],
    // Sparse, at most one row per system — replace (never append to) the
    // baseline row for any system runtime declares one for, the same
    // "supersede by systemId" discipline assessmentScopes above uses.
    backupConfigs: [
      ...base.backupConfigs.filter((b) => !runtime.backupConfigs.some((r) => r.systemId === b.systemId)),
      ...runtime.backupConfigs,
    ],
    drTests: [
      ...base.drTests.filter((t) => !overriddenSystemIds.has(t.systemId)),
      ...runtime.drTests,
    ],
    sdlcPostures: [
      ...base.sdlcPostures.filter((p) => !runtime.sdlcPostures.some((r) => r.systemId === p.systemId)),
      ...runtime.sdlcPostures,
    ],
  });
}

// Drop edges that point at assets the merge no longer carries — leftover YAML
// flows after a system replacement, except recovery infrastructure which
// mergeFacts now preserves explicitly.
function pruneDanglingAssetEdges(facts: GraphFacts): GraphFacts {
  const assetIds = new Set(facts.assets.map((asset) => asset.id));
  const hasAsset = (id: string) => assetIds.has(id);
  return {
    ...facts,
    dataFlows: facts.dataFlows.filter((flow) => hasAsset(flow.from) && hasAsset(flow.to)),
    assetDataTypes: facts.assetDataTypes.filter((edge) => hasAsset(edge.assetId)),
    actorAccess: facts.actorAccess.filter((edge) => hasAsset(edge.assetId)),
    implementationMechanisms: facts.implementationMechanisms.filter((mechanism) => hasAsset(mechanism.assetId)),
    operatingHistory: facts.operatingHistory.filter((entry) => hasAsset(entry.assetId)),
    notImplemented: facts.notImplemented.filter((entry) => hasAsset(entry.assetId)),
    ownerOverrides: facts.ownerOverrides.filter((entry) => hasAsset(entry.assetId)),
    implementationOverrides: facts.implementationOverrides.filter((entry) => hasAsset(entry.assetId)),
    findings: facts.findings.filter((finding) => hasAsset(finding.assetId)),
    evidence: facts.evidence.filter((entry) => entry.assetIds.every(hasAsset)),
    riskAssets: facts.riskAssets.filter((edge) => hasAsset(edge.assetId)),
    applicabilityExceptions: facts.applicabilityExceptions.filter((entry) => hasAsset(entry.assetId)),
  };
}

export interface BuildLiveEngineResult {
  engine: Engine | null;
  problems: string[];
}

// The one function used for both the wizard's pre-submit dry run and the real
// save — see the module comment for why this is a two-pass build.
export function buildLiveEngine(baseFacts: GraphFacts, runtime: RuntimeFacts): BuildLiveEngineResult {
  const firstPassFacts = mergeFacts(baseFacts, runtime);
  let graph;
  try {
    graph = assembleGraph(firstPassFacts);
  } catch (err) {
    return { engine: null, problems: [err instanceof Error ? err.message : String(err)] };
  }
  const structuralProblems = validateGraph(graph, { throwOnFailure: false });
  if (structuralProblems.length > 0) return { engine: null, problems: structuralProblems };

  const trialEngine = createEngine(graph, { validate: false });

  const correctedExpectedClassification = { ...runtime.expectedClassification };
  runtime.systems.forEach((s) => {
    if (Object.hasOwn(correctedExpectedClassification, s.id)) return;
    const derived = trialEngine.classification.systemClassification(s.id);
    if (derived) correctedExpectedClassification[s.id] = derived as ClassificationTier;
  });

  // Same predicate validateDerivations's "supported, undeclared" check uses
  // (see validateDerivations.ts's assessment-scope section) — evidence with
  // no assetIds is enterprise-wide by construction (validate.ts requires a
  // program-scoped control's evidence to name no assets), so it supports
  // whichever systems the control is applicable to, not just the ones that
  // happened to exist when it was recorded.
  const enterpriseSupportedControlIds = new Set(
    graph.evidence
      .filter((e) => e.assetIds.length === 0 && (e.prismaLevel ?? "Implemented") === "Implemented")
      .map((e) => e.controlId)
  );
  // Correct every system's scope, not just the ones already overridden in
  // runtime: a YAML-authored system the user never touched keeps its YAML
  // scope, and recording program evidence elsewhere would otherwise fail its
  // "supported, undeclared" check. A YAML scope needing additions is copied
  // into runtime copy-on-write, the same way addControlToScope does it;
  // untouched YAML scopes stay out of runtime entirely.
  const runtimeScopeSystemIds = new Set(runtime.assessmentScopes.map((s) => s.systemId));
  const allScopes = [
    ...runtime.assessmentScopes,
    ...baseFacts.assessmentScopes.filter((s) => !runtimeScopeSystemIds.has(s.systemId)),
  ];
  const correctedAssessmentScopes: RuntimeFacts["assessmentScopes"] = [];
  allScopes.forEach((scope) => {
    const applicableIds = new Set(
      trialEngine.applicability.applicableControlsForSystem(scope.systemId).map((c) => c.id)
    );
    const isRuntimeOwned = runtimeScopeSystemIds.has(scope.systemId);
    // A wizard-owned scope is corrected in both directions: enterprise-wide
    // evidence adds a control the moment it becomes applicable (below), and
    // an edit that changes what applies to the system (dropping AI usage or
    // an AI-kind asset, say) drops a control that no longer belongs — the
    // wizard carries the old scope's controlIds forward verbatim on edit, so
    // without this a stale entry fails "not applicable to that system" on the
    // next save, for a control the operator never touched. A YAML-curated
    // engagement's declared list is never pruned this way — see the
    // "supported, undeclared" comment above for why that stays a loud
    // validator failure instead of a silent correction.
    const prunedControlIds = isRuntimeOwned
      ? scope.controlIds.filter((id) => applicableIds.has(id))
      : scope.controlIds;
    const additions = [...enterpriseSupportedControlIds].filter(
      (id) => applicableIds.has(id) && !prunedControlIds.includes(id)
    );
    if (prunedControlIds.length !== scope.controlIds.length || additions.length > 0) {
      correctedAssessmentScopes.push({ ...scope, controlIds: [...prunedControlIds, ...additions] });
    } else if (isRuntimeOwned) {
      correctedAssessmentScopes.push(scope);
    }
  });

  const correctedRuntime: RuntimeFacts = {
    ...runtime,
    expectedClassification: correctedExpectedClassification,
    assessmentScopes: correctedAssessmentScopes,
  };

  const finalFacts = mergeFacts(baseFacts, correctedRuntime);
  let finalGraph;
  try {
    finalGraph = assembleGraph(finalFacts);
  } catch (err) {
    return { engine: null, problems: [err instanceof Error ? err.message : String(err)] };
  }
  const finalStructuralProblems = validateGraph(finalGraph, { throwOnFailure: false });
  if (finalStructuralProblems.length > 0) return { engine: null, problems: finalStructuralProblems };

  const engine = createEngine(finalGraph, { validate: false });
  const derivationProblems = validateDerivations(engine, { throwOnFailure: false });
  if (derivationProblems.length > 0) return { engine: null, problems: derivationProblems };

  return { engine, problems: [] };
}
