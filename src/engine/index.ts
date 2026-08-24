// The one import path pages use.
//
// Pages consume a DEFAULT ENGINE built over ACME's facts. That default is the
// only thing in the app that picks a dataset; everything below it takes its
// graph as an argument. Keeping the page-facing names identical to what they
// were before the seam existed is deliberate — 22 page and component files
// import from here, and none of them should have to know that the engine
// became constructible, or that loading it became asynchronous.
//
// To work with a different dataset (a test's synthetic graph, a prior revision,
// another tenant), don't reach for these bindings — build your own:
//
//   import { loadGraph } from "../graph/load";
//   import { createEngine } from "./create";
//   const engine = createEngine(loadGraph(facts), { ctx: { now: new Date("2026-01-01") } });
//
// ---- WHY THE BINDINGS BELOW ARE `let` -----------------------------------------
//
// They used to be `const`, initialised from an engine this module built while it
// was being imported. That made three things true that a real deployment cannot
// satisfy:
//
//   1. Facts had to be available synchronously, which meant every fact file was
//      inlined into the main bundle and parsed before first paint. A database or
//      an API answers over a network; there is no synchronous version of that.
//   2. Exactly one engine could exist, created at import time, so there was no
//      point at which a tenant, a session, or a point-in-time could be chosen.
//   3. Half the surface silently disagreed with the other half. Bindings copied
//      straight off the first engine kept answering from it forever, while the
//      dozen that were hand-wrapped as `(...args) => engine.x(...args)` followed
//      each runtime commit. Adding a system refreshed some pages and not others.
//
// So the surface is now declared here and assigned by publish(), which runs once
// when initEngine() resolves and again after every runtime commit. Because ES
// module bindings are live, importers see each new value without re-importing —
// and all of the surface moves together, which fixes (3) as a side effect.
//
// Nothing here is readable until initEngine() has resolved. That is enforced by
// the boot sequence rather than by defensive checks in 22 files: src/Boot.tsx
// awaits initEngine() before it renders anything that imports this module.
import { loadGraph } from "../graph/load";
import { createEngine } from "./create";
import { buildLiveEngine } from "./liveGraph";
import { setBaseFacts, baseFacts, hasBaseFacts } from "./baseFacts";
import { loadRuntimeFacts, hasRuntimeFacts, saveRuntimeFacts } from "./runtimeFactsStore";
import type { RuntimeFacts } from "./liveGraph";
import type { Engine } from "./create";
import type { GraphFacts } from "../graph/types";

// ---- Lifecycle ----------------------------------------------------------------

let engine: Engine | null = null;
const engineListeners = new Set<() => void>();

// The facts are fetched with a dynamic import so the dataset lands in its own
// chunk instead of the entry bundle. Keep it that way: a static
// `import { YAML_FACTS } from "../graph/sources/yaml"` anywhere in the module
// graph undoes both the code split and the asynchrony, because the YAML source
// parses all 54 fact files at module-evaluation time. Anything that needs the
// authored facts should call baseFacts() instead.
let initPromise: Promise<void> | null = null;

export function initEngine(): Promise<void> {
  if (!initPromise) initPromise = boot();
  return initPromise;
}

async function boot(): Promise<void> {
  const { YAML_FACTS } = await import("../graph/sources/yaml");
  setBaseFacts(YAML_FACTS);

  // If the Add System wizard has saved anything, rebuild over the authored
  // facts plus those runtime facts so a reload reconstructs the same live
  // dataset the user had. Persisted facts already passed buildLiveEngine's
  // validation once (the wizard would not have saved otherwise), but a later
  // change to the validators could in principle invalidate an old blob — fall
  // back to the authored-only engine rather than let a stale localStorage entry
  // break the app.
  const runtimeFacts = loadRuntimeFacts();
  if (hasRuntimeFacts(runtimeFacts)) {
    const { engine: liveEngine, problems } = buildLiveEngine(YAML_FACTS, runtimeFacts);
    if (liveEngine) {
      publish(liveEngine);
      return;
    }
    console.warn(
      "grc-runtime-facts: persisted systems failed validation, falling back to the authored dataset:",
      problems
    );
  }

  publish(createEngine(loadGraph(YAML_FACTS)));
}

export function isEngineReady(): boolean {
  return engine !== null;
}

// Throws rather than returning null, for the same reason baseFacts() does: no
// page renders before initEngine() resolves, so a null engine here is a broken
// boot sequence, not a state worth branching on in every caller.
export function getLiveEngine(): Engine {
  if (!engine) {
    throw new Error("getLiveEngine() called before initEngine() resolved — see src/Boot.tsx");
  }
  return engine;
}

