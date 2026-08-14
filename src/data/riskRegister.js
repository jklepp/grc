// Shared by the Risk Register page and the Executive Dashboard so both report
// the same risk counts, scores, and appetite-compliance figures.
import { CATEGORY_PORTFOLIO_AVERAGES } from "./assets";
import { ASSURANCE_TARGET, assuranceBand } from "./assuranceModel";

export const SEVERITY_VALUE = { Minor: 1, Moderate: 2, Major: 3, Severe: 4 };
export const LIKELIHOOD_VALUE = { Rare: 1, Unlikely: 2, Possible: 3, Likely: 4, "Almost Certain": 5 };

export function score(sev, like) {
  return SEVERITY_VALUE[sev] * LIKELIHOOD_VALUE[like];
}

export const RISKS = [
  {
    id: "RISK-001", scenario: "Cross-tenant data exposure through authorization defect", domain: "Product", subcategory: "Confidentiality",
    materialLabel: "Mass cross-tenant/customer data breach",
    owner: "Platform Eng", linkedControl: "Access Control", appetite: 8, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 12750000,
    inherent: { severity: "Severe", likelihood: "Almost Certain" }, residual: { severity: "Severe", likelihood: "Likely" },
    description: "A multi-tenant authorization check could allow one customer's session to access another's data under specific query conditions.",
    milestones: [
      { title: "Patch authorization check in shared query layer", status: "in_progress", due: "2026-08-01" },
      { title: "Regression test across all tenant boundaries", status: "not_started", due: "2026-08-15" },
    ],
  },
  {
    id: "RISK-002", scenario: "Privileged access persists beyond operational need", domain: "Enterprise", subcategory: "Access",
    owner: "Infrastructure", linkedControl: "Identity & Access Management", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 400000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Major", likelihood: "Likely" },
    description: "Elevated access grants for infrastructure changes aren't consistently revoked once the associated work is complete.",
    milestones: [
      { title: "Automate time-boxed privileged access expiry", status: "in_progress", due: "2026-08-10" },
      { title: "Quarterly recertification of standing access", status: "not_started", due: "2026-09-01" },
    ],
  },
  {
    id: "RISK-003", scenario: "Deletion requests exceed regulatory timeline", domain: "Enterprise", subcategory: "Regulatory",
    owner: "Data Platform", linkedControl: "Data Retention & Disposal", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 250000,
    inherent: { severity: "Major", likelihood: "Almost Certain" }, residual: { severity: "Major", likelihood: "Possible" },
    description: "Manual deletion workflows across data stores occasionally miss the regulatory response window for erasure requests.",
    milestones: [{ title: "Automate deletion propagation across data stores", status: "in_progress", due: "2026-08-20" }],
  },
  {
    id: "RISK-004", scenario: "Vendor security assessments falling behind schedule", domain: "Enterprise", subcategory: "Third-Party",
    owner: "GRC", linkedControl: "Third-Party / Vendor Risk", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 900000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "A backlog of vendor reassessments means several critical vendors are operating past their review cycle.",
    milestones: [
      { title: "Clear reassessment backlog for critical vendors", status: "blocked", due: "2026-07-25" },
      { title: "Escalate staffing gap to Head of GRC", status: "in_progress", due: "2026-07-28" },
    ],
  },
  {
    id: "RISK-005", scenario: "Encryption key rotation not automated", domain: "Product", subcategory: "Cryptography",
    owner: "Platform Eng", linkedControl: "Cryptography & Key Management", appetite: 6, treatment: "Accept", treatmentAtRisk: false, escalated: false, exposure: 0,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Unlikely" },
    description: "Key rotation is performed manually on a defined schedule rather than automatically — residual risk is within appetite.",
    milestones: [{ title: "Risk acceptance documented and approved", status: "done", due: "2026-06-01" }],
  },
  {
    id: "RISK-006", scenario: "Internal network segmentation incomplete post cloud migration", domain: "Enterprise", subcategory: "Network",
    owner: "Infrastructure", linkedControl: "Network Security", appetite: 8, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 600000,
    inherent: { severity: "Severe", likelihood: "Possible" }, residual: { severity: "Major", likelihood: "Unlikely" },
    description: "Some workloads migrated to cloud infrastructure haven't yet been placed behind the intended segmentation boundary.",
    milestones: [{ title: "Complete segmentation for remaining workloads", status: "in_progress", due: "2026-08-05" }],
  },
  {
    id: "RISK-007", scenario: "Customer PII exported without DLP enforcement", domain: "Product", subcategory: "Privacy",
    owner: "Product Security", linkedControl: "Data Classification & Handling", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 1500000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "Export functionality doesn't yet enforce DLP scanning, so PII can leave the environment without inspection.",
    milestones: [
      { title: "Deploy DLP scanning on all export paths", status: "in_progress", due: "2026-07-30" },
      { title: "Executive review of interim compensating control", status: "not_started", due: "2026-08-02" },
    ],
  },
  {
    id: "RISK-008", scenario: "Single point of failure in backup restoration process", domain: "Enterprise", subcategory: "Continuity",
    owner: "Infrastructure", linkedControl: "Backup & Recovery", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 300000,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Possible" },
    description: "Restoration depends on a single engineer's runbook knowledge that hasn't been fully documented or cross-trained.",
    milestones: [{ title: "Document and cross-train restoration runbook", status: "in_progress", due: "2026-08-12" }],
  },
  {
    id: "RISK-009", scenario: "Third-party API integration lacks authentication review", domain: "Product", subcategory: "API",
    owner: "Engineering", linkedControl: "API Security", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 350000,
    inherent: { severity: "Major", likelihood: "Likely" }, residual: { severity: "Major", likelihood: "Possible" },
    description: "A newly integrated partner API was connected before its authentication scheme received a security review.",
    milestones: [{ title: "Complete authentication review of partner integration", status: "not_started", due: "2026-08-08" }],
  },
  {
    id: "RISK-010", scenario: "Employee offboarding access revocation delayed", domain: "Enterprise", subcategory: "HR",
    owner: "IT", linkedControl: "Access Control", appetite: 6, treatment: "Accept", treatmentAtRisk: false, escalated: false, exposure: 0,
    inherent: { severity: "Moderate", likelihood: "Possible" }, residual: { severity: "Minor", likelihood: "Unlikely" },
    description: "A small number of offboarding tickets have missed the 24-hour access revocation target; residual risk is within appetite.",
    milestones: [{ title: "Risk acceptance documented and approved", status: "done", due: "2026-05-15" }],
  },
  {
    id: "RISK-011", scenario: "AI model outputs lack bias/security review", domain: "Product", subcategory: "AI Governance",
    owner: "ML Eng", linkedControl: "AI Governance", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 150000,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Possible" },
    description: "New model outputs are shipped without a formal security or bias review step ahead of production use.",
    milestones: [{ title: "Stand up pre-release model review process", status: "in_progress", due: "2026-08-18" }],
  },
  {
    id: "RISK-012", scenario: "Incident response runbook untested in 12 months", domain: "Enterprise", subcategory: "Incident Response",
    owner: "SecOps", linkedControl: "Incident Response", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 100000,
    inherent: { severity: "Moderate", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Unlikely" },
    description: "The current incident response runbook hasn't been tabletop-tested since last year's audit cycle.",
    milestones: [{ title: "Schedule and run tabletop exercise", status: "not_started", due: "2026-09-01" }],
  },
  {
    id: "RISK-013", scenario: "Physical access badge deactivation lag at satellite office", domain: "Enterprise", subcategory: "Physical",
    owner: "Facilities", linkedControl: "Physical & Environmental Security", appetite: 6, treatment: "Accept", treatmentAtRisk: false, escalated: false, exposure: 0,
    inherent: { severity: "Minor", likelihood: "Unlikely" }, residual: { severity: "Minor", likelihood: "Rare" },
    description: "A satellite office's badge system syncs with HR data on a delay of up to 48 hours.",
    milestones: [{ title: "Risk acceptance documented and approved", status: "done", due: "2026-04-20" }],
  },
  {
    id: "RISK-014", scenario: "Configuration drift in production Kubernetes clusters", domain: "Product", subcategory: "Configuration",
    owner: "Platform Eng", linkedControl: "Configuration Management", appetite: 6, treatment: "Mitigate", treatmentAtRisk: false, escalated: false, exposure: 200000,
    inherent: { severity: "Major", likelihood: "Possible" }, residual: { severity: "Moderate", likelihood: "Possible" },
    description: "Manual hotfixes applied directly to clusters occasionally diverge from the version-controlled baseline configuration.",
    milestones: [{ title: "Enforce GitOps-only changes to production clusters", status: "in_progress", due: "2026-08-22" }],
  },
  {
    id: "RISK-015", scenario: "Model Distillation & IP Theft", domain: "Product", subcategory: "AI Governance",
    materialLabel: "Theft of proprietary model/IP or training assets",
    owner: "ML Eng", linkedControl: "AI Governance", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 2500000,
    inherent: { severity: "Severe", likelihood: "Almost Certain" }, residual: { severity: "Severe", likelihood: "Likely" },
    description: "Third parties could query production model APIs at scale to distill proprietary model behavior into their own models, exfiltrating IP without a traditional data breach.",
    milestones: [
      { title: "Deploy query-pattern rate limiting and distillation detection", status: "in_progress", due: "2026-08-14" },
      { title: "Legal review of API terms of service for automated extraction", status: "not_started", due: "2026-08-20" },
    ],
  },
  {
    id: "RISK-016", scenario: "AI agent causes large-scale unauthorized actions", domain: "Product", subcategory: "AI Governance",
    owner: "ML Eng", linkedControl: "AI Governance", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: true, exposure: 4200000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "Agentic product features with tool-calling access to payments, data deletion, or production systems could be manipulated through prompt injection or insufficient guardrails into taking unauthorized, high-impact actions without a human in the loop.",
    milestones: [
      { title: "Require human-in-the-loop approval for high-risk agent actions", status: "in_progress", due: "2026-08-16" },
      { title: "Deploy prompt-injection detection on agent tool-calling inputs", status: "not_started", due: "2026-08-25" },
    ],
  },
  {
    id: "RISK-017", scenario: "Systemic corruption/poisoning of the core model", domain: "Product", subcategory: "AI Governance",
    owner: "ML Eng", linkedControl: "AI Governance", appetite: 5, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 3000000,
    inherent: { severity: "Severe", likelihood: "Possible" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "Training and retrieval-augmented data pipelines lack integrity controls sufficient to detect a malicious or corrupted data source, which could alter model behavior, introduce backdoors, or degrade output quality across the entire production model.",
    milestones: [
      { title: "Implement provenance checks and anomaly detection on training/retrieval data sources", status: "in_progress", due: "2026-08-20" },
      { title: "Establish model behavior regression baseline for drift detection", status: "not_started", due: "2026-09-05" },
    ],
  },
  {
    id: "RISK-018", scenario: "Extended loss of the production AI platform", domain: "Enterprise", subcategory: "Continuity",
    owner: "Infrastructure", linkedControl: "Backup & Recovery", appetite: 6, treatment: "Mitigate", treatmentAtRisk: true, escalated: false, exposure: 2800000,
    inherent: { severity: "Severe", likelihood: "Likely" }, residual: { severity: "Severe", likelihood: "Possible" },
    description: "The model-serving layer, GPU fleet, and vector store lack multi-region failover, so a prolonged outage of any single dependency — cloud region, hosting provider, or primary model API — would take the core AI product offline with no tested recovery path.",
    milestones: [
      { title: "Stand up multi-region failover for the model-serving layer", status: "in_progress", due: "2026-09-01" },
      { title: "Run tabletop exercise for an extended AI platform outage", status: "not_started", due: "2026-09-15" },
    ],
  },
];

export const ABOVE_APPETITE_COUNT = RISKS.filter(
  (r) => score(r.residual.severity, r.residual.likelihood) > r.appetite
).length;
export const QUANTIFIED_EXPOSURE = RISKS.reduce((a, r) => a + r.exposure, 0);

// A risk clears the bar for board attention when it hits two conditions, not
// one: residual severity at the top tier (Severe) AND the residual score
// still exceeding the org's own appetite for that risk. Used below to
// validate the board's curated material-risk picks, not to auto-generate
// them — see BOARD_MATERIAL_RISK_IDS.
export function isMaterial(r) {
  return r.residual.severity === "Severe" && score(r.residual.severity, r.residual.likelihood) > r.appetite;
}

// ---- Board-level fields for material risks ---------------------------------
// Everything below derives new numbers from fields the risk already carries
// (severity/likelihood tier, exposure, linkedControl, treatmentAtRisk,
// milestones) — nothing here is a second hand-typed figure competing with
// the register above.

// Annualized probability band per residual likelihood tier. A fixed,
// documented judgment call (same pattern as MATURITY_SCORE / EVIDENCE_
// CONFIDENCE in assuranceModel.js), not a per-risk invention.
const LIKELIHOOD_ANNUAL_PROBABILITY = {
  Rare: [1, 5],
  Unlikely: [5, 15],
  Possible: [15, 35],
  Likely: [35, 65],
  "Almost Certain": [65, 90],
};

export function annualProbabilityRange(likelihood) {
  return LIKELIHOOD_ANNUAL_PROBABILITY[likelihood];
}

// Loss magnitude, solved algebraically from the risk's own exposure (already
// treated app-wide as the residual annualized loss expectancy) rather than a
// separately invented dollar figure: ALE = probability x magnitude, so
// magnitude = ALE / probability. The low end of the probability band implies
// the high end of the magnitude band, and vice versa.
export function lossMagnitudeRange(exposure, likelihood) {
  const [probLow, probHigh] = annualProbabilityRange(likelihood);
  return [exposure / (probHigh / 100), exposure / (probLow / 100)];
}

export function computeAppetiteRatio(r) {
  return Math.round((score(r.residual.severity, r.residual.likelihood) / r.appetite) * 10) / 10;
}

// A risk's linkedControl is free text describing which control family it
// sits under (e.g. "AI Governance"), not one of the 6 real Assurance
// Categories — this maps it to the closest category so the risk can cite a
// real portfolio assurance % instead of an invented one. A judgment call,
// same caveat as DOMAIN_ASSURANCE_CATEGORY in assuranceModel.js.
const LINKED_CONTROL_CATEGORY = {
  "Access Control": "Identity & Access",
  "Identity & Access Management": "Identity & Access",
  "Network Security": "Identity & Access",
  "Data Retention & Disposal": "Data Protection",
  "Data Classification & Handling": "Data Protection",
  "Cryptography & Key Management": "Data Protection",
  "Third-Party / Vendor Risk": "Governance",
  "AI Governance": "Governance",
  "Backup & Recovery": "Resilience",
  "Physical & Environmental Security": "Resilience",
  "API Security": "Configuration",
  "Configuration Management": "Configuration",
  "Incident Response": "Detection",
};

export function assuranceForRisk(r) {
  const category = LINKED_CONTROL_CATEGORY[r.linkedControl] || "Governance";
  const pct = CATEGORY_PORTFOLIO_AVERAGES.find((c) => c.label === category).pct;
  return { category, pct, target: ASSURANCE_TARGET, band: assuranceBand(pct) };
}

// Improving/Stalled/Flat from two fields the risk already carries — no
// hand-typed trend arrow. treatmentAtRisk (the register's own signal that a
// treatment plan has slipped) outranks milestone status: a risk can have an
// in-progress milestone and still be flagged at-risk.
export function riskTrend(r) {
  if (r.treatmentAtRisk) return { label: "Stalled", color: "red" };
  if (r.milestones.some((m) => m.status === "done" || m.status === "in_progress")) return { label: "Improving", color: "green" };
  return { label: "Flat", color: "muted" };
}

// The board's chosen set of catastrophic loss scenarios for this company —
// a curatorial call (same caveat as LINKED_CONTROL_CATEGORY / DOMAIN_
// ASSURANCE_CATEGORY: which of the real tracked risks the board actually
// needs to see, not just whatever isMaterial() happens to auto-select today).
// Two reuse an existing risk's underlying data under a board-facing name
// (see materialLabel on RISK-001 / RISK-015 above); three are risk scenarios
// this register didn't previously track and were added above. Every number
// attached to each one below is still fully derived — only which 5
// scenarios to show is a human call.
const BOARD_MATERIAL_RISK_IDS = ["RISK-001", "RISK-015", "RISK-016", "RISK-017", "RISK-018"];

export const MATERIAL_RISKS = BOARD_MATERIAL_RISK_IDS.map((id) => {
  const r = RISKS.find((risk) => risk.id === id);
  if (!r) throw new Error(`riskRegister.js: BOARD_MATERIAL_RISK_IDS references "${id}", which isn't in RISKS`);
  if (!isMaterial(r)) throw new Error(`riskRegister.js: BOARD_MATERIAL_RISK_IDS includes "${id}", but it no longer clears isMaterial() (residual Severe and above appetite) — re-check its rating or drop it from the board list`);
  return {
    ...r,
    boardLabel: r.materialLabel || r.scenario,
    residualScore: score(r.residual.severity, r.residual.likelihood),
    probability: annualProbabilityRange(r.residual.likelihood),
    lossMagnitude: lossMagnitudeRange(r.exposure, r.residual.likelihood),
    appetiteRatio: computeAppetiteRatio(r),
    trend: riskTrend(r),
    assurance: assuranceForRisk(r),
  };
}).sort((a, b) => b.residualScore - a.residualScore || b.exposure - a.exposure);
export const MATERIAL_RISK_EXPOSURE = MATERIAL_RISKS.reduce((a, r) => a + r.exposure, 0);
