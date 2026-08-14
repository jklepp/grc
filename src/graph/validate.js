// Structural integrity, checked at module load. Throws.
//
// The point of a graph is that a fact lives in one place and everything else
// points at it. That only holds if a pointer that doesn't resolve is loud.
// Without this, a typo'd asset id in a data flow silently produces an edge to
// nowhere and a map that quietly omits a hop; a control id that doesn't exist
// silently produces a control with no framework mappings and a compliance page
// that undercounts. Both are worse than a crash, because both look fine.
//
// This is the same pattern already used in securityPrinciples.js (a stale SOP
// step title fails the build) and riskRegister.js (a board risk that no longer
// clears the material bar fails the build), applied to every edge in the model.
//
// Structural checks only — anything that needs a derived value lives in
// engine/validate.js, since deriving it requires the engine and the graph must
// stay free of scoring.
import { CLASSIFICATION_TIERS, ASSURANCE_CATEGORIES, MATURITY_STAGES, EVIDENCE_TYPES } from "./nodes/taxonomy";
import { SYSTEMS, SYSTEM_BY_ID, HOSTING_TYPES, INHERITED_DOMAINS } from "./nodes/systems";
import { ASSETS, ASSET_BY_ID, ASSET_KINDS } from "./nodes/assets";
import { DATA_TYPES, DATA_TYPE_BY_ID } from "./nodes/dataTypes";
import { CONTROL_BY_ID, DOMAINS } from "./nodes/controls";
import { KEY_CONTROLS, KEY_CONTROL_BY_ID } from "./nodes/keyControls";
import { EVIDENCE, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS } from "./nodes/evidence";
import { RISKS, RISK_BY_ID, SEVERITY_LEVELS, LIKELIHOOD_LEVELS, BOARD_MATERIAL_RISK_IDS } from "./nodes/risks";
import { ASSET_DATA_TYPES, DATA_ROLE_META, dataTypesForAsset } from "./edges/assetDataTypes";
import { DATA_FLOWS, FLOW_KINDS } from "./edges/dataFlows";
import { CATEGORY_ASSESSMENTS } from "./edges/categoryAssessments";
import { APPLICABILITY_RULES, APPLICABILITY_EXCEPTIONS } from "./edges/applicabilityRules";
import { IMPLEMENTATION_OVERRIDES, NOT_IMPLEMENTED, OWNERSHIP } from "./edges/controlImplementations";
import { RISK_ASSETS, RISK_CONTROLS, RISKS_WITHOUT_ASSETS, RISKS_WITHOUT_CONTROLS, CONTRIBUTOR_ROLES } from "./edges/riskContributors";

const problems = [];

function check(condition, message) {
  if (!condition) problems.push(message);
}

// ---- Nodes -------------------------------------------------------------------
const idsSeen = new Set();
[...SYSTEMS, ...ASSETS, ...DATA_TYPES, ...EVIDENCE, ...RISKS, ...DATA_FLOWS].forEach((n) => {
  check(!idsSeen.has(n.id), `duplicate node id "${n.id}" — ids must be unique across the whole graph`);
  idsSeen.add(n.id);
});

SYSTEMS.forEach((s) => {
  check(HOSTING_TYPES.includes(s.hostingType), `system ${s.id}: hostingType "${s.hostingType}" is not one of ${HOSTING_TYPES.join(", ")}`);
  check(Object.hasOwn(INHERITED_DOMAINS, s.hostingType), `system ${s.id}: no inherited-domain list for hosting type "${s.hostingType}"`);
  (INHERITED_DOMAINS[s.hostingType] || []).forEach((d) =>
    check(DOMAINS.includes(d), `system ${s.id}: inherited domain "${d}" is not an SCF domain`)
  );
  s.remediation.forEach((r) => {
    check(!r.controlId || Object.hasOwn(KEY_CONTROL_BY_ID, r.controlId), `system ${s.id} remediation "${r.jira}": controlId "${r.controlId}" is not a key control`);
    check(!r.assetId || Object.hasOwn(ASSET_BY_ID, r.assetId), `system ${s.id} remediation "${r.jira}": assetId "${r.assetId}" is not an asset`);
  });
});

