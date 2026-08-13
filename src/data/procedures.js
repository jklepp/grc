// ACME's SOP library — the "how" behind each policy's "what," and the layer
// that actually closes the "every control needs a documented procedure" gap.
//
// These 15 SOPs are grouped by real operational ownership (same team, same
// tooling, same actual process), not by the 6 Assurance Categories used for
// dashboard rollups — that rollup is too coarse to claim as procedural
// coverage (e.g. it would lump HR background screening and AI governance
// review under the same "Governance" procedure, which is false). Each SOP's
// `domains` list is a partition of the 32 SCF domains that actually have
// matched controls (see ccfControls.js's CCF_VISIBLE_CONTROLS) — every
// domain appears in exactly one SOP, so every one of the ~307 matched
// controls resolves to exactly one governing procedure with no gaps and no
// double-counting. `category` still tags each SOP with the single closest
// Assurance Category (for the dashboard rollup and the Asset Register
// cross-reference) — most SOPs' domains agree on one category already; the
// one exception (SOP-10) is called out below where it happens.
//
// controlIds is deliberately NOT hand-typed here — with domains covering up
// to 46 real controls each, hand-listing IDs risks silently citing a control
// that doesn't exist or missing one that does. It's derived from the same
// real, already-imported SCF crosswalk every other page uses, so a SOP's
// claimed coverage can never drift from the source data.
import { ASSURANCE_CATEGORIES } from "./assuranceModel";
import { CCF_VISIBLE_CONTROLS } from "./ccfControls";

