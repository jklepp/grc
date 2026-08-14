// ACME's SOP library — the "how" behind each policy's "what," and the layer
// that actually closes the "every control needs a documented procedure" gap.
//
// These 16 SOPs are grouped by real operational ownership (same team, same
// tooling, same actual process), not by the 6 Assurance Categories used for
// dashboard rollups — that rollup is too coarse to claim as procedural
// coverage (e.g. it would lump HR background screening and AI governance
// review under the same "Governance" procedure, which is false). Each SOP's
// `domains` list is a partition of the 32 SCF domains that actually have
// matched controls (see ccfControls.js's CCF_VISIBLE_CONTROLS) — every
// domain appears in exactly one SOP, so every one of the matched controls
// (currently ~323, and growing as more framework crosswalks get added)
// resolves to exactly one governing procedure with no gaps and no
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
//
// A SOP owning a domain is a coverage claim at the domain level, but it
// doesn't say WHERE in the procedure a given control is actually
// operationalized — which is exactly the gap between "a procedure exists for
// this area" and "this procedure tells an employee what to do for this
// specific control." So each step can optionally declare `controls`: the
// subset of the SOP's own controlIds that step actually operationalizes.
// Unlike controlIds, this list IS hand-curated (someone has to judge "this
// step is what satisfies that control"), but it's still validated below —
// every id a step claims must actually be one of the SOP's derived
// controlIds, so a typo or a control from the wrong domain fails the build
// instead of silently shipping a false claim. A control a SOP owns but that
// no step individually cites isn't a "gap" (the domain-level procedure still
// covers it) — it just hasn't been called out at step granularity yet, and
// `uncitedControlIds` below makes that visible rather than papering over it.
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
    purpose: "How ACME classifies data at creation and turns the Data Classification & Handling Policy's encryption requirement into something enforced on a real data store — not just labeled and hoped for. Encryption at rest, encryption in transit, key ownership, key rotation, administrative access to keys, and what happens to data once it leaves the primary store are each treated as distinct operational activities, not one blanket \"encryption is on\" checkbox.",
    steps: [
      { title: "Classify before you provision", detail: "Confirm the data store's classification tier against the Data Classification & Handling Policy before it's built — the tier decides what's required below, not the other way around. A tier that changes later triggers a reclassification of every control on this list.", controls: ["DCH-02", "DCH-11"] },
      { title: "Label it so it's traceable", detail: "Apply the Microsoft Purview sensitivity label matching the data's classification tier so downstream tools (DLP, access policies) can act on it automatically instead of relying on someone remembering.", controls: ["DCH-04", "DCH-01"] },
      { title: "Encrypt at rest to the floor standard", detail: "AES-256 (or equivalent) at rest is the non-negotiable floor for Confidential and Restricted data — this is checked, not assumed, at the Verify step below.", controls: ["CRY-01", "CRY-05"] },
      { title: "Encrypt in transit end-to-end", detail: "TLS 1.2+ is enforced on every segment carrying Confidential or Restricted data, including internal service-to-service connections and wireless access — internal traffic isn't treated as implicitly trusted.", controls: ["CRY-03", "CRY-04", "CRY-07"] },
      { title: "Own and rotate keys in Key Vault", detail: "Encryption keys are generated and held in Azure Key Vault, backed by a managed PKI for certificate-based trust — no production key is ever generated or stored anywhere else, including an engineer's machine. Data encryption keys rotate at least every 12 months; secrets rotate at least every 90 days. Rotation events are logged for audit. The same rule applies to application secrets generally: a database credential, API key, or connection string is never embedded in source code, a container image, a configuration file, or a CI/CD pipeline variable where a managed identity or a Key Vault reference is technically feasible — secret scanning in SOP-10's automated gate is the backstop, not the primary control.", controls: ["CRY-08"] },
      { title: "Restrict administrative access to keys", detail: "Non-console administrative access to Key Vault or a database's native encryption configuration requires MFA and goes through Privileged Identity Management, authenticated through the same cryptographic modules the platform uses elsewhere — there is no standing admin session against key material. Encryption is scoped to limit blast radius, not just to satisfy an \"encrypted at rest\" checkbox: keys are separated so that compromising one key doesn't expose every tenant's or every dataset's data, and no single individual can both manage key material and approve their own access to it.", controls: ["CRY-09", "CRY-06", "CRY-02"] },
      { title: "Turn it on at the platform layer", detail: "Enable encryption at the storage layer itself before the store accepts its first record — Azure Storage encryption or database-native encryption, matching ACME's Azure-first environment.", controls: ["DCH-01"] },
      { title: "Verify, don't assume", detail: "A Vanta automated test (or equivalent) confirms encryption is actually active — at rest and in transit — before the asset's Data Protection category is marked Managed. A control that's configured but unverified doesn't count." },
      { title: "Govern the data once it leaves the primary store", detail: "Physical or portable media — including removable media — carrying Confidential/Restricted data is access-controlled, tracked in storage and in transit, retained only per schedule, and disposed of / sanitized per NIST 800-88 once retention ends. Ad-hoc transfers go through an approved channel, geographic location and any publicly-accessible surface are checked against residency and exposure requirements, and data shared externally or de-identified for secondary use follows the same classification tier it started with.", controls: ["DCH-07", "DCH-08", "DCH-09", "DCH-10", "DCH-13", "DCH-14", "DCH-17", "DCH-19", "DCH-22", "DCH-23", "DCH-03", "DCH-06", "DCH-12", "DCH-15", "DCH-18", "DCH-21", "DCH-24"] },
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
      { title: "Start from the approved baseline", detail: "Every server, container, or cloud resource is built from an approved, hardened configuration template (CIS Benchmark or vendor-hardened equivalent) — never assembled from scratch with default settings.", controls: ["CFG-01"] },
      { title: "Enforce it, don't just document it", detail: "The baseline is applied through Intune (endpoints) or Azure Policy (cloud resources) so it's continuously enforced, not a one-time setup step." },
      { title: "Disable what isn't needed", detail: "Unused services, ports, and roles are turned off at build time — least functionality is verified against the baseline, not assumed.", controls: ["CFG-03"] },
      { title: "Route deviations through change control", detail: "Any exception to the baseline requires a ServiceNow change request, reviewed and approved by someone other than the requester; the requester's own access is restricted from approving their own change; and stakeholders who own dependent systems are notified before the change window.", controls: ["CHG-01", "CHG-02", "CHG-04", "CHG-05"] },
      { title: "Vet new cloud/SaaS services before they touch data", detail: "New cloud infrastructure or SaaS tooling goes through IT/Security approval and a Defender for Cloud Apps posture check — including where the provider actually stores and processes data — before it's connected to any ACME data.", controls: ["CLD-01", "CLD-09"] },
      { title: "Watch for drift automatically", detail: "Configuration monitoring flags any deviation from baseline after the fact — including unauthorized software installs — so an out-of-process change gets caught instead of quietly persisting.", controls: ["CFG-04"] },
      { title: "Re-baseline after major changes", detail: "A platform upgrade or major version change triggers a fresh baseline review, not a one-time setup that's assumed to still hold." },
      { title: "Secure cloud APIs and isolate multi-tenant risk", detail: "APIs are authenticated, rate-limited, and reviewed for excessive data exposure before they ship; any shared-tenancy service ACME depends on is evaluated for cross-tenant isolation as part of the cloud/SaaS vetting step above.", controls: ["CLD-04", "CLD-06", "CLD-12"] },
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
    purpose: "How ACME watches an asset once it's live, keeps its endpoints defended, and turns outside threat intelligence into detection rules — including the specific severity SLA a SOC analyst actually triages against and the exact handoff into Incident Response (SOP-12), not just \"alerts get triaged.\"",
    steps: [
      { title: "Forward logs before go-live", detail: "An asset is connected to Microsoft Sentinel before it goes into production, as part of ACME's continuous monitoring program — central logging isn't an optional add-on.", controls: ["MON-02", "MON-01"] },
      { title: "Capture logs that are actually useful in an investigation", detail: "Forwarded events must include actor identity, a synchronized time stamp, source/destination, and outcome — a log that can't answer \"who did what, when, from where\" doesn't satisfy this step even if it's technically \"logging.\" What gets forwarded is scoped to security-relevant events and their outcomes — authentication, privilege changes, access to Confidential/Restricted data, administrative and configuration actions — not every routine, successful execution of a normal operation; logging everything just buries the signal an investigation actually needs.", controls: ["MON-03", "MON-07"] },
      { title: "Deploy endpoint protection at build time", detail: "Every managed endpoint is enrolled in centralized endpoint device management and runs Microsoft Defender for Endpoint (anti-malware, EDR) and a software firewall before it's allowed to touch ACME data, not bolted on afterward.", controls: ["END-02", "END-05", "END-01", "END-04"] },
      { title: "Lock down installs and monitor file integrity", detail: "Standard users can't install software without elevation, security tooling itself can't be disabled by a standard user, and host-based intrusion detection plus file integrity monitoring runs on systems handling Confidential/Restricted data so an unauthorized change to a critical file is detected, not discovered later.", controls: ["END-03", "END-06", "END-07", "END-16"] },
      { title: "Filter phishing and enforce a trusted access path", detail: "Email and endpoint phishing/spam protection is enabled fleet-wide, and login prompts are rendered through a trusted OS-level path so a spoofed credential dialog can't harvest a password.", controls: ["END-08", "END-09"] },
      { title: "Apply the standard rule set", detail: "The relevant analytics rules (identity, endpoint, network, or cloud) apply automatically by asset category under a documented security concept of operations — no asset waits on custom tuning before it's covered.", controls: ["OPS-01", "OPS-02"] },
      { title: "Feed in threat intelligence and track exposure", detail: "External threat intelligence feeds — including a maintained threat catalog relevant to ACME's industry — inform detection rules, and known indicators of exposure (exposed credentials, unpatched internet-facing services) are actively tracked, so ACME is watching for tactics relevant to its actual threat landscape, not a generic rule pack. A vulnerability disclosure program gives outside researchers a channel to report what internal scanning missed.", controls: ["THR-01", "THR-02", "THR-10", "THR-03", "THR-06", "THR-09"] },
      { title: "Run an insider threat program alongside external detection", detail: "Anomalous internal behavior (mass download, off-hours access to Restricted data, access outside a role's normal pattern) is a monitored category in its own right, not an afterthought to external-attacker detection.", controls: ["THR-04"] },
      { title: "Triage against a defined SLA", detail: "SEV1 (active compromise): acknowledge within 15 minutes. SEV2 (high-confidence malicious): 1 hour. SEV3 (suspicious, needs investigation): 4 hours. SEV4 (informational/low-risk): next business day. These are the same severity tiers SOP-12 uses, so triage and response share one clock.", controls: ["OPS-03"] },
      { title: "Escalate or tune", detail: "A confirmed anomaly escalates directly into the SOP-12 Incident Response process at the matching severity tier; a false positive gets tuned back into the rule set so the same noise doesn't repeat; and outbound traffic patterns consistent with covert exfiltration or other anomalous behavior are treated as confirmed until ruled out, not the reverse.", controls: ["MON-11", "MON-15", "MON-16"] },
      { title: "Alert on monitoring failures, not just security events", detail: "A gap in log ingestion or a failed detection pipeline generates its own alert to the SOC — a monitoring blind spot is treated as an incident-worthy condition, not silently absorbed.", controls: ["MON-05"] },
      { title: "Retain and protect logs", detail: "Security logs are retained a minimum of 12 months per ACME's log retention schedule and write-protected — an investigation can't rely on logs that could've been altered or already aged out.", controls: ["MON-08", "MON-10"] },
      { title: "Review signal quality quarterly", detail: "Alert volume and false-positive rate are reviewed quarterly so the monitoring stays usable instead of becoming noise everyone tunes out.", controls: ["MON-06"] },
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
      { title: "Provision through Entra ID/Okta only", detail: "No asset gets a local account, a shared credential, or an access path that bypasses centralized identity — ever.", controls: ["IAC-01", "IAC-07"], evidence: { type: "file", label: "Entra ID / Okta provisioning export for the period", accept: ".csv,.xlsx,.json" } },
      { title: "Grant least privilege at request time", detail: "Access is scoped to what the role requires through role-based access control and approved by the requester's manager before it's granted, not adjusted down after the fact. Standing privileged access is the exception, not the default: where just-in-time or just-enough-access activation (Privileged Identity Management) is technically supported, privileged roles are activated for a bounded task window rather than held continuously — a standing grant requires documented justification against the asset it applies to.", controls: ["IAC-08", "IAC-20"] },
      { title: "Enforce MFA with no exceptions", detail: "Every access path to a Restricted-tier asset requires MFA — there is no 'just this once' exception path. Higher-risk sign-ins (new device, new location, impossible travel) trigger adaptive step-up authentication automatically.", controls: ["IAC-02", "IAC-10", "IAC-13"] },
      { title: "Gate access on device trust", detail: "A device must pass an Intune compliance check (screen lock, encryption, current OS) before it's allowed to reach ACME data, whether company-owned or BYOD.", controls: ["IAC-04", "MDM-02", "MDM-03"] },
      {
        title: "Recertify on a fixed cadence",
        detail: "Privileged access is recertified quarterly, standard access semi-annually. Access that isn't reconfirmed by its owner is revoked, not left standing by default.",
        controls: ["IAC-16", "IAC-17"],
        evidence: {
          type: "fields",
          label: "Access review population",
          fields: [
            { key: "reviewed", label: "Accounts reviewed", kind: "number" },
            { key: "approved", label: "Approved as-is", kind: "number" },
            { key: "flagged", label: "Flagged for revocation", kind: "number" },
          ],
          reconcile: { formula: "reviewed = approved + flagged", check: (v) => Number(v.reviewed) === Number(v.approved) + Number(v.flagged) },
          summaryKey: "flagged",
        },
      },
      {
        title: "Revoke same-day on offboarding",
        detail: "An HR termination or role-change event triggers same-business-day access revocation and remote device wipe, not a queued ticket. This step also closes out anything flagged for revocation by the access review above.",
        controls: ["IAC-07", "MDM-05"],
        evidence: {
          type: "tickets",
          label: "Revocation ticket IDs",
          pattern: /^(INC|SEC)-\d{4,6}$/i,
          patternHint: "INC-##### or SEC-#####",
          expectedFromStep: 4,
          expectedLabel: "flagged for revocation",
        },
      },
      { title: "Enforce session and credential hygiene", detail: "Sensitive actions require re-authentication even within an active session; credentials are never shared between users; accounts lock out after repeated failed attempts; and idle sessions terminate automatically rather than staying open indefinitely.", controls: ["IAC-14", "IAC-19", "IAC-22", "IAC-25"] },
      { title: "Extend the same identity standard to third parties", detail: "A contractor or third-party integration authenticates through the same centralized identity path as an employee, and a new identity — human or service account — is proofed before it's trusted, not created on request alone.", controls: ["IAC-05", "IAC-28"] },
      { title: "Retire long-lived credentials for services and integrations", detail: "A service, workload, or third-party integration authenticates using a managed/workload identity or a short-lived, automatically rotated credential wherever the platform supports it — never a static password or an API key with no expiration. Where an integration must use an OAuth token or API key, it is scoped to the minimum set of permissions the integration actually needs, given the shortest practical lifetime, monitored for use, and immediately revocable — a broad, long-lived, unmonitored token is treated as a finding regardless of which vendor issued it." },
      { title: "Treat production access as the exception, not the default", detail: "Human access to production systems and data is granted for a specific task, time-bound, and requested through Privileged Identity Management rather than held as a standing assignment. Every session is attributable to a named individual — never a shared or generic account — and is logged in full, so \"who touched production and when\" is always answerable from the log, not from memory." },
      {
        title: "Log every change",
        detail: "Every provisioning and revocation event is logged, so an access review has a real trail to check against — including confirming every revocation ticket above actually produced a logged removal.",
        evidence: {
          type: "verify",
          label: "Confirm logged removals match revocation tickets",
          expectedFromStep: 5,
          expectedLabel: "revocation tickets opened",
          actualLabel: "Removals confirmed in the access log",
        },
      },
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
    ],
    policyId: "infosec-governance",
    owner: "Security & Compliance Team",
    reviewCadence: "Reviewed annually, or when an asset's classification changes",
    evidenceType: "Auditor examination",
    purpose: "How ACME's security program actually runs day to day — asset ownership, risk logging with a defined review cadence, compliance obligation tracking, and how the program itself is staffed and independently checked. AI/autonomous technology governance has its own procedure — see SOP-16 — since AI now carries its own dedicated control set distinct from general program governance.",
    steps: [
      { title: "Assign an owner at registration", detail: "No asset is added to the register without a named owner accountable for its control posture — not a team mailbox, a person — under a formal program with responsibilities assigned by name, scoped against ACME's defined business context and mission, not assumed.", controls: ["GOV-08", "GOV-09", "GOV-01", "GOV-04"] },
      { title: "Confirm its Control Profile", detail: "Before go-live, the asset's classification tier is checked against the Control Profile page's required maturity and evidence minimums for each Assurance Category, mapped back to a defined control objective and ACME's broader data governance standard, not a vague expectation.", controls: ["GOV-09", "GOV-10"] },
      { title: "Score maturity, evidence, and effectiveness separately", detail: "Each category is scored on all three inputs, not collapsed into a single pass/fail — a control can be Implemented but still poorly evidenced, and that distinction has to survive into the score, backed by documentation of the control as actually applied. Scoring itself is subject to periodic independent assessment, not just self-reported.", controls: ["GOV-05", "IAO-02", "IAO-03"] },
      { title: "Log risk in the register with a defined review cadence", detail: "Any risk identified during onboarding or review is logged in the Risk Register under ACME's formal risk management program, with a documented risk assessment, a likelihood/impact score, a categorization tier, and an owner. Critical risks are reviewed monthly, High quarterly, Medium/Low annually — a risk doesn't sit unreviewed just because it was logged once, and the assessment itself is refreshed on the same cadence, not left to go stale. Critical-asset risks include a documented Business Impact Analysis; a new processing activity that meets the DPIA threshold gets a Data Protection Impact Assessment logged here too; and third-party dependency risk feeds the same register SOP-15 draws from.", controls: ["RSK-02", "RSK-03", "RSK-05", "RSK-06", "RSK-08", "RSK-09", "RSK-01", "RSK-04", "RSK-07", "RSK-10"] },
      { title: "Track compliance obligations centrally", detail: "Regulatory and contractual commitments touching the asset are mapped to the controls that satisfy them and kept current in the Statement of Applicability, which is published where auditors and internal stakeholders can actually find it, with oversight of how those controls are actually operating day to day. Statutory/contractual compliance status feeds the same assessment and audit activity below, and anything that could be material to a regulator or investor is flagged through a defined materiality determination, not left to individual judgment.", controls: ["CPL-01", "CPL-03", "CPL-04", "CPL-12", "GOV-02", "CPL-02", "GOV-16"] },
      { title: "Route gaps to the owner, not around them", detail: "Any category scoring below its tier's required minimum becomes a tracked gap assigned to the asset owner with a closure SLA: Critical gaps close or get a documented risk acceptance within 30 days, High within 90 days — it does not just quietly sit below the line as day-to-day practice.", controls: ["GOV-14", "GOV-15"] },
      { title: "Re-review on a trigger, not just a clock", detail: "Assurance scoring is re-reviewed annually as part of the program's own periodic update cycle, and immediately whenever an asset's classification tier changes or a security authorization needs to be reconfirmed.", controls: ["GOV-03", "IAO-07"] },
      { title: "Report the trend, not just the snapshot", detail: "Portfolio-level assurance trends go to leadership as part of the standing risk review — the same sparklines the Executive Dashboard shows — and the relevant regulator, industry group, or authority contact is kept current in case it's ever needed.", controls: ["GOV-17", "GOV-06", "GOV-07"] },
      { title: "Fund and staff the program like a real initiative", detail: "Security and compliance work is allocated real budget and headcount through the same project management process as any other initiative — with its own resource management and clearly defined requirements — including secure-development-lifecycle work, not treated as unfunded overhead layered onto other teams' capacity.", controls: ["PRM-01", "PRM-03", "PRM-04", "PRM-06", "PRM-07", "IAO-01", "PRM-02", "PRM-05"] },
      { title: "Independently verify the program is actually working", detail: "Flaw remediation during development is tracked back to its root cause, findings are technically verified rather than taken on faith, and any capability deficiency identified along the way is logged and tracked to closure, not just noted and forgotten.", controls: ["IAO-04", "IAO-05", "IAO-06"] },
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
      { title: "Assign a recovery tier at onboarding", detail: "Every business-critical asset gets an RPO/RTO target at onboarding, tied to how it was identified as a critical asset in the first place under the Business Continuity Management System — recovery expectations are set before there's ever an incident, not during one.", controls: ["BCD-01", "BCD-02"] },
      { title: "Configure scheduled, isolated backups", detail: "Veeam backs up the asset on a schedule matching its tier, encrypted and stored separately from production so one failure can't take out both copies; backup hardware and media are physically protected to the same standard as production. Backup storage uses immutable, write-once retention or a credential and access path separate from production, so that fully compromising production does not also give an attacker the ability to delete or encrypt the recovery copies.", controls: ["BCD-11", "BCD-13"] },
      { title: "Replicate Tier 1 workloads", detail: "Tier 1 Azure workloads replicate to an alternate storage site in a different region via Azure Site Recovery, with alternative security measures and telecommunications availability confirmed for that site — a standby site nobody has verified can actually run production isn't a real standby site.", controls: ["BCD-08", "BCD-10", "BCD-07"] },
      { title: "Actually test the restore", detail: "Restoration is tested at least annually for Tier 1 assets — a backup that's never been restored isn't a proven backup, it's an assumption.", controls: ["BCD-04"] },
      { title: "Watch capacity continuously", detail: "Azure Monitor tracks capacity continuously against defined thresholds, and resource priority is set in advance for degraded-capacity scenarios so resilience doesn't quietly erode because something simply ran out of room.", controls: ["CAP-02", "CAP-03"] },
      { title: "Schedule maintenance in defined windows", detail: "Patching and maintenance happen in communicated windows using approved maintenance tools, on a timeliness standard matched to the finding's severity, not ad hoc, so a routine task never gets mistaken for an outage.", controls: ["MNT-01", "MNT-03", "MNT-04"] },
      { title: "Capture lessons and update the plan", detail: "Every test or real disruption produces a documented root cause analysis and lessons learned, fed back into this procedure — not filed away and forgotten.", controls: ["BCD-05"] },
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
    purpose: "How ACME actually handles personal data responsibly day to day. ACME processes both general personal data (covered by GDPR-style obligations — RoPA, DPIAs, cross-border transfer mechanisms) and health-related data through specific systems like its support ticketing platform (covered by HIPAA-style obligations — minimum necessary, BAAs, accounting of disclosures). Both get their own concrete, specific steps below rather than one generic \"handle personal data carefully\" narrative.",
    steps: [
      { title: "Log the processing activity", detail: "Every new use of personal data — including any use of health-related data shared in a support interaction — is recorded in ACME's Record of Processing Activities (RoPA) with its purpose and legal basis before it starts, not after.", controls: ["PRI-14", "PRI-01"] },
      { title: "Publish what's collected and why", detail: "ACME's privacy notice is kept current with what's actually collected and processed, including how choice and consent are captured where required — it describes the real RoPA, not a generic template.", controls: ["PRI-02", "PRI-03"] },
      { title: "Collect only what the purpose needs", detail: "Collection is restricted to the identified purpose. For health-related data specifically, this is a minimum-necessary standard: an agent or system pulls only what's needed to resolve the specific issue, not the full history available.", controls: ["PRI-04"] },
      { title: "Run a DPIA when the threshold is met", detail: "New processing involving large-scale personal data, sensitive categories (including health-related data), or new technology (including AI/ML) gets a Data Protection Impact Assessment before launch — logged in the Risk Register under SOP-05." },
      { title: "Route data subject and patient requests to Privacy, on the clock", detail: "Access, correction, deletion, and portability requests go to the Privacy team, not whoever happens to receive them, with a clear channel for a data subject to actually exercise those rights. General access/deletion requests are fulfilled within 30 days. Requests to correct or amend health-related data are actioned within 60 days, and an individual can get an accounting of who their health-related data was disclosed to, on request.", controls: ["PRI-17", "PRI-06"] },
      { title: "Require the right agreement before sharing with a vendor", detail: "Personal data only moves to a third party under a signed data processing agreement, with a defined communication path back to ACME as data controller; a vendor that will receive health-related data signs a Business Associate Agreement specifically, before any data flows, not retroactively.", controls: ["PRI-07", "PRI-18"] },
      { title: "Use an approved transfer mechanism for cross-border data", detail: "Any transfer of personal data across borders uses a Legal-reviewed mechanism (e.g. Standard Contractual Clauses), not an assumption that it's fine." },
      { title: "Delete on schedule, not indefinitely", detail: "Personal data is deleted or anonymized per the retention schedule once it's no longer needed for its original purpose.", controls: ["PRI-05"] },
      { title: "Keep data quality current", detail: "A correction accepted from a data subject or patient updates the source system through a defined update process, not just a note in a ticket — RoPA accuracy and disclosure accounting both depend on the underlying data actually being right.", controls: ["PRI-10", "PRI-12"] },
      { title: "Escalate a privacy incident with its own notification clock", detail: "A privacy incident — including one involving health-related data — is escalated through SOP-12 like any other incident, but Legal and Privacy separately track any statutory notification deadline that applies (for a health-data breach, notification to affected individuals and regulators within 60 days), and the response is reviewed and tested as part of ACME's ongoing privacy control testing and training.", controls: ["PRI-08"] },
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
    purpose: "How ACME protects the network perimeter and the traffic crossing it — remote access, segmentation, and public-facing web application protection — including how each of those controls actually gets verified, not just configured once and assumed to hold.",
    steps: [
      { title: "Route remote access through Zscaler, not a flat VPN", detail: "Every remote connection is checked for identity and device posture before it reaches anything internal.", controls: ["NET-14"] },
      { title: "Layer defenses at the boundary", detail: "The network perimeter uses multiple independent network security controls (firewall, IPS, proxy) rather than a single control an attacker only has to beat once.", controls: ["NET-02", "NET-03", "NET-01"] },
      { title: "Segment production from corporate and guest networks — and verify it", detail: "Access control lists enforce data-flow restrictions between segments to documented business need. Segmentation is verified by an annual internal test that specifically attempts cross-segment lateral movement — a network diagram showing segments isn't evidence that they actually hold.", controls: ["NET-06", "NET-04"] },
      { title: "Formalize connections to outside networks", detail: "Any direct network connection to a partner, vendor, or acquired company's network is governed by a documented Interconnection Security Agreement before traffic flows, not set up informally by whoever has the fastest path to get it working.", controls: ["NET-05"] },
      { title: "Filter DNS and content at the edge", detail: "Zscaler enforces DNS-layer filtering against known-malicious destinations for every managed device, on or off the corporate network.", controls: ["NET-18"] },
      { title: "Protect data and session integrity over open networks", detail: "Traffic carrying Confidential/Restricted data over any open or untrusted network is encrypted end-to-end, sessions are protected against hijacking or replay, and idle or stale connections are terminated rather than left open indefinitely — not just authenticated once at connection time.", controls: ["NET-09", "NET-12", "NET-07"] },
      { title: "Secure wireless access", detail: "Corporate wireless requires certificate- or credential-based authentication with the same encryption standard as SOP-01's transit requirement — an open or WEP/WPA-only network is never in scope for ACME data.", controls: ["NET-15"] },
      { title: "Put public-facing web apps behind a WAF", detail: "Customer-facing applications sit in a DMZ behind Cloudflare's WAF and CDN with TLS enforced end-to-end for all web traffic, are monitored for unauthorized website changes, and are never exposed directly.", controls: ["WEB-02", "WEB-03", "WEB-01", "WEB-10", "WEB-13"] },
      { title: "Require strong authentication on customer-facing apps", detail: "Customer-facing applications handling Confidential/Restricted data enforce strong customer authentication (not a password alone) before granting account access." , controls: ["WEB-06"] },
      { title: "Inspect outbound traffic for data loss", detail: "Microsoft Purview DLP inspects outbound email, electronic messaging, and file transfers for Confidential/Restricted data leaving through approved channels.", controls: ["NET-17", "NET-13"] },
      { title: "Monitor for intrusion at egress", detail: "Network intrusion detection is deployed at ACME's internet egress and monitored by Security Operations, with alerts triaged against the same SEV1–SEV4 SLA table SOP-03 defines.", controls: ["NET-08"] },
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
      { title: "Register the asset before it goes live", detail: "Every technology asset, application, and data store is added to ACME's asset system of record with a named business owner before it's used for real work.", controls: ["AST-01", "AST-03"] },
      { title: "Classify it at registration", detail: "The asset's criticality and data classification are set at intake, not added later once something's already gone wrong." },
      { title: "Enroll devices in Intune from day one", detail: "Company laptops and phones are enrolled and tracked from issue to retirement, with required security software that can't be disabled." },
      { title: "Track changes in ownership or status", detail: "A transfer, repurposing, or decommission is logged against the asset record, not left implicit." },
      { title: "Maintain network and data-flow diagrams as the estate changes", detail: "Network diagrams and data flow diagrams are updated whenever an asset materially changes what it connects to, not redrawn once a year from memory — the reconciliation step below checks the diagram against reality, not just the inventory list.", controls: ["AST-04"] },
      { title: "Set expectations for unattended and public-facing equipment", detail: "Devices are locked when unattended, and any kiosk or point-of-interaction device (e.g. a physical check-in or payment terminal) is hardened and tamper-evident by design, not treated as a normal endpoint." , controls: ["AST-06", "AST-07"]},
      { title: "Govern personal devices used for work", detail: "A personal device used for ACME work is tracked as an asset for acceptable-use purposes even though ACME doesn't own it — this is the inventory-side counterpart to SOP-04's device-trust access control, not a duplicate of it.", controls: ["AST-12"] },
      { title: "Protect against logical tampering", detail: "Firmware and configuration integrity on critical assets is checked so an unauthorized modification below the OS layer doesn't go unnoticed.", controls: ["AST-15"] },
      { title: "Wipe and verify before disposal", detail: "Retired hardware is wiped to NIST 800-88 standards or physically destroyed by a certified vendor, and the disposal is logged against the asset record.", controls: ["AST-09"] },
      { title: "Confirm the asset comes back on offboarding", detail: "A departing employee's issued hardware is returned and logged before final settlement, coordinated with SOP-14's same-day offboarding trigger — access being revoked doesn't automatically mean the laptop came back.", controls: ["AST-10"] },
      { title: "Reconcile the inventory periodically", detail: "The asset system of record is reconciled against what's actually deployed and against the current network/data-flow diagrams, so the inventory stays a source of truth instead of a stale list." },
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
    purpose: "How ACME builds software securely by design, and how a new technology purchase — including embedded/IoT devices — gets evaluated before ACME commits to it. The pipeline below (pull request through production approval) is the actual mechanism, not a principle to interpret.",
    steps: [
      { title: "Design in defense-in-depth from the start", detail: "New systems are architected with multiple layers of protection under a documented defense-in-depth architecture, aligned to ACME's target enterprise architecture, not a single control relied on alone or a one-off design nobody else's systems match.", controls: ["SEA-01", "SEA-02", "TDA-05", "SEA-03"] },
      { title: "Isolate processes and plan for failure", detail: "Processes run isolated from each other by default, and new systems go through a predictable-failure analysis (what happens when a dependency is unavailable) before launch, not after the first outage reveals it.", controls: ["SEA-04", "SEA-07"] },
      { title: "Harden login and don't leak system details", detail: "Login flows go through OS/platform-secure log-on procedures, and error responses, headers, and banners don't reveal stack traces, versions, or internal architecture to an unauthenticated caller.", controls: ["SEA-14", "SEA-17"] },
      { title: "Enforce authorization independently of authentication", detail: "A valid session or API token establishes who is calling, not what they're allowed to do. Every protected resource or action performs its own authorization check — scoped to the specific tenant, object, and operation being requested — rather than inferring permission from a successful login or a valid token alone. \"This request came from an authenticated integration\" is not the same claim as \"this request may read this customer's data.\"" },
      { title: "Isolate tenants at more than the application layer", detail: "For any multi-tenant system, tenant isolation does not rely solely on an application-level query filter. Isolation is enforced in layers — token/session scoping, service-level tenant context, and, where the data layer supports it (e.g., PostgreSQL Row-Level Security), enforcement inside the database itself — so a single application bug cannot silently return data across tenants." },
      { title: "Keep clocks synchronized", detail: "All systems sync to a common time source — log correlation and forensic timelines across SOP-03 and SOP-12 depend on timestamps actually agreeing with each other.", controls: ["SEA-20"] },
      { title: "Secure the development environment itself", detail: "Development environments are built and configuration-managed to the same rigor as production — a dev environment with weak controls is a viable path to production credentials and code.", controls: ["TDA-07", "TDA-14"] },
      { title: "Separate dev, test, and production", detail: "Real customer data isn't used in lower environments without an approved, documented exception.", controls: ["TDA-08", "TDA-10"] },
      { title: "Screen developers before granting production access", detail: "An engineer gets access to production code or data only after the role-appropriate background screening SOP-14 requires is complete — access isn't granted on start date by default." , controls: ["TDA-13"]},
      { title: "Control access to source repositories", detail: "Production source code access is limited to engineers with a current business need, authenticated through the standard identity path.", controls: ["TDA-20"] },
      { title: "Require peer review with documentation before merge", detail: "Every pull request requires review by someone other than the author, with a documented rationale for the change — an undocumented, self-approved change doesn't ship.", controls: ["TDA-04"] },
      { title: "Run the automated gate", detail: "Every PR runs static analysis (SAST), a dependency/software-composition scan, secret scanning, and unit/security tests, per ACME's secure software development practices — security testing runs throughout development, not just at the gate. A Critical or High finding blocks the merge automatically and gets a documented threat analysis and remediation plan — the author needs a documented risk acceptance from Security to override it, not a re-run of the pipeline until it's green.", controls: ["TDA-02", "TDA-06", "TDA-09", "TDA-15"] },
      { title: "Build, stage, and gate production separately", detail: "A merged change builds an artifact, deploys to staging, runs dynamic testing (DAST) against the running application, and requires a separate production-deployment approval — merge and production release are two different events, not one. Every artifact that reaches production is traceable back to the exact source commit and pipeline run that built it; an engineer does not manually push, copy, or hotfix an artifact into production outside the pipeline — a production change that didn't come from the pipeline is treated as an unauthorized change, not an emergency shortcut." },
      { title: "Security-review new technology before purchase", detail: "Any new technology, including embedded/connected devices, is evaluated against ACME's minimum security requirements as part of procurement — before the PO is signed, not after.", controls: ["TDA-01"] },
      { title: "Validate input by design", detail: "Applications validate and sanitize user input to prevent injection and similar attacks, as a design requirement, not a patch applied afterward.", controls: ["TDA-18"] },
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
      { title: "Scan continuously, not once", detail: "Tenable runs authenticated vulnerability scans across internal and external assets on a recurring schedule; new internet-facing assets are scanned before go-live.", controls: ["VPM-06"] },
      { title: "Rank findings by real risk", detail: "Vulnerabilities are prioritized by severity and exploitability, not fixed in whatever order they were found.", controls: ["VPM-03"] },
      { title: "Remediate within SLA", detail: "Critical: 7 days. High: 30 days. Medium: 90 days. Low: next patch cycle. Exceptions require a documented risk acceptance, not a missed deadline that goes unnoticed.", controls: ["VPM-02"] },
      { title: "Automate patch deployment", detail: "Endpoint patching runs through Intune; server patching through Azure Update Manager, on staggered rings (test, pilot, production).", controls: ["VPM-05"] },
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
      { title: "Report immediately, don't investigate alone", detail: "A suspected incident is reported to IT Security right away; the reporting employee isn't expected to triage it themselves, and Security provides a clear, low-friction way for anyone — employee, customer, or vendor — to report a suspected issue.", controls: ["IRO-02", "IRO-11"] },
      { title: "Classify by severity", detail: "Incidents are tiered SEV1–SEV4 — the same tiers SOP-03 triages alerts against — with response timelines and escalation paths that match the tier, not a one-size-fits-all response.", controls: ["IRO-09"] },
      { title: "Preserve evidence before touching the device", detail: "A potentially compromised device isn't powered off, wiped, or 'fixed' by the reporting employee — IT Security preserves evidence first." },
      { title: "Contain, eradicate, and recover", detail: "ISIRT leads containment and recovery using Sentinel/Defender XDR as the detection and alerting backbone." },
      { title: "Determine notification obligations", detail: "Legal and Privacy determine whether customers, regulators, or individuals must be notified, and on what timeline, per law or contract — including the accelerated timeline for a data spill involving sensitive or regulated data.", controls: ["IRO-14", "IRO-12"] },
      { title: "Follow chain of custody for forensic evidence", detail: "Evidence collection follows a documented chain-of-custody process so it stays admissible if needed.", controls: ["IRO-08"] },
      { title: "Document root cause and feed it back", detail: "After every incident, root cause and lessons learned are documented and fed back into controls and training — not filed away." },
      { title: "Train responders and test the plan annually", detail: "ISIRT members complete incident response training, and the IR plan itself is exercised at least annually through a tabletop or live drill — a plan that's only ever been read, not run, isn't a tested plan.", controls: ["IRO-05", "IRO-06"] },
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
    purpose: "How ACME controls physical access to its offices and any facility housing ACME systems — badges, visitors, deliveries, and the environmental protections around equipment that's actually running — and how those same expectations extend to a remote employee's home office, not just a corporate building.",
    steps: [
      { title: "Badge in individually", detail: "Every entry uses the individual's own badge, authorized in advance against a defined access list under ACME's physical access control program; tailgating is refused, not waved through.", controls: ["PES-02", "PES-03"] },
      { title: "Escort every visitor", detail: "Guests sign in, wear a visible visitor badge, and are escorted in non-public areas at all times under a documented visitor control process — an unescorted guest is treated as a security event, not an oversight.", controls: ["PES-04", "PES-06"] },
      { title: "Require extra clearance for sensitive areas", detail: "Server and network rooms require authorization beyond a standard building badge, and every entry is logged and monitored, not just recorded.", controls: ["PES-02", "PES-05"] },
      { title: "Control deliveries and equipment removal", detail: "Deliveries are received at a controlled dock, logged, and inspected before entering secure areas; equipment leaving the building requires a documented asset-removal authorization, tying back to SOP-09's asset record.", controls: ["PES-10"] },
      { title: "Monitor environmental conditions continuously", detail: "Server rooms and other equipment sites have fire suppression, temperature/humidity monitoring, backup power, and equipment sited to reduce environmental risk, monitored continuously against defined thresholds under ACME's physical and environmental protection program, not checked periodically.", controls: ["PES-07", "PES-08", "PES-01", "PES-09", "PES-12"] },
      { title: "Review access lists quarterly", detail: "Access lists for restricted areas are reviewed quarterly by the area owner against the physical access monitoring log, the same cadence as a standard access recertification; anyone who no longer needs access is removed within 5 business days of the review.", controls: ["PES-05"] },
      { title: "Extend physical security to remote work locations", detail: "A remote employee's home office is expected to meet baseline physical security: Restricted-tier printouts and devices are stored where household members or visitors can't access them, and a work laptop isn't left logged in and unattended in a shared space.", controls: ["PES-11"] },
      { title: "Shield sensitive facilities from signal emanation", detail: "Facilities processing highly sensitive data (data centers, executive briefing areas) are assessed for electromagnetic signal leakage — including electromagnetic pulse exposure — that could expose information outside the physical boundary, and shielded where the risk warrants it.", controls: ["PES-13", "PES-15"] },
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
    purpose: "How security expectations get built into the employment lifecycle from role definition through offboarding, and how ACME keeps the whole company able to spot common threats.",
    steps: [
      { title: "Categorize the position before you post the req", detail: "A role's required data/system access level is decided before recruiting starts, and that categorization is what determines the screening depth required in the next step — screening isn't a flat checklist applied the same way to every hire.", controls: ["HRS-02"] },
      { title: "Screen before day one", detail: "New hires and contractors complete role-appropriate background screening before starting, matched to the position's categorization, especially for roles with sensitive access.", controls: ["HRS-04"] },
      { title: "Put security expectations in writing", detail: "Offer and onboarding paperwork include acknowledgment of ACME's security and acceptable use policies.", controls: ["HRS-05"] },
      { title: "Separate sensitive duties by design", detail: "Financial transactions and production changes require two different people by design, not by trust.", controls: ["HRS-11"] },
      { title: "Reassess access on role change", detail: "A transfer or promotion triggers an access review; old access doesn't carry forward by default.", controls: ["HRS-08"] },
      { title: "Coordinate offboarding same-day", detail: "HR's termination event in Workday triggers access revocation the same business day, under the same HR security program that governs the rest of the employment lifecycle.", controls: ["HRS-01"] },
      { title: "Apply consistent sanctions for policy violations", detail: "A confirmed violation of security policy goes through a defined, documented progressive-discipline process — the consequence for the same violation doesn't depend on who's managing the employee." , controls: ["HRS-07"]},
      { title: "Extend screening and terms to contractors", detail: "Contractors and third-party personnel working under ACME's badge or systems get the same screening and written acknowledgment requirements as employees — a staffing-agency hire isn't exempt because they're not on ACME's own payroll.", controls: ["HRS-10"] },
      { title: "Track critical security skills and close gaps", detail: "Security & Compliance maintains a skills inventory for specialized roles (incident response, cloud security) and reviews it annually against actual staffing, so a critical-skills gap is a tracked item, not a surprise during an incident.", controls: ["HRS-13"] },
      { title: "Train everyone annually, and track it", detail: "All employees complete security awareness training at hire and annually thereafter through KnowBe4, building the security-minded workforce the program depends on, with completion tracked, not assumed.", controls: ["SAT-01", "SAT-02"] },
      { title: "Run phishing simulations as practice", detail: "Simulated phishing emails give employees a chance to practice spotting real ones; results are logged to each employee's training record, and repeat misses get targeted coaching, not just a note in a file.", controls: ["SAT-04"] },
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
    reviewCadence: "Critical vendors reassessed annually; cadence otherwise set by risk tier",
    evidenceType: "Auditor examination",
    purpose: "How a vendor actually gets vetted before it touches ACME or customer data, and how that relationship gets managed on a defined cadence and a defined tiering formula — not just reviewed once at signing and trusted indefinitely after.",
    steps: [
      { title: "Assess before signing, not after", detail: "A new vendor handling ACME or customer data is security-reviewed and risk-rated before the contract is signed.", controls: ["TPM-04"] },
      { title: "Score criticality with a defined formula", detail: "Tier score = Processes Restricted/PHI data (+3) + production system integration (+2) + critical operational dependency (+2) + privileged access to ACME systems (+2) + subprocessor handling Restricted data (+1). Score 8–10: Critical. 5–7: High. 3–4: Standard. 0–2: Low. Two reviewers scoring the same vendor should land on the same tier — that's the point of scoring it, not rating it by feel.", controls: ["TPM-02"] },
      { title: "Reassess on a cadence set by tier", detail: "Critical: annually. High: annually. Standard: every 2 years. Low: at onboarding and on material change only. A vendor's tier is re-scored at every reassessment, not assumed to hold from the prior review.", controls: ["TPM-08"] },
      { title: "Collect real evidence, not a questionnaire alone", detail: "Reviews combine a standard questionnaire (SIG Lite/CAIQ) with evidence review — a SOC 2 report, an ISO 27001 certificate — under the same third-party management program that governs every vendor relationship, regardless of tier.", controls: ["TPM-01"] },
      { title: "Assess the integration separately from the vendor", detail: "A vendor's SOC 2 report or ISO 27001 certificate establishes that the vendor runs a reasonable security program — it does not establish that a specific OAuth or API integration with that vendor is configured securely. Before an integration goes live, Security separately reviews: what scopes the integration token is granted, where the token is stored, how long it lives, what data and tenants it can reach, whether it can write or delete (not just read), whether access can be revoked immediately, and whether its behavior is monitored. A vendor with strong assurance and a poorly scoped integration is still a real exposure." },
      { title: "Put security terms in the contract", detail: "Data processing agreements, breach notification timelines, and right-to-audit clauses are standard terms for vendors handling Confidential/Restricted data.", controls: ["TPM-05"] },
      { title: "Scope and review vendor access", detail: "Vendor personnel are screened to the same personnel-security standard as ACME contractors under SOP-14 and get minimum necessary access, reviewed on the same cadence as employee access under SOP-04." , controls: ["TPM-01", "TPM-06"]},
      { title: "Monitor for vendor-side data exposure continuously", detail: "Critical and High-tier vendors are monitored on an ongoing basis for signs of a data exposure or breach involving ACME data, and any deficiency found is tracked to remediation — not just checked at the next scheduled reassessment.", controls: ["TPM-07", "TPM-09"] },
      { title: "Treat a material change as an off-cycle trigger", detail: "A vendor acquisition, a subprocessor change, or a scope-of-service change triggers an off-cycle reassessment immediately, rather than waiting for the next annual or biennial cycle.", controls: ["TPM-10"] },
      { title: "Confirm the vendor can actually respond to an incident", detail: "The contract requires the vendor to notify ACME within a defined window (72 hours) of a confirmed incident affecting ACME data, and a Critical vendor's own incident response and recovery capability is evaluated as part of onboarding, not assumed.", controls: ["TPM-11"] },
      { title: "Consider the vendor's own supply chain", detail: "A critical vendor's sub-processors and dependencies are factored into the risk assessment under ACME's supply chain risk management plan, not treated as out of scope.", controls: ["TPM-03"] },
    ],
  },
  {
    id: "ai-governance-model-risk",
    code: "SOP-16",
    title: "AI Governance & Model Risk Procedure",
    category: "Governance",
    domains: ["Artificial Intelligence & Autonomous Technologies"],
    policyId: "ai-acceptable-use",
    owner: "AI Governance Committee / Security & Compliance Team",
    reviewCadence: "Reviewed annually, or whenever a new AI system or model provider is introduced",
    evidenceType: "Document",
    purpose: "How an AI system — whether it's a third-party tool employees use or a model ACME builds into its own product — gets inventoried, reviewed, and overseen before and after it ships. This procedure owns the two controls specific to AI governance itself; the data it processes, the vendor providing the model, and the access to it are still governed by SOP-01 (classification/encryption), SOP-15 (vendor risk), and SOP-04 (access) respectively — AI doesn't get a separate copy of those controls, it inherits them.",
    steps: [
      { title: "Inventory every AI system before it's relied on", detail: "Every AI model or agent ACME builds or deploys — and every third-party AI tool approved for employee use — is tracked with an owner, purpose, and lifecycle status from development or approval through decommissioning. An AI system with no inventory entry isn't an approved AI system.", controls: ["AAT-01"] },
      { title: "Approve the use case before build, not after ship", detail: "A new AI feature or workflow goes through the same security and governance gate as any other new initiative (SOP-05), plus a specific check: what data will it see, what classification tier is that data, and is this a use case ACME has actually approved." },
      { title: "Review the model or provider like any other vendor", detail: "A third-party model provider goes through SOP-15's vendor risk process, with AI-specific questions added: does the provider train on ACME's data by default, what's their own security posture, and is there a model card or equivalent documentation of the model's known limitations." },
      { title: "Track training and retrieval data provenance", detail: "Data used to fine-tune, embed, or retrieve into an AI system's context is traced back to its classification tier under SOP-01 — Restricted data doesn't go into a model's training set or a retrieval index without an approved, documented exception." },
      { title: "Require human oversight for consequential decisions", detail: "An AI system that materially affects a customer or employee outcome (approval/denial, pricing, access) has a human in the loop before that outcome takes effect — the model recommends, a person decides." },
      { title: "Convene a diverse review board for high-impact systems", detail: "Before a high-impact AI system launches, its review includes stakeholders beyond the engineering team building it — Legal, Privacy, and the affected business unit — specifically to catch fairness, reliability, and safety issues a single team's perspective would miss, through a consistent, repeatable engagement process rather than an ad hoc invite list.", controls: ["AAT-13", "AAT-11"] },
      { title: "Enforce authorization outside the model, never inside a prompt", detail: "For any AI system with retrieval or tool access, tenant, customer, and data-scoping permission checks are enforced by the surrounding application or tool layer — a pre-scoped retrieval index, a tool call already limited to the caller's authorized data — before the model ever sees the request. An instruction in a system prompt telling the model what it may or may not access is not a security boundary; it's a suggestion the model can be talked out of." },
      { title: "Scope agent permissions to the task, not the operator", detail: "An AI agent or autonomous workflow is granted only the tool permissions and data access its current task requires, not the full permission set of the account or system it runs under. Its own instructions or prompt history are never relied on as the mechanism that keeps it inside those bounds — access is enforced the same way it would be for a human or service account performing the same action." },
      { title: "Test for prompt injection and adversarial misuse before go-live", detail: "Any AI system that accepts user-supplied input to a model is tested for prompt injection and jailbreak attempts as part of its pre-launch security review, the same way a web app gets tested for injection under SOP-10." },
      { title: "Monitor production AI systems and handle incidents like any other", detail: "A deployed AI system's behavior is monitored on an ongoing basis (SOP-03), and an AI-specific incident — a jailbreak, a data leak through a prompt, a materially wrong high-stakes output — is reported and handled through SOP-12, not treated as a special case outside the normal incident process." },
    ],
  },
];

// controlIds derived from the real crosswalk, not hand-typed — see file
// header. Two SOPs asserting the same control would be a partition bug, so
// that's checked here too, right alongside the "every category covered"
// check that already existed.
export const PROCEDURES = PROCEDURE_DEFS.map((p) => {
  const controlIds = CCF_VISIBLE_CONTROLS.filter((c) => p.domains.includes(c.domain)).map((c) => c.id);
  const controlIdSet = new Set(controlIds);
  const citedIds = new Set();

  p.steps.forEach((s) => {
    (s.controls || []).forEach((id) => {
      if (!controlIdSet.has(id)) {
        throw new Error(`procedures.js: ${p.code} step "${s.title}" cites control ${id}, which isn't one of ${p.code}'s own derived controlIds — check the id or the step's SOP assignment.`);
      }
      citedIds.add(id);
    });
  });

  return {
    ...p,
    controlIds,
    // Controls this SOP owns at the domain level but that no individual step
    // calls out yet — not a compliance gap (the procedure still covers the
    // domain), just less granular than the steps that do have a citation.
    uncitedControlIds: controlIds.filter((id) => !citedIds.has(id)),
  };
});

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
