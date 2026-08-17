// Thin, null-safe passthrough — the snapshot is already the aggregate the
// cockpit shows, so there is nothing to derive.
import type { Graph } from "../graph/types";
import type { SystemId } from "../graph/ids";

export function createVulnerabilities(graph: Graph) {
  function vulnerabilitiesForSystem(systemId: SystemId) {
    return graph.vulnSnapshotBySystem[systemId] ?? null;
  }
  return { vulnerabilitiesForSystem };
}

export type VulnerabilitiesApi = ReturnType<typeof createVulnerabilities>;
