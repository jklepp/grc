// Persistence for user-created systems/assets — the Add System wizard's save
// target. This is the only place in the app that writes to localStorage as a
// source of graph facts (as opposed to ProcedureLibrary's execution-log
// localStorage, which the engine never reads).
//
// A missing or malformed blob is always treated as "no runtime systems" rather
// than an error — a prototype's local storage getting cleared, corrupted, or
// written by an older version of this schema should degrade to the plain YAML
// dataset, never break the app on load.
import type { RuntimeFacts } from "./liveGraph";
import { emptyRuntimeFacts } from "./liveGraph";
import type { ActorId, AssetId, EvidenceArtifactId, EvidenceId, EvidenceReviewId, FindingId, SystemId } from "../graph/ids";
import type { Asset, ImpactLevel } from "../graph/nodes/assets";
import {
  defaultSecurityCategory, isImpactLevel, overallImpactLevel,
  type SecurityCategory, type System,
} from "../graph/nodes/systems";

const STORAGE_KEY = "grc-runtime-facts";

type LegacyCriticalityFactors = Record<string, { score?: number; reason?: string }>;

function impactFromLegacyScore(score: unknown): ImpactLevel {
  if (typeof score !== "number" || !Number.isFinite(score)) return "moderate";
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  return "low";
}

function securityCategoryFromLegacy(legacy: LegacyCriticalityFactors | undefined): SecurityCategory {
  const rating = (objective: keyof SecurityCategory): SecurityCategory[keyof SecurityCategory] => ({
    impact: impactFromLegacyScore(legacy?.[objective]?.score),
    reason: typeof legacy?.[objective]?.reason === "string" ? legacy[objective].reason : "",
  });
  return {
    confidentiality: rating("confidentiality"),
    integrity: rating("integrity"),
    availability: rating("availability"),
  };
}

// Older runtime systems stored a five-factor 0-100 criticalityFactors blob.
// Map CIA scores onto FIPS 199 impact levels and drop the extra lanes so a
// previously saved system still loads against the current schema.
function migrateSystem(system: System & { criticalityFactors?: LegacyCriticalityFactors }): System {
  const existing = system.securityCategory;
  if (existing?.confidentiality?.impact && existing?.integrity?.impact && existing?.availability?.impact) {
    const { criticalityFactors: _legacy, ...rest } = system;
    return rest;
  }
  const legacy = system.criticalityFactors;
  const { criticalityFactors: _legacy, ...rest } = system;
  return {
    ...rest,
    securityCategory: legacy ? securityCategoryFromLegacy(legacy) : defaultSecurityCategory(),
  };
}

// Assets used to carry the same five-factor blob. Collapse CIA onto one FIPS
// 199 impact level (high-water mark) so an earlier edit of a YAML system
// cannot block adding a new one.
function migrateAsset(asset: Asset & { criticalityFactors?: LegacyCriticalityFactors }): Asset {
  const { criticalityFactors: legacy, ...rest } = asset;
  if (isImpactLevel(asset.impactLevel)) return rest;
  return {
    ...rest,
    impactLevel: legacy ? overallImpactLevel(securityCategoryFromLegacy(legacy)) : "moderate",
  };
}

export function loadRuntimeFacts(): RuntimeFacts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyRuntimeFacts();
    const parsed = JSON.parse(raw);
    const empty = emptyRuntimeFacts();
    return {
      systems: Array.isArray(parsed.systems) ? parsed.systems.map(migrateSystem) : empty.systems,
      assets: Array.isArray(parsed.assets) ? parsed.assets.map(migrateAsset) : empty.assets,
      assetDataTypes: Array.isArray(parsed.assetDataTypes) ? parsed.assetDataTypes : empty.assetDataTypes,
      actors: Array.isArray(parsed.actors) ? parsed.actors : empty.actors,
      actorAccess: Array.isArray(parsed.actorAccess) ? parsed.actorAccess : empty.actorAccess,
      dataFlows: Array.isArray(parsed.dataFlows) ? parsed.dataFlows : empty.dataFlows,
      agenticIdentities: Array.isArray(parsed.agenticIdentities) ? parsed.agenticIdentities : empty.agenticIdentities,
      assessmentScopes: Array.isArray(parsed.assessmentScopes) ? parsed.assessmentScopes : empty.assessmentScopes,
      expectedClassification:
        parsed.expectedClassification && typeof parsed.expectedClassification === "object"
          ? parsed.expectedClassification
          : empty.expectedClassification,
      implementationMechanisms: Array.isArray(parsed.implementationMechanisms) ? parsed.implementationMechanisms : empty.implementationMechanisms,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : empty.evidence,
      evidenceArtifacts: Array.isArray(parsed.evidenceArtifacts) ? parsed.evidenceArtifacts : empty.evidenceArtifacts,
      evidenceReviews: Array.isArray(parsed.evidenceReviews) ? parsed.evidenceReviews : empty.evidenceReviews,
      notImplemented: Array.isArray(parsed.notImplemented) ? parsed.notImplemented : empty.notImplemented,
      prismaOverrides: Array.isArray(parsed.prismaOverrides) ? parsed.prismaOverrides : empty.prismaOverrides,
      controlReviews: Array.isArray(parsed.controlReviews) ? parsed.controlReviews : empty.controlReviews,
      findings: Array.isArray(parsed.findings) ? parsed.findings : empty.findings,
      backupConfigs: Array.isArray(parsed.backupConfigs) ? parsed.backupConfigs : empty.backupConfigs,
      drTests: Array.isArray(parsed.drTests) ? parsed.drTests : empty.drTests,
      sdlcPostures: Array.isArray(parsed.sdlcPostures) ? parsed.sdlcPostures : empty.sdlcPostures,
    };
  } catch {
    return emptyRuntimeFacts();
  }
}

