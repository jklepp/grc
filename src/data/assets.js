// Asset inventory — one tier below SYSTEMS. A system is a boundary (e.g. "the
// AWS production account"); an asset is a specific resource inside that
// boundary (e.g. one S3 bucket) that can carry its own criticality, control
// posture, and residual risk distinct from its siblings. Every asset links
// back to its parent system via systemId so it inherits real compliance
// coverage from systemRegister.js's controlBreakdown() rather than a second
// hand-maintained number.
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
    classification: "Restricted",
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
    classification: "Restricted",
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
    id: "AST-027-01",
    systemId: "SYS-027",
    name: "zendesk-tenant-config",
    type: "SaaS Tenant Configuration",
    provider: "Zendesk",
    classification: "Restricted",
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
    id: "AST-031-01",
    systemId: "SYS-031",
    name: "legacy-billing-db",
    type: "On-Prem SQL Database",
    provider: "ACME Data Center",
    classification: "Restricted",
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
    id: "AST-042-01",
    systemId: "SYS-042",
    name: "workday-hr-tenant",
    type: "SaaS Tenant Configuration",
    provider: "Workday",
    classification: "Confidential",
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
    id: "AST-055-01",
    systemId: "SYS-055",
    name: "marketing-analytics-warehouse",
    type: "BigQuery Dataset",
    provider: "GCP",
    classification: "Confidential",
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
    classification: "Confidential",
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
];

// The one derivation function every consumer (Asset Register, Control
// Profile) calls — computes every card metric from an asset's raw inputs plus
// its parent system's real control breakdown, so nothing here is a second
// hand-typed number competing with systemRegister.js.
export function assetSummary(asset) {
  const system = getSystem(asset.systemId);

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
    profileEvaluation: evaluateAssetAgainstProfile(asset.classification, asset.categories),
  };
}

export const ASSET_SUMMARIES = ASSETS.map(assetSummary);