ASSETS.forEach((a) => {
  check(Object.hasOwn(SYSTEM_BY_ID, a.systemId), `asset ${a.id}: systemId "${a.systemId}" is not a system`);
  check(ASSET_KINDS.includes(a.kind), `asset ${a.id}: kind "${a.kind}" is not one of ASSET_KINDS — an unknown kind matches no applicability rule, which would silently exempt this asset from every control`);
  check(dataTypesForAsset(a.id).length > 0, `asset ${a.id}: has no data-type edges, so its classification cannot be derived`);
});

DATA_TYPES.forEach((d) => {
  check(CLASSIFICATION_TIERS.includes(d.sensitivity), `data type ${d.id}: sensitivity "${d.sensitivity}" is not a classification tier`);
});

KEY_CONTROLS.forEach((c) => {
  check(Object.hasOwn(CONTROL_BY_ID, c.id), `key control ${c.id}: not present in scfControls.json`);
  check(ASSURANCE_CATEGORIES.includes(c.category), `key control ${c.id}: resolves to category "${c.category}", which is not an assurance category`);
  check(c.frameworks.length > 0, `key control ${c.id}: has no framework clauses, so it is out of scope for every standard ACME certifies against and cannot be a key control`);
  check(["asset", "program"].includes(c.scope), `key control ${c.id}: scope "${c.scope}" must be "asset" or "program"`);
});

EVIDENCE.forEach((e) => {
  check(Object.hasOwn(CONTROL_BY_ID, e.controlId), `evidence ${e.id}: controlId "${e.controlId}" is not a real control`);
  check(Object.hasOwn(KEY_CONTROL_BY_ID, e.controlId), `evidence ${e.id}: controlId "${e.controlId}" is not a key control — only key controls carry per-implementation evidence`);
  check(EVIDENCE_TYPES.includes(e.evidenceType), `evidence ${e.id}: evidenceType "${e.evidenceType}" is not a known evidence type`);
  check(EVIDENCE_RESULTS.includes(e.result), `evidence ${e.id}: result "${e.result}" must be one of ${EVIDENCE_RESULTS.join(", ")}`);
  check(INDEPENDENCE_LEVELS.includes(e.independence), `evidence ${e.id}: independence "${e.independence}" is not a known level`);
  check(e.coveragePct >= 0 && e.coveragePct <= 100, `evidence ${e.id}: coveragePct ${e.coveragePct} is outside 0-100`);
  check(Number.isFinite(e.validForDays) && e.validForDays > 0, `evidence ${e.id}: validForDays must be a positive number`);
  check(!Number.isNaN(new Date(e.collectedAt).getTime()), `evidence ${e.id}: collectedAt "${e.collectedAt}" is not a parseable date`);
  e.assetIds.forEach((id) => check(Object.hasOwn(ASSET_BY_ID, id), `evidence ${e.id}: assetId "${id}" is not an asset`));
  const keyControl = KEY_CONTROL_BY_ID[e.controlId];
  if (keyControl?.scope === "program") {
    check(e.assetIds.length === 0, `evidence ${e.id}: ${e.controlId} is program-scoped, so this record must not name assets`);
  } else if (keyControl) {
    check(e.assetIds.length > 0, `evidence ${e.id}: ${e.controlId} is asset-scoped, so this record must name the assets it was collected across`);
  }
});

RISKS.forEach((r) => {
  check(SEVERITY_LEVELS.includes(r.inherent.severity), `risk ${r.id}: inherent severity "${r.inherent.severity}" is not a severity level`);
  check(SEVERITY_LEVELS.includes(r.residual.severity), `risk ${r.id}: residual severity "${r.residual.severity}" is not a severity level`);
  check(LIKELIHOOD_LEVELS.includes(r.inherent.likelihood), `risk ${r.id}: inherent likelihood "${r.inherent.likelihood}" is not a likelihood level`);
  check(LIKELIHOOD_LEVELS.includes(r.residual.likelihood), `risk ${r.id}: residual likelihood "${r.residual.likelihood}" is not a likelihood level`);
});

BOARD_MATERIAL_RISK_IDS.forEach((id) =>
  check(Object.hasOwn(RISK_BY_ID, id), `BOARD_MATERIAL_RISK_IDS references "${id}", which is not in RISKS`)
);

// ---- Edges --------------------------------------------------------------------
ASSET_DATA_TYPES.forEach((e, i) => {
  check(Object.hasOwn(ASSET_BY_ID, e.assetId), `assetDataTypes[${i}]: assetId "${e.assetId}" is not an asset`);
  check(Object.hasOwn(DATA_TYPE_BY_ID, e.dataTypeId), `assetDataTypes[${i}]: dataTypeId "${e.dataTypeId}" is not a data type`);
  check(Object.hasOwn(DATA_ROLE_META, e.role), `assetDataTypes[${i}]: role "${e.role}" is not a known data role`);
});

