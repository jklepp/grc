// The framework baseline, resolved: one control on one system without HITRUST
// in scope, read from its records rather than from the PRISMA levels.
//
// See graph/nodes/controlRecords.ts for the model. The resolution order is the
// order a GRC analyst would answer "who runs this here, and how is it doing?":
//
//   1. the provider runs it        -> inherited (provider's report)
//   2. a common record covers it   -> the common record's status
//   3. a hybrid record covers it   -> the worse of the central part and this
//                                     system's part; no system part yet means
//                                     unassessed, because half a control was
//                                     looked at
//   4. a central program attests the domain -> inherited (enterprise attestation)
//   5. this system has a record    -> that record's status
//   6. nothing                     -> unassessed, never zero
//
// Common and hybrid records sit above the domain attestation because they are
// the more specific fact: an attestation says a program covers the domain, a
// record says how one control in it is met.
import type { Graph } from "../graph/types";
import type { ControlId, SystemId } from "../graph/ids";
import type { Responsibility } from "../graph/edges/controlImplementations";
import { RESPONSIBILITIES } from "../graph/edges/controlImplementations";
import {
  recordRequirements,
  type CommonControlRecord, type ControlRecordStatus, type ImplementationType, type SystemControlRecord,
} from "../graph/nodes/controlRecords";

export type BaselineStatus = "inherited" | "satisfied" | "partial" | "not-implemented" | "unassessed";

export interface BaselineResolution {
  status: BaselineStatus;
  /** Where the answer came from. */
  source: "provider" | "common" | "hybrid" | "enterprise-attestation" | "system" | "none";
  implementationType: ImplementationType;
  common: CommonControlRecord | null;
  record: SystemControlRecord | null;
  /** In-scope frameworks on this system that map the control. */
  frameworks: string[];
  /** What those frameworks ask the record to carry. */
  requires: { frequency: boolean; evidence: boolean };
  /** Required fields the record holding this system's part is missing. Empty when nothing is owed or nothing is recorded yet. */
  missing: Array<"frequency" | "evidence">;
  explanation: string;
}

const RANK: Record<ControlRecordStatus, number> = { "not-implemented": 0, partial: 1, implemented: 2 };

function worse(a: ControlRecordStatus, b: ControlRecordStatus): ControlRecordStatus {
  return RANK[a] <= RANK[b] ? a : b;
}

function toBaseline(status: ControlRecordStatus, met: BaselineStatus): BaselineStatus {
  return status === "implemented" ? met : status;
}

function missingFields(
  requires: { frequency: boolean; evidence: boolean },
  r: { status: ControlRecordStatus; frequency?: string; evidence?: string[] } | null,
): Array<"frequency" | "evidence"> {
  // Nothing is owed on a control that is not in place: there is no operation
  // to sample yet. The gap is the status itself.
  if (!r || r.status === "not-implemented") return [];
  const out: Array<"frequency" | "evidence"> = [];
  if (requires.frequency && !r.frequency) out.push("frequency");
  if (requires.evidence && !(r.evidence?.length)) out.push("evidence");
  return out;
}

export function createControlRecords(
  graph: Graph,
  responsibilityForControl: (systemId: SystemId, controlId: ControlId) => Responsibility,
) {
  function resolve(systemId: SystemId, controlId: ControlId): BaselineResolution {
    const system = graph.systemById[systemId];
    const control = graph.controlById[controlId];
    const frameworks = (control?.frameworks ?? [])
      .map((f) => f.standard)
      .filter((std) => system?.standards.includes(std));
    const requires = recordRequirements(frameworks);
    const common = graph.commonRecordByControl[controlId] ?? null;
    const record = graph.systemRecordByPair[`${systemId}::${controlId}`] ?? null;
    const responsibility = responsibilityForControl(systemId, controlId);
    const base = { common, record, frameworks, requires };

    if (responsibility === RESPONSIBILITIES.VENDOR) {
      return {
        ...base, status: "inherited", source: "provider", implementationType: "common", missing: [],
        explanation: `Run by ${system?.provider ?? "the provider"} under its own certification; relied on through the provider's report.`,
      };
    }

    if (common?.type === "common") {
      return {
        ...base, status: toBaseline(common.status, "inherited"), source: "common", implementationType: "common",
        missing: missingFields(requires, common),
        explanation: common.statement,
      };
    }

    if (common?.type === "hybrid") {
      if (!record) {
        return {
          ...base, status: "unassessed", source: "hybrid", implementationType: "hybrid", missing: [],
          explanation: `The central part is recorded; this system's part is not. ${common.systemPart ?? ""}`.trim(),
        };
      }
      return {
        ...base, status: toBaseline(worse(common.status, record.status), "satisfied"), source: "hybrid", implementationType: "hybrid",
        missing: missingFields(requires, record),
        explanation: record.statement,
      };
    }

    if (responsibility === RESPONSIBILITIES.ENTERPRISE && !record) {
      return {
        ...base, status: "inherited", source: "enterprise-attestation", implementationType: "common", missing: [],
        explanation: `Run by a central ACME program whose attestation covers the ${control?.domain ?? ""} domain.`,
      };
    }

    if (record) {
      return {
        ...base, status: toBaseline(record.status, "satisfied"), source: "system", implementationType: "system-specific",
        missing: missingFields(requires, record),
        explanation: record.statement,
      };
    }

    return {
      ...base, status: "unassessed", source: "none", implementationType: "system-specific", missing: [],
      explanation: "Applicable to this system and not yet recorded — reported as unassessed rather than scored.",
    };
  }

  return { resolve };
}

export type ControlRecordsApi = ReturnType<typeof createControlRecords>;
