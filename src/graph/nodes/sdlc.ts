// Secure SDLC posture. Conditionally meaningful: a vendor-operated SaaS
// tenant ACME writes no code into has nothing here to assess, and that's a
// real fact (`applicable: false`), not a gap.
import type { SystemId } from "../ids";

export interface SdlcPosture {
  systemId: SystemId;
  applicable: boolean;
  // Required-reason pattern, same as a not-implemented declaration: "not
  // applicable" without one is indistinguishable from "nobody looked."
  notApplicableReason?: string;
  repoBranchProtection: boolean;
  prReviewRequired: boolean;
  sastEnabled: boolean;
  scaEnabled: boolean;
  dastEnabled: boolean;
  containerScanningEnabled: boolean;
  secretScanningEnabled: boolean;
  iacScanningEnabled: boolean;
  cicdIdentityHardened: boolean;
  deployApprovalRequired: boolean;
  lastThreatModelAt?: string;
}
