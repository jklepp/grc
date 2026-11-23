// Engagements: audits, external or internal, and what they produce.
//
// The system of record (controlRecords.ts) is management's current statement
// of how each control is met. An engagement is a bounded piece of work against
// it: some frameworks, some systems, a period, an audit firm. It reads the
// current records, keeps its own working copy of any it changes (drafts), and
// records the auditor's conclusion per control — a separate voice from
// management's statement, and never written into it. Closing an engagement:
//
//   - publishes the drafts back to the system of record as new versions,
//     after a reviewed diff;
//   - freezes the resolved view exactly as it stood (EngagementSnapshot) —
//     the audit record, which replaying today's engine over old records could
//     not reproduce, because applicability and inheritance rules move;
//   - records the certificate or report it produced (Certification).
//
// Several engagements can be open at once. Each tracks the moment it started
// (startedAt) so publishing can tell when someone else changed a record after
// this engagement read it.
import type { ControlId, OrgId, SystemId } from "../ids";
import type { ControlFrequency, ControlRecordStatus } from "./controlRecords";

export type EngagementId = string;

/** External: an audit firm. Internal: a readiness assessment or internal audit, same machinery, no auditor. */
export const ENGAGEMENT_FOCUS = ["external", "internal"] as const;
export type EngagementFocus = (typeof ENGAGEMENT_FOCUS)[number];

export const ENGAGEMENT_STATUSES = ["preparing", "in-audit", "closed"] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export const ENGAGEMENT_STATUS_META: Record<EngagementStatus, { label: string; color: string }> = {
  preparing: { label: "Preparing", color: "amber" },
  "in-audit": { label: "In audit", color: "accent" },
  closed: { label: "Closed", color: "green" },
};

export const AUDIT_TYPES = [
  "readiness", "certification", "surveillance", "recertification", "type-1", "type-2", "hitrust-r2",
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  readiness: "Readiness assessment",
  certification: "Initial certification",
  surveillance: "Surveillance audit",
  recertification: "Recertification audit",
  "type-1": "Type I examination",
  "type-2": "Type II examination",
  "hitrust-r2": "HITRUST r2 validated assessment",
};

export interface Engagement {
  id: EngagementId;
  name: string;
  focus: EngagementFocus;
  auditType: AuditType;
  status: EngagementStatus;
  frameworks: string[];
  systemIds: SystemId[];
  /** The period the evidence must cover. Point-in-time audits use the same day for both. */
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  auditFirm?: string;
  ownerId: OrgId;
  /** When the engagement read the system of record. Records versioned after this changed underneath it. */
  startedAt: string;
  closedAt?: string;
}

// The auditor's conclusion, framework-neutral. ISO's finer grading rides
// alongside as `nonconformity`.
export const AUDITOR_RESULTS = ["not-assessed", "in-place", "partial", "not-in-place"] as const;
export type AuditorResult = (typeof AUDITOR_RESULTS)[number];

export const AUDITOR_RESULT_META: Record<AuditorResult, { label: string; color: string }> = {
  "not-assessed": { label: "Not assessed", color: "muted" },
  "in-place": { label: "In place", color: "green" },
  partial: { label: "Partial", color: "amber" },
  "not-in-place": { label: "Not in place", color: "red" },
};

export const NONCONFORMITY_GRADES = ["major", "minor", "ofi"] as const;
export type NonconformityGrade = (typeof NONCONFORMITY_GRADES)[number];

export const NONCONFORMITY_LABELS: Record<NonconformityGrade, string> = {
  major: "Major nonconformity",
  minor: "Minor nonconformity",
  ofi: "Opportunity for improvement",
};

/** One control on one system inside an engagement: scoping, the auditor's result, request status. Sparse — a row exists only once someone touches it. */
export interface EngagementControl {
  engagementId: EngagementId;
  systemId: SystemId;
  controlId: ControlId;
  /** False excludes the control from this engagement (an SoA exclusion); needs a justification. */
  inScope: boolean;
  justification?: string;
  result: AuditorResult;
  nonconformity?: NonconformityGrade;
  resultNote?: string;
  /** The evidence request for this control was accepted (by GRC on the auditor's behalf, until auditors log in). */
  requestAccepted?: boolean;
  updatedAt: string;
}

/** The engagement's working copy of a system record. Published to the system of record when the engagement closes. */
export interface EngagementDraft {
  engagementId: EngagementId;
  systemId: SystemId;
  controlId: ControlId;
  statement: string;
  status: ControlRecordStatus;
  ownerId: OrgId;
  frequency?: ControlFrequency;
  evidence?: string[];
  reviewedAt: string;
  updatedAt: string;
}

/** The resolved view frozen at close: what the auditor saw. */
export interface EngagementSnapshotRow {
  systemId: SystemId;
  controlId: ControlId;
  inScope: boolean;
  justification?: string;
  /** Coverage status at close (satisfied / partial / inherited / …). */
  status: string;
  source: string;
  statement: string;
  evidence: string[];
  result: AuditorResult;
  nonconformity?: NonconformityGrade;
  resultNote?: string;
}

export interface EngagementSnapshot {
  engagementId: EngagementId;
  closedAt: string;
  rows: EngagementSnapshotRow[];
  /** Population sizes as they stood at close, by population name. */
  populations: Record<string, number>;
}

// ---- ACME's own certificates and reports ----------------------------------------
// The counterpart to provider-certifications.yaml: what ACME itself holds.

export const CERTIFICATION_KINDS = ["certificate", "type-2-report", "type-1-report", "validated-assessment"] as const;
export type CertificationKind = (typeof CERTIFICATION_KINDS)[number];

export const CERTIFICATION_KIND_LABELS: Record<CertificationKind, string> = {
  certificate: "Certificate",
  "type-2-report": "Type II report",
  "type-1-report": "Type I report",
  "validated-assessment": "Validated assessment",
};

export interface Certification {
  id: string;
  standard: string;
  kind: CertificationKind;
  systemIds: SystemId[];
  /** The engagement that produced it, when it was recorded by closing one. */
  engagementId?: EngagementId;
  issuedAt: string;
  validUntil: string;
  /** Report period, for period-based reports. */
  periodStart?: string;
  periodEnd?: string;
  auditFirm: string;
  reference: string;
}
