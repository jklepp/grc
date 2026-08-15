// Finding — a violation discovered inside a control implementation that
// already exists, tracked from discovery to close.
//
// Before this, "SEC-2260" was a string that happened to be typed
// consistently across three unconnected places: a note on a maturity
// override (controlImplementations.js), a note on an evidence record
// (evidence.js), and a hand-authored POA&M row on the system
// (systems.js's old `remediation[]`, itself carrying its own copy of
// `owner`, `due`, `controlId`, `assetId` — a stale `overdue: false` sat next
// to a due date that had already passed, because nothing recomputed it). A
// typo in any one of those three places would not have been caught by
// anything.
//
// A Finding is that fact told once. Everything else is derived
// (engine/findings.js): evidenceIds come from evidence records that declare
// `findingId` themselves (matching how evidence already owns its own scope —
// see evidence.js), riskIds come from intersecting this finding's asset and
// control against riskContributors.js edges, and `overdue` is computed
// against the real clock instead of hand-typed.
//
// SCOPE: a Finding lives UNDER an implementation that's there but deficient,
// not in place of one that's absent. A control with no implementation at all
// is NOT_IMPLEMENTED (controlImplementations.js) — there's no violation to
// track because there's nothing whose behavior deviated from a promise. Only
// promote a gap to a Finding once it has the facts a finding actually needs:
// an owner, a due date, a ticket. A documented gap without those (e.g. the
// MON-03 note on AST-003-03) stays a plain override note rather than being
// forced into a Finding with an invented owner.
export const FINDING_STATUSES = ["open", "accepted", "remediating", "verified", "closed"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export interface Finding {
  id: string;
  title: string;
  detail: string;
  assetId: string;
  controlId: string;
  status: FindingStatus;
  ownerId: string;
  due: string;
}

export const FINDINGS: Finding[] = [
  {
    id: "SEC-2260",
    title: "Scope RAG service's IAM role to least privilege",
    detail: "The service role was provisioned with broad read access across every data store in the boundary and has not been scoped since.",
    assetId: "AST-003-03",
    controlId: "IAC-21",
    status: "remediating",
    ownerId: "ml-platform-team",
    due: "2026-08-25",
  },
  {
    id: "SEC-2261",
    title: "Deploy DLP scanning on the prod-customer-data ingestion path",
    detail: "DLP is required by the Data Classification & Handling Policy but nothing is deployed on the ingestion path.",
    assetId: "AST-003-05",
    controlId: "NET-17",
    status: "open",
    ownerId: "s-patel",
    due: "2026-09-05",
  },
  {
    id: "SEC-2262",
    title: "Define retention/disposal schedule for vector embeddings and the RAG document store",
    detail: "No retention or disposal schedule exists for embeddings — the policy applies, the schedule was never written.",
    assetId: "AST-003-04",
    controlId: "DCH-18",
    status: "open",
    ownerId: "ml-platform-team",
    due: "2026-09-15",
  },
  {
    id: "SEC-2210",
    title: "Complete manager-role quarterly access recertification",
    detail: "The recertification campaign runs, but the manager-role slice is past due rather than complete.",
    assetId: "AST-042-01",
    controlId: "IAC-17",
    status: "remediating",
    ownerId: "r-chen",
    due: "2026-07-25",
  },
];
