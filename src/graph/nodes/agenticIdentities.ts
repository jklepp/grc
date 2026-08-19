import type { OrgId, SystemId } from "../ids";

export const AGENT_AUTONOMY_LEVELS = ["recommend", "approval-gated", "autonomous"] as const;
export type AgentAutonomyLevel = (typeof AGENT_AUTONOMY_LEVELS)[number];

export const AGENT_CREDENTIAL_TYPES = [
  "workload-identity",
  "oidc-federation",
  "api-key",
  "aws-access-key",
  "client-secret",
] as const;
export type AgentCredentialType = (typeof AGENT_CREDENTIAL_TYPES)[number];

export const AGENT_PRIVILEGE_LEVELS = ["read-only", "standard", "privileged", "administrative"] as const;
export type AgentPrivilegeLevel = (typeof AGENT_PRIVILEGE_LEVELS)[number];

export const AGENT_REVOCATION_MECHANISMS = ["automated", "manual", "none"] as const;
export type AgentRevocationMechanism = (typeof AGENT_REVOCATION_MECHANISMS)[number];

// An agentic identity is the authenticated principal an AI agent uses when it
// can invoke tools or affect another resource. It is deliberately separate
// from an LLM endpoint (not an identity) and from Actor (an external request
// origin). These facts describe the identity operating inside this system's
// boundary and the authority attached to it.
export interface AgenticIdentity {
  id: string;
  systemId: SystemId;
  name: string;
  purpose: string;
  ownerOrgId?: OrgId;
  servicePrincipal: string;
  autonomyLevel: AgentAutonomyLevel;
  humanApprovalRequired: boolean;
  externalActions: boolean;
  canImpersonateUser: boolean;
  privilegeLevel: AgentPrivilegeLevel;
  credentialType: AgentCredentialType;
  credentialCreatedAt?: string;
  lastRotatedAt?: string;
  credentialExpiresAt?: string;
  lastUsedAt?: string;
  loggingEnabled: boolean;
  revocationMechanism: AgentRevocationMechanism;
  tools: string[];
  active: boolean;
}