const PROCEDURE_DEFS = [
  {
    id: "encryption-implementation",
    code: "SOP-01",
    title: "Encryption & Data Classification Procedure",
    category: "Data Protection",
    domains: ["Data Classification & Handling", "Cryptographic Protections"],
    policyId: "data-classification",
    owner: "Data Platform / IT Security",
    reviewCadence: "Reviewed annually, or whenever a new data store is provisioned",
    evidenceType: "Automated technical test",
    purpose: "How ACME classifies data at creation and turns the Data Classification & Handling Policy's encryption requirement into something enforced on a real data store — not just labeled and hoped for.",
    steps: [
      { title: "Classify before you provision", detail: "Confirm the data store's classification tier against the Data Classification & Handling Policy before it's built — the tier decides what's required below, not the other way around." },
      { title: "Label it so it's traceable", detail: "Apply the Microsoft Purview sensitivity label matching the data's classification tier so downstream tools (DLP, access policies) can act on it automatically instead of relying on someone remembering." },
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
    title: "Secure Configuration & Change Management Procedure",
    category: "Configuration",
    domains: ["Change Management", "Configuration Management", "Cloud Security"],
    policyId: "change-configuration",
    owner: "IT / Engineering",
    reviewCadence: "Reviewed annually, or after a major platform change",
    evidenceType: "API configuration observation",
    purpose: "How a new asset gets built from a hardened baseline, how changes to it get approved, and how a cloud or SaaS service gets vetted before ACME data ever touches it.",
    steps: [
      { title: "Start from the approved baseline", detail: "Every server, container, or cloud resource is built from an approved, hardened configuration template (CIS Benchmark or vendor-hardened equivalent) — never assembled from scratch with default settings." },
      { title: "Enforce it, don't just document it", detail: "The baseline is applied through Intune (endpoints) or Azure Policy (cloud resources) so it's continuously enforced, not a one-time setup step." },
      { title: "Disable what isn't needed", detail: "Unused services, ports, and roles are turned off at build time — least functionality is verified against the baseline, not assumed." },
      { title: "Route deviations through change control", detail: "Any exception to the baseline requires a ServiceNow change request, reviewed and approved by someone other than the requester." },
      { title: "Vet new cloud/SaaS services before they touch data", detail: "New cloud infrastructure or SaaS tooling goes through IT/Security approval and a Defender for Cloud Apps posture check before it's connected to any ACME data." },
      { title: "Watch for drift automatically", detail: "Configuration monitoring flags any deviation from baseline after the fact, so an out-of-process change gets caught instead of quietly persisting." },
      { title: "Re-baseline after major changes", detail: "A platform upgrade or major version change triggers a fresh baseline review, not a one-time setup that's assumed to still hold." },
    ],
  },
  {
    id: "monitoring-alert-triage",
    code: "SOP-03",
    title: "Security Monitoring & Detection Procedure",
    category: "Detection",
    domains: ["Continuous Monitoring", "Threat Management", "Security Operations", "Endpoint Security"],
    policyId: "security-monitoring",
    owner: "IT Security / SOC function",
    reviewCadence: "Reviewed annually",
    evidenceType: "Continuous telemetry",
    purpose: "How ACME watches an asset once it's live, keeps its endpoints defended, and turns outside threat intelligence into detection rules — the full detect side, not just alert triage.",
    steps: [
      { title: "Forward logs before go-live", detail: "An asset is connected to Microsoft Sentinel before it goes into production — central logging isn't an optional add-on." },
      { title: "Deploy endpoint protection at build time", detail: "Every managed endpoint runs Microsoft Defender for Endpoint (anti-malware, EDR) before it's allowed to touch ACME data, not bolted on afterward." },
      { title: "Apply the standard rule set", detail: "The relevant analytics rules (identity, endpoint, network, or cloud) apply automatically by asset category — no asset waits on custom tuning before it's covered." },
      { title: "Feed in threat intelligence", detail: "External threat intelligence feeds inform detection rules, so ACME is watching for tactics relevant to its actual threat landscape, not a generic rule pack." },
      { title: "Triage against the SLA", detail: "Alerts are triaged by severity against a defined response SLA, regardless of who's on shift when they fire." },
      { title: "Escalate or tune", detail: "A confirmed anomaly escalates into the Incident Response process; a false positive gets tuned back into the rule set so the same noise doesn't repeat." },
      { title: "Retain and protect logs", detail: "Security logs are retained a minimum of 12 months and write-protected — an investigation can't rely on logs that could've been altered." },
      { title: "Review signal quality quarterly", detail: "Alert volume and false-positive rate are reviewed quarterly so the monitoring stays usable instead of becoming noise everyone tunes out." },
    ],
  },
  {
    id: "access-provisioning-review",
    code: "SOP-04",
    title: "Identity & Access Management Procedure",
    category: "Identity & Access",
    domains: ["Identification & Authentication", "Mobile Device Management"],
    policyId: "access-control",
    owner: "IT Security",
    reviewCadence: "Privileged access reviewed quarterly; standard access semi-annually",
    evidenceType: "API configuration observation",
    purpose: "How access to an asset actually gets granted, how the device requesting it gets trusted, and how both get reviewed and removed over time.",
    steps: [
      { title: "Provision through Entra ID/Okta only", detail: "No asset gets a local account, a shared credential, or an access path that bypasses centralized identity — ever." },
      { title: "Grant least privilege at request time", detail: "Access is scoped to what the role requires and approved by the requester's manager before it's granted, not adjusted down after the fact." },
      { title: "Enforce MFA with no exceptions", detail: "Every access path to a Restricted-tier asset requires MFA — there is no 'just this once' exception path." },
      { title: "Gate access on device trust", detail: "A device must pass an Intune compliance check (screen lock, encryption, current OS) before it's allowed to reach ACME data, whether company-owned or BYOD." },
      { title: "Recertify on a fixed cadence", detail: "Privileged access is recertified quarterly, standard access semi-annually. Access that isn't reconfirmed by its owner is revoked, not left standing by default." },
      { title: "Revoke same-day on offboarding", detail: "An HR termination or role-change event triggers same-business-day access revocation, not a queued ticket." },
      { title: "Log every change", detail: "Every provisioning and revocation event is logged, so an access review has a real trail to check against." },
    ],
  },
  {
    id: "control-ownership-assurance-review",
    code: "SOP-05",
    title: "Governance, Risk & Compliance Procedure",
    category: "Governance",
    domains: [
      "Security, Compliance & Resilience Governance",
      "Risk Management",
      "Compliance",
      "Information Assurance",
      "Project & Resource Management",
      "Artificial Intelligence & Autonomous Technologies",
    ],
    policyId: "infosec-governance",
    owner: "Security & Compliance Team",
    reviewCadence: "Reviewed annually, or when an asset's classification changes",
    evidenceType: "Auditor examination",
    purpose: "How ACME's security program actually runs day to day — asset ownership, risk logging, compliance obligation tracking, and how new projects (including AI features) get a security review before they ship.",
    steps: [
      { title: "Assign an owner at registration", detail: "No asset is added to the register without a named owner accountable for its control posture — not a team mailbox, a person." },
      { title: "Confirm its Control Profile", detail: "Before go-live, the asset's classification tier is checked against the Control Profile page's required maturity and evidence minimums for each Assurance Category." },
      { title: "Score maturity, evidence, and effectiveness separately", detail: "Each category is scored on all three inputs, not collapsed into a single pass/fail — a control can be Implemented but still poorly evidenced, and that distinction has to survive into the score." },
      { title: "Log risk in the register, not just in someone's head", detail: "Any risk identified during onboarding or review is logged in the Risk Register with a likelihood/impact score and an owner, not handled informally." },
      { title: "Track compliance obligations centrally", detail: "Regulatory and contractual commitments touching the asset are mapped to the controls that satisfy them and kept current in the Statement of Applicability." },
      { title: "Route new projects through a security gate", detail: "New initiatives — including AI/ML features — get a security and governance review before launch, not after something's already shipped." },
      { title: "Route gaps to the owner, not around them", detail: "Any category scoring below its tier's required minimum becomes a tracked gap assigned to the asset owner — it does not just quietly sit below the line." },
      { title: "Re-review on a trigger, not just a clock", detail: "Assurance scoring is re-reviewed annually, and immediately whenever an asset's classification tier changes." },
      { title: "Report the trend, not just the snapshot", detail: "Portfolio-level assurance trends go to leadership as part of the standing risk review — the same sparklines the Executive Dashboard shows." },
    ],
  },
  {
    id: "backup-recovery-continuity",
    code: "SOP-06",
    title: "Business Continuity & Resilience Procedure",
    category: "Resilience",
    domains: ["Business Continuity & Disaster Recovery", "Capacity & Performance Planning", "Maintenance"],
    policyId: "business-continuity",
    owner: "IT / Engineering",
    reviewCadence: "Restore tested at least annually for Tier 1 assets",
    evidenceType: "Screenshot",
    purpose: "How ACME keeps an asset recoverable and adequately resourced — backups, replication, capacity headroom, and scheduled maintenance, proven rather than assumed.",
    steps: [
      { title: "Assign a recovery tier at onboarding", detail: "Every business-critical asset gets an RPO/RTO target at onboarding — recovery expectations are set before there's ever an incident, not during one." },
      { title: "Configure scheduled, isolated backups", detail: "Veeam backs up the asset on a schedule matching its tier, encrypted and stored separately from production so one failure can't take out both copies." },
      { title: "Replicate Tier 1 workloads", detail: "Tier 1 Azure workloads replicate to an alternate region via Azure Site Recovery as the standing recovery site." },
      { title: "Actually test the restore", detail: "Restoration is tested at least annually for Tier 1 assets — a backup that's never been restored isn't a proven backup, it's an assumption." },
      { title: "Watch capacity continuously", detail: "Azure Monitor tracks capacity continuously so resilience doesn't quietly erode because something simply ran out of room." },
      { title: "Schedule maintenance in defined windows", detail: "Patching and maintenance happen in communicated windows, not ad hoc, so a routine task never gets mistaken for an outage." },
      { title: "Capture lessons and update the plan", detail: "Every test or real disruption produces documented lessons learned, fed back into this procedure — not filed away and forgotten." },
    ],
  },
  {
    id: "data-privacy-procedure",
    code: "SOP-07",
    title: "Data Privacy Procedure",
    category: "Data Protection",
    domains: ["Data Privacy"],
    policyId: "data-privacy",
    owner: "Privacy Team / DPO function",
    reviewCadence: "Reviewed annually, or when a new processing activity is introduced",
    evidenceType: "Document",
    purpose: "How ACME actually handles personal data responsibly day to day — the concrete review and request-handling process behind the Data Privacy Policy's principles.",
    steps: [
      { title: "Log the processing activity", detail: "Every new use of personal data is recorded in ACME's Record of Processing Activities (RoPA) with its purpose and legal basis before it starts, not after." },
      { title: "Run a DPIA when the threshold is met", detail: "New processing involving large-scale personal data, sensitive categories, or new technology (including AI/ML) gets a Data Protection Impact Assessment before launch." },
      { title: "Route data subject requests to Privacy", detail: "Access, correction, deletion, and portability requests go to the Privacy team, not whoever happens to receive them, and are fulfilled within the statutory window." },
      { title: "Require a DPA before sharing with a vendor", detail: "Personal data only moves to a third party under a signed data processing agreement covering how they'll protect it." },
      { title: "Use an approved transfer mechanism for cross-border data", detail: "Any transfer of personal data across borders uses a Legal-reviewed mechanism (e.g. Standard Contractual Clauses), not an assumption that it's fine." },
      { title: "Delete on schedule, not indefinitely", detail: "Personal data is deleted or anonymized per the retention schedule once it's no longer needed for its original purpose." },
    ],
  },
  {
    id: "network-perimeter-security",
    code: "SOP-08",
    title: "Network & Perimeter Security Procedure",
    category: "Identity & Access",
    domains: ["Network Security", "Web Security"],
    policyId: "network-remote-access",
    owner: "IT Security",
    reviewCadence: "Reviewed annually, or after a network architecture change",
    evidenceType: "API configuration observation",
    purpose: "How ACME protects the network perimeter and the traffic crossing it — remote access, segmentation, and public-facing web application protection.",
    steps: [
      { title: "Route remote access through Zscaler, not a flat VPN", detail: "Every remote connection is checked for identity and device posture before it reaches anything internal." },
      { title: "Segment production from corporate and guest networks", detail: "Access control lists restrict cross-segment traffic to documented business need, so one compromised segment doesn't expose the rest." },
      { title: "Filter DNS and content at the edge", detail: "Zscaler enforces DNS-layer filtering against known-malicious destinations for every managed device, on or off the corporate network." },
      { title: "Put public-facing web apps behind a WAF", detail: "Customer-facing applications sit behind Cloudflare's WAF and CDN with TLS enforced, never exposed directly." },
      { title: "Inspect outbound traffic for data loss", detail: "Microsoft Purview DLP inspects outbound email and file transfers for Confidential/Restricted data leaving through approved channels." },
      { title: "Monitor for intrusion at egress", detail: "Network intrusion detection is deployed at ACME's internet egress and monitored by Security Operations." },
    ],
  },
  {
    id: "asset-management-lifecycle",
    code: "SOP-09",
    title: "Asset Management & Lifecycle Procedure",
    category: "Configuration",
    domains: ["Asset Management"],
    policyId: "acceptable-use-asset",
    owner: "IT Security",
    reviewCadence: "Reviewed annually, or at asset onboarding/retirement",
    evidenceType: "API configuration observation",
    purpose: "How a technology asset actually enters, gets tracked in, and exits ACME's inventory — the operational backbone the Asset Register itself depends on.",
    steps: [
      { title: "Register the asset before it goes live", detail: "Every technology asset, application, and data store is added to ACME's asset system of record with a named business owner before it's used for real work." },
      { title: "Classify it at registration", detail: "The asset's criticality and data classification are set at intake, not added later once something's already gone wrong." },
      { title: "Enroll devices in Intune from day one", detail: "Company laptops and phones are enrolled and tracked from issue to retirement, with required security software that can't be disabled." },
      { title: "Track changes in ownership or status", detail: "A transfer, repurposing, or decommission is logged against the asset record, not left implicit." },
      { title: "Wipe and verify before disposal", detail: "Retired hardware is wiped to NIST 800-88 standards or physically destroyed by a certified vendor, and the disposal is logged against the asset record." },
      { title: "Reconcile the inventory periodically", detail: "The asset system of record is reconciled against what's actually deployed, so the inventory stays a source of truth instead of a stale list." },
    ],
  },
  {
    id: "secure-engineering-development",
    code: "SOP-10",
    title: "Secure Engineering, Development & Acquisition Procedure",
    // Secure Engineering & Architecture (8 controls) maps to Configuration and
    // Technology Development & Acquisition (14 controls) maps to Governance in
    // assuranceModel.js's DOMAIN_ASSURANCE_CATEGORY — the one domain pair in
    // this file that doesn't agree on a single category. Tagged Governance
    // here since it's the larger half by control count, not because
    // Configuration is wrong; a control's real category score still comes
    // from its own domain via categoryForDomain(), this field only picks
    // which dashboard bucket the SOP itself is filed under.
    category: "Governance",
    domains: ["Secure Engineering & Architecture", "Technology Development & Acquisition"],
    policyId: "secure-development",
    owner: "Engineering / IT Security",
    reviewCadence: "Reviewed annually, or per major SDLC/procurement process change",
    evidenceType: "Automated technical test",
    purpose: "How ACME builds software securely by design, and how a new technology purchase — including embedded/IoT devices — gets evaluated before ACME commits to it.",
    steps: [
      { title: "Design in defense-in-depth from the start", detail: "New systems are architected with multiple layers of protection, not a single control relied on alone." },
      { title: "Separate dev, test, and production", detail: "Real customer data isn't used in lower environments without an approved, documented exception." },
      { title: "Require peer review and automated testing before release", detail: "Production code changes go through review and CI security testing (GitHub Actions) before they ship." },
      { title: "Control access to source repositories", detail: "Production source code access is limited to engineers with a current business need, authenticated through the standard identity path." },
      { title: "Security-review new technology before purchase", detail: "Any new technology, including embedded/connected devices, is evaluated against ACME's minimum security requirements as part of procurement — before the PO is signed, not after." },
      { title: "Validate input by design", detail: "Applications validate and sanitize user input to prevent injection and similar attacks, as a design requirement, not a patch applied afterward." },
    ],
  },
  {
    id: "vulnerability-patch-management",
    code: "SOP-11",
    title: "Vulnerability & Patch Management Procedure",
    category: "Detection",
    domains: ["Vulnerability & Patch Management"],
    policyId: "vulnerability-patch",
    owner: "IT Security",
    reviewCadence: "Scanning is continuous; SLAs reviewed annually",
    evidenceType: "Automated technical test",
    purpose: "How ACME finds and closes security weaknesses before they're exploited — scanning cadence, remediation SLAs, and how patches actually get deployed.",
    steps: [
      { title: "Scan continuously, not once", detail: "Tenable runs authenticated vulnerability scans across internal and external assets on a recurring schedule; new internet-facing assets are scanned before go-live." },
      { title: "Rank findings by real risk", detail: "Vulnerabilities are prioritized by severity and exploitability, not fixed in whatever order they were found." },
      { title: "Remediate within SLA", detail: "Critical: 7 days. High: 30 days. Medium: 90 days. Low: next patch cycle. Exceptions require a documented risk acceptance, not a missed deadline that goes unnoticed." },
      { title: "Automate patch deployment", detail: "Endpoint patching runs through Intune; server patching through Azure Update Manager, on staggered rings (test, pilot, production)." },
      { title: "Commission independent penetration testing", detail: "A qualified third party tests production environments at least annually, and findings feed the same remediation process as any other vulnerability." },
      { title: "Track exceptions, don't let them go silent", detail: "Any SLA exception is logged with a reason and an owner, not just left overdue on a dashboard." },
    ],
  },
  {
    id: "incident-response-procedure",
    code: "SOP-12",
    title: "Incident Response Procedure",
    category: "Detection",
    domains: ["Incident Response"],
    policyId: "incident-response",
    owner: "ISIRT (Integrated Security Incident Response Team)",
    reviewCadence: "IR plan reviewed and tested at least annually",
    evidenceType: "Auditor examination",
    purpose: "What actually happens once something looks wrong — from the first report through containment, notification, and the lessons that feed back into the program.",
    steps: [
      { title: "Report immediately, don't investigate alone", detail: "A suspected incident is reported to IT Security right away; the reporting employee isn't expected to triage it themselves." },
      { title: "Classify by severity", detail: "Incidents are tiered SEV1–SEV4 per the IR plan, with response timelines and escalation paths that match the tier, not a one-size-fits-all response." },
      { title: "Preserve evidence before touching the device", detail: "A potentially compromised device isn't powered off, wiped, or 'fixed' by the reporting employee — IT Security preserves evidence first." },
      { title: "Contain, eradicate, and recover", detail: "ISIRT leads containment and recovery using Sentinel/Defender XDR as the detection and alerting backbone." },
      { title: "Determine notification obligations", detail: "Legal and Privacy determine whether customers, regulators, or individuals must be notified, and on what timeline, per law or contract." },
      { title: "Follow chain of custody for forensic evidence", detail: "Evidence collection follows a documented chain-of-custody process so it stays admissible if needed." },
      { title: "Document root cause and feed it back", detail: "After every incident, root cause and lessons learned are documented and fed back into controls and training — not filed away." },
    ],
  },
  {
    id: "physical-environmental-security",
    code: "SOP-13",
    title: "Physical & Environmental Security Procedure",
    category: "Resilience",
    domains: ["Physical & Environmental Security"],
    policyId: "physical-security",
    owner: "Facilities / IT",
    reviewCadence: "Access lists reviewed quarterly",
    evidenceType: "Screenshot",
    purpose: "How ACME controls physical access to its offices and any facility housing ACME systems — badges, visitors, and the environmental protections around equipment that's actually running.",
    steps: [
      { title: "Badge in individually", detail: "Every entry uses the individual's own badge; tailgating is refused, not waved through." },
      { title: "Escort every visitor", detail: "Guests sign in, wear a visible visitor badge, and are escorted in non-public areas." },
      { title: "Require extra clearance for sensitive areas", detail: "Server and network rooms require authorization beyond a standard building badge, and access is logged." },
      { title: "Monitor environmental conditions continuously", detail: "Server rooms have fire suppression, temperature/humidity monitoring, and backup power, monitored continuously, not checked periodically." },
      { title: "Review access lists quarterly", detail: "Access lists for restricted areas are reviewed quarterly by the area owner, the same cadence as a standard access recertification." },
      { title: "Practice clean-desk habits", detail: "Confidential/Restricted printouts, badges, and unlocked devices aren't left visible when a workspace is unattended, in the office or remote." },
    ],
  },
  {
    id: "hr-security-awareness",
    code: "SOP-14",
    title: "HR Security & Awareness Procedure",
    category: "Governance",
    domains: ["Human Resources Security", "Security Awareness & Training"],
    policyId: "hr-security",
    owner: "HR / Security & Compliance Team",
    reviewCadence: "Reviewed annually; training assigned annually per employee",
    evidenceType: "Document",
    purpose: "How security expectations get built into the employment lifecycle from background screening through offboarding, and how ACME keeps the whole company able to spot common threats.",
    steps: [
      { title: "Screen before day one", detail: "New hires and contractors complete role-appropriate background screening before starting, especially for roles with sensitive access." },
      { title: "Put security expectations in writing", detail: "Offer and onboarding paperwork include acknowledgment of ACME's security and acceptable use policies." },
      { title: "Separate sensitive duties by design", detail: "Financial transactions and production changes require two different people by design, not by trust." },
      { title: "Reassess access on role change", detail: "A transfer or promotion triggers an access review; old access doesn't carry forward by default." },
      { title: "Coordinate offboarding same-day", detail: "HR's termination event in Workday triggers access revocation the same business day." },
      { title: "Train everyone annually, and track it", detail: "All employees complete security awareness training at hire and annually thereafter through KnowBe4, with completion tracked, not assumed." },
      { title: "Run phishing simulations as practice", detail: "Simulated phishing emails give employees a chance to practice spotting real ones; repeat misses get targeted coaching, not just a note in a file." },
    ],
  },
  {
    id: "third-party-vendor-risk",
    code: "SOP-15",
    title: "Third-Party & Vendor Risk Procedure",
    category: "Governance",
    domains: ["Third-Party Management"],
    policyId: "third-party-risk",
    owner: "Procurement / Security & Compliance Team",
    reviewCadence: "Critical vendors reassessed periodically; cadence set by risk tier",
    evidenceType: "Auditor examination",
    purpose: "How a vendor actually gets vetted before it touches ACME or customer data, and how that relationship gets managed — not just reviewed once at signing.",
    steps: [
      { title: "Assess before signing, not after", detail: "A new vendor handling ACME or customer data is security-reviewed and risk-rated before the contract is signed." },
      { title: "Tier by criticality", detail: "Vendors are rated Critical/High/Standard/Low based on data sensitivity and business dependency; the tier sets assessment depth and reassessment frequency." },
      { title: "Collect real evidence, not a questionnaire alone", detail: "Reviews combine a standard questionnaire (SIG Lite/CAIQ) with evidence review — a SOC 2 report, an ISO 27001 certificate." },
      { title: "Put security terms in the contract", detail: "Data processing agreements, breach notification timelines, and right-to-audit clauses are standard terms for vendors handling Confidential/Restricted data." },
      { title: "Scope and review vendor access", detail: "Vendor personnel get minimum necessary access, reviewed on the same cadence as employee access." },
      { title: "Reassess critical vendors on a cycle", detail: "Critical vendors are reassessed periodically, not treated as cleared forever after the first review." },
      { title: "Consider the vendor's own supply chain", detail: "A critical vendor's sub-processors and dependencies are factored into the risk assessment, not treated as out of scope." },
    ],
  },
];

// controlIds derived from the real crosswalk, not hand-typed — see file
// header. Two SOPs asserting the same control would be a partition bug, so
// that's checked here too, right alongside the "every category covered"
// check that already existed.
export const PROCEDURES = PROCEDURE_DEFS.map((p) => ({
  ...p,
  controlIds: CCF_VISIBLE_CONTROLS.filter((c) => p.domains.includes(c.domain)).map((c) => c.id),
}));

const missingCategory = ASSURANCE_CATEGORIES.filter((c) => !PROCEDURES.some((p) => p.category === c));
if (missingCategory.length > 0) {
  throw new Error(`procedures.js is missing a procedure for: ${missingCategory.join(", ")}`);
}

const domainCounts = {};
PROCEDURE_DEFS.forEach((p) => p.domains.forEach((d) => (domainCounts[d] = (domainCounts[d] || 0) + 1)));
const duplicateDomains = Object.keys(domainCounts).filter((d) => domainCounts[d] > 1);
if (duplicateDomains.length > 0) {
  throw new Error(`procedures.js assigns the same SCF domain to more than one SOP: ${duplicateDomains.join(", ")}`);
}
