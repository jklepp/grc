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

// How a control actually gets satisfied: continuously enforced by tooling, done by
// a person on a recurring basis, or evidenced by policy/documentation rather than
// a system at all. This is a property of the control's nature, not of any one
// system, so it's assigned once per SCF domain rather than per system. A domain
// classification is a judgment call, not a fact from the SCF source data — these
// are reasonable defaults for a typical mid-market program, not a certification.
export const IMPLEMENTATION_TYPES = {
  AUTOMATED: "Automated",
  MANUAL: "Manual",
  PROCESS: "Process & Procedure",
};

const DOMAIN_IMPLEMENTATION_TYPE = {
  "Security, Compliance & Resilience Governance": IMPLEMENTATION_TYPES.PROCESS,
  "Artificial Intelligence & Autonomous Technologies": IMPLEMENTATION_TYPES.PROCESS,
  "Asset Management": IMPLEMENTATION_TYPES.MANUAL,
  "Business Continuity & Disaster Recovery": IMPLEMENTATION_TYPES.MANUAL,
  "Capacity & Performance Planning": IMPLEMENTATION_TYPES.AUTOMATED,
  "Change Management": IMPLEMENTATION_TYPES.MANUAL,
  "Cloud Security": IMPLEMENTATION_TYPES.AUTOMATED,
  Compliance: IMPLEMENTATION_TYPES.PROCESS,
  "Configuration Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Continuous Monitoring": IMPLEMENTATION_TYPES.AUTOMATED,
  "Cryptographic Protections": IMPLEMENTATION_TYPES.AUTOMATED,
  "Data Classification & Handling": IMPLEMENTATION_TYPES.MANUAL,
  "Endpoint Security": IMPLEMENTATION_TYPES.AUTOMATED,
  "Human Resources Security": IMPLEMENTATION_TYPES.PROCESS,
  "Identification & Authentication": IMPLEMENTATION_TYPES.AUTOMATED,
  "Incident Response": IMPLEMENTATION_TYPES.MANUAL,
  "Information Assurance": IMPLEMENTATION_TYPES.PROCESS,
  Maintenance: IMPLEMENTATION_TYPES.MANUAL,
  "Mobile Device Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Network Security": IMPLEMENTATION_TYPES.AUTOMATED,
  "Physical & Environmental Security": IMPLEMENTATION_TYPES.MANUAL,
  "Data Privacy": IMPLEMENTATION_TYPES.PROCESS,
  "Project & Resource Management": IMPLEMENTATION_TYPES.PROCESS,
  "Risk Management": IMPLEMENTATION_TYPES.PROCESS,
  "Secure Engineering & Architecture": IMPLEMENTATION_TYPES.AUTOMATED,
  "Security Operations": IMPLEMENTATION_TYPES.MANUAL,
  "Security Awareness & Training": IMPLEMENTATION_TYPES.PROCESS,
  "Technology Development & Acquisition": IMPLEMENTATION_TYPES.MANUAL,
  "Third-Party Management": IMPLEMENTATION_TYPES.PROCESS,
  "Threat Management": IMPLEMENTATION_TYPES.MANUAL,
  "Vulnerability & Patch Management": IMPLEMENTATION_TYPES.AUTOMATED,
  "Web Security": IMPLEMENTATION_TYPES.AUTOMATED,
};

// Only populated for Automated domains — the primary tool that continuously
// enforces controls in that domain, reusing the same tool stack referenced
// throughout the Policy Center.
const DOMAIN_TOOL_HINT = {
  "Capacity & Performance Planning": "Azure Monitor",
  "Cloud Security": "Microsoft Defender for Cloud",
  "Configuration Management": "Intune / Azure Policy",
  "Continuous Monitoring": "Microsoft Sentinel",
  "Cryptographic Protections": "Azure Key Vault",
  "Endpoint Security": "Microsoft Defender for Endpoint",
  "Identification & Authentication": "Entra ID / Okta",
  "Mobile Device Management": "Microsoft Intune",
  "Network Security": "Zscaler",
  "Secure Engineering & Architecture": "Embedded architecture standard",
  "Vulnerability & Patch Management": "Tenable / Intune",
  "Web Security": "Cloudflare",
};

export function getImplementationType(domain) {
  return DOMAIN_IMPLEMENTATION_TYPE[domain] || IMPLEMENTATION_TYPES.PROCESS;
}

