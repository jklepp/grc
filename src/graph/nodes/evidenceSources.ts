// Evidence Source — what produced a collection, separated from any one
// collection event.
//
// evidence.ts's records are Observations: `collectedAt`, `result`, coverage,
// exceptions — the things that genuinely vary run to run. `evidenceType` and
// `independence`, by contrast, don't vary run to run for a given source: AWS
// IAM Access Analyzer is a continuous, automated source every time it appears,
// on every asset it's ever observed. Today that's a handful of observations
// repeating the same two facts; once a real integration is streaming, it's
// thousands of observations repeating them, and re-declaring "automated
// continuous telemetry" on every single one is exactly the duplication this
// graph exists to remove.
//
// A Source is DERIVED, never authored — one per distinct `source` name, each
// knowing which observations are its. That derivation lives in
// graph/assemble.ts, which is why this file is a type and nothing else.
//
// The assumption that makes the split meaningful is enforced rather than
// trusted: every observation citing the same source name must agree about what
// kind of source it is. If two ever disagree, that's either two different tools
// sharing a name (a real problem) or a typo (also a real problem) — either way
// it should stop the build rather than quietly average together. assemble.ts
// collects those disagreements as `sourceConflicts` and validate.ts throws on
// them.
import type { IndependenceLevel } from "./evidence";
import type { EvidenceType } from "./taxonomy";
import type { EvidenceSourceId, EvidenceId } from "../ids";

export interface EvidenceSource {
  id: EvidenceSourceId;
  name: string;
  evidenceType: EvidenceType;
  independence: IndependenceLevel;
  observationIds: EvidenceId[];
}
