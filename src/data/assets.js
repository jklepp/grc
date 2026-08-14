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
    id: "AST-003-01",
    systemId: "SYS-003",
    name: "API Gateway",
    type: "AWS API Gateway",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 85, reason: "Public-facing entry point; auth tokens and request payloads pass through it" },
      integrity: { score: 75, reason: "Request tampering or auth bypass here compounds through everything downstream" },
      availability: { score: 92, reason: "Every customer-facing AI feature depends on this single ingress point" },
      regulatory: { score: 85, reason: "Restricted-tier customer data transits this boundary on every call" },
      businessDependency: { score: 95, reason: "The sole entry point for the AI platform's revenue-generating features" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 92 },
      Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 88 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 92 },
      Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 85 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-003-02",
    systemId: "SYS-003",
    name: "ECS Model Service",
    type: "AWS ECS Service (Fargate)",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 80, reason: "Holds model weights and processes customer prompts/completions in memory" },
      integrity: { score: 85, reason: "A tampered or compromised container could return manipulated outputs at scale" },
      availability: { score: 88, reason: "Core inference path — an outage takes every AI feature down" },
      regulatory: { score: 80, reason: "Processes Restricted-tier customer data as part of inference" },
      businessDependency: { score: 92, reason: "The actual compute running the product's core AI capability" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 87 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 90 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 78 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 88 },
      Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 80 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-003-03",
    systemId: "SYS-003",
    name: "RAG Service",
    type: "AWS ECS Service (Fargate)",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 88, reason: "Retrieves and injects customer-specific documents into model context at query time" },
      integrity: { score: 78, reason: "Poisoned or wrong retrieval results directly bias what the model returns to customers" },
      availability: { score: 75, reason: "Degrades to base-model answers rather than a hard outage if retrieval fails" },
      regulatory: { score: 82, reason: "Pulls Restricted-tier customer records into live prompts" },
      businessDependency: { score: 80, reason: "Differentiates the product's AI answers from a generic base model" },
    },
    categories: {
      "Data Protection": { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 72 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 70 },
      "Identity & Access": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 42 },
      Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-003-04",
    systemId: "SYS-003",
    name: "Vector Database",
    type: "Amazon OpenSearch Service (Vector Engine)",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Stores dense-vector embeddings of customer documents, re-identifiable via inversion" },
      integrity: { score: 70, reason: "Corrupted embeddings quietly degrade retrieval quality with no obvious signal" },
      availability: { score: 65, reason: "The RAG service degrades gracefully, so this isn't a hard-availability dependency" },
      regulatory: { score: 85, reason: "Embeddings are derived directly from Restricted-tier source documents" },
      businessDependency: { score: 72, reason: "Backs the retrieval quality that differentiates the product" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 85 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 75 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 82 },
      Governance: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 48 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 50 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-003-05",
    systemId: "SYS-003",
    name: "prod-customer-data S3",
    type: "AWS S3 Bucket",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 98, reason: "The platform's primary at-rest store of raw customer documents used for RAG ingestion" },
      integrity: { score: 88, reason: "Corrupted source data propagates into every downstream embedding and inference" },
      availability: { score: 70, reason: "Ingestion tolerates short delay; live queries don't read this bucket directly" },
      regulatory: { score: 95, reason: "Restricted-tier PII at rest" },
      businessDependency: { score: 85, reason: "The ground-truth source every RAG answer traces back to" },
    },
    categories: {
      "Data Protection": { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 78 },
      Configuration: { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 95 },
      Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 85 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 90 },
      Resilience: { maturityStage: "Monitored", evidenceType: "Document", effectivenessPct: 78 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-003-06",
    systemId: "SYS-003",
    name: "RDS Metadata Database",
    type: "AWS RDS (PostgreSQL)",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 70, reason: "Stores conversation/session metadata and customer identifiers, not raw document content" },
      integrity: { score: 82, reason: "Metadata drives access scoping and usage attribution across the platform" },
      availability: { score: 80, reason: "Session and audit metadata is read on every live request" },
      regulatory: { score: 75, reason: "Contains customer identifiers tied to Restricted-tier records" },
      businessDependency: { score: 78, reason: "Backs usage attribution, auditing, and per-customer access scoping" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 86 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 76 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 84 },
      Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 80 },
      Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-003-07",
    systemId: "SYS-003",
    name: "KMS Key",
    type: "AWS KMS Key",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 92, reason: "The root cryptographic key protecting every other asset in this system's boundary" },
      integrity: { score: 95, reason: "Unauthorized rotation or deletion could render the platform's data unrecoverable" },
      availability: { score: 90, reason: "Every read or write of encrypted data depends on this key being available" },
      regulatory: { score: 90, reason: "Key management is a direct regulatory control point for all encrypted Restricted-tier data" },
      businessDependency: { score: 90, reason: "The single point of cryptographic trust for the whole platform" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 95 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 96 },
      Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 92 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 94 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 96 },
      Resilience: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 90 },
    },
    inherentLikelihood: 2,
  },
  {
    id: "AST-003-08",
    systemId: "SYS-003",
    name: "Secrets Manager",
    type: "AWS Secrets Manager",
    provider: "AWS",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Brokers database credentials, API keys, and third-party model provider secrets" },
      integrity: { score: 85, reason: "A tampered secret could redirect traffic or grant unauthorized system access" },
      availability: { score: 82, reason: "Every service in the boundary resolves credentials through this at runtime" },
      regulatory: { score: 80, reason: "Secrets gate access to every Restricted-tier data store in the boundary" },
      businessDependency: { score: 82, reason: "Underpins every service-to-service authentication in the platform" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 92 },
      Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 85 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
      Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 90 },
      Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 80 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-01",
    systemId: "SYS-042",
    name: "Production Tenant",
    type: "SaaS Tenant Configuration",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Full employee PII including compensation, benefits, and HR records" },
      integrity: { score: 82, reason: "Incorrect HR data affects pay, benefits, and org records enterprise-wide" },
      availability: { score: 68, reason: "HR operations tolerate short outages; still the core system of record" },
      regulatory: { score: 85, reason: "GDPR-regulated personal data" },
      businessDependency: { score: 78, reason: "Core system of record for all employees" },
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
    name: "API Endpoint",
    type: "SaaS API Endpoint",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 85, reason: "Public-facing integration entry point; auth tokens and HR/payroll payloads pass through it" },
      integrity: { score: 78, reason: "Request tampering or auth bypass here compounds through every downstream integration" },
      availability: { score: 80, reason: "Every integration — payroll, identity, exports — depends on this single ingress point" },
      regulatory: { score: 80, reason: "GDPR-regulated personal data transits this boundary on every call" },
      businessDependency: { score: 82, reason: "The sole integration entry point for every connected system" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 88 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 90 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 80 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 78 },
      Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 78 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-03",
    systemId: "SYS-042",
    name: "Integration Service Account",
    type: "SaaS Service Account",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 92, reason: "A compromised service account grants broad programmatic access across the whole tenant" },
      integrity: { score: 88, reason: "Misuse could silently read or alter HR and payroll data through the API" },
      availability: { score: 55, reason: "Credential rotation causes brief integration downtime, not a hard outage" },
      regulatory: { score: 80, reason: "Gates programmatic access to every category of GDPR-regulated personal data in scope" },
      businessDependency: { score: 78, reason: "Every downstream integration authenticates through this single account" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 88 },
      Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 75 },
      Detection: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 45 },
      "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 65 },
      Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 75 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-042-04",
    systemId: "SYS-042",
    name: "Payroll Connector",
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
    id: "AST-042-05",
    systemId: "SYS-042",
    name: "Identity Connector",
    type: "SaaS Integration Endpoint",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 78, reason: "Provisions and deprovisions employee identity and access across every connected system" },
      integrity: { score: 88, reason: "A broken or delayed deprovisioning run leaves terminated employees with active access" },
      availability: { score: 68, reason: "Identity sync runs on a scheduled cadence rather than continuously" },
      regulatory: { score: 76, reason: "Access lifecycle events are a direct control point for GDPR's security-of-processing article" },
      businessDependency: { score: 80, reason: "Access lifecycle across every connected system depends on this feed being accurate" },
    },
    categories: {
      "Data Protection": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 82 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 75 },
      "Identity & Access": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
      Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 78 },
      Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 65 },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-06",
    systemId: "SYS-042",
    name: "Data Export Endpoint",
    type: "SaaS Export Endpoint",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Bulk employee PII and compensation data leave the tenant boundary through this endpoint" },
      integrity: { score: 65, reason: "Export integrity matters less than what leaves the boundary" },
      availability: { score: 50, reason: "Export delay has minimal operational impact" },
      regulatory: { score: 85, reason: "The highest-exposure point for GDPR-regulated personal data leaving the tenant" },
      businessDependency: { score: 55, reason: "Feeds downstream reporting and analytics, not core HR operations" },
    },
    categories: {
      "Data Protection": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 50 },
      Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 78 },
      Detection: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 42 },
      "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 62 },
      Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 50 },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-042-07",
    systemId: "SYS-042",
    name: "Audit Log Feed",
    type: "SaaS Audit Log Export",
    provider: "Workday",
    criticalityFactors: {
      confidentiality: { score: 60, reason: "Contains access and change metadata, not primary HR records" },
      integrity: { score: 85, reason: "Tampered or gapped logs undermine the only record of who accessed and changed what" },
      availability: { score: 55, reason: "Delayed log delivery limits detection speed, not HR operations" },
      regulatory: { score: 75, reason: "The accountability trail SOC 2 and GDPR both expect for a Confidential-tier system" },
      businessDependency: { score: 60, reason: "The primary detection and accountability trail for the tenant" },
    },
    categories: {
      "Data Protection": { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 75 },
      Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
      Detection: { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
      "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 60 },
      Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 78 },
      Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
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
