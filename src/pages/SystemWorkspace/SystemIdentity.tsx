import React, { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, Fingerprint, KeyRound, ShieldAlert, Users2 } from "lucide-react";
import { C } from "../../theme";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";
import { CadenceBadge } from "./shared/CadenceBadge";
import { CoverageBar } from "./shared/CoverageBar";
import { SectionHeader } from "./shared/SectionHeader";
import { RolesResponsibilities } from "./overview/RolesResponsibilities";
import type { ExposurePosture, IdentityPosture, WorkspaceSystem } from "./types";

interface SystemIdentityProps {
  system: WorkspaceSystem;
  identity: IdentityPosture;
  exposure: ExposurePosture;
}

type IdentityPopulation = IdentityPosture["populations"][number];

function CountBadge({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "good" | "attention" }) {
  const color = tone === "good" ? C.green : tone === "attention" ? C.red : C.accent;
  const background = tone === "good" ? C.greenBg : tone === "attention" ? C.redBg : C.accentBg;
  return <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ color, background }}>{children}</span>;
}

function IdentityMetric({ label, value, detail, tone = "accent" }: { label: string; value: ReactNode; detail: string; tone?: "accent" | "good" | "attention" }) {
  const color = tone === "good" ? C.green : tone === "attention" ? C.red : C.accent;
  const background = tone === "good" ? C.greenBg : tone === "attention" ? C.redBg : C.accentBg;
  return (
    <div className="rounded-lg p-3.5" style={{ background }}>
      <div className="text-[10px] uppercase tracking-wide font-medium" style={{ color: C.muted }}>{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{detail}</div>
    </div>
  );
}

function coverageColor(pct?: number | null) {
  if (pct == null) return C.na;
  if (pct >= 95) return C.green;
  if (pct >= 80) return C.accent;
  if (pct >= 60) return C.amber;
  return C.red;
}

function WorkforceIdentityTable({ populations }: { populations: IdentityPopulation[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid text-[11px] font-medium pb-2 mb-2" style={{ gridTemplateColumns: "1.2fr 90px 1fr 1fr 1fr 90px", columnGap: 16, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
          <div>Identity Type</div>
          <div className="text-right">Total</div>
          <div>SSO</div>
          <div>MFA</div>
          <div>Strong MFA</div>
          <div className="text-right">Dormant</div>
        </div>
        {populations.map((population) => (
          <div key={population.id} className="grid items-center py-1.5" style={{ gridTemplateColumns: "1.2fr 90px 1fr 1fr 1fr 90px", columnGap: 16 }}>
            <div className="text-sm capitalize" style={{ color: C.ink }}>{population.identityType.replace(/-/g, " ")}</div>
            <div className="text-sm text-right tabular-nums" style={{ color: C.ink }}>{population.totalCount}</div>
            <CoverageBar pct={population.ssoCoveragePct} color={coverageColor(population.ssoCoveragePct)} />
            <CoverageBar pct={population.mfaCoveragePct} color={coverageColor(population.mfaCoveragePct)} />
            <CoverageBar pct={population.strongMfaCoveragePct} color={coverageColor(population.strongMfaCoveragePct)} />
            <div className="text-sm text-right tabular-nums" style={{ color: population.dormantCount > 0 ? C.red : C.muted }}>{population.dormantCount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

type AgenticIdentity = IdentityPosture["agenticIdentities"][number];

function AgenticIdentityCard({ agent }: { agent: AgenticIdentity }) {
  const [expanded, setExpanded] = useState(false);
  const autonomyLabel = agent.autonomyLevel === "recommend" ? "Recommend only" : agent.autonomyLevel === "approval-gated" ? "Approval gated" : "Autonomous";
  const credentialLabel = agent.credentialType.replace(/-/g, " ");
  const credentialDetail = agent.credentialType === "workload-identity" || agent.credentialType === "oidc-federation"
    ? "Short-lived federation"
    : agent.credentialAgeDays == null ? "age not recorded" : `${agent.credentialAgeDays}d since rotation`;

  return (
    <div className="rounded-lg" style={{ background: C.panel2, border: `1px solid ${agent.issues.length > 0 ? C.redBg : C.border}` }}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-start justify-between gap-2 p-4 text-left"
      >
        <div className="flex items-start gap-2 min-w-0">
          {expanded ? <ChevronDown size={14} className="shrink-0 mt-0.5" color={C.muted} /> : <ChevronRight size={14} className="shrink-0 mt-0.5" color={C.muted} />}
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>{agent.name}</div>
            <div className="text-[11px] mt-0.5 font-mono truncate" style={{ color: C.muted }}>{agent.servicePrincipal}</div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
          <CountBadge tone={agent.autonomyLevel === "autonomous" ? "attention" : agent.autonomyLevel === "approval-gated" ? "accent" : "good"}>{autonomyLabel}</CountBadge>
          {agent.privileged && <CountBadge tone="attention">{agent.privilegeLevel}</CountBadge>}
          {agent.issues.length > 0 && <CountBadge tone="attention">{agent.issues.length} issue{agent.issues.length === 1 ? "" : "s"}</CountBadge>}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="text-xs leading-relaxed mb-3" style={{ color: C.muted }}>{agent.purpose}</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
            <IdentificationField label="Owner" value={agent.owner?.name ?? "Unassigned"} />
            <IdentificationField label="Credential" value={<span className="capitalize">{credentialLabel} · {credentialDetail}</span>} />
            <IdentificationField label="Last Activity" value={agent.lastUsedAt ?? "None recorded"} />
            <IdentificationField label="Revocation" value={<span className="capitalize">{agent.revocationMechanism}</span>} />
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Tools & Resources</div>
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((tool) => <span key={tool} className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: C.accentBg, color: C.accent }}>{tool}</span>)}
              </div>
            </div>
          </div>
          {agent.issues.length > 0 ? (
            <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${C.border}` }}>
              {agent.issues.map((issue) => (
                <div key={issue.code} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" color={C.red} />
                  <div className="text-xs"><span className="font-semibold" style={{ color: C.red }}>{issue.label}</span><span className="ml-1.5" style={{ color: C.muted }}>{issue.detail}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-4 pt-3 text-xs" style={{ borderTop: `1px solid ${C.border}`, color: C.green }}><CheckCircle2 size={12} /> No derived identity issues.</div>
          )}
        </div>
      )}
    </div>
  );
}

export function SystemIdentity({ system, identity, exposure }: SystemIdentityProps) {
  const workforceTypes = new Set(["employee", "privileged", "contractor", "vendor"]);
  const nonHumanTypes = new Set(["service-account", "workload"]);
  const workforcePopulations = identity.populations.filter((population) => workforceTypes.has(population.identityType));
  const nonHumanPopulations = identity.populations.filter((population) => nonHumanTypes.has(population.identityType));
  const breakGlassPopulation = identity.populations.find((population) => population.identityType === "break-glass");
  const workforceLocalBypass = workforcePopulations.reduce((total, population) => total + population.localBypassCount, 0);
  const workforceDormant = workforcePopulations.reduce((total, population) => total + population.dormantCount, 0);
  const privilegedPopulation = workforcePopulations.find((population) => population.identityType === "privileged");
  const privilegedStrongMfaPct = privilegedPopulation?.strongMfaCoveragePct ?? null;
  const privilegedWithoutStrongMfa = privilegedPopulation ? privilegedPopulation.totalCount - privilegedPopulation.strongMfaCount : 0;
  const reviewCoveragePct = identity.review && identity.review.totalCount > 0
    ? Math.round((identity.review.reviewedCount / identity.review.totalCount) * 100)
    : null;
  const emergencyException = exposure.exceptions.find((exception) => exception.condition === "unmanaged-break-glass-access");

  return (
    <div className="px-4 lg:px-8 pb-10 space-y-8">
      <Panel>
        <SectionHeader
          icon={Fingerprint}
          title="Identity Posture"
          description="The workforce, lifecycle, privileged-access, and review signals most likely to require action."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          <IdentityMetric
            label="Privileged Strong MFA"
            value={privilegedStrongMfaPct == null ? "—" : `${privilegedStrongMfaPct}%`}
            detail={privilegedPopulation ? `${privilegedWithoutStrongMfa} of ${privilegedPopulation.totalCount} accounts not covered` : "No privileged population recorded"}
            tone={privilegedStrongMfaPct === 100 ? "good" : "attention"}
          />
          <IdentityMetric
            label="Workforce SSO Bypass"
            value={workforceLocalBypass}
            detail="Workforce accounts authenticating outside SSO"
            tone={workforceLocalBypass === 0 ? "good" : "attention"}
          />
          <IdentityMetric
            label="Dormant Workforce"
            value={workforceDormant}
            detail="Inactive human identities awaiting review"
            tone={workforceDormant === 0 ? "good" : "attention"}
          />
          <IdentityMetric
            label="Awaiting Termination"
            value={identity.totals.awaitingTermination}
            detail="Identities pending deprovisioning"
            tone={identity.totals.awaitingTermination === 0 ? "good" : "attention"}
          />
          <IdentityMetric
            label="Access Review"
            value={reviewCoveragePct == null ? "—" : `${reviewCoveragePct}%`}
            detail={identity.review ? `${identity.review.exceptionsOpen} open exception${identity.review.exceptionsOpen === 1 ? "" : "s"}` : "No access review recorded"}
            tone={reviewCoveragePct === 100 && (identity.review?.exceptionsOpen ?? 0) === 0 ? "good" : "attention"}
          />
          <IdentityMetric
            label="Agentic Identity Issues"
            value={identity.agenticSummary.withIssues}
            detail={`${identity.agenticSummary.total} registered agent${identity.agenticSummary.total === 1 ? "" : "s"}`}
            tone={identity.agenticSummary.withIssues === 0 ? "good" : "attention"}
          />
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          icon={Bot}
          title="Agentic Identities"
          description="Authenticated AI agents that can invoke tools, access resources, or take actions within this system."
          aside={<CountBadge tone={identity.agenticSummary.withIssues > 0 ? "attention" : "good"}>{identity.agenticSummary.total} registered</CountBadge>}
        />
        {identity.agenticIdentities.length > 0 ? (
          <>
            {(identity.agenticSummary.autonomous > 0 || identity.agenticSummary.longLivedCredentials > 0 || identity.agenticSummary.unowned > 0) && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {identity.agenticSummary.autonomous > 0 && <CountBadge tone="attention">{identity.agenticSummary.autonomous} autonomous</CountBadge>}
                {identity.agenticSummary.longLivedCredentials > 0 && <CountBadge tone="attention">{identity.agenticSummary.longLivedCredentials} long-lived credential{identity.agenticSummary.longLivedCredentials === 1 ? "" : "s"}</CountBadge>}
                {identity.agenticSummary.unowned > 0 && <CountBadge tone="attention">{identity.agenticSummary.unowned} unowned</CountBadge>}
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {identity.agenticIdentities.map((agent) => <AgenticIdentityCard key={agent.id} agent={agent} />)}
            </div>
          </>
        ) : (
          <div className="text-sm" style={{ color: C.muted }}>No agentic identities are registered for this system.</div>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          icon={Users2}
          title="Workforce Access"
          description="SSO, MFA, phishing-resistant MFA, and lifecycle coverage for human identities."
          aside={<CountBadge tone={workforceLocalBypass > 0 || workforceDormant > 0 ? "attention" : "good"}>{workforcePopulations.reduce((total, population) => total + population.totalCount, 0)} identities</CountBadge>}
        />
        {workforcePopulations.length > 0 ? (
          <WorkforceIdentityTable populations={workforcePopulations} />
        ) : (
          <div className="text-sm py-3" style={{ color: C.muted }}>No workforce identity population is tracked for this system.</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <IdentificationField label="Shared Accounts" value={identity.totals.shared} />
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Last Access Review</div>
            {identity.review ? (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: C.ink }}>{identity.review.reviewedAt} · {identity.review.reviewedCount}/{identity.review.totalCount}</span>
                <CadenceBadge cadence={identity.review.cadence} />
              </div>
            ) : <span className="text-sm" style={{ color: C.muted }}>None on record</span>}
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          icon={KeyRound}
          title="Non-Human Identities"
          description="Service and workload identities tracked separately from workforce authentication controls."
          aside={<CountBadge>{nonHumanPopulations.reduce((total, population) => total + population.totalCount, 0)} identities</CountBadge>}
        />
        {nonHumanPopulations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nonHumanPopulations.map((population) => (
              <div key={population.id} className="rounded-lg p-4" style={{ background: C.panel2 }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold capitalize" style={{ color: C.ink }}>{population.identityType.replace(/-/g, " ")}</span>
                  <span className="text-lg font-semibold tabular-nums" style={{ color: C.accent }}>{population.totalCount}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <IdentificationField label="Outside SSO" value={population.localBypassCount} />
                  <IdentificationField label="Shared" value={population.sharedCount} />
                  <IdentificationField label="Dormant" value={population.dormantCount} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: C.muted }}>No non-human identities are tracked for this system.</div>
        )}
        <div className="rounded-lg p-3 mt-3 text-xs leading-relaxed" style={{ background: C.accentBg, color: C.muted }}>
          Credential posture has not been assessed for these identities. Record credential type, key age, rotation, vaulting, privilege, ownership, and last use to evaluate long-lived access.
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          icon={ShieldAlert}
          title="Emergency Access"
          description="Break-glass identities reserved for recovery when normal workforce authentication is unavailable."
          aside={<CountBadge tone={emergencyException ? "accent" : breakGlassPopulation ? "attention" : "good"}>{breakGlassPopulation?.totalCount ?? 0} accounts</CountBadge>}
        />
        {breakGlassPopulation ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <IdentificationField label="Strong MFA" value={`${breakGlassPopulation.strongMfaCoveragePct ?? 0}%`} />
              <IdentificationField label="Outside SSO" value={breakGlassPopulation.localBypassCount} />
              <IdentificationField label="Shared" value={breakGlassPopulation.sharedCount} />
              <IdentificationField label="Dormant" value={breakGlassPopulation.dormantCount} />
            </div>
            {emergencyException && (
              <div className="rounded-lg p-3 mt-4" style={{ background: C.greenBg }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: C.green }}><CheckCircle2 size={13} /> Access exception reviewed and accepted</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    Approved by {emergencyException.approvedBy}{emergencyException.expiresAt ? ` · expires ${emergencyException.expiresAt}` : " · no expiration recorded"}
                  </div>
                </div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{emergencyException.reason}</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm" style={{ color: C.muted }}>No emergency-access identities are recorded for this system.</div>
        )}
      </Panel>

      <RolesResponsibilities system={system} />
    </div>
  );
}
