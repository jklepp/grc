// The one import path pages use.
//
// Pages consume a DEFAULT ENGINE built over ACME's facts. That default is the
// only thing in the app that picks a dataset; everything below it takes its
// graph as an argument. Keeping the page-facing names identical to what they
// were before the seam existed is deliberate — 18 page files import from here,
// and none of them should have to know that the engine became constructible.
//
// To work with a different dataset (a test's synthetic graph, a prior revision,
// another tenant), don't reach for these bindings — build your own:
//
//   import { loadGraph } from "../graph/load";
//   import { createEngine } from "./create";
//   const engine = createEngine(loadGraph(facts), { ctx: { now: new Date("2026-01-01") } });
//
// Importing this module runs both integrity checks: structural inside
// loadGraph, derivational inside createEngine. Any page that touches the model
// has therefore already proved the model is sound before it renders a number.
import { loadGraph } from "../graph/load";
import { YAML_FACTS } from "../graph/sources/yaml";
import { createEngine } from "./create";
import { buildLiveEngine } from "./liveGraph";
import { loadRuntimeFacts, hasRuntimeFacts, saveRuntimeFacts } from "./runtimeFactsStore";
import type { RuntimeFacts } from "./liveGraph";
import type { Engine } from "./create";

// The live dataset now comes from src/graph/facts/*.yaml. The TypeScript
// modules those were generated from are still present and still exported as
// sources/acme.ts, and scripts/check-source-parity.mjs asserts on every run
// that the two remain indistinguishable — 98 checks across facts, assembled
// graph, and derived numbers. Two sources of truth would normally be exactly
// the failure this app exists to eliminate; they are tolerable here only
// because a check makes divergence impossible to commit silently.
//
// Retiring the TypeScript data (keeping those modules for their types and
// vocabularies, which the YAML source still depends on) is the last step, and
// it waits on moving the per-record reasoning comments into `rationale:` fields
// so that reasoning survives the move.
// If the Add System wizard has saved anything, rebuild over YAML_FACTS plus
// those runtime facts so a reload reconstructs the same live dataset the user
// had. Persisted facts already passed buildLiveEngine's validation once (the
// wizard would not have saved otherwise), but a later change to the
// validators could in principle invalidate an old blob — fall back to the
// plain YAML engine rather than let a stale localStorage entry break the app.
const runtimeFacts = loadRuntimeFacts();
export let engine = hasRuntimeFacts(runtimeFacts)
  ? (() => {
      const { engine: liveEngine, problems } = buildLiveEngine(YAML_FACTS, runtimeFacts);
      if (liveEngine) return liveEngine;
      console.warn("grc-runtime-facts: persisted systems failed validation, falling back to the YAML-only dataset:", problems);
      return createEngine(loadGraph(YAML_FACTS));
    })()
  : createEngine(loadGraph(YAML_FACTS));

const engineListeners = new Set<() => void>();

export function getLiveEngine(): Engine {
  return engine;
}

export function subscribeToLiveEngine(listener: () => void): () => void {
  engineListeners.add(listener);
  return () => engineListeners.delete(listener);
}

export function commitRuntimeFacts(runtime: RuntimeFacts): { engine: Engine | null; problems: string[] } {
  const result = buildLiveEngine(YAML_FACTS, runtime);
  if (!result.engine) return result;
  saveRuntimeFacts(runtime);
  engine = result.engine;
  engineListeners.forEach((listener) => listener());
  return result;
}

const {
  selectors, profile, risk, compliance, findings, rollups, graph,
  identity, exposure, exceptions, vulnerabilities, securityTesting, resilience,
  incidentResponse, vendors, sdlc, cockpit, review,
} = engine;

export { createEngine } from "./create";
export { loadGraph } from "../graph/load";
export type { Engine } from "./create";
export type { EngineContext } from "./context";
export type { Graph, GraphFacts } from "../graph/types";

// ---- Page-facing surface ------------------------------------------------------
// Entity access
export const getAsset: typeof selectors.getAsset = (...args) => engine.selectors.getAsset(...args);
export const getSystem = selectors.getSystem;
export const getRisk = selectors.getRisk;
export const getDataType = selectors.getDataType;
export const getControl = selectors.getControl;
export const getEvidence: typeof selectors.getEvidence = (...args) => engine.selectors.getEvidence(...args);
export const getEvidenceArtifacts: typeof selectors.getEvidenceArtifacts = (...args) => engine.selectors.getEvidenceArtifacts(...args);
export const getEvidenceReviews: typeof selectors.getEvidenceReviews = (...args) => engine.selectors.getEvidenceReviews(...args);
export const getAllAssets: typeof selectors.getAllAssets = (...args) => engine.selectors.getAllAssets(...args);
export const getAllSystems: typeof selectors.getAllSystems = (...args) => engine.selectors.getAllSystems(...args);
export const getAllRisks = selectors.getAllRisks;
export const getAllDataTypes: typeof selectors.getAllDataTypes = (...args) => engine.selectors.getAllDataTypes(...args);
export const getAllKeyControls = selectors.getAllKeyControls;
export const getAllEvidence = selectors.getAllEvidence;
export const getEnterprise = selectors.getEnterprise;
export const getCategoryAverages = selectors.getCategoryAverages;

