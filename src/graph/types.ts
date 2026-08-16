// The contract between "where facts come from" and "what the engine consumes."
//
// Two types, and the split between them is the whole point of this file.
//
// GraphFacts is what a SOURCE supplies: the authored records and nothing else.
// A TypeScript module, a directory of YAML, and eventually a Postgres query all
// produce this same shape, and none of them knows about the others.
//
// Graph is what the ENGINE consumes: those same facts, normalized, plus every
// index needed to traverse them without a linear scan. Nothing in here is a
// score — indexes are lookups, not judgments, and the moment a derived *value*
// appears in this type the engine/graph line has been crossed.
//
// The reason the two are separate rather than one type with optional fields:
// building the indexes is where a fact set gets checked for internal coherence.
// A loader that hands back a Graph directly could hand back one whose ASSET_BY_ID
// disagrees with its ASSETS, and nothing downstream would notice. Making Graph
// constructible only by assembleGraph() means every consumer of a Graph has a
// guarantee about how it was built.
import type { Asset } from "./nodes/assets";
import type { System } from "./nodes/systems";
import type { DataType } from "./nodes/dataTypes";
import type { Control } from "./nodes/controls";
import type { KeyControl } from "./nodes/keyControls";
import type { RawEvidence, Evidence } from "./nodes/evidence";
import type { EvidenceSource } from "./nodes/evidenceSources";
import type { Risk } from "./nodes/risks";
import type { Org } from "./nodes/orgs";
import type { Finding } from "./nodes/findings";
import type { Actor } from "./nodes/actors";
import type { ControlProfileEntry } from "./nodes/controlProfiles";
import type { AssetDataType } from "./edges/assetDataTypes";
import type { DataFlow } from "./edges/dataFlows";
import type { ActorAccess } from "./edges/actorAccess";
import type { ApplicabilityRule, ApplicabilityException } from "./edges/applicabilityRules";
import type { CategoryAssessment } from "./edges/categoryAssessments";
import type {
  OwnerOverride, ImplementationOverride, NotImplemented, ImplementationMechanism,
  ProgramApplicabilityRule, ProgramApplicabilityException,
} from "./edges/controlImplementations";
import type { PolicyRecord, ProcedureRecord } from "./nodes/programArtifacts";
import type { RiskAsset, RiskControl } from "./edges/riskContributors";
import type { AssuranceCategory, ClassificationTier, MaturityStage, EvidenceType } from "./nodes/taxonomy";
import type {
  AssetId, SystemId, ControlId, OrgId, RiskId, DataTypeId, EvidenceId,
  EvidenceSourceId, ActorId, SystemScope,
} from "./ids";

// ---- What a source supplies --------------------------------------------------
// Authored records only. Anything derivable from these is absent by design:
// EVIDENCE_SOURCES, for instance, is computed from evidence rows in assemble.ts
// rather than listed here, because a source list that could disagree with the
// observations it summarizes is a bug waiting to be authored.
export interface GraphFacts {
  // Nodes
  assets: Asset[];
  systems: System[];
  dataTypes: DataType[];
  controls: Control[];
  keyControls: KeyControl[];
  evidence: RawEvidence[];
  risks: Risk[];
  orgs: Org[];
  findings: Finding[];
  actors: Actor[];

  // The company-wide artifacts the maturity ladder's bottom two rungs stand on.
  // Authored in src/data (they carry employee-facing prose the engine has no
  // use for); the source adapter pulls the fields that matter into here.
  policies: PolicyRecord[];
  procedures: ProcedureRecord[];

  // The profile DEFINITION, not the resolved table. CONTROL_PROFILES used to be
  // built at module scope from four consts sitting beside it, which made "what
  // bar does Restricted data have to clear" a source-code question rather than a
  // data one. Carrying the inputs here and resolving them in assembleGraph is
  // what lets a second dataset answer it differently.
  controlProfile: ControlProfileDefinition;

  // Edges
  assetDataTypes: AssetDataType[];
  dataFlows: DataFlow[];
  actorAccess: ActorAccess[];
  applicabilityRules: ApplicabilityRule[];
  applicabilityExceptions: ApplicabilityException[];
  categoryAssessments: CategoryAssessment[];
  // Who owns each assurance category, per system, with "program" as the
  // enterprise-wide default a system falls back to. Authored data, so it lives
  // with the facts rather than being imported straight into the engine — which
  // is what it was doing, and the last place a fact reached past the graph.
  ownership: Record<SystemScope, Record<AssuranceCategory, OrgId[]>>;

