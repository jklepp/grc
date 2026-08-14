// Every number that describes more than one thing: category, asset, system,
// enterprise. One direction of travel, no shortcuts back the other way.
//
//   evidence -> implementation -> category -> asset -> system -> enterprise
//
// The rule this enforces is that nothing above the bottom of that chain is ever
// stored. A system used to carry its own posture, computed from six tracked
// controls and an inherited-coverage rate, entirely independently of the assets
// inside it — so a system's score and its assets' scores could disagree
// indefinitely and neither was wrong. Now a system score is a statement about
// its assets and cannot be anything else.
//
// HOW A CATEGORY BLENDS MEASURED AND ASSESSED
// --------------------------------------------
// Within one category an asset has some controls that are key-tracked and
// evidenced, and a much larger remainder covered only by the category-level
// assessment. Weighting those strictly by control count would drown the
// measured signal — four evidenced controls against sixty in-scope ones would
// move a score by almost nothing, and a failing cross-tenant test would be
// invisible three levels up. Weighting only the measured ones would overclaim,
// asserting that four controls speak for the category.
//
// So the split is even: the measured implementations collectively carry half
// the category, the assessed remainder carries the other half. That is a stated
// judgment, not a derived fact — the key controls were selected as the material
// ones for their category, which is the argument for giving them parity with
// everything they don't cover. controlBackedPct is reported separately and is
// NOT this weight, so "how much of this rests on evidence" stays an honest
// answer rather than a restatement of the formula.
import { ASSETS, ASSET_BY_ID, assetsForSystem, BOUNDARY_INGRESS_KINDS } from "../graph/nodes/assets";
import { SYSTEMS, SYSTEM_BY_ID } from "../graph/nodes/systems";
import { ASSURANCE_CATEGORIES, BASIS } from "../graph/nodes/taxonomy";
import { DATA_FLOWS, flowsTo } from "../graph/edges/dataFlows";
import { assessmentFor } from "../graph/edges/categoryAssessments";
import { categoryWeightsFor } from "../graph/nodes/controlProfiles";
import { requiredControlsForAsset } from "./applicability";
import { implementationsForAsset } from "./implementation";
import {
  blendAssurance, evidenceBaseConfidence, criticalityScore, criticalityBand, assuranceBand,
  impactFromCriticality, residualLikelihood, riskScore, riskBand, mean, weightedMean, display,
} from "./assurance";
import { assetClassification, assetClassificationDetail, systemClassification } from "./classification";

// The assessed remainder carries the same total weight as the measured set.
const RESIDUAL_WEIGHT_RATIO = 1;

function baselineScore(assessment) {
  return blendAssurance({
    maturityStage: assessment.maturityStage,
    evidenceConfidence: evidenceBaseConfidence(assessment.evidenceType),
    effectivenessPct: assessment.effectivenessPct,
  });
}

export function categoryRollup(assetId, category) {
  const assessment = assessmentFor(assetId, category);
  const baseline = baselineScore(assessment);
  const implementations = implementationsForAsset(assetId).filter((i) => i.category === category);

  if (implementations.length === 0) {
    return {
      assetId, category, score: display(baseline), raw: baseline, basis: BASIS.ASSESSED,
      implementations: [], baseline: display(baseline), rawBaseline: baseline, assessment,
      measuredCount: 0, requiredCount: 0, evidencedCount: 0,
    };
  }

  const residualWeight = implementations.length * RESIDUAL_WEIGHT_RATIO;
  const raw = weightedMean([
    ...implementations.map((i) => ({ value: i.rawScore, weight: 1 })),
    { value: baseline, weight: residualWeight },
  ]);

  const evidencedCount = implementations.filter((i) => i.basis === BASIS.MEASURED).length;

  return {
    assetId, category, score: display(raw), raw, baseline: display(baseline), rawBaseline: baseline, assessment, implementations,
    // A category is "measured" only if something in it actually is. All-assessed
    // implementations in a category leave it assessed, which is the truth.
    basis: evidencedCount > 0 ? BASIS.MEASURED : BASIS.ASSESSED,
    measuredCount: evidencedCount,
    requiredCount: implementations.length,
    evidencedCount,
  };
}

