// Backup configuration and the DR tests that prove it. `overdue` fires on a
// missing test as well as a stale one — a system that has never run a
// restore has proven nothing, regardless of how green its backup job is.
import type { Graph } from "../graph/types";
import type { EngineContext } from "./context";
import { cadenceStatus } from "./assurance";
import type { SystemId } from "../graph/ids";

export function createResilience(graph: Graph, ctx: EngineContext) {
  function resilienceForSystem(systemId: SystemId) {
    const backup = graph.backupConfigBySystem[systemId] ?? null;
    const drTests = (graph.drTestsBySystem[systemId] ?? []).map((t) => ({
      ...t,
      cadence: cadenceStatus(t.conductedAt, t.cadenceDays, ctx.now),
    }));
    const lastDrTest = drTests.reduce<(typeof drTests)[number] | null>(
      (latest, t) => (!latest || Date.parse(t.conductedAt) > Date.parse(latest.conductedAt) ? t : latest),
      null
    );
    const overdue = !lastDrTest || lastDrTest.cadence.overdue;
    const targetsMetLastTest =
      lastDrTest && backup
        ? lastDrTest.restoreSuccessful &&
          lastDrTest.actualRpoMinutes <= backup.rpoTargetMinutes &&
          lastDrTest.actualRtoMinutes <= backup.rtoTargetMinutes
        : null;

    return { systemId, backup, drTests, lastDrTest, overdue, targetsMetLastTest };
  }

  return { resilienceForSystem };
}

export type ResilienceApi = ReturnType<typeof createResilience>;
