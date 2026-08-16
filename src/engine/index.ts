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
import { ACME_FACTS } from "../graph/sources/acme";
import { createEngine } from "./create";

export const engine = createEngine(loadGraph(ACME_FACTS));

const { selectors, profile, risk, compliance, findings, rollups, graph } = engine;

export { createEngine } from "./create";
export { loadGraph } from "../graph/load";
export type { Engine } from "./create";
export type { EngineContext } from "./context";
export type { Graph, GraphFacts } from "../graph/types";

// ---- Page-facing surface ------------------------------------------------------
// Entity access
export const getAsset = selectors.getAsset;
export const getSystem = selectors.getSystem;
export const getRisk = selectors.getRisk;
export const getDataType = selectors.getDataType;
export const getControl = selectors.getControl;
export const getEvidence = selectors.getEvidence;
export const getAllAssets = selectors.getAllAssets;
export const getAllSystems = selectors.getAllSystems;
export const getAllRisks = selectors.getAllRisks;
export const getAllDataTypes = selectors.getAllDataTypes;
export const getAllKeyControls = selectors.getAllKeyControls;
export const getAllEvidence = selectors.getAllEvidence;
export const getEnterprise = selectors.getEnterprise;
export const getCategoryAverages = selectors.getCategoryAverages;

// Traversal
export const getImplementations = selectors.getImplementations;
export const getImplementation = selectors.getImplementation;
export const getControlImplementations = selectors.getControlImplementations;
export const getApplicability = selectors.getApplicability;
export const getApplicabilityProfile = selectors.getApplicabilityProfile;
export const getDataFlows = selectors.getDataFlows;
export const getNeighbors = selectors.getNeighbors;
export const flowsFrom = selectors.flowsFrom;
export const flowsTo = selectors.flowsTo;
export const flowsCarrying = selectors.flowsCarrying;
export const dataForAsset = selectors.dataForAsset;
export const dataTypesForSystem = selectors.dataTypesForSystem;
export const assetsHoldingDataType = selectors.assetsHoldingDataType;
export const assetClassification = selectors.assetClassification;
export const assetsForSystem = selectors.assetsForSystem;
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

// Profile
export const CONTROL_PROFILES = profile.CONTROL_PROFILES;
export const tierTargetScore = profile.tierTargetScore;
export const evaluateAssetAgainstProfile = profile.evaluateAssetAgainstProfile;
export const profileSummary = profile.profileSummary;

// Risk
export const MATERIAL_RISKS = risk.MATERIAL_RISKS;
export const MATERIAL_RISK_EXPOSURE = risk.MATERIAL_RISK_EXPOSURE;
export const ABOVE_APPETITE_COUNT = risk.ABOVE_APPETITE_COUNT;
export const QUANTIFIED_EXPOSURE = risk.QUANTIFIED_EXPOSURE;

// Findings
export const ALL_FINDINGS = findings.ALL_FINDINGS;
export const findingsForSystem = findings.findingsForSystem;
export const findingsForAsset = findings.findingsForAsset;
export const findingsForRisk = findings.findingsForRisk;

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

// ---- Pure scoring + vocabulary -------------------------------------------------
// Neither depends on a graph, so both are plain re-exports.
export * from "./assurance";
export { IMPLEMENTATION_STATUS_META, effectivenessFactor, composeEvidenceConfidence } from "./implementation";
export { COVERAGE_STATUS_META, COVERAGE_STATES } from "./compliance";
export { FINDING_STATUS_META, FINDING_STATUSES } from "./findings";
export {
  SEVERITY_VALUE, LIKELIHOOD_VALUE, score, isMaterial,
  annualProbabilityRange, lossMagnitudeRange, riskTrend, appetiteRatio,
} from "./risk";
export { SEVERITY_LEVELS, LIKELIHOOD_LEVELS } from "../graph/nodes/risks";
export { ACTOR_KINDS } from "../graph/nodes/actors";
export { ORG_KINDS } from "../graph/nodes/orgs";
export {
  BASIS, BASIS_META, ASSURANCE_CATEGORIES, CLASSIFICATION_TIERS,
  MATURITY_STAGES, EVIDENCE_TYPES, IMPLEMENTATION_TYPES,
} from "../graph/nodes/taxonomy";
export { DATA_ROLE_META } from "../graph/edges/assetDataTypes";

// Types pages reference
export type { AssetRollup, SystemRollup } from "./rollups";
export type { RiskRollup } from "./risk";
export type { Implementation, ScoredEvidence } from "./implementation";
export type { ControlCoverage } from "./compliance";
export type { EngineFinding } from "./findings";