export function subscribeToLiveEngine(listener: () => void): () => void {
  engineListeners.add(listener);
  return () => engineListeners.delete(listener);
}

export function commitRuntimeFacts(runtime: RuntimeFacts): { engine: Engine | null; problems: string[] } {
  const result = buildLiveEngine(baseFacts(), runtime);
  if (!result.engine) return result;
  saveRuntimeFacts(runtime);
  publish(result.engine);
  return result;
}

export { baseFacts } from "./baseFacts";
export { createEngine } from "./create";
export { loadGraph } from "../graph/load";
export type { Engine } from "./create";
export type { EngineContext } from "./context";
export type { Graph, GraphFacts } from "../graph/types";

// ---- Page-facing surface ------------------------------------------------------
// Declared here, assigned in publish(). The type of each is read off the Engine
// type rather than restated, so a signature change in an engine module is a
// compile error here instead of a silently widened page-facing contract.

type Sel = Engine["selectors"];
type Cmp = Engine["compliance"];
type App = Engine["applicability"];
type Prof = Engine["profile"];
type Rsk = Engine["risk"];
type Fnd = Engine["findings"];
type Rol = Engine["rollups"];
type Rev = Engine["review"];
type Exc = Engine["exceptions"];
type G = Engine["graph"];

// Entity access
export let getAsset: Sel["getAsset"];
export let getSystem: Sel["getSystem"];
export let getRisk: Sel["getRisk"];
export let getDataType: Sel["getDataType"];
export let getControl: Sel["getControl"];
export let getEvidence: Sel["getEvidence"];
export let getEvidenceArtifacts: Sel["getEvidenceArtifacts"];
export let getEvidenceReviews: Sel["getEvidenceReviews"];
export let getAllAssets: Sel["getAllAssets"];
export let getAllSystems: Sel["getAllSystems"];
export let getAllRisks: Sel["getAllRisks"];
export let getAllDataTypes: Sel["getAllDataTypes"];
export let getAllKeyControls: Sel["getAllKeyControls"];
export let getAllEvidence: Sel["getAllEvidence"];
export let getEnterprise: Sel["getEnterprise"];
export let getCategoryAverages: Sel["getCategoryAverages"];

// Traversal
export let getInstancesForAsset: Sel["getInstancesForAsset"];
export let getInstance: Sel["getInstance"];
export let getControlAssessments: Sel["getControlAssessments"];
export let getApplicability: Sel["getApplicability"];
export let getApplicabilityProfile: Sel["getApplicabilityProfile"];
export let getDataFlows: Sel["getDataFlows"];
export let getNeighbors: Sel["getNeighbors"];
export let flowsFrom: Sel["flowsFrom"];
export let flowsTo: Sel["flowsTo"];
export let flowsCarrying: Sel["flowsCarrying"];
export let dataForAsset: Sel["dataForAsset"];
export let dataTypesForSystem: Sel["dataTypesForSystem"];
export let assetsHoldingDataType: Sel["assetsHoldingDataType"];
export let assetClassification: Sel["assetClassification"];
export let assetsForSystem: Sel["assetsForSystem"];
export let requiredControlsForAsset: Sel["requiredControlsForAsset"];
export let assetsRequiringControl: Sel["assetsRequiringControl"];
export let allExceptions: Sel["allExceptions"];
export let evidenceFor: Sel["evidenceFor"];
export let risksForAssetRollup: Sel["risksForAssetRollup"];
export let explain: Sel["explain"];
export let modelHealth: Sel["modelHealth"];

// Compliance
export let systemControlMatrix: Sel["systemControlMatrix"];
export let systemCoverageBreakdown: Sel["systemCoverageBreakdown"];
export let systemStandardMappings: Sel["systemStandardMappings"];
export let clauseCoverage: Sel["clauseCoverage"];
export let controlCoverageForSystem: Sel["controlCoverageForSystem"];
export let frameworkPosture: Sel["frameworkPosture"];
export let FRAMEWORK_POSTURE: Cmp["FRAMEWORK_POSTURE"];
export let ENTERPRISE_COVERAGE: Cmp["ENTERPRISE_COVERAGE"];
export let IN_SCOPE_FRAMEWORKS: Cmp["IN_SCOPE_FRAMEWORKS"];
export let SYSTEM_COVERAGE: Cmp["SYSTEM_COVERAGE"];
export let programControlReach: Cmp["programControlReach"];
export let responsibilityForControl: Cmp["responsibilityForControl"];
export let notApplicableControlsForSystem: Cmp["notApplicableControlsForSystem"];
export let controlApplicabilitySummary: Cmp["controlApplicabilitySummary"];
export let pendingControlsForSystem: App["pendingControlsForSystem"];
export let resolveProgramApplicability: App["resolveProgramApplicability"];
export { STATUS_RANK } from "./compliance";

