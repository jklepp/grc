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
// engine/rollups.ts) rather than inherited wholesale from its parent system.
// That's the substantive change: a system's classification is the high-water
// mark of its assets, and an asset's is the high-water mark of its data — so a
// log feed that only ever carries access metadata stops being labelled
// "Restricted" just because it sits inside a Restricted boundary.
import type { ClassificationTier } from "./taxonomy";
import type { DataTypeId } from "../ids";

// A fixed vocabulary for the one question the System Register's Data section
// needs a hard yes/no on: does this data type carry a named regulated-data
// category at all. `regulatedBy` (named laws like "GDPR") stays free text —
// this is a separate, closed axis alongside it, not a replacement.
export const REGULATORY_FLAGS = ["PII", "PHI", "PCI", "Employee-Data", "Financial", "Credentials"] as const;
export type RegulatoryFlag = (typeof REGULATORY_FLAGS)[number];

export interface DataType {
  id: DataTypeId;
  name: string;
  kind: string;
  sensitivity: ClassificationTier;
  regulatedBy: string[];
  regulatoryFlags: RegulatoryFlag[];
  description: string;
}



// Which data-type kinds count as personal data for applicability rules that
// turn on "does this asset touch personal data at all" (see PRI-05 and NET-17
// in edges/applicabilityRules.ts). Kept here next to the kinds themselves so a
// new data type can't quietly fall outside a rule that should have caught it.
export const PERSONAL_DATA_KINDS = ["pii", "employee"];
