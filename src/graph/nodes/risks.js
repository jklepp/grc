// Risk scenarios. Facts only.
//
// One field left: `linkedControl`, a free-text string ("Access Control", "AI
// Governance") that existed so the Risk Register could show a control family in
// a column. It was doing far more work than that. riskRegister.js mapped it
// through LINKED_CONTROL_CATEGORY to one of the six assurance categories, then
// looked up that category's PORTFOLIO-WIDE average, and presented the result as
// this risk's control assurance. So every risk mapping to "Identity & Access"
// reported the same number, computed across all fifteen assets — including
// assets that have nothing to do with the risk.
//
// It's now edges/riskContributors.js: which assets actually carry the scenario,
// and which key controls actually hold it down. engine/risk.js reads assurance
// from those, so RISK-001's number comes from the RAG service and the vector
// store rather than from a portfolio average, and it moves when they move.
//
// The ordered level arrays replace SEVERITY_VALUE / LIKELIHOOD_VALUE. The
// numeric weight of a tier is its position in the ordering, so the two can't
// disagree — the old pair of hand-typed lookup objects could.

export const SEVERITY_LEVELS = ["Minor", "Moderate", "Major", "Severe"];
export const LIKELIHOOD_LEVELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];

export const RISKS = [
  {
    id: "RISK-001", scenario: "Cross-tenant data exposure through authorization defect", domain: "Product", subcategory: "Confidentiality",
    materialLabel: "Mass cross-tenant/customer data breach",
    ownerId: "platform-eng", appetite: 8, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 12750000,
    inherent: { severity: "Severe", likelihood: "Almost Certain" }, residual: { severity: "Severe", likelihood: "Likely" },
    description: "A multi-tenant authorization check could allow one customer's session to access another's data under specific query conditions.",
    milestones: [
      { title: "Patch authorization check in shared query layer", status: "in_progress", due: "2026-08-01" },
      { title: "Regression test across all tenant boundaries", status: "not_started", due: "2026-08-15" },
    ],
  },
  {
    id: "RISK-002", scenario: "Privileged access persists beyond operational need", domain: "Enterprise", subcategory: "Access",
    ownerId: "infrastructure", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 400000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Major", likelihood: "Likely" },
    description: "Elevated access grants for infrastructure changes aren't consistently revoked once the associated work is complete.",
    milestones: [
      { title: "Automate time-boxed privileged access expiry", status: "in_progress", due: "2026-08-10" },
      { title: "Quarterly recertification of standing access", status: "not_started", due: "2026-09-01" },
    ],
  },
  {
    id: "RISK-003", scenario: "Deletion requests exceed regulatory timeline", domain: "Enterprise", subcategory: "Regulatory",
    ownerId: "data-platform", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 250000,
    inherent: { severity: "Major", likelihood: "Almost Certain" }, residual: { severity: "Major", likelihood: "Possible" },
    description: "Manual deletion workflows across data stores occasionally miss the regulatory response window for erasure requests.",
    milestones: [{ title: "Automate deletion propagation across data stores", status: "in_progress", due: "2026-08-20" }],
  },
  {
    id: "RISK-004", scenario: "Vendor security assessments falling behind schedule", domain: "Enterprise", subcategory: "Third-Party",
    ownerId: "grc", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 900000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "A backlog of vendor reassessments means several critical vendors are operating past their review cycle.",
    milestones: [
      { title: "Clear reassessment backlog for critical vendors", status: "blocked", due: "2026-07-25" },
      { title: "Escalate staffing gap to Head of GRC", status: "in_progress", due: "2026-07-28" },
    ],
  },
  {
    id: "RISK-005", scenario: "Encryption key rotation not automated", domain: "Product", subcategory: "Cryptography",
    ownerId: "platform-eng", appetite: 6, treatment: "Accept", treatmentAtRisk: false, escalated: false, exposure: 0,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Unlikely" },
    description: "Key rotation is performed manually on a defined schedule rather than automatically — residual risk is within appetite.",
    milestones: [{ title: "Risk acceptance documented and approved", status: "done", due: "2026-06-01" }],
  },
  {
    id: "RISK-006", scenario: "Internal network segmentation incomplete post cloud migration", domain: "Enterprise", subcategory: "Network",
    ownerId: "infrastructure", appetite: 8, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 600000,
    inherent: { severity: "Severe", likelihood: "Possible" }, residual: { severity: "Major", likelihood: "Unlikely" },
    description: "Some workloads migrated to cloud infrastructure haven't yet been placed behind the intended segmentation boundary.",
    milestones: [{ title: "Complete segmentation for remaining workloads", status: "in_progress", due: "2026-08-05" }],
  },
  {
    id: "RISK-007", scenario: "Customer PII exported without DLP enforcement", domain: "Product", subcategory: "Privacy",
    ownerId: "product-security", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 1500000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "Export functionality doesn't yet enforce DLP scanning, so PII can leave the environment without inspection.",
    milestones: [
      { title: "Deploy DLP scanning on all export paths", status: "in_progress", due: "2026-07-30" },
      { title: "Executive review of interim compensating control", status: "not_started", due: "2026-08-02" },
    ],
  },
  {
    id: "RISK-008", scenario: "Single point of failure in backup restoration process", domain: "Enterprise", subcategory: "Continuity",
    ownerId: "infrastructure", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 300000,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Possible" },
    description: "Restoration depends on a single engineer's runbook knowledge that hasn't been fully documented or cross-trained.",
    milestones: [{ title: "Document and cross-train restoration runbook", status: "in_progress", due: "2026-08-12" }],
  },
  {
    id: "RISK-009", scenario: "Third-party API integration lacks authentication review", domain: "Product", subcategory: "API",
    ownerId: "engineering", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 350000,
    inherent: { severity: "Major", likelihood: "Likely" }, residual: { severity: "Major", likelihood: "Possible" },
    description: "A newly integrated partner API was connected before its authentication scheme received a security review.",
    milestones: [{ title: "Complete authentication review of partner integration", status: "not_started", due: "2026-08-08" }],
  },
  {
    id: "RISK-010", scenario: "Employee offboarding access revocation delayed", domain: "Enterprise", subcategory: "HR",
    ownerId: "it", appetite: 6, treatment: "Accept", treatmentAtRisk: false, escalated: false, exposure: 0,
    inherent: { severity: "Moderate", likelihood: "Possible" }, residual: { severity: "Minor", likelihood: "Unlikely" },
    description: "A small number of offboarding tickets have missed the 24-hour access revocation target; residual risk is within appetite.",
    milestones: [{ title: "Risk acceptance documented and approved", status: "done", due: "2026-05-15" }],
  },
  {
    id: "RISK-011", scenario: "AI model outputs lack bias/security review", domain: "Product", subcategory: "AI Governance",
    ownerId: "ml-platform-team", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 150000,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Possible" },
    description: "New model outputs are shipped without a formal security or bias review step ahead of production use.",
    milestones: [{ title: "Stand up pre-release model review process", status: "in_progress", due: "2026-08-18" }],
  },
  {
    id: "RISK-012", scenario: "Incident response runbook untested in 12 months", domain: "Enterprise", subcategory: "Incident Response",
    ownerId: "secops", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 100000,
    inherent: { severity: "Moderate", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Unlikely" },
    description: "The current incident response runbook hasn't been tabletop-tested since last year's audit cycle.",
    milestones: [{ title: "Schedule and run tabletop exercise", status: "not_started", due: "2026-09-01" }],
  },
  {
    id: "RISK-013", scenario: "Physical access badge deactivation lag at satellite office", domain: "Enterprise", subcategory: "Physical",
    ownerId: "facilities", appetite: 6, treatment: "Accept", treatmentAtRisk: false, escalated: false, exposure: 0,
    inherent: { severity: "Minor", likelihood: "Unlikely" }, residual: { severity: "Minor", likelihood: "Rare" },
    description: "A satellite office's badge system syncs with HR data on a delay of up to 48 hours.",
    milestones: [{ title: "Risk acceptance documented and approved", status: "done", due: "2026-04-20" }],
  },
  {
    id: "RISK-014", scenario: "Configuration drift in production Kubernetes clusters", domain: "Product", subcategory: "Configuration",
    ownerId: "platform-eng", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 200000,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Possible" },
    description: "Manual hotfixes applied directly to clusters occasionally diverge from the version-controlled baseline configuration.",
    milestones: [{ title: "Enforce GitOps-only changes to production clusters", status: "in_progress", due: "2026-08-22" }],
  },
  {
    id: "RISK-015", scenario: "Model Distillation & IP Theft", domain: "Product", subcategory: "AI Governance",
    materialLabel: "Theft of proprietary model/IP or training assets",
    ownerId: "ml-platform-team", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 2500000,
    inherent: { severity: "Severe", likelihood: "Almost Certain" }, residual: { severity: "Severe", likelihood: "Likely" },
    description: "Third parties could query production model APIs at scale to distill proprietary model behavior into their own models, exfiltrating IP without a traditional data breach.",
    milestones: [
      { title: "Deploy query-pattern rate limiting and distillation detection", status: "in_progress", due: "2026-08-14" },
      { title: "Legal review of API terms of service for automated extraction", status: "not_started", due: "2026-08-20" },
    ],
  },
  {
    id: "RISK-016", scenario: "AI agent causes large-scale unauthorized actions", domain: "Product", subcategory: "AI Governance",
    ownerId: "ml-platform-team", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 4200000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "Agentic product features with tool-calling access to payments, data deletion, or production systems could be manipulated through prompt injection or insufficient guardrails into taking unauthorized, high-impact actions without a human in the loop.",
    milestones: [
      { title: "Require human-in-the-loop approval for high-risk agent actions", status: "in_progress", due: "2026-08-16" },
      { title: "Deploy prompt-injection detection on agent tool-calling inputs", status: "not_started", due: "2026-08-25" },
    ],
  },
  {
    id: "RISK-017", scenario: "Systemic corruption/poisoning of the core model", domain: "Product", subcategory: "AI Governance",
    ownerId: "ml-platform-team", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 3000000,
    inherent: { severity: "Severe", likelihood: "Possible" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "Training and retrieval-augmented data pipelines lack integrity controls sufficient to detect a malicious or corrupted data source, which could alter model behavior, introduce backdoors, or degrade output quality across the entire production model.",
    milestones: [
      { title: "Implement provenance checks and anomaly detection on training/retrieval data sources", status: "in_progress", due: "2026-08-20" },
      { title: "Establish model behavior regression baseline for drift detection", status: "not_started", due: "2026-09-05" },
    ],
  },
  {
    id: "RISK-018", scenario: "Extended loss of the production AI platform", domain: "Enterprise", subcategory: "Continuity",
    ownerId: "infrastructure", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 2800000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "The model-serving layer, GPU fleet, and vector store lack multi-region failover, so a prolonged outage of any single dependency — cloud region, hosting provider, or primary model API — would take the core AI product offline with no tested recovery path.",
    milestones: [
      { title: "Stand up multi-region failover for the model-serving layer", status: "in_progress", due: "2026-09-01" },
      { title: "Run tabletop exercise for an extended AI platform outage", status: "not_started", due: "2026-09-15" },
    ],
  },
];

export const RISK_BY_ID = Object.fromEntries(RISKS.map((r) => [r.id, r]));

// The board's chosen set of catastrophic loss scenarios. A curatorial call —
// which of the tracked risks the board actually needs to see, not whatever an
// automatic threshold happens to select this month. engine/risk.js still
// asserts each one independently clears the material bar, so the curation can
// narrow the list but never smuggle in something that doesn't qualify.
export const BOARD_MATERIAL_RISK_IDS = ["RISK-001", "RISK-015", "RISK-016", "RISK-017", "RISK-018"];
