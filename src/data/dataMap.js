// Enterprise Data Map — domains -> data types -> custody chain.
// Only the Customer & End-User domain is fully mapped for now; the rest are
// placeholder tiles (name/classification/system count only) until someone
// walks their custody chain the same way. Grades are never a separate
// hand-typed field: every node resolves to a percentage from real control
// statuses using the same taxonomy as systemRegister.js's CONTROLS, then the
// same percentage-to-letter scale converts that into the badge shown on the
// map. Nodes tied to a system already in SYSTEMS (systemId) pull that
// system's real tracked-control statuses live; nodes that only exist as a
// pipeline hop with no register entry (the portal, the gateway, the backup
// copy, the export drop) carry their own small statuses array in the same
// six-control shape so they're graded by the exact same formula.
import { SYSTEMS, CONTROLS } from "./systemRegister";

function pctFromStatuses(statuses) {
  const score = statuses.reduce((a, s) => a + (s === "compliant" ? 1 : s === "partial" ? 0.5 : 0), 0);
  return (score / statuses.length) * 100;
}

export function letterGrade(pct) {
  if (pct >= 97) return "A+";
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 63) return "D";
  if (pct >= 60) return "D-";
  return "F";
}

// A/B land as "healthy", C and below as "at risk" — mirrors the compliant/
// partial/gap -> green/amber/red convention already used on the Gap Matrix.
export function gradeBand(letter) {
  if (letter.startsWith("A")) return "good";
  if (letter.startsWith("B")) return "watch";
  return "risk";
}

