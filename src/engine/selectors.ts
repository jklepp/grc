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
import { BASIS, BASIS_META, ASSURANCE_CATEGORIES } from "../graph/nodes/taxonomy";
import type { ClassificationApi } from "./classification";
import type { ApplicabilityApi } from "./applicability";
import type { ImplementationApi, Implementation } from "./implementation";
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
  basis?: string | null;
  detail?: string | null;
  next?: { type: string; id: string } | null;
}

interface Explanation {
  label: string;
  value: unknown;
  basis: string | null;
  formula: string;
  steps: ExplainStep[];
}

export function createSelectors(
  graph: Graph,
  classification: ClassificationApi,
  applicability: ApplicabilityApi,
  implementation: ImplementationApi,
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
    graph.evidenceById[id] ? implementation.scoreEvidence(graph.evidenceById[id]) : null;

  // ---- Relationship traversal ------------------------------------------------
  function getImplementations(assetId: AssetId) {
    return implementation.implementationsForAsset(assetId);
  }

  function getImplementation(assetId: AssetId | null, controlId: ControlId) {
    return implementation.buildImplementation(assetId, controlId);
  }

  // Every implementation of one control across the estate — the view that shows
  // why a single global score for a control would be meaningless.
  function getControlImplementations(controlId: ControlId): Implementation[] {
    const control = graph.keyControlById[controlId];
    if (!control) return [];
    if (control.scope === "program") {
      const impl = implementation.programImplementation(controlId);
      return impl ? [impl] : [];
    }
    return applicability.assetsRequiringControl(controlId).map((a) => implementation.buildImplementation(a.id, controlId));
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
          { relation: "evidenced by", type: "evidence", nodes: getControlImplementations(id).flatMap((i) => i.evidence) },
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
        formula: "Criticality-weighted mean of this system's assets, so the assets that matter most move it most.",
        steps: system.assets.map((a) => ({
          label: a.name,
          value: a.overallAssurance,
          weight: a.criticality,
          basis: a.controlBackedPct > 0 ? BASIS.MEASURED : BASIS.ASSESSED,
          next: { type: "asset", id: a.id },
        })),
      };
    }

    if (nodeType === "asset" && metric === "assurance") {
      const asset = getAsset(id);
      if (!asset) return null;
      return {
        label: `${asset.name} assurance`,
        value: asset.overallAssurance,
        basis: asset.controlBackedPct > 0 ? BASIS.MEASURED : BASIS.ASSESSED,
        formula: `Weighted by the ${asset.classification} control profile, so the categories that matter most for this tier of data count most. Within each category, measured implementations and the assessed remainder carry equal weight.`,
        steps: ASSURANCE_CATEGORIES.map((c) => ({
          label: c,
          value: asset.categories[c].score,
          weight: asset.categoryWeights[c],
          basis: asset.categories[c].basis,
          detail: `Contributes ${Math.round((((asset.categories[c].raw as number) * asset.categoryWeights[c]) / 100) * 10) / 10} of the ${asset.overallAssurance} total. ${asset.categories[c].evidencedCount} of ${asset.categories[c].requiredCount} tracked controls evidenced; assessed baseline ${asset.categories[c].baseline}.`,
          next: { type: "category", id: `${id}::${c}` },
        })),
      };
    }

    if (nodeType === "category") {
      const [assetId, category] = id.split("::");
      const asset = getAsset(assetId);
      const rollup = asset?.categories?.[category as keyof typeof asset.categories];
      if (!rollup) return null;
      return {
        label: `${asset!.name} — ${category}`,
        value: rollup.score,
        basis: rollup.basis,
        formula: "Measured implementations and the assessed baseline carry equal total weight. The baseline stands in for every in-scope control in this category that isn't individually tracked.",
        steps: [
          ...rollup.implementations.map((i) => ({
            label: i.control.friendlyName,
            value: i.score,
            weight: 1,
            basis: i.basis,
            detail: i.note ?? i.applicability.reasons[0]?.rationale,
            next: { type: "implementation", id: `${assetId}::${i.controlId}` },
          })),
          {
            label: "Assessed remainder",
            value: rollup.baseline,
            weight: rollup.implementations.length || 1,
            basis: BASIS.ASSESSED,
            detail: `${rollup.assessment.maturityStage} maturity, ${rollup.assessment.evidenceType} evidence, ${rollup.assessment.effectivenessPct}% effective — ${rollup.assessment.assessedBy}, ${rollup.assessment.assessedAt}`,
          },
        ],
      };
    }

    if (nodeType === "implementation") {
      const [assetId, controlId] = id.split("::");
      const impl = implementation.buildImplementation(assetId === "program" ? null : assetId, controlId);
      if (!impl) return null;
      return {
        label: `${impl.control.friendlyName} on ${assetId === "program" ? "the program" : graph.assetById[assetId]?.name}`,
        value: impl.score,
        basis: impl.basis,
        formula: "40% maturity + 30% evidence confidence + 30% effectiveness. Effectiveness starts from the category baseline and is scaled by how prevalent the verified failures were, not merely by whether there were any.",
        steps: [
          {
            label: `Maturity — ${impl.maturityStage ?? "none"}`,
            value: impl.maturityStage,
            basis: impl.override ? BASIS.MEASURED : BASIS.ASSESSED,
            detail: impl.override?.note ?? "Inherited from the asset's category assessment.",
          },
          {
            label: `Effectiveness — ${impl.effectivenessPct}%`,
            value: impl.effectivenessPct,
            basis: impl.basis,
            detail: impl.exceptionSummary
              ? `Baseline ${Math.round(impl.baseline?.effectivenessPct as number)}% x ${(impl.effectivenessFactor as number).toFixed(2)}, from ${impl.exceptionSummary.exceptions} of ${impl.exceptionSummary.population} ${impl.exceptionSummary.unit} in breach (${((impl.exceptionSummary.rate as number) * 100).toFixed(2)}%) per ${impl.exceptionSummary.source}. An isolated exception costs little; a systemic one costs most of the control's credit.`
              : impl.result
                ? `Baseline ${Math.round(impl.baseline?.effectivenessPct as number)}% x ${(impl.effectivenessFactor as number).toFixed(2)} for an aggregate result of "${impl.result}". No exception counts were recorded, so the fixed factor for that result applies.`
                : "No evidence — baseline carried through unchanged.",
          },
          // How the population was actually divided up between collections. The
          // whole point of composing rather than taking the strongest: a narrow
          // high-grade test and a broad lower-grade one each cover a share.
          ...(impl.evidenceAllocation.length > 1
            ? [{
                label: `Evidence confidence — ${impl.evidenceConfidence}`,
                value: impl.evidenceConfidence,
                basis: BASIS.MEASURED,
                detail: `${impl.evidenceAllocation.map((a) => `${Math.round(a.claimed * 100)}% at quality ${a.quality} (${a.source})`).join("; ")}${(impl.evidenceUncovered as number) > 0 ? `; ${Math.round((impl.evidenceUncovered as number) * 100)}% unevidenced` : ""}.`,
              }]
            : []),
          ...impl.evidence.map((e) => ({
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
        formula: "60% from the controls that hold this scenario down, 40% from the assets that carry it (primary contributors weighted 3x).",
        steps: [
          ...riskRollup.assurance.controls.map((c) => ({
            label: c.control.friendlyName,
            value: c.score,
            weight: 3,
            basis: BASIS.MEASURED,
            detail: c.weakest
              ? `Weakest implementation: ${c.weakest.score} on ${c.weakest.assetId ? graph.assetById[c.weakest.assetId]?.name : "the program"}`
              : null,
            next: c.weakest ? { type: "implementation", id: `${c.weakest.assetId ?? "program"}::${c.control.id}` } : null,
          })),
          ...riskRollup.assurance.assets.map((a) => ({
            label: a.asset.name,
            value: a.asset.overallAssurance,
            weight: a.weight,
            basis: BASIS.MEASURED,
            detail: a.note ?? `${a.role} contributor`,
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
    const allImplementations = assets.flatMap((a) => a.implementations);
    const allEvidence = graph.evidence.map(implementation.scoreEvidence);

    const unevidenced = allImplementations.filter((i) => i.status === "unevidenced");
    const notImplemented = allImplementations.filter((i) => i.status === "not-implemented");
    const deficient = allImplementations.filter((i) => i.status === "deficient");
    const staleEvidence = allEvidence.filter((e) => e.stale);

    // Categories that are assessed-only for every asset. Governance is the
    // honest example: every one of its key controls is program-scoped, so no
    // asset's Governance score is ever control-backed. Worth surfacing so it
    // reads as a deliberate modelling choice rather than an oversight.
    const alwaysAssessedCategories = ASSURANCE_CATEGORIES.filter((c) =>
      assets.every((a) => a.categories[c].basis === BASIS.ASSESSED)
    );

    return {
      counts: {
        systems: graph.systems.length,
        assets: graph.assets.length,
        dataTypes: graph.dataTypes.length,
        dataFlows: graph.dataFlows.length,
        keyControls: graph.keyControls.length,
        evidenceRecords: graph.evidence.length,
        risks: graph.risks.length,
        implementations: allImplementations.length + implementation.PROGRAM_IMPLEMENTATIONS.length,
      },
      coverage: {
        controlBackedPct: rollups.enterprise.controlBackedPct,
        measuredCompliancePct: compliance.ENTERPRISE_COVERAGE.measuredPct,
        assetsWithNoDataTypes: graph.assets.filter((a) => (graph.dataTypesByAsset[a.id] ?? []).length === 0),
        alwaysAssessedCategories,
      },
      findings: {
        unevidenced,
        notImplemented,
        deficient,
        staleEvidence,
        exceptions: applicability.allExceptions(),
        risksWithoutAssets: risk.riskRollups.filter((r) => r.contributingAssets.length === 0),
        risksWithoutControls: risk.riskRollups.filter((r) => r.linkedControls.length === 0),
      },
      basisDistribution: Object.entries(
        allImplementations.reduce((acc: Record<string, number>, i) => {
          acc[i.basis] = (acc[i.basis] || 0) + 1;
          return acc;
        }, {})
      ).map(([basis, count]) => ({ basis, count, ...BASIS_META[basis as keyof typeof BASIS_META] })),
      controlBackedByAsset: assets
        .map((a) => ({
          id: a.id, name: a.name, pct: a.controlBackedPct,
          required: a.requiredControlCount, evidenced: a.evidencedControlCount,
        }))
        .sort((a, b) => a.pct - b.pct),
    };
  }

  return {
    // Entity access
    getAsset, getSystem, getRisk, getDataType, getControl, getEvidence,
    getAllAssets: () => rollups.assetRollups,
    getAllSystems: () => rollups.systemRollups,
    getAllRisks: () => risk.riskRollups,
    getAllDataTypes: () => graph.dataTypes,
    getAllKeyControls: () => graph.keyControls,
    getAllEvidence: () => graph.evidence.map(implementation.scoreEvidence),
    getEnterprise: () => rollups.enterprise,
    getCategoryAverages: () => rollups.categoryPortfolioAverages,

    // Traversal
    getImplementations, getImplementation, getControlImplementations,
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
    evidenceFor: implementation.evidenceFor,
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
