// Every number that describes more than one thing. One direction of travel,
// and nothing above the bottom of the chain is ever stored:
//
//   (system, control) assessment -> category -> system -> enterprise
//
// Assets carry no score; see assetRollup.
//
// Category weights are read off the graph, not through engine/profile.ts:
// profile.ts consumes asset rollups, so routing through it would be circular.
import type { Graph } from "../graph/types";
import {
  BACKUP_RECOVERY_KINDS, BOUNDARY_INGRESS_KINDS, BOUNDARY_EGRESS_KINDS, DATABASE_KINDS,
  SOFTWARE_DELIVERY_KINDS, WORKFORCE_INGRESS_KINDS,
} from "../graph/nodes/assets";
import {
  ASSURANCE_CATEGORIES, BASIS, PRISMA_LEVELS,
  type AssuranceCategory, type ClassificationTier, type PrismaLevel,
} from "../graph/nodes/taxonomy";
import { ACTOR_DIRECTIONS } from "../graph/edges/actorAccess";
import type { ClassificationApi } from "./classification";
import type { ApplicabilityApi } from "./applicability";
import type { AssessmentApi, ControlAssessment } from "./assessment";
import type { FindingsApi } from "./findings";
import type { ComplianceApi } from "./compliance";
import { requiresCyberAssurance } from "../graph/nodes/controlRecords";
import {
  impactLevelBand, assuranceBand,
  impactFromImpactLevel, riskScore, riskBand, mean, weightedMean, display,
  ASSURANCE_TARGET,
} from "./assurance";
import { overallImpactLevel } from "../graph/nodes/systems";
import type { AssetId, SystemId } from "../graph/ids";


// Reported beside every score, at every hop. Counts, never averaged: a 65 from
// 106 of 503 applicable controls is a different claim from a 65 from all 503.
export interface AssessmentCoverage {
  applicable: number;
  assessed: number;
  selfAssessed: number;
  inherited: number;
  unassessed: number;
  assessedPct: number;
}

function coverageOf(assessments: readonly ControlAssessment[]): AssessmentCoverage {
  const assessed = assessments.filter((a) => a.assessed);
  const inherited = assessed.filter((a) => a.inherited).length;
  return {
    applicable: assessments.length,
    assessed: assessed.length,
    selfAssessed: assessed.length - inherited,
    inherited,
    unassessed: assessments.length - assessed.length,
    assessedPct: assessments.length === 0 ? 0 : Math.round((assessed.length / assessments.length) * 100),
  };
}

