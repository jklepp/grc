import React from "react";
import { Fingerprint, Globe, Bug, GitBranch, Building2, Crosshair, CheckCircle2, Circle, AlertTriangle, Users2 } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";
import { StatTile } from "./shared/StatTile";
import { CadenceBadge } from "./shared/CadenceBadge";
import { CoverageBar } from "./shared/CoverageBar";

// How can something access or attack this system? Identity, exposure,
// vulnerability, and secure-development posture, grouped as cards rather
// than numbered SSP sections.
export function SystemSecurity({ system, identity, exposure, vuln, sdlc, vendors }) {
  return (
    <div className="px-8 pb-10 space-y-8">
      <div>
        <SectionHeading icon={Fingerprint}>Identity & Access</SectionHeading>
        <Panel>
          <div className="grid overflow-x-auto">
            <div className="grid text-[11px] font-medium pb-2 mb-2" style={{ gridTemplateColumns: "1.2fr 90px 1fr 1fr 1fr 90px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
              <div>Identity Type</div>
              <div className="text-right">Total</div>
              <div>SSO</div>
              <div>MFA</div>
              <div>Strong MFA</div>
              <div className="text-right">Dormant</div>
            </div>
            {identity.populations.map((p) => (
              <div key={p.id} className="grid items-center py-1.5" style={{ gridTemplateColumns: "1.2fr 90px 1fr 1fr 1fr 90px" }}>
                <div className="text-sm capitalize" style={{ color: C.ink }}>{p.identityType.replace(/-/g, " ")}</div>
                <div className="text-sm text-right tabular-nums" style={{ color: C.ink }}>{p.totalCount}</div>
                <div><CoverageBar pct={p.ssoCoveragePct} color={C.accent} /></div>
                <div><CoverageBar pct={p.mfaCoveragePct} color={C.amber} /></div>
                <div><CoverageBar pct={p.strongMfaCoveragePct} color={C.green} /></div>
                <div className="text-sm text-right tabular-nums" style={{ color: p.dormantCount > 0 ? C.amber : C.muted }}>{p.dormantCount}</div>
              </div>
            ))}
            {identity.populations.length === 0 && <div className="text-sm py-4" style={{ color: C.muted }}>No identity population is tracked for this system.</div>}
          </div>
          <div className="grid grid-cols-4 gap-4 mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <IdentificationField label="Shared Accounts" value={identity.totals.shared} />
            <IdentificationField label="Local Accounts Bypassing SSO" value={identity.totals.localBypass} />
            <IdentificationField label="Accounts Awaiting Termination" value={identity.totals.awaitingTermination} />
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
      </div>

      <div>
        <SectionHeading icon={Globe}>Exposure / Attack Surface</SectionHeading>
        <Panel>
          <div className="grid grid-cols-5 gap-5 mb-5">
            <IdentificationField label="Internet-Facing Services" value={exposure.externalServices.filter((s) => s.internetFacing).length} />
            <IdentificationField label="Externally Reachable" value={exposure.externallyReachableCount} />
            <IdentificationField label="Inbound Integrations" value={exposure.posture?.inboundIntegrationCount ?? "—"} />
            <IdentificationField label="Outbound Integrations" value={exposure.posture?.outboundIntegrationCount ?? "—"} />
            <IdentificationField label="Connected Vendors" value={vendors.vendors.length} />
          </div>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <IdentificationField label="Egress Posture" value={exposure.posture?.egressPosture.replace(/-/g, " ") ?? "—"} />
            <IdentificationField label="Admin Posture" value={exposure.posture?.adminPosture.replace(/-/g, " ") ?? "—"} />
            <IdentificationField label="API Posture" value={exposure.posture?.apiPosture.replace(/-/g, " ") ?? "—"} />
          </div>
          <div className="space-y-1.5 mb-4">
            {exposure.externalServices.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
                {s.kind === "admin-interface" ? <Crosshair size={12} color={C.muted} /> : <Globe size={12} color={C.muted} />}
                {s.name}
                <span className="text-xs" style={{ color: C.muted }}>({s.kind.replace(/-/g, " ")}{s.internetFacing ? ", internet-facing" : ", private"})</span>
                {!s.wafProtected && s.internetFacing && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.amberBg, color: C.amber }}>No WAF</span>}
              </div>
            ))}
          </div>
          {exposure.dangerousConditionsUnmitigated.length > 0 && (
            <div className="space-y-1 mb-3">
              {exposure.dangerousConditionsUnmitigated.map((c) => (
                <div key={c} className="flex items-center gap-2 text-sm" style={{ color: C.red }}><AlertTriangle size={12} /> {c.replace(/-/g, " ")}</div>
              ))}
            </div>
          )}
          {exposure.exceptions.map((e) => (
            <div key={e.id} className="rounded-lg p-3 mt-2" style={{ background: C.greenBg }}>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: C.green }}><CheckCircle2 size={12} /> {e.condition.replace(/-/g, " ")} — accepted</div>
              <div className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{e.reason}</div>
            </div>
          ))}
        </Panel>
      </div>

      <div>
        <SectionHeading icon={Bug}>Vulnerability & Configuration</SectionHeading>
        <Panel>
          {vuln ? (
            <>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <StatTile label="Critical" value={vuln.criticalCount} color={vuln.criticalCount > 0 ? C.red : C.green} />
                <StatTile label="High" value={vuln.highCount} color={vuln.highCount > 0 ? C.amber : C.green} />
                <StatTile label="Past SLA" value={vuln.pastSlaCount} color={vuln.pastSlaCount > 0 ? C.red : C.green} />
                <StatTile label="Patch SLA Compliance" value={`${vuln.patchSlaCompliancePct}%`} />
              </div>
              <div className="grid grid-cols-3 gap-5">
                <IdentificationField label="Configuration Findings" value={vuln.configFindingCount} />
                <IdentificationField label="Unsupported Components" value={vuln.unsupportedComponentCount} />
                <IdentificationField label="Internet-Facing Critical" value={vuln.internetFacingCriticalCount} />
              </div>
              <div className="text-[11px] mt-3" style={{ color: C.muted }}>As of {vuln.asOf}</div>
            </>
          ) : <div className="text-sm" style={{ color: C.muted }}>No vulnerability scan on record.</div>}
        </Panel>
      </div>

      <div>
        <SectionHeading icon={GitBranch}>Secure Development</SectionHeading>
        {sdlc?.applicable ? (
          <Panel className="grid grid-cols-4 gap-4">
            {[
              ["Branch Protection", sdlc.repoBranchProtection], ["PR Review Required", sdlc.prReviewRequired],
              ["SAST", sdlc.sastEnabled], ["SCA", sdlc.scaEnabled],
              ["Secret Scanning", sdlc.secretScanningEnabled], ["IaC Scanning", sdlc.iacScanningEnabled],
              ["CI/CD Identity Hardened", sdlc.cicdIdentityHardened], ["Deploy Approval Required", sdlc.deployApprovalRequired],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center gap-2">
                {val ? <CheckCircle2 size={13} color={C.green} /> : <Circle size={13} color={C.red} />}
                <span className="text-sm" style={{ color: C.ink }}>{label}</span>
              </div>
            ))}
            <div className="col-span-4 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <IdentificationField label="Last Threat Model" value={sdlc.lastThreatModelAt ?? "None on record"} />
            </div>
          </Panel>
        ) : sdlc ? (
          <div className="text-sm p-4 rounded-lg" style={{ background: C.panel2, color: C.muted }}>Not applicable — {sdlc.notApplicableReason}</div>
        ) : null}
      </div>

      <div>
        <SectionHeading icon={Users2}>Roles & Responsibilities</SectionHeading>
        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {system.roles.map((r, i) => (
            <div
              key={i}
              className="grid px-4 py-3"
              style={{ gridTemplateColumns: "220px 1fr", borderTop: i > 0 ? `1px solid ${C.border}` : "none", background: i % 2 ? "transparent" : C.panel2 }}
            >
              <div className="text-sm font-semibold" style={{ color: C.ink }}>{r.role}</div>
              <div className="text-sm" style={{ color: C.muted }}>{r.assignment}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading icon={Building2}>Physical / Environmental</SectionHeading>
        <div className="text-sm p-4 rounded-lg" style={{ background: C.panel2, color: C.ink }}>
          Physical and environmental controls are inherited from the hosting provider's own certification —
          see Testing's Vendor / Dependency Assurance section for what backs that claim. No ACME-operated facility is in scope for this system.
        </div>
      </div>
    </div>
  );
}
