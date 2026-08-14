// Asset inventory — one tier below SYSTEMS. A system is a boundary (e.g. "the
// AWS production account"); an asset is a specific resource inside that
// boundary (e.g. one S3 bucket) that can carry its own criticality, control
// posture, and residual risk distinct from its siblings. Every asset links
// back to its parent system via systemId so it inherits real compliance
// coverage from systemRegister.js's controlBreakdown() and its data
// classification from the Systems Register itself — neither is a second
// hand-maintained value that could drift out of sync with its system.
import { SYSTEMS, controlBreakdown } from "./systemRegister";
import {
  ASSURANCE_CATEGORIES,
  criticalityScore,
  criticalityBand,
  categoryAssuranceScore,
  overallControlAssurance,
  evidenceConfidenceScore,
  assuranceBand,
  impactFromCriticality,
  residualLikelihood,
  riskScore,
  riskBand,
  portfolioCategoryAverages,
} from "./assuranceModel";
import { evaluateAssetAgainstProfile } from "./controlProfiles";

export function getSystem(systemId) {
  return SYSTEMS.find((s) => s.id === systemId);
}

export const ASSETS = [
  {
    id: "AST-014-01",
    systemId: "SYS-014",
    name: "prod-customer-records",
    type: "AWS S3 Bucket",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 100, reason: "Major breach if exposed" },
      integrity: { score: 90, reason: "Unauthorized modification highly damaging" },
      availability: { score: 75, reason: "Outage serious but recoverable" },
      regulatory: { score: 95, reason: "Restricted regulated data" },
      businessDependency: { score: 85, reason: "Production workload" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
      Configuration: { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 97 },
      Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 85 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 80 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 98 },
      Resilience: { maturityStage: "Monitored", evidenceType: "Document", effectivenessPct: 85 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-014-02",
    systemId: "SYS-014",
    name: "customer-etl-pipeline",
    type: "AWS Glue ETL Job",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Processes the full PII/financial dataset in transit" },
      integrity: { score: 95, reason: "Corrupted transforms would misstate downstream financial reporting" },
      availability: { score: 70, reason: "Nightly batch job — a delay of a day is tolerable" },
      regulatory: { score: 90, reason: "Handles Restricted-tier regulated data" },
      businessDependency: { score: 80, reason: "Feeds core Finance and Sales reporting" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 88 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 90 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 75 },
      "Identity & Access": { maturityStage: "Monitored", evidenceType: "API configuration observation", effectivenessPct: 78 },
      Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 80 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 65 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-014-03",
    systemId: "SYS-014",
    name: "customer-analytics-redshift",
    type: "AWS Redshift Cluster",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 95, reason: "The queryable BI access layer — full analyst reach across PII/financial data" },
      integrity: { score: 85, reason: "Bad query results directly mislead Finance and Sales reporting" },
      availability: { score: 80, reason: "Daily-use reporting layer for Finance and Sales leadership" },
      regulatory: { score: 90, reason: "Restricted-tier regulated data, queryable rather than at rest" },
      businessDependency: { score: 88, reason: "The system's actual source-of-truth reporting surface" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 88 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 92 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 80 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 95 },
      Resilience: { maturityStage: "Monitored", evidenceType: "Document", effectivenessPct: 82 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-027-01",
    systemId: "SYS-027",
    name: "zendesk-tenant-config",
    type: "SaaS Tenant Configuration",
    provider: "Zendesk",
    criticalityFactors: {
      confidentiality: { score: 95, reason: "PHI and PII shared directly in support tickets" },
      integrity: { score: 70, reason: "Ticket tampering is disruptive but not catastrophic" },
      availability: { score: 60, reason: "Support delays are recoverable, not critical-path" },
      regulatory: { score: 90, reason: "HIPAA-regulated PHI in scope" },
      businessDependency: { score: 65, reason: "Important to support operations, not revenue-critical" },
    },
    categories: {
      "Data Protection": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 45 },
      Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 82 },
      Detection: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 40 },
      "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 60 },
      Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 75 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-027-02",
    systemId: "SYS-027",
    name: "zendesk-attachment-storage",
    type: "SaaS File Storage",
    provider: "Zendesk",
    criticalityFactors: {
      confidentiality: { score: 92, reason: "Customers attach documents that can contain PHI directly, with no DLP inspection today" },
      integrity: { score: 55, reason: "Attachment tampering is disruptive but not the primary exposure" },
      availability: { score: 45, reason: "Attachment retrieval delays are recoverable" },
      regulatory: { score: 88, reason: "Same HIPAA-regulated PHI, at its least-inspected point" },
      businessDependency: { score: 50, reason: "Supports ticket resolution, not itself revenue-critical" },
    },
    categories: {
      "Data Protection": { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 30 },
      Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 78 },
      Detection: { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 25 },
      "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 55 },
      Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 65 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 50 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-031-01",
    systemId: "SYS-031",
    name: "legacy-billing-db",
    type: "On-Prem SQL Database",
    provider: "ACME Data Center",
    criticalityFactors: {
      confidentiality: { score: 85, reason: "Contains customer financial and billing records" },
      integrity: { score: 95, reason: "Billing errors carry direct financial and audit impact" },
      availability: { score: 55, reason: "Legacy system — outage tolerable while migration continues" },
      regulatory: { score: 90, reason: "PCI DSS-relevant financial data" },
      businessDependency: { score: 60, reason: "Serves a shrinking legacy customer segment" },
    },
    categories: {
      "Data Protection": { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 30 },
      Configuration: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 40 },
      Detection: { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 25 },
      "Identity & Access": { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 35 },
      Governance: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 50 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-031-02",
    systemId: "SYS-031",
    name: "billing-backup-storage",
    type: "On-Prem Backup Storage",
    provider: "ACME Data Center",
    criticalityFactors: {
      confidentiality: { score: 82, reason: "Full copy of the same financial and billing records" },
      integrity: { score: 75, reason: "A corrupted backup is discovered only when a restore is actually needed" },
      availability: { score: 45, reason: "Not queried live — only matters at recovery time" },
      regulatory: { score: 85, reason: "Same PCI DSS-relevant financial data, at rest in a second location" },
      businessDependency: { score: 55, reason: "The only recovery path for a shrinking but still-live legacy workload" },
    },
    categories: {
      "Data Protection": { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 28 },
      Configuration: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 35 },
      Detection: { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 20 },
      "Identity & Access": { maturityStage: "Policy", evidenceType: "Self-attestation", effectivenessPct: 30 },
      Governance: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 45 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 40 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-01",
    systemId: "SYS-042",
    name: "workday-hr-tenant",
    type: "SaaS Tenant Configuration",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Full employee PII including compensation" },
      integrity: { score: 80, reason: "Incorrect HR data affects pay and benefits" },
      availability: { score: 65, reason: "HR operations tolerate short outages" },
      regulatory: { score: 85, reason: "GDPR-regulated personal data" },
      businessDependency: { score: 75, reason: "Core system of record for all employees" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 92 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 90 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 82 },
      "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 70 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 90 },
      Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 70 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-02",
    systemId: "SYS-042",
    name: "workday-payroll-integration",
    type: "SaaS Integration Endpoint",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 88, reason: "Compensation data flowing to the external payroll processor" },
      integrity: { score: 85, reason: "A bad payroll run has direct financial and legal consequences" },
      availability: { score: 60, reason: "Runs on a fixed pay-cycle schedule, not continuously" },
      regulatory: { score: 82, reason: "GDPR-regulated personal data, plus payroll-specific obligations" },
      businessDependency: { score: 78, reason: "Every employee's pay depends on this integration succeeding" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 88 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 78 },
      "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 65 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 85 },
      Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-055-01",
    systemId: "SYS-055",
    name: "marketing-analytics-warehouse",
    type: "BigQuery Dataset",
    provider: "GCP",
    criticalityFactors: {
      confidentiality: { score: 75, reason: "Aggregated customer PII used for analytics" },
      integrity: { score: 65, reason: "Bad data skews marketing decisions, not customer-facing" },
      availability: { score: 55, reason: "Analytics workloads tolerate delay" },
      regulatory: { score: 80, reason: "GDPR-regulated personal data" },
      businessDependency: { score: 60, reason: "Informs marketing spend, not core revenue path" },
    },
    categories: {
      "Data Protection": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 50 },
      Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 80 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 78 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 72 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-055-02",
    systemId: "SYS-055",
    name: "marketing-export-bucket",
    type: "GCS Bucket",
    provider: "GCP",
    criticalityFactors: {
      confidentiality: { score: 80, reason: "Export path — PII leaves the controlled environment if misconfigured" },
      integrity: { score: 60, reason: "Export integrity matters less than what leaves the boundary" },
      availability: { score: 50, reason: "Export delay has minimal operational impact" },
      regulatory: { score: 82, reason: "Same GDPR-regulated data at its highest-exposure point" },
      businessDependency: { score: 55, reason: "Feeds downstream marketing tooling, not core operations" },
    },
    categories: {
      "Data Protection": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 55 },
      Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Detection: { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 65 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 82 },
      Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 70 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 50 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-055-03",
    systemId: "SYS-055",
    name: "campaign-personalization-service",
    type: "GCP Cloud Run Service",
    provider: "GCP",
    criticalityFactors: {
      confidentiality: { score: 70, reason: "Reads the same aggregated PII to personalize live campaigns" },
      integrity: { score: 58, reason: "Bad personalization is a poor customer experience, not a safety issue" },
      availability: { score: 60, reason: "Directly affects live marketing campaigns when down" },
      regulatory: { score: 76, reason: "Same GDPR-regulated personal data, now driving an automated decision" },
      businessDependency: { score: 62, reason: "Supports campaign performance, not core product revenue" },
    },
    categories: {
      "Data Protection": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 48 },
      Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 78 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 72 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 82 },
      Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 52 },
    },
    inherentLikelihood: 3,
  },
];

