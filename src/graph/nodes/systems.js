// System — a security boundary ACME operates. Facts only.
//
// This is systemRegister.js's SYSTEMS with every derived or duplicated field
// removed. What left, and where it went:
//
//   classification    -> DERIVED. A system's tier is now the high-water mark of
//                        its assets, which is in turn the high-water mark of the
//                        data each asset holds (engine/rollups.js). validate.js
//                        asserts the derived value still equals the curated one
//                        recorded in EXPECTED_CLASSIFICATION below, so the
//                        rollup has to reproduce the human answer or fail.
//   dataElements      -> edges/assetDataTypes.js, at asset granularity.
//   controls[]        -> edges/controlImplementations.js. The six hand-tracked
//                        controls are now real per-asset implementation records
//                        against real SCF ids instead of an unnamed array whose
//                        index silently had to line up with CONTROLS.
//   standardMappings  -> DERIVED by engine/compliance.js from those same
//                        implementations, so a "SOC 2 CC6.1 is 92% confident"
//                        claim is computed from the controls that actually
//                        satisfy CC6.1 rather than typed next to it.
//   remediation[]     -> kept here. An open remediation ticket is a fact about
//                        the system, not a score derived from one.
//
// hostingType is kept as a stored fact rather than re-parsed from the `env`
// string on every call the way systemRegister.js's hostingType() did — the
// substring match on "SaaS"/"on-prem" was doing inference where a field will do.

export const HOSTING_TYPES = ["cloud", "saas", "on-prem"];

// Which control DOMAINS a hosting arrangement's provider already covers under
// its own certification, rather than needing separate ACME evidence.
//
// This replaces INHERITED_RATE, a single fraction per hosting type (cloud 0.2,
// saas 0.35) that was multiplied against a system's required-control count to
// produce an inherited total. That produced a plausible number and named no
// controls: it could say 113 of Workday's controls are inherited but not which
// ones, so "is physical security ACME's problem here?" had no answer.
//
// A shared-responsibility split is genuinely domain-shaped. On IaaS, ACME
// configures the workload and the provider owns the building and the hardware.
// On SaaS the provider additionally owns the platform's own patching,
// hardening, capacity, and endpoints. On-prem inherits nothing, because there
// is no provider. Which domains fall where is a judgment about the contract —
// the same kind of call as the domain maps in taxonomy.js — but it is at least
// a judgment about something nameable.
export const INHERITED_DOMAINS = {
  cloud: ["Physical & Environmental Security", "Maintenance"],
  saas: [
    "Physical & Environmental Security",
    "Maintenance",
    "Capacity & Performance Planning",
    "Endpoint Security",
    "Configuration Management",
    "Vulnerability & Patch Management",
    "Secure Engineering & Architecture",
    "Technology Development & Acquisition",
  ],
  "on-prem": [],
};

export function inheritsDomain(hostingType, domain) {
  return (INHERITED_DOMAINS[hostingType] || []).includes(domain);
}

export const SYSTEMS = [
  {
    id: "SYS-003",
    name: "Production AI Platform",
    env: "Production — AWS",
    hostingType: "cloud",
    provider: "AWS",
    standards: ["SOC 2", "ISO 27001"],
    mission:
      "ACME's core AI product platform — the model-serving, retrieval-augmented generation (RAG), and API layer that powers ACME's customer-facing AI features, from the public ingress point down through the customer data it draws on to answer queries.",
    boundary:
      "Runs entirely within a dedicated AWS production account, network-isolated from ACME's corporate network and other AWS accounts. The boundary covers the API gateway, model-serving and RAG compute, the vector store, and the encrypted customer data and metadata stores backing them; the upstream applications that call this platform's API are separately owned systems outside this boundary.",
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
    remediation: [
      { title: "Scope RAG service's IAM role to least-privilege (currently has broad read access across data stores)", controlId: "IAC-21", assetId: "AST-003-03", ticketStatus: "in_progress", owner: "ML Eng", due: "2026-08-25", overdue: false, jira: "SEC-2260" },
      { title: "Deploy DLP scanning on the prod-customer-data ingestion path", controlId: "NET-17", assetId: "AST-003-05", ticketStatus: "not_started", owner: "S. Patel", due: "2026-09-05", overdue: false, jira: "SEC-2261" },
      { title: "Define retention/disposal schedule for vector embeddings and the RAG document store", controlId: "DCH-18", assetId: "AST-003-04", ticketStatus: "not_started", owner: "ML Eng", due: "2026-09-15", overdue: false, jira: "SEC-2262" },
    ],
  },
  {
    id: "SYS-042",
    name: "Workday",
    env: "Production — SaaS (Workday)",
    hostingType: "saas",
    provider: "Workday",
    standards: ["SOC 2", "GDPR"],
    mission:
      "ACME's HR system of record — the tenant holding employee, compensation, and benefits data, plus the integration surface that feeds payroll, identity provisioning, and downstream reporting.",
    boundary:
      "A vendor-operated SaaS tenant. The boundary covers ACME's tenant configuration, the API and integration endpoints ACME authenticates against, and the service account those integrations run as; the vendor's underlying infrastructure is outside ACME's control and inherited from Workday's own certification.",
    connections: [
      "Inbound: authenticated integration calls from ACME systems via the tenant API endpoint",
      "Outbound: compensation data to the external payroll processor on the pay-cycle schedule",
      "Outbound: identity provisioning and deprovisioning events to connected systems",
      "Outbound: audit log export into ACME's central monitoring",
    ],
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
    remediation: [
      { title: "Quarterly access review overdue for manager role", controlId: "IAC-17", assetId: "AST-042-01", ticketStatus: "in_progress", owner: "R. Chen", due: "2026-07-25", overdue: false, jira: "SEC-2210" },
    ],
  },
];

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

// The curated classification each system carried before it became derived.
// This is not used for display — it exists so validate.js can assert the
// bottom-up rollup (data -> asset -> system) still lands on the same answer a
// human previously reached top-down. If a data type's sensitivity or an asset's
// data edges change such that a system's tier would move, that's either a real
// finding or a data-entry mistake, and either way it should stop the build
// rather than silently reclassify a system.
export const EXPECTED_CLASSIFICATION = {
  "SYS-003": "Restricted",
  "SYS-042": "Confidential",
};
