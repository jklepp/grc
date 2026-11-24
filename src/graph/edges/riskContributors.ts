// RISK —[carried by]→ ASSET   and   RISK —[held down by]→ CONTROL
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
