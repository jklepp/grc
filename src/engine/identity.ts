// Identity & Access posture for the System Register cockpit: population
// coverage by identity type, plus the most recent access review.
import type { Graph } from "../graph/types";
import type { EngineContext } from "./context";
import { cadenceStatus } from "./assurance";
import type { SystemId } from "../graph/ids";

export const LONG_LIVED_AGENT_CREDENTIAL_DAYS = 90;
export const DORMANT_AGENT_DAYS = 90;

const STATIC_AGENT_CREDENTIAL_TYPES = new Set(["api-key", "aws-access-key", "client-secret"]);

function daysSince(value: string | undefined, now: Date): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

export function createIdentity(graph: Graph, ctx: EngineContext) {
  function identityPostureForSystem(systemId: SystemId) {
    const populations = (graph.identityPopulationsBySystem[systemId] ?? []).map((p) => ({
      ...p,
      ssoCoveragePct: p.totalCount === 0 ? null : Math.round((p.ssoEnforcedCount / p.totalCount) * 100),
      mfaCoveragePct: p.totalCount === 0 ? null : Math.round((p.mfaEnforcedCount / p.totalCount) * 100),
      strongMfaCoveragePct: p.totalCount === 0 ? null : Math.round((p.strongMfaCount / p.totalCount) * 100),
    }));

    const totals = populations.reduce(
      (acc, p) => ({
        accounts: acc.accounts + p.totalCount,
        dormant: acc.dormant + p.dormantCount,
        shared: acc.shared + p.sharedCount,
        localBypass: acc.localBypass + p.localBypassCount,
        awaitingTermination: acc.awaitingTermination + p.awaitingTerminationCount,
      }),
      { accounts: 0, dormant: 0, shared: 0, localBypass: 0, awaitingTermination: 0 }
    );

    const reviews = graph.accessReviewsBySystem[systemId] ?? [];
    const latestReview = reviews.reduce<(typeof reviews)[number] | null>(
      (latest, r) => (!latest || Date.parse(r.reviewedAt) > Date.parse(latest.reviewedAt) ? r : latest),
      null
    );
    const review = latestReview
      ? { ...latestReview, cadence: cadenceStatus(latestReview.reviewedAt, latestReview.cadenceDays, ctx.now) }
      : null;

    const agenticIdentities = (graph.agenticIdentitiesBySystem[systemId] ?? []).map((agent) => {
      const credentialAgeDays = daysSince(agent.lastRotatedAt ?? agent.credentialCreatedAt, ctx.now);
      const daysSinceLastUse = daysSince(agent.lastUsedAt, ctx.now);
      const longLivedCredential = STATIC_AGENT_CREDENTIAL_TYPES.has(agent.credentialType)
        && (credentialAgeDays == null || credentialAgeDays > LONG_LIVED_AGENT_CREDENTIAL_DAYS);
      const dormant = agent.active && (daysSinceLastUse == null || daysSinceLastUse > DORMANT_AGENT_DAYS);
      const privileged = agent.privilegeLevel === "privileged" || agent.privilegeLevel === "administrative";
      const issues: Array<{ code: string; label: string; detail: string }> = [];

      if (!agent.ownerOrgId) issues.push({ code: "unowned", label: "No accountable owner", detail: "Assign an organizational owner and human sponsor." });
      if (longLivedCredential) issues.push({ code: "long-lived-credential", label: "Long-lived credential", detail: credentialAgeDays == null ? "No credential rotation date is recorded." : `${credentialAgeDays} days since the credential was rotated.` });
      if (dormant) issues.push({ code: "dormant", label: "Dormant or unobserved", detail: daysSinceLastUse == null ? "No last-use date is recorded." : `${daysSinceLastUse} days since the agent was last used.` });
      if (agent.autonomyLevel === "autonomous" && privileged) issues.push({ code: "autonomous-privileged", label: "Autonomous privileged access", detail: "This agent can act without approval using elevated authority." });
      if (agent.externalActions && !agent.humanApprovalRequired) issues.push({ code: "external-without-approval", label: "External action without approval", detail: "External actions do not require a human decision." });
      if (agent.canImpersonateUser) issues.push({ code: "user-impersonation", label: "Can impersonate users", detail: "Review delegated authority and preserve the originating user in audit logs." });
      if (!agent.loggingEnabled) issues.push({ code: "logging-disabled", label: "Activity logging disabled", detail: "Tool calls and authorization decisions are not fully recorded." });
      if (agent.revocationMechanism === "none") issues.push({ code: "no-revocation", label: "No revocation mechanism", detail: "The agent cannot be rapidly disabled during an incident." });

      return {
        ...agent,
        owner: agent.ownerOrgId ? graph.orgById[agent.ownerOrgId] ?? null : null,
        credentialAgeDays,
        daysSinceLastUse,
        longLivedCredential,
        dormant,
        privileged,
        issues,
      };
    });

    const agenticSummary = {
      total: agenticIdentities.length,
      active: agenticIdentities.filter((agent) => agent.active).length,
      autonomous: agenticIdentities.filter((agent) => agent.autonomyLevel === "autonomous").length,
      approvalGated: agenticIdentities.filter((agent) => agent.autonomyLevel === "approval-gated").length,
      privileged: agenticIdentities.filter((agent) => agent.privileged).length,
      externalActions: agenticIdentities.filter((agent) => agent.externalActions).length,
      longLivedCredentials: agenticIdentities.filter((agent) => agent.longLivedCredential).length,
      longLivedApiKeys: agenticIdentities.filter((agent) => agent.credentialType === "api-key" && agent.longLivedCredential).length,
      unowned: agenticIdentities.filter((agent) => !agent.owner).length,
      withIssues: agenticIdentities.filter((agent) => agent.issues.length > 0).length,
    };

    return { systemId, populations, totals, review, agenticIdentities, agenticSummary };
  }

  return { identityPostureForSystem };
}

export type IdentityApi = ReturnType<typeof createIdentity>;
export type IdentityPosture = ReturnType<IdentityApi["identityPostureForSystem"]>;