// Traversal
export const getInstancesForAsset = selectors.getInstancesForAsset;
export const getInstance = selectors.getInstance;
export const getControlAssessments = selectors.getControlAssessments;
export const getApplicability = selectors.getApplicability;
export const getApplicabilityProfile = selectors.getApplicabilityProfile;
export const getDataFlows: typeof selectors.getDataFlows = (...args) => engine.selectors.getDataFlows(...args);
export const getNeighbors = selectors.getNeighbors;
export const flowsFrom = selectors.flowsFrom;
export const flowsTo = selectors.flowsTo;
export const flowsCarrying = selectors.flowsCarrying;
export const dataForAsset: typeof selectors.dataForAsset = (...args) => engine.selectors.dataForAsset(...args);
export const dataTypesForSystem: typeof selectors.dataTypesForSystem = (...args) => engine.selectors.dataTypesForSystem(...args);
export const assetsHoldingDataType = selectors.assetsHoldingDataType;
export const assetClassification = selectors.assetClassification;
export const assetsForSystem: typeof selectors.assetsForSystem = (...args) => engine.selectors.assetsForSystem(...args);
export const requiredControlsForAsset = selectors.requiredControlsForAsset;
export const assetsRequiringControl = selectors.assetsRequiringControl;
export const allExceptions = selectors.allExceptions;
export const evidenceFor = selectors.evidenceFor;
export const risksForAssetRollup = selectors.risksForAssetRollup;
export const explain = selectors.explain;
export const modelHealth = selectors.modelHealth;

// Compliance
export const systemControlMatrix = selectors.systemControlMatrix;
export const systemCoverageBreakdown = selectors.systemCoverageBreakdown;
export const systemStandardMappings = selectors.systemStandardMappings;
export const clauseCoverage = selectors.clauseCoverage;
export const controlCoverageForSystem = selectors.controlCoverageForSystem;
export const frameworkPosture = selectors.frameworkPosture;
export const FRAMEWORK_POSTURE = compliance.FRAMEWORK_POSTURE;
export const ENTERPRISE_COVERAGE = compliance.ENTERPRISE_COVERAGE;
export const IN_SCOPE_FRAMEWORKS = compliance.IN_SCOPE_FRAMEWORKS;
export const SYSTEM_COVERAGE = compliance.SYSTEM_COVERAGE;
export const programControlReach = compliance.programControlReach;
export const responsibilityForControl = compliance.responsibilityForControl;
export const notApplicableControlsForSystem = compliance.notApplicableControlsForSystem;
export const controlApplicabilitySummary = compliance.controlApplicabilitySummary;
export const pendingControlsForSystem = engine.applicability.pendingControlsForSystem;
export const resolveProgramApplicability: typeof engine.applicability.resolveProgramApplicability = (...args) => engine.applicability.resolveProgramApplicability(...args);
export { STATUS_RANK } from "./compliance";

// Profile
export const CONTROL_PROFILES = profile.CONTROL_PROFILES;
export const tierTargetScore = profile.tierTargetScore;
export const evaluateSystemAgainstProfile = profile.evaluateSystemAgainstProfile;
export const profileSummary = profile.profileSummary;

// Risk
export const MATERIAL_RISKS = risk.MATERIAL_RISKS;
export const MATERIAL_RISK_EXPOSURE = risk.MATERIAL_RISK_EXPOSURE;
export const ABOVE_APPETITE_COUNT = risk.ABOVE_APPETITE_COUNT;
export const QUANTIFIED_EXPOSURE = risk.QUANTIFIED_EXPOSURE;
export const risksForSystem = risk.risksForSystem;
export const topRisksForSystem = risk.topRisksForSystem;

// Findings
export const ALL_FINDINGS = findings.ALL_FINDINGS;
export const findingsForSystem: typeof findings.findingsForSystem = (...args) => engine.findings.findingsForSystem(...args);
export const findingsForAsset = findings.findingsForAsset;
export const findingsForRisk = findings.findingsForRisk;
export const openFindingsForSource = findings.openFindingsForSource;

// System Register cockpit domains
export const identityPostureForSystem = identity.identityPostureForSystem;
export const exposureForSystem = exposure.exposureForSystem;
export const EXCEPTION_REGISTER = exceptions.exceptionRegister;
export const EXCEPTION_SUMMARY = exceptions.exceptionSummary;
export const exceptionsForSystem = exceptions.exceptionsForSystem;
export const vulnerabilitiesForSystem = vulnerabilities.vulnerabilitiesForSystem;
export const securityTestsForSystem = securityTesting.securityTestsForSystem;
export const resilienceForSystem: typeof resilience.resilienceForSystem = (...args) => engine.resilience.resilienceForSystem(...args);
export const irForSystem = incidentResponse.irForSystem;
export const vendorsForSystem = vendors.vendorsForSystem;
export const sdlcForSystem = sdlc.sdlcForSystem;
export const cockpitSummary = cockpit.cockpitSummary;

export const wavesForSystem: typeof review.wavesForSystem = (...args) => engine.review.wavesForSystem(...args);
export const auditReadinessForSystem: typeof review.auditReadinessForSystem = (...args) => engine.review.auditReadinessForSystem(...args);

// Rollup totals
export const TOTAL_FLOW_COUNT = rollups.TOTAL_FLOW_COUNT;
export const TOTAL_ACTOR_COUNT = rollups.TOTAL_ACTOR_COUNT;

// Graph nodes pages read directly (reference data, not derivations)
export const ACTORS = graph.actors;
export const ACTOR_BY_ID = graph.actorById;
export const ORGS = graph.orgs;
export const ORG_BY_ID = graph.orgById;
export const EVIDENCE_SOURCES = graph.evidenceSources;
export const EVIDENCE_SOURCE_BY_ID = graph.evidenceSourceById;
export const IN_SCOPE_CONTROLS = graph.inScopeControls;
export const VENDORS = graph.vendors;
export const PROVIDER_CERTIFICATIONS = graph.providerCertifications;

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
