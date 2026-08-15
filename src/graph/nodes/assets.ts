// Asset — a specific resource inside a system's boundary. Facts only.
//
// Two fields left this file since the pre-graph version:
//
//   categories{}  -> edges/categoryAssessments.ts. A maturity/evidence/
//                    effectiveness judgment about one assurance category is an
//                    assertion ABOUT an asset, not an attribute OF one, and
//                    modelling it as an edge is what lets a number carry the
//                    "assessed at category level" basis instead of passing
//                    itself off as control-level fact.
//   classification -> DERIVED from the data the asset actually holds
//                    (engine/rollups.ts). It used to be inherited wholesale
//                    from the parent system, which meant all eight Production
//                    AI Platform assets were "Restricted" and all seven Workday
//                    assets "Confidential" regardless of what they carried.
//
// `kind` is new and load-bearing: it's the normalized machine-readable form of
// the free-text `type` string, and it's what edges/applicabilityRules.ts keys
// on to decide which controls a given asset is on the hook for. `type` stays as
// the display label. Keeping both means "AWS ECS Service (Fargate)" can be
// shown verbatim while still resolving to the same `compute-service` rules as
// any other container workload.
//
// criticalityFactors and inherentLikelihood stay — a judgment about what
// happens if this specific resource is compromised is a genuine per-asset fact
// with no upstream to derive it from.
import type { AssetId, SystemId } from "../ids";

