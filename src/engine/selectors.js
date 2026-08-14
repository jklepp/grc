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
import { SYSTEMS } from "../graph/nodes/systems";
import { ASSETS, ASSET_BY_ID } from "../graph/nodes/assets";
import { DATA_TYPES, DATA_TYPE_BY_ID } from "../graph/nodes/dataTypes";
import { KEY_CONTROLS, KEY_CONTROL_BY_ID } from "../graph/nodes/keyControls";
import { CONTROL_BY_ID } from "../graph/nodes/controls";
import { EVIDENCE, EVIDENCE_BY_ID, evidenceFor } from "../graph/nodes/evidence";
import { RISKS } from "../graph/nodes/risks";
import { BASIS, BASIS_META, ASSURANCE_CATEGORIES } from "../graph/nodes/taxonomy";
import { dataTypesForAsset } from "../graph/edges/assetDataTypes";
import { DATA_FLOWS, flowsFrom, flowsTo, flowsCarrying } from "../graph/edges/dataFlows";
import { risksForAsset, risksForControl, assetsForRisk, controlsForRisk } from "../graph/edges/riskContributors";
import { ASSET_ROLLUP_BY_ID, ASSET_ROLLUPS, SYSTEM_ROLLUP_BY_ID, SYSTEM_ROLLUPS, ENTERPRISE, CATEGORY_PORTFOLIO_AVERAGES, flowLayoutForSystem } from "./rollups";
import { RISK_ROLLUP_BY_ID, RISK_ROLLUPS, risksForAssetRollup } from "./risk";
import { buildImplementation, implementationsForAsset, programImplementation, PROGRAM_IMPLEMENTATIONS, scoreEvidence } from "./implementation";
import { resolveApplicability, requiredControlsForAsset, assetsRequiringControl, allExceptions } from "./applicability";
import { assetClassification, dataForAsset, dataTypesForSystem, assetsHoldingDataType } from "./classification";
import { systemControlMatrix, systemCoverageBreakdown, systemStandardMappings, clauseCoverage, controlCoverageForSystem, frameworkPosture, FRAMEWORK_POSTURE, ENTERPRISE_COVERAGE, IN_SCOPE_FRAMEWORKS } from "./compliance";

// ---- Entity access ---------------------------------------------------------------
export const getAsset = (id) => ASSET_ROLLUP_BY_ID[id] ?? null;
export const getSystem = (id) => SYSTEM_ROLLUP_BY_ID[id] ?? null;
export const getRisk = (id) => RISK_ROLLUP_BY_ID[id] ?? null;
export const getDataType = (id) => DATA_TYPE_BY_ID[id] ?? null;
export const getControl = (id) => KEY_CONTROL_BY_ID[id] ?? CONTROL_BY_ID[id] ?? null;
export const getEvidence = (id) => (EVIDENCE_BY_ID[id] ? scoreEvidence(EVIDENCE_BY_ID[id]) : null);

export const getAllAssets = () => ASSET_ROLLUPS;
export const getAllSystems = () => SYSTEM_ROLLUPS;
export const getAllRisks = () => RISK_ROLLUPS;
export const getAllDataTypes = () => DATA_TYPES;
export const getAllKeyControls = () => KEY_CONTROLS;
export const getAllEvidence = () => EVIDENCE.map(scoreEvidence);

export const getEnterprise = () => ENTERPRISE;
export const getCategoryAverages = () => CATEGORY_PORTFOLIO_AVERAGES;

// ---- Relationship traversal --------------------------------------------------------
export function getImplementations(assetId) {
  return implementationsForAsset(assetId);
}

export function getImplementation(assetId, controlId) {
  return buildImplementation(assetId, controlId);
}

// Every implementation of one control across the estate — the view that shows
// why a single global score for a control would be meaningless.
export function getControlImplementations(controlId) {
  const control = KEY_CONTROL_BY_ID[controlId];
  if (!control) return [];
  if (control.scope === "program") return [programImplementation(controlId)];
  return assetsRequiringControl(controlId).map((a) => buildImplementation(a.id, controlId));
}

export function getApplicability(assetId, controlId) {
  return resolveApplicability(assetId, controlId);
}

// Both halves of the auditor's question, for every key control against one
// asset: what applies and why, and what doesn't and why not.
export function getApplicabilityProfile(assetId) {
  return KEY_CONTROLS.filter((c) => c.scope === "asset").map((c) => resolveApplicability(assetId, c.id));
}

export function getDataFlows(systemId) {
  return flowLayoutForSystem(systemId);
}

export { flowsFrom, flowsTo, flowsCarrying, dataForAsset, dataTypesForSystem, assetsHoldingDataType, assetClassification };
export { systemControlMatrix, systemCoverageBreakdown, systemStandardMappings, clauseCoverage, controlCoverageForSystem, frameworkPosture, FRAMEWORK_POSTURE, ENTERPRISE_COVERAGE, IN_SCOPE_FRAMEWORKS };
export { requiredControlsForAsset, assetsRequiringControl, allExceptions, evidenceFor, risksForAssetRollup };