// Profile
export let CONTROL_PROFILES: Prof["CONTROL_PROFILES"];
export let tierTargetScore: Prof["tierTargetScore"];
export let evaluateSystemAgainstProfile: Prof["evaluateSystemAgainstProfile"];
export let profileSummary: Prof["profileSummary"];

// Risk
export let MATERIAL_RISKS: Rsk["MATERIAL_RISKS"];
export let MATERIAL_RISK_EXPOSURE: Rsk["MATERIAL_RISK_EXPOSURE"];
export let ABOVE_APPETITE_COUNT: Rsk["ABOVE_APPETITE_COUNT"];
export let QUANTIFIED_EXPOSURE: Rsk["QUANTIFIED_EXPOSURE"];
export let risksForSystem: Rsk["risksForSystem"];
export let topRisksForSystem: Rsk["topRisksForSystem"];

// Findings
export let ALL_FINDINGS: Fnd["ALL_FINDINGS"];
export let findingsForSystem: Fnd["findingsForSystem"];
export let findingsForAsset: Fnd["findingsForAsset"];
export let findingsForRisk: Fnd["findingsForRisk"];
export let openFindingsForSource: Fnd["openFindingsForSource"];

// System Register cockpit domains
export let identityPostureForSystem: Engine["identity"]["identityPostureForSystem"];
export let exposureForSystem: Engine["exposure"]["exposureForSystem"];
export let EXCEPTION_REGISTER: Exc["exceptionRegister"];
export let EXCEPTION_SUMMARY: Exc["exceptionSummary"];
export let exceptionsForSystem: Exc["exceptionsForSystem"];
export let vulnerabilitiesForSystem: Engine["vulnerabilities"]["vulnerabilitiesForSystem"];
export let securityTestsForSystem: Engine["securityTesting"]["securityTestsForSystem"];
export let resilienceForSystem: Engine["resilience"]["resilienceForSystem"];
export let irForSystem: Engine["incidentResponse"]["irForSystem"];
export let vendorsForSystem: Engine["vendors"]["vendorsForSystem"];
export let sdlcForSystem: Engine["sdlc"]["sdlcForSystem"];
export let cockpitSummary: Engine["cockpit"]["cockpitSummary"];

export let wavesForSystem: Rev["wavesForSystem"];
export let auditReadinessForSystem: Rev["auditReadinessForSystem"];

// Rollup totals
export let TOTAL_FLOW_COUNT: Rol["TOTAL_FLOW_COUNT"];
export let TOTAL_ACTOR_COUNT: Rol["TOTAL_ACTOR_COUNT"];

// Graph nodes pages read directly (reference data, not derivations)
export let ACTORS: G["actors"];
export let ACTOR_BY_ID: G["actorById"];
export let ORGS: G["orgs"];
export let ORG_BY_ID: G["orgById"];
export let EVIDENCE_SOURCES: G["evidenceSources"];
export let EVIDENCE_SOURCE_BY_ID: G["evidenceSourceById"];
export let IN_SCOPE_CONTROLS: G["inScopeControls"];
export let VENDORS: G["vendors"];
export let PROVIDER_CERTIFICATIONS: G["providerCertifications"];

