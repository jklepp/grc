import { jsPDF } from "jspdf";
import type {
  ApplicabilitySummary,
  CockpitSummary,
  ControlMatrixRow,
  ExposurePosture,
  IdentityPosture,
  IncidentResponsePosture,
  ResiliencePosture,
  SecurityTestingPosture,
  TopRisk,
  VendorPosture,
  WorkspaceDataType,
  WorkspaceSystem,
} from "../pages/SystemWorkspace/types";

export interface Iso27001SystemReportInput {
  system: WorkspaceSystem;
  cockpit: CockpitSummary;
  matrix: ControlMatrixRow[];
  applicabilitySummary: ApplicabilitySummary;
  dataTypes: WorkspaceDataType[];
  identity: IdentityPosture;
  exposure: ExposurePosture;
  resilience: ResiliencePosture;
  securityTesting: SecurityTestingPosture;
  incidentResponse: IncidentResponsePosture;
  vendors: VendorPosture;
  topRisks: TopRisk[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const BOTTOM = PAGE_HEIGHT - 54;
const PURPLE: [number, number, number] = [76, 61, 153];
const INK: [number, number, number] = [30, 33, 46];
const MUTED: [number, number, number] = [99, 105, 120];
const BORDER: [number, number, number] = [222, 224, 233];
const PALE_PURPLE: [number, number, number] = [242, 239, 252];

function ascii(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u00b7/g, "|")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function display(value: unknown, fallback = "Not recorded"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return ascii(value);
}

function isoClauses(row: ControlMatrixRow): string[] {
  return row.control.frameworks
    .filter((framework) => framework.standard === "ISO 27001")
    .flatMap((framework) => framework.clauses);
}

function titleCase(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceCount(row: ControlMatrixRow): number {
  return row.instances.reduce((total, instance) => total + instance.evidence.length, 0);
}

export function createIso27001SystemReportPdf(input: Iso27001SystemReportInput): jsPDF {
  const { system, cockpit, matrix, applicabilitySummary, dataTypes, identity, exposure, resilience, securityTesting, incidentResponse, vendors, topRisks } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const generatedAt = new Date();
  const generatedDate = generatedAt.toISOString().slice(0, 10);
  const isoRows = matrix.filter((row) => isoClauses(row).length > 0);
  const isoAssessed = isoRows.filter((row) => row.score !== null);
  const isoUnassessed = isoRows.length - isoAssessed.length;
  const openFindings = system.findings.filter((finding) => finding.open);
  let y = MARGIN;

  function addPage(): void {
    doc.addPage("a4", "portrait");
    y = MARGIN;
  }

  function ensureSpace(height: number): void {
    if (y + height > BOTTOM) addPage();
  }

  function textBlock(text: unknown, options: { size?: number; color?: [number, number, number]; bold?: boolean; indent?: number; gap?: number } = {}): void {
    const size = options.size ?? 9;
    const indent = options.indent ?? 0;
    const lines = doc.splitTextToSize(ascii(text), CONTENT_WIDTH - indent) as string[];
    const lineHeight = size * 1.45;
    ensureSpace(Math.max(lineHeight, lines.length * lineHeight) + (options.gap ?? 5));
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? INK));
    doc.text(lines, MARGIN + indent, y, { lineHeightFactor: 1.45 });
    y += (lines.length * lineHeight) + (options.gap ?? 5);
  }

  function section(title: string, description?: string): void {
    ensureSpace(description ? 58 : 36);
    if (y > MARGIN) y += 10;
    doc.setFillColor(...PALE_PURPLE);
    doc.roundedRect(MARGIN, y - 14, CONTENT_WIDTH, description ? 48 : 30, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...PURPLE);
    doc.text(ascii(title), MARGIN + 12, y + 3);
    if (description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(ascii(description), CONTENT_WIDTH - 24) as string[];
      doc.text(lines.slice(0, 2), MARGIN + 12, y + 18, { lineHeightFactor: 1.25 });
    }
    y += description ? 48 : 32;
  }

  function keyValue(label: string, value: unknown): void {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(ascii(label).toUpperCase(), MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(display(value), CONTENT_WIDTH - 142) as string[];
    doc.text(lines, MARGIN + 142, y, { lineHeightFactor: 1.3 });
    y += Math.max(18, lines.length * 12 + 4);
  }

  function metricRow(metrics: Array<{ label: string; value: string; detail: string }>): void {
    const gap = 8;
    const width = (CONTENT_WIDTH - gap * (metrics.length - 1)) / metrics.length;
    ensureSpace(72);
    metrics.forEach((metric, index) => {
      const x = MARGIN + index * (width + gap);
      doc.setFillColor(248, 248, 251);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, y, width, 60, 4, 4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(ascii(metric.label).toUpperCase(), x + 9, y + 14);
      doc.setFontSize(17);
      doc.setTextColor(...PURPLE);
      doc.text(ascii(metric.value), x + 9, y + 35);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      doc.text((doc.splitTextToSize(ascii(metric.detail), width - 18) as string[]).slice(0, 2), x + 9, y + 47, { lineHeightFactor: 1.15 });
    });
    y += 70;
  }

  function table(headers: string[], rows: string[][], widths: number[]): void {
    const drawHeader = (): void => {
      ensureSpace(24);
      doc.setFillColor(...PURPLE);
      doc.rect(MARGIN, y, CONTENT_WIDTH, 20, "F");
      let x = MARGIN;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      headers.forEach((header, index) => {
        doc.text(ascii(header), x + 5, y + 13);
        x += widths[index] ?? 0;
      });
      y += 20;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, index) => doc.splitTextToSize(ascii(cell), (widths[index] ?? 0) - 10) as string[]);
      const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
      const rowHeight = Math.max(22, lineCount * 9 + 8);
      if (y + rowHeight > BOTTOM) {
        addPage();
        drawHeader();
      }
      if (rowIndex % 2 === 1) {
        doc.setFillColor(249, 249, 252);
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
      }
      let x = MARGIN;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(...INK);
      cells.forEach((cell, index) => {
        doc.text(cell, x + 5, y + 13, { lineHeightFactor: 1.25 });
        x += widths[index] ?? 0;
      });
      doc.setDrawColor(...BORDER);
      doc.line(MARGIN, y + rowHeight, MARGIN + CONTENT_WIDTH, y + rowHeight);
      y += rowHeight;
    });
  }

  function bullet(text: string): void {
    textBlock(`- ${text}`, { indent: 8, gap: 3 });
  }

  // Cover
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, PAGE_WIDTH, 182, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(23);
  doc.text(doc.splitTextToSize("ISO/IEC 27001:2022 System Assurance & Control Implementation Report", CONTENT_WIDTH) as string[], MARGIN, 66, { lineHeightFactor: 1.15 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("System-specific control applicability, implementation, evidence, risks, and supplemental assurance.", MARGIN, 146);
  y = 230;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(ascii(system.name), CONTENT_WIDTH) as string[], MARGIN, y, { lineHeightFactor: 1.15 });
  y += 54;
  keyValue("System identifier", system.id);
  keyValue("Environment", system.env);
  keyValue("Classification", system.classification);
  keyValue("Report date", generatedDate);
  keyValue("Source state", `Application facts and derived assurance as of ${generatedDate}`);
  y += 20;
  doc.setFillColor(248, 248, 251);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 96, 6, 6, "FD");
  y += 20;
  textBlock("Purpose and limitation", { bold: true, color: PURPLE, indent: 12, gap: 4 });
  textBlock("This system-level report supports ISO/IEC 27001 readiness and assurance activities. It is not an ISO certificate, a complete organizational Statement of Applicability, or proof of conformity. ISO references identify mappings recorded in this application; ACME-authored control names and implementation evidence remain the substantive basis of each entry.", { size: 8.5, color: MUTED, indent: 12 });

  addPage();
  section("1. Executive Assurance Summary", "A concise view of assessed posture, coverage, evidence, risk, and unresolved action.");
  metricRow([
    { label: "Current assurance", value: display(cockpit.assurance, "Unassessed"), detail: `Target ${display(cockpit.target, "not set")}` },
    { label: "Assessment coverage", value: `${cockpit.coverage?.assessedPct ?? 0}%`, detail: `${cockpit.coverage?.assessed ?? 0} of ${cockpit.coverage?.applicable ?? 0} applicable controls` },
    { label: "Evidence coverage", value: `${system.controlBackedPct ?? 0}%`, detail: `${system.evidencedControlCount ?? 0} of ${system.requiredControlCount ?? 0} required instances` },
    { label: "Above appetite", value: String(cockpit.residualRisk.aboveAppetiteCount), detail: `${cockpit.residualRisk.count} mapped risk scenarios` },
  ]);
  metricRow([
    { label: "ISO-mapped controls", value: String(isoRows.length), detail: "Applicable controls with ISO 27001 mappings" },
    { label: "ISO assessed", value: String(isoAssessed.length), detail: `${isoUnassessed} remain outside assessment scope` },
    { label: "Open findings", value: String(openFindings.length), detail: `${openFindings.filter((finding) => finding.overdue).length} overdue` },
    { label: "Stale evidence", value: String(system.staleEvidenceCount), detail: "Evidence instances marked stale" },
  ]);
  textBlock("Assurance scores describe the assessed population. Assessment coverage separately states how much of the applicable control population has been examined; unassessed controls are not scored as zero.", { color: MUTED });

  section("2. System Scope and Context", "The system boundary and operating context used for this report.");
  keyValue("Mission", system.mission);
  keyValue("Boundary", system.boundary);
  keyValue("Hosting", `${titleCase(system.hostingType)} - ${system.provider}`);
  keyValue("Availability tier", titleCase(system.availabilityTier));
  keyValue("Regions", system.regions.join(", "));
  keyValue("Users", system.userCount.toLocaleString());
  keyValue("Standards recorded", system.standards.join(", "));
  keyValue("Last synchronized", `${system.lastSynced} via ${system.syncSource}`);
  table(
    ["Role", "Accountable party", "Note"],
    system.roles.map((role) => [role.role, role.assignment, role.note ?? ""]),
    [145, 175, CONTENT_WIDTH - 320],
  );

  section("3. Information and Asset Profile", "Data handled by this boundary and the assets that process, store, protect, or recover it.");
  keyValue("Data subjects", system.dataProfile.subjects.map(titleCase).join(", "));
  keyValue("Approximate records", system.dataProfile.approxRecords.toLocaleString());
  keyValue("Retention", system.dataProfile.retention);
  keyValue("Residency", system.dataProfile.residency.join(", "));
  table(
    ["Data type", "Sensitivity", "Regulatory flags"],
    dataTypes.map((dataType) => [dataType.name, dataType.sensitivity, dataType.regulatoryFlags.join(", ") || "None recorded"]),
    [190, 110, CONTENT_WIDTH - 300],
  );
  y += 8;
  table(
    ["Asset", "Type", "Provider", "Classification"],
    system.assets.map((asset) => [asset.name, asset.type, asset.provider, asset.classification ?? "Unclassified"]),
    [160, 150, 105, CONTENT_WIDTH - 415],
  );

  section("4. Architecture and Dependencies", "Recorded boundary connections and third-party dependencies; consult the live Architecture tab for topology and data-flow diagrams.");
  if (system.connections.length === 0) textBlock("No external connections are recorded.", { color: MUTED });
  else system.connections.forEach((connection) => bullet(connection));
  table(
    ["Dependency", "Criticality", "Reassessed", "Shared responsibility"],
    vendors.vendors.map((vendor) => [
      vendor.vendor?.name ?? vendor.vendorId,
      vendor.criticality,
      vendor.assurance?.reassessedAt ?? "Not recorded",
      vendor.assurance?.sharedResponsibilityReviewed ? "Reviewed" : "Not reviewed",
    ]),
    [165, 90, 105, CONTENT_WIDTH - 360],
  );

  section("5. Operational Assurance", "Identity, exposure, testing, incident response, and recovery signals supporting control operation.");
  table(
    ["Domain", "Indicator", "Current state"],
    [
      ["Identity", "Tracked identities", `${identity.totals.accounts}; ${identity.totals.dormant} dormant; ${identity.totals.awaitingTermination} awaiting termination`],
      ["Agentic identity", "Registered agents", `${identity.agenticSummary.total}; ${identity.agenticSummary.withIssues} with issues; ${identity.agenticSummary.longLivedApiKeys} long-lived API keys`],
      ["Access review", "Latest review", identity.review ? `${identity.review.reviewedAt}; ${identity.review.reviewedCount}/${identity.review.totalCount}; ${identity.review.exceptionsOpen} exceptions` : "No review recorded"],
      ["Exposure", "Externally reachable services", `${exposure.externallyReachableCount}; ${exposure.dangerousConditionsUnmitigated.length} unmitigated dangerous conditions`],
      ["Security testing", "Cadence", securityTesting.overdue ? "One or more required exercises overdue or missing" : "Required exercises current"],
      ["Incident response", "Plan and tabletop", `${incidentResponse.planReviewOverdue ? "Plan review overdue" : "Plan review current"}; ${incidentResponse.tabletopOverdue ? "tabletop overdue" : "tabletop current"}`],
      ["Backup", "Coverage and immutability", resilience.backup ? `${resilience.backup.coveragePct}% coverage; ${resilience.backup.immutable ? "immutable" : "not recorded as immutable"}` : "No backup configuration recorded"],
      ["Recovery", "Latest exercise", resilience.lastDrTest ? `${resilience.lastDrTest.conductedAt}; targets ${resilience.targetsMetLastTest ? "met" : "not met"}` : "No recovery exercise recorded"],
    ],
    [105, 150, CONTENT_WIDTH - 255],
  );

  section("6. Risk Context", "Highest residual risk scenarios mapped to assets and controls in this system.");
  table(
    ["Scenario", "Owner", "Residual", "Appetite", "Control assurance"],
    topRisks.map((risk) => [risk.scenario, risk.owner, `${risk.residual.severity} / ${risk.residual.likelihood}`, `${risk.appetiteRatio}x`, risk.assurance.pct === null ? "Unassessed" : String(risk.assurance.pct)]),
    [175, 90, 90, 55, CONTENT_WIDTH - 410],
  );

  section("7. ISO/IEC 27001:2022 Control Implementation", "Applicable system controls mapped to ISO 27001 clauses. Control names and explanations are ACME-authored; clause identifiers are cross-reference metadata.");
  keyValue("Catalog applicability", `${applicabilitySummary.applicable} applicable, ${applicabilitySummary.notApplicable} not applicable, ${applicabilitySummary.pending} pending across the in-scope catalog`);
  keyValue("Responsibility split", `${applicabilitySummary.byResponsibility.owned} owned, ${applicabilitySummary.byResponsibility.shared} shared, ${applicabilitySummary.byResponsibility.enterprise} enterprise, ${applicabilitySummary.byResponsibility.vendor} vendor`);
  if (isoRows.length === 0) textBlock("No applicable controls carry an ISO 27001 mapping for this system.", { color: MUTED });
  isoRows.forEach((row) => {
    const clauses = isoClauses(row).join(", ");
    const score = row.score === null ? "Unassessed" : `${row.score}`;
    const evidence = evidenceCount(row);
    const heading = `${row.controlId} - ${row.control.name}`;
    const metadata = `ISO clauses: ${clauses} | Domain: ${row.control.domain} | Status: ${titleCase(row.status)} | Responsibility: ${titleCase(row.responsibility)} | Assurance: ${score} | Evidence records: ${evidence}`;
    const explanation = row.score === null
      ? "Applicable, but outside the declared assessment scope. No assurance score has been asserted."
      : row.explanation;
    const headingLines = doc.splitTextToSize(ascii(heading), CONTENT_WIDTH - 20) as string[];
    const metadataLines = doc.splitTextToSize(ascii(metadata), CONTENT_WIDTH - 20) as string[];
    const explanationLines = doc.splitTextToSize(ascii(explanation), CONTENT_WIDTH - 20) as string[];
    const height = 16 + headingLines.length * 10 + metadataLines.length * 9 + explanationLines.length * 10;
    ensureSpace(height + 8);
    doc.setFillColor(249, 249, 252);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(headingLines, MARGIN + 10, y + 14, { lineHeightFactor: 1.2 });
    let rowY = y + 14 + headingLines.length * 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...PURPLE);
    doc.text(metadataLines, MARGIN + 10, rowY, { lineHeightFactor: 1.2 });
    rowY += metadataLines.length * 9 + 3;
    doc.setFontSize(7.8);
    doc.setTextColor(...MUTED);
    doc.text(explanationLines, MARGIN + 10, rowY, { lineHeightFactor: 1.25 });
    y += height + 8;
  });

  section("8. Findings and Plan of Action", "Open findings and remediation commitments associated with this system boundary.");
  if (openFindings.length === 0) textBlock("No open findings are recorded for this system.", { color: MUTED });
  else {
    table(
      ["Finding", "Severity", "Control", "Owner", "Due", "Status"],
      openFindings.map((finding) => [
        display(finding.title, finding.id),
        display(finding.severity),
        display(finding.controlId),
        display(finding.ownerName),
        display(finding.due),
        display(finding.overdue ? `${finding.remediationStatus} - overdue` : finding.remediationStatus),
      ]),
      [145, 55, 65, 90, 70, CONTENT_WIDTH - 425],
    );
  }

  section("9. Supplemental Assurance", "Practices represented in this application that extend beyond a narrow control checklist.");
  bullet("PRISMA maturity separates policy, procedure, implementation, measurement, and managed operation.");
  bullet("Assurance and assessment coverage are reported separately so an assessed subset is not mistaken for full coverage.");
  bullet("Control evidence is linked to system and asset context, with stale evidence explicitly identified.");
  bullet("Agentic identities, autonomy, credential age, privilege, logging, ownership, and revocation are assessed as first-class identity signals.");
  bullet("Architecture, data movement, software delivery, backup, and recovery are represented as operational system facts.");
  bullet("Residual risk is compared with risk appetite and linked to control assurance and remediation.");

  section("10. Report Limitations", "Interpretation guidance for reviewers and decision-makers.");
  bullet("This is a system-level assurance report generated from the application's current fictional demo data.");
  bullet("It is not an ISO/IEC 27001 certificate, certification audit result, legal opinion, or proof of conformity.");
  bullet("It is not a complete organization-wide Statement of Applicability. Not-applicable and pending decisions require governance approval and rationale outside this report.");
  bullet("ISO clause identifiers reflect the application's imported crosswalk. This report does not reproduce ISO normative control text.");
  bullet("Unassessed means applicable but not examined in the declared assessment scope; it is intentionally not represented as a zero score.");

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(ascii(`${system.name} | ISO/IEC 27001:2022 System Assurance Report`), MARGIN, 24);
      doc.setDrawColor(...BORDER);
      doc.line(MARGIN, 31, PAGE_WIDTH - MARGIN, 31);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${generatedDate}`, MARGIN, PAGE_HEIGHT - 24);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 24, { align: "right" });
  }

  return doc;
}

export async function exportIso27001SystemReportPdf(input: Iso27001SystemReportInput): Promise<void> {
  const doc = createIso27001SystemReportPdf(input);
  const safeSystemId = ascii(input.system.id).replace(/[^A-Za-z0-9_-]+/g, "-");
  doc.save(`${safeSystemId}-iso-27001-system-assurance-report.pdf`);
}
