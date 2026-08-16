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
//
// FACTORY NOTE: category weights are read straight off the graph here rather
// than through engine/profile.ts. profile.ts consumes asset rollups, so routing
// weights through it would make the two mutually dependent for no gain — the
// weights are a fact, and facts come from the graph.
import type { Graph } from "../graph/types";
import {
  BOUNDARY_INGRESS_KINDS, BOUNDARY_EGRESS_KINDS, DATABASE_KINDS,
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
import {
  criticalityScore, criticalityBand, assuranceBand,
  impactFromCriticality, riskScore, riskBand, mean, weightedMean, display,
  CRITICALITY_FACTORS, ASSURANCE_TARGET,
} from "./assurance";
import type { AssetId, SystemId } from "../graph/ids";


// Reported beside every score, at every hop. Counts, never averaged.
//
// This exists because a score and the share of the estate it speaks for are two
// different facts, and the old model could only report the first. An enterprise
// 65 derived from 106 of 503 applicable controls is a different claim from a 65
// derived from all of them, and printing only the number lets a reader take the
// second reading when the first is true.
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
  findings: FindingsApi
) {
  // ---- An asset, as a diagnostic ------------------------------------------------
  // AN ASSET NO LONGER HAS A SCORE, AND THAT IS THE POINT.
  //
  // It used to carry overallAssurance, six category rollups, an evidence
  // confidence and a residual risk, all of which fed the system above it. The
  // premise was that scoring each asset and averaging upward describes a
  // boundary's posture. It does not, and at any real scale nobody does it: the
  // work of assessing twenty-six things individually is the reason the whole
  // exercise gets skipped.
  //
  // What an asset carries instead is what it can honestly say. Criticality and
  // classification, both derived from the asset's own facts and from nothing
  // about controls — a statement about consequence, not about posture. And a
  // list of every control that applies to it, each with the status it showed
  // and the evidence behind that status.
  //
  // That list is the answer to the question this change was made for: "as part
  // of the system's assurance, was this S3 bucket shown compliant against
  // encryption at rest?" It is the same ControlInstance object the Implemented
  // level sampled, reached from the other end, so the asset view and the control
  // view cannot disagree — there is one object and two ways in.
  //
  // criticality survives as a WEIGHT at the enterprise hop. A weight is not a
  // score: it says how much this boundary's number should count, not how well
  // anything is doing.
  function assetRollup(assetId: AssetId) {
    const asset = graph.assetById[assetId];
    const system = graph.systemById[asset.systemId];

    // CriticalityFactors is already a typed interface with exactly these five
    // keys — reading them directly by name, rather than looping Object.keys()
    // and casting the result back to a shape TypeScript already knew, keeps the
    // compiler checking the property access instead of being told to trust it.
    const factors: Record<string, number> = Object.fromEntries(
      CRITICALITY_FACTORS.map((f) => [f, asset.criticalityFactors[f].score])
    );
    const criticality = criticalityScore(factors);

    const controls = assessment.instancesForAsset(assetId);
    const required = applicability.requiredControlsForAsset(assetId);
    const counted = controls.filter((i) => i.status !== "not-applicable");
    const evidenced = controls.filter((i) => i.evidence.length > 0);

    // A COVERAGE figure, explicitly not a score. Same honesty role
    // controlBackedPct played: "how much of what applies here has anybody
    // actually looked at", asked without implying an answer about quality.
    const evidenceCoveragePct = required.length === 0 ? 0 : Math.round((evidenced.length / required.length) * 100);

    const impact = impactFromCriticality(criticality);
    const inherentScore = riskScore(asset.inherentLikelihood, impact);

    return {
      ...asset,
      system,
      classification: classification.assetClassification(assetId),
      classificationDetail: classification.assetClassificationDetail(assetId),
      criticality,
      criticalityBand: criticalityBand(criticality),

      // The diagnostic. One entry per control that applies to this asset,
      // carrying a status and a sentence — never a number.
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

      // Intrinsic, and unchanged. Impact is what happens if this asset is
      // compromised; it does not move because controls improved. Residual risk
      // is gone from here — it needed an asset score to compute, and it is
      // answered properly at the risk level from the controls actually mapped
      // to each scenario.
      impact,
      inherentRisk: { likelihood: asset.inherentLikelihood, impact, score: inherentScore, band: riskBand(inherentScore) },
    };
  }

  // Built once per engine instance. Every consumer reads these rather than
  // recomputing, so there is exactly one value for any asset's assurance.
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
    const scored = all.filter((a) => a.assessed);
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

    // THE SYSTEM IS ASSESSED, NOT AVERAGED FROM ITS ASSETS.
    //
    // This used to be the criticality-weighted mean of every asset's own score,
    // with program controls pooled in at one typical asset's weight. The
    // arithmetic was fine and the premise was not: it said a system is secure
    // because each of its twenty-six assets was scored individually, and nobody
    // assesses an estate that way. A real engagement rates a requirement
    // statement against a boundary once and samples assets to decide whether it
    // holds — which is what engine/assessment.ts now does, and what this reads.
    //
    // Assets did not stop mattering. They are the sampling population inside the
    // Implemented level, and they still weight the enterprise hop below. What
    // they no longer do is carry a score that rolls up.
    //
    // Categories are weighted by the SYSTEM's classification tier, from the same
    // control-profile facts the asset hop used to read. The argument recorded at
    // the asset rollup transfers intact — one-sixth weighting let a thirty-point
    // Identity & Access shortfall vanish on a system whose entire risk is
    // confidentiality — but the subject changes, because an asset no longer has
    // a tier-weighted score of its own to be the subject of.
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
    const criticality = display(weightedMean(assets.map((a) => ({ value: a.criticality, weight: 1 }))));

    const assessments = assessment.assessmentsForSystem(systemId);
    const scoredAssessments = assessments.filter((a) => a.assessed);
    const coverage = coverageOf(assessments);

    // The company-wide controls that apply to this boundary, kept nameable
    // rather than folded invisibly into the average — "which program controls
    // land here, and how are they doing" is a question a system page should
    // answer. They are ordinary assessments now: a program-scoped control is
    // tested once for the boundary instead of sampled across its assets, which
    // is what `scope` on a key control means since it stopped being the scoring
    // axis.
    const programAssessments = scoredAssessments.filter(
      (a) => graph.keyControlById[a.controlId]?.scope === "program"
    );
    const totalRequired = assets.reduce((a, x) => a + x.requiredControlCount, 0);
    const totalEvidenced = assets.reduce((a, x) => a + x.evidencedControlCount, 0);

    const categoryScores = Object.fromEntries(
      ASSURANCE_CATEGORIES.map((c) => [c, categories[c].score])
    ) as Record<AssuranceCategory, number | null>;

    return {
      ...system,
      // `assignment` is a display string resolved from the stored `ownerId`, so
      // pages built against the old free-text roles[] didn't need to change.
      roles: system.roles.map((r) => ({ ...r, assignment: graph.orgById[r.ownerId]?.name ?? r.ownerId })),
      findings: findings.findingsForSystem(systemId),
      classification: classification.systemClassification(systemId),
      assets,
      assetCount: assets.length,
      // The program layer for this boundary, kept nameable rather than folded
      // invisibly into the average — "which company-wide controls apply here,
      // and how are they doing" is a question the system page should answer.
      programAssessments,
      programControlCount: programAssessments.length,
      overallAssurance: assurance,
      rawAssurance,
      assuranceBand: assuranceBand(assurance),
      criticality,
      criticalityBand: criticalityBand(criticality as number),
      categories,
      categoryScores,
      categoryWeights: weights,
      // The assessment behind the number, and how much of the applicable estate
      // it speaks for. Coverage travels with every score in this model — a 69
      // derived from 44 of 271 controls and a 69 derived from all 271 are not
      // the same claim, and reporting only the first number conflates them.
      assessments,
      scoredAssessments,
      coverage,
      weakestControl: scoredAssessments.length === 0
        ? null
        : scoredAssessments.reduce((w, a) => ((a.rawScore as number) < (w.rawScore as number) ? a : w)),
      controlBackedPct: totalRequired === 0 ? 0 : Math.round((totalEvidenced / totalRequired) * 100),
      requiredControlCount: totalRequired,
      evidencedControlCount: totalEvidenced,
      // Counted across the assessments' own sampled instances rather than
      // across per-asset implementations, which no longer exist. Same question,
      // asked of the thing that now holds the answer.
      staleEvidenceCount: scoredAssessments.reduce(
        (n, a) => n + a.instances.filter((i) => i.evidence.some((e) => e.stale)).length,
        0
      ),
      // weakestAsset is gone. An asset has no score to be weakest by, and
      // "which asset is worst" was always a vaguer question than the one a
      // reader actually wants answered — weakestControl, above, names the
      // requirement that is failing instead of the box it failed in. The
      // instances beneath it name the asset anyway.
      deficientControls: scoredAssessments.filter(
        (a) => a.levels.Implemented.rating <= 25
      ),
      // Every sampled instance that is failing or unevidenced, across the
      // boundary — what "which specific things are wrong here" now resolves to.
      failingInstances: scoredAssessments.flatMap((a) =>
        a.instances.filter((i) => i.status === "not-implemented" || i.status === "partial")
      ),
    };
  }

  const systemRollups = graph.systems.map((s) => systemRollup(s.id));
  const systemRollupById = Object.fromEntries(systemRollups.map((s) => [s.id, s])) as Record<SystemId, (typeof systemRollups)[number]>;

  const enterpriseRaw = weightedMean(
    systemRollups.map((s) => ({
      value: s.rawAssurance as number,
      // A system's weight is the total criticality it contains, so a boundary
      // holding eight critical assets outweighs one holding seven moderate ones
      // without anyone having to declare that separately.
      weight: s.assets.reduce((a, x) => a + x.criticality, 0),
    }))
  );

  const enterpriseAssurance = display(enterpriseRaw);
  const allAssessments = systemRollups.flatMap((s) => s.assessments);
  const allScored = systemRollups.flatMap((s) => s.scoredAssessments);

  const enterprise = {
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
    // Replaces assetsBelowTarget. An asset no longer has a score to be below a
    // target, and "which controls are failing" names the thing to go fix rather
    // than the container it sits in.
    controlsBelowTarget: allScored.filter((a) => (a.score ?? 0) < ASSURANCE_TARGET).length,
    weakestControl: allScored.length === 0
      ? null
      : allScored.reduce((w, a) => ((a.rawScore as number) < (w.rawScore as number) ? a : w)),
    assuranceBand: assuranceBand(enterpriseAssurance),
  };

  // Each category averaged across systems rather than across assets — the
  // figures the Executive Dashboard shows. Weighted by the criticality each
  // system contains, the same weight the enterprise hop uses, so a category is
  // not reported as healthy because the small boundary is good at it.
  const categoryPortfolioAverages = ASSURANCE_CATEGORIES.map((label) => {
    const entries = systemRollups
      .filter((s) => s.categories[label].raw !== null)
      .map((s) => ({
        value: s.categories[label].raw as number,
        weight: s.assets.reduce((a, x) => a + x.criticality, 0),
      }));
    const raw = weightedMean(entries);
    return { label, pct: display(raw), raw };
  });

  // ---- Data map layout, derived from the flow graph ---------------------------
  // Stage membership used to be stored: a per-system dictionary naming which
  // assets sat in "Ingress", "Primary Custody", and so on, which meant adding a
  // flow also meant remembering to re-slot the asset or the picture quietly went
  // wrong. Here depth is computed by walking inbound data edges, so the layout is
  // a consequence of the flows rather than a parallel description of them.
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
    const pathDataEdges = dataEdges.filter(
      (f) => !dbIds.has(f.from) && !dbIds.has(f.to) && !egressIds.has(f.from) && !egressIds.has(f.to)
    );

    // Control-plane-only assets (a key store, a service account) aren't in the
    // request path at all. They hang off the assets they protect rather than
    // occupying a stage of their own — the same shape the old map drew with a
    // cosmetic `branch` flag, now meaning something.
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
      .filter((a) => depth[a.id] === null && !dbIds.has(a.id) && !egressIds.has(a.id))
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

    return {
      systemId, stages, branches, dataPlane, egress, ingressActors, egressActors,
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
    categoryPortfolioAverages,
    flowLayoutForSystem,
    inboundFlowCount,
    TOTAL_ACTOR_COUNT: graph.actorAccess.length,
    TOTAL_FLOW_COUNT: graph.dataFlows.length,
  };
}

export type RollupsApi = ReturnType<typeof createRollups>;
export type AssetRollup = RollupsApi["assetRollups"][number];
export type SystemRollup = RollupsApi["systemRollups"][number];
