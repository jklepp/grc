// The framework baseline: how a system without HITRUST in scope is assessed.
//
// Most systems are not assessed on the five PRISMA levels. Only a system with
// HITRUST r2 in its standards is (requiresCyberAssurance below). Everyone else
// is assessed the way an ISO 27001 Statement of Applicability or a SOC 2
// control matrix is kept: per control, a statement of how it is met, a status,
// an owner, and, where the frameworks in scope ask for it, a frequency and
// evidence references.
//
// A control's statement lives in one of three places:
//
//   common           written once by the central program and inherited as-is
//                    by every system it applies to (CommonControlRecord, type
//                    "common"). The system writes nothing.
//   hybrid           the central program writes the method (CommonControlRecord,
//                    type "hybrid", with `systemPart` saying what each system
//                    must do), and each system records its own part
//                    (SystemControlRecord). The system's status is the worse
//                    of the two.
//   system-specific  no central record; the system writes the whole thing
//                    (SystemControlRecord).
//
// "Shared" is deliberately not one of these words: in this codebase it already
// means provider shared responsibility (edges/controlImplementations.ts).
import type { ControlId, OrgId, SystemId } from "../ids";
import { HITRUST_R2_STANDARD } from "./providerCertifications";

export const CONTROL_RECORD_STATUSES = ["implemented", "partial", "not-implemented"] as const;
export type ControlRecordStatus = (typeof CONTROL_RECORD_STATUSES)[number];

export const CONTROL_RECORD_STATUS_META: Record<ControlRecordStatus, { label: string; color: string }> = {
  implemented: { label: "Implemented", color: "green" },
  partial: { label: "Partially implemented", color: "amber" },
  "not-implemented": { label: "Not implemented", color: "red" },
};

// How often the control operates. SOC 2 sizes its test sample from this, which
// is why a control any in-scope SOC 2 criterion maps to must state it.
export const CONTROL_FREQUENCIES = [
  "continuous", "per-event", "daily", "weekly", "monthly", "quarterly", "semi-annual", "annual",
] as const;
export type ControlFrequency = (typeof CONTROL_FREQUENCIES)[number];

export const COMMON_CONTROL_TYPES = ["common", "hybrid"] as const;
export type CommonControlType = (typeof COMMON_CONTROL_TYPES)[number];

export const IMPLEMENTATION_TYPE_LABELS = {
  common: "Common",
  hybrid: "Hybrid",
  "system-specific": "System-specific",
} as const;
export type ImplementationType = keyof typeof IMPLEMENTATION_TYPE_LABELS;

interface RecordBody {
  /** How the control is met, in plain language. The SoA "how", the SOC 2 control description. */
  statement: string;
  status: ControlRecordStatus;
  ownerId: OrgId;
  frequency?: ControlFrequency;
  /** Where the proof lives: report ids, ticket keys, connector test names. Pointers, not artifacts. */
  evidence?: string[];
  reviewedAt: string;
  /**
   * When this version was saved. Records are never overwritten: every save is
   * a new version, the latest is current, and any earlier date can be read
   * back (versionAsOf). Authored YAML rows may omit it and fall back to
   * reviewedAt.
   */
  recordedAt?: string;
  /** Who saved this version: a roster user id, or "authored" for YAML. */
  recordedBy?: string;
  /** Set when the version was published by closing an engagement. */
  engagementId?: string;
}

/** The central program's record for a control it runs for every system (common) or defines the method for (hybrid). */
export interface CommonControlRecord extends RecordBody {
  controlId: ControlId;
  type: CommonControlType;
  /** Hybrid only: what each system has to do itself for the control to hold. */
  systemPart?: string;
}

/** One system's record for a control: the whole of a system-specific control, or the system's part of a hybrid one. */
export interface SystemControlRecord extends RecordBody {
  systemId: SystemId;
  controlId: ControlId;
}

/**
 * Whether a system is assessed on the Cyber Assurance (PRISMA) levels. Only
 * HITRUST asks for that depth; every other system is assessed at the
 * framework baseline above.
 */
export function requiresCyberAssurance(system: { standards: readonly string[] }): boolean {
  return system.standards.includes(HITRUST_R2_STANDARD);
}

/**
 * What the in-scope frameworks that map a control ask its record to carry.
 * ISO and HIPAA are satisfied by a statement and a status; evidence is pulled
 * when the auditor samples. SOC 2 tests operating effectiveness over a period,
 * so it needs the frequency (to size the sample) and evidence to sample from.
 * PCI DSS prescribes evidence per testing procedure.
 */
export function recordRequirements(frameworks: readonly string[]) {
  return {
    frequency: frameworks.includes("SOC 2"),
    evidence: frameworks.includes("SOC 2") || frameworks.includes("PCI DSS"),
  };
}

// ---- Versions ----------------------------------------------------------------
// A record's identity is its key (control for a common record, system+control
// for a system record); each row with that key is one version of it.

export const commonRecordKey = (r: { controlId: string }) => r.controlId;
export const systemRecordKey = (r: { systemId: string; controlId: string }) => `${r.systemId}::${r.controlId}`;

export function recordTime(r: { recordedAt?: string; reviewedAt: string }): number {
  return Date.parse(r.recordedAt ?? r.reviewedAt);
}

/** The latest version of every record, by key. Ties go to the row listed later. */
export function latestVersions<T extends { recordedAt?: string; reviewedAt: string }>(rows: readonly T[], key: (r: T) => string): T[] {
  const latest = new Map<string, T>();
  rows.forEach((r) => {
    const k = key(r);
    const cur = latest.get(k);
    if (!cur || recordTime(r) >= recordTime(cur)) latest.set(k, r);
  });
  return [...latest.values()];
}

/** Every version of one record, oldest first. */
export function versionsOf<T extends { recordedAt?: string; reviewedAt: string }>(rows: readonly T[], key: (r: T) => string, k: string): T[] {
  return rows.filter((r) => key(r) === k).sort((a, b) => recordTime(a) - recordTime(b));
}

/** The version that was current at a moment, or null if the record did not exist yet. */
export function versionAsOf<T extends { recordedAt?: string; reviewedAt: string }>(rows: readonly T[], key: (r: T) => string, k: string, at: string): T | null {
  const t = Date.parse(at);
  const before = versionsOf(rows, key, k).filter((r) => recordTime(r) <= t);
  return before.length ? before[before.length - 1] : null;
}
