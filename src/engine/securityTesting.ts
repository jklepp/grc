// Penetration test and red-team history for the System Register cockpit.
// `overdue` is true if any required type has never been run at all, or its
// most recent run has passed its own cadence — a system with a clean pen
// test but no red team ever conducted is not "up to date."
import type { Graph } from "../graph/types";
import type { EngineContext } from "./context";
import { cadenceStatus } from "./assurance";
import { SECURITY_TEST_TYPES, type SecurityTestType } from "../graph/nodes/securityTests";
import type { FindingsApi } from "./findings";
import type { SystemId } from "../graph/ids";

export function createSecurityTesting(graph: Graph, ctx: EngineContext, findings: FindingsApi) {
  function securityTestsForSystem(systemId: SystemId) {
    const exercises = (graph.securityTestsBySystem[systemId] ?? []).map((t) => ({
      ...t,
      cadence: cadenceStatus(t.completedAt, t.cadenceDays, ctx.now),
    }));

    const latestByType = {} as Record<SecurityTestType, (typeof exercises)[number] | null>;
    SECURITY_TEST_TYPES.forEach((type) => {
      latestByType[type] = exercises
        .filter((e) => e.type === type)
        .reduce<(typeof exercises)[number] | null>(
          (latest, e) => (!latest || Date.parse(e.completedAt) > Date.parse(latest.completedAt) ? e : latest),
          null
        );
    });

    const overdue = SECURITY_TEST_TYPES.some((type) => !latestByType[type] || latestByType[type]!.cadence.overdue);
    const openFindings = SECURITY_TEST_TYPES.flatMap((type) => findings.openFindingsForSource(systemId, type));

    return { systemId, exercises, latestByType, overdue, openFindings };
  }

  return { securityTestsForSystem };
}

export type SecurityTestingApi = ReturnType<typeof createSecurityTesting>;