// The kinds applicability rules are allowed to reference. Anything not in this
// list fails validation rather than silently matching no rule at all, which
// would quietly exempt an asset from every control.
export const ASSET_KINDS = [
  "api-gateway",
  "compute-service",
  "vector-db",
  "object-storage",
  "relational-db",
  "key-management",
  "secrets-store",
  "saas-tenant",
  "saas-api",
  "service-account",
  "integration-endpoint",
  "export-endpoint",
  "log-feed",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

// The kinds that sit where data crosses into the boundary from outside. Used
// to find the entry point of a system's request path without storing a layout:
// the flow graph alone can't identify one, because a real request path cycles
// (the gateway calls the model service, which answers back to the gateway) and
// so has no node with zero inbound edges.
export const BOUNDARY_INGRESS_KINDS: AssetKind[] = ["api-gateway", "saas-api"];

// The kinds that are primarily data stores — where data actually lands at
// rest — rather than compute or transport. Used to pull these out of the
// request-path stage sequence and into their own Data Plane section on the
// flow diagram: where the data actually lands is a distinct fact from how
// many hops it took to get there.
export const DATABASE_KINDS: AssetKind[] = ["relational-db", "vector-db", "object-storage"];

export interface CriticalityFactor {
  score: number;
  reason: string;
}

export interface CriticalityFactors {
  confidentiality: CriticalityFactor;
  integrity: CriticalityFactor;
  availability: CriticalityFactor;
  regulatory: CriticalityFactor;
  businessDependency: CriticalityFactor;
}

export interface Asset {
  id: AssetId;
  systemId: SystemId;
  name: string;
  type: string;
  kind: AssetKind;
  provider: string;
  code: string;
  criticalityFactors: CriticalityFactors;
  inherentLikelihood: number;
}

export const ASSETS: Asset[] = [
  {
    id: "AST-003-01",
    systemId: "SYS-003",
    name: "API Gateway",
    type: "AWS API Gateway",
    kind: "api-gateway",
    provider: "AWS",
    code: "GW",
    criticalityFactors: {
      confidentiality: { score: 85, reason: "Public-facing entry point; auth tokens and request payloads pass through it" },
      integrity: { score: 75, reason: "Request tampering or auth bypass here compounds through everything downstream" },
      availability: { score: 92, reason: "Every customer-facing AI feature depends on this single ingress point" },
      regulatory: { score: 85, reason: "Restricted-tier customer data transits this boundary on every call" },
      businessDependency: { score: 95, reason: "The sole entry point for the AI platform's revenue-generating features" },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-003-02",
    systemId: "SYS-003",
    name: "ECS Model Service",
    type: "AWS ECS Service (Fargate)",
    kind: "compute-service",
    provider: "AWS",
    code: "ECS",
    criticalityFactors: {
      confidentiality: { score: 80, reason: "Holds model weights and processes customer prompts/completions in memory" },
      integrity: { score: 85, reason: "A tampered or compromised container could return manipulated outputs at scale" },
      availability: { score: 88, reason: "Core inference path — an outage takes every AI feature down" },
      regulatory: { score: 80, reason: "Processes Restricted-tier customer data as part of inference" },
      businessDependency: { score: 92, reason: "The actual compute running the product's core AI capability" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-003-03",
    systemId: "SYS-003",
    name: "RAG Service",
    type: "AWS ECS Service (Fargate)",
    kind: "compute-service",
    provider: "AWS",
    code: "RAG",
    criticalityFactors: {
      confidentiality: { score: 88, reason: "Retrieves and injects customer-specific documents into model context at query time" },
      integrity: { score: 78, reason: "Poisoned or wrong retrieval results directly bias what the model returns to customers" },
      availability: { score: 75, reason: "Degrades to base-model answers rather than a hard outage if retrieval fails" },
      regulatory: { score: 82, reason: "Pulls Restricted-tier customer records into live prompts" },
      businessDependency: { score: 80, reason: "Differentiates the product's AI answers from a generic base model" },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-003-04",
    systemId: "SYS-003",
    name: "Vector Database",
    type: "Amazon OpenSearch Service (Vector Engine)",
    kind: "vector-db",
    provider: "AWS",
    code: "VDB",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Stores dense-vector embeddings of customer documents, re-identifiable via inversion" },
      integrity: { score: 70, reason: "Corrupted embeddings quietly degrade retrieval quality with no obvious signal" },
      availability: { score: 65, reason: "The RAG service degrades gracefully, so this isn't a hard-availability dependency" },
      regulatory: { score: 85, reason: "Embeddings are derived directly from Restricted-tier source documents" },
      businessDependency: { score: 72, reason: "Backs the retrieval quality that differentiates the product" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-003-05",
    systemId: "SYS-003",
    name: "prod-customer-data S3",
    type: "AWS S3 Bucket",
    kind: "object-storage",
    provider: "AWS",
    code: "S3",
    criticalityFactors: {
      confidentiality: { score: 98, reason: "The platform's primary at-rest store of raw customer documents used for RAG ingestion" },
      integrity: { score: 88, reason: "Corrupted source data propagates into every downstream embedding and inference" },
      availability: { score: 70, reason: "Ingestion tolerates short delay; live queries don't read this bucket directly" },
      regulatory: { score: 95, reason: "Restricted-tier PII at rest" },
      businessDependency: { score: 85, reason: "The ground-truth source every RAG answer traces back to" },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-003-06",
    systemId: "SYS-003",
    name: "RDS Metadata Database",
    type: "AWS RDS (PostgreSQL)",
    kind: "relational-db",
    provider: "AWS",
    code: "RDS",
    criticalityFactors: {
      confidentiality: { score: 70, reason: "Stores conversation/session metadata and customer identifiers, not raw document content" },
      integrity: { score: 82, reason: "Metadata drives access scoping and usage attribution across the platform" },
      availability: { score: 80, reason: "Session and audit metadata is read on every live request" },
      regulatory: { score: 75, reason: "Contains customer identifiers tied to Restricted-tier records" },
      businessDependency: { score: 78, reason: "Backs usage attribution, auditing, and per-customer access scoping" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-003-07",
    systemId: "SYS-003",
    name: "KMS Key",
    type: "AWS KMS Key",
    kind: "key-management",
    provider: "AWS",
    code: "KMS",
    criticalityFactors: {
      confidentiality: { score: 92, reason: "The root cryptographic key protecting every other asset in this system's boundary" },
      integrity: { score: 95, reason: "Unauthorized rotation or deletion could render the platform's data unrecoverable" },
      availability: { score: 90, reason: "Every read or write of encrypted data depends on this key being available" },
      regulatory: { score: 90, reason: "Key management is a direct regulatory control point for all encrypted Restricted-tier data" },
      businessDependency: { score: 90, reason: "The single point of cryptographic trust for the whole platform" },
    },
    inherentLikelihood: 2,
  },
  {
    id: "AST-003-08",
    systemId: "SYS-003",
    name: "Secrets Manager",
    type: "AWS Secrets Manager",
    kind: "secrets-store",
    provider: "AWS",
    code: "SEC",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Brokers database credentials, API keys, and third-party model provider secrets" },
      integrity: { score: 85, reason: "A tampered secret could redirect traffic or grant unauthorized system access" },
      availability: { score: 82, reason: "Every service in the boundary resolves credentials through this at runtime" },
      regulatory: { score: 80, reason: "Secrets gate access to every Restricted-tier data store in the boundary" },
      businessDependency: { score: 82, reason: "Underpins every service-to-service authentication in the platform" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-003-09",
    systemId: "SYS-003",
    name: "Partner API Gateway",
    type: "AWS API Gateway",
    kind: "integration-endpoint",
    provider: "AWS",
    code: "PAPI",
    criticalityFactors: {
      confidentiality: { score: 82, reason: "Delivers model completions and retrieved context to partner integrations over the same trust boundary as customer data" },
      integrity: { score: 78, reason: "A tampered delivery could hand a partner manipulated or mismatched completions" },
      availability: { score: 65, reason: "Partner delivery runs independently of the synchronous customer response path" },
      regulatory: { score: 78, reason: "Restricted-tier model outputs leave the boundary through this endpoint" },
      businessDependency: { score: 70, reason: "Backs partner-facing integrations built on top of the platform's completions" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-01",
    systemId: "SYS-042",
    name: "Production Tenant",
    type: "SaaS Tenant Configuration",
    kind: "saas-tenant",
    provider: "Workday",
    code: "TEN",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Full employee PII including compensation, benefits, and HR records" },
      integrity: { score: 82, reason: "Incorrect HR data affects pay, benefits, and org records enterprise-wide" },
      availability: { score: 68, reason: "HR operations tolerate short outages; still the core system of record" },
      regulatory: { score: 85, reason: "GDPR-regulated personal data" },
      businessDependency: { score: 78, reason: "Core system of record for all employees" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-02",
    systemId: "SYS-042",
    name: "API Endpoint",
    type: "SaaS API Endpoint",
    kind: "saas-api",
    provider: "Workday",
    code: "API",
    criticalityFactors: {
      confidentiality: { score: 85, reason: "Public-facing integration entry point; auth tokens and HR/payroll payloads pass through it" },
      integrity: { score: 78, reason: "Request tampering or auth bypass here compounds through every downstream integration" },
      availability: { score: 80, reason: "Every integration — payroll, identity, exports — depends on this single ingress point" },
      regulatory: { score: 80, reason: "GDPR-regulated personal data transits this boundary on every call" },
      businessDependency: { score: 82, reason: "The sole integration entry point for every connected system" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-03",
    systemId: "SYS-042",
    name: "Integration Service Account",
    type: "SaaS Service Account",
    kind: "service-account",
    provider: "Workday",
    code: "SVC",
    criticalityFactors: {
      confidentiality: { score: 92, reason: "A compromised service account grants broad programmatic access across the whole tenant" },
      integrity: { score: 88, reason: "Misuse could silently read or alter HR and payroll data through the API" },
      availability: { score: 55, reason: "Credential rotation causes brief integration downtime, not a hard outage" },
      regulatory: { score: 80, reason: "Gates programmatic access to every category of GDPR-regulated personal data in scope" },
      businessDependency: { score: 78, reason: "Every downstream integration authenticates through this single account" },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-042-04",
    systemId: "SYS-042",
    name: "Payroll Connector",
    type: "SaaS Integration Endpoint",
    kind: "integration-endpoint",
    provider: "Workday",
    code: "PAY",
    criticalityFactors: {
      confidentiality: { score: 88, reason: "Compensation data flowing to the external payroll processor" },
      integrity: { score: 85, reason: "A bad payroll run has direct financial and legal consequences" },
      availability: { score: 60, reason: "Runs on a fixed pay-cycle schedule, not continuously" },
      regulatory: { score: 82, reason: "GDPR-regulated personal data, plus payroll-specific obligations" },
      businessDependency: { score: 78, reason: "Every employee's pay depends on this integration succeeding" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-05",
    systemId: "SYS-042",
    name: "Identity Connector",
    type: "SaaS Integration Endpoint",
    kind: "integration-endpoint",
    provider: "Workday",
    code: "IDN",
    criticalityFactors: {
      confidentiality: { score: 78, reason: "Provisions and deprovisions employee identity and access across every connected system" },
      integrity: { score: 88, reason: "A broken or delayed deprovisioning run leaves terminated employees with active access" },
      availability: { score: 68, reason: "Identity sync runs on a scheduled cadence rather than continuously" },
      regulatory: { score: 76, reason: "Access lifecycle events are a direct control point for GDPR's security-of-processing article" },
      businessDependency: { score: 80, reason: "Access lifecycle across every connected system depends on this feed being accurate" },
    },
    inherentLikelihood: 3,
  },
  {
    id: "AST-042-06",
    systemId: "SYS-042",
    name: "Data Export Endpoint",
    type: "SaaS Export Endpoint",
    kind: "export-endpoint",
    provider: "Workday",
    code: "EXP",
    criticalityFactors: {
      confidentiality: { score: 90, reason: "Bulk employee PII and compensation data leave the tenant boundary through this endpoint" },
      integrity: { score: 65, reason: "Export integrity matters less than what leaves the boundary" },
      availability: { score: 50, reason: "Export delay has minimal operational impact" },
      regulatory: { score: 85, reason: "The highest-exposure point for GDPR-regulated personal data leaving the tenant" },
      businessDependency: { score: 55, reason: "Feeds downstream reporting and analytics, not core HR operations" },
    },
    inherentLikelihood: 4,
  },
  {
    id: "AST-042-07",
    systemId: "SYS-042",
    name: "Audit Log Feed",
    type: "SaaS Audit Log Export",
    kind: "log-feed",
    provider: "Workday",
    code: "LOG",
    criticalityFactors: {
      confidentiality: { score: 60, reason: "Contains access and change metadata, not primary HR records" },
      integrity: { score: 85, reason: "Tampered or gapped logs undermine the only record of who accessed and changed what" },
      availability: { score: 55, reason: "Delayed log delivery limits detection speed, not HR operations" },
      regulatory: { score: 75, reason: "The accountability trail SOC 2 and GDPR both expect for a Confidential-tier system" },
      businessDependency: { score: 60, reason: "The primary detection and accountability trail for the tenant" },
    },
    inherentLikelihood: 3,
  },
];

export const ASSET_BY_ID: Record<AssetId, Asset> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

export function assetsForSystem(systemId: SystemId): Asset[] {
  return ASSETS.filter((a) => a.systemId === systemId);
}