// Pipeline hops with no entry in SYSTEMS. Status order matches CONTROLS in
// systemRegister.js: [Encryption at Rest, Encryption in Transit, Access
// Logging & Review, Least-Privilege Access, DLP Monitoring, Retention & Disposal].
const NODE_DEFS = {
  portal: {
    code: "CU", name: "Customer Portal", subtitle: "Collection",
    statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"],
  },
  gateway: {
    code: "API", name: "API Gateway", subtitle: "Ingress",
    statuses: ["compliant", "compliant", "compliant", "compliant", "partial", "compliant"],
  },
  awsProd: { code: "AWS", name: "AWS Production", subtitle: "Primary custody", systemId: "SYS-014" },
  awsBackup: {
    code: "BK", name: "AWS Backups", subtitle: "Recovery",
    statuses: ["compliant", "compliant", "partial", "compliant", "gap", "compliant"],
  },
  snowflake: {
    code: "SF", name: "Snowflake", subtitle: "Analytics",
    statuses: ["compliant", "compliant", "compliant", "partial", "gap", "partial"],
  },
  salesforce: {
    code: "CRM", name: "Salesforce", subtitle: "CRM subset",
    statuses: ["compliant", "compliant", "partial", "partial", "compliant", "compliant"],
  },
  fileExchange: {
    code: "FX", name: "File Exchange", subtitle: "Delivery",
    statuses: ["compliant", "partial", "gap", "partial", "gap", "gap"],
  },
  zendesk: { code: "ZD", name: "Zendesk", subtitle: "Support tickets", systemId: "SYS-027" },
  marketingPipeline: { code: "MK", name: "Marketing Analytics Pipeline", subtitle: "Telemetry processing", systemId: "SYS-055" },

  // Engineering & IP
  eng_gh: { code: "GH", name: "GitHub", subtitle: "Source control", statuses: ["compliant", "compliant", "compliant", "compliant", "partial", "compliant"] },
  eng_ci: { code: "CI", name: "CI/CD Pipeline", subtitle: "Build ingress", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "partial"] },
  eng_artifactRegistry: { code: "AR", name: "Artifact Registry", subtitle: "Primary custody", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "compliant"] },
  eng_artifactBackup: { code: "BK", name: "Cold Storage Backup", subtitle: "Recovery", statuses: ["compliant", "compliant", "partial", "compliant", "gap", "compliant"] },
  eng_secScan: { code: "SEC", name: "Security Scanning", subtitle: "SAST / SCA", statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"] },
  eng_licenseScan: { code: "LIC", name: "License Scanner", subtitle: "OSS compliance", statuses: ["compliant", "compliant", "partial", "partial", "compliant", "compliant"] },
  eng_containerReg: { code: "CR", name: "Container Registry", subtitle: "Delivery", statuses: ["compliant", "compliant", "partial", "compliant", "gap", "partial"] },

  // Financial & Payment
  fin_billingPortal: { code: "BP", name: "Billing Portal", subtitle: "Collection", statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"] },
  fin_paymentGateway: { code: "PG", name: "Payment Gateway", subtitle: "Ingress", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "compliant"] },
  fin_legacyBilling: { code: "LB", name: "Legacy Billing DB", subtitle: "Primary custody", systemId: "SYS-031" },
  fin_glSync: { code: "GL", name: "General Ledger Sync", subtitle: "Processing", statuses: ["compliant", "compliant", "partial", "compliant", "partial", "compliant"] },
  fin_bankExport: { code: "BK", name: "Bank File Export", subtitle: "Delivery", statuses: ["compliant", "partial", "gap", "compliant", "gap", "partial"] },

  // Workforce & Talent
  wf_essPortal: { code: "ESS", name: "Employee Self-Service", subtitle: "Collection", statuses: ["compliant", "compliant", "compliant", "compliant", "partial", "compliant"] },
  wf_ssoProv: { code: "SSO", name: "SSO Provisioning", subtitle: "Ingress", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "compliant"] },
  wf_workdayHRIS: { code: "WD", name: "Workday HRIS", subtitle: "Primary custody", systemId: "SYS-042" },
  wf_payrollProc: { code: "PAY", name: "Payroll Processor", subtitle: "Processing", statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"] },
  wf_benefitsExport: { code: "BEN", name: "Benefits Carrier Export", subtitle: "Delivery", statuses: ["compliant", "partial", "partial", "compliant", "gap", "compliant"] },

  // Security & Identity
  sec_oktaLogin: { code: "OK", name: "Okta Login", subtitle: "Collection", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "compliant"] },
  sec_siemIngest: { code: "SI", name: "SIEM Ingest", subtitle: "Ingress", statuses: ["compliant", "compliant", "compliant", "compliant", "partial", "compliant"] },
  sec_identityVault: { code: "IV", name: "Identity Vault", subtitle: "Primary custody", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "partial"] },
  sec_vaultBackup: { code: "BK", name: "Directory Backup", subtitle: "Recovery", statuses: ["compliant", "compliant", "partial", "compliant", "gap", "compliant"] },
  sec_threatDetect: { code: "TD", name: "Threat Detection", subtitle: "Processing", statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"] },
  sec_socExport: { code: "SOC", name: "Incident Ticket Export", subtitle: "Delivery", statuses: ["compliant", "partial", "compliant", "partial", "gap", "compliant"] },

  // Legal & Strategy
  legal_intakePortal: { code: "IN", name: "Contract Intake Portal", subtitle: "Collection", statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"] },
  legal_dmsIngress: { code: "DMS", name: "Document Mgmt Ingress", subtitle: "Ingress", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "compliant"] },
  legal_contractRepo: { code: "CR", name: "Contract Repository", subtitle: "Primary custody", statuses: ["compliant", "compliant", "compliant", "compliant", "partial", "compliant"] },
  legal_repoBackup: { code: "BK", name: "Repository Backup", subtitle: "Recovery", statuses: ["compliant", "compliant", "partial", "compliant", "gap", "partial"] },
  legal_ediscovery: { code: "ED", name: "eDiscovery Processing", subtitle: "Processing", statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"] },
  legal_counselExchange: { code: "OC", name: "Outside Counsel Exchange", subtitle: "Delivery", statuses: ["compliant", "partial", "partial", "compliant", "gap", "compliant"] },

  // Supplier & Partner
  sup_vendorPortal: { code: "VP", name: "Vendor Portal", subtitle: "Collection", statuses: ["compliant", "compliant", "compliant", "partial", "partial", "compliant"] },
  sup_procurementIngress: { code: "PR", name: "Procurement Ingress", subtitle: "Ingress", statuses: ["compliant", "compliant", "compliant", "compliant", "partial", "compliant"] },
  sup_vendorRiskReg: { code: "VR", name: "Vendor Risk Register", subtitle: "Primary custody", statuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"] },
  sup_riskRegBackup: { code: "BK", name: "Register Backup", subtitle: "Recovery", statuses: ["compliant", "compliant", "partial", "compliant", "gap", "compliant"] },
  sup_riskScoring: { code: "TPR", name: "Third-Party Risk Scoring", subtitle: "Processing", statuses: ["compliant", "compliant", "partial", "partial", "partial", "compliant"] },
  sup_partnerExchange: { code: "PX", name: "Partner API Exchange", subtitle: "Delivery", statuses: ["compliant", "partial", "gap", "partial", "gap", "gap"] },

  // Business Operations
  ops_opsPortal: { code: "OP", name: "Internal Ops Portal", subtitle: "Collection", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "partial"] },
  ops_etlIngress: { code: "ETL", name: "ETL Ingress", subtitle: "Ingress", statuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "compliant"] },
  ops_erpSystem: { code: "ERP", name: "ERP System of Record", subtitle: "Primary custody", statuses: ["compliant", "compliant", "compliant", "compliant", "partial", "compliant"] },
  ops_erpBackup: { code: "BK", name: "ERP Backup", subtitle: "Recovery", statuses: ["compliant", "compliant", "partial", "compliant", "gap", "compliant"] },
  ops_biAnalytics: { code: "BI", name: "BI / Analytics Processing", subtitle: "Processing", statuses: ["compliant", "compliant", "compliant", "partial", "partial", "compliant"] },
  ops_execReport: { code: "XR", name: "Executive Reporting Export", subtitle: "Delivery", statuses: ["compliant", "partial", "compliant", "partial", "gap", "compliant"] },
};