  ownerOverrides: OwnerOverride[];
  implementationOverrides: ImplementationOverride[];
  notImplemented: NotImplemented[];
  implementationMechanisms: ImplementationMechanism[];
  programApplicabilityRules: ProgramApplicabilityRule[];
  programApplicabilityExceptions: ProgramApplicabilityException[];
  riskAssets: RiskAsset[];
  riskControls: RiskControl[];

  // Why a risk names no contributing asset or no holding control. A stated
  // reason rather than an empty list, so "nothing carries this yet" reads as a
  // deliberate position instead of an edge someone forgot to author.
  risksWithoutAssets: Record<RiskId, string>;
  risksWithoutControls: Record<RiskId, string>;

  // Curated expectations that exist to be checked against derivation rather
  // than consumed. EXPECTED_CLASSIFICATION is the top-down human answer a
  // bottom-up rollup has to reproduce; BOARD_MATERIAL_RISK_IDS is the set
  // someone decided the board sees. Both are facts about ACME's judgment, so
  // they travel with the facts, but engine/validate.ts is their only reader.
  expectedClassification: Record<SystemId, ClassificationTier>;
  boardMaterialRiskIds: RiskId[];
}

// ---- Control profile ---------------------------------------------------------
// Two independent levers, deliberately kept apart: the baseline (and its bump)
// decides what bar a category must CLEAR at a given tier; the weights decide how
// much clearing it COUNTS FOR. Collapsing them into one number is the shortcut
// that makes a profile impossible to reason about, so they stay separate here
// exactly as they were separate in nodes/controlProfiles.ts.
export interface ControlProfileDefinition {
  // Per-tier weights. Authored as a map because that's how the profile is
  // written and how validate checks each tier sums to 100.
  categoryWeights: Record<ClassificationTier, Record<AssuranceCategory, number>>;

  // The floor every asset at a tier must clear before any category bump.
  tierBaseline: Record<ClassificationTier, { maturity: MaturityStage; evidence: EvidenceType }>;

  // Categories held one notch stricter than baseline, and the tiers at which
  // that stricter bar applies.
  highSensitivityCategories: AssuranceCategory[];
  bumpedTiers: ClassificationTier[];
}

// ---- What the engine consumes ------------------------------------------------
// Facts, normalized, plus indexes. Every index here replaced a linear scan that
// previously lived as a module-level const inside the node or edge file it
// indexed; gathering them means the engine can be handed a graph rather than
// importing twenty modules that each built their own.
export interface Graph {
  readonly facts: GraphFacts;

  // Normalized collections. `evidence` differs from facts.evidence: validity
  // windows are defaulted by evidence type and sourceId is derived from the
  // source name, so downstream code never has to remember to do either.
  readonly assets: readonly Asset[];
  readonly systems: readonly System[];
  readonly dataTypes: readonly DataType[];
  readonly controls: readonly Control[];
  readonly keyControls: readonly KeyControl[];
  readonly evidence: readonly Evidence[];
  readonly evidenceSources: readonly EvidenceSource[];
  readonly risks: readonly Risk[];
  readonly orgs: readonly Org[];
  readonly findings: readonly Finding[];
  readonly actors: readonly Actor[];

  // Edges, unmodified but gathered so the engine has one place to reach for them.
  readonly assetDataTypes: readonly AssetDataType[];
  readonly dataFlows: readonly DataFlow[];
  readonly actorAccess: readonly ActorAccess[];
  readonly applicabilityRules: readonly ApplicabilityRule[];
  readonly applicabilityExceptions: readonly ApplicabilityException[];
  readonly categoryAssessments: readonly CategoryAssessment[];
  readonly ownership: Readonly<Record<SystemScope, Record<AssuranceCategory, OrgId[]>>>;
  readonly ownerOverrides: readonly OwnerOverride[];
  readonly implementationOverrides: readonly ImplementationOverride[];
  readonly notImplemented: readonly NotImplemented[];
  readonly implementationMechanisms: readonly ImplementationMechanism[];
  readonly programApplicabilityRules: readonly ProgramApplicabilityRule[];
  readonly programApplicabilityExceptions: readonly ProgramApplicabilityException[];
  readonly policies: readonly PolicyRecord[];
  readonly procedures: readonly ProcedureRecord[];
  readonly riskAssets: readonly RiskAsset[];
  readonly riskControls: readonly RiskControl[];
  readonly risksWithoutAssets: Readonly<Record<RiskId, string>>;
  readonly risksWithoutControls: Readonly<Record<RiskId, string>>;

