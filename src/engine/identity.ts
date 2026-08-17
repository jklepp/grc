// Identity & Access posture for the System Register cockpit: population
// coverage by identity type, plus the most recent access review.
import type { Graph } from "../graph/types";
import type { EngineContext } from "./context";
import { cadenceStatus } from "./assurance";
import type { SystemId } from "../graph/ids";

export function createIdentity(graph: Graph, ctx: EngineContext) {
  function identityPostureForSystem(systemId: SystemId) {
    const populations = (graph.identityPopulationsBySystem[systemId] ?? []).map((p) => ({
      ...p,
      ssoCoveragePct: p.totalCount === 0 ? null : Math.round((p.ssoEnforcedCount / p.totalCount) * 100),
      mfaCoveragePct: p.totalCount === 0 ? null : Math.round((p.mfaEnforcedCount / p.totalCount) * 100),
      strongMfaCoveragePct: p.totalCount === 0 ? null : Math.round((p.strongMfaCount / p.totalCount) * 100),
    }));

    const totals = populations.reduce(
      (acc, p) => ({
        accounts: acc.accounts + p.totalCount,
        dormant: acc.dormant + p.dormantCount,
        shared: acc.shared + p.sharedCount,
        localBypass: acc.localBypass + p.localBypassCount,
        awaitingTermination: acc.awaitingTermination + p.awaitingTerminationCount,
      }),
      { accounts: 0, dormant: 0, shared: 0, localBypass: 0, awaitingTermination: 0 }
    );

    const reviews = graph.accessReviewsBySystem[systemId] ?? [];
    const latestReview = reviews.reduce<(typeof reviews)[number] | null>(
      (latest, r) => (!latest || Date.parse(r.reviewedAt) > Date.parse(latest.reviewedAt) ? r : latest),
      null
    );
    const review = latestReview
      ? { ...latestReview, cadence: cadenceStatus(latestReview.reviewedAt, latestReview.cadenceDays, ctx.now) }
      : null;

    return { systemId, populations, totals, review };
  }

  return { identityPostureForSystem };
}

export type IdentityApi = ReturnType<typeof createIdentity>;
export type IdentityPosture = ReturnType<IdentityApi["identityPostureForSystem"]>;
