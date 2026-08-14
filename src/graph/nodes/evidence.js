// Evidence — what an assurance claim actually rests on.
//
// Before this, "evidence" was two things, neither of them a record: an
// `evidenceType` string on an asset's category assessment (one of seven enum
// values, averaged into a confidence score), and an `evidenceRef: "EV-9101"`
// on a tracked control that pointed at nothing. So an asset could report
// evidenceConfidence: 96 without there being a single collection anywhere in
// the app that had happened, covered anything, or passed.
//
// Now confidence is computed (engine/implementation.js) from three things a
// record actually carries:
//
//   type      — the same seven-value EVIDENCE_TYPES scale, unchanged, because
//               "who says so" genuinely is the dominant factor.
//   coverage  — a test that checked 40% of the fleet is not the same claim as
//               one that checked all of it, even at identical type.
//   freshness — a continuous telemetry reading from this morning and one from
//               nine months ago are the same TYPE of evidence and nowhere near
//               the same strength of claim. Each record declares its own
//               validForDays and decays past it rather than being binary-stale.
//
// SCOPE, and why evidence isn't listed on implementations
// -------------------------------------------------------
// Each record declares which implementations it covers, via controlId plus the
// assets it was collected across. That direction is deliberate: it matches how
// these tools really work (one Vanta test evaluates every S3 bucket at once,
// and reporting it as six independent collections would overstate the
// independence of the finding), and more importantly it means the link is
// stored exactly once. Putting evidenceIds[] on implementations as well would
// recreate, inside the graph, the same dual-maintenance problem the graph
// exists to remove.
//
// `result` is the collected outcome. It is the single field to edit to watch
// propagation work end to end: flip one to "fail" and the implementation, the
// asset, its system, the enterprise score, that control's framework coverage,
// and any risk it contributes to all move together.

export const EVIDENCE_RESULTS = ["pass", "partial", "fail"];
export const INDEPENDENCE_LEVELS = ["automated", "internal", "external"];

// How long a collection stays at full strength before it starts decaying,
// keyed by evidence type. A continuous telemetry feed is worthless the moment
// it stops reporting; an auditor's examination is reasonably good for a year.
// Records may override with their own validForDays.
export const DEFAULT_VALIDITY_DAYS = {
  "Continuous telemetry": 2,
  "Automated technical test": 14,
  "API configuration observation": 30,
  "Auditor examination": 365,
  Screenshot: 90,
  Document: 365,
  "Self-attestation": 180,
};