// The one derivation function every consumer (Asset Register, Control
// Profile) calls — computes every card metric from an asset's raw inputs plus
// its parent system's real control breakdown, so nothing here is a second
// hand-typed number competing with systemRegister.js.
export function assetSummary(asset) {
  const system = getSystem(asset.systemId);
  // An asset's classification isn't its own hand-typed judgment call — it's
  // inside its parent system's boundary, so it carries that boundary's real
  // classification (Systems Register) rather than a second value that could
  // silently drift out of sync with it.
  const classification = system.classification;

  const factors = {};
  Object.keys(asset.criticalityFactors).forEach((k) => (factors[k] = asset.criticalityFactors[k].score));
  const criticality = criticalityScore(factors);

  const categoryScores = {};
  ASSURANCE_CATEGORIES.forEach((category) => {
    categoryScores[category] = categoryAssuranceScore(asset.categories[category]);
  });
  const overallAssurance = overallControlAssurance(categoryScores);
  const evidenceConfidence = evidenceConfidenceScore(asset.categories);

  const breakdown = controlBreakdown(system);
  const complianceCoveragePct = Math.round(((breakdown.satisfied + breakdown.inherited) / breakdown.required) * 100);

  const impact = impactFromCriticality(criticality);
  const inherentScore = riskScore(asset.inherentLikelihood, impact);
  const residualLikely = residualLikelihood(asset.inherentLikelihood, overallAssurance);
  const residualScore = riskScore(residualLikely, impact);

  return {
    ...asset,
    system,
    classification,
    criticality,
    criticalityBand: criticalityBand(criticality),
    categoryScores,
    overallAssurance,
    assuranceBand: assuranceBand(overallAssurance),
    evidenceConfidence,
    evidenceConfidenceBand: assuranceBand(evidenceConfidence),
    complianceCoveragePct,
    impact,
    inherentRisk: { likelihood: asset.inherentLikelihood, impact, score: inherentScore, band: riskBand(inherentScore) },
    residualRisk: { likelihood: residualLikely, impact, score: residualScore, band: riskBand(residualScore) },
    profileEvaluation: evaluateAssetAgainstProfile(classification, asset.categories),
  };
}

export const ASSET_SUMMARIES = ASSETS.map(assetSummary);

// Real, already-computed portfolio assurance per category — the single
// source other pages (Executive Dashboard, Risk Register's board view) pull
// from instead of each recomputing its own average over ASSET_SUMMARIES.
export const CATEGORY_PORTFOLIO_AVERAGES = portfolioCategoryAverages(ASSET_SUMMARIES);
