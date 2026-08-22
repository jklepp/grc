// Risk scoring, and the part that finally connects: a risk's control assurance
// now comes from the assets and controls that actually carry it.
//
// The old assuranceForRisk() mapped a risk's free-text linkedControl to one of
// six assurance categories through a hand-typed table, then read that
// category's average across all fifteen assets. Every risk in a category
// reported the same number, and none of them could move when the thing the risk
// was about moved. RISK-001 is a defect in retrieval scoping; it reported an
// Identity & Access average that included the payroll connector.
import type { Graph } from "../graph/types";
import {
  SEVERITY_LEVELS, LIKELIHOOD_LEVELS,
  type SeverityLevel, type LikelihoodLevel, type Risk,
} from "../graph/nodes/risks";
import { BASIS } from "../graph/nodes/taxonomy";
import type { RollupsApi } from "./rollups";
import type { AssessmentApi, ControlAssessment } from "./assessment";
import { mean, assuranceBand, display, ASSURANCE_TARGET } from "./assurance";
import type { RiskId, AssetId, SystemId } from "../graph/ids";

// A tier's weight is its position in the ordering, so the label list and the
// numeric scale cannot disagree — the previous pair of hand-typed lookup
// objects could, and nothing checked them.
export const SEVERITY_VALUE: Record<SeverityLevel, number> = Object.fromEntries(
  SEVERITY_LEVELS.map((l, i) => [l, i + 1])
) as Record<SeverityLevel, number>;
export const LIKELIHOOD_VALUE: Record<LikelihoodLevel, number> = Object.fromEntries(
  LIKELIHOOD_LEVELS.map((l, i) => [l, i + 1])
) as Record<LikelihoodLevel, number>;

export function score(severity: SeverityLevel, likelihood: LikelihoodLevel): number {
  return SEVERITY_VALUE[severity] * LIKELIHOOD_VALUE[likelihood];
}

// A primary contributor carries the scenario; a contributing one participates
// in it. Averaging them as equals would let four healthy participants wash out
// the one asset the risk is actually about, which is the failure mode the
// enterprise-wide average had.
const ROLE_WEIGHT: Record<string, number> = { primary: 3, contributing: 1 };

// ---- Board-level derivations -------------------------------------------------
// Annualized probability band per residual likelihood tier. A fixed, documented
// judgment, the same pattern as the maturity and evidence scales.
const LIKELIHOOD_ANNUAL_PROBABILITY: Record<LikelihoodLevel, [number, number]> = {
  Rare: [1, 5],
  Unlikely: [5, 15],
  Possible: [15, 35],
  Likely: [35, 65],
  "Almost Certain": [65, 90],
};

export function annualProbabilityRange(likelihood: LikelihoodLevel): [number, number] {
  return LIKELIHOOD_ANNUAL_PROBABILITY[likelihood];
}

// Loss magnitude solved from the risk's own exposure (treated app-wide as the
// residual annualized loss expectancy) rather than a separately invented dollar
// figure: ALE = probability x magnitude, so magnitude = ALE / probability. The
// low end of the probability band implies the high end of the magnitude band.
export function lossMagnitudeRange(exposure: number, likelihood: LikelihoodLevel): [number, number] {
  const [low, high] = annualProbabilityRange(likelihood);
  return [exposure / (high / 100), exposure / (low / 100)];
}

export function appetiteRatio(risk: Risk): number {
  return Math.round((score(risk.residual.severity, risk.residual.likelihood) / risk.appetite) * 10) / 10;
}

// Improving / Stalled / Flat from fields the risk already carries.
// treatmentAtRisk outranks milestone status: a risk can have an in-progress
// milestone and still be flagged as slipping.
export function riskTrend(risk: Risk): { label: string; color: string } {
  if (risk.treatmentAtRisk) return { label: "Stalled", color: "red" };
  if (risk.milestones.some((m) => m.status === "done" || m.status === "in_progress")) {
    return { label: "Improving", color: "green" };
  }
  return { label: "Flat", color: "muted" };
}

// A risk clears the bar for board attention on two conditions, not one:
// residual severity at the top tier AND a residual score still exceeding the
// org's own appetite for it.
export function isMaterial(risk: { residual: Risk["residual"]; appetite: number }): boolean {
  return risk.residual.severity === "Severe" && score(risk.residual.severity, risk.residual.likelihood) > risk.appetite;
}

