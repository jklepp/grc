// Finding — a violation discovered inside a control implementation that
// already exists, tracked from discovery to close.
//
// Before this, "SEC-2260" was a string that happened to be typed
// consistently across three unconnected places: a note on a maturity
// override (controlImplementations.ts), a note on an evidence record
// (evidence.ts), and a hand-authored POA&M row on the system
// (systems.ts's old `remediation[]`, itself carrying its own copy of
// `owner`, `due`, `controlId`, `assetId` — a stale `overdue: false` sat next
// to a due date that had already passed, because nothing recomputed it). A
// typo in any one of those three places would not have been caught by
// anything.
//
// A Finding is that fact told once. Everything else is derived
// (engine/findings.ts): evidenceIds come from evidence records that declare
// `findingId` themselves (matching how evidence already owns its own scope —
// see evidence.ts), riskIds come from intersecting this finding's asset and
// control against riskContributors.ts edges, and `overdue` is computed
// against the real clock instead of hand-typed.
//
// SCOPE: a Finding lives UNDER an implementation that's there but deficient,
// not in place of one that's absent. A control with no implementation at all
// is NOT_IMPLEMENTED (controlImplementations.ts) — there's no violation to
// track because there's nothing whose behavior deviated from a promise. Only
// promote a gap to a Finding once it has the facts a finding actually needs:
// an owner, a due date, a ticket. A documented gap without those (e.g. the
// MON-03 note on AST-003-03) stays a plain override note rather than being
// forced into a Finding with an invented owner.
import type { FindingId, AssetId, ControlId, OrgId } from "../ids";

export const FINDING_STATUSES = ["open", "accepted", "remediating", "verified", "closed"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

// What raised this finding, beyond a routine control-gap review. Optional and
// absent-means-"control-gap" so the pre-existing population needs no
// migration. This is what lets a pen-test/red-team/DR-test/tabletop's open
// items live in the same POA&M tracker instead of each domain inventing its
// own — a finding still lives under a real assessed (asset, control) pair
// exactly as it always has; `source` only says what surfaced it.
export const FINDING_SOURCES = [
  "control-gap", "penetration-test", "red-team", "vulnerability-scan",
  "dr-test", "ir-tabletop", "access-review",
] as const;
export type FindingSource = (typeof FINDING_SOURCES)[number];

export const FINDING_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface Finding {
  id: FindingId;
  title: string;
  detail: string;
  assetId: AssetId;
  controlId: ControlId;
  status: FindingStatus;
  ownerId: OrgId;
  due: string;
  severity?: FindingSeverity;
  source?: FindingSource;
}
