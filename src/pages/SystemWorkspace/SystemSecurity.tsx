import React from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  Crosshair,
  GitBranch,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { C } from "../../theme";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";
import type { ExposurePosture, SdlcPosture, VendorPosture } from "./types";

interface SystemSecurityProps {
  exposure: ExposurePosture;
  sdlc: SdlcPosture;
  vendors: VendorPosture;
}

interface SdlcSafeguard {
  label: string;
  enabled: boolean;
}

interface SdlcGroup {
  label: string;
  description: string;
  safeguards: SdlcSafeguard[];
}

function CardHeader({ icon, title, description, aside }: { icon: ReactNode; title: string; description: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5" style={{ color: C.accent }}>{icon}</span>
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{title}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{description}</div>
        </div>
      </div>
      {aside}
    </div>
  );
}

function CountBadge({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "good" | "attention" }) {
  const color = tone === "good" ? C.green : tone === "attention" ? C.red : C.accent;
  const background = tone === "good" ? C.greenBg : tone === "attention" ? C.redBg : C.accentBg;
  return <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ color, background }}>{children}</span>;
}

function SecurityMetric({ label, value, detail, tone = "accent" }: { label: string; value: ReactNode; detail: string; tone?: "accent" | "good" | "attention" }) {
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

export function SystemSecurity({ exposure, sdlc, vendors }: SystemSecurityProps) {
  const sdlcGroups: SdlcGroup[] = sdlc?.applicable ? [
    {
      label: "Source",
      description: "Repository and change controls",
      safeguards: [
        { label: "Branch Protection", enabled: sdlc.repoBranchProtection },
        { label: "PR Review Required", enabled: sdlc.prReviewRequired },
        { label: "Secret Scanning", enabled: sdlc.secretScanningEnabled },
      ],
    },
    {
      label: "Build & Test",
      description: "Automated security analysis",
      safeguards: [
        { label: "SAST", enabled: sdlc.sastEnabled },
        { label: "SCA", enabled: sdlc.scaEnabled },
        { label: "DAST", enabled: sdlc.dastEnabled },
        { label: "Container Scanning", enabled: sdlc.containerScanningEnabled },
        { label: "IaC Scanning", enabled: sdlc.iacScanningEnabled },
      ],
    },
    {
      label: "Release",
      description: "Deployment safeguards",
      safeguards: [
        { label: "CI/CD Identity Hardened", enabled: sdlc.cicdIdentityHardened },
        { label: "Deploy Approval Required", enabled: sdlc.deployApprovalRequired },
      ],
    },
  ] : [];
  const sdlcSafeguards = sdlcGroups.flatMap((group) => group.safeguards);
  const enabledSdlcCount = sdlcSafeguards.filter((safeguard) => safeguard.enabled).length;
  const missingSdlcCount = sdlcSafeguards.length - enabledSdlcCount;
  const internetFacingCount = exposure.externalServices.filter((service) => service.internetFacing).length;
  const servicesWithoutWaf = exposure.externalServices.filter((service) => service.internetFacing && !service.wafProtected).length;

  return (
    <div className="px-8 pb-10 space-y-5">
      <Panel>
        <CardHeader
          icon={<ShieldCheck size={16} />}
          title="Security Posture"
          description="The exposure, exception, and development signals most likely to require action."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SecurityMetric
            label="Externally Reachable"
            value={exposure.externallyReachableCount}
            detail={`${exposure.externalServices.length} service${exposure.externalServices.length === 1 ? "" : "s"} inventoried`}
            tone={exposure.externallyReachableCount === 0 ? "good" : "accent"}
          />
          <SecurityMetric
            label="Internet Services Without WAF"
            value={servicesWithoutWaf}
            detail={`${internetFacingCount} internet-facing service${internetFacingCount === 1 ? "" : "s"}`}
            tone={servicesWithoutWaf === 0 ? "good" : "attention"}
          />
          <SecurityMetric
            label="SDLC Safeguards"
            value={sdlc?.applicable ? `${enabledSdlcCount}/${sdlcSafeguards.length}` : "N/A"}
            detail={sdlc?.applicable ? `${missingSdlcCount} safeguard${missingSdlcCount === 1 ? "" : "s"} not enabled` : "Secure development is not applicable"}
            tone={!sdlc?.applicable || missingSdlcCount === 0 ? "good" : "attention"}
          />
          <SecurityMetric
            label="Exposure Exceptions"
            value={exposure.exceptions.length}
            detail={`${exposure.dangerousConditionsUnmitigated.length} dangerous condition${exposure.dangerousConditionsUnmitigated.length === 1 ? "" : "s"} unmitigated`}
            tone={exposure.dangerousConditionsUnmitigated.length > 0 ? "attention" : exposure.exceptions.length > 0 ? "accent" : "good"}
          />
        </div>
      </Panel>

      <Panel>
        <CardHeader
          icon={<Globe size={16} />}
          title="Exposure / Attack Surface"
          description="Public reachability, integration paths, administrative access, and approved exposure exceptions."
          aside={<CountBadge tone={exposure.dangerousConditionsUnmitigated.length > 0 ? "attention" : "accent"}>{exposure.externallyReachableCount} reachable</CountBadge>}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5 mb-5">
          <IdentificationField label="Internet-Facing Services" value={internetFacingCount} />
          <IdentificationField label="Externally Reachable" value={exposure.externallyReachableCount} />
          <IdentificationField label="Inbound Integrations" value={exposure.posture?.inboundIntegrationCount ?? "—"} />
          <IdentificationField label="Outbound Integrations" value={exposure.posture?.outboundIntegrationCount ?? "—"} />
          <IdentificationField label="Connected Vendors" value={vendors.vendors.length} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <IdentificationField label="Egress Posture" value={exposure.posture?.egressPosture.replace(/-/g, " ") ?? "—"} />
          <IdentificationField label="Admin Posture" value={exposure.posture?.adminPosture.replace(/-/g, " ") ?? "—"} />
          <IdentificationField label="API Posture" value={exposure.posture?.apiPosture.replace(/-/g, " ") ?? "—"} />
        </div>

        <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.muted }}>Service Exposure</div>
        <div className="divide-y" style={{ borderColor: C.border }}>
          {exposure.externalServices.map((service) => (
            <div key={service.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
                {service.kind === "admin-interface" ? <Crosshair size={13} color={C.muted} /> : <Globe size={13} color={C.muted} />}
                <span className="font-medium">{service.name}</span>
                <span className="text-xs" style={{ color: C.muted }}>{service.kind.replace(/-/g, " ")}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <CountBadge tone={service.internetFacing ? "attention" : "good"}>{service.internetFacing ? "Internet-facing" : "Private"}</CountBadge>
                <CountBadge tone={service.authRequired ? "good" : "attention"}>{service.authRequired ? "Auth required" : "No authentication"}</CountBadge>
                {service.internetFacing && <CountBadge tone={service.wafProtected ? "good" : "attention"}>{service.wafProtected ? "WAF protected" : "No WAF"}</CountBadge>}
              </div>
            </div>
          ))}
        </div>

        {exposure.dangerousConditionsUnmitigated.length > 0 && (
          <div className="rounded-lg p-3 mt-4 space-y-1.5" style={{ background: C.redBg }}>
            <div className="text-xs font-semibold" style={{ color: C.red }}>Unmitigated Conditions</div>
            {exposure.dangerousConditionsUnmitigated.map((condition) => (
              <div key={condition} className="flex items-center gap-2 text-sm" style={{ color: C.red }}><AlertTriangle size={13} /> {condition.replace(/-/g, " ")}</div>
            ))}
          </div>
        )}

        {exposure.exceptions.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.muted }}>Accepted Exceptions</div>
            <div className="space-y-2">
              {exposure.exceptions.map((exception) => (
                <div key={exception.id} className="rounded-lg p-3" style={{ background: C.greenBg }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium" style={{ color: C.green }}><CheckCircle2 size={13} /> {exception.condition.replace(/-/g, " ")} — accepted</div>
                    <div className="text-[11px]" style={{ color: C.muted }}>
                      Approved by {exception.approvedBy}{exception.expiresAt ? ` · expires ${exception.expiresAt}` : " · no expiration recorded"}
                    </div>
                  </div>
                  <div className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{exception.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <CardHeader
          icon={<GitBranch size={16} />}
          title="Secure Development"
          description="Preventive and detective safeguards applied from source control through production deployment."
          aside={sdlc?.applicable ? <CountBadge tone={missingSdlcCount === 0 ? "good" : "attention"}>{enabledSdlcCount} of {sdlcSafeguards.length} enabled</CountBadge> : <CountBadge>N/A</CountBadge>}
        />
        {sdlc?.applicable ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {sdlcGroups.map((group) => (
                <div key={group.label} className="rounded-lg p-3.5" style={{ background: C.panel2 }}>
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{group.label}</div>
                  <div className="text-[11px] mt-0.5 mb-3" style={{ color: C.muted }}>{group.description}</div>
                  <div className="space-y-2">
                    {group.safeguards.map((safeguard) => (
                      <div key={safeguard.label} className="flex items-center gap-2">
                        {safeguard.enabled ? <CheckCircle2 size={13} color={C.green} /> : <Circle size={13} color={C.red} />}
                        <span className="text-sm" style={{ color: safeguard.enabled ? C.ink : C.red }}>{safeguard.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <IdentificationField label="Last Threat Model" value={sdlc.lastThreatModelAt ?? "None on record"} />
            </div>
          </>
        ) : sdlc ? (
          <div className="text-sm p-4 rounded-lg" style={{ background: C.panel2, color: C.muted }}>Not applicable — {sdlc.notApplicableReason}</div>
        ) : (
          <div className="text-sm p-4 rounded-lg" style={{ background: C.panel2, color: C.muted }}>No secure-development posture is recorded for this system.</div>
        )}
      </Panel>

      <Panel>
        <CardHeader
          icon={<Building2 size={16} />}
          title="Physical / Environmental"
          description="How facility-level safeguards are provided for this system."
          aside={<CountBadge tone="good">Inherited</CountBadge>}
        />
        <div className="text-sm p-4 rounded-lg leading-relaxed" style={{ background: C.panel2, color: C.ink }}>
          Physical and environmental controls are inherited from the hosting provider&apos;s own certification. Testing&apos;s Vendor / Dependency Assurance section records the evidence supporting that inheritance. No ACME-operated facility is in scope for this system.
        </div>
      </Panel>
    </div>
  );
}