DATA_FLOWS.forEach((f) => {
  check(Object.hasOwn(ASSET_BY_ID, f.from), `data flow ${f.id}: from "${f.from}" is not an asset`);
  check(Object.hasOwn(ASSET_BY_ID, f.to), `data flow ${f.id}: to "${f.to}" is not an asset`);
  check(f.from !== f.to, `data flow ${f.id}: connects an asset to itself`);
  check(Object.values(FLOW_KINDS).includes(f.kind), `data flow ${f.id}: kind "${f.kind}" is not a known flow kind`);
  check(f.dataTypeIds.length > 0, `data flow ${f.id}: carries no data types — an edge with nothing on it is not a relationship`);
  f.dataTypeIds.forEach((id) => check(Object.hasOwn(DATA_TYPE_BY_ID, id), `data flow ${f.id}: dataTypeId "${id}" is not a data type`));

  const from = ASSET_BY_ID[f.from];
  const to = ASSET_BY_ID[f.to];
  if (from && to) {
    check(from.systemId === to.systemId, `data flow ${f.id}: crosses from ${from.systemId} to ${to.systemId} — cross-system flows change what each boundary is responsible for and need to be modelled deliberately, not appear by accident`);
  }
});

CATEGORY_ASSESSMENTS.forEach((a) => {
  check(Object.hasOwn(ASSET_BY_ID, a.assetId), `category assessment: assetId "${a.assetId}" is not an asset`);
  check(ASSURANCE_CATEGORIES.includes(a.category), `category assessment ${a.assetId}: category "${a.category}" is not an assurance category`);
  check(MATURITY_STAGES.includes(a.maturityStage), `category assessment ${a.assetId}/${a.category}: maturityStage "${a.maturityStage}" is not a maturity stage`);
  check(EVIDENCE_TYPES.includes(a.evidenceType), `category assessment ${a.assetId}/${a.category}: evidenceType "${a.evidenceType}" is not an evidence type`);
  check(a.effectivenessPct >= 0 && a.effectivenessPct <= 100, `category assessment ${a.assetId}/${a.category}: effectivenessPct outside 0-100`);
});

// Every asset needs an assessment in every category, or its rollup would have a
// hole that reads as a zero.
ASSETS.forEach((a) => {
  ASSURANCE_CATEGORIES.forEach((c) => {
    check(
      CATEGORY_ASSESSMENTS.some((x) => x.assetId === a.id && x.category === c),
      `asset ${a.id}: no category assessment for "${c}" — every asset needs all six, since the assessed baseline is what non-key controls fall back to`
    );
  });
});

APPLICABILITY_RULES.forEach((r, i) => {
  check(Object.hasOwn(KEY_CONTROL_BY_ID, r.controlId), `applicability rule[${i}]: controlId "${r.controlId}" is not a key control`);
  check(KEY_CONTROL_BY_ID[r.controlId]?.scope === "asset", `applicability rule[${i}]: ${r.controlId} is program-scoped — program controls apply by definition and must not carry asset rules`);
  const { assetKinds, minClassification, hostingTypes } = r.requiredWhen;
  (assetKinds || []).forEach((k) => check(ASSET_KINDS.includes(k), `applicability rule[${i}] (${r.controlId}): assetKind "${k}" is not a known asset kind`));
  (hostingTypes || []).forEach((h) => check(HOSTING_TYPES.includes(h), `applicability rule[${i}] (${r.controlId}): hostingType "${h}" is not known`));
  check(!minClassification || CLASSIFICATION_TIERS.includes(minClassification), `applicability rule[${i}] (${r.controlId}): minClassification "${minClassification}" is not a tier`);
});

// Every asset-scoped key control needs at least one rule, or it silently
// applies nowhere.
KEY_CONTROLS.filter((c) => c.scope === "asset").forEach((c) => {
  check(
    APPLICABILITY_RULES.some((r) => r.controlId === c.id),
    `key control ${c.id} is asset-scoped but has no applicability rule, so it would apply to nothing`
  );
});