export function assetRollup(assetId) {
  const asset = ASSET_BY_ID[assetId];
  const system = SYSTEM_BY_ID[asset.systemId];

  const factors = {};
  Object.keys(asset.criticalityFactors).forEach((k) => (factors[k] = asset.criticalityFactors[k].score));
  const criticality = criticalityScore(factors);

  const categories = {};
  ASSURANCE_CATEGORIES.forEach((c) => (categories[c] = categoryRollup(assetId, c)));
  const categoryScores = Object.fromEntries(ASSURANCE_CATEGORIES.map((c) => [c, categories[c].score]));

  // Weighted by the asset's own classification tier, from the required control
  // profile (graph/nodes/controlProfiles.js).
  //
  // This was a flat mean, on the argument that no category is inherently more
  // important and asset-specific weighting belongs in the control profile. The
  // argument was right; it just hadn't been carried out — the profile set a
  // floor per category and had no say in how much each counted. A flat mean let
  // one-sixth weighting absorb a thirty-point Identity & Access shortfall on
  // the asset whose entire risk is confidentiality.
  //
  // Computed from the categories' unrounded values so a control's movement
  // isn't lost at this hop.
  const tier = assetClassification(assetId);
  const weights = categoryWeightsFor(tier);
  const rawAssurance = weightedMean(ASSURANCE_CATEGORIES.map((c) => ({ value: categories[c].raw, weight: weights[c] })));
  const assurance = display(rawAssurance);

  const implementations = implementationsForAsset(assetId);
  const required = requiredControlsForAsset(assetId);
  const evidenced = implementations.filter((i) => i.basis === BASIS.MEASURED && i.status !== "not-implemented");

  // Deliberately NOT the category weighting above. This answers "how much of
  // what we track here is actually backed by evidence," which is a coverage
  // question, not a scoring one.
  const controlBackedPct = required.length === 0 ? 0 : Math.round((evidenced.length / required.length) * 100);

  const evidenceConfidence = display(mean(implementations.filter((i) => i.evidenceConfidence != null).map((i) => i.evidenceConfidence)));

  const impact = impactFromCriticality(criticality);
  const residualLikely = residualLikelihood(asset.inherentLikelihood, rawAssurance);
  const inherentScore = riskScore(asset.inherentLikelihood, impact);
  const residualScore = riskScore(residualLikely, impact);

  return {
    ...asset,
    system,
    classification: assetClassification(assetId),
    classificationDetail: assetClassificationDetail(assetId),
    criticality,
    criticalityBand: criticalityBand(criticality),
    categories,
    categoryScores,
    categoryWeights: weights,
    overallAssurance: assurance,
    rawAssurance,
    assuranceBand: assuranceBand(assurance),
    evidenceConfidence,
    evidenceConfidenceBand: assuranceBand(evidenceConfidence),
    controlBackedPct,
    implementations,
    requiredControlCount: required.length,
    evidencedControlCount: evidenced.length,
    deficientControls: implementations.filter((i) => i.status === "deficient" || i.status === "not-implemented"),
    impact,
    inherentRisk: { likelihood: asset.inherentLikelihood, impact, score: inherentScore, band: riskBand(inherentScore) },
    residualRisk: { likelihood: residualLikely, impact, score: residualScore, band: riskBand(residualScore) },
  };
}

// Built once at module load. Every consumer reads these rather than recomputing,
// so there is exactly one value for any asset's assurance anywhere in the app.
export const ASSET_ROLLUPS = ASSETS.map((a) => assetRollup(a.id));
export const ASSET_ROLLUP_BY_ID = Object.fromEntries(ASSET_ROLLUPS.map((a) => [a.id, a]));

