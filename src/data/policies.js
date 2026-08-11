// ACME's policy library. Each policy is deliberately written for a non-technical
// employee audience (purpose + plain-language "statements" up top) with the
// technical detail ("standards") and formal control mapping pushed to the bottom,
// where IT/Security/Audit readers look for it. Control mapping is intentionally
// data, not prose: `controlIds` references real SCF control IDs from
// scfControls.json, and ISO 27001 (or any other framework) clause citations are
// derived from that crosswalk at render time via getFrameworkClauses() below —
// never hand-typed — so a policy's "maps to ISO 27001 X.X" claim can't drift from
// the source data it's actually asserting.
import scf from "./scfControls.json";

const CONTROL_BY_ID = Object.fromEntries(scf.controls.map((c) => [c.id, c]));

export function getPolicyControls(controlIds) {
  return controlIds.map((id) => CONTROL_BY_ID[id]).filter(Boolean);
}

// Unique, sorted clause citations for one framework across every control a policy maps to.
export function getFrameworkClauses(controlIds, standard) {
  const set = new Set();
  getPolicyControls(controlIds).forEach((c) => (c.frameworks[standard] || []).forEach((clause) => set.add(clause)));
  return [...set].sort();
}

// "Core" policies are the ones day-to-day employee behavior actually drives risk on
// (how you log in, handle data, use AI tools, and report trouble) — small on purpose,
// so pinning them as required reading doesn't just recreate the same wall of text
// employees already skim past. Everything else is "Extended": still real policy,
// but scoped to a role or function rather than asked of the whole company.
export const POLICY_TIERS = { CORE: "Core", EXTENDED: "Extended" };

export const POLICY_CATEGORIES = [
  "Governance",
  "People",
  "Access & Identity",
  "Data",
  "Devices & Assets",
  "Network & Cloud",
  "Engineering & Change",
  "Third Parties",
  "Resilience & Response",
  "Physical",
  "Emerging Tech",
];