export function createRisk(
  graph: Graph,
  rollups: RollupsApi,
  assessment: AssessmentApi
) {
  // The controls holding a risk down, resolved to how each was actually
  // assessed on the systems that carry the risk. The chain that makes "why did
  // this move" answerable: risk -> control -> level rating -> evidence.
  function controlPostureForRisk(riskId: RiskId) {
    const contributingAssetIds = new Set((graph.assetsByRisk[riskId] ?? []).map((e) => e.assetId));
    // The boundaries this risk actually touches. A control's posture on a system
    // that holds none of the risk's assets says nothing about this scenario.
    const systemIds = [
      ...new Set(
        graph.assets.filter((a) => contributingAssetIds.has(a.id)).flatMap((a) => a.systemIds)
      ),
    ];
    const scope = systemIds.length > 0 ? systemIds : graph.systems.map((s) => s.id);

    return (graph.controlsByRisk[riskId] ?? []).map((edge) => {
      const control = graph.keyControlById[edge.controlId];
      const assessments = scope
        .map((systemId) => assessment.assessmentFor(systemId, edge.controlId))
        .filter((a): a is ControlAssessment => a !== null && a.assessed);

      // The weakest assessment, not the mean. A control holds a risk down only
      // as well as its worst boundary: a cross-tenant defect in one system
      // exposes the tenancy no matter how well isolation works in the other,
      // and averaging would let the healthy one hide it.
      const weakest = assessments.length
        ? assessments.reduce((w, a) => ((a.rawScore as number) < (w.rawScore as number) ? a : w))
        : null;

      return {
        control,
        scope: control.scope,
        assessments,
        score: weakest ? weakest.score : null,
        rawScore: weakest ? weakest.rawScore : null,
        meanScore: display(assessments.length ? mean(assessments.map((a) => a.rawScore as number)) : null),
        weakest,
        // The instances behind the weakest boundary — which asset actually
        // dragged it, for the pages that want to name one.
        weakestInstances: weakest ? weakest.instances.filter((i) => contributingAssetIds.has(i.assetId)) : [],
      };
    });
  }

  function assuranceForRisk(riskId: RiskId) {
    const assetEdges = graph.assetsByRisk[riskId] ?? [];
    const controlPosture = controlPostureForRisk(riskId);

    // Assets are still named — which components carry this risk, and in what
    // role, is a real fact worth showing. What they no longer do is carry a
    // score into the number.
    const assetEntries = assetEdges
      .map((e) => ({ edge: e, rollup: rollups.assetRollupById[e.assetId] }))
      .filter((x) => x.rollup)
      .map((x) => ({
        weight: ROLE_WEIGHT[x.edge.role],
        asset: x.rollup,
        role: x.edge.role,
        note: x.edge.note,
      }));

    const controlScores = controlPosture.filter((c) => c.rawScore != null);

    // ENTIRELY FROM THE CONTROLS NOW.
    //
    // This used to blend the mapped controls' scores 60/40 with the
    // criticality-weighted assurance of the assets carrying the risk. The asset
    // half was always the weaker argument — it answered "how healthy is the
    // neighbourhood" rather than "what is holding this specific scenario down" —
    // and it is unavailable anyway now that an asset has no score. Dropping it
    // makes the risk-to-control mapping load-bearing: the 28 edges in
    // risk-controls.yaml are the entire input, and a risk whose controls are
    // failing has nowhere to hide behind a healthy estate.
    const raw = controlScores.length ? mean(controlScores.map((c) => c.rawScore as number)) : null;
    const pct = display(raw);

    const measured = controlPosture.some((c) => c.assessments.some((a) => a.basis === BASIS.MEASURED));

    return {
      pct,
      band: assuranceBand(pct),
      target: ASSURANCE_TARGET,
      basis: pct == null ? BASIS.UNASSESSED : measured ? BASIS.MEASURED : BASIS.INHERITED,
      assets: assetEntries,
      controls: controlPosture,
      weakestControl: controlScores.length
        ? controlScores.reduce((w, c) => ((c.score as number) < (w.score as number) ? c : w))
        : null,
      noAssetsReason: assetEntries.length === 0 ? (graph.risksWithoutAssets[riskId] ?? null) : null,
      noControlsReason: controlPosture.length === 0 ? (graph.risksWithoutControls[riskId] ?? null) : null,
    };
  }

  function riskRollup(riskId: RiskId) {
    const risk = graph.riskById[riskId];
    const ownerOrg = graph.orgById[risk.ownerId];
    return {
      ...risk,
      // `owner` stays a plain display string — every page that renders a risk's
      // owner was written against that shape before ownerId existed, and none of
      // them needed the richer object to just show who's accountable. `ownerOrg`
      // carries the real node for whatever wants it later (kind, parent team).
      owner: ownerOrg?.name ?? risk.ownerId,
      ownerOrg,
      inherentScore: score(risk.inherent.severity, risk.inherent.likelihood),
      residualScore: score(risk.residual.severity, risk.residual.likelihood),
      appetiteRatio: appetiteRatio(risk),
      trend: riskTrend(risk),
      assurance: assuranceForRisk(riskId),
      contributingAssets: (graph.assetsByRisk[riskId] ?? []).map((e) => ({
        ...e,
        asset: rollups.assetRollupById[e.assetId],
      })),
      linkedControls: (graph.controlsByRisk[riskId] ?? []).map((e) => graph.keyControlById[e.controlId]),
    };
  }

  const riskRollups = graph.risks.map((r) => riskRollup(r.id));
  const riskRollupById = Object.fromEntries(riskRollups.map((r) => [r.id, r])) as Record<RiskId, (typeof riskRollups)[number]>;

  const materialRisks = graph.facts.boardMaterialRiskIds
    .map((id) => {
      const rollup = riskRollupById[id];
      if (!rollup) throw new Error(`risk.ts: boardMaterialRiskIds references "${id}", which isn't in the risk register`);
      if (!isMaterial(rollup)) {
        throw new Error(
          `risk.ts: boardMaterialRiskIds includes "${id}", but it no longer clears isMaterial() (residual Severe and above appetite) — re-check its rating or drop it from the board list`
        );
      }
      return {
        ...rollup,
        boardLabel: rollup.materialLabel || rollup.scenario,
        probability: annualProbabilityRange(rollup.residual.likelihood),
        lossMagnitude: lossMagnitudeRange(rollup.exposure, rollup.residual.likelihood),
      };
    })
    .sort((a, b) => b.residualScore - a.residualScore || b.exposure - a.exposure);

  return {
    controlPostureForRisk,
    assuranceForRisk,
    riskRollup,
    riskRollups,
    riskRollupById,
    ABOVE_APPETITE_COUNT: riskRollups.filter((r) => r.residualScore > r.appetite).length,
    QUANTIFIED_EXPOSURE: graph.risks.reduce((a, r) => a + r.exposure, 0),
    MATERIAL_RISKS: materialRisks,
    MATERIAL_RISK_EXPOSURE: materialRisks.reduce((a, r) => a + r.exposure, 0),
    // Every risk one asset contributes to — the reverse lookup the Asset
    // Register uses to show what a weak asset is actually putting at stake.
    risksForAssetRollup: (assetId: AssetId) =>
      riskRollups.filter((r) => r.contributingAssets.some((c) => c.assetId === assetId)),

    // Aggregated over a system's own assets via the same riskAssets edges —
    // the System Register's Risk section reads this rather than a
    // separately-authored per-system risk list.
    risksForSystem: (systemId: SystemId) => {
      const assetIds = new Set((graph.assetsBySystem[systemId] ?? []).map((a) => a.id));
      return riskRollups.filter((r) => r.contributingAssets.some((c) => assetIds.has(c.assetId)));
    },
    topRisksForSystem: (systemId: SystemId, limit = 5) => {
      const assetIds = new Set((graph.assetsBySystem[systemId] ?? []).map((a) => a.id));
      return riskRollups
        .filter((r) => r.contributingAssets.some((c) => assetIds.has(c.assetId)))
        .sort((a, b) => b.residualScore - a.residualScore || b.exposure - a.exposure)
        .slice(0, limit);
    },
  };
}

export type RiskApi = ReturnType<typeof createRisk>;
export type RiskRollup = RiskApi["riskRollups"][number];
