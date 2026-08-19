// The page-facing API. Pages import from here and nowhere else in the model.
//
// The rule the whole refactor rests on: there is exactly one function that
// answers any given question, so there can be exactly one answer. Three pages
// used to show prod-vector-db and each computed its own view of it; now all
// three call getAsset("AST-003-04") and there can only be one 74.
//
// explain() is the other half. Every derived number can name what produced it,
// hop by hop, down to an evidence record with a collection date. A GRC tool
// that can't answer "why does it say that" is asking to be trusted, and this
// one shouldn't have to be.
import type { Graph } from "../graph/types";
import { BASIS, BASIS_META, ASSURANCE_CATEGORIES, PRISMA_LEVELS, COMPLIANCE_LABELS, type Basis } from "../graph/nodes/taxonomy";
import { INSTANCE_STATUS_META } from "./assessment";
import type { ClassificationApi } from "./classification";
import type { ApplicabilityApi } from "./applicability";
import type { AssessmentApi } from "./assessment";
import type { EvidenceApi } from "./evidence";
import type { RollupsApi } from "./rollups";
import type { RiskApi } from "./risk";
import type { ComplianceApi } from "./compliance";
import type { AssetId, SystemId, ControlId, RiskId, DataTypeId, EvidenceId } from "../graph/ids";

interface NeighborGroup {
  relation: string;
  type: string;
  nodes: unknown[];
}

interface ExplainStep {
  label: string;
  value: unknown;
  weight?: number;
  basis?: Basis | null;
  detail?: string | null;
  next?: { type: string; id: string } | null;
}

interface Explanation {
  label: string;
  value: unknown;
  basis: Basis | null;
  formula: string;
  steps: ExplainStep[];
}

