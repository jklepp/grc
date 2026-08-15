// DataType — the canonical categories of data ACME actually holds, promoted
// from labels to entities.
//
// These were previously `dataElements` strings hanging off each system in
// systemRegister.js, which meant nothing could ask "which assets hold Customer
// PII?" — the answer lived at the system level, one tier too coarse to be
// useful. Here each becomes a real node other things can point at, so
// assetDataTypes edges and dataFlows edges can both reference the same fact.
//
// Nothing here is newly invented. The first seven come directly from the two
// systems' own dataElements lists. The last two (Session & Usage Metadata,
// Access & Audit Logs) come from asset descriptions that already asserted this
// data exists — the RDS Metadata Database's "conversation/session metadata and
// customer identifiers" and the Audit Log Feed's "access and change metadata."
// Promoting an asserted fact to an entity isn't inventing data; leaving it as
// prose inside a `reason` string was what made it unusable.
//
// `sensitivity` uses the same four tiers as CLASS_ORDER in theme.js, because an
// asset's classification is now DERIVED from the data it holds (see
// engine/rollups.js) rather than inherited wholesale from its parent system.
// That's the substantive change: a system's classification is the high-water
// mark of its assets, and an asset's is the high-water mark of its data — so a
// log feed that only ever carries access metadata stops being labelled
// "Restricted" just because it sits inside a Restricted boundary.
import type { ClassificationTier } from "./taxonomy";

export interface DataType {
  id: string;
  name: string;
  kind: string;
  sensitivity: ClassificationTier;
  regulatedBy: string[];
  description: string;
}

export const DATA_TYPES: DataType[] = [
  {
    id: "DT-001",
    name: "Customer PII",
    kind: "pii",
    sensitivity: "Restricted",
    regulatedBy: [],
    description:
      "Personally identifiable information belonging to ACME's customers' end users, carried through the AI platform on every authenticated request. Not GDPR-scoped in this register (the customer base in scope is US-contractual), but held to the Restricted tier on contractual and SOC 2 grounds.",
  },
  {
    id: "DT-002",
    name: "Customer Documents",
    kind: "documents",
    sensitivity: "Restricted",
    regulatedBy: [],
    description:
      "Raw customer-supplied source documents ingested for retrieval-augmented generation. The ground truth every RAG answer traces back to.",
  },
  {
    id: "DT-003",
    name: "Model Prompts & Outputs",
    kind: "modelData",
    sensitivity: "Restricted",
    regulatedBy: [],
    description:
      "Customer prompts and model completions, including the retrieved document context injected into them. Restricted because a prompt routinely contains verbatim customer data.",
  },
  {
    id: "DT-004",
    name: "Encryption Keys & Secrets",
    kind: "secrets",
    sensitivity: "Restricted",
    regulatedBy: [],
    description:
      "Cryptographic key material and service credentials. Restricted not because of what it is, but because possession of it grants access to everything else at this tier.",
  },
  {
    id: "DT-005",
    name: "Session & Usage Metadata",
    kind: "metadata",
    sensitivity: "Confidential",
    regulatedBy: [],
    description:
      "Conversation and session records plus the customer identifiers that scope access and attribute usage. Not document content, but enough to link a person to their activity.",
  },
  {
    id: "DT-006",
    name: "Access & Audit Logs",
    kind: "auditLog",
    sensitivity: "Confidential",
    regulatedBy: ["GDPR"],
    description:
      "Access, authentication, and change events. Carries who-did-what metadata rather than the underlying records — but the actor in every one of those records is an identifiable employee, which makes the log itself personal data and holds it at the same tier as the records it describes. Its integrity still matters more than its confidentiality.",
  },
  {
    id: "DT-007",
    name: "Employee PII",
    kind: "employee",
    sensitivity: "Confidential",
    regulatedBy: ["GDPR"],
    description:
      "Employee personal data held in the HR system of record — identity, contact, employment, and org records for ACME's workforce.",
  },
  {
    id: "DT-008",
    name: "Compensation Data",
    kind: "financial",
    sensitivity: "Confidential",
    regulatedBy: ["GDPR"],
    description:
      "Salary, bonus, and equity records. Flows to the external payroll processor on a fixed pay-cycle schedule.",
  },
  {
    id: "DT-009",
    name: "Benefits Information",
    kind: "documents",
    sensitivity: "Confidential",
    regulatedBy: ["GDPR"],
    description:
      "Benefits elections and supporting documentation held alongside the employee record.",
  },
];

export const DATA_TYPE_BY_ID: Record<string, DataType> = Object.fromEntries(DATA_TYPES.map((d) => [d.id, d]));

// Which data-type kinds count as personal data for applicability rules that
// turn on "does this asset touch personal data at all" (see PRI-05 and NET-17
// in edges/applicabilityRules.js). Kept here next to the kinds themselves so a
// new data type can't quietly fall outside a rule that should have caught it.
export const PERSONAL_DATA_KINDS = ["pii", "employee"];