// Everything one node connects to, typed. The Graph Explorer's navigation
// model, and the quickest way to see whether the graph is actually joined up.
export function getNeighbors(nodeType, id) {
  switch (nodeType) {
    case "system": {
      const system = getSystem(id);
      if (!system) return [];
      return [
        { relation: "contains", type: "asset", nodes: system.assets },
        { relation: "processes", type: "dataType", nodes: dataTypesForSystem(id) },
      ];
    }
    case "asset": {
      const asset = getAsset(id);
      if (!asset) return [];
      return [
        { relation: "belongs to", type: "system", nodes: [getSystem(asset.systemId)] },
        { relation: "handles", type: "dataType", nodes: dataForAsset(id).map((d) => ({ ...d.dataType, role: d.role })) },
        { relation: "subject to", type: "control", nodes: requiredControlsForAsset(id) },
        { relation: "sends to", type: "asset", nodes: flowsFrom(id).map((f) => getAsset(f.to)) },
        { relation: "receives from", type: "asset", nodes: flowsTo(id).map((f) => getAsset(f.from)) },
        { relation: "contributes to", type: "risk", nodes: risksForAsset(id).map((e) => getRisk(e.riskId)) },
      ].filter((g) => g.nodes.length > 0);
    }
    case "control": {
      const control = KEY_CONTROL_BY_ID[id];
      if (!control) return [];
      return [
        { relation: "implemented on", type: "asset", nodes: control.scope === "asset" ? assetsRequiringControl(id).map((a) => getAsset(a.id)) : [] },
        { relation: "evidenced by", type: "evidence", nodes: getControlImplementations(id).flatMap((i) => i.evidence) },
        { relation: "holds down", type: "risk", nodes: risksForControl(id).map((e) => getRisk(e.riskId)) },
        { relation: "required by", type: "framework", nodes: control.frameworks.map((f) => ({ id: f.standard, name: f.standard, clauses: f.clauses })) },
      ].filter((g) => g.nodes.length > 0);
    }
    case "dataType": {
      return [
        { relation: "held by", type: "asset", nodes: assetsHoldingDataType(id).map((a) => getAsset(a.id)) },
        { relation: "flows along", type: "flow", nodes: flowsCarrying(id) },
      ].filter((g) => g.nodes.length > 0);
    }
    case "risk": {
      return [
        { relation: "carried by", type: "asset", nodes: assetsForRisk(id).map((e) => getAsset(e.assetId)) },
        { relation: "held down by", type: "control", nodes: controlsForRisk(id).map((e) => KEY_CONTROL_BY_ID[e.controlId]) },
      ].filter((g) => g.nodes.length > 0);
    }
    case "evidence": {
      const record = EVIDENCE_BY_ID[id];
      if (!record) return [];
      return [
        { relation: "collected against", type: "control", nodes: [KEY_CONTROL_BY_ID[record.controlId]] },
        { relation: "covering", type: "asset", nodes: record.assetIds.map((a) => getAsset(a)) },
      ].filter((g) => g.nodes.length > 0);
    }
    default:
      return [];
  }
}

