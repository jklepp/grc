// Risk scoring, and the part that finally connects: a risk's control assurance
// now comes from the assets and controls that actually carry it.
//
// The old assuranceForRisk() mapped a risk's free-text linkedControl to one of
// six assurance categories through a hand-typed table, then read that
// category's average across all fifteen assets. Every risk in a category
// reported the same number, and none of them could move when the thing the risk
// was about moved. RISK-001 is a defect in retrieval scoping; it reported an
// Identity & Access average that included the payroll connector.
import { RISKS, RISK_BY_ID, SEVERITY_LEVELS, LIKELIHOOD_LEVELS, BOARD_MATERIAL_RISK_IDS } from "../graph/nodes/risks";
import { KEY_CONTROL_BY_ID } from "../graph/nodes/keyControls";
import { assetsForRisk, controlsForRisk, RISKS_WITHOUT_ASSETS, RISKS_WITHOUT_CONTROLS } from "../graph/edges/riskContributors";
import { BASIS } from "../graph/nodes/taxonomy";
import { ASSET_ROLLUP_BY_ID } from "./rollups";
import { buildImplementation, programImplementation } from "./implementation";
import { assetsRequiringControl } from "./applicability";
import { weightedMean, mean, assuranceBand, display, ASSURANCE_TARGET } from "./assurance";

// A tier's weight is its position in the ordering, so the label list and the
// numeric scale cannot disagree — the previous pair of hand-typed lookup
// objects could, and nothing checked them.
export const SEVERITY_VALUE = Object.fromEntries(SEVERITY_LEVELS.map((l, i) => [l, i + 1]));
export const LIKELIHOOD_VALUE = Object.fromEntries(LIKELIHOOD_LEVELS.map((l, i) => [l, i + 1]));

export function score(severity, likelihood) {
  return SEVERITY_VALUE[severity] * LIKELIHOOD_VALUE[likelihood];
}

// A primary contributor carries the scenario; a contributing one participates
// in it. Averaging them as equals would let four healthy participants wash out
// the one asset the risk is actually about, which is the failure mode the
// portfolio average had.
const ROLE_WEIGHT = { primary: 3, contributing: 1 };

// The controls holding a risk down, resolved to their real implementations on
// the assets that carry it. This is the chain that makes "why did this move"
// answerable: risk -> control -> implementation -> evidence.
export function controlPostureForRisk(riskId) {
  const contributingAssetIds = assetsForRisk(riskId).map((e) => e.assetId);
  return controlsForRisk(riskId).map((edge) => {
    const control = KEY_CONTROL_BY_ID[edge.controlId];
    if (control.scope === "program") {
      const impl = programImplementation(edge.controlId);
      return { control, scope: "program", implementations: [impl], score: impl.score, rawScore: impl.rawScore, weakest: impl };
    }
    const implementations = assetsRequiringControl(edge.controlId)
      .filter((a) => contributingAssetIds.includes(a.id))
      .map((a) => buildImplementation(a.id, edge.controlId));
    const weakest = implementations.length
      ? implementations.reduce((w, i) => (i.score < w.score ? i : w))
      : null;
    return {
      control,
      scope: "asset",
      implementations,
      // The weakest implementation, not the mean. A control holds a risk down
      // only as well as its worst instance: a cross-tenant defect on one
      // component exposes the tenancy no matter how well isolation works on the
      // other five, and averaging would let those five hide it.
      score: weakest ? weakest.score : null,
      rawScore: weakest ? weakest.rawScore : null,
      meanScore: display(implementations.length ? mean(implementations.map((i) => i.rawScore)) : null),
      weakest,
    };
  });
}

export function assuranceForRisk(riskId) {
  const assetEdges = assetsForRisk(riskId);
  const controlPosture = controlPostureForRisk(riskId);

  const assetEntries = assetEdges
    .map((e) => ({ edge: e, rollup: ASSET_ROLLUP_BY_ID[e.assetId] }))
    .filter((x) => x.rollup)
    .map((x) => ({ value: x.rollup.rawAssurance, weight: ROLE_WEIGHT[x.edge.role], asset: x.rollup, role: x.edge.role, note: x.edge.note }));

  const controlScores = controlPosture.filter((c) => c.rawScore != null);

  // Controls lead where they exist: they're the specific thing holding this
  // scenario down. Asset assurance is the broader context around them.
  const controlPct = controlScores.length ? mean(controlScores.map((c) => c.rawScore)) : null;
  const assetPct = assetEntries.length ? weightedMean(assetEntries) : null;

  const raw =
    controlPct != null && assetPct != null
      ? controlPct * 0.6 + assetPct * 0.4
      : (controlPct ?? assetPct);
  const pct = display(raw);

  const measured = controlPosture.some((c) => c.implementations.some((i) => i?.basis === BASIS.MEASURED));

  return {
    pct,
    band: assuranceBand(pct),
    target: ASSURANCE_TARGET,
    basis: pct == null ? BASIS.UNASSESSED : measured ? BASIS.MEASURED : BASIS.ASSESSED,
    assets: assetEntries,
    controls: controlPosture,
    weakestControl: controlScores.length ? controlScores.reduce((w, c) => (c.score < w.score ? c : w)) : null,
    noAssetsReason: assetEntries.length === 0 ? (RISKS_WITHOUT_ASSETS[riskId] ?? null) : null,
    noControlsReason: controlPosture.length === 0 ? (RISKS_WITHOUT_CONTROLS[riskId] ?? null) : null,
  };
}

