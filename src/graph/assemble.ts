// Facts in, traversable Graph out.
//
// Every index built here previously lived as a module-level const inside the
// node or edge file it indexed — BY_PAIR in evidence.ts, BY_ASSET in
// categoryAssessments.ts, INBOUND/OUTBOUND in dataFlows.ts, and so on. That
// worked exactly as long as there was one fact set in the process, because each
// index was welded to the module-scope collection above it. Gathering them into
// one function is what lets a second graph exist: a synthetic one for tests, a
// second tenant's, or a prior revision to diff today's posture against.
//
// Two rules this file holds to:
//
//   1. Nothing here is a score. Indexes are lookups. If a function in this file
//      ever needs a maturity weight or a confidence value, it belongs in the
//      engine and has been put in the wrong layer.
//
//   2. Normalization is explicit and happens once. Evidence validity windows
//      and source ids are filled in here so no downstream caller has to
//      remember to, which is the bug that made `sourceId` unreliable when it
//      was computed at three separate call sites.
import type { Graph, GraphFacts, ControlProfileDefinition } from "./types";
import { DEFAULT_VALIDITY_DAYS, sourceIdFromName, type Evidence } from "./nodes/evidence";
import type { EvidenceSource } from "./nodes/evidenceSources";
import type { ControlProfileEntry } from "./nodes/controlProfiles";
import {
  CLASSIFICATION_TIERS, ASSURANCE_CATEGORIES, PRISMA_LEVELS, EVIDENCE_TYPES,
  type ClassificationTier, type AssuranceCategory,
} from "./nodes/taxonomy";
import type { AssetId, ControlId, RiskId, SystemId, DataTypeId, EvidenceSourceId } from "./ids";

// ---- Small index helpers -----------------------------------------------------
// byId and groupBy exist so the twenty-odd indexes below read as declarations
// rather than twenty slightly-different reduce calls, which is how two of them
// previously ended up with subtly different missing-key behaviour.
function byId<T extends { id: string }>(rows: readonly T[]): Record<string, T> {
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null | undefined): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  rows.forEach((row) => {
    const k = key(row);
    if (k === null || k === undefined) return;
    (out[k] ||= []).push(row);
  });
  return out;
}

function keyBy<T>(rows: readonly T[], key: (row: T) => string): Record<string, T> {
  return Object.fromEntries(rows.map((r) => [key(r), r]));
}

const pair = (assetId: string, controlId: string) => `${assetId}::${controlId}`;

// ---- Evidence normalization --------------------------------------------------
// An evidence row is authored with what varies (when it was collected, what it
// found, how much it covered) and leaves what doesn't vary to be filled in: how
// long a collection of this type stays meaningful, and which source produced it.
function normalizeEvidence(facts: GraphFacts): Evidence[] {
  return facts.evidence.map((e) => ({
    ...e,
    validForDays: e.validForDays ?? DEFAULT_VALIDITY_DAYS[e.evidenceType],
    sourceId: sourceIdFromName(e.source),
  }));
}

// ---- Evidence sources ---------------------------------------------------------
// Derived, never authored. One node per distinct source name, each knowing its
// observations. Disagreement about what kind of source a name refers to is
// collected rather than thrown so graph/validate.ts can report every conflict
// in one pass — see the header of nodes/evidenceSources.ts for why a conflict
// is always a real problem and never a rounding difference.
function deriveEvidenceSources(evidence: readonly Evidence[]): {
  sources: EvidenceSource[];
  conflicts: string[];
} {
  const byKey = new Map<EvidenceSourceId, EvidenceSource>();
  const conflicts: string[] = [];

  evidence.forEach((e) => {
    const id = sourceIdFromName(e.source);
    const existing = byKey.get(id);
    if (!existing) {
      byKey.set(id, {
        id,
        name: e.source,
        evidenceType: e.evidenceType,
        independence: e.independence,
        observationIds: [e.id],
      });
      return;
    }
    existing.observationIds.push(e.id);
    if (existing.evidenceType !== e.evidenceType) {
      conflicts.push(
        `source "${e.source}" (${id}): observation ${e.id} declares evidenceType "${e.evidenceType}", but observation ${existing.observationIds[0]} declared "${existing.evidenceType}"`
      );
    }
    if (existing.independence !== e.independence) {
      conflicts.push(
        `source "${e.source}" (${id}): observation ${e.id} declares independence "${e.independence}", but observation ${existing.observationIds[0]} declared "${existing.independence}"`
      );
    }
  });

  return { sources: [...byKey.values()], conflicts };
}

