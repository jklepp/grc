// Canonical system inventory — single source of truth for every page that needs
// to know what systems ACME runs and how compliant they are. Originally lived
// only inside DataClassificationGapMatrix.jsx, with dataClassification.js keeping
// a hand-maintained "mirror" for the Executive Dashboard; the System Security Plan
// page became a third consumer, which is the point duplicating it stops paying off.
import { requiredControls } from "./ccfControls";

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const NOW = new Date("2026-07-21");

export const CONTROLS = [
  "Encryption at Rest",
  "Encryption in Transit",
  "Access Logging & Review",
  "Least-Privilege Access",
  "DLP Monitoring",
  "Retention & Disposal",
];

// The real SCF control each tracked control corresponds to, so the System
// Security Plan's full control matrix can show genuine tracked status/evidence
// on these rows instead of a derived one. Verified against scfControls.json.
export const TRACKED_CONTROL_SCF_IDS = ["CRY-05", "CRY-03", "MON-02", "IAC-21", "NET-17", "DCH-18"];

// inheritedRate models how much of a system's required control set is already
// covered by its cloud/SaaS vendor's own certification (e.g. AWS's or Workday's
// SOC 2 report) rather than needing separate evidence — on-prem systems have no
// vendor to inherit from, so it's 0.
const INHERITED_RATE = { cloud: 0.2, saas: 0.35, "on-prem": 0 };

export function hostingType(env) {
  if (env.includes("on-prem")) return "on-prem";
  if (env.includes("SaaS")) return "saas";
  return "cloud";
}

function daysAgo(dateStr) {
  return Math.floor((NOW - new Date(dateStr)) / 86400000);
}

function mkControl(status, source, lastVerified, evidenceRef) {
  const age = daysAgo(lastVerified);
  const staleThreshold = source === "vanta_test" ? 14 : 30;
  return { status, source, lastVerified, evidenceRef, age, stale: age > staleThreshold };
}