export const POLICIES = [
  {
    id: "infosec-governance",
    code: "POL-01",
    title: "Information Security Governance & Risk Policy",
    category: "Governance",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Security, Compliance & Resilience Governance", "Risk Management", "Compliance", "Information Assurance", "Project & Resource Management"],
    controlIds: [
      "GOV-01","GOV-02","GOV-03","GOV-04","GOV-05","GOV-06","GOV-07","GOV-08","GOV-09","GOV-10","GOV-14","GOV-15","GOV-16","GOV-17",
      "RSK-01","RSK-02","RSK-03","RSK-04","RSK-05","RSK-06","RSK-07","RSK-08","RSK-09","RSK-10",
      "CPL-01","CPL-02","CPL-03","CPL-04","CPL-12",
      "IAO-01","IAO-02","IAO-03","IAO-04","IAO-05","IAO-06","IAO-07",
      "PRM-01","PRM-02","PRM-03","PRM-04","PRM-05","PRM-06","PRM-07",
    ],
    purpose: "This is ACME's master information security policy. It states that leadership is accountable for protecting company and customer information, and it defines how we identify, prioritize, and manage risk across the business.",
    scope: "All employees, contractors, and business units. Every other policy in this library operates underneath this one.",
    statements: [
      { title: "Security is a leadership responsibility", detail: "ACME's executive team sponsors and funds a formal security, compliance, and resilience program, with a named executive owner and a budget reviewed at least annually." },
      { title: "Policies are reviewed, not just written", detail: "Every ACME policy is reviewed at least once a year, or sooner if our business, systems, or the law change in a way that affects it." },
      { title: "We manage risk on purpose", detail: "ACME keeps a live risk register. New risks are identified, scored for likelihood and impact, assigned an owner, and tracked to remediation or formal acceptance — nothing is just left unaddressed silently." },
      { title: "Compliance obligations are tracked centrally", detail: "Legal, regulatory, and contractual security commitments (customer contracts, ISO 27001, SOC 2, and applicable privacy law) are inventoried and mapped to the controls that satisfy them." },
      { title: "We get independently checked", detail: "ACME undergoes internal and external audits/assessments on a recurring basis, and tracks any findings to closure." },
      { title: "Everyone plays a role", detail: "Security responsibilities are assigned by role, not left ambiguous — if you own a system, a vendor, or a team, you own the security expectations that come with it." },
    ],
    standards: [
      { title: "Program structure", detail: "The Security, Compliance & Resilience Program (SCRP) is documented, has defined objectives, and is measured against a target maturity level reviewed annually by leadership." },
      { title: "Risk register", detail: "Risks are logged with a likelihood/impact score, an owner, a treatment decision (mitigate, transfer, avoid, accept), and a target date, and are reassessed at least annually or after a significant change." },
      { title: "Statement of Applicability", detail: "ACME maintains an ISO 27001-style Statement of Applicability (SOA) documenting which controls are in place, which are not applicable, and why." },
      { title: "New projects get a security review", detail: "Security requirements are defined during project planning, not bolted on afterward — Project & Resource Management (PRM) processes require a security sign-off before major initiatives launch." },
      { title: "Regulatory contacts", detail: "ACME maintains current points of contact with relevant regulators, law enforcement, and industry security groups for coordination during incidents or audits." },
    ],
    roles: [
      { role: "Executive Leadership", responsibility: "Sponsors and resources the security program; accepts residual risk above defined thresholds" },
      { role: "Security & Compliance Team", responsibility: "Maintains the risk register, policy library, and audit evidence; reports program status to leadership" },
      { role: "Department/System Owners", responsibility: "Own the risks and controls within their area; escalate new risks promptly" },
      { role: "All Employees", responsibility: "Follow published policies and report concerns to the Security & Compliance Team" },
    ],
    relatedPolicyIds: ["third-party-risk", "incident-response", "security-awareness"],
  },

  {
    id: "acceptable-use-asset",
    code: "POL-02",
    title: "Acceptable Use & Asset Management Policy",
    category: "Devices & Assets",
    tier: POLICY_TIERS.CORE,
    domains: ["Asset Management", "Endpoint Security"],
    controlIds: [
      "AST-01","AST-02","AST-03","AST-04","AST-05","AST-06","AST-07","AST-08","AST-09","AST-10","AST-11","AST-12","AST-15",
      "END-01","END-02","END-03","END-04","END-05","END-06","END-07","END-08","END-09","END-16",
    ],
    purpose: "This policy explains how to use ACME laptops, phones, accounts, and software responsibly, and how we keep track of and protect the equipment we issue you.",
    scope: "All employees and contractors issued ACME technology, and any personal device approved to access ACME data.",
    statements: [
      { title: "Company equipment is for company work", detail: "ACME-issued laptops and accounts are for business use. Reasonable personal use is fine, but don't use them for anything illegal, offensive, or that puts ACME data at risk." },
      { title: "Only approved software gets installed", detail: "Every laptop ships with required security software (endpoint protection, disk encryption, and the Intune management agent) that you may not disable or uninstall. Installing unapproved software requires IT approval." },
      { title: "Every device is enrolled and tracked", detail: "All company laptops and phones are enrolled in Microsoft Intune and tracked in ACME's asset inventory from the day they're issued to the day they're retired." },
      { title: "Lock it, don't lose it", detail: "Never leave a device unattended and unlocked in a public place. Report a lost or stolen device to IT Security immediately — within the hour if possible — so we can remotely lock or wipe it." },
      { title: "Personal devices need approval first", detail: "Personal phones or laptops may only access ACME email or data after enrolling in Intune under the BYOD Policy. Unmanaged personal devices are not permitted to connect." },
      { title: "Return it when you leave", detail: "All ACME equipment is returned on your last day. IT Security wipes and reissues devices between employees — never pass a device to a coworker directly." },
    ],
    standards: [
      { title: "Asset inventory", detail: "All technology assets, applications, and data stores are tracked in ACME's asset system of record with an assigned business owner; assets are classified by criticality." },
      { title: "Endpoint protection baseline", detail: "Every managed endpoint runs Microsoft Defender for Endpoint (anti-malware, host firewall, and endpoint detection & response) plus full-disk encryption, enforced and monitored through Intune compliance policies." },
      { title: "Least-privilege on devices", detail: "Standard users do not have local administrator rights; software installation requires elevation through IT-approved channels." },
      { title: "Secure disposal", detail: "Retired hardware is wiped to NIST 800-88 standards or physically destroyed by a certified vendor before leaving ACME custody; disposal is logged against the asset record." },
      { title: "Kiosk/shared devices", detail: "Any shared or public-facing device (conference room displays, reception kiosks) is locked to a restricted function and cannot reach internal systems." },
    ],
    roles: [
      { role: "All Employees", responsibility: "Use equipment responsibly, keep it physically secure, report loss/theft immediately" },
      { role: "IT Security", responsibility: "Maintains the asset inventory, endpoint protection baseline, and Intune enrollment" },
      { role: "Managers", responsibility: "Confirm equipment return during offboarding" },
    ],
    relatedPolicyIds: ["mobile-byod", "access-control", "data-classification"],
  },

  {
    id: "access-control",
    code: "POL-03",
    title: "Access Control Policy",
    category: "Access & Identity",
    tier: POLICY_TIERS.CORE,
    domains: ["Identification & Authentication"],
    controlIds: [
      "IAC-01","IAC-02","IAC-03","IAC-04","IAC-05","IAC-06","IAC-07","IAC-08","IAC-09","IAC-10","IAC-12","IAC-13","IAC-14",
      "IAC-15","IAC-16","IAC-17","IAC-18","IAC-19","IAC-20","IAC-21","IAC-22","IAC-24","IAC-25","IAC-28",
    ],
    purpose: "Your login is the front door to ACME's systems. This policy explains what we expect from you, and what we do automatically to keep accounts safe.",
    scope: "All employees, contractors, and system/service accounts accessing ACME systems.",
    statements: [
      { title: "One account, one person", detail: "Never share your username, password, or MFA device with anyone — including coworkers or IT. If someone needs access, they request their own account." },
      { title: "MFA is mandatory", detail: "Multi-factor authentication is required on every ACME system, enforced through Microsoft Entra ID and Okta. If you're prompted for MFA on a login you didn't start, deny it and report it to IT Security immediately." },
      { title: "Access follows your job, not the other way around", detail: "You get access to what your role requires — nothing more. Access is assigned by role and requested through the IT service desk with manager approval." },
      { title: "Access changes with your job", detail: "Moving teams or roles removes your old access automatically. Leaving ACME disables your access the same day, coordinated between HR and IT." },
      { title: "Admin accounts are watched more closely", detail: "Privileged/admin accounts are separate from everyday accounts and are reviewed every quarter by IT Security — even for IT staff." },
      { title: "Lock your screen", detail: "Lock your screen whenever you step away. Managed devices also auto-lock after a short idle period, and sessions expire automatically." },
      { title: "Remote and personal-device access is checked first", detail: "Remote access routes through Zscaler and requires the device to pass an Intune compliance check (screen lock, encryption, current OS) before reaching ACME data." },
    ],
    standards: [
      { title: "Identity architecture", detail: "Identity is centralized in Microsoft Entra ID (directory, conditional access, MFA); application single sign-on is brokered through Okta. Applications may not maintain a separate password store without a documented exception." },
      { title: "Provisioning SLA", detail: "New accounts are provisioned within 1 business day of an approved request; access removal on termination is same-day, triggered by the HR/Workday offboarding event." },
      { title: "Access recertification", detail: "Privileged accounts are recertified quarterly; standard accounts semi-annually, by the relevant system or data owner." },
      { title: "Authenticator standard", detail: "Microsoft Authenticator or a platform passkey is the preferred MFA method; SMS is a fallback only, not a default." },
      { title: "Session controls", detail: "Idle session timeout is 15 minutes on managed endpoints; concurrent session limits apply to privileged accounts; sessions terminate on logout or timeout without leaving residual access." },
    ],
    roles: [
      { role: "Employees", responsibility: "Protect credentials, use MFA, report suspicious login prompts" },
      { role: "Managers", responsibility: "Approve or deny access requests for their team; flag role changes promptly" },
      { role: "IT Security", responsibility: "Provisions/de-provisions accounts, runs access reviews, administers Entra ID/Okta" },
      { role: "HR", responsibility: "Notifies IT of hires, transfers, and terminations the same day they occur" },
    ],
    relatedPolicyIds: ["acceptable-use-asset", "data-classification", "hr-security"],
  },

  {
    id: "data-classification",
    code: "POL-04",
    title: "Data Classification & Handling Policy",
    category: "Data",
    tier: POLICY_TIERS.CORE,
    domains: ["Data Classification & Handling", "Cryptographic Protections"],
    controlIds: [
      "DCH-01","DCH-02","DCH-03","DCH-04","DCH-06","DCH-07","DCH-08","DCH-09","DCH-10","DCH-11","DCH-12","DCH-13","DCH-14",
      "DCH-15","DCH-17","DCH-18","DCH-19","DCH-21","DCH-22","DCH-23","DCH-24",
      "CRY-01","CRY-02","CRY-03","CRY-04","CRY-05","CRY-06","CRY-07","CRY-08","CRY-09",
    ],
    purpose: "Not all data is equally sensitive, and misjudging that is one of the most common ways a real incident starts. This policy defines ACME's four sensitivity labels, gives concrete examples of each, and sets the security bar a system must clear before it's allowed to hold data at a given label.",
    scope: "All ACME data, wherever it lives — email, chat, file shares, SaaS apps, laptops, and paper — and every system that stores, processes, or transmits it.",
    // Rendered as its own prominent, color-coded block in the UI (PolicyCenter.jsx
    // reads this field specifically) — this is the policy the Data Classification
    // Register enforces, so `level` must stay in sync with CLASS_ORDER/CLASS_META in
    // theme.js, and the two system-requirement tiers below intentionally name the
    // same six controls (Encryption at Rest, Encryption in Transit, Access Logging &
    // Review, Least-Privilege Access, DLP Monitoring, Retention & Disposal) that
    // DataClassificationGapMatrix.jsx actually tracks per system, so the policy and
    // the register can never quietly drift apart.
    classificationLevels: [
      {
        level: "Public",
        definition: "Meant for anyone to see. No harm to ACME, customers, or employees if it's disclosed.",
        examples: ["Marketing website content", "Published press releases", "Job postings", "Public product documentation"],
        systemRequirements: ["Standard endpoint and account security only — no special encryption or access mandate", "Integrity still matters: publishing changes go through normal change control so content can't be tampered with"],
      },
      {
        level: "Internal",
        definition: "Routine business information. Not for the public, but low harm if it leaked out.",
        examples: ["Internal wiki pages and how-to docs", "Team meeting notes", "Org charts", "Non-sensitive Teams/Slack messages"],
        systemRequirements: ["Access limited to authenticated ACME accounts (Entra ID) — no anonymous or public sharing links", "Standard backup and endpoint protection; no dedicated encryption or DLP requirement beyond the platform default"],
      },
      {
        level: "Confidential",
        definition: "Would cause real competitive or operational harm to ACME if disclosed. This is the default label when you're not sure.",
        examples: ["Employee data in the HR Information System (Workday)", "Financial forecasts and board materials", "Source code", "Customer contracts", "Marketing analytics containing personal data"],
        systemRequirements: [
          "Encryption at rest and in transit (TLS 1.2+)",
          "Access logging & review",
          "Least-privilege, role-based access reviewed periodically",
          "DLP monitoring on egress channels (email, file sharing)",
          "A defined retention & disposal schedule",
          "Tracked in the Data Classification Register and evaluated against these six controls",
        ],
      },
      {
        level: "Restricted",
        definition: "Regulated or highly sensitive data. Severe legal, financial, or reputational harm if disclosed.",
        examples: ["Customer PII/financial data (e.g., the Customer Data Warehouse)", "Customer PII/PHI (e.g., the Support Ticketing Platform)", "Cardholder-adjacent financial data (e.g., legacy billing systems)", "Authentication credentials and cryptographic keys"],
        systemRequirements: [
          "Same six controls as Confidential, held to the strictest evidenced standard — e.g., AES-256 (not AES-128) at rest, TLS 1.2+ enforced on every segment including internal connections, quarterly access review, active (not just planned) DLP",
          "MFA/Okta enforcement required on every access path, no exceptions",
          "Continuously monitored in the Data Classification Register, not just periodically reviewed",
        ],
      },
    ],
    statements: [
      { title: "Every piece of data has a sensitivity level", detail: "ACME uses four labels — Public, Internal, Confidential, Restricted — defined with examples below. When in doubt, treat data as Confidential until told otherwise." },
      { title: "Label it so others know", detail: "Apply the Microsoft Purview sensitivity label in Outlook/Office when you create or send a document containing Confidential or Restricted data." },
      { title: "Match the sharing method to the label", detail: "Public and Internal data can move freely inside ACME. Confidential and Restricted data may only be shared with people who need it, using approved tools — never personal email, personal cloud storage, or messaging apps." },
      { title: "Encrypt sensitive data, always", detail: "Confidential and Restricted data must be encrypted both when stored and when sent — this happens automatically on approved ACME systems, which is exactly why using unapproved ones is off-limits." },
      { title: "A new system's classification decides what it must prove", detail: "Before a new system can hold Confidential or Restricted data, it has to meet the six controls in the classification table below and get added to the Data Classification Register — this isn't optional paperwork, it's the gate." },
      { title: "Dispose of it properly", detail: "Shred physical documents containing Confidential/Restricted data; delete electronic copies through IT-approved tools rather than just moving them to a personal folder." },
      { title: "Know where regulated data can live", detail: "Some data (e.g., customer personal data subject to contractual residency terms) can only be stored in approved regions/systems — check with Security before standing up a new storage location." },
    ],
    standards: [
      { title: "System security baseline by tier", detail: "Public/Internal systems get standard baseline controls. Confidential/Restricted systems must evidence all six register controls: Encryption at Rest, Encryption in Transit, Access Logging & Review, Least-Privilege Access, DLP Monitoring, and Retention & Disposal." },
      { title: "Encryption strength", detail: "Confidential data: AES-256 (or equivalent) at rest, TLS 1.2+ in transit. Restricted data is held to the same floor with zero tolerance for weaker legacy algorithms (e.g., AES-128) or unencrypted internal segments." },
      { title: "Key management", detail: "Encryption keys and certificates are managed centrally in Azure Key Vault; public certificates are issued through DigiCert. Individual employees do not generate or hold production encryption keys." },
      { title: "Evidence & monitoring", detail: "Control status for Confidential/Restricted systems is evidenced through Vanta automated tests where available, private integrations, or manual verification, and tracked live in the Data Classification Register rather than attested to once a year." },
      { title: "Media handling & retention", detail: "Removable media containing Confidential/Restricted data is discouraged and, where used, must be encrypted; retention periods follow the data retention schedule maintained by Legal and Security." },
    ],
    roles: [
      { role: "Data/Content Owners", responsibility: "Assign the correct classification and approve access requests for their data" },
      { role: "System Owners", responsibility: "Ensure their system meets the security requirements for the data it hosts before onboarding to that tier, and keep it current in the Data Classification Register" },
      { role: "All Employees", responsibility: "Label and handle data according to its classification" },
      { role: "IT Security", responsibility: "Operates Purview labeling, DLP, and encryption/key management infrastructure; maintains the Data Classification Register" },
    ],
    relatedPolicyIds: ["data-privacy", "network-remote-access", "third-party-risk"],
  },

  {
    id: "data-privacy",
    code: "POL-05",
    title: "Data Privacy Policy",
    category: "Data",
    tier: POLICY_TIERS.CORE,
    domains: ["Data Privacy"],
    controlIds: ["PRI-01","PRI-02","PRI-03","PRI-04","PRI-05","PRI-06","PRI-07","PRI-08","PRI-10","PRI-12","PRI-14","PRI-17","PRI-18"],
    purpose: "ACME collects personal data from employees, customers, and job applicants. This policy explains the principles we follow to handle that data responsibly and lawfully.",
    scope: "Any personal data ACME collects, processes, or stores about employees, customers, or other individuals, in any country we operate in.",
    statements: [
      { title: "Collect only what you need", detail: "Only collect personal data for a clear, stated business purpose — never 'just in case' it's useful later." },
      { title: "Tell people what you're doing with their data", detail: "ACME publishes privacy notices explaining what personal data we collect and why; don't collect personal data through a channel that isn't covered by a notice without checking with Legal/Privacy first." },
      { title: "Respect people's choices", detail: "Where consent or opt-out is required (e.g., marketing communications), honor it, and honor requests to access, correct, or delete personal data within the legally required timeframe." },
      { title: "Don't keep data forever", detail: "Personal data is deleted or anonymized once it's no longer needed for its original purpose, per the retention schedule — not kept indefinitely by default." },
      { title: "New uses of personal data get a privacy review", detail: "Before using personal data for a new purpose, a new vendor, or a new AI tool, complete a Data Protection Impact Assessment (DPIA) with the Privacy team." },
      { title: "Sharing with vendors requires a contract", detail: "Personal data is only shared with third parties under a signed data processing agreement covering how they'll protect it." },
    ],
    standards: [
      { title: "Legal basis & purpose limitation", detail: "Each personal data processing activity is documented with its purpose and legal basis in ACME's Record of Processing Activities (RoPA)." },
      { title: "Data subject rights", detail: "Access, correction, deletion, and portability requests are routed to the Privacy team and fulfilled within the applicable statutory window (e.g., 30 days under most regimes)." },
      { title: "DPIA threshold", detail: "A DPIA is mandatory for new processing that involves large-scale personal data, sensitive categories of data, or new technology (including AI/ML) with privacy impact." },
      { title: "Cross-border transfers", detail: "Transfers of personal data across borders use an approved transfer mechanism (e.g., Standard Contractual Clauses) reviewed by Legal." },
    ],
    roles: [
      { role: "Privacy Team / DPO function", responsibility: "Owns the privacy program, RoPA, DPIAs, and data subject request fulfillment" },
      { role: "All Employees", responsibility: "Collect and handle personal data only per documented purpose; escalate new uses for review" },
      { role: "Legal", responsibility: "Reviews cross-border transfer mechanisms and vendor data processing agreements" },
    ],
    relatedPolicyIds: ["data-classification", "third-party-risk", "incident-response"],
  },

  {
    id: "mobile-byod",
    code: "POL-06",
    title: "Mobile Device & BYOD Policy",
    category: "Devices & Assets",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Mobile Device Management"],
    controlIds: ["MDM-01","MDM-02","MDM-03","MDM-05"],
    purpose: "Whether you're using an ACME-issued phone or your own, this policy covers what's required before that device can touch ACME email, chat, or files.",
    scope: "All mobile devices — company-issued or personal — used to access ACME email, apps, or data.",
    statements: [
      { title: "Enroll before you connect", detail: "Every device accessing ACME email or apps — company or personal — must be enrolled in Microsoft Intune first. Unmanaged devices are blocked automatically." },
      { title: "Keep basic security settings on", detail: "A screen lock (PIN, password, or biometric) and current OS updates are required. Intune checks for this automatically and will block access if a device falls out of compliance." },
      { title: "ACME can wipe just the work part", detail: "On a personal device, Intune only manages and can remotely wipe ACME's app data (email, files) — not your personal photos or apps. On a lost or stolen ACME-owned device, the whole device may be wiped." },
      { title: "Report it fast", detail: "A lost or stolen phone that has ACME data or app access must be reported to IT Security immediately so it can be remotely locked or wiped." },
      { title: "Jailbroken/rooted devices are never allowed", detail: "A modified or jailbroken device cannot enroll or connect, personal or company-owned — Intune blocks it by design." },
    ],
    standards: [
      { title: "MDM platform", detail: "Microsoft Intune is the single mobile device management platform for both company-owned and BYOD devices, enforcing compliance policy, conditional access, and app protection policies." },
      { title: "Container encryption", detail: "ACME managed apps use app-level containerization and encryption on BYOD devices so ACME data is cryptographically separated from personal data." },
      { title: "Remote purge", detail: "Selective wipe (ACME data only) is used for BYOD; full device wipe is reserved for company-owned devices." },
    ],
    roles: [
      { role: "Employees", responsibility: "Enroll devices, keep them updated, report loss/theft immediately" },
      { role: "IT Security", responsibility: "Administers Intune compliance and app protection policies, executes remote wipes" },
    ],
    relatedPolicyIds: ["acceptable-use-asset", "access-control"],
  },

  {
    id: "network-remote-access",
    code: "POL-07",
    title: "Network & Remote Access Policy",
    category: "Network & Cloud",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Network Security"],
    controlIds: ["NET-01","NET-02","NET-03","NET-04","NET-05","NET-06","NET-07","NET-08","NET-09","NET-12","NET-13","NET-14","NET-15","NET-17","NET-18"],
    purpose: "This policy covers how ACME protects its network and how you connect securely from the office, home, or on the road.",
    scope: "All connections to ACME's network and internal systems, from any location.",
    statements: [
      { title: "There is no separate 'VPN'", detail: "ACME uses Zscaler for secure remote access — it checks who you are and whether your device is compliant before connecting you to anything, whether you're at home, a coffee shop, or the office." },
      { title: "Public Wi-Fi is fine, with Zscaler on", detail: "You may work from public Wi-Fi as long as Zscaler is active on your device; never disable it to 'get around' a slow or blocked connection — ask IT instead." },
      { title: "Sensitive systems are segmented", detail: "Production systems, corporate IT, and guest networks are kept separate so a problem in one doesn't automatically expose the others." },
      { title: "Use approved messaging for business, not personal apps", detail: "Business communications and file transfer go through ACME-approved tools (email, Teams) — not personal messaging apps — so they stay logged, secured, and DLP-protected." },
      { title: "Guest Wi-Fi is isolated", detail: "Visitors connect to a guest network with no access to internal ACME systems." },
    ],
    standards: [
      { title: "Zero Trust remote access", detail: "Zscaler Private Access/Internet Access enforces identity- and device-posture-based access to internal apps and the internet, replacing a traditional flat VPN." },
      { title: "Network segmentation", detail: "Production, corporate, and guest networks are segmented with access control lists restricting cross-segment traffic to documented business need." },
      { title: "DNS & content filtering", detail: "Zscaler enforces DNS-layer filtering against known-malicious and inappropriate destinations for all managed devices, on or off the corporate network." },
      { title: "Data loss prevention", detail: "Microsoft Purview DLP inspects outbound email and file transfers for Confidential/Restricted data leaving approved channels." },
      { title: "Intrusion detection", detail: "Network intrusion detection/prevention is deployed at ACME's internet egress and monitored by the Security Operations function." },
    ],
    roles: [
      { role: "Employees", responsibility: "Keep Zscaler active, use approved communication tools" },
      { role: "IT Security", responsibility: "Administers Zscaler policy, network segmentation, and DLP rules" },
    ],
    relatedPolicyIds: ["cloud-security", "data-classification", "security-monitoring"],
  },

  {
    id: "cloud-security",
    code: "POL-08",
    title: "Cloud Security Policy",
    category: "Network & Cloud",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Cloud Security"],
    controlIds: ["CLD-01","CLD-02","CLD-04","CLD-06","CLD-09","CLD-11","CLD-12"],
    purpose: "ACME runs on cloud and SaaS services. This policy covers how new cloud services get approved and secured, so we don't end up with unmanaged 'shadow IT.'",
    scope: "All cloud infrastructure (primarily Microsoft Azure) and SaaS applications used to run or support ACME's business.",
    statements: [
      { title: "New SaaS tools go through approval first", detail: "Signing up for a new SaaS app to do ACME work — even a free one — requires IT/Security approval first, not after the fact. Expensing a subscription doesn't count as approval." },
      { title: "We can see what's actually in use", detail: "Microsoft Defender for Cloud Apps (our CASB) discovers and monitors SaaS usage across the company so unapproved tools get caught, not just trusted to be reported." },
      { title: "Cloud accounts follow the same access rules as everything else", detail: "Access to Azure and SaaS admin consoles follows the Access Control Policy — least privilege, MFA, and periodic review, no exceptions for 'it's just a cloud tool.'" },
      { title: "APIs are secured, not left open", detail: "Any API ACME exposes (internally or to customers) requires authentication and goes through a security review before launch." },
    ],
    standards: [
      { title: "Cloud architecture baseline", detail: "Microsoft Azure is ACME's primary cloud provider; workloads follow a documented reference architecture reviewed by Security, including network segmentation and Microsoft Defender for Cloud posture monitoring." },
      { title: "SaaS approval process", detail: "New SaaS requests are submitted through the IT service desk (ServiceNow), reviewed for data sensitivity and vendor security posture, and logged in the approved-application catalog." },
      { title: "CASB monitoring", detail: "Microsoft Defender for Cloud Apps provides shadow-IT discovery, sanctioned-app policy enforcement, and anomaly detection across SaaS usage." },
      { title: "Multi-tenant isolation", detail: "Where ACME data resides in multi-tenant cloud services, tenant isolation and data residency are verified as part of vendor due diligence." },
    ],
    roles: [
      { role: "IT Security", responsibility: "Approves new cloud/SaaS services, monitors CASB findings, maintains the Azure security baseline" },
      { role: "Employees", responsibility: "Request approval before adopting a new cloud tool for ACME work" },
    ],
    relatedPolicyIds: ["third-party-risk", "network-remote-access", "change-configuration"],
  },

  {
    id: "change-configuration",
    code: "POL-09",
    title: "Change & Configuration Management Policy",
    category: "Engineering & Change",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Change Management", "Configuration Management", "Maintenance"],
    controlIds: [
      "CHG-01","CHG-02","CHG-03","CHG-04","CHG-05","CHG-06",
      "CFG-01","CFG-02","CFG-03","CFG-04","CFG-05","CFG-08",
      "MNT-01","MNT-02","MNT-03","MNT-04","MNT-05",
    ],
    purpose: "This policy explains how changes to ACME's systems — from a server setting to a production deployment — get proposed, reviewed, and made safely.",
    scope: "All changes to production systems, network configuration, and business-critical applications. Applies to ACME staff and any vendor performing maintenance on ACME systems.",
    statements: [
      { title: "Changes are requested, not just made", detail: "Production changes go through a change request in ServiceNow — no making changes directly on a whim, even for something that feels small." },
      { title: "Someone else looks at it first", detail: "Changes are reviewed and approved by someone other than the person making them before they go live; higher-risk changes get a security review too." },
      { title: "New systems start from a hardened baseline", detail: "Servers and services are built from an approved, hardened configuration template — not set up from scratch each time with whatever defaults happen to ship." },
      { title: "Only necessary things run", detail: "Systems run only the software and services they actually need (least functionality) — unused services are disabled, not left on 'just in case.'" },
      { title: "Changes are tested before they're trusted", detail: "Changes are tested in a non-production environment first where practical, and we verify afterward that the change worked and that security controls still function." },
      { title: "Remote maintenance is logged", detail: "Any remote maintenance session on ACME infrastructure — including by a vendor — is authorized in advance and logged." },
    ],
    standards: [
      { title: "Change control process", detail: "All production changes require a ServiceNow change record documenting the change, rollback plan, and approver; emergency changes still require after-the-fact review within 24 hours." },
      { title: "Configuration baselines", detail: "Secure baseline configurations (CIS Benchmarks or vendor-hardened equivalents) are defined per platform and enforced via Intune (endpoints) and Azure Policy (cloud resources)." },
      { title: "Drift detection", detail: "Automated configuration monitoring flags deviations from baseline for remediation." },
      { title: "Maintenance windows", detail: "Scheduled maintenance occurs in defined windows communicated to affected stakeholders in advance." },
    ],
    roles: [
      { role: "Change Requestors", responsibility: "Submit change requests with a rollback plan before implementing" },
      { role: "Change Approvers", responsibility: "Review risk and impact before approving; require security review for high-risk changes" },
      { role: "IT/Engineering", responsibility: "Maintains configuration baselines and drift monitoring" },
    ],
    relatedPolicyIds: ["vulnerability-patch", "secure-development", "cloud-security"],
  },

  {
    id: "vulnerability-patch",
    code: "POL-10",
    title: "Vulnerability & Patch Management Policy",
    category: "Engineering & Change",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Vulnerability & Patch Management"],
    controlIds: ["VPM-01","VPM-02","VPM-03","VPM-04","VPM-05","VPM-06","VPM-07"],
    purpose: "This policy explains how ACME finds and fixes security weaknesses in its systems and software before they can be exploited.",
    scope: "All ACME-owned servers, endpoints, network devices, and applications.",
    statements: [
      { title: "Systems get scanned regularly", detail: "ACME runs regular vulnerability scans across its infrastructure and applications — this isn't a one-time check, it's ongoing." },
      { title: "Findings are ranked by real risk", detail: "Not every finding is fixed on the same timeline — vulnerabilities are ranked by severity and exploitability, and the worst ones get fixed first." },
      { title: "Patches go out on a schedule", detail: "Operating system and application patches are applied on a defined cadence, faster for critical/actively-exploited vulnerabilities." },
      { title: "Keep your device updated", detail: "Don't defer OS or app updates indefinitely on your ACME laptop — Intune pushes them automatically, and repeatedly postponing them creates real risk." },
      { title: "We test our own defenses", detail: "ACME commissions independent penetration testing at least annually and tracks findings to remediation like any other vulnerability." },
    ],
    standards: [
      { title: "Scanning cadence", detail: "Tenable performs authenticated vulnerability scans of internal and external assets on a recurring schedule; new internet-facing assets are scanned before go-live." },
      { title: "Remediation SLAs", detail: "Critical vulnerabilities: 7 days. High: 30 days. Medium: 90 days. Low: next patch cycle. SLAs are tracked and exceptions require documented risk acceptance." },
      { title: "Patch deployment", detail: "Endpoint patching is automated through Intune; server patching through Azure Update Manager, on staggered rings (test → pilot → production)." },
      { title: "Penetration testing", detail: "A qualified third party performs at least annual penetration testing against production environments; findings feed the standard vulnerability remediation process." },
    ],
    roles: [
      { role: "IT Security", responsibility: "Runs vulnerability scans, tracks remediation SLAs, coordinates penetration tests" },
      { role: "System Owners", responsibility: "Remediate vulnerabilities in their systems within SLA or document a risk acceptance" },
      { role: "Employees", responsibility: "Allow and install pushed device updates promptly" },
    ],
    relatedPolicyIds: ["change-configuration", "secure-development", "security-monitoring"],
  },

  {
    id: "secure-development",
    code: "POL-11",
    title: "Secure Software Development & Acquisition Policy",
    category: "Engineering & Change",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Secure Engineering & Architecture", "Technology Development & Acquisition", "Web Security", "Embedded Technology"],
    controlIds: [
      "SEA-01","SEA-02","SEA-03","SEA-04","SEA-07","SEA-14","SEA-17","SEA-20",
      "TDA-01","TDA-02","TDA-04","TDA-05","TDA-06","TDA-07","TDA-08","TDA-09","TDA-10","TDA-13","TDA-14","TDA-15","TDA-18","TDA-20",
      "WEB-01","WEB-02","WEB-03","WEB-06","WEB-10","WEB-13",
    ],
    purpose: "This policy covers how ACME builds software securely, and how we evaluate security before buying or building new technology, including any connected/embedded devices.",
    scope: "ACME's engineering teams, and anyone evaluating a new technology purchase or build.",
    statements: [
      { title: "Security is designed in, not bolted on", detail: "New systems are built with defense-in-depth — multiple layers of protection — rather than relying on a single control." },
      { title: "Dev, test, and production are kept apart", detail: "Development and testing happen in separate environments from production, and real customer data is not used for testing without an approved, documented exception." },
      { title: "Code is reviewed before it ships", detail: "Changes to production code go through peer review and automated security testing before release." },
      { title: "Source code access is controlled", detail: "Production source code repositories (GitHub) require authentication, and access is limited to engineers with a current business need." },
      { title: "New purchases get a security look", detail: "Before ACME buys or builds new technology — including any smart/connected device — Security evaluates it against baseline security requirements as part of procurement." },
      { title: "Input is never trusted blindly", detail: "Applications validate and sanitize user input by design to prevent common attacks like injection." },
    ],
    standards: [
      { title: "SDLC", detail: "ACME follows a documented Secure Development Life Cycle (SSDP) with security requirements defined at design time, static/dynamic testing in CI (GitHub Actions), and a security gate before production release." },
      { title: "Environment separation", detail: "Development, testing, and production run in logically separate environments with different credentials; production data is masked or synthetic when used in lower environments." },
      { title: "Web application protection", detail: "Customer-facing web applications sit behind Cloudflare's WAF and CDN, with TLS enforced and change detection monitoring for unauthorized modifications." },
      { title: "Developer access & screening", detail: "Engineers with production source code or deployment access undergo the same screening as other sensitive roles, and access is reviewed on the standard access recertification cycle." },
      { title: "Acquisition review", detail: "New technology (including embedded/IoT and third-party software) is evaluated against ACME's minimum security requirements before purchase or deployment approval." },
    ],
    roles: [
      { role: "Engineering", responsibility: "Follows the secure SDLC, environment separation, and code review requirements" },
      { role: "IT Security", responsibility: "Defines security requirements, runs security testing, reviews new technology acquisitions" },
      { role: "Procurement", responsibility: "Routes new technology purchases through security review before commitment" },
    ],
    relatedPolicyIds: ["vulnerability-patch", "change-configuration", "third-party-risk"],
  },

  {
    id: "third-party-risk",
    code: "POL-12",
    title: "Third-Party & Vendor Risk Management Policy",
    category: "Third Parties",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Third-Party Management"],
    controlIds: ["TPM-01","TPM-02","TPM-03","TPM-04","TPM-05","TPM-06","TPM-07","TPM-08","TPM-09","TPM-10","TPM-11"],
    purpose: "ACME relies on vendors and partners, and we're accountable for what happens to our data once it's in their hands. This policy explains how vendors get vetted and managed.",
    scope: "Any vendor, contractor, or partner that accesses, stores, or processes ACME or ACME customer data, or that provides a service ACME depends on.",
    statements: [
      { title: "Vendors are assessed before onboarding, not after", detail: "A new vendor handling ACME or customer data is security-reviewed and risk-rated before the contract is signed — not retroactively." },
      { title: "Riskier vendors get more scrutiny", detail: "Vendors are rated by criticality (how much data or dependency is involved); the higher the risk rating, the deeper the assessment and the more frequent the re-review." },
      { title: "Security terms go in the contract", detail: "Contracts with vendors handling Confidential/Restricted data include security and data protection requirements, not just a handshake understanding." },
      { title: "Vendor access is scoped and reviewed", detail: "Vendor personnel get the minimum access necessary, and vendor access is reviewed on the same cadence as employee access." },
      { title: "We keep checking, not just checking once", detail: "Critical vendors are reassessed periodically, and any vendor security incident affecting ACME data must be reported to us per the contract." },
    ],
    standards: [
      { title: "Assessment process", detail: "Vendor security reviews use a standard questionnaire (e.g., SIG Lite/CAIQ) plus evidence review (SOC 2 report, ISO 27001 certificate); findings and risk ratings are logged in ACME's vendor risk register." },
      { title: "Criticality tiering", detail: "Vendors are tiered (Critical / High / Standard / Low) based on data sensitivity and business dependency; tier determines assessment depth and reassessment frequency." },
      { title: "Contractual requirements", detail: "Data processing agreements, breach notification timelines, and right-to-audit clauses are standard contract terms for vendors handling Confidential/Restricted data." },
      { title: "Supply chain risk", detail: "Critical vendors' own sub-processors and supply chain dependencies are considered as part of the risk assessment." },
    ],
    roles: [
      { role: "Procurement/Business Owner", responsibility: "Initiates vendor risk review before signing; owns the vendor relationship" },
      { role: "Security & Compliance Team", responsibility: "Performs the risk assessment, assigns criticality tier, tracks reassessment schedule" },
      { role: "Legal", responsibility: "Ensures required security terms are in the contract" },
    ],
    relatedPolicyIds: ["infosec-governance", "data-privacy", "incident-response"],
  },

  {
    id: "business-continuity",
    code: "POL-13",
    title: "Business Continuity & Disaster Recovery Policy",
    category: "Resilience & Response",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Business Continuity & Disaster Recovery", "Capacity & Performance Planning"],
    controlIds: [
      "BCD-01","BCD-02","BCD-03","BCD-04","BCD-05","BCD-06","BCD-07","BCD-08","BCD-09","BCD-10","BCD-11","BCD-12","BCD-13",
      "CAP-01","CAP-02","CAP-03","CAP-04",
    ],
    purpose: "This policy explains how ACME keeps the business running through a major disruption — an outage, a natural disaster, a critical vendor failure — and how we plan capacity so we don't get caught short.",
    scope: "All business-critical systems, facilities, and processes at ACME.",
    statements: [
      { title: "We know what's critical", detail: "ACME identifies its most critical systems and processes and understands how long the business can tolerate them being down." },
      { title: "There's a plan, and it's practiced", detail: "ACME maintains a documented Business Continuity/Disaster Recovery plan and tests it at least annually — not just written and filed away." },
      { title: "Backups are real and restorable", detail: "Business-critical data is backed up on a defined schedule, and restoration is actually tested — a backup that's never been restored isn't a proven backup." },
      { title: "We plan for growth, not just failure", detail: "Capacity (compute, storage, network, and people) is planned ahead of need, so ACME doesn't run into an outage caused by simply running out of room." },
      { title: "Lessons get captured", detail: "After any disruption or test, ACME documents what worked, what didn't, and updates the plan." },
    ],
    standards: [
      { title: "Backup strategy", detail: "Veeam performs scheduled backups of business-critical systems with defined RPO/RTO targets per system tier; backups are encrypted and stored separately from production, including an offsite/immutable copy." },
      { title: "DR replication", detail: "Critical Azure workloads use Azure Site Recovery to an alternate region as the recovery site." },
      { title: "Testing cadence", detail: "Tabletop exercises occur at least annually; technical failover/restore testing occurs at least annually for Tier 1 (critical) systems." },
      { title: "Capacity monitoring", detail: "Infrastructure capacity and performance are monitored continuously (Azure Monitor) with alerting thresholds set ahead of actual resource exhaustion." },
    ],
    roles: [
      { role: "Business Continuity Owner", responsibility: "Maintains the BC/DR plan, schedules tests, tracks lessons learned" },
      { role: "System Owners", responsibility: "Define recovery objectives (RPO/RTO) for their systems" },
      { role: "IT/Engineering", responsibility: "Operates backups, DR replication, and capacity monitoring" },
    ],
    relatedPolicyIds: ["incident-response", "security-monitoring", "third-party-risk"],
  },

  {
    id: "incident-response",
    code: "POL-14",
    title: "Incident Response Policy",
    category: "Resilience & Response",
    tier: POLICY_TIERS.CORE,
    domains: ["Incident Response"],
    controlIds: ["IRO-01","IRO-02","IRO-04","IRO-05","IRO-06","IRO-07","IRO-08","IRO-09","IRO-10","IRO-11","IRO-12","IRO-13","IRO-14"],
    purpose: "If something looks wrong — a phishing email you clicked, a lost laptop, unusual account activity — this policy tells you what to do, and what ACME does behind the scenes to contain and fix it.",
    scope: "All employees and contractors, and all suspected or confirmed security incidents affecting ACME systems or data.",
    statements: [
      { title: "Report first, don't investigate alone", detail: "If you suspect a security incident — clicked a phishing link, lost a device, saw something suspicious — report it to IT Security immediately. You will not get in trouble for reporting honestly and promptly." },
      { title: "There's a dedicated team for this", detail: "ACME maintains an Integrated Security Incident Response Team (ISIRT) that leads the response to confirmed incidents." },
      { title: "Incidents are triaged by severity", detail: "Not every incident is handled the same way — ACME classifies incidents by severity and responds accordingly, with the most severe getting immediate, all-hands attention." },
      { title: "Affected parties are told what they need to know", detail: "Customers, regulators, or individuals are notified as required by law or contract if their data is affected — Legal and Privacy lead this, not individual employees." },
      { title: "Evidence is preserved properly", detail: "During an investigation, don't power off, wipe, or 'fix' a potentially compromised device yourself — IT Security needs to preserve evidence first." },
      { title: "We learn from every incident", detail: "After an incident, ACME documents root cause and lessons learned, and feeds them back into controls and training." },
    ],
    standards: [
      { title: "IR plan & classification", detail: "ACME's Incident Response Plan defines severity tiers (SEV1–SEV4), response timelines, and escalation paths, reviewed and tested at least annually." },
      { title: "Detection tooling", detail: "Microsoft Sentinel and Defender XDR provide the primary detection and alerting pipeline feeding the ISIRT." },
      { title: "Regulatory/breach notification", detail: "Legal and Privacy determine notification obligations (e.g., under applicable breach notification law or contract) and coordinate timing and content of any notification." },
      { title: "Chain of custody", detail: "Forensic evidence collection follows a documented chain-of-custody process to preserve admissibility and integrity." },
      { title: "Sensitive data spill response", detail: "Suspected exposure of regulated data (customer PII, credentials) triggers an expedited response path involving Privacy and Legal." },
    ],
    roles: [
      { role: "All Employees", responsibility: "Report suspected incidents immediately; preserve evidence, don't self-remediate" },
      { role: "ISIRT", responsibility: "Leads detection, containment, eradication, and recovery for confirmed incidents" },
      { role: "Legal & Privacy", responsibility: "Determines and executes regulatory/customer notification obligations" },
    ],
    relatedPolicyIds: ["security-monitoring", "data-privacy", "business-continuity"],
  },

  {
    id: "security-monitoring",
    code: "POL-15",
    title: "Security Monitoring & Operations Policy",
    category: "Resilience & Response",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Continuous Monitoring", "Security Operations", "Threat Management"],
    controlIds: [
      "MON-01","MON-02","MON-03","MON-05","MON-06","MON-07","MON-08","MON-10","MON-11","MON-15","MON-16",
      "OPS-01","OPS-02","OPS-03",
      "THR-01","THR-02","THR-03","THR-04","THR-06","THR-09","THR-10",
    ],
    purpose: "This policy explains how ACME watches its own environment for trouble around the clock, and how day-to-day security operations stay consistent regardless of who's on shift.",
    scope: "ACME's IT Security function and the systems that generate security-relevant logs and events.",
    statements: [
      { title: "Activity is logged and watched", detail: "Security-relevant activity across ACME's systems is logged centrally and monitored — this isn't optional per-system logging, it's a company-wide practice." },
      { title: "Logs can't be quietly altered", detail: "Security logs are protected from tampering and kept for a defined retention period so they're available for an investigation or audit." },
      { title: "Unusual behavior gets a second look", detail: "Automated tools flag anomalous behavior (odd login times/locations, unusual data access) for review by the security team." },
      { title: "We watch for external threats too", detail: "ACME consumes threat intelligence feeds to stay aware of attacker tactics relevant to our industry, and runs a public vulnerability disclosure channel so outside researchers can report issues responsibly." },
      { title: "Day-to-day operations follow documented procedures", detail: "Routine security operations tasks follow standardized, documented procedures so results are consistent no matter who performs them." },
    ],
    standards: [
      { title: "SIEM & log centralization", detail: "Microsoft Sentinel centralizes security event logs from identity (Entra ID), endpoint (Defender for Endpoint), network (Zscaler), and cloud (Azure) sources, with synchronized time stamps." },
      { title: "Log retention & protection", detail: "Security logs are retained for a minimum of 12 months, access-restricted, and write-protected against tampering." },
      { title: "Anomaly detection & alerting", detail: "Behavioral analytics (Defender XDR, Sentinel analytics rules) generate alerts triaged by the security team against defined response SLAs." },
      { title: "Threat intelligence & disclosure", detail: "External threat intelligence feeds inform detection rules and advisories; ACME publishes a vulnerability disclosure program (VDP) contact for external researchers." },
      { title: "Insider threat monitoring", detail: "Privileged and sensitive-data access is monitored for anomalous patterns consistent with insider risk, reviewed by Security with HR/Legal involvement where warranted." },
    ],
    roles: [
      { role: "IT Security / SOC function", responsibility: "Operates the SIEM, triages alerts, maintains monitoring standards and procedures" },
      { role: "System Owners", responsibility: "Ensure their systems forward logs to the central monitoring platform" },
    ],
    relatedPolicyIds: ["incident-response", "network-remote-access", "vulnerability-patch"],
  },

  {
    id: "physical-security",
    code: "POL-16",
    title: "Physical & Environmental Security Policy",
    category: "Physical",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Physical & Environmental Security"],
    controlIds: ["PES-01","PES-02","PES-03","PES-04","PES-05","PES-06","PES-07","PES-08","PES-09","PES-10","PES-11","PES-12","PES-13","PES-15"],
    purpose: "This policy covers physical access to ACME offices and any facility housing ACME systems — badges, visitors, and keeping equipment physically safe.",
    scope: "All ACME offices, data closets, and any alternate/remote work site where ACME equipment is used.",
    statements: [
      { title: "Badge in, and don't let others tailgate", detail: "Use your own badge to enter ACME facilities, and don't hold the door for someone you don't recognize — direct them to reception instead." },
      { title: "Visitors are escorted", detail: "Guests sign in, wear a visitor badge, and are escorted while in non-public areas — they don't wander unaccompanied." },
      { title: "Sensitive areas need extra clearance", detail: "Server rooms and other restricted areas require specific authorization beyond a standard building badge, and access is logged." },
      { title: "Keep your workspace clear", detail: "Don't leave Confidential/Restricted printouts, badges, or unlocked devices visible on your desk when you step away (clean desk practice)." },
      { title: "Working remotely still means physical care", detail: "At home or a remote site, keep ACME equipment out of sight of visitors and don't let household members use your work laptop." },
    ],
    standards: [
      { title: "Access control system", detail: "Badge-based access control logs entry/exit at all ACME facilities; access lists for restricted areas (server/network rooms) are reviewed quarterly." },
      { title: "Environmental protections", detail: "Server/network rooms have fire suppression, temperature/humidity monitoring, and backup power, monitored continuously." },
      { title: "Visitor management", detail: "All visitors sign in, are issued a visible visitor badge, and are escorted in non-public areas; visitor logs are retained." },
      { title: "Equipment siting", detail: "Critical equipment is sited away from environmental hazards and physical tampering risk, with siting reviewed as part of facility planning." },
    ],
    roles: [
      { role: "Facilities/IT", responsibility: "Administers badge access, visitor management, and environmental monitoring" },
      { role: "All Employees", responsibility: "Follow badge and visitor procedures; practice clean-desk habits" },
    ],
    relatedPolicyIds: ["acceptable-use-asset", "business-continuity"],
  },

  {
    id: "hr-security",
    code: "POL-17",
    title: "Human Resources Security Policy",
    category: "People",
    tier: POLICY_TIERS.EXTENDED,
    domains: ["Human Resources Security"],
    controlIds: ["HRS-01","HRS-02","HRS-03","HRS-04","HRS-05","HRS-06","HRS-07","HRS-08","HRS-09","HRS-10","HRS-11","HRS-12","HRS-13"],
    purpose: "Security starts before someone's first day and continues through their last. This policy covers screening, role expectations, and how access changes as employment does.",
    scope: "All ACME employees and contractors, across the full employment lifecycle.",
    statements: [
      { title: "Background checks happen before day one", detail: "New hires and contractors complete a background screening appropriate to their role before starting, especially for roles with access to sensitive systems or data." },
      { title: "Security expectations are in writing", detail: "Your offer letter and onboarding paperwork include acknowledgment of ACME's security and acceptable use policies — this isn't a verbal understanding." },
      { title: "Some duties are intentionally split", detail: "For sensitive processes (like financial transactions or production changes), no single person controls the entire process end-to-end — this protects you as much as it protects ACME." },
      { title: "Role changes trigger an access review", detail: "Transferring teams or getting promoted means your access is reassessed — old access doesn't just carry forward by default." },
      { title: "Leaving ACME is a coordinated process", detail: "HR notifies IT the same day someone departs so access, equipment, and building badges are handled promptly, not days later." },
      { title: "There are consequences for violations", detail: "Violating security policy is handled through ACME's standard disciplinary process, proportionate to the violation." },
    ],
    standards: [
      { title: "Screening requirements", detail: "Background check scope is tiered by role sensitivity (standard vs. elevated for roles with privileged system or financial access) and repeated periodically for high-sensitivity roles." },
      { title: "Access agreements", detail: "Employees and contractors sign confidentiality/acceptable-use agreements as a condition of system access, tracked in HRIS (Workday)." },
      { title: "Separation of duties", detail: "Sensitive workflows (e.g., vendor payment setup and approval, production deployment and code review) require two different individuals by design." },
      { title: "Offboarding SLA", detail: "HR's termination event in Workday triggers automated access revocation in Entra ID within the same business day." },
    ],
    roles: [
      { role: "HR", responsibility: "Runs background screening, manages access agreements, triggers timely offboarding" },
      { role: "Managers", responsibility: "Reassess team member access on role changes; enforce separation of duties in their processes" },
      { role: "IT Security", responsibility: "Executes access changes tied to HR lifecycle events" },
    ],
    relatedPolicyIds: ["access-control", "security-awareness", "acceptable-use-asset"],
  },

  {
    id: "security-awareness",
    code: "POL-18",
    title: "Security Awareness & Training Policy",
    category: "People",
    tier: POLICY_TIERS.CORE,
    domains: ["Security Awareness & Training"],
    controlIds: ["SAT-01","SAT-02","SAT-03","SAT-04"],
    purpose: "Most incidents start with a person, not a piece of malware. This policy explains ACME's ongoing effort to keep everyone — not just IT — able to spot and avoid common threats.",
    scope: "All employees and contractors.",
    statements: [
      { title: "Everyone completes annual training", detail: "All employees complete security awareness training at hire and annually thereafter, covering phishing, social engineering, and safe data handling." },
      { title: "Some roles get more", detail: "Employees in higher-risk roles (engineering, IT, finance) receive additional role-based training relevant to their specific exposure." },
      { title: "Phishing simulations are part of training", detail: "ACME periodically sends simulated phishing emails to help employees practice spotting real ones — clicking one isn't a punishment, it's a learning moment." },
      { title: "Training completion is tracked", detail: "Training records are kept so ACME can confirm the whole company is current, not just assume it." },
    ],
    standards: [
      { title: "Training platform", detail: "KnowBe4 delivers annual security awareness training and ongoing phishing simulation campaigns; completion is tracked automatically and reported to management." },
      { title: "Role-based content", detail: "Engineering receives secure-coding training; finance/AP receives fraud and business-email-compromise-specific training." },
      { title: "Escalation for repeat misses", detail: "Employees who repeatedly fail phishing simulations or miss training deadlines receive targeted follow-up coaching from their manager and Security." },
    ],
    roles: [
      { role: "Security & Compliance Team", responsibility: "Assigns and tracks training, runs phishing simulations, reports completion" },
      { role: "Managers", responsibility: "Ensure their team completes required training" },
      { role: "All Employees", responsibility: "Complete assigned training and apply it in day-to-day work" },
    ],
    relatedPolicyIds: ["hr-security", "incident-response", "acceptable-use-asset"],
  },

  {
    id: "ai-acceptable-use",
    code: "POL-19",
    title: "Artificial Intelligence Acceptable Use Policy",
    category: "Emerging Tech",
    tier: POLICY_TIERS.CORE,
    domains: ["Artificial Intelligence & Autonomous Technologies"],
    controlIds: ["AAT-01","AAT-11","AAT-13"],
    purpose: "AI tools can genuinely help you work faster — this policy explains which tools are approved and what you should never paste into any AI tool, approved or not.",
    scope: "All employees using AI tools (chatbots, coding assistants, image/content generators) for ACME work, and any AI feature ACME builds into its own products.",
    statements: [
      { title: "Use approved AI tools only", detail: "Use only AI tools on ACME's approved list (e.g., Microsoft Copilot, ChatGPT Enterprise) for work tasks. A personal ChatGPT/Gemini account is not an approved venue for ACME data, even if it's convenient." },
      { title: "Never paste Confidential or Restricted data into an AI tool", detail: "Customer data, source code, credentials, and unreleased business information don't go into any AI prompt unless the specific tool is explicitly approved for that data type." },
      { title: "AI output gets checked, not trusted blindly", detail: "AI-generated content (text, code, analysis) can be wrong or biased — review it before you rely on it or ship it, just like you would a first draft from a new hire." },
      { title: "New AI tools go through the same approval as any new tool", detail: "Want to use a new AI tool or vendor feature for ACME work? It goes through the same Cloud Security/vendor approval process as any other SaaS tool, plus a privacy check if it touches personal data." },
      { title: "AI built into ACME's own products is governed too", detail: "Any AI/ML feature ACME builds is tracked in an inventory, reviewed for reliability, fairness, and safety before launch, and monitored after release — it doesn't ship untracked." },
    ],
    standards: [
      { title: "Approved tool list", detail: "IT Security maintains and publishes the current list of approved AI tools; enterprise-tier tools are preferred specifically because they contractually exclude ACME data from model training." },
      { title: "AI/agent inventory", detail: "AI models and agents ACME builds or deploys are tracked with owner, purpose, and lifecycle status from development through decommissioning." },
      { title: "Stakeholder & fairness review", detail: "AI features with meaningful user impact undergo review incorporating diverse stakeholder input and assessment for reliability, safety, and fairness before release, per the AI governance process." },
      { title: "Data handling in prompts", detail: "Prompts and outputs are treated at the classification level of the most sensitive data they contain, per the Data Classification & Handling Policy." },
    ],
    roles: [
      { role: "IT Security", responsibility: "Maintains the approved AI tool list, evaluates new AI tool requests" },
      { role: "Engineering/Product", responsibility: "Maintains the AI/agent inventory for any AI ACME builds; ensures pre-launch review" },
      { role: "All Employees", responsibility: "Use only approved tools, never input Confidential/Restricted data, review AI output before relying on it" },
    ],
    relatedPolicyIds: ["data-classification", "third-party-risk", "secure-development"],
  },
];