export function createRollups(
  graph: Graph,
  classification: ClassificationApi,
  applicability: ApplicabilityApi,
  assessment: AssessmentApi,
  findings: FindingsApi,
  compliance: ComplianceApi
) {
  // ---- An asset, as a diagnostic ------------------------------------------------
  // An asset has no score. It carries classification and FIPS 199 impact
  // (consequence, not posture) and every control that applies to it, each the
  // same ControlInstance the Implemented level sampled, so the asset view and
  // the control view cannot disagree.
  function assetRollup(assetId: AssetId) {
    const asset = graph.assetById[assetId];
    const systems = asset.systemIds.map((sid) => graph.systemById[sid]);

    const controls = assessment.instancesForAsset(assetId);
    const required = applicability.requiredControlsForAsset(assetId);
    const counted = controls.filter((i) => i.status !== "not-applicable");
    const evidenced = controls.filter((i) => i.evidence.length > 0);

    // A coverage figure, not a score.
    const evidenceCoveragePct = required.length === 0 ? 0 : Math.round((evidenced.length / required.length) * 100);

    const impact = impactFromImpactLevel(asset.impactLevel);
    const inherentScore = riskScore(asset.inherentLikelihood, impact);

    return {
      ...asset,
      systems,
      classification: classification.assetClassification(assetId),
      classificationDetail: classification.assetClassificationDetail(assetId),
      impactLevelBand: impactLevelBand(asset.impactLevel),

      // One entry per applicable control: a status and a sentence, never a number.
      controls,
      applicableControlCount: counted.length,
      implementedCount: counted.filter((i) => i.status === "implemented").length,
      partialCount: counted.filter((i) => i.status === "partial").length,
      notImplementedCount: counted.filter((i) => i.status === "not-implemented").length,
      undeterminedCount: counted.filter((i) => i.status === "undetermined").length,
      requiredControlCount: required.length,
      evidencedControlCount: evidenced.length,
      evidenceCoveragePct,
      failingControls: counted.filter((i) => i.status === "not-implemented" || i.status === "partial"),
      findings: findings.findingsForAsset(assetId),

      // Which (system, control) assessments this asset is sampled in. The
      // reverse of the drill-down, so the Graph Explorer can walk either way.
      contributesTo: controls.map((i) => ({
        assessmentId: `ASM-${i.systemId}-${i.controlId}`,
        systemId: i.systemId,
        controlId: i.controlId,
        level: "Implemented" as const,
        credit: i.credit,
      })),

      // Intrinsic: impact does not move because controls improved.
      impact,
      inherentRisk: { likelihood: asset.inherentLikelihood, impact, score: inherentScore, band: riskBand(inherentScore) },
    };
  }

  // Built once per engine instance; consumers read these rather than recompute.
  const assetRollups = graph.assets.map((a) => assetRollup(a.id));
  const assetRollupById = Object.fromEntries(assetRollups.map((a) => [a.id, a])) as Record<AssetId, (typeof assetRollups)[number]>;

  // ---- The system's own assessment --------------------------------------------
  // One category of one system: a flat mean of the controls assessed in it.
  //
  // FLAT, and that is a decision. Every assessed control is one requirement
  // statement the engagement tested, and no authored fact says one matters more
  // than another within a category — inventing a weight here would be exactly
  // the unsourced number this model exists to avoid. HITRUST weights requirement
  // statements equally inside a domain for the same reason.
  //
  // Inherited controls join the same pool at their capped scores rather than
  // being held apart. A SaaS boundary genuinely is mostly vendor-operated, and a
  // category score that excluded the vendor's half would describe a system ACME
  // does not run.
  function categoryRollupForSystem(systemId: SystemId, category: AssuranceCategory) {
    const all = assessment.assessmentsForSystem(systemId).filter((a) => a.category === category);
    // Cyber Assurance is only scored where HITRUST is in scope. Elsewhere the
    // category carries no score at all — not a low one — and the system is
    // read by its compliance score instead.
    const scored = requiresCyberAssurance(graph.systemById[systemId]) ? all.filter((a) => a.assessed) : [];
    const raw = mean(scored.map((a) => a.rawScore as number));

    return {
      systemId, category,
      raw,
      score: display(raw),
      basis: scored.length === 0
        ? BASIS.UNASSESSED
        : scored.every((a) => a.inherited) ? BASIS.INHERITED : BASIS.MEASURED,
      coverage: coverageOf(all),
      // Per-level means, so a category can say "strong at Policy, weak at
      // Measured" instead of only carrying one number that hides which rung
      // it is failing on.
      levelAverages: Object.fromEntries(
        PRISMA_LEVELS.map((level) => [level, display(mean(scored.map((a) => a.levels[level].rating)))])
      ) as Record<PrismaLevel, number | null>,
      assessments: scored,
    };
  }

  function systemRollup(systemId: SystemId) {
    const system = graph.systemById[systemId];
    const assets = (graph.assetsBySystem[systemId] ?? []).map((a) => assetRollupById[a.id]);

    // The system is assessed (engine/assessment.ts), not averaged from its
    // assets. Categories are weighted by the system's classification tier:
    // equal weighting let a thirty-point Identity & Access shortfall vanish on a
    // system whose entire risk is confidentiality.
    const categories = {} as Record<AssuranceCategory, ReturnType<typeof categoryRollupForSystem>>;
    ASSURANCE_CATEGORIES.forEach((c) => (categories[c] = categoryRollupForSystem(systemId, c)));

    const tier = classification.systemClassification(systemId) ?? "Internal";
    const weights = graph.categoryWeights[tier as ClassificationTier] ?? graph.categoryWeights.Internal;

    // A category with nothing assessed contributes no entry rather than a zero.
    // weightedMean renormalizes over what is left, so an unexamined category
    // lowers the coverage figure instead of silently lowering the score.
    const rawAssurance = weightedMean(
      ASSURANCE_CATEGORIES
        .filter((c) => categories[c].raw !== null)
        .map((c) => ({ value: categories[c].raw as number, weight: weights[c] }))
    );
    const assurance = display(rawAssurance);
    const overallImpact = overallImpactLevel(system.securityCategory);
    const impactWeight = impactFromImpactLevel(overallImpact);

    const assessments = assessment.assessmentsForSystem(systemId);
    const scoredAssessments = assessments.filter((a) => a.assessed);
    const coverage = coverageOf(assessments);

    // Company-wide controls that apply here, kept nameable rather than folded
    // into the average. A program-scoped control is tested once for the
    // boundary instead of sampled across its assets.
    const programAssessments = scoredAssessments.filter(
      (a) => graph.keyControlById[a.controlId]?.scope === "program"
    );
    const totalRequired = assets.reduce((a, x) => a + x.requiredControlCount, 0);
    const totalEvidenced = assets.reduce((a, x) => a + x.evidencedControlCount, 0);

    const categoryScores = Object.fromEntries(
      ASSURANCE_CATEGORIES.map((c) => [c, categories[c].score])
    ) as Record<AssuranceCategory, number | null>;

    // The per-category levelAverages above, rolled up one more hop for display.
    const levelAverages = Object.fromEntries(
      PRISMA_LEVELS.map((level) => [
        level,
        display(weightedMean(
          ASSURANCE_CATEGORIES
            .filter((c) => categories[c].raw !== null)
            .map((c) => ({ value: categories[c].levelAverages[level] as number, weight: weights[c] }))
        )),
      ])
    ) as Record<PrismaLevel, number | null>;

    const complianceCoverage = compliance.SYSTEM_COVERAGE[systemId];

    return {
      ...system,
      // Whether this system is assessed on the Cyber Assurance (PRISMA) levels
      // at all. False means HITRUST is not in scope: overallAssurance is null
      // by design, and complianceScore is the system's number.
      requiresCyberAssurance: requiresCyberAssurance(system),
      complianceScore: complianceCoverage?.complianceScore ?? null,
      complianceCoverage,
      // `assignment` is the display name resolved from the stored `ownerId`.
      roles: system.roles.map((r) => ({ ...r, assignment: graph.orgById[r.ownerId]?.name ?? r.ownerId })),
      findings: findings.findingsForSystem(systemId),
      classification: classification.systemClassification(systemId),
      assets,
      assetCount: assets.length,
      programAssessments,
      programControlCount: programAssessments.length,
      overallAssurance: assurance,
      rawAssurance,
      assuranceBand: assuranceBand(assurance),
      overallImpact,
      overallImpactBand: impactLevelBand(overallImpact),
      impactWeight,
      categories,
      categoryScores,
      levelAverages,
      categoryWeights: weights,
      // Coverage travels with every score (see AssessmentCoverage).
      assessments,
      scoredAssessments,
      coverage,
      weakestControl: scoredAssessments.length === 0
        ? null
        : scoredAssessments.reduce((w, a) => ((a.rawScore as number) < (w.rawScore as number) ? a : w)),
      controlBackedPct: totalRequired === 0 ? 0 : Math.round((totalEvidenced / totalRequired) * 100),
      requiredControlCount: totalRequired,
      evidencedControlCount: totalEvidenced,
      // Counted across the assessments' sampled instances.
      staleEvidenceCount: scoredAssessments.reduce(
        (n, a) => n + a.instances.filter((i) => i.evidence.some((e) => e.stale)).length,
        0
      ),
      deficientControls: scoredAssessments.filter(
        (a) => a.levels.Implemented.rating <= 25
      ),
      // Every sampled instance that is failing or unevidenced, across the boundary.
      failingInstances: scoredAssessments.flatMap((a) =>
        a.instances.filter((i) => i.status === "not-implemented" || i.status === "partial")
      ),
    };
  }

  const systemRollups = graph.systems.map((s) => systemRollup(s.id));
  const systemRollupById = Object.fromEntries(systemRollups.map((s) => [s.id, s])) as Record<SystemId, (typeof systemRollups)[number]>;

  // Cyber Assurance across the systems that carry it — HITRUST-scoped ones.
  // A system with no score contributes no entry rather than a zero.
  const enterpriseRaw = weightedMean(
    systemRollups.filter((s) => s.rawAssurance != null).map((s) => ({
      value: s.rawAssurance as number,
      // A system's weight is its FIPS 199 overall impact, so a High
      // production boundary outweighs a Low internal one without averaging
      // the boxes inside it.
      weight: s.impactWeight,
    }))
  );

  const enterpriseAssurance = display(enterpriseRaw);
  const allAssessments = systemRollups.flatMap((s) => s.assessments);
  const allScored = systemRollups.flatMap((s) => s.scoredAssessments);

  // THE ENTERPRISE ROLLUP: every system's compliance score, weighted by its
  // FIPS 199 overall impact the same way Cyber Assurance is. Systems with
  // nothing assessed contribute no entry.
  const enterpriseComplianceRaw = weightedMean(
    systemRollups
      .filter((s) => s.complianceScore != null)
      .map((s) => ({ value: s.complianceScore as number, weight: s.impactWeight }))
  );

  const enterprise = {
    compliance: display(enterpriseComplianceRaw),
    rawCompliance: enterpriseComplianceRaw,
    cyberAssuranceSystemCount: systemRollups.filter((s) => s.requiresCyberAssurance).length,
    assurance: enterpriseAssurance,
    rawAssurance: enterpriseRaw,
    assetCount: assetRollups.length,
    systemCount: systemRollups.length,
    controlBackedPct: Math.round(
      (assetRollups.reduce((a, x) => a + x.evidencedControlCount, 0) /
        assetRollups.reduce((a, x) => a + x.requiredControlCount, 0)) * 100
    ),
    // Summed across systems, never averaged — coverage is a count of things
    // examined, and averaging two percentages over different denominators
    // produces a number that is not a percentage of anything.
    coverage: coverageOf(allAssessments),
    controlsBelowTarget: allScored.filter((a) => (a.score ?? 0) < ASSURANCE_TARGET).length,
    weakestControl: allScored.length === 0
      ? null
      : allScored.reduce((w, a) => ((a.rawScore as number) < (w.rawScore as number) ? a : w)),
    assuranceBand: assuranceBand(enterpriseAssurance),
  };

  // Each category averaged across systems rather than across assets — the
  // figures the Executive Dashboard shows. Weighted by each system's FIPS 199
  // overall impact, the same weight the enterprise hop uses, so a category is
  // not reported as healthy because the small boundary is good at it.
  const categoryEnterpriseAverages = ASSURANCE_CATEGORIES.map((label) => {
    const entries = systemRollups
      .filter((s) => s.categories[label].raw !== null)
      .map((s) => ({
        value: s.categories[label].raw as number,
        weight: s.impactWeight,
      }));
    const raw = weightedMean(entries);
    return { label, pct: display(raw), raw };
  });

  // ---- Data map layout, derived from the flow graph ---------------------------
  // Depth is computed by walking inbound data edges, so the layout follows the
  // flows rather than a stored per-asset stage.
  function flowLayoutForSystem(systemId: SystemId) {
    const assets = graph.assetsBySystem[systemId] ?? [];
    const ids = new Set(assets.map((a) => a.id));
    const dataEdges = graph.dataFlows.filter((f) => f.kind === "data" && ids.has(f.from) && ids.has(f.to));

    // Database-kind assets carry real data edges — they aren't control-plane
    // branches — but where the data lands is a different fact from how many
    // hops it took to get there, so they're pulled out of the stage walk below
    // and given their own Data Plane section instead. Excluding their edges
    // from the walk is safe as long as nothing downstream is reachable only
    // through one; every database in this model is a sink (nothing flows back
    // out of it), so that holds today, but would need revisiting the day a
    // database has an outbound data edge of its own.
    const dbIds = new Set(assets.filter((a) => (DATABASE_KINDS as readonly string[]).includes(a.kind)).map((a) => a.id));

    // Egress-kind assets (BOUNDARY_EGRESS_KINDS) are pulled out of the stage
    // walk the same way database-kind assets are: they're where data leaves
    // the boundary, a distinct fact from how many hops it took to get there.
    // Without this, "Egress" would mean nothing more than "whatever the walk
    // happened to dead-end at," which is just as often an internal worker or
    // log feed as an actual boundary component.
    const egressIds = new Set(assets.filter((a) => (BOUNDARY_EGRESS_KINDS as readonly string[]).includes(a.kind)).map((a) => a.id));

    // Software-delivery-kind assets (a CI/CD pipeline, an artifact registry, an
    // IaC apply step) are pulled out the same way — they push code and config
    // into the boundary, they don't carry a live request through it.
    const deliveryIds = new Set(assets.filter((a) => (SOFTWARE_DELIVERY_KINDS as readonly string[]).includes(a.kind)).map((a) => a.id));

    // Backup-vault assets are recovery infrastructure, not live state stores.
    // Keep them out of both the request-path walk and the generic control plane
    // so their asynchronous backup/restore semantics remain visible.
    const backupRecoveryIds = new Set(assets.filter((a) => (BACKUP_RECOVERY_KINDS as readonly string[]).includes(a.kind)).map((a) => a.id));

    // Workforce-ingress-kind assets (an SSO provider, a ZTNA gateway) are
    // pulled out the same way — they gate an internal actor's path to a
    // privileged asset, they don't carry a live customer request through it.
    const workforceIngressIds = new Set(assets.filter((a) => (WORKFORCE_INGRESS_KINDS as readonly string[]).includes(a.kind)).map((a) => a.id));
    const pathDataEdges = dataEdges.filter(
      (f) => !dbIds.has(f.from) && !dbIds.has(f.to) && !egressIds.has(f.from) && !egressIds.has(f.to)
    );

    // Control-plane-only assets (a key store, a service account) aren't in the
    // request path at all. They hang off the assets they protect rather than
    // occupying a stage of their own.
    const inRequestPath = new Set<string>();
    pathDataEdges.forEach((f) => { inRequestPath.add(f.from); inRequestPath.add(f.to); });

    // A real request path cycles — the model service answers back to the gateway
    // it was called from — so there is no node with zero inbound edges to start
    // from, and "longest path from a source" would ratchet forever around the
    // loop. Entry is therefore identified by asset KIND (the thing that sits
    // where traffic crosses into the boundary), which is a modelled fact, and
    // depth is the shortest hop count from there. Breadth-first traversal visits
    // each node once, so the cycle settles on its own.
    const entries = assets.filter(
      (a) => (BOUNDARY_INGRESS_KINDS as readonly string[]).includes(a.kind) && inRequestPath.has(a.id)
    );
    // No ingress-kind asset (a boundary that only stores, say) falls back to
    // whatever nothing else feeds, and failing that to the least-fed node.
    const inDegree: Record<string, number> = {};
    assets.forEach((a) => (inDegree[a.id] = pathDataEdges.filter((f) => f.to === a.id).length));
    const pathAssets = assets.filter((a) => inRequestPath.has(a.id));
    const sources = entries.length
      ? entries
      : pathAssets.filter((a) => inDegree[a.id] === 0).length
        ? pathAssets.filter((a) => inDegree[a.id] === 0)
        : pathAssets.slice().sort((a, b) => inDegree[a.id] - inDegree[b.id]).slice(0, 1);

    const depth: Record<string, number | null> = {};
    assets.forEach((a) => (depth[a.id] = null));

    let frontier = sources.map((a) => a.id);
    frontier.forEach((id) => (depth[id] = 0));
    let level = 0;
    while (frontier.length > 0) {
      level += 1;
      const next: string[] = [];
      frontier.forEach((id) => {
        pathDataEdges
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
    const reachedMax = Math.max(0, ...Object.values(depth).filter((d): d is number => d !== null));
    pathAssets.forEach((a) => {
      if (depth[a.id] === null) depth[a.id] = reachedMax + 1;
    });

    const maxDepth = Math.max(0, ...Object.values(depth).filter((d): d is number => d !== null));
    const stages: { depth: number; nodes: (typeof assetRollups)[number][] }[] = [];
    for (let d = 0; d <= maxDepth; d++) {
      const nodes = assets.filter((a) => depth[a.id] === d).map((a) => assetRollupById[a.id]);
      if (nodes.length) stages.push({ depth: d, nodes });
    }

    const branches = assets
      .filter((a) => depth[a.id] === null && !dbIds.has(a.id) && !egressIds.has(a.id) && !deliveryIds.has(a.id) && !backupRecoveryIds.has(a.id) && !workforceIngressIds.has(a.id))
      .map((a) => ({
        asset: assetRollupById[a.id],
        protects: graph.dataFlows.filter((f) => f.from === a.id && f.kind === "control-plane").map((f) => assetRollupById[f.to]),
      }));

    // Data plane: the database-kind assets pulled out of the walk above,
    // paired with whoever's data edges actually feed them.
    const dataPlane = assets
      .filter((a) => dbIds.has(a.id))
      .map((a) => ({
        asset: assetRollupById[a.id],
        fedBy: dataEdges.filter((f) => f.to === a.id).map((f) => assetRollupById[f.from]),
      }));

    // Egress: the egress-kind assets pulled out of the walk above, paired with
    // whoever's data edges actually feed them — same shape as Data Plane,
    // because both are terminal sinks the walk doesn't continue past.
    const egress = assets
      .filter((a) => egressIds.has(a.id))
      .map((a) => ({
        asset: assetRollupById[a.id],
        fedBy: dataEdges.filter((f) => f.to === a.id).map((f) => assetRollupById[f.from]),
      }));

    // Software Deployment: the software-delivery-kind assets pulled out of the
    // branch walk above, paired with whichever assets they actually push code
    // or config into.
    const softwareDeployment = assets
      .filter((a) => deliveryIds.has(a.id))
      .map((a) => ({
        asset: assetRollupById[a.id],
        deploysTo: graph.dataFlows.filter((f) => f.from === a.id && f.kind === "deploys-to").map((f) => assetRollupById[f.to]),
      }));

    // Backup & Recovery: asynchronous protection copies terminate at the
    // vault; controlled restore relationships originate there. These edges
    // deliberately do not contribute to the live request-path layout.
    const backupRecovery = assets
      .filter((a) => backupRecoveryIds.has(a.id))
      .map((a) => ({
        asset: assetRollupById[a.id],
        backedUpFrom: graph.dataFlows.filter((f) => f.to === a.id && f.kind === "backup").map((f) => assetRollupById[f.from]),
        restoresTo: graph.dataFlows.filter((f) => f.from === a.id && f.kind === "restore").map((f) => assetRollupById[f.to]),
      }));

    // Ingress - Workforce: the workforce-ingress-kind assets pulled out of
    // the branch walk above, paired with whichever privileged asset they
    // grant access to.
    const workforceIngress = assets
      .filter((a) => workforceIngressIds.has(a.id))
      .map((a) => ({
        asset: assetRollupById[a.id],
        grantsAccessTo: graph.dataFlows.filter((f) => f.from === a.id && f.kind === "control-plane").map((f) => assetRollupById[f.to]),
      }));

    // Every actor tied to this system — human or machine — split by which way
    // the call goes. An inbound actor calls into the system (rendered before
    // Ingress); an outbound actor is one of our assets calling out to it (a
    // third-party model provider, an external SaaS destination), rendered
    // after Egress. Splitting on `direction` instead of merging them into one
    // row keeps an outbound-only actor from visually reading as if it were
    // entering the system.
    const systemActorAccess = graph.actorAccess
      .filter((a) => ids.has(a.assetId))
      .map((a) => ({
        actor: graph.actorById[a.actorId],
        assetId: a.assetId,
        note: a.note,
        direction: a.direction,
      }));
    const ingressActors = systemActorAccess.filter((a) => a.direction === ACTOR_DIRECTIONS.INBOUND);
    const egressActors = systemActorAccess.filter((a) => a.direction === ACTOR_DIRECTIONS.OUTBOUND);
    const internalActors = systemActorAccess.filter((a) => a.direction === ACTOR_DIRECTIONS.INTERNAL);

    return {
      systemId, stages, branches, dataPlane, egress, softwareDeployment, backupRecovery, workforceIngress, ingressActors, egressActors, internalActors,
      edges: dataEdges,
      controlPlaneEdges: graph.dataFlows.filter((f) => f.kind === "control-plane" && ids.has(f.from)),
    };
  }

  function inboundFlowCount(assetId: AssetId): number {
    return (graph.flowsToAsset[assetId] ?? []).length;
  }

  return {
    assetRollup,
    assetRollups,
    assetRollupById,
    categoryRollupForSystem,
    systemRollup,
    systemRollups,
    systemRollupById,
    enterprise,
    categoryEnterpriseAverages,
    flowLayoutForSystem,
    inboundFlowCount,
    TOTAL_ACTOR_COUNT: graph.actorAccess.length,
    TOTAL_FLOW_COUNT: graph.dataFlows.length,
  };
}

export type RollupsApi = ReturnType<typeof createRollups>;
export type AssetRollup = RollupsApi["assetRollups"][number];
export type SystemRollup = RollupsApi["systemRollups"][number];
