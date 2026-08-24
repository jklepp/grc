import { getAllSystems } from "../engine";
import type { SystemId } from "../graph/ids";

// Which system the app lands on: Production AI Platform, the one most worth
// opening by default, falling back to the first if it is ever renamed or
// removed.
//
// Resolved on call rather than at module scope, and it lives here rather than
// in SystemWorkspace, for two reasons that are easy to re-break:
//
//   1. A module-level `const SYSTEMS = getAllSystems()` snapshots the live
//      engine binding at import time. `publish()` swaps that binding on every
//      commit, so the snapshot silently answers with the first engine forever.
//   2. App only needed the id, but importing it from SystemWorkspace pulled
//      that module — and its twenty-odd children, the wizard among them — into
//      whatever chunk App lives in, which is what made route splitting
//      impossible.
//
// Returns null only when the dataset has no systems at all; callers route to
// the picker in that case rather than throwing.
export function defaultSystemId(): SystemId | null {
  const systems = getAllSystems();
  const preferred = systems.find((system) => system.name === "Production AI Platform") ?? systems[0];
  return preferred?.id ?? null;
}
