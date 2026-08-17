// Incident response: plan currency, tabletop history (a system's own
// exercises plus the enterprise-wide ones it falls back to), and production
// incident history.
import type { Graph } from "../graph/types";
import type { EngineContext } from "./context";
import { cadenceStatus } from "./assurance";
import type { FindingsApi } from "./findings";
import type { SystemId } from "../graph/ids";

export function createIncidentResponse(graph: Graph, ctx: EngineContext, findings: FindingsApi) {
  function irForSystem(systemId: SystemId) {
    const planRow = graph.irPlanCurrencyByScope[systemId] ?? graph.irPlanCurrencyByScope.program ?? null;
    const planCurrency = planRow
      ? { ...planRow, cadence: cadenceStatus(planRow.lastReviewedAt, planRow.cadenceDays, ctx.now) }
      : null;

    const tabletops = [
      ...(graph.tabletopExercisesByScope[systemId] ?? []),
      ...(graph.tabletopExercisesByScope.program ?? []),
    ].map((t) => ({ ...t, cadence: cadenceStatus(t.conductedAt, t.cadenceDays, ctx.now) }));
    const lastTabletop = tabletops.reduce<(typeof tabletops)[number] | null>(
      (latest, t) => (!latest || Date.parse(t.conductedAt) > Date.parse(latest.conductedAt) ? t : latest),
      null
    );

    const incidents = graph.productionIncidentsBySystem[systemId] ?? [];
    const lastIncident = incidents.reduce<(typeof incidents)[number] | null>(
      (latest, i) => (!latest || Date.parse(i.occurredAt) > Date.parse(latest.occurredAt) ? i : latest),
      null
    );

    const tabletopOverdue = !lastTabletop || lastTabletop.cadence.overdue;
    const planReviewOverdue = !planCurrency || planCurrency.cadence.overdue;
    const openFindings = findings.openFindingsForSource(systemId, "ir-tabletop");

    return { systemId, planCurrency, tabletops, lastTabletop, lastIncident, tabletopOverdue, planReviewOverdue, openFindings };
  }

  return { irForSystem };
}

export type IncidentResponseApi = ReturnType<typeof createIncidentResponse>;