export const SYSTEMS = [
  {
    id: "SYS-014",
    name: "Customer Data Warehouse",
    env: "Production — AWS",
    classification: "Restricted",
    dataTypes: ["PII", "Financial"],
    standards: ["SOC 2", "ISO 27001"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "compliant",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-4471"),
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-4472"),
      mkControl("compliant", "vanta_test", "2026-07-19", "EV-4473"),
      mkControl("compliant", "vanta_test", "2026-07-21", "EV-4474"),
      mkControl("compliant", "vanta_test", "2026-07-18", "EV-4475"),
      mkControl("compliant", "vanta_test", "2026-06-30", "EV-4476"),
    ],
    remediation: [],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.1", control: "Encryption at Rest", confidence: 95, status: "full", reasoning: "Direct match — AES-256 at rest fully evidenced across all data stores in scope." },
        { req: "CC6.7", control: "Encryption in Transit", confidence: 90, status: "full", reasoning: "TLS 1.2+ enforced on all external and internal connections, matching requirement scope." },
        { req: "CC7.2", control: "Access Logging & Review", confidence: 88, status: "full", reasoning: "Centralized logging with quarterly review evidenced; matches monitoring requirement." },
      ],
      "ISO 27001": [
        { req: "A.8.24", control: "Encryption at Rest", confidence: 90, status: "full", reasoning: "Cryptographic controls clause fully met, including key management evidence." },
        { req: "A.8.20", control: "Encryption in Transit", confidence: 82, status: "full", reasoning: "Network security clause satisfied; minor scope note on third-party connections." },
        { req: "A.5.15", control: "Least-Privilege Access", confidence: 76, status: "partial", reasoning: "ISO requires periodic access recertification with a defined cadence — current evidence shows access control but not a documented recertification schedule." },
      ],
    },
  },
  {
    id: "SYS-027",
    name: "Support Ticketing Platform",
    env: "Production — SaaS (Zendesk)",
    classification: "Restricted",
    dataTypes: ["PII", "PHI"],
    standards: ["SOC 2", "HIPAA"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "partial",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-5011"),
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-5012"),
      mkControl("gap", "vanta_test", "2026-07-19", "EV-5013"),
      mkControl("partial", "vanta_test", "2026-07-19", "EV-5014"),
      mkControl("gap", "vanta_test", "2026-07-17", "EV-5015"),
      mkControl("compliant", "vanta_test", "2026-07-01", "EV-5016"),
    ],
    remediation: [
      { title: "Enable audit log export to SIEM", control: "Access Logging & Review", ticketStatus: "in_progress", owner: "D. Reyes", due: "2026-08-01", overdue: false, jira: "SEC-2231" },
      { title: "Restrict agent role to view PHI on need-to-know basis", control: "Least-Privilege Access", ticketStatus: "not_started", owner: "D. Reyes", due: "2026-07-15", overdue: true, jira: "SEC-2198" },
      { title: "Configure DLP rule for PHI in ticket attachments", control: "DLP Monitoring", ticketStatus: "blocked", owner: "S. Patel", due: "2026-07-10", overdue: true, jira: "SEC-2144" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC7.2", control: "Access Logging & Review", confidence: 55, status: "partial", reasoning: "Logging exists but isn't exported to SIEM yet, so continuous monitoring evidence is incomplete for this requirement." },
        { req: "CC6.3", control: "Least-Privilege Access", confidence: 60, status: "partial", reasoning: "Agent roles aren't scoped to need-to-know for PHI, weakening evidence for least-privilege access control." },
        { req: "CC6.8", control: "DLP Monitoring", confidence: 40, status: "gap", reasoning: "No DLP rule covers PHI in attachments — a real control gap, not just a documentation shortfall." },
      ],
      HIPAA: [
        { req: "164.312(b)", control: "Access Logging & Review", confidence: 50, status: "partial", reasoning: "HIPAA's audit control standard requires activity logs to be reviewed; SIEM export gap limits how audit-ready this evidence is." },
        { req: "164.312(a)(1)", control: "Least-Privilege Access", confidence: 58, status: "partial", reasoning: "Access control standard requires role-based restriction to ePHI/PHI — current role scope is broader than the standard expects." },
        { req: "164.312(c)(1)", control: "DLP Monitoring", confidence: 35, status: "gap", reasoning: "Integrity controls for PHI in transit through attachments aren't in place." },
      ],
    },
  },
  {
    id: "SYS-031",
    name: "Legacy Billing DB",
    env: "Production — on-prem",
    classification: "Restricted",
    dataTypes: ["Financial"],
    standards: ["SOC 2", "PCI DSS"],
    syncSource: "private_integration",
    lastSynced: "6 hrs ago",
    oktaEnforced: "gap",
    mfaEnforced: "gap",
    controls: [
      mkControl("partial", "manual", "2026-06-28", "EV-6601"),
      mkControl("gap", "manual", "2026-06-28", "EV-6602"),
      mkControl("gap", "manual", "2026-06-20", "EV-6603"),
      mkControl("partial", "manual", "2026-06-20", "EV-6604"),
      mkControl("gap", "manual", "2026-05-30", "EV-6605"),
      mkControl("gap", "manual", "2026-05-30", "EV-6606"),
    ],
    remediation: [
      { title: "Migrate to AES-256 at-rest encryption (currently AES-128)", control: "Encryption at Rest", ticketStatus: "in_progress", owner: "M. Alavi", due: "2026-09-01", overdue: false, jira: "SEC-2087" },
      { title: "Enforce TLS 1.2+ for internal DB connections", control: "Encryption in Transit", ticketStatus: "not_started", owner: "M. Alavi", due: "2026-07-18", overdue: true, jira: "SEC-2091" },
      { title: "Enable query-level access logging", control: "Access Logging & Review", ticketStatus: "not_started", owner: "T. Osei", due: "2026-08-15", overdue: false, jira: "SEC-2093" },
      { title: "Remove shared service account, move to per-user access", control: "Least-Privilege Access", ticketStatus: "blocked", owner: "M. Alavi", due: "2026-07-05", overdue: true, jira: "SEC-2088" },
      { title: "No DLP tooling deployed on this system", control: "DLP Monitoring", ticketStatus: "not_started", owner: "S. Patel", due: "2026-09-30", overdue: false, jira: "SEC-2101" },
      { title: "Define and implement disposal schedule for records >7yr", control: "Retention & Disposal", ticketStatus: "not_started", owner: "R. Chen", due: "2026-08-20", overdue: false, jira: "SEC-2102" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.1", control: "Encryption at Rest", confidence: 60, status: "partial", reasoning: "AES-128 provides encryption but falls short of the algorithm strength typically expected for this requirement at Restricted tier." },
        { req: "CC6.7", control: "Encryption in Transit", confidence: 30, status: "gap", reasoning: "No enforced TLS on internal DB connections — a direct, unresolved gap against this requirement." },
        { req: "CC6.3", control: "Least-Privilege Access", confidence: 45, status: "partial", reasoning: "Shared service account undermines individual accountability that this requirement expects." },
      ],
      "PCI DSS": [
        { req: "3.5", control: "Encryption at Rest", confidence: 55, status: "partial", reasoning: "PCI's key management and encryption strength expectations aren't fully met by AES-128 for cardholder-adjacent financial data." },
        { req: "4.2", control: "Encryption in Transit", confidence: 25, status: "gap", reasoning: "PCI requires strong cryptography for transmission over open/public networks and internal segments handling financial data." },
        { req: "8.3", control: "Least-Privilege Access", confidence: 40, status: "gap", reasoning: "PCI explicitly requires unique IDs per user; a shared service account directly violates this requirement." },
      ],
    },
  },
  {
    id: "SYS-042",
    name: "HR Information System",
    env: "Production — SaaS (Workday)",
    classification: "Confidential",
    dataTypes: ["PII"],
    standards: ["SOC 2", "GDPR"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "compliant",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-7001"),
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-7002"),
      mkControl("compliant", "vanta_test", "2026-07-19", "EV-7003"),
      mkControl("partial", "vanta_test", "2026-07-19", "EV-7004"),
      mkControl("compliant", "vanta_test", "2026-07-18", "EV-7005"),
      mkControl("compliant", "vanta_test", "2026-07-02", "EV-7006"),
    ],
    remediation: [
      { title: "Quarterly access review overdue for manager role", control: "Least-Privilege Access", ticketStatus: "in_progress", owner: "R. Chen", due: "2026-07-25", overdue: false, jira: "SEC-2210" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.3", control: "Least-Privilege Access", confidence: 78, status: "partial", reasoning: "Overdue quarterly review is a timing gap, not a design gap." },
      ],
      GDPR: [
        { req: "Art. 32", control: "Least-Privilege Access", confidence: 80, status: "partial", reasoning: "GDPR's security-of-processing article expects up-to-date access controls." },
      ],
    },
  },
  {
    id: "SYS-055",
    name: "Marketing Analytics Pipeline",
    env: "Production — GCP",
    classification: "Confidential",
    dataTypes: ["PII"],
    standards: ["SOC 2", "GDPR"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "compliant",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-8101"),
      mkControl("gap", "vanta_test", "2026-07-19", "EV-8102"),
      mkControl("compliant", "vanta_test", "2026-07-19", "EV-8103"),
      mkControl("compliant", "vanta_test", "2026-07-18", "EV-8104"),
      mkControl("gap", "vanta_test", "2026-07-17", "EV-8105"),
      mkControl("partial", "vanta_test", "2026-06-25", "EV-8106"),
    ],
    remediation: [
      { title: "Enforce TLS on internal Kafka stream between ingest and warehouse", control: "Encryption in Transit", ticketStatus: "not_started", owner: "M. Alavi", due: "2026-08-05", overdue: false, jira: "SEC-2244" },
      { title: "Deploy DLP scanning on export bucket", control: "DLP Monitoring", ticketStatus: "in_progress", owner: "S. Patel", due: "2026-07-28", overdue: false, jira: "SEC-2239" },
      { title: "Document retention schedule for raw event logs", control: "Retention & Disposal", ticketStatus: "not_started", owner: "R. Chen", due: "2026-08-10", overdue: false, jira: "SEC-2247" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.7", control: "Encryption in Transit", confidence: 45, status: "gap", reasoning: "Internal Kafka stream between ingest and warehouse isn't TLS-enforced." },
        { req: "CC6.8", control: "DLP Monitoring", confidence: 62, status: "partial", reasoning: "DLP scanning is being deployed but not yet live on the export bucket." },
      ],
      GDPR: [
        { req: "Art. 32", control: "Encryption in Transit", confidence: 50, status: "partial", reasoning: "Same internal-stream encryption gap weakens GDPR's security-of-processing expectations." },
        { req: "Art. 5(1)(e)", control: "Retention & Disposal", confidence: 68, status: "partial", reasoning: "Storage limitation principle expects a documented retention period — none defined yet." },
      ],
    },
  },
];