// Rebinds the whole page-facing surface to one engine and tells subscribers.
// Grouped by engine module so a binding that drifts from its source is visible
// as a mismatched destructure rather than a line lost among a hundred others.
function publish(next: Engine): void {
  engine = next;

  ({
    getAsset, getSystem, getRisk, getDataType, getControl, getEvidence,
    getEvidenceArtifacts, getEvidenceReviews, getAllAssets, getAllSystems,
    getAllRisks, getAllDataTypes, getAllKeyControls, getAllEvidence,
    getEnterprise, getCategoryAverages,
    getInstancesForAsset, getInstance, getControlAssessments, getApplicability,
    getApplicabilityProfile, getDataFlows, getNeighbors, flowsFrom, flowsTo,
    flowsCarrying, dataForAsset, dataTypesForSystem, assetsHoldingDataType,
    assetClassification, assetsForSystem, requiredControlsForAsset,
    assetsRequiringControl, allExceptions, evidenceFor, risksForAssetRollup,
    explain, modelHealth,
    systemControlMatrix, systemCoverageBreakdown, systemStandardMappings,
    clauseCoverage, controlCoverageForSystem, frameworkPosture,
  } = next.selectors);

  ({
    FRAMEWORK_POSTURE, ENTERPRISE_COVERAGE, IN_SCOPE_FRAMEWORKS, SYSTEM_COVERAGE,
    programControlReach, responsibilityForControl, notApplicableControlsForSystem,
    controlApplicabilitySummary,
  } = next.compliance);

  ({ pendingControlsForSystem, resolveProgramApplicability } = next.applicability);

  ({ CONTROL_PROFILES, tierTargetScore, evaluateSystemAgainstProfile, profileSummary } = next.profile);

  ({
    MATERIAL_RISKS, MATERIAL_RISK_EXPOSURE, ABOVE_APPETITE_COUNT,
    QUANTIFIED_EXPOSURE, risksForSystem, topRisksForSystem,
  } = next.risk);

  ({
    ALL_FINDINGS, findingsForSystem, findingsForAsset, findingsForRisk,
    openFindingsForSource,
  } = next.findings);

  ({ identityPostureForSystem } = next.identity);
  ({ exposureForSystem } = next.exposure);
  ({
    exceptionRegister: EXCEPTION_REGISTER,
    exceptionSummary: EXCEPTION_SUMMARY,
    exceptionsForSystem,
  } = next.exceptions);
  ({ vulnerabilitiesForSystem } = next.vulnerabilities);
  ({ securityTestsForSystem } = next.securityTesting);
  ({ resilienceForSystem } = next.resilience);
  ({ irForSystem } = next.incidentResponse);
  ({ vendorsForSystem } = next.vendors);
  ({ sdlcForSystem } = next.sdlc);
  ({ cockpitSummary } = next.cockpit);
  ({ wavesForSystem, auditReadinessForSystem } = next.review);

  ({ TOTAL_FLOW_COUNT, TOTAL_ACTOR_COUNT } = next.rollups);

  ({
    actors: ACTORS,
    actorById: ACTOR_BY_ID,
    orgs: ORGS,
    orgById: ORG_BY_ID,
    evidenceSources: EVIDENCE_SOURCES,
    evidenceSourceById: EVIDENCE_SOURCE_BY_ID,
    inScopeControls: IN_SCOPE_CONTROLS,
    vendors: VENDORS,
    providerCertifications: PROVIDER_CERTIFICATIONS,
  } = next.graph);

  engineListeners.forEach((listener) => listener());
}

