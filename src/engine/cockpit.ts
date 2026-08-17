// The System Register's top summary strip: the hero numbers plus two
// enumerated lists — what needs attention, and what's actually been proven
// to work. Built last, after every domain module below it exists, because
// composing them is all this file does.
//
// The two lists are a judgment call about what matters, the same kind of
// call taxonomy.ts's DOMAIN_ASSURANCE_CATEGORY map already makes — written
// once, here, rather than re-derived per page section.
import type { Graph } from "../graph/types";
import type { RollupsApi } from "./rollups";
import type { ProfileApi } from "./profile";
import type { RiskApi } from "./risk";
import type { FindingsApi } from "./findings";
import type { IdentityApi } from "./identity";
import type { ExposureApi } from "./exposure";
import type { SecurityTestingApi } from "./securityTesting";
import type { ResilienceApi } from "./resilience";
import type { IncidentResponseApi } from "./incidentResponse";
import type { VendorsApi } from "./vendors";
import type { SystemId } from "../graph/ids";

export interface CockpitItem {
  domain: string;
  label: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

export function createCockpit(
  graph: Graph,
  rollups: RollupsApi,
  profile: ProfileApi,
  risk: RiskApi,
  findings: FindingsApi,
  identity: IdentityApi,
  exposure: ExposureApi,
  securityTesting: SecurityTestingApi,
  resilience: ResilienceApi,
  incidentResponse: IncidentResponseApi,
  vendors: VendorsApi
) {
  function cockpitSummary(systemId: SystemId) {
    const system = rollups.systemRollupById[systemId];
    const summary = profile.profileSummary(systemId);
    const topRisks = risk.topRisksForSystem(systemId, 5);
    const openHighSeverity = findings
      .findingsForSystem(systemId)
      .filter((f) => (f.severity === "critical" || f.severity === "high") && ["open", "accepted", "remediating"].includes(f.status));

    const idPosture = identity.identityPostureForSystem(systemId);
    const exp = exposure.exposureForSystem(systemId);
    const secTests = securityTesting.securityTestsForSystem(systemId);
    const resil = resilience.resilienceForSystem(systemId);
    const ir = incidentResponse.irForSystem(systemId);
    const vendorPosture = vendors.vendorsForSystem(systemId);
    const vulns = graph.vulnSnapshotBySystem[systemId] ?? null;

    const attentionRequired: CockpitItem[] = [];
    const positiveAssurance: CockpitItem[] = [];

    // ---- Attention required ---------------------------------------------------
    (["penetration-test", "red-team"] as const).forEach((type) => {
      const latest = secTests.latestByType[type];
      const label = type === "penetration-test" ? "Penetration test" : "Red team exercise";
      if (!latest) {
        attentionRequired.push({ domain: "Security Testing", label: `${label} never conducted`, detail: "No exercise of this type is on record.", severity: "high" });
      } else if (latest.cadence.overdue) {
        attentionRequired.push({ domain: "Security Testing", label: `${label} overdue`, detail: `Last completed ${latest.completedAt}, due every ${latest.cadenceDays} days.`, severity: "high" });
      }
    });

    if (resil.overdue) {
      attentionRequired.push({
        domain: "Resilience",
        label: "Recovery exercise overdue",
        detail: resil.lastDrTest ? `Last conducted ${resil.lastDrTest.conductedAt}.` : "No DR test is on record for this system.",
        severity: "high",
      });
    }

    if (ir.tabletopOverdue) {
      attentionRequired.push({
        domain: "Incident Response",
        label: "IR tabletop overdue",
        detail: ir.lastTabletop ? `Last conducted ${ir.lastTabletop.conductedAt}.` : "No tabletop is on record for this system or the program.",
        severity: "medium",
      });
    }
    if (ir.planReviewOverdue) {
      attentionRequired.push({ domain: "Incident Response", label: "IR plan review overdue", detail: "The governing IR plan hasn't been reviewed within its cadence.", severity: "medium" });
    }

    if (vendorPosture.anyOverdue) {
      vendorPosture.vendors.filter((v) => !v.assurance || v.assurance.cadence.overdue).forEach((v) => {
        attentionRequired.push({ domain: "Vendor Assurance", label: `${v.vendor?.name ?? v.vendorId} assurance stale`, detail: v.assurance ? `Last reassessed ${v.assurance.reassessedAt}.` : "No assurance record on file.", severity: "high" });
      });
    }

    if (!idPosture.review || idPosture.review.cadence.overdue) {
      attentionRequired.push({ domain: "Identity & Access", label: "Access review overdue", detail: idPosture.review ? `Last completed ${idPosture.review.reviewedAt}.` : "No access review is on record.", severity: "high" });
    }
    const privilegedGaps = idPosture.populations.filter((p) => (p.identityType === "privileged" || p.identityType === "break-glass") && p.strongMfaCount < p.totalCount);
    privilegedGaps.forEach((p) => {
      attentionRequired.push({ domain: "Identity & Access", label: `${p.totalCount - p.strongMfaCount} ${p.identityType} accounts without phishing-resistant MFA`, detail: `${p.strongMfaCount} of ${p.totalCount} carry strong MFA.`, severity: "critical" });
    });

    openHighSeverity.forEach((f) => {
      attentionRequired.push({ domain: "Findings", label: f.title, detail: `${f.severity === "critical" ? "Critical" : "High"} · source: ${f.source ?? "control-gap"} · owner ${f.ownerName}`, severity: (f.severity as "critical" | "high") ?? "high" });
    });

    if (vulns && (vulns.pastSlaCount > 0 || vulns.internetFacingCriticalCount > 0)) {
      attentionRequired.push({ domain: "Vulnerability", label: `${vulns.pastSlaCount} vulnerabilities past remediation SLA`, detail: `${vulns.internetFacingCriticalCount} of them internet-facing and critical.`, severity: vulns.internetFacingCriticalCount > 0 ? "critical" : "high" });
    }

    exp.dangerousConditionsUnmitigated.forEach((c) => {
      attentionRequired.push({ domain: "Exposure", label: c.replace(/-/g, " "), detail: "No exception excuses this condition.", severity: "high" });
    });

    if (summary && !summary.clears) {
      attentionRequired.push({ domain: "Control Assurance", label: "Below tier target", detail: `Assurance ${summary.actual ?? "—"} vs. target ${summary.target ?? "—"}.`, severity: "medium" });
    }

    topRisks.filter((r) => r.appetiteRatio > 1).forEach((r) => {
      attentionRequired.push({ domain: "Risk", label: r.scenario, detail: `Residual ${r.residualScore} exceeds appetite ${r.appetite} (${r.appetiteRatio}x).`, severity: "medium" });
    });

    // ---- Positive assurance -----------------------------------------------
    (["penetration-test", "red-team"] as const).forEach((type) => {
      const latest = secTests.latestByType[type];
      if (latest && !latest.cadence.overdue && latest.criticalFindingCount === 0 && latest.highFindingCount === 0 && latest.objectiveAchieved !== false) {
        const label = type === "penetration-test" ? "Penetration test" : "Red team exercise";
        positiveAssurance.push({ domain: "Security Testing", label: `${label} clean`, detail: `Completed ${latest.completedAt}, no critical or high findings.`, severity: "info" });
      }
    });

    if (resil.lastDrTest && resil.targetsMetLastTest) {
      positiveAssurance.push({ domain: "Resilience", label: "Recovery test met targets", detail: `RPO ${resil.lastDrTest.actualRpoMinutes}m / RTO ${resil.lastDrTest.actualRtoMinutes}m, both within target.`, severity: "info" });
    }

    if (ir.lastTabletop && !ir.tabletopOverdue) {
      positiveAssurance.push({ domain: "Incident Response", label: "IR tabletop completed", detail: `Last conducted ${ir.lastTabletop.conductedAt}.`, severity: "info" });
    }

    if (idPosture.review && !idPosture.review.cadence.overdue && idPosture.review.exceptionsOpen === 0) {
      positiveAssurance.push({ domain: "Identity & Access", label: "Access review completed", detail: `${idPosture.review.reviewedCount} of ${idPosture.review.totalCount} identities reviewed, no open exceptions.`, severity: "info" });
    }

    if (vendorPosture.vendors.length > 0 && !vendorPosture.anyOverdue && vendorPosture.vendors.every((v) => v.assurance?.sharedResponsibilityReviewed)) {
      positiveAssurance.push({ domain: "Vendor Assurance", label: "All vendor assurance current", detail: `${vendorPosture.vendors.length} dependencies reassessed within cadence.`, severity: "info" });
    }

    if (resil.backup?.coveragePct === 100) {
      positiveAssurance.push({ domain: "Resilience", label: "100% backup coverage", detail: resil.backup.immutable ? "Immutable, cross-region." : "Coverage confirmed.", severity: "info" });
    }

    if (summary?.clears) {
      positiveAssurance.push({ domain: "Control Assurance", label: "Meets tier target", detail: `Assurance ${summary.actual} vs. target ${summary.target}.`, severity: "info" });
    }

    return {
      systemId,
      assurance: system?.overallAssurance ?? null,
      assuranceBand: system?.assuranceBand ?? null,
      target: summary?.target ?? null,
      coverage: system?.coverage ?? null,
      residualRisk: { top: topRisks[0] ?? null, count: topRisks.length },
      attentionRequired,
      positiveAssurance,
    };
  }

  return { cockpitSummary };
}

export type CockpitApi = ReturnType<typeof createCockpit>;