const RAW_EVIDENCE = [
  // ---- Encryption at rest (CRY-05) -------------------------------------------
  {
    id: "EV-9101", source: "Vanta — AWS encryption-at-rest test", evidenceType: "Automated technical test",
    controlId: "CRY-05", assetIds: ["AST-003-05", "AST-003-06", "AST-003-04"],
    collectedAt: "2026-08-13", coveragePct: 100, result: "pass", independence: "automated",
    note: "Confirms AES-256 via the dedicated KMS key on every data store in the boundary.",
  },
  {
    id: "EV-9102", source: "AWS KMS key configuration", evidenceType: "API configuration observation",
    controlId: "CRY-05", assetIds: ["AST-003-07", "AST-003-08"],
    collectedAt: "2026-08-11", coveragePct: 100, result: "pass", independence: "automated",
    note: "Key material and secret storage are encrypted by the service itself; observed directly off the API.",
  },
  {
    id: "EV-7001", source: "Workday trust report — encryption controls", evidenceType: "Auditor examination",
    controlId: "CRY-05", assetIds: ["AST-042-01"],
    collectedAt: "2026-03-02", coveragePct: 100, result: "pass", independence: "external",
    note: "Vendor-attested rather than ACME-verified — the tenant gives no direct read of the storage layer.",
  },

  // ---- Encryption in transit (CRY-03) ----------------------------------------
  {
    id: "EV-9103", source: "Vanta — TLS enforcement test", evidenceType: "Automated technical test",
    controlId: "CRY-03", assetIds: ["AST-003-01", "AST-003-02", "AST-003-03", "AST-003-04", "AST-003-05", "AST-003-06"],
    collectedAt: "2026-08-12", coveragePct: 100, result: "pass", independence: "automated",
    note: "TLS 1.2+ enforced on every segment, including internal service-to-service calls.",
  },
  {
    id: "EV-7002", source: "Workday endpoint TLS scan", evidenceType: "Automated technical test",
    controlId: "CRY-03", assetIds: ["AST-042-02", "AST-042-04", "AST-042-05", "AST-042-06", "AST-042-07"],
    collectedAt: "2026-08-10", coveragePct: 100, result: "pass", independence: "automated",
  },

  // ---- Key management (CRY-09) -----------------------------------------------
  {
    id: "EV-9110", source: "AWS KMS rotation telemetry", evidenceType: "Continuous telemetry",
    controlId: "CRY-09", assetIds: ["AST-003-07"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
    note: "Automatic annual rotation confirmed live; administrative access gated behind MFA.",
  },
  {
    id: "EV-9111", source: "AWS Secrets Manager rotation config", evidenceType: "API configuration observation",
    controlId: "CRY-09", assetIds: ["AST-003-08"],
    collectedAt: "2026-08-09", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9112", source: "Vanta — customer-managed key coverage test", evidenceType: "Automated technical test",
    controlId: "CRY-09", assetIds: ["AST-003-05", "AST-003-06", "AST-003-04"],
    collectedAt: "2026-08-13", coveragePct: 100, result: "pass", independence: "automated",
  },

  // ---- Retention & disposal (DCH-18) -----------------------------------------
  {
    id: "EV-9106", source: "S3 lifecycle policy configuration", evidenceType: "API configuration observation",
    controlId: "DCH-18", assetIds: ["AST-003-05"],
    collectedAt: "2026-07-05", coveragePct: 70, result: "partial", independence: "automated",
    note: "A lifecycle rule exists on the raw document prefix, but not on the ingestion staging prefix.",
  },
  {
    id: "EV-9107", source: "Retention schedule review — vector store", evidenceType: "Document",
    controlId: "DCH-18", assetIds: ["AST-003-04"],
    collectedAt: "2026-06-18", coveragePct: 0, result: "fail", independence: "internal",
    note: "No retention or disposal schedule defined for embeddings — the open item behind SEC-2262.",
  },
  {
    id: "EV-9113", source: "RDS backup retention configuration", evidenceType: "API configuration observation",
    controlId: "DCH-18", assetIds: ["AST-003-06"],
    collectedAt: "2026-08-08", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    // Not the audit log feed: its retention is enforced in ACME's central
    // monitoring destination, not in the vendor tenant (see the applicability
    // exception).
    id: "EV-7006", source: "Workday retention policy configuration", evidenceType: "Auditor examination",
    controlId: "DCH-18", assetIds: ["AST-042-01"],
    collectedAt: "2026-03-02", coveragePct: 100, result: "pass", independence: "external",
  },

  // ---- Secure baseline (CFG-02) ----------------------------------------------
  {
    // Not the KMS key: it exposes no configurable hardening surface, so there
    // is no baseline for this scan to evaluate (see the applicability exception).
    id: "EV-9120", source: "Microsoft Defender for Cloud — baseline posture", evidenceType: "Continuous telemetry",
    controlId: "CFG-02", assetIds: ["AST-003-05", "AST-003-06", "AST-003-08"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
    note: "Continuous posture scoring against the CIS benchmark for each resource type.",
  },
  {
    id: "EV-9121", source: "Container image baseline scan", evidenceType: "Automated technical test",
    controlId: "CFG-02", assetIds: ["AST-003-02", "AST-003-03"],
    collectedAt: "2026-08-07", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9122", source: "OpenSearch domain configuration review", evidenceType: "API configuration observation",
    controlId: "CFG-02", assetIds: ["AST-003-04"],
    collectedAt: "2026-07-28", coveragePct: 85, result: "partial", independence: "automated",
    note: "Domain matches baseline except for a fine-grained access-control setting left at the service default.",
  },

  // ---- Least functionality (CFG-03) ------------------------------------------
  {
    id: "EV-9123", source: "Vanta — exposed service and port test", evidenceType: "Automated technical test",
    controlId: "CFG-03", assetIds: ["AST-003-01", "AST-003-02", "AST-003-04", "AST-003-06"],
    collectedAt: "2026-08-12", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9124", source: "RAG service task definition review", evidenceType: "API configuration observation",
    controlId: "CFG-03", assetIds: ["AST-003-03"],
    collectedAt: "2026-07-14", coveragePct: 100, result: "partial", independence: "internal",
    note: "Debug endpoints still reachable inside the service mesh; not internet-exposed but not disabled either.",
  },

  // ---- Change control (CHG-02) -----------------------------------------------
  {
    id: "EV-9125", source: "ServiceNow change record sampling", evidenceType: "Auditor examination",
    controlId: "CHG-02", assetIds: ["AST-003-01", "AST-003-02", "AST-003-03", "AST-003-04", "AST-003-05", "AST-003-06", "AST-003-07", "AST-003-08"],
    collectedAt: "2026-05-20", coveragePct: 90, result: "pass", independence: "external",
    note: "Sampled production changes traced to an approved request with separation between requester and approver.",
  },

  // ---- Multi-tenant isolation (CLD-06) ---------------------------------------
  {
    id: "EV-9130", source: "Automated cross-tenant access test", evidenceType: "Automated technical test",
    controlId: "CLD-06", assetIds: ["AST-003-03"],
    collectedAt: "2026-08-13", coveragePct: 100, result: "fail", independence: "automated",
    note: "Retrieval scoping is enforced in the application query layer only. The test that walks a session across tenant boundaries returned documents it should not have — the technical finding behind RISK-001.",
  },
  {
    id: "EV-9131", source: "Automated cross-tenant access test", evidenceType: "Automated technical test",
    controlId: "CLD-06", assetIds: ["AST-003-04"],
    collectedAt: "2026-08-13", coveragePct: 100, result: "partial", independence: "automated",
    note: "Index-level separation holds, but tenant filtering on vector search relies on the caller passing the right filter rather than the engine enforcing it.",
  },
  {
    id: "EV-9132", source: "S3 bucket policy tenant-prefix test", evidenceType: "Automated technical test",
    controlId: "CLD-06", assetIds: ["AST-003-05"],
    collectedAt: "2026-08-13", coveragePct: 100, result: "pass", independence: "automated",
    note: "Prefix-scoped bucket policies enforce separation below the application layer.",
  },
  {
    id: "EV-9133", source: "API Gateway authorizer test", evidenceType: "Automated technical test",
    controlId: "CLD-06", assetIds: ["AST-003-01", "AST-003-02"],
    collectedAt: "2026-08-12", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-7010", source: "Workday tenant isolation attestation", evidenceType: "Auditor examination",
    controlId: "CLD-06", assetIds: ["AST-042-01", "AST-042-02"],
    collectedAt: "2026-03-02", coveragePct: 100, result: "pass", independence: "external",
  },

  // ---- Access logging (MON-02) -----------------------------------------------
  {
    id: "EV-9104", source: "Microsoft Sentinel ingestion telemetry", evidenceType: "Continuous telemetry",
    controlId: "MON-02", assetIds: ["AST-003-01", "AST-003-02", "AST-003-05", "AST-003-06", "AST-003-07", "AST-003-08"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
    note: "Live confirmation that each source is still delivering events, not just configured to.",
  },
  {
    id: "EV-9105", source: "Microsoft Sentinel ingestion telemetry", evidenceType: "Continuous telemetry",
    controlId: "MON-02", assetIds: ["AST-003-03", "AST-003-04"],
    collectedAt: "2026-08-14", coveragePct: 60, result: "partial", independence: "automated",
    note: "Application logs arrive; retrieval-level query logs are not forwarded, so a cross-tenant read would not appear in Sentinel.",
  },
  {
    id: "EV-7003", source: "Workday audit log export monitor", evidenceType: "Continuous telemetry",
    controlId: "MON-02", assetIds: ["AST-042-01", "AST-042-02", "AST-042-03", "AST-042-04", "AST-042-05", "AST-042-06", "AST-042-07"],
    collectedAt: "2026-08-14", coveragePct: 95, result: "pass", independence: "automated",
  },

  // ---- Event log content (MON-03) --------------------------------------------
  {
    id: "EV-9140", source: "Sentinel log schema conformance test", evidenceType: "Automated technical test",
    controlId: "MON-03", assetIds: ["AST-003-01", "AST-003-05", "AST-003-06", "AST-003-07"],
    collectedAt: "2026-08-11", coveragePct: 100, result: "pass", independence: "automated",
    note: "Confirms actor, timestamp, source, and outcome are present on forwarded events.",
  },
  {
    id: "EV-9141", source: "Sentinel log schema conformance test", evidenceType: "Automated technical test",
    controlId: "MON-03", assetIds: ["AST-003-03", "AST-003-04"],
    collectedAt: "2026-08-11", coveragePct: 45, result: "partial", independence: "automated",
    note: "Retrieval events carry a request id but no acting identity, so they cannot answer who read what.",
  },

  // ---- Protection of event logs (MON-08) -------------------------------------
  {
    id: "EV-9142", source: "S3 object-lock configuration", evidenceType: "API configuration observation",
    controlId: "MON-08", assetIds: ["AST-003-05", "AST-003-06"],
    collectedAt: "2026-08-06", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-7011", source: "Log export immutability review", evidenceType: "Screenshot",
    controlId: "MON-08", assetIds: ["AST-042-07", "AST-042-01"],
    collectedAt: "2026-06-11", coveragePct: 100, result: "partial", independence: "internal",
    note: "Export is append-only in the destination, but the tenant-side retention window is shorter than ACME's 12-month standard.",
  },

  // ---- Patching (VPM-05) ------------------------------------------------------
  {
    id: "EV-9150", source: "Tenable — production scan", evidenceType: "Automated technical test",
    controlId: "VPM-05", assetIds: ["AST-003-01", "AST-003-02", "AST-003-06"],
    collectedAt: "2026-08-08", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9151", source: "Tenable — production scan", evidenceType: "Automated technical test",
    controlId: "VPM-05", assetIds: ["AST-003-03", "AST-003-04"],
    collectedAt: "2026-08-08", coveragePct: 100, result: "partial", independence: "automated",
    note: "Two medium-severity library findings on the retrieval path are past their remediation window.",
  },

  // ---- Least privilege (IAC-21) ----------------------------------------------
  {
    id: "EV-9160", source: "AWS IAM Access Analyzer", evidenceType: "Continuous telemetry",
    controlId: "IAC-21", assetIds: ["AST-003-05", "AST-003-06", "AST-003-07", "AST-003-08"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9161", source: "AWS IAM Access Analyzer", evidenceType: "Continuous telemetry",
    controlId: "IAC-21", assetIds: ["AST-003-03"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "fail", independence: "automated",
    note: "The RAG service role holds broad read access across every data store in the boundary, well beyond its actual query pattern — the open finding behind SEC-2260.",
  },
  {
    id: "EV-9162", source: "AWS IAM Access Analyzer", evidenceType: "Continuous telemetry",
    controlId: "IAC-21", assetIds: ["AST-003-01", "AST-003-02", "AST-003-04"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-7004", source: "Workday role assignment review", evidenceType: "Screenshot",
    controlId: "IAC-21", assetIds: ["AST-042-01", "AST-042-02", "AST-042-04", "AST-042-05", "AST-042-06", "AST-042-07"],
    collectedAt: "2026-05-28", coveragePct: 100, result: "partial", independence: "internal",
  },
  {
    id: "EV-7012", source: "Integration account permission review", evidenceType: "Screenshot",
    controlId: "IAC-21", assetIds: ["AST-042-03"],
    collectedAt: "2026-05-28", coveragePct: 100, result: "partial", independence: "internal",
    note: "The integration account carries tenant-wide read scope because the connectors were provisioned against one shared role.",
  },

  // ---- Periodic access review (IAC-17) ---------------------------------------
  {
    id: "EV-7005", source: "Quarterly access recertification campaign", evidenceType: "Auditor examination",
    controlId: "IAC-17", assetIds: ["AST-042-02", "AST-042-03", "AST-042-04", "AST-042-05", "AST-042-06", "AST-042-07"],
    collectedAt: "2026-05-15", coveragePct: 100, result: "pass", independence: "external",
  },
  {
    id: "EV-7013", source: "Quarterly access recertification campaign", evidenceType: "Document",
    controlId: "IAC-17", assetIds: ["AST-042-01"],
    collectedAt: "2026-04-30", coveragePct: 60, result: "partial", independence: "internal",
    note: "Manager-role recertification is past its due date — the open item behind SEC-2210.",
  },
  {
    id: "EV-9163", source: "Quarterly privileged access review", evidenceType: "Auditor examination",
    controlId: "IAC-17", assetIds: ["AST-003-05", "AST-003-06", "AST-003-07", "AST-003-08", "AST-003-01", "AST-003-02"],
    collectedAt: "2026-06-30", coveragePct: 100, result: "pass", independence: "external",
  },
  {
    id: "EV-9164", source: "Quarterly privileged access review", evidenceType: "Document",
    controlId: "IAC-17", assetIds: ["AST-003-03", "AST-003-04"],
    collectedAt: "2026-06-30", coveragePct: 50, result: "partial", independence: "internal",
    note: "Service-role grants on the retrieval path were listed but not individually re-justified.",
  },

  // ---- Authenticator management (IAC-10) -------------------------------------
  {
    id: "EV-9165", source: "Secrets Manager rotation telemetry", evidenceType: "Continuous telemetry",
    controlId: "IAC-10", assetIds: ["AST-003-08", "AST-003-01"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-7014", source: "Service account credential age report", evidenceType: "API configuration observation",
    controlId: "IAC-10", assetIds: ["AST-042-03"],
    collectedAt: "2026-08-04", coveragePct: 100, result: "fail", independence: "automated",
    note: "The integration credential is a static secret with no expiry and no rotation history on record.",
  },
  {
    id: "EV-7015", source: "Okta MFA enforcement report", evidenceType: "Automated technical test",
    controlId: "IAC-10", assetIds: ["AST-042-01", "AST-042-02"],
    collectedAt: "2026-08-12", coveragePct: 100, result: "pass", independence: "automated",
  },

  // ---- Access enforcement (IAC-20) -------------------------------------------
  {
    id: "EV-9166", source: "Vanta — authorization policy test", evidenceType: "Automated technical test",
    controlId: "IAC-20", assetIds: ["AST-003-01", "AST-003-05", "AST-003-06", "AST-003-07", "AST-003-08"],
    collectedAt: "2026-08-12", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9167", source: "Vanta — authorization policy test", evidenceType: "Automated technical test",
    controlId: "IAC-20", assetIds: ["AST-003-03", "AST-003-04"],
    collectedAt: "2026-08-12", coveragePct: 100, result: "partial", independence: "automated",
    note: "Authentication is enforced at the service edge, but the retrieval call itself performs no separate per-resource permission check.",
  },

  // ---- Boundary protection (NET-03) ------------------------------------------
  {
    id: "EV-9170", source: "Cloudflare / WAF rule posture", evidenceType: "Continuous telemetry",
    controlId: "NET-03", assetIds: ["AST-003-01"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9171", source: "Security group and VPC boundary test", evidenceType: "Automated technical test",
    controlId: "NET-03", assetIds: ["AST-003-02", "AST-003-03"],
    collectedAt: "2026-08-09", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-7016", source: "Workday IP allowlist configuration", evidenceType: "API configuration observation",
    controlId: "NET-03", assetIds: ["AST-042-02", "AST-042-04", "AST-042-05"],
    collectedAt: "2026-07-22", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-7017", source: "Workday IP allowlist configuration", evidenceType: "API configuration observation",
    controlId: "NET-03", assetIds: ["AST-042-06"],
    collectedAt: "2026-07-22", coveragePct: 40, result: "partial", independence: "automated",
    note: "The export endpoint accepts requests from outside the allowlisted integration ranges.",
  },

  // ---- DLP (NET-17) -----------------------------------------------------------
  {
    id: "EV-9180", source: "DLP scanning coverage report", evidenceType: "Document",
    controlId: "NET-17", assetIds: ["AST-003-05"],
    collectedAt: "2026-07-10", coveragePct: 0, result: "fail", independence: "internal",
    note: "No DLP scanning deployed on the ingestion path into prod-customer-data — the open item behind SEC-2261.",
  },
  {
    id: "EV-9181", source: "API Gateway response inspection", evidenceType: "Automated technical test",
    controlId: "NET-17", assetIds: ["AST-003-01"],
    collectedAt: "2026-08-05", coveragePct: 70, result: "partial", independence: "automated",
  },
  {
    id: "EV-7018", source: "Export path DLP inspection", evidenceType: "Screenshot",
    controlId: "NET-17", assetIds: ["AST-042-06"],
    collectedAt: "2026-06-02", coveragePct: 0, result: "fail", independence: "internal",
    note: "Bulk export runs without content inspection, so employee PII can leave the tenant uninspected.",
  },
  {
    id: "EV-7019", source: "Payroll transfer inspection", evidenceType: "API configuration observation",
    controlId: "NET-17", assetIds: ["AST-042-04"],
    collectedAt: "2026-07-30", coveragePct: 100, result: "pass", independence: "automated",
  },

  // ---- Backups (BCD-11) -------------------------------------------------------
  {
    id: "EV-9190", source: "AWS Backup job telemetry", evidenceType: "Continuous telemetry",
    controlId: "BCD-11", assetIds: ["AST-003-05", "AST-003-06"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9191", source: "Vector store snapshot configuration", evidenceType: "Document",
    controlId: "BCD-11", assetIds: ["AST-003-04"],
    collectedAt: "2026-05-04", coveragePct: 50, result: "partial", independence: "internal",
    note: "Snapshots are taken but have never been restore-tested, so recoverability is asserted rather than demonstrated.",
  },
  {
    id: "EV-7020", source: "Workday backup attestation", evidenceType: "Auditor examination",
    controlId: "BCD-11", assetIds: ["AST-042-01"],
    collectedAt: "2026-03-02", coveragePct: 100, result: "pass", independence: "external",
  },

  // ---- Capacity (CAP-01) ------------------------------------------------------
  {
    id: "EV-9195", source: "Azure Monitor / CloudWatch capacity telemetry", evidenceType: "Continuous telemetry",
    controlId: "CAP-01", assetIds: ["AST-003-01", "AST-003-02", "AST-003-06"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-9196", source: "Azure Monitor / CloudWatch capacity telemetry", evidenceType: "Continuous telemetry",
    controlId: "CAP-01", assetIds: ["AST-003-03", "AST-003-04"],
    collectedAt: "2026-08-14", coveragePct: 100, result: "partial", independence: "automated",
    note: "Alerting thresholds are set on the serving path but not on the retrieval or embedding path.",
  },

  // ---- Program-scoped controls ------------------------------------------------
  // These carry no assetIds: they're evidence about ACME's program, not about
  // any one resource. See keyControls.js on why program scope exists.
  {
    id: "EV-P-001", source: "Data classification policy attestation", evidenceType: "Document",
    controlId: "DCH-02", assetIds: [],
    collectedAt: "2026-02-14", coveragePct: 100, result: "pass", independence: "internal",
  },
  {
    id: "EV-P-002", source: "Personal data retention schedule review", evidenceType: "Document",
    controlId: "PRI-05", assetIds: [],
    collectedAt: "2026-01-20", coveragePct: 70, result: "partial", independence: "internal",
    note: "A schedule exists for the HR system of record but not for derived AI-platform data.",
  },
  {
    id: "EV-P-003", source: "Asset inventory reconciliation", evidenceType: "Automated technical test",
    controlId: "AST-02", assetIds: [],
    collectedAt: "2026-08-13", coveragePct: 100, result: "pass", independence: "automated",
  },
  {
    id: "EV-P-004", source: "Incident response tabletop exercise", evidenceType: "Document",
    controlId: "IRO-02", assetIds: [],
    collectedAt: "2025-09-08", coveragePct: 100, result: "partial", independence: "internal",
    note: "Last exercised outside the annual window — the timing gap RISK-012 tracks.",
  },
  {
    id: "EV-P-005", source: "Annual enterprise risk assessment", evidenceType: "Auditor examination",
    controlId: "RSK-04", assetIds: [],
    collectedAt: "2026-04-11", coveragePct: 100, result: "pass", independence: "external",
  },
  {
    id: "EV-P-006", source: "Vendor reassessment backlog report", evidenceType: "Document",
    controlId: "TPM-04", assetIds: [],
    collectedAt: "2026-07-02", coveragePct: 55, result: "partial", independence: "internal",
    note: "Several critical vendors are operating past their review cycle — the backlog RISK-004 tracks.",
  },
  {
    id: "EV-P-007", source: "AI model and agent inventory review", evidenceType: "Document",
    controlId: "AAT-01", assetIds: [],
    collectedAt: "2026-06-25", coveragePct: 60, result: "partial", independence: "internal",
    note: "Models in production are inventoried with owners, but there is no pre-release security or bias review gate — the gap RISK-011 tracks.",
  },
];

export const EVIDENCE = RAW_EVIDENCE.map((e) => ({
  ...e,
  validForDays: e.validForDays ?? DEFAULT_VALIDITY_DAYS[e.evidenceType],
}));

export const EVIDENCE_BY_ID = Object.fromEntries(EVIDENCE.map((e) => [e.id, e]));

// Every collection covering one implementation. The lookup direction that
// makes evidence-on-the-record work: implementations never store evidence ids,
// they ask for them.
const BY_PAIR = {};
EVIDENCE.forEach((e) => {
  if (e.assetIds.length === 0) {
    (BY_PAIR[`program::${e.controlId}`] ||= []).push(e);
    return;
  }
  e.assetIds.forEach((assetId) => (BY_PAIR[`${assetId}::${e.controlId}`] ||= []).push(e));
});

export function evidenceFor(assetId, controlId) {
  return BY_PAIR[`${assetId ?? "program"}::${controlId}`] || [];
}