// ---- explain() ---------------------------------------------------------------------
// The derivation trace behind one number. Each step names what it contributed
// and on what basis, so a reader can walk from an enterprise score down to a
// specific test that ran on a specific day.
export function explain(nodeType, id, metric = "assurance") {
  if (nodeType === "enterprise") {
    return {
      label: "Enterprise assurance",
      value: ENTERPRISE.assurance,
      basis: BASIS.MEASURED,
      formula: "Criticality-weighted mean of every system's assurance, where a system's weight is the total criticality of the assets inside it.",
      steps: SYSTEM_ROLLUPS.map((s) => ({
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
      formula: "Equal-weighted mean of the six assurance categories. Within each category, measured implementations and the assessed remainder carry equal weight.",
      steps: ASSURANCE_CATEGORIES.map((c) => ({
        label: c,
        value: asset.categories[c].score,
        weight: 1,
        basis: asset.categories[c].basis,
        detail: `${asset.categories[c].evidencedCount} of ${asset.categories[c].requiredCount} tracked controls evidenced; assessed baseline ${asset.categories[c].baseline}`,
        next: { type: "category", id: `${id}::${c}` },
      })),
    };
  }

  if (nodeType === "category") {
    const [assetId, category] = id.split("::");
    const asset = getAsset(assetId);
    const rollup = asset?.categories?.[category];
    if (!rollup) return null;
    return {
      label: `${asset.name} — ${category}`,
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
    const impl = buildImplementation(assetId === "program" ? null : assetId, controlId);
    if (!impl) return null;
    return {
      label: `${impl.control.friendlyName} on ${assetId === "program" ? "the program" : ASSET_BY_ID[assetId]?.name}`,
      value: impl.score,
      basis: impl.basis,
      formula: "40% maturity + 30% evidence confidence + 30% effectiveness. Effectiveness starts from the category baseline and moves with what the evidence returned.",
      steps: [
        { label: `Maturity — ${impl.maturityStage ?? "none"}`, value: impl.maturityStage, basis: impl.override ? BASIS.MEASURED : BASIS.ASSESSED, detail: impl.override?.note ?? "Inherited from the asset's category assessment." },
        { label: `Effectiveness — ${impl.effectivenessPct}%`, value: impl.effectivenessPct, basis: impl.basis, detail: impl.result ? `Baseline ${impl.baseline?.effectivenessPct}% adjusted for an aggregate evidence result of "${impl.result}".` : "No evidence — baseline carried through unchanged." },
        ...impl.evidence.map((e) => ({
          label: e.source,
          value: e.confidence,
          basis: BASIS.MEASURED,
          detail: `${e.evidenceType}, ${e.coveragePct}% coverage, collected ${e.collectedAt} (${e.ageDays} days ago${e.stale ? ", stale" : ""}) — ${e.result.toUpperCase()}${e.note ? `. ${e.note}` : ""}`,
          next: { type: "evidence", id: e.id },
        })),
      ],
    };
  }

  if (nodeType === "risk") {
    const risk = getRisk(id);
    if (!risk) return null;
    return {
      label: `${risk.scenario} — control assurance`,
      value: risk.assurance.pct,
      basis: risk.assurance.basis,
      formula: "60% from the controls that hold this scenario down, 40% from the assets that carry it (primary contributors weighted 3x).",
      steps: [
        ...risk.assurance.controls.map((c) => ({
          label: c.control.friendlyName,
          value: c.score,
          weight: 3,
          basis: BASIS.MEASURED,
          detail: c.weakest ? `Weakest implementation: ${c.weakest.score} on ${c.weakest.assetId ? ASSET_BY_ID[c.weakest.assetId]?.name : "the program"}` : null,
          next: c.weakest ? { type: "implementation", id: `${c.weakest.assetId ?? "program"}::${c.control.id}` } : null,
        })),
        ...risk.assurance.assets.map((a) => ({
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

// ---- Model health -------------------------------------------------------------------
// The gap detector. Same spirit as the Security Principles page's
// Operationalized / Partial / Not-Yet split: name what the model doesn't cover
// rather than letting absence read as completeness.
export function modelHealth() {
  const assets = ASSET_ROLLUPS;
  const allImplementations = assets.flatMap((a) => a.implementations);
  const allEvidence = EVIDENCE.map(scoreEvidence);

  const unevidenced = allImplementations.filter((i) => i.status === "unevidenced");
  const notImplemented = allImplementations.filter((i) => i.status === "not-implemented");
  const deficient = allImplementations.filter((i) => i.status === "deficient");
  const staleEvidence = allEvidence.filter((e) => e.stale);

  // Categories that are assessed-only for every asset. Governance is the honest
  // example: every one of its key controls is program-scoped, so no asset's
  // Governance score is ever control-backed. Worth surfacing so it reads as a
  // deliberate modelling choice rather than an oversight.
  const alwaysAssessedCategories = ASSURANCE_CATEGORIES.filter((c) =>
    assets.every((a) => a.categories[c].basis === BASIS.ASSESSED)
  );

  return {
    counts: {
      systems: SYSTEMS.length,
      assets: ASSETS.length,
      dataTypes: DATA_TYPES.length,
      dataFlows: DATA_FLOWS.length,
      keyControls: KEY_CONTROLS.length,
      evidenceRecords: EVIDENCE.length,
      risks: RISKS.length,
      implementations: allImplementations.length + PROGRAM_IMPLEMENTATIONS.length,
    },
    coverage: {
      controlBackedPct: ENTERPRISE.controlBackedPct,
      measuredCompliancePct: ENTERPRISE_COVERAGE.measuredPct,
      assetsWithNoDataTypes: ASSETS.filter((a) => dataTypesForAsset(a.id).length === 0),
      alwaysAssessedCategories,
    },
    findings: {
      unevidenced,
      notImplemented,
      deficient,
      staleEvidence,
      exceptions: allExceptions(),
      risksWithoutAssets: RISK_ROLLUPS.filter((r) => r.contributingAssets.length === 0),
      risksWithoutControls: RISK_ROLLUPS.filter((r) => r.linkedControls.length === 0),
    },
    basisDistribution: Object.entries(
      allImplementations.reduce((acc, i) => {
        acc[i.basis] = (acc[i.basis] || 0) + 1;
        return acc;
      }, {})
    ).map(([basis, count]) => ({ basis, count, ...BASIS_META[basis] })),
    controlBackedByAsset: assets
      .map((a) => ({ id: a.id, name: a.name, pct: a.controlBackedPct, required: a.requiredControlCount, evidenced: a.evidencedControlCount }))
      .sort((a, b) => a.pct - b.pct),
  };
}