export function systemRollup(systemId) {
  const system = SYSTEM_BY_ID[systemId];
  const assets = assetsForSystem(systemId).map((a) => ASSET_ROLLUP_BY_ID[a.id]);

  // Criticality-weighted, so the root encryption key counts for more than the
  // audit log export. A flat mean would let a healthy peripheral asset offset a
  // weak critical one, which is exactly the reading a system score must not
  // support.
  const rawAssurance = weightedMean(assets.map((a) => ({ value: a.rawAssurance, weight: a.criticality })));
  const assurance = display(rawAssurance);
  const criticality = display(weightedMean(assets.map((a) => ({ value: a.criticality, weight: 1 }))));

  const totalRequired = assets.reduce((a, x) => a + x.requiredControlCount, 0);
  const totalEvidenced = assets.reduce((a, x) => a + x.evidencedControlCount, 0);

  const categories = {};
  ASSURANCE_CATEGORIES.forEach((c) => {
    categories[c] = display(weightedMean(assets.map((a) => ({ value: a.categories[c].raw, weight: a.criticality }))));
  });

  return {
    ...system,
    classification: systemClassification(systemId),
    assets,
    assetCount: assets.length,
    overallAssurance: assurance,
    rawAssurance,
    assuranceBand: assuranceBand(assurance),
    criticality,
    criticalityBand: criticalityBand(criticality),
    categoryScores: categories,
    controlBackedPct: totalRequired === 0 ? 0 : Math.round((totalEvidenced / totalRequired) * 100),
    requiredControlCount: totalRequired,
    evidencedControlCount: totalEvidenced,
    evidenceConfidence: display(mean(assets.map((a) => a.evidenceConfidence).filter((v) => v != null))),
    residualScore: Math.round((assets.reduce((a, x) => a + x.residualRisk.score, 0) / assets.length) * 10) / 10,
    staleEvidenceCount: assets.reduce((a, x) => a + x.implementations.filter((i) => i.evidence.some((e) => e.stale)).length, 0),
    weakestAsset: assets.reduce((worst, a) => (a.overallAssurance < worst.overallAssurance ? a : worst), assets[0]),
    deficientControls: assets.flatMap((a) => a.deficientControls),
  };
}

export const SYSTEM_ROLLUPS = SYSTEMS.map((s) => systemRollup(s.id));
export const SYSTEM_ROLLUP_BY_ID = Object.fromEntries(SYSTEM_ROLLUPS.map((s) => [s.id, s]));

const ENTERPRISE_RAW = weightedMean(
  SYSTEM_ROLLUPS.map((s) => ({
    value: s.rawAssurance,
    // A system's weight is the total criticality it contains, so a boundary
    // holding eight critical assets outweighs one holding seven moderate ones
    // without anyone having to declare that separately.
    weight: s.assets.reduce((a, x) => a + x.criticality, 0),
  }))
);

export const ENTERPRISE = {
  assurance: display(ENTERPRISE_RAW),
  rawAssurance: ENTERPRISE_RAW,
  assetCount: ASSET_ROLLUPS.length,
  systemCount: SYSTEM_ROLLUPS.length,
  controlBackedPct: Math.round(
    (ASSET_ROLLUPS.reduce((a, x) => a + x.evidencedControlCount, 0) / ASSET_ROLLUPS.reduce((a, x) => a + x.requiredControlCount, 0)) * 100
  ),
  assetsBelowTarget: ASSET_ROLLUPS.filter((a) => a.overallAssurance < 90).length,
};
ENTERPRISE.assuranceBand = assuranceBand(ENTERPRISE.assurance);

// Each category's assurance averaged across every asset — the figures the
// Executive Dashboard shows. Centralized so any consumer citing "the real
// assurance % for category X" computes it the same way.
export const CATEGORY_PORTFOLIO_AVERAGES = ASSURANCE_CATEGORIES.map((label) => ({
  label,
  pct: display(mean(ASSET_ROLLUPS.map((a) => a.categories[label].raw))),
  raw: mean(ASSET_ROLLUPS.map((a) => a.categories[label].raw)),
}));