export function getToolHint(domain) {
  return DOMAIN_TOOL_HINT[domain] || null;
}

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
    id: "SYS-003",
    name: "Production AI Platform",
    env: "Production — AWS",
    classification: "Restricted",
    dataTypes: ["PII"],
    dataElements: [
      { label: "Customer PII", kind: "pii" },
      { label: "Customer Documents", kind: "documents" },
      { label: "Model Prompts & Outputs", kind: "modelData" },
      { label: "Encryption Keys & Secrets", kind: "secrets" },
    ],
    standards: ["SOC 2", "ISO 27001"],
    mission: "ACME's core AI product platform — the model-serving, retrieval-augmented generation (RAG), and API layer that powers ACME's customer-facing AI features, from the public ingress point down through the customer data it draws on to answer queries.",
    boundary: "Runs entirely within a dedicated AWS production account, network-isolated from ACME's corporate network and other AWS accounts. The boundary covers the API gateway, model-serving and RAG compute, the vector store, and the encrypted customer data and metadata stores backing them; the upstream applications that call this platform's API are separately owned systems outside this boundary.",
    connections: [
      "Inbound: authenticated API calls from ACME's customer-facing applications via API Gateway",
      "Internal: model-serving calls the RAG service, which queries the vector database and metadata store",
      "Encryption: all data at rest protected by a dedicated KMS key; service credentials brokered through Secrets Manager",
    ],
    roles: [
      { role: "System Owner", assignment: "ML Platform Team" },
      { role: "Technical Administrator", assignment: "ML Platform Team (AWS)" },
      { role: "Security Owner", assignment: "IT Security" },
      { role: "Data Owner", assignment: "Product Leadership" },
    ],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "compliant",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-9101"),
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-9102"),
      mkControl("compliant", "vanta_test", "2026-07-19", "EV-9103"),
      mkControl("partial", "vanta_test", "2026-07-18", "EV-9104"),
      mkControl("gap", "vanta_test", "2026-07-10", "EV-9105"),
      mkControl("partial", "vanta_test", "2026-07-05", "EV-9106"),
    ],
    remediation: [
      { title: "Scope RAG service's IAM role to least-privilege (currently has broad read access across data stores)", control: "Least-Privilege Access", ticketStatus: "in_progress", owner: "ML Eng", due: "2026-08-25", overdue: false, jira: "SEC-2260" },
      { title: "Deploy DLP scanning on the prod-customer-data ingestion path", control: "DLP Monitoring", ticketStatus: "not_started", owner: "S. Patel", due: "2026-09-05", overdue: false, jira: "SEC-2261" },
      { title: "Define retention/disposal schedule for vector embeddings and the RAG document store", control: "Retention & Disposal", ticketStatus: "not_started", owner: "ML Eng", due: "2026-09-15", overdue: false, jira: "SEC-2262" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.1", control: "Encryption at Rest", confidence: 92, status: "full", reasoning: "AES-256 at rest via a dedicated KMS key, fully evidenced across every data store in scope." },
        { req: "CC6.3", control: "Least-Privilege Access", confidence: 58, status: "partial", reasoning: "The RAG service's IAM role still has broader read access than its actual query pattern needs." },
        { req: "CC6.8", control: "DLP Monitoring", confidence: 35, status: "gap", reasoning: "No DLP scanning deployed yet on the ingestion path into prod-customer-data — a real control gap on a newly launched system." },
      ],
      "ISO 27001": [
        { req: "A.8.24", control: "Encryption at Rest", confidence: 90, status: "full", reasoning: "Cryptographic controls clause fully met, including dedicated key management evidence." },
        { req: "A.5.15", control: "Least-Privilege Access", confidence: 55, status: "partial", reasoning: "Access control clause expects role scope matched to actual need — the RAG service's role is broader than that today." },
        { req: "A.8.10", control: "Retention & Disposal", confidence: 42, status: "gap", reasoning: "Information deletion clause expects a defined retention schedule — none yet exists for vector embeddings or the RAG document store." },
      ],
    },
  },
  {
    id: "SYS-042",
    name: "Workday",
    env: "Production — SaaS (Workday)",
    classification: "Confidential",
    dataTypes: ["PII"],
    dataElements: [
      { label: "Employee PII", kind: "employee" },
      { label: "Compensation Data", kind: "financial" },
      { label: "Benefits Information", kind: "documents" },
    ],
    standards: ["SOC 2", "GDPR"],
    roles: [
      { role: "System Owner", assignment: "HR Operations" },
      { role: "Technical Administrator", assignment: "IT Security (SaaS administration)" },
      { role: "Security Owner", assignment: "IT Security" },
      { role: "Data Owner", assignment: "HR Operations" },
    ],
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

  return rows
    .map((row) => ({ ...row, implementationType: getImplementationType(row.control.domain), toolHint: getToolHint(row.control.domain) }))
    .sort((a, b) => (a.control.domain === b.control.domain ? a.control.id.localeCompare(b.control.id) : a.control.domain.localeCompare(b.control.domain)));
}
