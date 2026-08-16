// ACME's facts, read out of the TypeScript modules they're currently authored in.
//
// This is a SOURCE ADAPTER, and the first of what should eventually be several.
// Its entire job is to answer "what are the facts?" in the one shape
// assembleGraph() accepts. It holds no logic, derives nothing, and should stay
// boring enough that a YAML or Postgres adapter can sit beside it and be
// obviously equivalent.
//
// Note what this file does NOT re-export: the vocabularies. ASSET_KINDS,
// CLASSIFICATION_TIERS, FLOW_KINDS and their siblings are schema, not facts —
// they describe what a fact is allowed to say, and every dataset shares them.
// They stay importable directly from nodes/taxonomy.ts and friends.
//
// The import below is load-bearing, not a leftover. graph/validate.js holds the
// full structural suite — every vocabulary conformance check, every referential
// check, roughly forty-five of them — and asserts against these modules
// directly rather than against an assembled Graph. Importing it HERE, in the
// adapter for the dataset it actually checks, is what keeps those checks alive
// now that nothing else pulls them in. loadGraph() runs its own source-agnostic
// subset on top.
//
// Porting that suite to take a Graph is what a YAML or Postgres source needs
// before it can be trusted to the same standard, and it is the next piece of
// work on this seam.
import "../validate";
import { ASSETS } from "../nodes/assets";
import { SYSTEMS, EXPECTED_CLASSIFICATION } from "../nodes/systems";
import { DATA_TYPES } from "../nodes/dataTypes";
import { CONTROLS } from "../nodes/controls";
import { KEY_CONTROLS } from "../nodes/keyControls";
import { RAW_EVIDENCE } from "../nodes/evidence";
import { RISKS, BOARD_MATERIAL_RISK_IDS } from "../nodes/risks";
import { ORGS } from "../nodes/orgs";
import { FINDINGS } from "../nodes/findings";
import { ACTORS } from "../nodes/actors";
import {
  CATEGORY_WEIGHTS, TIER_BASELINE, HIGH_SENSITIVITY_CATEGORIES, BUMPED_TIERS,
} from "../nodes/controlProfiles";
import { ASSET_DATA_TYPES } from "../edges/assetDataTypes";
import { DATA_FLOWS } from "../edges/dataFlows";
import { ACTOR_ACCESS } from "../edges/actorAccess";
import { APPLICABILITY_RULES, APPLICABILITY_EXCEPTIONS } from "../edges/applicabilityRules";
import { CATEGORY_ASSESSMENTS } from "../edges/categoryAssessments";
import { OWNER_OVERRIDES, IMPLEMENTATION_OVERRIDES, NOT_IMPLEMENTED } from "../edges/controlImplementations";
import {
  RISK_ASSETS, RISK_CONTROLS, RISKS_WITHOUT_ASSETS, RISKS_WITHOUT_CONTROLS,
} from "../edges/riskContributors";
import type { GraphFacts } from "../types";

export const ACME_FACTS: GraphFacts = {
  assets: ASSETS,
  systems: SYSTEMS,
  dataTypes: DATA_TYPES,
  controls: CONTROLS,
  keyControls: KEY_CONTROLS,
  evidence: RAW_EVIDENCE,
  risks: RISKS,
  orgs: ORGS,
  findings: FINDINGS,
  actors: ACTORS,
  controlProfile: {
    categoryWeights: CATEGORY_WEIGHTS,
    tierBaseline: TIER_BASELINE,
    highSensitivityCategories: HIGH_SENSITIVITY_CATEGORIES,
    bumpedTiers: BUMPED_TIERS,
  },

  assetDataTypes: ASSET_DATA_TYPES,
  dataFlows: DATA_FLOWS,
  actorAccess: ACTOR_ACCESS,
  applicabilityRules: APPLICABILITY_RULES,
  applicabilityExceptions: APPLICABILITY_EXCEPTIONS,
  categoryAssessments: CATEGORY_ASSESSMENTS,
  ownerOverrides: OWNER_OVERRIDES,
  implementationOverrides: IMPLEMENTATION_OVERRIDES,
  notImplemented: NOT_IMPLEMENTED,
  riskAssets: RISK_ASSETS,
  riskControls: RISK_CONTROLS,
  risksWithoutAssets: RISKS_WITHOUT_ASSETS,
  risksWithoutControls: RISKS_WITHOUT_CONTROLS,

  expectedClassification: EXPECTED_CLASSIFICATION,
  boardMaterialRiskIds: BOARD_MATERIAL_RISK_IDS,
};
