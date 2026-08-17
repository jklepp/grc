// Attack surface — what a system exposes to the internet and how tightly it's
// held. Separate from the control matrix: a control says what ACME does about
// exposure, this says what the exposure actually is.
import type { SystemId, OrgId } from "../ids";

export const EGRESS_POSTURE = ["default-deny", "monitored-allow", "default-allow"] as const;
export type EgressPosture = (typeof EGRESS_POSTURE)[number];

export const ADMIN_POSTURE = ["just-in-time", "bastion-only", "vpn-required", "direct-internet"] as const;
export type AdminPosture = (typeof ADMIN_POSTURE)[number];

export const API_POSTURE = ["gateway-enforced", "partial-gateway", "unmanaged"] as const;
export type ApiPosture = (typeof API_POSTURE)[number];

export const EXTERNAL_SERVICE_KINDS = ["web-app", "public-api", "admin-interface"] as const;
export type ExternalServiceKind = (typeof EXTERNAL_SERVICE_KINDS)[number];

export interface ExternalService {
  id: string;
  systemId: SystemId;
  name: string;
  kind: ExternalServiceKind;
  internetFacing: boolean;
  // Verified reachability, not just intent — a service can be internet-facing
  // by design and still not actually resolve from the open internet.
  externallyReachable: boolean;
  authRequired: boolean;
  wafProtected: boolean;
}

export interface ExposurePosture {
  systemId: SystemId;
  inboundIntegrationCount: number;
  outboundIntegrationCount: number;
  egressPosture: EgressPosture;
  adminPosture: AdminPosture;
  apiPosture: ApiPosture;
}

export const DANGEROUS_CONDITIONS = [
  "admin-interface-internet-facing", "api-without-gateway",
  "default-allow-egress", "unmanaged-break-glass-access",
] as const;
export type DangerousCondition = (typeof DANGEROUS_CONDITIONS)[number];

// Required-reason pattern, same shape as applicabilityExceptions: an accepted
// dangerous condition has to say why, or "accepted" is indistinguishable from
// "nobody looked."
export interface ExposureException {
  id: string;
  systemId: SystemId;
  condition: DangerousCondition;
  reason: string;
  approvedBy: OrgId;
  expiresAt?: string;
}
