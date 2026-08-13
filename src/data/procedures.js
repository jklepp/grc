// ACME's SOP library — the "how," one level below each policy's "what." Kept
// deliberately light: one procedure per Assurance Category (assuranceModel.js)
// rather than per asset or per system. A generic "how we do encryption"
// procedure covers every asset that needs encryption, so this stays a fixed
// set of 6 as the Asset Register grows instead of multiplying with it —
// asset-specific fix-it items belong in that system's `remediation` array in
// systemRegister.js, not here.
//
// Each procedure links back to the policy it operationalizes (policyId, into
// policies.js) and cites real SCF control IDs pulled from that same policy's
// controlIds — never a separately invented control list — so a procedure's
// claimed control coverage can't drift from the policy behind it.
import { ASSURANCE_CATEGORIES } from "./assuranceModel";

export const PROCEDURES = [
  {
    id: "encryption-implementation",
    code: "SOP-01",
    title: "Encryption Implementation Procedure",
    category: "Data Protection",
    policyId: "data-classification",
    controlIds: ["DCH-01", "DCH-08", "CRY-01", "CRY-05", "CRY-08"],
    owner: "Data Platform / IT Security",
    reviewCadence: "Reviewed annually, or whenever a new data store is provisioned",
    evidenceType: "Automated technical test",
    purpose: "How ACME actually turns the Data Classification & Handling Policy's encryption requirement into something enforced on a real data store, not just written down.",
    steps: [
      { title: "Classify before you provision", detail: "Confirm the data store's classification tier against the Data Classification & Handling Policy before it's built — the tier decides what's required below, not the other way around." },
      { title: "Select the standard", detail: "AES-256 (or equivalent) at rest is the floor for Confidential and Restricted data; TLS 1.2+ in transit, enforced on every segment including internal connections for Restricted." },
      { title: "Provision keys in Key Vault", detail: "Encryption keys are generated and held in Azure Key Vault. No production key is ever generated or stored anywhere else, including on an engineer's machine." },
      { title: "Turn it on at the platform layer", detail: "Enable encryption at the storage layer itself (S3 SSE-KMS, Azure Storage encryption, database-native encryption) before the store accepts its first record." },
      { title: "Verify, don't assume", detail: "A Vanta automated test (or equivalent) confirms encryption is actually active before the asset's Data Protection category is marked Managed." },
      { title: "Rotate on schedule", detail: "Keys are rotated per the defined schedule, and rotation events are logged for audit — a key that's never rotated is a finding waiting to happen." },
    ],
  },
  {
    id: "secure-baseline-configuration",
    code: "SOP-02",
    title: "Secure Baseline Configuration Procedure",
    category: "Configuration",
    policyId: "change-configuration",
    controlIds: ["CFG-01", "CFG-02", "CFG-03", "CHG-01", "CHG-02"],
    owner: "IT / Engineering",
    reviewCadence: "Reviewed annually, or after a major platform change",
    evidenceType: "API configuration observation",
    purpose: "How a new asset gets built from a hardened baseline instead of whatever the platform ships by default, and how drift away from that baseline gets caught.",
    steps: [
      { title: "Start from the approved baseline", detail: "Every server, container, or cloud resource is built from an approved, hardened configuration template (CIS Benchmark or vendor-hardened equivalent) — never assembled from scratch with default settings." },
      { title: "Enforce it, don't just document it", detail: "The baseline is applied through Intune (endpoints) or Azure Policy (cloud resources) so it's continuously enforced, not a one-time setup step." },
      { title: "Disable what isn't needed", detail: "Unused services, ports, and roles are turned off at build time — least functionality is verified against the baseline, not assumed." },
      { title: "Route deviations through change control", detail: "Any exception to the baseline requires a ServiceNow change request, reviewed and approved by someone other than the requester." },
      { title: "Watch for drift automatically", detail: "Configuration monitoring flags any deviation from baseline after the fact, so an out-of-process change gets caught instead of quietly persisting." },
      { title: "Re-baseline after major changes", detail: "A platform upgrade or major version change triggers a fresh baseline review, not a one-time setup that's assumed to still hold." },
    ],
  },
  {
    id: "monitoring-alert-triage",
    code: "SOP-03",
    title: "Security Monitoring & Alert Triage Procedure",
    category: "Detection",
    policyId: "security-monitoring",
    controlIds: ["MON-01", "MON-02", "MON-05", "THR-01", "OPS-01"],
    owner: "IT Security / SOC function",
    reviewCadence: "Reviewed annually",
    evidenceType: "Continuous telemetry",
    purpose: "How ACME actually watches an asset once it's live — where its logs go, how an alert gets triaged, and how a real anomaly becomes an incident.",
    steps: [
      { title: "Forward logs before go-live", detail: "An asset is connected to Microsoft Sentinel before it goes into production — central logging isn't an optional add-on." },
      { title: "Apply the standard rule set", detail: "The relevant analytics rules (identity, endpoint, network, or cloud) apply automatically by asset category — no asset waits on custom tuning before it's covered." },
      { title: "Triage against the SLA", detail: "Alerts are triaged by severity against a defined response SLA, regardless of who's on shift when they fire." },
      { title: "Escalate or tune", detail: "A confirmed anomaly escalates into the Incident Response Policy process; a false positive gets tuned back into the rule set so the same noise doesn't repeat." },
      { title: "Retain and protect logs", detail: "Security logs are retained a minimum of 12 months and write-protected — an investigation can't rely on logs that could've been altered." },
      { title: "Review signal quality quarterly", detail: "Alert volume and false-positive rate are reviewed quarterly so the monitoring stays usable instead of becoming noise everyone tunes out." },
    ],
  },
  {
    id: "access-provisioning-review",
    code: "SOP-04",
    title: "Access Provisioning & Review Procedure",
    category: "Identity & Access",
    policyId: "access-control",
    controlIds: ["IAC-01", "IAC-02", "IAC-06", "IAC-21", "IAC-24"],
    owner: "IT Security",
    reviewCadence: "Privileged access reviewed quarterly; standard access semi-annually",
    evidenceType: "API configuration observation",
    purpose: "How access to an asset actually gets granted, kept honest over time, and removed — the operational half of the Access Control Policy.",
    steps: [
      { title: "Provision through Entra ID/Okta only", detail: "No asset gets a local account, a shared credential, or an access path that bypasses centralized identity — ever." },
      { title: "Grant least privilege at request time", detail: "Access is scoped to what the role requires and approved by the requester's manager before it's granted, not adjusted down after the fact." },
      { title: "Enforce MFA with no exceptions", detail: "Every access path to a Restricted-tier asset requires MFA — there is no 'just this once' exception path." },
      { title: "Recertify on a fixed cadence", detail: "Privileged access is recertified quarterly, standard access semi-annually. Access that isn't reconfirmed by its owner is revoked, not left standing by default." },
      { title: "Revoke same-day on offboarding", detail: "An HR termination or role-change event triggers same-business-day access revocation, not a queued ticket." },
      { title: "Log every change", detail: "Every provisioning and revocation event is logged, so an access review has a real trail to check against." },
    ],
  },
  {
    id: "control-ownership-assurance-review",
    code: "SOP-05",
    title: "Control Ownership & Assurance Review Procedure",
    category: "Governance",
    policyId: "infosec-governance",
    controlIds: ["GOV-01", "GOV-02", "RSK-01", "CPL-01", "IAO-01"],
    owner: "Security & Compliance Team",
    reviewCadence: "Reviewed annually, or when an asset's classification changes",
    evidenceType: "Auditor examination",
    purpose: "How an asset actually gets a real owner, a real Control Profile, and honest assurance scoring — the operational backbone behind the whole Cyber Assurance model.",
    steps: [
      { title: "Assign an owner at registration", detail: "No asset is added to the register without a named owner accountable for its control posture — not a team mailbox, a person." },
      { title: "Confirm its Control Profile", detail: "Before go-live, the asset's classification tier is checked against the Control Profile page's required maturity and evidence minimums for each Assurance Category." },
      { title: "Score maturity, evidence, and effectiveness separately", detail: "Each category is scored on all three inputs, not collapsed into a single pass/fail — a control can be Implemented but still poorly evidenced, and that distinction has to survive into the score." },
      { title: "Route gaps to the owner, not around them", detail: "Any category scoring below its tier's required minimum becomes a tracked gap assigned to the asset owner — it does not just quietly sit below the line." },
      { title: "Re-review on a trigger, not just a clock", detail: "Assurance scoring is re-reviewed annually, and immediately whenever an asset's classification tier changes." },
      { title: "Report the trend, not just the snapshot", detail: "Portfolio-level assurance trends go to leadership as part of the standing risk review — the same sparklines the Executive Dashboard shows." },
    ],
  },
  {
    id: "backup-recovery-continuity",
    code: "SOP-06",
    title: "Backup, Recovery & Continuity Procedure",
    category: "Resilience",
    policyId: "business-continuity",
    controlIds: ["BCD-01", "BCD-03", "BCD-06", "CAP-01"],
    owner: "IT / Engineering",
    reviewCadence: "Restore tested at least annually for Tier 1 assets",
    evidenceType: "Screenshot",
    purpose: "How ACME actually keeps an asset recoverable — not just backed up in theory, but proven restorable and resourced ahead of need.",
    steps: [
      { title: "Assign a recovery tier at onboarding", detail: "Every business-critical asset gets an RPO/RTO target at onboarding — recovery expectations are set before there's ever an incident, not during one." },
      { title: "Configure scheduled, isolated backups", detail: "Veeam backs up the asset on a schedule matching its tier, encrypted and stored separately from production so one failure can't take out both copies." },
      { title: "Replicate Tier 1 workloads", detail: "Tier 1 Azure workloads replicate to an alternate region via Azure Site Recovery as the standing recovery site." },
      { title: "Actually test the restore", detail: "Restoration is tested at least annually for Tier 1 assets — a backup that's never been restored isn't a proven backup, it's an assumption." },
      { title: "Watch capacity continuously", detail: "Azure Monitor tracks capacity continuously so resilience doesn't quietly erode because something simply ran out of room." },
      { title: "Capture lessons and update the plan", detail: "Every test or real disruption produces documented lessons learned, fed back into this procedure — not filed away and forgotten." },
    ],
  },
];

// Sanity check at module load, matching this repo's convention elsewhere
// (e.g. systemRegister.js's TRACKED_CONTROL_SCF_IDS) of catching a category
// typo immediately rather than silently rendering an empty Assurance Category.
const missing = ASSURANCE_CATEGORIES.filter((c) => !PROCEDURES.some((p) => p.category === c));
if (missing.length > 0) {
  throw new Error(`procedures.js is missing a procedure for: ${missing.join(", ")}`);
}