// ---- Data map layout, derived from the flow graph -------------------------------
// Stage membership used to be stored: a per-system dictionary naming which
// assets sat in "Ingress", "Primary Custody", and so on, which meant adding a
// flow also meant remembering to re-slot the asset or the picture quietly went
// wrong. Here depth is computed by walking inbound data edges, so the layout is
// a consequence of the flows rather than a parallel description of them.
export function flowLayoutForSystem(systemId) {
  const assets = assetsForSystem(systemId);
  const ids = new Set(assets.map((a) => a.id));
  const dataEdges = DATA_FLOWS.filter((f) => f.kind === "data" && ids.has(f.from) && ids.has(f.to));

  // Control-plane-only assets (a key store, a service account) aren't in the
  // request path at all. They hang off the assets they protect rather than
  // occupying a stage of their own — the same shape the old map drew with a
  // cosmetic `branch` flag, now meaning something.
  const inRequestPath = new Set();
  dataEdges.forEach((f) => { inRequestPath.add(f.from); inRequestPath.add(f.to); });

  // A real request path cycles — the model service answers back to the gateway
  // it was called from — so there is no node with zero inbound edges to start
  // from, and "longest path from a source" would ratchet forever around the
  // loop. Entry is therefore identified by asset KIND (the thing that sits
  // where traffic crosses into the boundary), which is a modelled fact, and
  // depth is the shortest hop count from there. Breadth-first traversal visits
  // each node once, so the cycle settles on its own.
  const entries = assets.filter((a) => BOUNDARY_INGRESS_KINDS.includes(a.kind) && inRequestPath.has(a.id));
  // No ingress-kind asset (a boundary that only stores, say) falls back to
  // whatever nothing else feeds, and failing that to the least-fed node.
  const inDegree = {};
  assets.forEach((a) => (inDegree[a.id] = dataEdges.filter((f) => f.to === a.id).length));
  const pathAssets = assets.filter((a) => inRequestPath.has(a.id));
  const sources = entries.length
    ? entries
    : pathAssets.filter((a) => inDegree[a.id] === 0).length
      ? pathAssets.filter((a) => inDegree[a.id] === 0)
      : pathAssets.slice().sort((a, b) => inDegree[a.id] - inDegree[b.id]).slice(0, 1);

  const depth = {};
  assets.forEach((a) => (depth[a.id] = null));

  let frontier = sources.map((a) => a.id);
  frontier.forEach((id) => (depth[id] = 0));
  let level = 0;
  while (frontier.length > 0) {
    level += 1;
    const next = [];
    frontier.forEach((id) => {
      dataEdges
        .filter((f) => f.from === id)
        .forEach((f) => {
          if (depth[f.to] === null) {
            depth[f.to] = level;
            next.push(f.to);
          }
        });
    });
    frontier = next;
  }

  // Anything in the request path the traversal never reached still belongs on
  // the chart — placed after the last hop rather than dropped.
  const reachedMax = Math.max(0, ...Object.values(depth).filter((d) => d !== null));
  pathAssets.forEach((a) => {
    if (depth[a.id] === null) depth[a.id] = reachedMax + 1;
  });

  const maxDepth = Math.max(0, ...Object.values(depth).filter((d) => d !== null));
  const stages = [];
  for (let d = 0; d <= maxDepth; d++) {
    const nodes = assets.filter((a) => depth[a.id] === d).map((a) => ASSET_ROLLUP_BY_ID[a.id]);
    if (nodes.length) stages.push({ depth: d, nodes });
  }

  const branches = assets
    .filter((a) => depth[a.id] === null)
    .map((a) => ({
      asset: ASSET_ROLLUP_BY_ID[a.id],
      protects: DATA_FLOWS.filter((f) => f.from === a.id && f.kind === "control-plane").map((f) => ASSET_ROLLUP_BY_ID[f.to]),
    }));

  return { systemId, stages, branches, edges: dataEdges, controlPlaneEdges: DATA_FLOWS.filter((f) => f.kind === "control-plane" && ids.has(f.from)) };
}

export function inboundFlowCount(assetId) {
  return flowsTo(assetId).length;
}

export const TOTAL_FLOW_COUNT = DATA_FLOWS.length;