export function createSelectors(
  graph: Graph,
  classification: ClassificationApi,
  applicability: ApplicabilityApi,
  assessment: AssessmentApi,
  evidenceApi: EvidenceApi,
  rollups: RollupsApi,
  risk: RiskApi,
  compliance: ComplianceApi
) {
  // ---- Flow traversal --------------------------------------------------------
  const flowsFrom = (assetId: AssetId) => graph.flowsFromAsset[assetId] ?? [];
  const flowsTo = (assetId: AssetId) => graph.flowsToAsset[assetId] ?? [];
  const flowsCarrying = (dataTypeId: DataTypeId) => graph.dataFlows.filter((f) => f.dataTypeIds.includes(dataTypeId));

  // ---- Entity access ---------------------------------------------------------
  const getAsset = (id: AssetId) => rollups.assetRollupById[id] ?? null;
  const getSystem = (id: SystemId) => rollups.systemRollupById[id] ?? null;
  const getRisk = (id: RiskId) => risk.riskRollupById[id] ?? null;
  const getDataType = (id: DataTypeId) => graph.dataTypeById[id] ?? null;
  const getControl = (id: ControlId) => graph.keyControlById[id] ?? graph.controlById[id] ?? null;
  const getEvidence = (id: EvidenceId) =>
    graph.evidenceById[id] ? evidenceApi.scoreEvidence(graph.evidenceById[id]) : null;
  const getEvidenceArtifacts = (id: EvidenceId) =>
    (graph.evidenceById[id]?.artifactIds ?? []).flatMap((artifactId) => graph.evidenceArtifactById[artifactId] ?? []);
  const getEvidenceReviews = (id: EvidenceId) => graph.evidenceReviewsByEvidence[id] ?? [];

  // ---- Relationship traversal ------------------------------------------------
  // These used to return per-(asset, control) implementations, each with its own
  // score. They now return CONTROL INSTANCES — the same pairs, carrying a status
  // and the evidence behind it but no number, because the number for a control
  // exists once, at the system boundary.
  function getInstancesForAsset(assetId: AssetId) {
    return assessment.instancesForAsset(assetId);
  }

  function getInstance(assetId: AssetId, controlId: ControlId) {
    return assessment.instancesForAsset(assetId).find((i) => i.controlId === controlId) ?? null;
  }

  // How one control was assessed everywhere it applies — the view that shows why
  // a single global score for a control would be meaningless.
  function getControlAssessments(controlId: ControlId) {
    return graph.systems
      .map((s) => assessment.assessmentFor(s.id, controlId))
      .filter((a): a is NonNullable<typeof a> => a !== null && a.applicable);
  }

  // Both halves of the auditor's question, for every key control against one
  // asset: what applies and why, and what doesn't and why not.
  function getApplicabilityProfile(assetId: AssetId) {
    return graph.keyControls
      .filter((c) => c.scope === "asset")
      .map((c) => applicability.resolveApplicability(assetId, c.id));
  }

  // Everything one node connects to, typed. The Graph Explorer's navigation
  // model, and the quickest way to see whether the graph is actually joined up.
  function getNeighbors(nodeType: string, id: string): NeighborGroup[] {
    switch (nodeType) {
      case "system": {
        const system = getSystem(id);
        if (!system) return [];
        return [
          { relation: "contains", type: "asset", nodes: system.assets },
          { relation: "processes", type: "dataType", nodes: classification.dataTypesForSystem(id) },
        ];
      }
      case "asset": {
        const asset = getAsset(id);
        if (!asset) return [];
        return [
          { relation: "belongs to", type: "system", nodes: [getSystem(asset.systemId)] },
          { relation: "handles", type: "dataType", nodes: classification.dataForAsset(id).map((d) => ({ ...d.dataType, role: d.role })) },
          { relation: "subject to", type: "control", nodes: applicability.requiredControlsForAsset(id) },
          { relation: "sends to", type: "asset", nodes: flowsFrom(id).map((f) => getAsset(f.to)) },
          { relation: "receives from", type: "asset", nodes: flowsTo(id).map((f) => getAsset(f.from)) },
          { relation: "contributes to", type: "risk", nodes: (graph.risksByAsset[id] ?? []).map((e) => getRisk(e.riskId)) },
        ].filter((g) => g.nodes.length > 0);
      }
      case "control": {
        const control = graph.keyControlById[id];
        if (!control) return [];
        return [
          {
            relation: "implemented on", type: "asset",
            nodes: control.scope === "asset" ? applicability.assetsRequiringControl(id).map((a) => getAsset(a.id)) : [],
          },
          { relation: "evidenced by", type: "evidence", nodes: getControlAssessments(id).flatMap((a) => a.instances.flatMap((i) => i.evidence)) },
          { relation: "holds down", type: "risk", nodes: (graph.risksByControl[id] ?? []).map((e) => getRisk(e.riskId)) },
          {
            relation: "required by", type: "framework",
            nodes: control.frameworks.map((f) => ({ id: f.standard, name: f.standard, clauses: f.clauses })),
          },
        ].filter((g) => g.nodes.length > 0);
      }
      case "dataType": {
        return [
          { relation: "held by", type: "asset", nodes: classification.assetsHoldingDataType(id).map((a) => getAsset(a.id)) },
          { relation: "flows along", type: "flow", nodes: flowsCarrying(id) },
        ].filter((g) => g.nodes.length > 0);
      }
      case "risk": {
        return [
          { relation: "carried by", type: "asset", nodes: (graph.assetsByRisk[id] ?? []).map((e) => getAsset(e.assetId)) },
          { relation: "held down by", type: "control", nodes: (graph.controlsByRisk[id] ?? []).map((e) => graph.keyControlById[e.controlId]) },
        ].filter((g) => g.nodes.length > 0);
      }
      case "evidence": {
        const record = graph.evidenceById[id];
        if (!record) return [];
        return [
          { relation: "collected against", type: "control", nodes: [graph.keyControlById[record.controlId]] },
          { relation: "covering", type: "asset", nodes: record.assetIds.map((a) => getAsset(a)) },
        ].filter((g) => g.nodes.length > 0);
      }
      default:
        return [];
    }
  }

  // ---- explain() -------------------------------------------------------------
  // The derivation trace behind one number. Each step names what it contributed
  // and on what basis, so a reader can walk from an enterprise score down to a
  // specific test that ran on a specific day.
  function explain(nodeType: string, id: string, metric: string = "assurance"): Explanation | null {
    if (nodeType === "enterprise") {
      return {
        label: "Enterprise assurance",
        value: rollups.enterprise.assurance,
        basis: BASIS.MEASURED,
        formula: "Criticality-weighted mean of every system's assurance, where a system's weight is the total criticality of the assets inside it.",
        steps: rollups.systemRollups.map((s) => ({
          label: s.name,
          value: s.overallAssurance,
          weight: s.assets.reduce((a, x) => a + x.criticality, 0),
          basis: BASIS.MEASURED,
          next: { type: "system", id: s.id },
        })),
      };
    }

    if (nodeType === "system") {
      const system = getSystem(id);
      if (!system) return null;
      return {
        label: `${system.name} assurance`,
        value: system.overallAssurance,
        basis: BASIS.MEASURED,
        formula: `Assurance categories weighted by the ${system.classification} control profile, each a flat mean of the controls assessed in it. Derived from ${system.coverage.assessed} of ${system.coverage.applicable} applicable controls (${system.coverage.assessedPct}%) — the rest were not assessed and are not scored as zero.`,
        steps: ASSURANCE_CATEGORIES.map((c) => ({
          label: c,
          value: system.categories[c].score,
          weight: system.categoryWeights[c],
          basis: system.categories[c].basis,
          detail: system.categories[c].raw === null
            ? "No control in this category was assessed, so it contributes nothing rather than a zero."
            : `Contributes ${Math.round((((system.categories[c].raw as number) * system.categoryWeights[c]) / 100) * 10) / 10} of the ${system.overallAssurance} total, from ${system.categories[c].coverage.assessed} of ${system.categories[c].coverage.applicable} controls.`,
          next: { type: "system-category", id: `${id}::${c}` },
        })),
      };
    }

    if (nodeType === "asset" && metric === "assurance") {
      const asset = getAsset(id);
      if (!asset) return null;
      // An asset has no assurance score to explain any more. What it can
      // explain is which controls it was sampled for and what each one showed —
      // the diagnostic that replaced the score.
      return {
        label: `${asset.name} — control instances`,
        value: null,
        basis: BASIS.MEASURED,
        formula: `An asset is not scored. It is the sampling population for the controls that apply to it: ${asset.implementedCount} of ${asset.applicableControlCount} verified, ${asset.evidenceCoveragePct}% of required controls carrying any evidence. Its criticality (${asset.criticality}) still weights the enterprise rollup.`,
        steps: asset.controls.map((i) => ({
          label: `${i.controlId} — ${graph.controlById[i.controlId]?.name ?? ""}`,
          value: null,
          weight: i.credit,
          basis: i.evidence.length > 0 ? BASIS.MEASURED : BASIS.UNASSESSED,
          detail: i.statement,
          next: { type: "control-assessment", id: `${i.systemId}::${i.controlId}` },
        })),
      };
    }

    if (nodeType === "system-category") {
      const [systemId, category] = id.split("::");
      const system = getSystem(systemId);
      const rollup = system?.categories?.[category as keyof typeof system.categories];
      if (!rollup) return null;
      return {
        label: `${system!.name} — ${category}`,
        value: rollup.score,
        basis: rollup.basis,
        formula: "A flat mean of the controls assessed in this category. Every assessed control is one requirement statement the engagement tested, and no authored fact ranks them against each other within a category.",
        steps: rollup.assessments.map((a) => ({
          label: `${a.controlId} — ${a.control.name}`,
          value: a.score,
          weight: 1,
          basis: a.basis,
          detail: a.inherited ? `Inherited from ${system!.provider}.` : a.levels.Implemented.rationale,
          next: { type: "control-assessment", id: `${systemId}::${a.controlId}` },
        })),
      };
    }

    // One control on one system, across the five PRISMA levels. This is the
    // node the whole model resolves to.
    if (nodeType === "control-assessment") {
      const [systemId, controlId] = id.split("::");
      const a = assessment.assessmentFor(systemId, controlId);
      if (!a) return null;
      if (!a.assessed) {
        return {
          label: `${a.controlId} on ${graph.systemById[systemId]?.name}`,
          value: null,
          basis: BASIS.UNASSESSED,
          formula: "Applicable to this system and outside the declared assessment scope. Reported as unassessed rather than scored zero.",
          steps: [],
        };
      }
      return {
        label: `${a.controlId} — ${a.control.name} on ${graph.systemById[systemId]?.name}`,
        value: a.score,
        basis: a.basis,
        formula: `HITRUST PRISMA: Policy 15%, Procedure 20%, Implemented 40%, Measured 10%, Managed 15%, each rated on the five-point compliance scale.${a.inherited ? " Held below what ACME could claim for a control it verified itself." : ""}`,
        steps: PRISMA_LEVELS.map((level) => {
          const L = a.levels[level];
          return {
            label: `${level} — ${COMPLIANCE_LABELS[L.rating]}`,
            value: L.rating,
            weight: L.weight,
            basis: L.basis,
            detail: `${L.rating !== L.derived ? `Overridden from ${L.derived}. ` : ""}${L.rationale} Contributes ${L.contribution.toFixed(2)} of ${a.score}.`,
            next: level === "Implemented" && a.instances.length > 0
              ? { type: "asset", id: a.instances[0].assetId }
              : null,
          };
        }),
      };
    }

    // One asset's answer for one control. It explains a STATUS, not a score —
    // the score for this control lives on the control-assessment node above,
    // and this instance is one of the samples that produced its Implemented
    // rating.
    if (nodeType === "instance") {
      const [assetId, controlId] = id.split("::");
      const inst = getInstance(assetId as AssetId, controlId as ControlId);
      if (!inst) return null;
      return {
        label: `${controlId} on ${graph.assetById[assetId]?.name ?? assetId}`,
        value: INSTANCE_STATUS_META[inst.status]?.label ?? inst.status,
        basis: inst.evidence.length > 0 ? BASIS.MEASURED : BASIS.UNASSESSED,
        formula: `Contributes ${inst.credit} to the Implemented rating for ${controlId} on ${inst.systemId}. A control is verified here only when a current, passing collection at or above ${"API configuration observation"} grade covers the whole population — configured but unverified does not count.`,
        steps: [
          {
            label: inst.statement,
            value: inst.credit,
            basis: inst.evidence.length > 0 ? BASIS.MEASURED : BASIS.UNASSESSED,
            detail: inst.mechanism?.mechanism ?? inst.notImplemented?.reason ?? null,
            next: { type: "control-assessment", id: `${inst.systemId}::${controlId}` },
          },
          ...inst.evidence.map((e) => ({
            label: e.source,
            value: e.confidence,
            basis: BASIS.MEASURED,
            detail: `${e.evidenceType}, ${e.coveragePct}% coverage, collected ${e.collectedAt} (${e.ageDays} days ago${e.stale ? ", stale" : ""}) — ${e.result.toUpperCase()}${e.exceptionRate != null ? `, ${e.exceptions}/${e.population} ${e.populationUnit}` : ""}${e.note ? `. ${e.note}` : ""}`,
            next: { type: "evidence", id: e.id },
          })),
        ],
      };
    }

    if (nodeType === "risk") {
      const riskRollup = getRisk(id);
      if (!riskRollup) return null;
      return {
        label: `${riskRollup.scenario} — control assurance`,
        value: riskRollup.assurance.pct,
        basis: riskRollup.assurance.basis,
        formula: "The mean of the controls mapped to this scenario, each taken at its weakest boundary. Assets are listed as contributors but no longer carry a score into the number.",
        steps: [
          ...riskRollup.assurance.controls.map((c) => ({
            label: c.control.friendlyName,
            value: c.score,
            weight: 1,
            basis: BASIS.MEASURED,
            detail: c.weakest
              ? `Weakest boundary: ${c.weakest.score} on ${graph.systemById[c.weakest.systemId]?.name ?? c.weakest.systemId}`
              : null,
            next: c.weakest ? { type: "control-assessment", id: `${c.weakest.systemId}::${c.control.id}` } : null,
          })),
          ...riskRollup.assurance.assets.map((a) => ({
            label: a.asset.name,
            value: null,
            weight: a.weight,
            basis: BASIS.MEASURED,
            detail: a.note ?? `${a.role} contributor — carries this risk, no longer scored`,
            next: { type: "asset", id: a.asset.id },
          })),
        ],
      };
    }

    return null;
  }

  // ---- Model health ----------------------------------------------------------
  // The gap detector. Same spirit as the Security Principles page's
  // Operationalized / Partial / Not-Yet split: name what the model doesn't cover
  // rather than letting absence read as completeness.
  function modelHealth() {
    const assets = rollups.assetRollups;
    const allInstances = assets.flatMap((a) => a.controls);
    const allAssessments = rollups.systemRollups.flatMap((s) => s.assessments);
    const scored = allAssessments.filter((a) => a.assessed);
    const allEvidence = graph.evidence.map(evidenceApi.scoreEvidence);

    const undetermined = allInstances.filter((i) => i.status === "undetermined");
    const notImplemented = allInstances.filter((i) => i.status === "not-implemented");
    const partial = allInstances.filter((i) => i.status === "partial");
    const staleEvidence = allEvidence.filter((e) => e.stale);

    // The 16 in-scope controls no policy names by id. They are not a scoring
    // failure — the Policy level rates them from the domain their area belongs
    // to — but they are a real hole in the library, and one that only shows up
    // if something goes looking for it.
    const controlsNoPolicyNames = graph.inScopeControls.filter(
      (c) => (graph.policiesByControl[c.id] ?? []).length === 0
    );

    // The levels that are failing across the board. A level scoring 0 on most
    // of the estate is the single most actionable thing this model produces:
    // it names which rung of the ladder the whole programme is missing.
    const levelWeakness = PRISMA_LEVELS.map((level) => {
      const ratings: number[] = scored.map((a) => a.levels[level].rating);
      const zero = ratings.filter((r) => r === 0).length;
      return {
        level,
        zeroCount: zero,
        zeroPct: ratings.length === 0 ? 0 : Math.round((zero / ratings.length) * 100),
        mean: ratings.length === 0 ? null : Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length),
      };
    });

    const basisOrder: Basis[] = [BASIS.MEASURED, BASIS.ASSESSED, BASIS.INHERITED, BASIS.UNASSESSED];
    const basisCounts: Record<Basis, number> = {
      [BASIS.MEASURED]: 0,
      [BASIS.ASSESSED]: 0,
      [BASIS.INHERITED]: 0,
      [BASIS.UNASSESSED]: 0,
    };
    allAssessments.forEach((assessment) => { basisCounts[assessment.basis] += 1; });

    return {
      counts: {
        systems: graph.systems.length,
        assets: graph.assets.length,
        dataTypes: graph.dataTypes.length,
        dataFlows: graph.dataFlows.length,
        keyControls: graph.keyControls.length,
        evidenceRecords: graph.evidence.length,
        risks: graph.risks.length,
        assessments: allAssessments.length,
        scoredAssessments: scored.length,
        sampledInstances: allInstances.length,
      },
      coverage: {
        // The headline honesty figure: how much of what applies was examined.
        assessedPct: rollups.enterprise.coverage.assessedPct,
        assessed: rollups.enterprise.coverage.assessed,
        applicable: rollups.enterprise.coverage.applicable,
        inherited: rollups.enterprise.coverage.inherited,
        evidenceBackedPct: rollups.enterprise.controlBackedPct,
        assetsWithNoDataTypes: graph.assets.filter((a) => (graph.dataTypesByAsset[a.id] ?? []).length === 0),
        controlsNoPolicyNames,
      },
      levelWeakness,
      findings: {
        undetermined,
        notImplemented,
        partial,
        staleEvidence,
        exceptions: applicability.allExceptions(),
        ladderInversions: scored.filter((a) => a.ladderInversions.length > 0),
        risksWithoutAssets: risk.riskRollups.filter((r) => r.contributingAssets.length === 0),
        risksWithoutControls: risk.riskRollups.filter((r) => r.linkedControls.length === 0),
      },
      basisDistribution: basisOrder
        .filter((basis) => basisCounts[basis] > 0)
        .map((basis) => ({ basis, count: basisCounts[basis], ...BASIS_META[basis] })),
      evidenceCoverageByAsset: assets
        .map((a) => ({
          id: a.id, name: a.name, pct: a.evidenceCoveragePct,
          required: a.requiredControlCount, evidenced: a.evidencedControlCount,
        }))
        .sort((a, b) => a.pct - b.pct),
    };
  }

  return {
    // Entity access
    getAsset, getSystem, getRisk, getDataType, getControl, getEvidence, getEvidenceArtifacts, getEvidenceReviews,
    getAllAssets: () => rollups.assetRollups,
    getAllSystems: () => rollups.systemRollups,
    getAllRisks: () => risk.riskRollups,
    getAllDataTypes: () => graph.dataTypes,
    getAllKeyControls: () => graph.keyControls,
    getAllEvidence: () => graph.evidence.map(evidenceApi.scoreEvidence),
    getEnterprise: () => rollups.enterprise,
    getCategoryAverages: () => rollups.categoryPortfolioAverages,

    // Traversal
    getInstancesForAsset, getInstance, getControlAssessments,
    getApplicability: (assetId: AssetId, controlId: ControlId) => applicability.resolveApplicability(assetId, controlId),
    getApplicabilityProfile,
    getDataFlows: (systemId: SystemId) => rollups.flowLayoutForSystem(systemId),
    getNeighbors,
    flowsFrom, flowsTo, flowsCarrying,

    // Re-exported from the modules that own them, so pages keep one import path.
    dataForAsset: classification.dataForAsset,
    dataTypesForSystem: classification.dataTypesForSystem,
    assetsHoldingDataType: classification.assetsHoldingDataType,
    assetClassification: classification.assetClassification,
    requiredControlsForAsset: applicability.requiredControlsForAsset,
    assetsRequiringControl: applicability.assetsRequiringControl,
    allExceptions: applicability.allExceptions,
    evidenceFor: evidenceApi.evidenceFor,
    risksForAssetRollup: risk.risksForAssetRollup,
    systemControlMatrix: compliance.systemControlMatrix,
    systemCoverageBreakdown: compliance.systemCoverageBreakdown,
    systemStandardMappings: compliance.systemStandardMappings,
    clauseCoverage: compliance.clauseCoverage,
    controlCoverageForSystem: compliance.controlCoverageForSystem,
    frameworkPosture: compliance.frameworkPosture,
    FRAMEWORK_POSTURE: compliance.FRAMEWORK_POSTURE,
    ENTERPRISE_COVERAGE: compliance.ENTERPRISE_COVERAGE,
    IN_SCOPE_FRAMEWORKS: compliance.IN_SCOPE_FRAMEWORKS,
    assetsForSystem: compliance.assetsForSystem,

    explain,
    modelHealth,
  };
}

export type SelectorsApi = ReturnType<typeof createSelectors>;
