// Identity & Access — who can authenticate into a system, how, and where the
// exceptions are. Replaces the crude oktaEnforced/mfaEnforced strings on
// System with a real population breakdown: "MFA = compliant" answers nothing
// next to "3 of 31 privileged users lack phishing-resistant MFA."
//
// A population row is an aggregate observation, not one row per real human —
// consistent with how system criticalityFactors already scores at the
// boundary rather than enumerating every asset instance.
import type { SystemId, OrgId } from "../ids";

export const IDENTITY_TYPES = [
  "employee", "privileged", "contractor", "vendor", "service-account", "workload", "break-glass",
] as const;
export type IdentityType = (typeof IDENTITY_TYPES)[number];

export interface IdentityPopulation {
  id: string;
  systemId: SystemId;
  identityType: IdentityType;
  totalCount: number;
  ssoEnforcedCount: number;
  mfaEnforcedCount: number;
  // The phishing-resistant (WebAuthn/FIDO2) subset of mfaEnforcedCount.
  strongMfaCount: number;
  dormantCount: number;
  localBypassCount: number;
  sharedCount: number;
  awaitingTerminationCount: number;
}

export interface AccessReview {
  id: string;
  systemId: SystemId;
  reviewedAt: string;
  cadenceDays: number;
  reviewedCount: number;
  totalCount: number;
  exceptionsIdentified: number;
  exceptionsOpen: number;
  reviewerOrgId: OrgId;
}