export function saveRuntimeFacts(facts: RuntimeFacts): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(facts));
}

// True if there's anything at all for buildLiveEngine to merge in — not just
// a runtime-created system. evaluateControl/addPrismaOverride/addFinding all
// write facts against EXISTING (YAML-authored) systems with no accompanying
// system record, so checking systems.length alone would silently discard
// those facts on every reload the moment this only checked for new systems.
export function hasRuntimeFacts(facts: RuntimeFacts): boolean {
  return (
    facts.systems.length > 0 ||
    facts.actors.length > 0 ||
    facts.actorAccess.length > 0 ||
    facts.dataFlows.length > 0 ||
    facts.agenticIdentities.length > 0 ||
    facts.implementationMechanisms.length > 0 ||
    facts.evidence.length > 0 ||
    facts.evidenceArtifacts.length > 0 ||
    facts.evidenceReviews.length > 0 ||
    facts.notImplemented.length > 0 ||
    facts.prismaOverrides.length > 0 ||
    facts.controlReviews.length > 0 ||
    facts.findings.length > 0 ||
    facts.backupConfigs.length > 0 ||
    facts.drTests.length > 0 ||
    facts.sdlcPostures.length > 0
  );
}

// SYS-USR-<n> / AST-USR-<n>-<m>, distinct from the YAML source's SYS-0xx /
// AST-0xx-xx ids so a runtime id can never collide with an authored one.
export function nextSystemId(existing: RuntimeFacts): SystemId {
  let n = 1;
  while (existing.systems.some((system) => system.id === `SYS-USR-${n}`)) n += 1;
  return `SYS-USR-${n}` as SystemId;
}

export function nextAssetId(systemId: SystemId, index: number): AssetId {
  const suffix = systemId.replace("SYS-USR-", "");
  return `AST-USR-${suffix}-${index + 1}` as AssetId;
}

export function nextActorId(existing: RuntimeFacts): ActorId {
  let n = 1;
  while (existing.actors.some((actor) => actor.id === `ACTOR-USR-${n}`)) n += 1;
  return `ACTOR-USR-${n}` as ActorId;
}

function nextRuntimeStringId(prefix: string, ids: readonly string[]): string {
  let n = 1;
  while (ids.includes(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

export const nextActorAccessId = (existing: RuntimeFacts): string =>
  nextRuntimeStringId("ACC-USR", existing.actorAccess.map((edge) => edge.id));

export const nextDataFlowId = (existing: RuntimeFacts): string =>
  nextRuntimeStringId("FLOW-USR", existing.dataFlows.map((flow) => flow.id));

export const nextAgenticIdentityId = (existing: RuntimeFacts): string =>
  nextRuntimeStringId("AGENT-USR", existing.agenticIdentities.map((agent) => agent.id));

export const nextDrTestId = (existing: RuntimeFacts): string =>
  nextRuntimeStringId("DRTEST-USR", existing.drTests.map((test) => test.id));

// EVD-USR-<n>, distinct from the YAML source's EVD-<domain>-<n> ids, same
// reasoning as nextSystemId/nextAssetId above.
export function nextEvidenceId(existing: RuntimeFacts): EvidenceId {
  let n = 1;
  while (existing.evidence.some((evidence) => evidence.id === `EVD-USR-${n}`)) n += 1;
  return `EVD-USR-${n}` as EvidenceId;
}

export function nextEvidenceArtifactId(existing: RuntimeFacts): EvidenceArtifactId {
  let n = 1;
  while (existing.evidenceArtifacts.some((artifact) => artifact.id === `ART-USR-${n}`)) n += 1;
  return `ART-USR-${n}` as EvidenceArtifactId;
}

export function nextEvidenceReviewId(existing: RuntimeFacts): EvidenceReviewId {
  let n = 1;
  while (existing.evidenceReviews.some((review) => review.id === `EVR-USR-${n}`)) n += 1;
  return `EVR-USR-${n}` as EvidenceReviewId;
}

// FND-USR-<n>, distinct from the YAML source's SEC-<n> ids, same reasoning as
// nextSystemId/nextAssetId above.
export function nextFindingId(existing: RuntimeFacts): FindingId {
  const n = existing.findings.length + 1;
  return `FND-USR-${n}` as FindingId;
}