// ---- Control profile resolution -----------------------------------------------
// Turns the profile DEFINITION into the lookup the engine reads:
// [tier][category] -> { maturity, evidence, weight }.
//
// `bump` moves one step along an ordered vocabulary, clamped at the top. Both
// MATURITY_STAGES and EVIDENCE_TYPES are ordered weakest-to-strongest precisely
// so "one notch stricter" is an index step rather than a lookup table that
// could disagree with the vocabulary it's keyed on.
function bump<T>(ordered: readonly T[], value: T): T {
  return ordered[Math.min(ordered.indexOf(value) + 1, ordered.length - 1)];
}

function resolveControlProfiles(
  definition: ControlProfileDefinition
): Record<ClassificationTier, Record<AssuranceCategory, ControlProfileEntry>> {
  const resolved = {} as Record<ClassificationTier, Record<AssuranceCategory, ControlProfileEntry>>;

  CLASSIFICATION_TIERS.forEach((tier) => {
    const base = definition.tierBaseline[tier];
    resolved[tier] = {} as Record<AssuranceCategory, ControlProfileEntry>;
    ASSURANCE_CATEGORIES.forEach((category) => {
      const stricter =
        definition.bumpedTiers.includes(tier) && definition.highSensitivityCategories.includes(category);
      resolved[tier][category] = {
        maturity: stricter ? bump(PRISMA_LEVELS, base.maturity) : base.maturity,
        evidence: stricter ? bump(EVIDENCE_TYPES, base.evidence) : base.evidence,
        weight: definition.categoryWeights[tier]?.[category] ?? 0,
      };
    });
  });

  return resolved;
}