function nodeStatuses(def) {
  if (def.systemId) return SYSTEMS.find((s) => s.id === def.systemId).controls.map((c) => c.status);
  return def.statuses;
}

// Resolves a node key into everything the map needs to render and grade it:
// real system name/env when systemId is set, computed pct/letter/band, and
// which specific controls are dragging the grade down (for the weakest-link note).
export function getNode(key) {
  const def = NODE_DEFS[key];
  const statuses = nodeStatuses(def);
  const pct = pctFromStatuses(statuses);
  const letter = letterGrade(pct);
  const system = def.systemId ? SYSTEMS.find((s) => s.id === def.systemId) : null;
  const gaps = statuses.map((s, i) => ({ status: s, control: CONTROLS[i] })).filter((c) => c.status !== "compliant");
  return { key, ...def, system, pct, letter, band: gradeBand(letter), gaps };
}

// Each stage is a list of node keys; `branch` marks a node as a secondary
// hop stacked under the primary node in the same column (e.g. a backup copy
// under the primary data store), rendered with a small connector, not a
// full arrow from the previous stage.
function stage(nodes) {
  return nodes.map((n) => (typeof n === "string" ? { key: n } : n));
}

export const CUSTOMER_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["portal"]) },
      { name: "Ingress", nodes: stage(["gateway"]) },
      { name: "Primary Custody", nodes: stage(["awsProd", { key: "awsBackup", branch: true }]) },
      { name: "Processing", nodes: stage(["snowflake", { key: "salesforce", branch: true }]) },
      { name: "Delivery", nodes: stage(["fileExchange"]) },
    ],
  },
  account: {
    label: "Account & Identity",
    stages: [
      { name: "Source", nodes: stage(["portal"]) },
      { name: "Ingress", nodes: stage(["gateway"]) },
      { name: "Primary Custody", nodes: stage(["awsProd"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  content: {
    label: "Customer Content",
    stages: [
      { name: "Source", nodes: stage(["portal"]) },
      { name: "Ingress", nodes: stage(["gateway"]) },
      { name: "Primary Custody", nodes: stage(["awsProd", { key: "awsBackup", branch: true }]) },
      { name: "Processing", nodes: stage(["snowflake"]) },
      { name: "Delivery", nodes: stage(["fileExchange"]) },
    ],
  },
  telemetry: {
    label: "Usage Telemetry",
    stages: [
      { name: "Source", nodes: stage(["portal"]) },
      { name: "Ingress", nodes: stage(["gateway"]) },
      { name: "Primary Custody", nodes: stage(["awsProd"]) },
      { name: "Processing", nodes: stage(["marketingPipeline"]) },
      { name: "Delivery", nodes: stage(["salesforce"]) },
    ],
  },
  support: {
    label: "Support Artifacts",
    stages: [
      { name: "Source", nodes: stage(["portal"]) },
      { name: "Ingress", nodes: stage(["gateway"]) },
      { name: "Primary Custody", nodes: stage(["zendesk"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage(["salesforce"]) },
    ],
  },
  exports: {
    label: "Exports",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage([]) },
      { name: "Primary Custody", nodes: stage(["awsProd"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage(["fileExchange"]) },
    ],
  },
};

export const ENGINEERING_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["eng_gh"]) },
      { name: "Ingress", nodes: stage(["eng_ci"]) },
      { name: "Primary Custody", nodes: stage(["eng_artifactRegistry", { key: "eng_artifactBackup", branch: true }]) },
      { name: "Processing", nodes: stage(["eng_secScan", { key: "eng_licenseScan", branch: true }]) },
      { name: "Delivery", nodes: stage(["eng_containerReg"]) },
    ],
  },
  sourceCode: {
    label: "Source Code",
    stages: [
      { name: "Source", nodes: stage(["eng_gh"]) },
      { name: "Ingress", nodes: stage(["eng_ci"]) },
      { name: "Primary Custody", nodes: stage(["eng_artifactRegistry"]) },
      { name: "Processing", nodes: stage(["eng_secScan"]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  vulnReports: {
    label: "Vulnerability Reports",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage(["eng_ci"]) },
      { name: "Primary Custody", nodes: stage(["eng_secScan"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage(["eng_containerReg"]) },
    ],
  },
};

export const FINANCIAL_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["fin_billingPortal"]) },
      { name: "Ingress", nodes: stage(["fin_paymentGateway"]) },
      { name: "Primary Custody", nodes: stage(["fin_legacyBilling"]) },
      { name: "Processing", nodes: stage(["fin_glSync"]) },
      { name: "Delivery", nodes: stage(["fin_bankExport"]) },
    ],
  },
  paymentTransactions: {
    label: "Payment Transactions",
    stages: [
      { name: "Source", nodes: stage(["fin_billingPortal"]) },
      { name: "Ingress", nodes: stage(["fin_paymentGateway"]) },
      { name: "Primary Custody", nodes: stage(["fin_legacyBilling"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  ledgerReporting: {
    label: "Ledger & Reporting",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage([]) },
      { name: "Primary Custody", nodes: stage(["fin_legacyBilling"]) },
      { name: "Processing", nodes: stage(["fin_glSync"]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
};

export const WORKFORCE_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["wf_essPortal"]) },
      { name: "Ingress", nodes: stage(["wf_ssoProv"]) },
      { name: "Primary Custody", nodes: stage(["wf_workdayHRIS"]) },
      { name: "Processing", nodes: stage(["wf_payrollProc"]) },
      { name: "Delivery", nodes: stage(["wf_benefitsExport"]) },
    ],
  },
  employeeRecords: {
    label: "Employee Records",
    stages: [
      { name: "Source", nodes: stage(["wf_essPortal"]) },
      { name: "Ingress", nodes: stage(["wf_ssoProv"]) },
      { name: "Primary Custody", nodes: stage(["wf_workdayHRIS"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  payrollCompensation: {
    label: "Payroll & Compensation",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage([]) },
      { name: "Primary Custody", nodes: stage(["wf_workdayHRIS"]) },
      { name: "Processing", nodes: stage(["wf_payrollProc"]) },
      { name: "Delivery", nodes: stage(["wf_benefitsExport"]) },
    ],
  },
};

export const SECURITY_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["sec_oktaLogin"]) },
      { name: "Ingress", nodes: stage(["sec_siemIngest"]) },
      { name: "Primary Custody", nodes: stage(["sec_identityVault", { key: "sec_vaultBackup", branch: true }]) },
      { name: "Processing", nodes: stage(["sec_threatDetect"]) },
      { name: "Delivery", nodes: stage(["sec_socExport"]) },
    ],
  },
  credentialsAuthLogs: {
    label: "Credentials & Auth Logs",
    stages: [
      { name: "Source", nodes: stage(["sec_oktaLogin"]) },
      { name: "Ingress", nodes: stage(["sec_siemIngest"]) },
      { name: "Primary Custody", nodes: stage(["sec_identityVault"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  incidentRecords: {
    label: "Incident Records",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage(["sec_siemIngest"]) },
      { name: "Primary Custody", nodes: stage([]) },
      { name: "Processing", nodes: stage(["sec_threatDetect"]) },
      { name: "Delivery", nodes: stage(["sec_socExport"]) },
    ],
  },
};

export const LEGAL_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["legal_intakePortal"]) },
      { name: "Ingress", nodes: stage(["legal_dmsIngress"]) },
      { name: "Primary Custody", nodes: stage(["legal_contractRepo", { key: "legal_repoBackup", branch: true }]) },
      { name: "Processing", nodes: stage(["legal_ediscovery"]) },
      { name: "Delivery", nodes: stage(["legal_counselExchange"]) },
    ],
  },
  contracts: {
    label: "Contracts",
    stages: [
      { name: "Source", nodes: stage(["legal_intakePortal"]) },
      { name: "Ingress", nodes: stage(["legal_dmsIngress"]) },
      { name: "Primary Custody", nodes: stage(["legal_contractRepo"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  litigationEdiscovery: {
    label: "Litigation & eDiscovery",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage([]) },
      { name: "Primary Custody", nodes: stage(["legal_contractRepo"]) },
      { name: "Processing", nodes: stage(["legal_ediscovery"]) },
      { name: "Delivery", nodes: stage(["legal_counselExchange"]) },
    ],
  },
};

export const SUPPLIER_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["sup_vendorPortal"]) },
      { name: "Ingress", nodes: stage(["sup_procurementIngress"]) },
      { name: "Primary Custody", nodes: stage(["sup_vendorRiskReg", { key: "sup_riskRegBackup", branch: true }]) },
      { name: "Processing", nodes: stage(["sup_riskScoring"]) },
      { name: "Delivery", nodes: stage(["sup_partnerExchange"]) },
    ],
  },
  vendorRiskAssessments: {
    label: "Vendor Risk Assessments",
    stages: [
      { name: "Source", nodes: stage(["sup_vendorPortal"]) },
      { name: "Ingress", nodes: stage(["sup_procurementIngress"]) },
      { name: "Primary Custody", nodes: stage(["sup_vendorRiskReg"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  partnerIntegrations: {
    label: "Partner Integrations",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage([]) },
      { name: "Primary Custody", nodes: stage(["sup_vendorRiskReg"]) },
      { name: "Processing", nodes: stage(["sup_riskScoring"]) },
      { name: "Delivery", nodes: stage(["sup_partnerExchange"]) },
    ],
  },
};

export const OPERATIONS_DATA_TYPES = {
  all: {
    label: "All Data",
    stages: [
      { name: "Source", nodes: stage(["ops_opsPortal"]) },
      { name: "Ingress", nodes: stage(["ops_etlIngress"]) },
      { name: "Primary Custody", nodes: stage(["ops_erpSystem", { key: "ops_erpBackup", branch: true }]) },
      { name: "Processing", nodes: stage(["ops_biAnalytics"]) },
      { name: "Delivery", nodes: stage(["ops_execReport"]) },
    ],
  },
  erpRecords: {
    label: "ERP Records",
    stages: [
      { name: "Source", nodes: stage(["ops_opsPortal"]) },
      { name: "Ingress", nodes: stage(["ops_etlIngress"]) },
      { name: "Primary Custody", nodes: stage(["ops_erpSystem"]) },
      { name: "Processing", nodes: stage([]) },
      { name: "Delivery", nodes: stage([]) },
    ],
  },
  reportingExports: {
    label: "Reporting Exports",
    stages: [
      { name: "Source", nodes: stage([]) },
      { name: "Ingress", nodes: stage([]) },
      { name: "Primary Custody", nodes: stage(["ops_erpSystem"]) },
      { name: "Processing", nodes: stage(["ops_biAnalytics"]) },
      { name: "Delivery", nodes: stage(["ops_execReport"]) },
    ],
  },
};

// Directed edges actually drawn on the chart for one data type: a transition
// between consecutive non-empty stages, plus one per branch connector.
export function countEdges(dataType) {
  let edges = 0;
  let prevKeys = null;
  dataType.stages.forEach((s) => {
    const primary = s.nodes.filter((n) => !n.branch);
    const branches = s.nodes.filter((n) => n.branch);
    edges += branches.length;
    if (prevKeys && prevKeys.length && primary.length) edges += prevKeys.length * primary.length;
    if (primary.length) prevKeys = primary;
  });
  return edges;
}

// Every node across every stage of a data type, deduped by key — used to
// roll a data type (or the whole domain) up into one overall grade.
export function allNodes(dataType) {
  const keys = new Set();
  dataType.stages.forEach((s) => s.nodes.forEach((n) => keys.add(n.key)));
  return [...keys].map(getNode);
}

export function weakestLink(dataType) {
  const nodes = allNodes(dataType);
  if (nodes.length === 0) return null;
  return nodes.reduce((worst, n) => (n.pct < worst.pct ? n : worst), nodes[0]);
}

export function dataTypeGrade(dataType) {
  const nodes = allNodes(dataType);
  if (nodes.length === 0) return null;
  const avgPct = nodes.reduce((a, n) => a + n.pct, 0) / nodes.length;
  return letterGrade(avgPct);
}

function domainGrade(dataTypes) {
  return dataTypeGrade(dataTypes.all);
}

export const DOMAINS = [
  { id: "customer", name: "Customer & End-User", classification: "Restricted", systemCount: 9, mapped: true, dataTypes: CUSTOMER_DATA_TYPES },
  { id: "engineering", name: "Engineering & IP", classification: "Restricted", systemCount: 7, mapped: true, dataTypes: ENGINEERING_DATA_TYPES },
  { id: "financial", name: "Financial & Payment", classification: "Restricted", systemCount: 6, mapped: true, dataTypes: FINANCIAL_DATA_TYPES },
  { id: "workforce", name: "Workforce & Talent", classification: "Confidential", systemCount: 9, mapped: true, dataTypes: WORKFORCE_DATA_TYPES },
  { id: "security", name: "Security & Identity", classification: "Restricted", systemCount: 11, mapped: true, dataTypes: SECURITY_DATA_TYPES },
  { id: "legal", name: "Legal & Strategy", classification: "Restricted", systemCount: 8, mapped: true, dataTypes: LEGAL_DATA_TYPES },
  { id: "supplier", name: "Supplier & Partner", classification: "Confidential", systemCount: 10, mapped: true, dataTypes: SUPPLIER_DATA_TYPES },
  { id: "operations", name: "Business Operations", classification: "Confidential", systemCount: 12, mapped: true, dataTypes: OPERATIONS_DATA_TYPES },
];

DOMAINS.forEach((d) => {
  d.grade = d.mapped ? domainGrade(d.dataTypes) : null;
});

// Rolled up across every mapped domain, not just Customer & End-User, so the
// header stat stays accurate as more domains get walked.
const mappedDataTypeSets = DOMAINS.filter((d) => d.mapped).map((d) => d.dataTypes);
export const MAPPED_DATA_TYPE_COUNT = mappedDataTypeSets.reduce((a, dt) => a + Object.keys(dt).length - 1, 0); // exclude each domain's "All Data" aggregate
export const MAPPED_RELATIONSHIP_COUNT = mappedDataTypeSets.reduce(
  (a, dt) => a + Object.entries(dt).filter(([key]) => key !== "all").reduce((b, [, d]) => b + countEdges(d), 0),
  0
);