// Splits a system's required-control count into Inherited / Satisfied / Open Gaps /
// Not Implemented so the four always sum exactly to Required Controls. The split
// reuses this system's real compliant/partial/gap ratio from its 6 tracked controls
// as a stand-in confidence signal, applied to the larger CCF-derived total.
export function controlBreakdown(system) {
  const required = requiredControls(system.standards).length;
  const inherited = Math.round(required * INHERITED_RATE[hostingType(system.env)]);
  const remainder = required - inherited;
  const compliantCount = system.controls.filter((c) => c.status === "compliant").length;
  const partialCount = system.controls.filter((c) => c.status === "partial").length;
  const totalRated = system.controls.length;
  const satisfied = Math.round((remainder * compliantCount) / totalRated);
  const openGaps = Math.round((remainder * partialCount) / totalRated);
  const notImplemented = remainder - satisfied - openGaps;
  return { required, inherited, satisfied, openGaps, notImplemented };
}

// The System Security Plan's full control-level matrix for one system: every SCF
// control that actually applies (from the real crosswalk) gets a row. The 6
// controls ACME tracks directly keep their real evidenced status; everything else
// is deterministically bucketed — ordered by a hash of system+control id, not
// randomly per render — into Inherited/Satisfied/Open Gap/Not Implemented so the
// totals always match controlBreakdown() for the same system exactly.
export function getSystemControlMatrix(system) {
  const required = requiredControls(system.standards);
  const requiredIds = new Set(required.map((c) => c.id));
  const breakdown = controlBreakdown(system);
  const bucketTargets = { inherited: breakdown.inherited, satisfied: breakdown.satisfied, gap: breakdown.openGaps, "not-implemented": breakdown.notImplemented };

  // Tracked controls keep their real evidenced status and are pulled out of the
  // pool up front, shrinking whichever bucket they'd otherwise have consumed.
  const trackedRows = [];
  TRACKED_CONTROL_SCF_IDS.forEach((id, i) => {
    if (!requiredIds.has(id)) return;
    const rawStatus = system.controls[i].status;
    const status = rawStatus === "compliant" ? "satisfied" : rawStatus === "partial" ? "gap" : "not-implemented";
    const control = required.find((c) => c.id === id);
    trackedRows.push({ control, status, isTracked: true, trackedDetail: system.controls[i], trackedName: CONTROLS[i] });
    bucketTargets[status] = Math.max(0, bucketTargets[status] - 1);
  });

  const trackedIds = new Set(trackedRows.map((r) => r.control.id));
  const untracked = required.filter((c) => !trackedIds.has(c.id));
  const shuffled = [...untracked].sort((a, b) => hashStr(system.id + a.id) - hashStr(system.id + b.id));

  const order = ["inherited", "satisfied", "gap", "not-implemented"];
  const rows = [...trackedRows];
  let cursor = 0;
  order.forEach((status) => {
    const count = bucketTargets[status];
    shuffled.slice(cursor, cursor + count).forEach((control) => rows.push({ control, status, isTracked: false }));
    cursor += count;
  });
  // Any leftover from rounding lands as Not Implemented rather than being dropped.
  shuffled.slice(cursor).forEach((control) => rows.push({ control, status: "not-implemented", isTracked: false }));

  return rows.sort((a, b) => (a.control.domain === b.control.domain ? a.control.id.localeCompare(b.control.id) : a.control.domain.localeCompare(b.control.domain)));
}