// ---- Board-level derivations -----------------------------------------------------
// Annualized probability band per residual likelihood tier. A fixed, documented
// judgment, the same pattern as the maturity and evidence scales.
const LIKELIHOOD_ANNUAL_PROBABILITY = {
  Rare: [1, 5],
  Unlikely: [5, 15],
  Possible: [15, 35],
  Likely: [35, 65],
  "Almost Certain": [65, 90],
};

export function annualProbabilityRange(likelihood) {
  return LIKELIHOOD_ANNUAL_PROBABILITY[likelihood];
}

// Loss magnitude solved from the risk's own exposure (treated app-wide as the
// residual annualized loss expectancy) rather than a separately invented dollar
// figure: ALE = probability x magnitude, so magnitude = ALE / probability. The
// low end of the probability band implies the high end of the magnitude band.
export function lossMagnitudeRange(exposure, likelihood) {
  const [low, high] = annualProbabilityRange(likelihood);
  return [exposure / (high / 100), exposure / (low / 100)];
}

export function appetiteRatio(risk) {
  return Math.round((score(risk.residual.severity, risk.residual.likelihood) / risk.appetite) * 10) / 10;
}

// Improving / Stalled / Flat from fields the risk already carries.
// treatmentAtRisk outranks milestone status: a risk can have an in-progress
// milestone and still be flagged as slipping.
export function riskTrend(risk) {
  if (risk.treatmentAtRisk) return { label: "Stalled", color: "red" };
  if (risk.milestones.some((m) => m.status === "done" || m.status === "in_progress")) return { label: "Improving", color: "green" };
  return { label: "Flat", color: "muted" };
}

export function riskRollup(riskId) {
  const risk = RISK_BY_ID[riskId];
  return {
    ...risk,
    inherentScore: score(risk.inherent.severity, risk.inherent.likelihood),
    residualScore: score(risk.residual.severity, risk.residual.likelihood),
    appetiteRatio: appetiteRatio(risk),
    trend: riskTrend(risk),
    assurance: assuranceForRisk(riskId),
    contributingAssets: assetsForRisk(riskId).map((e) => ({ ...e, asset: ASSET_ROLLUP_BY_ID[e.assetId] })),
    linkedControls: controlsForRisk(riskId).map((e) => KEY_CONTROL_BY_ID[e.controlId]),
  };
}

export const RISK_ROLLUPS = RISKS.map((r) => riskRollup(r.id));
export const RISK_ROLLUP_BY_ID = Object.fromEntries(RISK_ROLLUPS.map((r) => [r.id, r]));

export const ABOVE_APPETITE_COUNT = RISK_ROLLUPS.filter((r) => r.residualScore > r.appetite).length;
export const QUANTIFIED_EXPOSURE = RISKS.reduce((a, r) => a + r.exposure, 0);

// A risk clears the bar for board attention on two conditions, not one:
// residual severity at the top tier AND a residual score still exceeding the
// org's own appetite for it.
export function isMaterial(risk) {
  return risk.residual.severity === "Severe" && score(risk.residual.severity, risk.residual.likelihood) > risk.appetite;
}

export const MATERIAL_RISKS = BOARD_MATERIAL_RISK_IDS.map((id) => {
  const rollup = RISK_ROLLUP_BY_ID[id];
  if (!rollup) throw new Error(`risk.js: BOARD_MATERIAL_RISK_IDS references "${id}", which isn't in RISKS`);
  if (!isMaterial(rollup)) {
    throw new Error(`risk.js: BOARD_MATERIAL_RISK_IDS includes "${id}", but it no longer clears isMaterial() (residual Severe and above appetite) — re-check its rating or drop it from the board list`);
  }
  return {
    ...rollup,
    boardLabel: rollup.materialLabel || rollup.scenario,
    probability: annualProbabilityRange(rollup.residual.likelihood),
    lossMagnitude: lossMagnitudeRange(rollup.exposure, rollup.residual.likelihood),
  };
}).sort((a, b) => b.residualScore - a.residualScore || b.exposure - a.exposure);

export const MATERIAL_RISK_EXPOSURE = MATERIAL_RISKS.reduce((a, r) => a + r.exposure, 0);

// Every risk one asset contributes to — the reverse lookup the Asset Register
// can use to show what a weak asset is actually putting at stake.
export function risksForAssetRollup(assetId) {
  return RISK_ROLLUPS.filter((r) => r.contributingAssets.some((c) => c.assetId === assetId));
}
