// Evidence — what an assurance claim actually rests on.
//
// Before this, "evidence" was two things, neither of them a record: an
// `evidenceType` string on an asset's category assessment (one of seven enum
// values, averaged into a confidence score), and an `evidenceRef: "EV-9101"`
// on a tracked control that pointed at nothing. So an asset could report
// evidenceConfidence: 96 without there being a single collection anywhere in
// the app that had happened, covered anything, or passed.
//
// Now confidence is computed (engine/implementation.ts) from three things a
// record actually carries:
//
//   type      — the same seven-value EVIDENCE_TYPES scale, unchanged, because
//               "who says so" genuinely is the dominant factor.
//   coverage  — a test that checked 40% of the fleet is not the same claim as
//               one that checked all of it, even at identical type.
//   freshness — a continuous telemetry reading from this morning and one from
//               nine months ago are the same TYPE of evidence and nowhere near
//               the same strength of claim. Each record declares its own
//               validForDays and decays past it rather than being binary-stale.
//
// SCOPE, and why evidence isn't listed on implementations
// -------------------------------------------------------
// Each record declares which implementations it covers, via controlId plus the
// assets it was collected across. That direction is deliberate: it matches how
// these tools really work (one Vanta test evaluates every S3 bucket at once,
// and reporting it as six independent collections would overstate the
// independence of the finding), and more importantly it means the link is
// stored exactly once. Putting evidenceIds[] on implementations as well would
// recreate, inside the graph, the same dual-maintenance problem the graph
// exists to remove.
//
// `result` is the collected outcome. It is the single field to edit to watch
// propagation work end to end: flip one to "fail" and the implementation, the
// asset, its system, the enterprise score, that control's framework coverage,
// and any risk it contributes to all move together.
import type { EvidenceType } from "./taxonomy";
import type { EvidenceId, ControlId, AssetId, FindingId, EvidenceSourceId, EvidenceArtifactId } from "../ids";

export const EVIDENCE_RESULTS = ["pass", "partial", "fail"] as const;
export type EvidenceResult = (typeof EVIDENCE_RESULTS)[number];

export const INDEPENDENCE_LEVELS = ["automated", "internal", "external"] as const;
export type IndependenceLevel = (typeof INDEPENDENCE_LEVELS)[number];

export const EVIDENCE_COLLECTOR_TYPES = ["automated", "manual", "imported"] as const;
export type EvidenceCollectorType = (typeof EVIDENCE_COLLECTOR_TYPES)[number];

export const EVIDENCE_RECORD_STATUSES = ["active", "superseded", "withdrawn"] as const;
export type EvidenceRecordStatus = (typeof EVIDENCE_RECORD_STATUSES)[number];

// Deliberately duplicated (not imported) from evidenceSources.ts's identical
// function: that file derives EVIDENCE_SOURCES FROM this file's RAW_EVIDENCE,
// so importing it back here would be a cycle. It's one pure three-line
// function, not a fact — nothing about what a source id IS lives in two
// places, just the formula for computing one from a name.
export function sourceIdFromName(name: string): EvidenceSourceId {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

// How long a collection stays at full strength before it starts decaying,
// keyed by evidence type. A continuous telemetry feed is worthless the moment
// it stops reporting; an auditor's examination is reasonably good for a year.
// Records may override with their own validForDays.
export const DEFAULT_VALIDITY_DAYS: Record<EvidenceType, number> = {
  "Continuous telemetry": 2,
  "Automated technical test": 14,
  "API configuration observation": 30,
  "Auditor examination": 365,
  Screenshot: 90,
  Document: 365,
  "Self-attestation": 180,
};

export interface RawEvidence {
  id: EvidenceId;
  source: string;
  evidenceType: EvidenceType;
  controlId: ControlId;
  assetIds: AssetId[];
  collectedAt: string;
  periodStart?: string;
  periodEnd?: string;
  ingestedAt?: string;
  collectorType?: EvidenceCollectorType;
  collectorIdentity?: string;
  collectionRunId?: string;
  methodVersion?: string;
  sourceConfigurationVersion?: string;
  artifactIds?: EvidenceArtifactId[];
  recordStatus?: EvidenceRecordStatus;
  supersedesId?: EvidenceId;
  coveragePct: number;
  result: EvidenceResult;
  independence: IndependenceLevel;
  validForDays?: number;
  exceptions?: number;
  population?: number;
  populationUnit?: string;
  findingId?: FindingId;
  note?: string;
}


export interface Evidence extends RawEvidence {
  validForDays: number;
  sourceId: EvidenceSourceId;
}