// ---- Assembly ----------------------------------------------------------------
export function assembleGraph(facts: GraphFacts): Graph {
  const evidence = normalizeEvidence(facts);
  const { sources: evidenceSources, conflicts: sourceConflicts } = deriveEvidenceSources(evidence);

  // A control mapped to no framework clause is out of scope for every standard
  // ACME certifies against, so posture figures exclude it rather than counting
  // it as an unmet requirement.
  const inScopeControls = facts.controls.filter((c) => c.frameworks.length > 0);

  const controlsByClause: Record<string, typeof inScopeControls> = {};
  inScopeControls.forEach((control) => {
    control.frameworks.forEach(({ standard, clauses }) => {
      clauses.forEach((clause) => {
        (controlsByClause[`${standard}::${clause}`] ||= []).push(control);
      });
    });
  });

  // Evidence with no assetIds covers a program-scoped control rather than any
  // one asset, and is filed under the "program" sentinel so evidenceFor() has a
  // single lookup shape for both cases.
  //
  // Only Implemented-lane records (prismaLevel absent or "Implemented") enter
  // this index: it is what instance scoring and the Measured prevalence pool
  // read, and a record tagged to a documentation lane (Policy, Procedure,
  // Measured, Managed) substantiates that lane's claim without being an
  // implementation sample. Lane-tagged records are read through
  // engine/evidence.ts's laneEvidenceForControl instead.
  const evidenceByPair: Record<string, Evidence[]> = {};
  evidence
    .filter((e) => (e.recordStatus ?? "active") === "active" && (e.prismaLevel ?? "Implemented") === "Implemented")
    .forEach((e) => {
      if (e.assetIds.length === 0) {
        (evidenceByPair[pair("program", e.controlId)] ||= []).push(e);
        return;
      }
      e.assetIds.forEach((assetId) => (evidenceByPair[pair(assetId, e.controlId)] ||= []).push(e));
    });

  // ---- What the maturity ceiling stands on -----------------------------------
  // Both inverted from links that were already authored and already validated —
  // a policy's controlIds and an SOP step's `controls`. Neither had a reader
  // outside the two pages that render them, which is why "is there a policy
  // requiring this control" was unanswerable by anything that computed a score.
  const policiesByControl: Record<string, (typeof facts.policies)[number][]> = {};
  facts.policies.forEach((p) => {
    p.controlIds.forEach((id) => (policiesByControl[id] ||= []).push(p));
  });

  // Step granularity, not SOP granularity. A SOP owning a domain is a
  // coverage claim about the area; a step citing a control is the claim that
  // somebody is told what to do about that specific control, which is what the
  // Procedure rung actually asserts.
  const procedureStepsByControl: Record<string, { procedure: (typeof facts.procedures)[number]; stepTitle: string }[]> = {};
  facts.procedures.forEach((proc) => {
    proc.steps.forEach((step) => {
      (step.controls ?? []).forEach((id) => {
        (procedureStepsByControl[id] ||= []).push({ procedure: proc, stepTitle: step.title });
      });
    });
  });

  // The other half of the same question, at domain granularity. A control with
  // no citing policy or step is not automatically ungoverned — the library may
  // claim its whole area — and these two inversions are what let the Policy and
  // Procedure levels tell those cases apart instead of collapsing them.
  //
  // procedureByDomain is a single record, not a list: validate.ts proves exactly
  // one SOP claims each domain, so a list would imply an ambiguity the data does
  // not have. A duplicate claim fails the build rather than silently picking one.
  const policiesByDomain: Record<string, (typeof facts.policies)[number][]> = {};
  facts.policies.forEach((p) => {
    p.domains.forEach((d) => (policiesByDomain[d] ||= []).push(p));
  });

  const procedureByDomain: Record<string, (typeof facts.procedures)[number]> = {};
  facts.procedures.forEach((proc) => {
    proc.domains.forEach((d) => (procedureByDomain[d] = proc));
  });

  // ---- What the PRISMA assessment stands on ----------------------------------
  // A pair is scored when its system's declared scope names the control. Held as
  // a Set rather than rebuilt per lookup because every one of the ~500
  // system-control pairs asks this question at least once.
  const assessedPairs = new Set<string>();
  facts.assessmentScopes.forEach((scope) => {
    scope.controlIds.forEach((id) => assessedPairs.add(pair(scope.systemId, id)));
  });

  return {
    facts,

    // Normalized collections
    assets: facts.assets,
    systems: facts.systems,
    dataTypes: facts.dataTypes,
    controls: facts.controls,
    keyControls: facts.keyControls,
    evidence,
    evidenceSources,
    evidenceArtifacts: facts.evidenceArtifacts,
    evidenceReviews: facts.evidenceReviews,
    risks: facts.risks,
    orgs: facts.orgs,
    findings: facts.findings,
    actors: facts.actors,

    // Edges
    assetDataTypes: facts.assetDataTypes,
    dataFlows: facts.dataFlows,
    actorAccess: facts.actorAccess,
    applicabilityRules: facts.applicabilityRules,
    applicabilityExceptions: facts.applicabilityExceptions,
    ownership: facts.ownership,
    ownerOverrides: facts.ownerOverrides,
    implementationOverrides: facts.implementationOverrides,
    notImplemented: facts.notImplemented,
    implementationMechanisms: facts.implementationMechanisms,
    operatingHistory: facts.operatingHistory,
    programApplicabilityRules: facts.programApplicabilityRules,
    programApplicabilityExceptions: facts.programApplicabilityExceptions,
    policies: facts.policies,
    procedures: facts.procedures,
    prismaOverrides: facts.prismaOverrides,
    controlReviews: facts.controlReviews,
    scheduledActivities: facts.scheduledActivities,
    assessmentScopes: facts.assessmentScopes,
    providerCertifications: facts.providerCertifications,
    enterpriseAttestations: facts.enterpriseAttestations,
    pendingApplicability: facts.pendingApplicability,
    riskAssets: facts.riskAssets,
    riskControls: facts.riskControls,
    risksWithoutAssets: facts.risksWithoutAssets,
    risksWithoutControls: facts.risksWithoutControls,

    // Entity indexes
    assetById: byId(facts.assets) as Record<AssetId, (typeof facts.assets)[number]>,
    systemById: byId(facts.systems) as Record<SystemId, (typeof facts.systems)[number]>,
    dataTypeById: byId(facts.dataTypes) as Record<DataTypeId, (typeof facts.dataTypes)[number]>,
    controlById: byId(facts.controls) as Record<ControlId, (typeof facts.controls)[number]>,
    keyControlById: byId(facts.keyControls) as Record<ControlId, (typeof facts.keyControls)[number]>,
    evidenceById: byId(evidence),
    evidenceSourceById: byId(evidenceSources),
    evidenceArtifactById: byId(facts.evidenceArtifacts),
    evidenceReviewById: byId(facts.evidenceReviews),
    evidenceReviewsByEvidence: groupBy(facts.evidenceReviews, (review) => review.evidenceId),
    riskById: byId(facts.risks) as Record<RiskId, (typeof facts.risks)[number]>,
    orgById: byId(facts.orgs),
    actorById: byId(facts.actors),
    policyById: byId(facts.policies),

    // Traversal indexes
    // Fan-out, not a single-key groupBy: a shared asset's systemIds can name
    // more than one system, so the same Asset object lands in more than one
    // bucket — mirrors evidenceByPair's e.assetIds.forEach fan-out above.
    assetsBySystem: (() => {
      const out: Record<string, (typeof facts.assets)[number][]> = {};
      facts.assets.forEach((a) => a.systemIds.forEach((sid) => (out[sid] ||= []).push(a)));
      return out;
    })(),
    dataTypesByAsset: groupBy(facts.assetDataTypes, (e) => e.assetId),
    assetsByDataType: groupBy(facts.assetDataTypes, (e) => e.dataTypeId),
    flowsFromAsset: groupBy(facts.dataFlows, (f) => f.from),
    flowsToAsset: groupBy(facts.dataFlows, (f) => f.to),
    actorAccessByAsset: groupBy(facts.actorAccess, (a) => a.assetId),
    rulesByControl: groupBy(facts.applicabilityRules, (r) => r.controlId),
    inScopeControls,
    controlsByClause,

    // Pair indexes
    evidenceByPair,
    exceptionByPair: keyBy(facts.applicabilityExceptions, (e) => pair(e.assetId, e.controlId)),
    overrideByPair: keyBy(facts.implementationOverrides, (o) => pair(o.assetId, o.controlId)),
    notImplementedByPair: keyBy(facts.notImplemented, (n) => pair(n.assetId, n.controlId)),
    mechanismByPair: keyBy(facts.implementationMechanisms, (m) => pair(m.assetId, m.controlId)),
    operatingHistoryByPair: keyBy(facts.operatingHistory, (h) => pair(h.assetId, h.controlId)),
    programExceptionByPair: keyBy(facts.programApplicabilityExceptions, (e) => pair(e.systemId, e.controlId)),

    policiesByControl,
    procedureStepsByControl,
    policiesByDomain,
    procedureByDomain,
    rulesByProgramControl: groupBy(facts.programApplicabilityRules, (r) => r.controlId),

    // PRISMA assessment indexes
    assessmentScopeBySystem: keyBy(facts.assessmentScopes, (s) => s.systemId),
    assessedPairs,
    certificationsByProvider: groupBy(facts.providerCertifications, (c) => c.provider),
    enterpriseInheritedDomains: new Set(facts.enterpriseAttestations.flatMap((a) => a.domains)),
    attestationsByDomain: (() => {
      const out: Record<string, (typeof facts.enterpriseAttestations)[number][]> = {};
      facts.enterpriseAttestations.forEach((a) => {
        a.domains.forEach((d) => (out[d] ||= []).push(a));
      });
      return out;
    })(),
    pendingByPair: keyBy(facts.pendingApplicability, (p) => pair(p.systemId, p.controlId)),
    prismaOverrideByKey: keyBy(facts.prismaOverrides, (o) => `${o.systemId}::${o.controlId}::${o.level}`),
    controlReviewByKey: keyBy(facts.controlReviews, (o) => `${o.systemId}::${o.controlId}`),
    activitiesByControl: (() => {
      const byControl: Record<string, (typeof facts.scheduledActivities)[number][]> = {};
      facts.scheduledActivities.forEach((a) => {
        a.controlIds.forEach((id) => (byControl[id] ||= []).push(a));
      });
      return byControl;
    })(),
    activitiesByProcedure: groupBy(facts.scheduledActivities, (a) => a.procedureId),

    // Risk contribution
    assetsByRisk: groupBy(facts.riskAssets, (r) => r.riskId),
    controlsByRisk: groupBy(facts.riskControls, (r) => r.riskId),
    risksByAsset: groupBy(facts.riskAssets, (r) => r.assetId),
    risksByControl: groupBy(facts.riskControls, (r) => r.controlId),

    // Derived membership sets
    controlProfiles: resolveControlProfiles(facts.controlProfile),
    categoryWeights: facts.controlProfile.categoryWeights,
    controlBaselines: facts.controlBaselines,

    assetScopedControls: facts.keyControls.filter((c) => c.scope === "asset"),
    programScopedControls: facts.keyControls.filter((c) => c.scope === "program"),

    sourceConflicts,

    // ---- System Register cockpit domains ---------------------------------
    identityPopulations: facts.identityPopulations,
    accessReviews: facts.accessReviews,
    agenticIdentities: facts.agenticIdentities,
    exposurePostures: facts.exposurePostures,
    externalServices: facts.externalServices,
    exposureExceptions: facts.exposureExceptions,
    vulnSnapshots: facts.vulnSnapshots,
    securityTests: facts.securityTests,
    backupConfigs: facts.backupConfigs,
    drTests: facts.drTests,
    irPlanCurrency: facts.irPlanCurrency,
    tabletopExercises: facts.tabletopExercises,
    productionIncidents: facts.productionIncidents,
    vendors: facts.vendors,
    vendorAssurance: facts.vendorAssurance,
    systemVendors: facts.systemVendors,
    sdlcPostures: facts.sdlcPostures,

    identityPopulationsBySystem: groupBy(facts.identityPopulations, (p) => p.systemId),
    accessReviewsBySystem: groupBy(facts.accessReviews, (r) => r.systemId),
    agenticIdentitiesBySystem: groupBy(facts.agenticIdentities, (a) => a.systemId),
    exposurePostureBySystem: keyBy(facts.exposurePostures, (p) => p.systemId),
    externalServicesBySystem: groupBy(facts.externalServices, (e) => e.systemId),
    exposureExceptionsBySystem: groupBy(facts.exposureExceptions, (e) => e.systemId),
    vulnSnapshotBySystem: keyBy(facts.vulnSnapshots, (v) => v.systemId),
    securityTestsBySystem: groupBy(facts.securityTests, (t) => t.systemId),
    backupConfigBySystem: keyBy(facts.backupConfigs, (b) => b.systemId),
    drTestsBySystem: groupBy(facts.drTests, (t) => t.systemId),
    irPlanCurrencyByScope: keyBy(facts.irPlanCurrency, (p) => p.scope),
    tabletopExercisesByScope: groupBy(facts.tabletopExercises, (t) => t.scope),
    productionIncidentsBySystem: groupBy(facts.productionIncidents, (i) => i.systemId),
    vendorById: byId(facts.vendors),
    vendorAssuranceByVendor: groupBy(facts.vendorAssurance, (a) => a.vendorId),
    systemVendorsBySystem: groupBy(facts.systemVendors, (v) => v.systemId),
    sdlcPostureBySystem: keyBy(facts.sdlcPostures, (p) => p.systemId),
  };
}
