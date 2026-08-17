// Attack surface for the System Register cockpit. Dangerous conditions are
// derived from real facts (an externally-reachable admin interface, an
// unmanaged API posture, default-allow egress, break-glass identities that
// bypass SSO) rather than hand-typed, so an exception excuses a condition
// that's actually present instead of a plausible-sounding one that isn't.
import type { Graph } from "../graph/types";
import type { DangerousCondition } from "../graph/nodes/exposure";
import type { SystemId } from "../graph/ids";

export function createExposure(graph: Graph) {
  function exposureForSystem(systemId: SystemId) {
    const posture = graph.exposurePostureBySystem[systemId] ?? null;
    const externalServices = graph.externalServicesBySystem[systemId] ?? [];
    const exceptions = graph.exposureExceptionsBySystem[systemId] ?? [];
    const externallyReachableCount = externalServices.filter((s) => s.externallyReachable).length;

    const present: DangerousCondition[] = [];
    if (externalServices.some((s) => s.kind === "admin-interface" && s.externallyReachable)) {
      present.push("admin-interface-internet-facing");
    }
    if (posture?.apiPosture === "unmanaged") present.push("api-without-gateway");
    if (posture?.egressPosture === "default-allow") present.push("default-allow-egress");
    if (
      (graph.identityPopulationsBySystem[systemId] ?? []).some(
        (p) => p.identityType === "break-glass" && p.totalCount > 0 && p.localBypassCount > 0
      )
    ) {
      present.push("unmanaged-break-glass-access");
    }

    const exceptedConditions = new Set(exceptions.map((e) => e.condition));
    const dangerousConditionsUnmitigated = present.filter((c) => !exceptedConditions.has(c));

    return { systemId, posture, externalServices, externallyReachableCount, exceptions, dangerousConditionsUnmitigated };
  }

  return { exposureForSystem };
}

export type ExposureApi = ReturnType<typeof createExposure>;
