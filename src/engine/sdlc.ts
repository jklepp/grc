// Secure SDLC posture — thin passthrough. `applicable` is what the page uses
// to decide whether to render the section body at all.
import type { Graph } from "../graph/types";
import type { SystemId } from "../graph/ids";

export function createSdlc(graph: Graph) {
  function sdlcForSystem(systemId: SystemId) {
    return graph.sdlcPostureBySystem[systemId] ?? null;
  }
  return { sdlcForSystem };
}

export type SdlcApi = ReturnType<typeof createSdlc>;
