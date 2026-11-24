// DataType — the canonical categories of data ACME actually holds, promoted
// from labels to entities.
//
// Real nodes, so assetDataTypes and dataFlows edges reference the same fact.
//
// `sensitivity` uses the same four tiers as CLASS_ORDER in theme.ts: an
// asset's classification is the high-water mark of its data, and a system's of
// its assets (engine/classification.ts).
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
