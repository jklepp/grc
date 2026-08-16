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
import type { ImplementationApi, Implementation } from "./implementation";
import type { ApplicabilityApi } from "./applicability";
import { weightedMean, mean, assuranceBand, display, ASSURANCE_TARGET } from "./assurance";
import type { RiskId, AssetId } from "../graph/ids";

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
// portfolio average had.
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
  implementation: ImplementationApi,
  applicability: ApplicabilityApi
) {
  // The controls holding a risk down, resolved to their real implementations on
  // the assets that carry it. This is the chain that makes "why did this move"
  // answerable: risk -> control -> implementation -> evidence.
  function controlPostureForRisk(riskId: RiskId) {
    const contributingAssetIds = (graph.assetsByRisk[riskId] ?? []).map((e) => e.assetId);
    return (graph.controlsByRisk[riskId] ?? []).map((edge) => {
      const control = graph.keyControlById[edge.controlId];
      if (control.scope === "program") {
        const impl = implementation.programImplementation(edge.controlId)!;
        return {
          control, scope: "program" as const, implementations: [impl],
          score: impl.score, rawScore: impl.rawScore, weakest: impl,
          meanScore: undefined as number | null | undefined,
        };
      }
      const implementations = applicability
        .assetsRequiringControl(edge.controlId)
        .filter((a) => contributingAssetIds.includes(a.id))
        .map((a) => implementation.buildImplementation(a.id, edge.controlId));
      const weakest: Implementation | null = implementations.length
        ? implementations.reduce((w, i) => ((i.score as number) < (w.score as number) ? i : w))
        : null;
      return {
        control,
        scope: "asset" as const,
        implementations,
        // The weakest implementation, not the mean. A control holds a risk down
        // only as well as its worst instance: a cross-tenant defect on one
        // component exposes the tenancy no matter how well isolation works on
        // the other five, and averaging would let those five hide it.
        score: weakest ? weakest.score : null,
        rawScore: weakest ? weakest.rawScore : null,
        meanScore: display(implementations.length ? mean(implementations.map((i) => i.rawScore as number)) : null),
        weakest,
      };
    });
  }

  function assuranceForRisk(riskId: RiskId) {
    const assetEdges = graph.assetsByRisk[riskId] ?? [];
    const controlPosture = controlPostureForRisk(riskId);

    const assetEntries = assetEdges
      .map((e) => ({ edge: e, rollup: rollups.assetRollupById[e.assetId] }))
      .filter((x) => x.rollup)
      .map((x) => ({
        value: x.rollup.rawAssurance as number,
        weight: ROLE_WEIGHT[x.edge.role],
        asset: x.rollup,
        role: x.edge.role,
        note: x.edge.note,
      }));

    const controlScores = controlPosture.filter((c) => c.rawScore != null);

    // Controls lead where they exist: they're the specific thing holding this
    // scenario down. Asset assurance is the broader context around them.
    const controlPct = controlScores.length ? mean(controlScores.map((c) => c.rawScore as number)) : null;
    const assetPct = assetEntries.length ? weightedMean(assetEntries) : null;

    const raw =
      controlPct != null && assetPct != null ? controlPct * 0.6 + assetPct * 0.4 : (controlPct ?? assetPct);
    const pct = display(raw);

    const measured = controlPosture.some((c) => c.implementations.some((i) => i?.basis === BASIS.MEASURED));

    return {
      pct,
      band: assuranceBand(pct),
      target: ASSURANCE_TARGET,
      basis: pct == null ? BASIS.UNASSESSED : measured ? BASIS.MEASURED : BASIS.ASSESSED,
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
  };
}

export type RiskApi = ReturnType<typeof createRisk>;
export type RiskRollup = RiskApi["riskRollups"][number];
