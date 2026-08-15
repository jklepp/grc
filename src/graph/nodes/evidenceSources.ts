// Evidence Source — what produced a collection, separated from any one
// collection event.
//
// evidence.js's records are Observations: `collectedAt`, `result`, coverage,
// exceptions — the things that genuinely vary run to run. `evidenceType` and
// `independence`, by contrast, don't vary run to run for a given source: AWS
// IAM Access Analyzer is a continuous, automated source every time it
// appears, on every asset it's ever observed. Today that's 3 observations
// repeating the same 2 facts; once a real integration is streaming, it's
// thousands of observations repeating them, and re-declaring "automated
// continuous telemetry" on every single one is exactly the duplication this
// graph exists to remove.
//
// This file doesn't move those facts off the observation (that would mean
// hand-retyping 60+ already-authored records with real risk of a transcription
// mistake, for no gain on the ~54 sources used exactly once). Instead it
// derives the Source as its own queryable node — one per distinct `source`
// name, each knowing which observations are its — and validate.js enforces
// the assumption that makes the split meaningful: every observation citing
// the same source name agrees about what kind of source it is. If two ever
// disagree, that's either two different tools that happen to share a name (a
// real problem) or a typo (also a real problem) — either way it should stop
// the build rather than quietly average together.
import { RAW_EVIDENCE, sourceIdFromName } from "./evidence";
import type { IndependenceLevel } from "./evidence";
import type { EvidenceType } from "./taxonomy";

export interface EvidenceSource {
  id: string;
  name: string;
  evidenceType: EvidenceType;
  independence: IndependenceLevel;
  observationIds: string[];
}

const byId = new Map<string, EvidenceSource>();
export const EVIDENCE_SOURCE_CONFLICTS: string[] = [];

RAW_EVIDENCE.forEach((e) => {
  const id = sourceIdFromName(e.source);
  const existing = byId.get(id);
  if (!existing) {
    byId.set(id, { id, name: e.source, evidenceType: e.evidenceType, independence: e.independence, observationIds: [e.id] });
    return;
  }
  existing.observationIds.push(e.id);
  if (existing.evidenceType !== e.evidenceType) {
    EVIDENCE_SOURCE_CONFLICTS.push(`source "${e.source}" (${id}): observation ${e.id} declares evidenceType "${e.evidenceType}", but observation ${existing.observationIds[0]} declared "${existing.evidenceType}"`);
  }
  if (existing.independence !== e.independence) {
    EVIDENCE_SOURCE_CONFLICTS.push(`source "${e.source}" (${id}): observation ${e.id} declares independence "${e.independence}", but observation ${existing.observationIds[0]} declared "${existing.independence}"`);
  }
});

export const EVIDENCE_SOURCES: EvidenceSource[] = [...byId.values()];
export const EVIDENCE_SOURCE_BY_ID: Record<string, EvidenceSource> = Object.fromEntries(EVIDENCE_SOURCES.map((s) => [s.id, s]));

export function observationsForSource(sourceId: string): string[] {
  return EVIDENCE_SOURCE_BY_ID[sourceId]?.observationIds ?? [];
}
