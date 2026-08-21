import React from "react";
import {
  Crosshair, Bug, Siren, LifeBuoy, Handshake, CheckCircle2, AlertTriangle,
  Activity, CalendarClock, ChevronRight, ClipboardList, ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../theme";
import { SectionHeader } from "./shared/SectionHeader";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";
import { StatTile } from "./shared/StatTile";
import { CadenceBadge } from "./shared/CadenceBadge";
import { POAMRow } from "./shared/POAMRow";
import { RecentSystemActivity } from "./overview/RecentSystemActivity";
import type {
  IdentityPosture, IncidentResponsePosture, ResiliencePosture, SecurityTestingPosture,
  VendorPosture, VulnerabilityPosture,
} from "./types";
import type { CadenceStatus } from "../../engine/assurance";

const TESTING_SECTIONS = [
  { id: "security-testing", label: "Security Testing", icon: Crosshair },
  { id: "vulnerability-scanning", label: "Vulnerabilities", icon: Bug },
  { id: "incident-response", label: "Incident Response", icon: Siren },
  { id: "resilience-testing", label: "Resilience", icon: LifeBuoy },
  { id: "vendor-assurance", label: "Vendor Assurance", icon: Handshake },
] as const;

type TestingSectionId = (typeof TESTING_SECTIONS)[number]["id"];
type AttentionSeverity = "critical" | "warning" | "info";

interface TestingAttentionItem {
  id: string;
  title: string;
  detail: string;
  sectionId: TestingSectionId;
  severity: AttentionSeverity;
  type: "Finding" | "Vulnerability" | "Cadence" | "Coverage" | "Recovery" | "Vendor";
  status: string;
}

const ATTENTION_META: Record<AttentionSeverity, { color: string; background: string }> = {
  critical: { color: C.red, background: C.redBg },
  warning: { color: C.amber, background: C.amberBg },
  info: { color: C.accent, background: C.accentBg },
};

function scrollToTestingSection(sectionId: TestingSectionId): void {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cadenceLabel(cadence: CadenceStatus | null | undefined): string {
  if (!cadence?.lastAt) return "Missing";
  if (cadence.overdue) return "Overdue";
  return `Due in ${cadence.daysUntilDue ?? 0}d`;
}

function TestingMetric({ icon: Icon, label, value, detail, color = C.ink }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.muted }}>
        <Icon size={13} /> {label}
      </div>
      <div className="text-2xl font-semibold mt-2" style={{ color, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{detail}</div>
    </div>
  );
}

function RecoveryComparison({ label, actual, target }: { label: string; actual: number; target: number }) {
  const met = actual <= target;
  const fill = Math.min(100, target > 0 ? (actual / target) * 100 : 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5">
        <span className="font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{label}</span>
        <span style={{ color: met ? C.green : C.red }}><b>{actual}m</b> / {target}m target</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
        <div className="h-full rounded-full" style={{ width: `${fill}%`, background: met ? C.green : C.red }} />
      </div>
    </div>
  );
}

// Do we know that the protections actually work? Implemented vs tested vs
// proven effective — penetration testing, vulnerability scanning, IR
// exercises, resilience testing, and vendor assurance, grouped as cards.
interface SystemTestingProps {
  secTests: SecurityTestingPosture;
  vuln: VulnerabilityPosture;
  ir: IncidentResponsePosture;
  resilience: ResiliencePosture;
  vendors: VendorPosture;
  identity: IdentityPosture;
}

export function SystemTesting({ secTests, vuln, ir, resilience, vendors, identity }: SystemTestingProps) {
  const lastTabletop = ir.lastTabletop;
  const missingTabletopFunctions = lastTabletop
    ? (["legal", "customer-comms"] as const).filter((participatingFunction) => !lastTabletop.participatingFunctions.includes(participatingFunction))
    : [];
  const openFindingCount = secTests.openFindings.length + ir.openFindings.length;
  const cadenceEntries: Array<{
    id: string;
    label: string;
    sectionId: TestingSectionId;
    cadence: CadenceStatus | null | undefined;
  }> = [
    { id: "penetration-test", label: "External penetration test", sectionId: "security-testing", cadence: secTests.latestByType["penetration-test"]?.cadence },
    { id: "red-team", label: "Red team exercise", sectionId: "security-testing", cadence: secTests.latestByType["red-team"]?.cadence },
    { id: "ir-plan", label: "Incident response plan review", sectionId: "incident-response", cadence: ir.planCurrency?.cadence },
    { id: "tabletop", label: "Incident response tabletop", sectionId: "incident-response", cadence: lastTabletop?.cadence },
    { id: "recovery", label: "Recovery test", sectionId: "resilience-testing", cadence: resilience.lastDrTest?.cadence },
    ...vendors.vendors.map((vendor) => ({
      id: `vendor-${vendor.vendorId}`,
      label: `${vendor.vendor?.name ?? vendor.vendorId} reassessment`,
      sectionId: "vendor-assurance" as const,
      cadence: vendor.assurance?.cadence,
    })),
  ];
  const overdueOrMissingCount = cadenceEntries.filter(({ cadence }) => !cadence?.lastAt || cadence.overdue).length;
  const dueSoonCount = cadenceEntries.filter(({ cadence }) => (
    Boolean(cadence?.lastAt)
    && !cadence?.overdue
    && cadence?.daysUntilDue !== null
    && cadence?.daysUntilDue !== undefined
    && cadence.daysUntilDue >= 0
    && cadence.daysUntilDue <= 30
  )).length;
  const attentionItems: TestingAttentionItem[] = [];

  cadenceEntries.forEach(({ id, label, sectionId, cadence }) => {
    if (!cadence?.lastAt) {
      attentionItems.push({ id: `cadence-${id}`, title: `${label} is not on record`, detail: "Complete the activity or record the latest result to establish testing currency.", sectionId, severity: "critical", type: "Cadence", status: "Missing" });
    } else if (cadence.overdue) {
      attentionItems.push({ id: `cadence-${id}`, title: `${label} is overdue`, detail: cadence.dueAt ? `The recorded due date was ${cadence.dueAt}.` : "The expected testing cadence has elapsed.", sectionId, severity: "critical", type: "Cadence", status: "Overdue" });
    } else if (cadence.daysUntilDue !== null && cadence.daysUntilDue !== undefined && cadence.daysUntilDue <= 30) {
      attentionItems.push({ id: `cadence-${id}`, title: `${label} is due soon`, detail: cadence.dueAt ? `Next due ${cadence.dueAt}.` : "The next activity is due within 30 days.", sectionId, severity: "warning", type: "Cadence", status: cadenceLabel(cadence) });
    }
  });

  if (!vuln) {
    attentionItems.push({ id: "vulnerability-missing", title: "Vulnerability scan is not on record", detail: "Add a current scan snapshot to establish vulnerability posture.", sectionId: "vulnerability-scanning", severity: "critical", type: "Vulnerability", status: "Missing" });
  } else {
    const severeVulnerabilityCount = vuln.criticalCount + vuln.highCount;
    if (severeVulnerabilityCount > 0) {
      attentionItems.push({ id: "vulnerability-severe", title: `${severeVulnerabilityCount} critical or high vulnerabilit${severeVulnerabilityCount === 1 ? "y" : "ies"}`, detail: `${vuln.criticalCount} critical and ${vuln.highCount} high as of ${vuln.asOf}.`, sectionId: "vulnerability-scanning", severity: vuln.criticalCount > 0 ? "critical" : "warning", type: "Vulnerability", status: "Open" });
    }
    if (vuln.pastSlaCount > 0) {
      attentionItems.push({ id: "vulnerability-sla", title: `${vuln.pastSlaCount} vulnerabilit${vuln.pastSlaCount === 1 ? "y is" : "ies are"} past SLA`, detail: `Patch SLA compliance is ${vuln.patchSlaCompliancePct}%.`, sectionId: "vulnerability-scanning", severity: "critical", type: "Vulnerability", status: "Past SLA" });
    }
  }

  if (openFindingCount > 0) {
    attentionItems.push({ id: "open-findings", title: `${openFindingCount} testing finding${openFindingCount === 1 ? "" : "s"} require remediation`, detail: `${secTests.openFindings.length} from security testing and ${ir.openFindings.length} from incident response exercises.`, sectionId: secTests.openFindings.length > 0 ? "security-testing" : "incident-response", severity: "warning", type: "Finding", status: "Open" });
  }
  if (missingTabletopFunctions.length > 0) {
    attentionItems.push({ id: "tabletop-coverage", title: `${missingTabletopFunctions.length} response function${missingTabletopFunctions.length === 1 ? " was" : "s were"} not exercised`, detail: missingTabletopFunctions.map((item) => item.replace(/-/g, " ")).join(", "), sectionId: "incident-response", severity: "warning", type: "Coverage", status: "Gap" });
  }
  if (!resilience.backup) {
    attentionItems.push({ id: "backup-missing", title: "Backup configuration is not on record", detail: "Record backup coverage and recovery objectives for this system.", sectionId: "resilience-testing", severity: "critical", type: "Recovery", status: "Missing" });
  } else if (!resilience.backup.enabled || resilience.backup.coveragePct < 100) {
    attentionItems.push({ id: "backup-coverage", title: resilience.backup.enabled ? `Backup coverage is ${resilience.backup.coveragePct}%` : "Backups are disabled", detail: "Review whether all in-scope assets and data are covered by the backup configuration.", sectionId: "resilience-testing", severity: resilience.backup.enabled ? "warning" : "critical", type: "Coverage", status: "Gap" });
  }
  if (resilience.lastDrTest && !resilience.targetsMetLastTest) {
    attentionItems.push({ id: "recovery-targets", title: "The latest recovery test missed its objectives", detail: "Review the actual recovery results against the system's RPO and RTO targets.", sectionId: "resilience-testing", severity: "critical", type: "Recovery", status: "Target missed" });
  }
  vendors.vendors.filter((vendor) => vendor.assurance && !vendor.assurance.sharedResponsibilityReviewed).forEach((vendor) => {
    attentionItems.push({ id: `vendor-responsibility-${vendor.vendorId}`, title: `${vendor.vendor?.name ?? vendor.vendorId} shared responsibility is not reviewed`, detail: `Confirm control ownership for the ${vendor.dependency} dependency.`, sectionId: "vendor-assurance", severity: "warning", type: "Vendor", status: "Review needed" });
  });

  const severityRank: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  attentionItems.sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);
  const criticalAttentionCount = attentionItems.filter((item) => item.severity === "critical").length;
  const actionColor = criticalAttentionCount > 0 ? C.red : attentionItems.length > 0 ? C.amber : C.green;

  return (
    <div className="px-8 pb-10 space-y-8">
      <div>
        <SectionHeader
          icon={Activity}
          title="Testing Posture"
          description="Cadence, findings, vulnerability, recovery, incident-response, and vendor-assurance signals requiring action."
        />
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
          <TestingMetric icon={ShieldAlert} label="Action items" value={attentionItems.length} detail={criticalAttentionCount > 0 ? `${criticalAttentionCount} critical` : "No critical items"} color={actionColor} />
          <TestingMetric icon={CalendarClock} label="Overdue / missing" value={overdueOrMissingCount} detail="Cadence-based activities" color={overdueOrMissingCount > 0 ? C.red : C.green} />
          <TestingMetric icon={CalendarClock} label="Due next 30 days" value={dueSoonCount} detail="Upcoming activities" color={dueSoonCount > 0 ? C.amber : C.green} />
          <TestingMetric icon={ClipboardList} label="Open findings" value={openFindingCount} detail="Test and exercise findings" color={openFindingCount > 0 ? C.amber : C.green} />
          <TestingMetric icon={Bug} label="Patch SLA" value={vuln ? `${vuln.patchSlaCompliancePct}%` : "—"} detail={vuln ? `Snapshot ${vuln.asOf}` : "No scan on record"} color={!vuln ? C.muted : vuln.patchSlaCompliancePct >= 95 ? C.green : vuln.patchSlaCompliancePct >= 90 ? C.amber : C.red} />
        </div>
        <div className="flex gap-2 flex-wrap mb-4" aria-label="Testing section navigation">
          {TESTING_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => scrollToTestingSection(id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <Panel>
          <SectionHeader
            icon={ClipboardList}
            title="Testing Actions"
            description="Findings and other actions derived from recorded cadence, coverage, vulnerabilities, and test results."
            aside={<span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ color: actionColor, background: criticalAttentionCount > 0 ? C.redBg : attentionItems.length > 0 ? C.amberBg : C.greenBg }}>{attentionItems.length} item{attentionItems.length === 1 ? "" : "s"}</span>}
          />
          {attentionItems.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: C.greenBg, color: C.green }}><CheckCircle2 size={16} /> No testing posture items currently need attention.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: C.border }}>
              {attentionItems.map((item) => {
                const meta = ATTENTION_META[item.severity];
                const AttentionIcon = item.severity === "critical" ? ShieldAlert : AlertTriangle;
                return (
                  <div key={item.id} className="flex flex-wrap lg:flex-nowrap items-center gap-3 py-3 first:pt-0 last:pb-0" style={{ borderColor: C.border }}>
                    <div className="rounded-lg p-2 shrink-0" style={{ background: meta.background, color: meta.color }}><AttentionIcon size={15} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded" style={{ background: C.panel2, color: C.muted }}>{item.type}</span>
                        <span className="text-sm font-semibold" style={{ color: C.ink }}>{item.title}</span>
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded" style={{ background: meta.background, color: meta.color }}>{item.status}</span>
                      </div>
                    </div>
                    <div className="hidden lg:block w-[34%] text-xs leading-relaxed text-right" style={{ color: C.muted }}>{item.detail}</div>
                    <button type="button" onClick={() => scrollToTestingSection(item.sectionId)} className="inline-flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: C.accent }} aria-label={`Review ${item.title}`}>Review <ChevronRight size={14} /></button>
                    <div className="lg:hidden basis-full pl-11 text-xs leading-relaxed" style={{ color: C.muted }}>{item.detail}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div id="security-testing" style={{ scrollMarginTop: 24 }}>
        <SectionHeader
          icon={Crosshair}
          title="Security Testing"
          description="The latest independent penetration test and adversarial red-team exercise results."
        />
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

      <div id="vulnerability-scanning" style={{ scrollMarginTop: 24 }}>
        <SectionHeader
          icon={Bug}
          title="Vulnerability Scanning"
          description="Current vulnerability volume, patch-SLA performance, and internet-facing exposure."
        />
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

      <div id="incident-response" style={{ scrollMarginTop: 24 }}>
        <SectionHeader
          icon={Siren}
          title="Incident Response"
          description="Plan currency, production incidents, tabletop coverage, and resulting response actions."
        />
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
                  {missingTabletopFunctions.map((f) => (
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

      <div id="resilience-testing" style={{ scrollMarginTop: 24 }}>
        <SectionHeader
          icon={LifeBuoy}
          title="Resilience / Backup / Recovery"
          description="Backup configuration and the recovery exercises that prove the system can meet its objectives."
        />
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
                {resilience.backup ? (
                  <div className="col-span-2 space-y-3 pt-1">
                    <RecoveryComparison label="Recovery point (RPO)" actual={resilience.lastDrTest.actualRpoMinutes} target={resilience.backup.rpoTargetMinutes} />
                    <RecoveryComparison label="Recovery time (RTO)" actual={resilience.lastDrTest.actualRtoMinutes} target={resilience.backup.rtoTargetMinutes} />
                  </div>
                ) : (
                  <>
                    <IdentificationField label="Actual RPO" value={`${resilience.lastDrTest.actualRpoMinutes}m`} />
                    <IdentificationField label="Actual RTO" value={`${resilience.lastDrTest.actualRtoMinutes}m`} />
                  </>
                )}
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

      <div id="vendor-assurance" style={{ scrollMarginTop: 24 }}>
        <SectionHeader
          icon={Handshake}
          title="Vendor / Dependency Assurance"
          description="Critical external dependencies, reassessment cadence, certifications, and shared-responsibility coverage."
        />
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

      <RecentSystemActivity identity={identity} resilience={resilience} secTests={secTests} ir={ir} vendors={vendors} />
    </div>
  );
}
