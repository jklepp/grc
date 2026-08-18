import React from "react";
import { Crosshair, Bug, Siren, LifeBuoy, Handshake, CheckCircle2, AlertTriangle } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";
import { StatTile } from "./shared/StatTile";
import { CadenceBadge } from "./shared/CadenceBadge";
import { POAMRow } from "./shared/POAMRow";
import type {
  IncidentResponsePosture, ResiliencePosture, SecurityTestingPosture,
  VendorPosture, VulnerabilityPosture,
} from "./types";

// Do we know that the protections actually work? Implemented vs tested vs
// proven effective — penetration testing, vulnerability scanning, IR
// exercises, resilience testing, and vendor assurance, grouped as cards.
interface SystemTestingProps {
  secTests: SecurityTestingPosture;
  vuln: VulnerabilityPosture;
  ir: IncidentResponsePosture;
  resilience: ResiliencePosture;
  vendors: VendorPosture;
}

export function SystemTesting({ secTests, vuln, ir, resilience, vendors }: SystemTestingProps) {
  const lastTabletop = ir.lastTabletop;
  return (
    <div className="px-8 pb-10 space-y-8">
      <div>
        <SectionHeading icon={Crosshair}>Security Testing</SectionHeading>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {(["penetration-test", "red-team"] as const).map((type) => {
            const latest = secTests.latestByType[type];
            return (
              <Panel key={type}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{type === "penetration-test" ? "External Penetration Test" : "Red Team"}</div>
                  {latest && <CadenceBadge cadence={latest.cadence} />}
                </div>
                {latest ? (
                  <div className="space-y-1.5 text-sm" style={{ color: C.ink }}>
                    <div>Last completed <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{latest.completedAt}</span> · {latest.vendor}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{latest.scope}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span style={{ color: latest.criticalFindingCount > 0 ? C.red : C.muted }}>Critical: {latest.criticalFindingCount}</span>
                      <span style={{ color: latest.highFindingCount > 0 ? C.amber : C.muted }}>High: {latest.highFindingCount}</span>
                      {type === "red-team" && latest.objectiveAchieved !== undefined && (
                        <span style={{ color: latest.objectiveAchieved ? C.green : C.red }}>Objective {latest.objectiveAchieved ? "achieved" : "not achieved"}</span>
                      )}
                    </div>
                  </div>
                ) : <div className="text-sm" style={{ color: C.muted }}>Never conducted.</div>}
              </Panel>
            );
          })}
        </div>
        {secTests.openFindings.length > 0 && (
          <div>
            <div className="text-xs mb-2" style={{ color: C.muted }}>Open findings from these exercises:</div>
            {secTests.openFindings.map((f) => <POAMRow key={f.id} item={f} />)}
          </div>
        )}
      </div>

      <div>
        <SectionHeading icon={Bug}>Vulnerability Scanning</SectionHeading>
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
        <SectionHeading icon={Siren}>Incident Response</SectionHeading>
        <div className="grid grid-cols-2 gap-4">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: C.ink }}>IR Plan</div>
              {ir.planCurrency && <CadenceBadge cadence={ir.planCurrency.cadence} />}
            </div>
            <div className="text-sm" style={{ color: C.ink }}>{ir.planCurrency ? `Last reviewed ${ir.planCurrency.lastReviewedAt}` : "No plan on record"}</div>
            <div className="text-sm mt-3 pt-3" style={{ color: C.ink, borderTop: `1px solid ${C.border}` }}>Last production incident</div>
            <div className="text-sm" style={{ color: C.muted }}>
              {ir.lastIncident ? `${ir.lastIncident.occurredAt} · ${ir.lastIncident.severity} · lessons learned ${ir.lastIncident.lessonsLearnedComplete ? "complete" : "outstanding"}` : "None on record"}
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: C.ink }}>Last Tabletop</div>
              {lastTabletop && <CadenceBadge cadence={lastTabletop.cadence} />}
            </div>
            {lastTabletop ? (
              <div className="space-y-1.5 text-sm" style={{ color: C.ink }}>
                <div>{lastTabletop.conductedAt} · {lastTabletop.scenario}</div>
                <div className="text-xs" style={{ color: C.muted }}>{lastTabletop.scope === "program" ? "Program-wide exercise" : "System-specific exercise"}</div>
                <div style={{ color: C.muted }}>Issues identified: {lastTabletop.issuesIdentified}</div>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {lastTabletop.participatingFunctions.map((f) => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.greenBg, color: C.green }}><CheckCircle2 size={9} className="inline mr-1" />{f.replace(/-/g, " ")}</span>
                  ))}
                  {(["legal", "customer-comms"] as const).filter((f) => !lastTabletop.participatingFunctions.includes(f)).map((f) => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.amberBg, color: C.amber }}><AlertTriangle size={9} className="inline mr-1" />{f.replace(/-/g, " ")} not exercised</span>
                  ))}
                </div>
              </div>
            ) : <div className="text-sm" style={{ color: C.muted }}>No tabletop on record.</div>}
          </Panel>
        </div>
        {ir.openFindings.length > 0 && (
          <div className="mt-4">
            <div className="text-xs mb-2" style={{ color: C.muted }}>Open items from tabletop exercises:</div>
            {ir.openFindings.map((f) => <POAMRow key={f.id} item={f} />)}
          </div>
        )}
      </div>

      <div>
        <SectionHeading icon={LifeBuoy}>Resilience / Backup / Recovery</SectionHeading>
        <div className="grid grid-cols-2 gap-4">
          <Panel>
            <div className="text-sm font-semibold mb-3" style={{ color: C.ink }}>Backup Configuration</div>
            {resilience.backup ? (
              <div className="grid grid-cols-2 gap-4">
                <IdentificationField label="Enabled" value={resilience.backup.enabled ? "Yes" : "No"} />
                <IdentificationField label="Coverage" value={`${resilience.backup.coveragePct}%`} />
                <IdentificationField label="Immutable" value={resilience.backup.immutable ? "Yes" : "No"} />
                <IdentificationField label="Cross-Region" value={resilience.backup.crossRegion ? "Yes" : "No"} />
                <IdentificationField label="RPO Target" value={`${resilience.backup.rpoTargetMinutes}m`} />
                <IdentificationField label="RTO Target" value={`${resilience.backup.rtoTargetMinutes}m`} />
              </div>
            ) : <div className="text-sm" style={{ color: C.muted }}>No backup configuration on record.</div>}
          </Panel>
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: C.ink }}>Last Recovery Test</div>
              {resilience.lastDrTest && <CadenceBadge cadence={resilience.lastDrTest.cadence} />}
            </div>
            {resilience.lastDrTest ? (
              <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: C.ink }}>
                <IdentificationField label="Date" value={resilience.lastDrTest.conductedAt} />
                <IdentificationField label="Restore Successful" value={resilience.lastDrTest.restoreSuccessful ? "Yes" : "No"} />
                <IdentificationField label="Actual RPO" value={`${resilience.lastDrTest.actualRpoMinutes}m`} />
                <IdentificationField label="Actual RTO" value={`${resilience.lastDrTest.actualRtoMinutes}m`} />
                <div className="col-span-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: resilience.targetsMetLastTest ? C.greenBg : C.redBg, color: resilience.targetsMetLastTest ? C.green : C.red }}>
                    Targets {resilience.targetsMetLastTest ? "met" : "not met"}
                  </span>
                </div>
                {resilience.lastDrTest.issues && <div className="col-span-2 text-xs" style={{ color: C.amber }}>{resilience.lastDrTest.issues}</div>}
              </div>
            ) : <div className="text-sm" style={{ color: C.muted }}>No recovery test on record.</div>}
          </Panel>
        </div>
      </div>

      <div>
        <SectionHeading icon={Handshake}>Vendor / Dependency Assurance</SectionHeading>
        <div className="space-y-3">
          {vendors.vendors.map((v) => (
            <Panel key={v.vendorId}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{v.vendor?.name ?? v.vendorId}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{v.dependency}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: C.panel2, color: C.muted }}>{v.criticality}</span>
                  {v.assurance && <CadenceBadge cadence={v.assurance.cadence} />}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: C.muted }}>
                <span>Reassessed: {v.assurance?.reassessedAt ?? "never"}</span>
                <span style={{ color: v.assurance?.sharedResponsibilityReviewed ? C.green : C.amber }}>
                  Shared responsibility {v.assurance?.sharedResponsibilityReviewed ? "reviewed" : "not reviewed"}
                </span>
                {v.assurance?.certification && <span>Backed by {v.assurance.certification.id}</span>}
                {v.dataAccessible.length > 0 && <span>Data: {v.dataAccessible.length} type{v.dataAccessible.length !== 1 ? "s" : ""} accessible</span>}
              </div>
            </Panel>
          ))}
          {vendors.vendors.length === 0 && <div className="text-sm" style={{ color: C.muted }}>No dependencies registered for this system.</div>}
        </div>
      </div>
    </div>
  );
}
