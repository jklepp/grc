// RISK —[carried by]→ ASSET   and   RISK —[held down by]→ CONTROL
//
// What replaces `linkedControl`, the free-text string that used to be a risk's
// only connection to the rest of the model. That string was routed through a
// hand-typed map to an assurance category, and the category's ENTERPRISE-WIDE
// average was then reported as the risk's control assurance — so RISK-001,
// a cross-tenant defect in the retrieval path, reported a number computed
// across all fifteen assets including the payroll connector and the audit log
// feed. It could not move when the RAG service moved, because it was never
// reading the RAG service.
//
// With these edges, engine/risk.ts reads assurance from the assets that
// actually carry the scenario and the controls that actually hold it down. The
// consequence is the traceability the whole exercise is for: RISK-001's number
// moves when CLD-06 on the RAG service moves, and CLD-06 on the RAG service
// moves when its cross-tenant test result changes.
//
// `role` separates the asset the scenario is really about from the ones that
// participate in it. A primary contributor is weighted more heavily, because
// averaging the RAG service against five healthier assets would wash out
// exactly the signal the risk exists to carry.

import type { RiskId, AssetId, ControlId } from "../ids";

export const CONTRIBUTOR_ROLES = { PRIMARY: "primary", CONTRIBUTING: "contributing" } as const;
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[keyof typeof CONTRIBUTOR_ROLES];

export interface RiskAsset {
  riskId: RiskId;
  assetId: AssetId;
  role: ContributorRole;
  note?: string;
}


export interface RiskControl {
  riskId: RiskId;
  controlId: ControlId;
}