  // ---- Indexes ----
  readonly assetById: Readonly<Record<AssetId, Asset>>;
  readonly systemById: Readonly<Record<SystemId, System>>;
  readonly dataTypeById: Readonly<Record<DataTypeId, DataType>>;
  readonly controlById: Readonly<Record<ControlId, Control>>;
  readonly keyControlById: Readonly<Record<ControlId, KeyControl>>;
  readonly evidenceById: Readonly<Record<EvidenceId, Evidence>>;
  readonly evidenceSourceById: Readonly<Record<EvidenceSourceId, EvidenceSource>>;
  readonly riskById: Readonly<Record<RiskId, Risk>>;
  readonly orgById: Readonly<Record<OrgId, Org>>;
  readonly actorById: Readonly<Record<ActorId, Actor>>;

  readonly assetsBySystem: Readonly<Record<SystemId, readonly Asset[]>>;
  readonly dataTypesByAsset: Readonly<Record<AssetId, readonly AssetDataType[]>>;
  readonly assetsByDataType: Readonly<Record<DataTypeId, readonly AssetDataType[]>>;
  readonly flowsFromAsset: Readonly<Record<AssetId, readonly DataFlow[]>>;
  readonly flowsToAsset: Readonly<Record<AssetId, readonly DataFlow[]>>;
  readonly actorAccessByAsset: Readonly<Record<AssetId, readonly ActorAccess[]>>;
  readonly rulesByControl: Readonly<Record<ControlId, readonly ApplicabilityRule[]>>;

  // Controls citing at least one framework clause. A control mapped to nothing
  // is out of scope for every standard the company certifies against, so it is
  // excluded from every posture figure rather than counted as an unmet one.
  readonly inScopeControls: readonly Control[];

  // Keyed `${standard}::${clause}` — the inverse of a control's own framework
  // mappings. This is what lets "how covered is SOC 2 CC6.1" be answered from
  // the implementations of the controls that actually satisfy it.
  readonly controlsByClause: Readonly<Record<string, readonly Control[]>>;

  // Keyed `${assetId}::${controlId}`, or `program::${controlId}` for evidence
  // that covers a program-scoped control rather than any particular asset.
  readonly evidenceByPair: Readonly<Record<string, readonly Evidence[]>>;
  readonly assessmentByPair: Readonly<Record<string, CategoryAssessment>>;
  readonly exceptionByPair: Readonly<Record<string, ApplicabilityException>>;
  readonly overrideByPair: Readonly<Record<string, ImplementationOverride>>;
  readonly notImplementedByPair: Readonly<Record<string, NotImplemented>>;
  readonly mechanismByPair: Readonly<Record<string, ImplementationMechanism>>;
  readonly programExceptionByPair: Readonly<Record<string, ProgramApplicabilityException>>;

  // What the maturity ceiling reads. A control with no policy citing it has no
  // documented basis at all — engine/validateDerivations.ts fails the build on
  // that, because it's a hole in the policy library rather than a posture
  // finding. A control with a policy but no SOP step can't support a claim above
  // "Policy", which is a posture finding and gets capped rather than thrown.
  readonly policiesByControl: Readonly<Record<ControlId, readonly PolicyRecord[]>>;
  readonly procedureStepsByControl: Readonly<Record<ControlId, readonly { procedure: ProcedureRecord; stepTitle: string }[]>>;
  readonly rulesByProgramControl: Readonly<Record<ControlId, readonly ProgramApplicabilityRule[]>>;

  readonly assetsByRisk: Readonly<Record<RiskId, readonly RiskAsset[]>>;
  readonly controlsByRisk: Readonly<Record<RiskId, readonly RiskControl[]>>;
  readonly risksByAsset: Readonly<Record<AssetId, readonly RiskAsset[]>>;
  readonly risksByControl: Readonly<Record<ControlId, readonly RiskControl[]>>;

  // Resolved once from facts.controlProfile: [tier][category] -> what this
  // category has to reach at this tier, and what it counts for.
  readonly controlProfiles: Readonly<Record<ClassificationTier, Record<AssuranceCategory, ControlProfileEntry>>>;
  readonly categoryWeights: CategoryWeights;

  readonly assessedAssetIds: readonly AssetId[];
  readonly assetScopedControls: readonly KeyControl[];
  readonly programScopedControls: readonly KeyControl[];

  // Raised during assembly rather than thrown, so graph/validate.ts can report
  // every problem at once instead of failing on the first.
  readonly sourceConflicts: readonly string[];
}

// The category-weight lookup, threaded rather than imported so a graph can
// carry its own profile.
export type CategoryWeights = Record<ClassificationTier, Record<AssuranceCategory, number>>;