APPLICABILITY_EXCEPTIONS.forEach((e) => {
  check(Object.hasOwn(ASSET_BY_ID, e.assetId), `applicability exception: assetId "${e.assetId}" is not an asset`);
  check(Object.hasOwn(KEY_CONTROL_BY_ID, e.controlId), `applicability exception: controlId "${e.controlId}" is not a key control`);
  check(Boolean(e.reason?.trim()), `applicability exception ${e.assetId}/${e.controlId}: needs a reason — "not applicable" without one is indistinguishable from "nobody looked"`);
});

IMPLEMENTATION_OVERRIDES.forEach((o) => {
  check(Object.hasOwn(ASSET_BY_ID, o.assetId), `implementation override: assetId "${o.assetId}" is not an asset`);
  check(Object.hasOwn(KEY_CONTROL_BY_ID, o.controlId), `implementation override: controlId "${o.controlId}" is not a key control`);
  check(MATURITY_STAGES.includes(o.maturityStage), `implementation override ${o.assetId}/${o.controlId}: maturityStage "${o.maturityStage}" is not a maturity stage`);
  check(Boolean(o.note?.trim()), `implementation override ${o.assetId}/${o.controlId}: needs a note explaining why it differs from the category baseline`);
});

NOT_IMPLEMENTED.forEach((n) => {
  check(Object.hasOwn(ASSET_BY_ID, n.assetId), `not-implemented declaration: assetId "${n.assetId}" is not an asset`);
  check(Object.hasOwn(KEY_CONTROL_BY_ID, n.controlId), `not-implemented declaration: controlId "${n.controlId}" is not a key control`);
  check(Boolean(n.reason?.trim()), `not-implemented declaration ${n.assetId}/${n.controlId}: needs a reason`);
});

Object.entries(OWNERSHIP).forEach(([scope, byCategory]) => {
  check(scope === "program" || Object.hasOwn(SYSTEM_BY_ID, scope), `ownership: "${scope}" is neither a system id nor "program"`);
  ASSURANCE_CATEGORIES.forEach((c) => check(Boolean(byCategory[c]), `ownership[${scope}]: no owner for "${c}"`));
});

RISK_ASSETS.forEach((e, i) => {
  check(Object.hasOwn(RISK_BY_ID, e.riskId), `riskAssets[${i}]: riskId "${e.riskId}" is not a risk`);
  check(Object.hasOwn(ASSET_BY_ID, e.assetId), `riskAssets[${i}]: assetId "${e.assetId}" is not an asset`);
  check(Object.values(CONTRIBUTOR_ROLES).includes(e.role), `riskAssets[${i}]: role "${e.role}" is not a contributor role`);
});

RISK_CONTROLS.forEach((e, i) => {
  check(Object.hasOwn(RISK_BY_ID, e.riskId), `riskControls[${i}]: riskId "${e.riskId}" is not a risk`);
  check(Object.hasOwn(KEY_CONTROL_BY_ID, e.controlId), `riskControls[${i}]: controlId "${e.controlId}" is not a key control`);
});

// A risk with no edges has to say why. Silence here would leave a risk floating
// exactly the way linkedControl used to, just without the string.
RISKS.forEach((r) => {
  const hasAssets = RISK_ASSETS.some((e) => e.riskId === r.id);
  const hasControls = RISK_CONTROLS.some((e) => e.riskId === r.id);
  check(hasAssets || Object.hasOwn(RISKS_WITHOUT_ASSETS, r.id), `risk ${r.id}: has no contributing assets and no entry in RISKS_WITHOUT_ASSETS explaining why`);
  check(hasControls || Object.hasOwn(RISKS_WITHOUT_CONTROLS, r.id), `risk ${r.id}: has no linked controls and no entry in RISKS_WITHOUT_CONTROLS explaining why`);
});

// Explanations for edges that do exist are stale documentation pretending to be
// a gap note.
Object.keys(RISKS_WITHOUT_ASSETS).forEach((id) =>
  check(!RISK_ASSETS.some((e) => e.riskId === id), `RISKS_WITHOUT_ASSETS explains "${id}", but that risk now has asset edges — remove the stale explanation`)
);
Object.keys(RISKS_WITHOUT_CONTROLS).forEach((id) =>
  check(!RISK_CONTROLS.some((e) => e.riskId === id), `RISKS_WITHOUT_CONTROLS explains "${id}", but that risk now has control edges — remove the stale explanation`)
);

if (problems.length > 0) {
  throw new Error(
    `Graph integrity check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n  - ${problems.join("\n  - ")}`
  );
}

export const GRAPH_VALID = true;