// ---- Pure scoring + vocabulary -------------------------------------------------
// Neither depends on a graph, so both are plain re-exports.
export * from "./assurance";
export { effectivenessFactor, composeEvidenceConfidence } from "./evidence";
export { INSTANCE_STATUS_META } from "./assessment";
export { COVERAGE_STATUS_META, COVERAGE_STATES } from "./compliance";
export {
  FINDING_REMEDIATION_STATUS_META, REMEDIATION_STATUSES, FINDING_SEVERITY_META,
  GAP_RATING_THRESHOLD, isGapRating, suggestedFindingSeverity,
} from "./findings";
export { FINDING_SEVERITIES, FINDING_SOURCES } from "../graph/nodes/findings";
export { IDENTITY_TYPES } from "../graph/nodes/identity";
export { EGRESS_POSTURE, ADMIN_POSTURE, API_POSTURE } from "../graph/nodes/exposure";
export { SECURITY_TEST_TYPES } from "../graph/nodes/securityTests";
export { IR_FUNCTIONS } from "../graph/nodes/irExercises";
export { VENDOR_CATEGORIES } from "../graph/nodes/vendors";
export { REGULATORY_FLAGS } from "../graph/nodes/dataTypes";
export {
  AVAILABILITY_TIERS, HOSTING_TYPES, INHERITED_DOMAINS, DATA_SUBJECT_TYPES,
  CLOUD_REGIONS, RETENTION_OPTIONS, RESIDENCY_OPTIONS, SYSTEM_REGULATORY_CONTEXTS,
  NETWORK_EXPOSURES, SECURITY_OBJECTIVES, SECURITY_OBJECTIVE_LABELS,
  defaultSecurityCategory, overallImpactLevel,
} from "../graph/nodes/systems";
export type { SecurityCategory, SecurityObjective, SecurityObjectiveRating } from "../graph/nodes/systems";
export { RESPONSIBILITIES, SHARED_RESPONSIBILITY_DOMAINS } from "../graph/edges/controlImplementations";
export type { Responsibility } from "../graph/edges/controlImplementations";
export { ASSET_KINDS, ASSET_TYPE_CATEGORIES, ASSET_TYPES, IMPACT_LEVELS, IMPACT_LEVEL_LABELS, IMPACT_LEVEL_SHORT } from "../graph/nodes/assets";
export type { ImpactLevel } from "../graph/nodes/assets";
export type { CockpitItem } from "./cockpit";
export {
  SEVERITY_VALUE, LIKELIHOOD_VALUE, score, isMaterial,
  annualProbabilityRange, lossMagnitudeRange, riskTrend, appetiteRatio,
} from "./risk";
export { SEVERITY_LEVELS, LIKELIHOOD_LEVELS } from "../graph/nodes/risks";
export { ACTOR_KINDS } from "../graph/nodes/actors";
export { ORG_KINDS } from "../graph/nodes/orgs";
export {
  BASIS, BASIS_META, ASSURANCE_CATEGORIES, CLASSIFICATION_TIERS,
  EVIDENCE_TYPES, IMPLEMENTATION_TYPES,
  PRISMA_LEVELS, COMPLIANCE_RATINGS, COMPLIANCE_LABELS,
} from "../graph/nodes/taxonomy";
export { DATA_ROLE_META } from "../graph/edges/assetDataTypes";
export { EVIDENCE_COLLECTOR_TYPES, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS } from "../graph/nodes/evidence";
export { ARTIFACT_SENSITIVITIES, EVIDENCE_REVIEW_DECISIONS } from "../graph/nodes/evidenceProvenance";
export {
  evaluateControl, addPrismaOverride, upsertControlReview, updateEvidence, removeEvidence, addFinding, updateFinding,
  addControlToScope, upsertImplementationMechanism, addEvidence, declareNotImplemented,
  removeRuntimeSystem, restoreBaselineSystems,
} from "./runtimeMutations";
export type { ControlEvidenceDraft, EvidenceArtifactDraft, EvidenceReviewDraft, EvidenceDraft, EvaluateControlInput, FindingDraft } from "./runtimeMutations";
export type { PrismaLevelOverride } from "../graph/edges/prismaOverrides";
export type { ControlReview, ReviewBucket, ReviewStance } from "../graph/edges/controlReviews";
export {
  REVIEW_WAVES, AUDIT_READINESS_BANDS, AUDIT_READINESS_LABELS, isRuntimeCreatedSystem,
} from "./review";
export type { ReviewWave, AuditReadinessBand, ReviewWaveProjection, FrameworkReadiness } from "./review";
export type { Finding } from "../graph/nodes/findings";

// Types pages reference
export type { AssetRollup, SystemRollup } from "./rollups";
export type { RiskRollup } from "./risk";
export type { ScoredEvidence } from "./evidence";
export type { ControlAssessment, ControlInstance } from "./assessment";
export type { LevelRating } from "./levels";
export type { ControlCoverage } from "./compliance";
export type { EngineFinding } from "./findings";
export type { ManagedException, ExceptionLifecycleStatus, ExceptionReviewStatus } from "./exceptions";

// ---- Hot module replacement ---------------------------------------------------
// Dev-only, and load-bearing. This module holds app-global state that exists
// only because Boot awaited initEngine(). When Vite hot-replaces it — which
// happens whenever anything it imports is edited — the new instance starts with
// every binding below unassigned and initPromise back to null, and nobody calls
// initEngine() a second time. Pages that read the surface while they evaluate
// (ExecutiveDashboard's `getAllSystems()` at module scope, for one) then die with
// "getAllSystems is not a function", and the app goes blank until a manual
// refresh.
//
// So the built engine is handed to the next instance through hot.data and
// republished synchronously on the way in. Self-accepting keeps the update from
// propagating further, since by the time this runs the state is already whole.
//
// This block sits at the end of the file on purpose: publish() is hoisted, but
// the `export let` bindings it assigns are not, so running any earlier would
// hit their temporal dead zone.
if (import.meta.hot) {
  const carried = import.meta.hot.data.engineState as { engine: Engine; facts: GraphFacts } | undefined;
  if (carried) {
    setBaseFacts(carried.facts);
    publish(carried.engine);
    initPromise = Promise.resolve();
  }

  import.meta.hot.dispose((data) => {
    if (engine && hasBaseFacts()) data.engineState = { engine, facts: baseFacts() };
  });

  import.meta.hot.accept();
}
