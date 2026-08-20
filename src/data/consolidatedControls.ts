// Hand-authored, policy-ready control statements that consolidate related SCF
// controls into one business-facing control. sourceControls lists every SCF id
// absorbed into the survivor, including historical sub-controls.
export interface ConsolidatedControl {
  statement: string;
  requirements: Array<{ title: string; detail: string }>;
  sourceControls: string[];
}

export const CONSOLIDATED_CONTROLS: Record<string, ConsolidatedControl> = {
  "GOV-01": {
    statement:
      "ACME governs its Security, Compliance & Resilience Program through a formal steering committee of cybersecurity, data protection, and business executives that meets regularly, reports status and recommendations to the governing body, and commits the staffing, budget, process, and technology resources needed for continual improvement.",
    requirements: [
      { title: "Governance Program", detail: "Security, compliance, and resilience governance controls are formally implemented." },
      { title: "Steering Committee", detail: "A steering committee or advisory board of key executives aligns program capabilities with business requirements and meets regularly." },
      { title: "Governing Body Reporting", detail: "Governance oversight reporting and recommendations are provided to those making executive decisions on material program matters." },
      { title: "Continual Improvement Commitment", detail: "Staffing, budget, process, and technology resources are committed to continually improve the program." },
      { title: "Policy Publication", detail: "Policies, standards, and procedures necessary for secure, compliant, and resilient capabilities are established, maintained, and disseminated." },
      { title: "Controlled Exceptions", detail: "Exceptions to standards are prohibited unless formally assessed for risk impact, approved, and recorded." },
      { title: "Assigned Program Ownership", detail: "Qualified individuals are assigned the mission and resources to centrally manage, coordinate, develop, implement, and maintain the SCRP." },
      { title: "Accountability Structure", detail: "Teams and individuals are empowered, responsible, and trained for mapping, measuring, and managing TAASD-related risk." },
      { title: "Chain of Command", detail: "An authoritative chain of command with clear communication lines removes ambiguity in risk management responsibility." },
      { title: "Owner Accountability", detail: "Data and process owners operationalize security, compliance, and resilience practices for assets under their control." },
      { title: "Control Selection", detail: "Owners select required controls for each asset under their control." },
      { title: "Control Implementation", detail: "Owners implement required controls for each asset." },
      { title: "Control Assessment", detail: "Owners assess whether required controls are implemented correctly and operating as intended." },
      { title: "Production Authorization", detail: "Owners obtain authorization before production use of an asset." },
      { title: "Ongoing Monitoring", detail: "Owners monitor assets on an ongoing basis for applicable threats and risks and confirm controls operate as intended." }
    ],
    sourceControls: ["GOV-01", "GOV-01.1", "GOV-01.2", "GOV-01.3", "GOV-02", "GOV-02.1", "GOV-04", "GOV-04.1", "GOV-04.2", "GOV-15", "GOV-15.1", "GOV-15.2", "GOV-15.3", "GOV-15.4", "GOV-15.5", "GOV-03", "GOV-08", "GOV-14"],
  },

  "GOV-05": {
    statement:
      "ACME develops, reports, and monitors measures of program performance — including Key Performance Indicators and Key Risk Indicators — to support management's ongoing performance monitoring and trend analysis of the Security, Compliance & Resilience Program.",
    requirements: [
      { title: "Performance Measurement", detail: "SCRP measures of performance are developed, reported, and monitored." },
      { title: "Key Performance Indicators", detail: "KPIs support performance monitoring and trend analysis." },
      { title: "Key Risk Indicators", detail: "KRIs support senior management's performance monitoring and trend analysis." }
    ],
    sourceControls: ["GOV-05", "GOV-05.1", "GOV-05.2", "GOV-17"],
  },

  "CPL-01": {
    statement:
      "ACME identifies and implements the statutory, regulatory, and contractual controls it is obligated to meet, formally scoping compliance obligations, tracking and remediating instances of non-compliance, and maintaining the ability to demonstrate conformity through qualified assessments and signed declarations.",
    requirements: [
      { title: "Compliance Identification & Implementation", detail: "Relevant statutory, regulatory, and contractual controls are identified and implemented." },
      { title: "Non-Compliance Oversight", detail: "Instances of non-compliance are documented, reviewed, and addressed with risk mitigation actions." },
      { title: "Compliance Scope", detail: "The scope of controls meeting statutory, regulatory, and contractual obligations is documented and validated." },
      { title: "Demonstrable Conformity", detail: "ACME maintains the ability to demonstrate conformity with applicable laws, regulations, and contractual obligations." },
      { title: "Conformity Assessments", detail: "Assessments are conducted to demonstrate conformity with applicable requirements." },
      { title: "Declarations of Conformity", detail: "A concise, current, signed (and where possible machine-readable) declaration of conformity is generated for each assessment." },
      { title: "Qualified Assessors", detail: "Individuals performing compliance audits/assessments hold reasonable professional qualifications and subject-matter expertise." },
      { title: "Designated Certifying Official", detail: "An individual is designated with authority to make conformity statements on ACME's behalf, and to attest to the accuracy of conformity attestations." },
      { title: "Executive-Level Oversight", detail: "A controls oversight function reports to organizational executive leadership." },
      { title: "Internal Audit Function", detail: "An internal audit function provides senior management insight into the appropriateness of technology and information governance processes." },
      { title: "Periodic Audits", detail: "Security, compliance, and resilience controls are periodically audited for conformity with documented policies, standards, and procedures." },
      { title: "Corrective Action", detail: "Corrective action is taken to remediate instances of non-conformity with statutory, regulatory, or contractual obligations." },
      { title: "Materiality Threshold", detail: "Criteria are defined to designate an incident as material." },
      { title: "Material Risk Criteria", detail: "Criteria are defined to designate a risk as material." },
      { title: "Material Threat Criteria", detail: "Criteria are defined to designate a threat as material." }
    ],
    sourceControls: ["CPL-01", "CPL-01.1", "CPL-01.2", "CPL-01.3", "CPL-01.4", "CPL-01.5", "CPL-01.6", "CPL-01.7", "CPL-01.8", "CPL-02", "CPL-02.1", "CPL-02.2", "CPL-02.3", "GOV-16", "GOV-16.1", "GOV-16.2", "CPL-12", "GOV-06", "GOV-07"],
  },

  "CPL-03": {
    statement:
      "ACME regularly reviews its processes and documented procedures for conformity with security, compliance, and resilience requirements, using independent assessors operating under defined methods, rigor, evidence requests, and sampling criteria, with minimum-necessary access to conduct their work.",
    requirements: [
      { title: "Regular Conformity Review", detail: "Processes and documented procedures are regularly reviewed for conformity with policies, standards, and applicable requirements." },
      { title: "Independent Assessors", detail: "Independent assessors evaluate security, compliance, and resilience at planned intervals or after significant change." },
      { title: "Functional Reviews", detail: "Technology assets, applications, and services are regularly reviewed for adherence to policies and standards." },
      { title: "Minimum-Necessary Assessor Access", detail: "Assessors are granted the minimum logical and physical access necessary to conduct assessments." },
      { title: "Defined Assessment Methods & Rigor", detail: "Acceptable assessment methods and the required level of rigor are defined for each engagement." },
      { title: "Evidence Request List", detail: "An Evidence Request List (ERL) is defined prior to the start of each assessment." },
      { title: "Evidence Sampling Criteria", detail: "Evidence sampling criteria are defined for each assessment." },
      { title: "Formal Assessment Program", detail: "Controls are formally assessed to determine whether they are correctly implemented, operating as intended, and meeting requirements." },
      { title: "Assessor Independence", detail: "Assessors or assessment teams maintain appropriate independence." },
      { title: "Specialized Assessments", detail: "Specialized assessments are conducted for areas such as compliance obligations, monitoring, mobile, databases, application security, embedded technologies, vulnerability management, malicious code, insider threats, performance, and AI/AAT." },
      { title: "Third-Party Assessment Reciprocity", detail: "Results of credible external assessments performed by impartial organizations are accepted." },
      { title: "Security Assessment Report", detail: "A Security Assessment Report (SAR) is produced at the conclusion of each assessment to certify results and support remediation." }
    ],
    sourceControls: ["CPL-03", "CPL-03.1", "CPL-03.2", "CPL-03.3", "CPL-03.4", "CPL-03.5", "CPL-03.6", "CPL-03.7", "IAO-02", "IAO-02.1", "IAO-02.2", "IAO-02.3", "IAO-02.4", "CPL-04", "IAO-07"],
  },

  "PRM-07": {
    statement:
      "ACME manages security, compliance, and resilience initiatives as a formal portfolio, with a documented strategic plan, defined objectives, and target capability maturity levels guiding resource allocation and investment decisions.",
    requirements: [
      { title: "Strategic Plan & Objectives", detail: "A documented security, compliance, and resilience strategic plan defines the organization's objectives and how they will be achieved." },
      { title: "Portfolio-Based Resource Planning", detail: "Security, compliance, and resilience initiatives are managed as a portfolio, prioritized and resourced according to their contribution to strategic objectives." },
      { title: "Target Maturity Levels", detail: "Target capability maturity levels are defined and used to measure progress against the strategic plan." },
      { title: "SCRP Resourcing in Capital Planning", detail: "Capital planning and investment requests address the resources needed to implement the SCRP." },
      { title: "Documented Exceptions", detail: "Any request that does not fund a required SCRP resource is documented as a formal exception." },
      { title: "Evolving Risk Prioritization", detail: "Resource and technology investment priorities are adjusted to maintain situational awareness of, and minimize exposure to, evolving risks and threats." },
      { title: "Assessment & Authorization Controls", detail: "Security, compliance, and resilience assessment and authorization controls are implemented." },
      { title: "Defined Assessment Boundaries", detail: "Assessment scope is defined by boundary, covering people, processes, and technology relevant to the systems under review." },
      { title: "System Security Plan", detail: "Authoritative documentation identifies architectural/implementation detail, reflects the current state of applied controls, and provides a historical record of changes." },
      { title: "Stakeholder Coordination", detail: "Information Assurance Program activities are planned and coordinated with affected stakeholders in advance to reduce operational impact." },
      { title: "Contract Data Protection", detail: "Sensitive/regulated data collected, developed, or handled in support of a contract is adequately protected." }
    ],
    sourceControls: ["PRM-01", "PRM-01.1", "PRM-01.2", "PRM-02", "PRM-02.1", "IAO-01", "IAO-01.1", "IAO-03", "IAO-03.1", "IAO-03.2", "PRM-03", "PRM-04", "PRM-05", "PRM-06", "PRM-07"],
  },

  "IAO-04": {
    statement:
      "ACME formally tracks identified control deficiencies through a Plan of Action and Milestones (or similar) documenting risk, ownership, remediation timeline, and disposition, using automation to keep the tracker accurate, current, and readily available.",
    requirements: [
      { title: "Deficiency Tracking", detail: "Identified deficiencies are formally documented, including tracking number, affected control, risk, source, compensating controls, owner, remediation resources/timeline, and disposition." },
      { title: "Automated Tracking", detail: "Automated mechanisms help ensure tracked deficiencies remain accurate, up-to-date, and readily available." }
    ],
    sourceControls: ["IAO-05", "IAO-05.1", "IAO-04", "IAO-06"],
  },

  "RSK-01": {
    statement:
      "ACME operates a strategic, operational, and tactical risk management program with formally defined risk framing, tolerance, threshold, and appetite, resourced sufficiently to reduce the magnitude and likelihood of technology-related risk.",
    requirements: [
      { title: "Risk Management Controls", detail: "Strategic, operational, and tactical risk management controls are implemented." },
      { title: "Risk Framing", detail: "Assumptions, constraints, risk tolerance, and risk-management priorities/trade-offs are identified." },
      { title: "Risk Management Resourcing", detail: "Capability to manage technology-related risk is adequately resourced." },
      { title: "Risk Tolerance", detail: "Organizational risk tolerance (the acceptable range of results) is defined." },
      { title: "Risk Threshold", detail: "The risk exposure level above which risks must be addressed is defined." },
      { title: "Risk Appetite", detail: "The degree of uncertainty ACME is willing to accept in pursuit of reward is defined." },
      { title: "Security Categorization", detail: "TAASD is categorized per applicable laws, regulations, and contracts; results and rationale are documented and reviewed/approved by the asset owner." },
      { title: "Impact-Level Prioritization", detail: "Impact levels are prioritized to prevent potential disruptions." },
      { title: "Risk Identification", detail: "Internal and external risks are identified and documented." },
      { title: "Risk Catalog", detail: "A current catalog of applicable risks is developed and maintained." }
    ],
    sourceControls: ["RSK-01", "RSK-01.1", "RSK-01.2", "RSK-01.3", "RSK-01.4", "RSK-01.5", "RSK-02", "RSK-02.1", "RSK-03", "RSK-03.1"],
  },

  "RSK-04": {
    statement:
      "ACME conducts recurring risk assessments evaluating the likelihood and magnitude of harm from unauthorized access, use, disclosure, disruption, modification, or destruction of its assets — tracked in a risk register, guided by a defined methodology, triggered by defined circumstances, and involving identified stakeholders throughout.",
    requirements: [
      { title: "Recurring Risk Assessment", detail: "Risk assessments recur, evaluating likelihood and magnitude of harm to TAASD." },
      { title: "Risk Register", detail: "A risk register facilitates monitoring and reporting of risks." },
      { title: "Risk Assessment Methodology", detail: "A defined methodology ensures coverage across organizational components." },
      { title: "Assessment Triggers", detail: "Instances requiring a risk assessment are defined." },
      { title: "Stakeholder Involvement", detail: "Applicable stakeholders are defined, involved in the assessment process, and provided results upon completion." }
    ],
    sourceControls: ["RSK-04", "RSK-04.1", "RSK-04.2", "RSK-04.3", "RSK-04.4", "RSK-05", "RSK-07"],
  },

  "RSK-06": {
    statement:
      "ACME remediates identified risks to an acceptable level, selecting appropriate treatment options and compensating countermeasures, and formalizing a Risk Treatment Plan with a defined timeline for stakeholders to execute.",
    requirements: [
      { title: "Risk Remediation", detail: "Risks are remediated to an acceptable level." },
      { title: "Risk Response", detail: "Proper response actions remediate findings from assessments, audits, and incidents." },
      { title: "Compensating Countermeasures", detail: "Compensating countermeasures reduce risk and threat exposure." },
      { title: "Risk Treatment Options", detail: "Appropriate risk treatment options are selected based on assessment findings." },
      { title: "Risk Treatment Plan", detail: "A formal Risk Treatment Plan (RTP) with a defined timeline guides stakeholder remediation." },
      { title: "SCRM Plan", detail: "A plan addresses supply chain risk across the technology asset lifecycle, documenting mitigating actions and monitoring performance." },
      { title: "Periodic Supply Chain Risk Assessment", detail: "Supply chain risks associated with technology assets are periodically assessed." },
      { title: "AI/AAT Supply Chain Risk", detail: "Risks and benefits from AI/AAT in the supply chain, including third-party software and data, are addressed." }
    ],
    sourceControls: ["RSK-06", "RSK-06.1", "RSK-06.2", "RSK-06.3", "RSK-06.4", "RSK-09", "RSK-09.1", "RSK-09.2", "RSK-08", "RSK-10"],
  },

  "AAT-01": {
    statement:
      "ACME governs Artificial Intelligence (AI) and Autonomous Technologies (AAT) through documented policies, processes, and lifecycle tracking that ensure AI systems are legally compliant, trustworthy, and continuously monitored from development through decommissioning.",
    requirements: [
      { title: "Legal & Regulatory Mapping", detail: "Applicable statutory and regulatory requirements for AI/AAT are identified, documented, and actively managed." },
      { title: "Trustworthy AI Design", detail: "AI/AAT systems are designed to be reliable, safe, fair, secure, resilient, transparent, explainable, and privacy-enhancing, minimizing unintended consequences." },
      { title: "Value Sustainment", detail: "Deployed AI/AAT systems are monitored and maintained to sustain their intended value over time." },
      { title: "Model & Agent Lifecycle Inventory", detail: "All AI models and agents are tracked in an inventory covering ownership, purpose, and status across development, deployment, updates, and decommissioning." }
    ],
    sourceControls: ["AAT-01", "AAT-01.1", "AAT-01.2", "AAT-01.3", "AAT-01.4", "AAT-03", "AAT-04", "AAT-08", "AAT-14"],
  },

  "AAT-16": {
    statement:
      "ACME maintains ongoing engagement with AI/AAT stakeholders — including independent assessors, end users, and impacted communities — to surface and act on feedback about the positive, negative, and unanticipated impacts of deployed systems.",
    requirements: [
      { title: "Stakeholder Feedback Integration", detail: "Risk-related feedback from stakeholders external to the development team is regularly collected, prioritized, and integrated." },
      { title: "Independent Assessments", detail: "AI/AAT systems undergo regular assessment by independent assessors and stakeholders not involved in their development." },
      { title: "End User Feedback", detail: "Feedback from end users and impacted communities is collected and incorporated into system evaluation metrics." },
      { title: "Incident & Error Reporting", detail: "AI/AAT-related incidents and errors are communicated to relevant stakeholders, including affected communities." }
    ],
    sourceControls: ["AAT-11", "AAT-11.1", "AAT-11.2", "AAT-11.3", "AAT-11.4", "AAT-16", "AAT-02"],
  },

  "AAT-17": {
    statement:
      "ACME ensures the people who build, operate, and evaluate AI and Autonomous Technologies bring diverse demographic backgrounds and broad domain and user experience expertise, with defined and assessed competency requirements.",
    requirements: [
      { title: "Stakeholder Diversity", detail: "AI/AAT stakeholder teams incorporate demographic diversity and broad domain/user experience expertise." },
      { title: "Defined Competencies", detail: "Operator and practitioner proficiency requirements for AI/AAT roles are defined, assessed, and documented." }
    ],
    sourceControls: ["AAT-13", "AAT-13.1", "AAT-17", "AAT-05", "AAT-12"],
  },

  "AST-01": {
    statement:
      "ACME maintains a formal IT Asset Management (ITAM) program governing the identification, ownership, and lifecycle oversight of all Technology Assets, Applications, Services, and Data (TAASD) supporting the business.",
    requirements: [
      { title: "Program Governance", detail: "A documented ITAM program defines roles, responsibilities, and processes for managing assets across their lifecycle." },
      { title: "Critical Dependency Mapping", detail: "Assets and services supporting more than one critical business function are identified and assessed for the security risk that dependency creates." },
      { title: "Stakeholder Involvement", detail: "Relevant stakeholders (asset owners, security, engineering) are identified and involved on an ongoing basis in managing critical assets." },
      { title: "Standardized Naming", detail: "Assets, applications, services, and data use a scalable, standardized naming convention that avoids identification conflicts." },
      { title: "Approved Technology List", detail: "A current, maintained list of approved hardware and software exists; use of unapproved technology is out of policy." },
      { title: "Authorized Connections", detail: "Only assets, applications, and services on an approved list may connect to organizational systems." },
      { title: "Assigned Ownership", detail: "Asset ownership responsibilities are assigned, tracked, and managed to establish a common understanding of protection requirements." },
      { title: "Accountability Information", detail: "The inventory captures the name, position, and role of individuals accountable for each asset." },
      { title: "Provenance Tracking", detail: "The origin, development, ownership, location, and change history of TAASD is tracked." }
    ],
    sourceControls: ["AST-01", "AST-01.1", "AST-01.2", "AST-01.3", "AST-01.4", "AST-01.5", "AST-03", "AST-03.1", "AST-03.2"],
  },

  "AST-02": {
    statement:
      "ACME maintains an accurate, current inventory of all Technology Assets, Applications, Services, and Data — tracked in a Configuration Management Database, updated at installation/removal, protected against duplication, and continuously validated through automated unauthorized-component detection, network access control, and DHCP logging.",
    requirements: [
      { title: "Comprehensive Asset Inventory", detail: "Inventories accurately reflect current TAASD in use, identify authorized software with business justification, and are available for audit." },
      { title: "Inventory Updates", detail: "Inventories are updated during component installation, removal, and upgrade." },
      { title: "Unauthorized Component Detection", detail: "Automated mechanisms detect and alert on unauthorized hardware, software, and firmware." },
      { title: "Authoritative Source of Truth", detail: "A single authoritative repository prevents duplicate asset records across inventories." },
      { title: "Approved Deviation Tracking", detail: "Approved deviations from baseline configurations are documented and governed." },
      { title: "Network Access Control", detail: "NAC (or similar) detects unauthorized devices and disables their network access." },
      { title: "DHCP Logging", detail: "DHCP server logging improves inventory accuracy and helps detect unknown systems." },
      { title: "Software Licensing Protection", detail: "Software licensing restrictions protect intellectual property rights." },
      { title: "Sensitive Data Mapping", detail: "A map identifies where sensitive/regulated data is stored, transmitted, or processed." },
      { title: "CMDB", detail: "A Configuration Management Database (or similar) monitors and governs asset-specific information." },
      { title: "Location Tracking", detail: "The geographic location of system components is tracked." },
      { title: "Component-to-System Binding", detail: "Components are bound to a specific system." },
      { title: "Network & Data Flow Diagrams", detail: "Diagrams reflect current network architecture, sufficient detail to assess security, and document sensitive/regulated data flows." },
      { title: "Asset Scope Classification", detail: "Security, compliance, and resilience control applicability is determined through documented asset scope categorization." },
      { title: "Boundary Visualization", detail: "Control applicability boundaries are graphically represented for assets and third parties." },
      { title: "Compliance-Scoped Asset Inventory", detail: "A current inventory identifies assets in scope for statutory, regulatory, or contractual compliance obligations." }
    ],
    sourceControls: ["AST-02", "AST-02.1", "AST-02.2", "AST-02.3", "AST-02.4", "AST-02.5", "AST-02.6", "AST-02.7", "AST-02.8", "AST-02.9", "AST-02.10", "AST-02.11", "AST-04", "AST-04.1", "AST-04.2", "AST-04.3"],
  },

  "AST-05": {
    statement:
      "ACME maintains strict control over the distribution of sensitive and regulated media, requiring management approval before any such media leaves organizational facilities.",
    requirements: [
      { title: "Media Distribution Control", detail: "Strict control governs internal and external distribution of sensitive/regulated media." },
      { title: "Management Approval for External Transfer", detail: "Management approval is required before sensitive/regulated media is transferred outside organizational facilities." },
      { title: "Enhanced Unattended Protection", detail: "Enhanced protection measures guard unattended technology assets against tampering and unauthorized access." },
      { title: "Mobile Device Travel Security", detail: "Users are educated to physically secure laptops and mobile devices out of sight, preferably in a vehicle's trunk, while traveling." },
      { title: "Integrity Assessment", detail: "Logical assessments evaluate critical component integrity (e.g., configuration settings); physical assessments evaluate assets for unauthorized access or modification." },
      { title: "Technology Asset Inspections", detail: "Critical technology assets are physically and logically inspected for evidence of tampering." }
    ],
    sourceControls: ["AST-05", "AST-05.1", "AST-06", "AST-06.1", "AST-15", "AST-15.1", "AST-07", "AST-08", "AST-12"],
  },

  "IAC-01": {
    statement:
      "ACME implements identity and access management controls with retained accountability records, governed AAA solutions on-premises and via external providers, and a current inventory of authorized users and service accounts.",
    requirements: [
      { title: "IAM Controls", detail: "Identification and access management controls are implemented." },
      { title: "Access Accountability Records", detail: "Records track who was granted access, who authorized it, and when it was last reviewed." },
      { title: "Governed AAA", detail: "Authenticate, Authorize, and Audit solutions are strictly governed on-premises and via external providers." },
      { title: "User & Service Account Inventory", detail: "A current list of authorized users and service accounts is maintained." },
      { title: "Unique Central AAA", detail: "Organizational users and processes are uniquely identified and centrally authenticated, authorized, and audited." },
      { title: "Individual Authentication Behind Groups", detail: "Individuals authenticate individually even when a group authenticator is used." },
      { title: "Replay-Resistant Authentication", detail: "Automated mechanisms employ replay-resistant authentication." },
      { title: "PIV Credential Acceptance", detail: "Organizational PIV credentials are accepted and electronically verified." },
      { title: "Out-of-Band Authentication", detail: "OOBA is implemented under specific conditions." },
      { title: "Third-Party AAA", detail: "Third-party users and processes are uniquely identified and centrally authenticated, authorized, and audited." },
      { title: "External PIV Acceptance", detail: "PIV credentials from other organizations are accepted and electronically verified." },
      { title: "FICAM-Approved Credentials", detail: "FICAM-approved third-party credentials are automatically accepted." },
      { title: "FICAM Profile Conformance", detail: "Systems conform to FICAM-issued profiles." },
      { title: "Disassociability", detail: "User attributes are disassociated from credential/relying-party relationships." },
      { title: "NIST-Compliant External Authenticators", detail: "External authenticators are restricted to a maintained list of NIST-compliant options." },
      { title: "Naming Standards", detail: "Naming standards govern usernames and system identifiers." },
      { title: "User Identity Management", detail: "Proper identity management applies to non-consumer users and administrators." },
      { title: "Third-Party Identification", detail: "Contractors and third-party users are identified through unique username characteristics." },
      { title: "Dynamic Identifier Management", detail: "Usernames and system identifiers are dynamically managed." },
      { title: "Cross-Organization Coordination", detail: "Username identifiers are coordinated with external organizations." },
      { title: "Privileged Identifier Marking", detail: "Privileged accounts are uniquely identified as privileged users or services." },
      { title: "Pairwise Pseudonymous Identifiers", detail: "Pseudonymous identifiers discourage tracking and profiling of data subjects." }
    ],
    sourceControls: ["IAC-01", "IAC-01.1", "IAC-01.2", "IAC-01.3", "IAC-02", "IAC-02.1", "IAC-02.2", "IAC-02.3", "IAC-02.4", "IAC-03", "IAC-03.1", "IAC-03.2", "IAC-03.3", "IAC-03.4", "IAC-03.5", "IAC-09", "IAC-09.1", "IAC-09.2", "IAC-09.3", "IAC-09.4", "IAC-09.5", "IAC-09.6", "IAC-18"],
  },

  "IAC-06": {
    statement:
      "ACME enforces multi-factor authentication for remote access, third-party technology, and non-console access to critical sensitive-data systems — covering privileged and non-privileged network access, local privileged access, out-of-band factors, and alternative tokens when the primary method is unavailable.",
    requirements: [
      { title: "MFA Enforcement", detail: "MFA is enforced for remote access, third-party TAAS, and non-console access to critical sensitive-data systems." },
      { title: "Privileged Network Access MFA", detail: "MFA authenticates network access for privileged accounts." },
      { title: "Non-Privileged Network Access MFA", detail: "MFA authenticates network access for non-privileged accounts." },
      { title: "Local Privileged Access MFA", detail: "MFA authenticates local access for privileged accounts." },
      { title: "Out-of-Band MFA", detail: "One MFA factor is independently provided by a separate device from the system being accessed." },
      { title: "Alternative MFA Tokens", detail: "Alternative MFA tokens are available when the primary solution cannot be used." },
      { title: "Alternative Authentication Methods", detail: "Individuals may use alternative authentication methods under specific circumstances." },
      { title: "Single Sign-On", detail: "Transparent SSO authentication is provided across technology assets." },
      { title: "Federated Credentials", detail: "Federated credentials enable cross-organization authentication." },
      { title: "Continuous Authentication", detail: "Automated mechanisms enable continuous re-authentication throughout entity interactions." }
    ],
    sourceControls: ["IAC-06", "IAC-06.1", "IAC-06.2", "IAC-06.3", "IAC-06.4", "IAC-06.5", "IAC-13", "IAC-13.1", "IAC-13.2", "IAC-13.3"],
  },

  "IAC-07": {
    statement:
      "ACME governs access rights through formal user registration and de-registration, revoking access when roles change and promptly upon employment termination.",
    requirements: [
      { title: "Third-Party TAAS Authentication", detail: "Third-party technology assets, applications, and services are identified and authenticated." },
      { title: "Shared Identification Information", detail: "External providers share current, accurate information for third-party users with access." },
      { title: "No Non-Organizational Privileged Access", detail: "Privileged access by non-organizational users is prohibited." },
      { title: "Formal Provisioning Process", detail: "Access rights assignment follows a formal registration/de-registration process." },
      { title: "Role Change Revocation", detail: "Access rights are revoked following role changes when no longer necessary or permitted." },
      { title: "Timely Termination Revocation", detail: "Access rights are revoked promptly upon employment or contract termination." },
      { title: "Account Governance", detail: "Individual, group, system, service, application, guest, and temporary accounts are proactively governed." },
      { title: "Automated Directory Management", detail: "Automated mechanisms support system account management (e.g., directory services)." },
      { title: "Temporary Account Removal", detail: "Temporary and emergency accounts are disabled or removed after a defined period." },
      { title: "Inactive Account Disabling", detail: "Inactive accounts are disabled after a defined period." },
      { title: "Automated Account Auditing", detail: "Account creation, modification, enabling, disabling, and removal actions are audited and notified." },
      { title: "Shared Account Restrictions", detail: "Shared/group account use is authorized only under defined conditions." },
      { title: "High-Risk Account Disabling", detail: "Accounts for individuals posing significant risk are disabled immediately upon notification." },
      { title: "Orphaned Account Review", detail: "System accounts are reviewed and disabled if not tied to a business process and owner." },
      { title: "Usage Condition Enforcement", detail: "Automated mechanisms enforce usage conditions for users and roles." },
      { title: "Emergency Accounts", detail: "\\\"Emergency access only\\\" accounts are established and controlled." },
      { title: "Pre-Issuance Identity Verification", detail: "Identity is verified before authenticators are issued or access permissions modified." },
      { title: "Management Approval", detail: "New accounts or permission changes require management approval." },
      { title: "Identity Evidence", detail: "Evidence of individual identification is presented to the registration authority." },
      { title: "Evidence Validation & Verification", detail: "Presented identity evidence is validated and verified per defined methods." },
      { title: "In-Person Verification", detail: "Identity evidence validation is conducted in person before a designated registration authority." },
      { title: "Out-of-Band Address Confirmation", detail: "Proofing notice is delivered through an out-of-band channel to confirm the user's address." }
    ],
    sourceControls: ["IAC-05", "IAC-05.1", "IAC-05.2", "IAC-07", "IAC-07.1", "IAC-07.2", "IAC-15", "IAC-15.1", "IAC-15.2", "IAC-15.3", "IAC-15.4", "IAC-15.5", "IAC-15.6", "IAC-15.7", "IAC-15.8", "IAC-15.9", "IAC-28", "IAC-28.1", "IAC-28.2", "IAC-28.3", "IAC-28.4", "IAC-28.5"],
  },

  "IAC-10": {
    statement:
      "ACME securely manages authenticators proportional to data sensitivity — enforcing password complexity and strength validation, PKI certificate path validation, in-person or trusted third-party registration, protected and non-embedded static authenticators, hardware token quality, changed default credentials, password managers, biometric quality thresholds, passkeys, and scheduled or compromise-triggered credential rotation.",
    requirements: [
      { title: "Sensitivity-Proportional Management", detail: "Authenticators are securely managed with strength matching data sensitivity." },
      { title: "Password Complexity", detail: "Password-based authentication enforces complexity, length, and lifespan requirements." },
      { title: "PKI Path Validation", detail: "Certificates are validated via certification path and status checking for PKI-based authentication." },
      { title: "Trusted Registration", detail: "In-person or trusted third-party identity verification precedes third-party account creation." },
      { title: "Automated Strength Validation", detail: "Automated mechanisms verify password authenticators meet strength requirements." },
      { title: "Authenticator Protection", detail: "Authenticators are protected commensurate with the sensitivity of data they access." },
      { title: "No Embedded Static Authenticators", detail: "Unencrypted static authenticators aren't embedded in applications, scripts, or function keys." },
      { title: "Hardware Token Quality", detail: "Hardware token-based authentication satisfies defined token quality requirements." },
      { title: "Changed Default Authenticators", detail: "Default authenticators are changed at account creation or system installation." },
      { title: "Multiple Account Risk Management", detail: "Safeguards manage risk from individuals holding accounts on multiple systems." },
      { title: "Cached Authenticator Expiration", detail: "Cached authenticators expire after a defined time period." },
      { title: "Password Managers", detail: "Passwords are protected and stored via a password manager tool." },
      { title: "Biometric Quality", detail: "Biometric authentication meets defined false-positive/false-negative quality requirements." },
      { title: "Triggered Credential Change", detail: "Credentials change at predefined intervals or upon suspected compromise." },
      { title: "Passkeys", detail: "Passkeys or equivalent cryptographic key pairing authenticate users." },
      { title: "Cryptographic Module Standards", detail: "Cryptographic modules adhere to applicable security strength requirements." },
      { title: "Hardware Security Modules", detail: "HSMs protect authenticators relied upon by cryptographic modules." }
    ],
    sourceControls: ["IAC-10", "IAC-10.1", "IAC-10.2", "IAC-10.3", "IAC-10.4", "IAC-10.5", "IAC-10.6", "IAC-10.7", "IAC-10.8", "IAC-10.9", "IAC-10.10", "IAC-10.11", "IAC-10.12", "IAC-10.13", "IAC-10.14", "IAC-12", "IAC-12.1", "IAC-19"],
  },

  "IAC-16": {
    statement:
      "ACME restricts and controls privileged access rights — inventorying and validating authorization for privileged accounts, separating them across infrastructure environments, requiring additional authentication for privilege changes, assigning dedicated privileged accounts, and enabling manual override for urgent response without new session escalation.",
    requirements: [
      { title: "Privileged Access Restriction", detail: "Privileged access rights for users and TAAS are restricted and controlled." },
      { title: "Privileged Account Inventory", detail: "Privileged accounts are inventoried and validated as authorized by appropriate management." },
      { title: "Environment Separation", detail: "Privileged accounts are separated across infrastructure environments to limit lateral compromise." },
      { title: "Additional Authentication for Privilege Changes", detail: "Privilege change requests require additional authentication." },
      { title: "Dedicated Privileged Accounts", detail: "Dedicated privileged accounts are used solely for duties requiring privileged access." },
      { title: "Manual Override", detail: "Current account privileges can be manually overridden for timely response without a new session." }
    ],
    sourceControls: ["IAC-16", "IAC-16.1", "IAC-16.2", "IAC-16.3", "IAC-16.4", "IAC-16.5"],
  },

  "IAC-20": {
    statement:
      "ACME enforces least-privilege logical access controls — limiting sensitive data and database access to those with a job need, tightly controlling privileged utility programs, restricting admin tasks to dedicated machines, requiring dual authorization for privileged commands, revoking access promptly, and documenting authorized account types.",
    requirements: [
      { title: "Least-Privilege Enforcement", detail: "Logical access control permissions conform to least privilege." },
      { title: "Sensitive Data Access Limits", detail: "Sensitive/regulated data access is limited to those whose job requires it." },
      { title: "Database Access Restriction", detail: "Database access is restricted to necessary systems or individuals with job need." },
      { title: "Privileged Utility Control", detail: "Utility programs capable of overriding system/application controls are tightly restricted." },
      { title: "Dedicated Admin Machines", detail: "Administrative tasks requiring elevated access are restricted to dedicated machines." },
      { title: "Dual Authorization for Privileged Commands", detail: "Automated dual authorization is enforced for privileged commands." },
      { title: "Access Revocation", detail: "Logical and physical access authorizations are revoked as needed." },
      { title: "Documented Account Types", detail: "Allowed and prohibited account types on TAAS are defined and documented." },
      { title: "Session Lock", detail: "Sessions lock after inactivity or on request, requiring re-authentication to resume." },
      { title: "Pattern-Hiding Displays", detail: "Displays conceal previously visible content during session lock." },
      { title: "Automated Session Termination", detail: "Users are automatically logged out locally and remotely at session end or after inactivity." },
      { title: "User-Initiated Logout", detail: "A logout capability displays an explicit message confirming session termination." }
    ],
    sourceControls: ["IAC-20", "IAC-20.1", "IAC-20.2", "IAC-20.3", "IAC-20.4", "IAC-20.5", "IAC-20.6", "IAC-20.7", "IAC-24", "IAC-24.1", "IAC-25", "IAC-25.1", "IAC-14", "IAC-22"],
  },

  "IAC-21": {
    statement:
      "ACME limits access to only what's necessary for assigned tasks — restricting security function access to explicitly authorized privileged users, prohibiting privileged accounts for non-security tasks, requiring management approval for privileged assignment, auditing privileged function use, and limiting remote privileged command execution to compelling operational need.",
    requirements: [
      { title: "Least-Privilege Access", detail: "Access to processes is limited to what's necessary for assigned tasks." },
      { title: "Restricted Security Function Access", detail: "Security function access is limited to explicitly authorized privileged users." },
      { title: "Non-Privileged Use for Non-Security Tasks", detail: "Privileged users don't use privileged accounts for non-security functions." },
      { title: "Management-Approved Privilege Assignment", detail: "Privileged account assignment requires management approval." },
      { title: "Privileged Function Auditing", detail: "Execution of privileged functions is audited." },
      { title: "Non-Privileged Execution Prevention", detail: "Non-privileged users are prevented from executing privileged functions or disabling safeguards." },
      { title: "Restricted Remote Privileged Commands", detail: "Remote privileged command access to critical/sensitive systems requires compelling operational need." },
      { title: "Execution Privilege Limits", detail: "Applications cannot execute at higher privilege levels than the user's own." }
    ],
    sourceControls: ["IAC-21", "IAC-21.1", "IAC-21.2", "IAC-21.3", "IAC-21.4", "IAC-21.5", "IAC-21.6", "IAC-21.7", "IAC-08"],
  },

  "MDM-01": {
    statement:
      "ACME uniquely identifies and authenticates devices via cryptographic, replay-resistant, bidirectional authentication before connection — centrally managing domain-joining as part of asset configuration and preventing key reuse across devices.",
    requirements: [
      { title: "Device AAA", detail: "Devices are uniquely identified and authenticated via cryptographic, replay-resistant bidirectional authentication before connecting." },
      { title: "Device Attestation", detail: "Domain-joining is centrally managed as part of initial asset configuration." },
      { title: "Key Reuse Prevention", detail: "Cryptographic communication keys are enforced to prevent one key from accessing multiple devices." }
    ],
    sourceControls: ["IAC-04", "IAC-04.1", "IAC-04.2", "MDM-01", "MDM-02", "MDM-03", "MDM-05"],
  },

  "DCH-01": {
    statement:
      "ACME protects sensitive and regulated data wherever it is processed or stored, assigning documented data stewardship, maintaining media records sufficient to assess data-loss impact, and explicitly defining access authorizations by individual or role.",
    requirements: [
      { title: "Data Protection Controls", detail: "Data protection controls are implemented." },
      { title: "Data Stewardship", detail: "Data stewardship is assigned, documented, and communicated." },
      { title: "Sensitive Data Protection", detail: "Sensitive/regulated data is protected wherever processed or stored." },
      { title: "Media Impact Records", detail: "Media records for sensitive/regulated data support impact assessment for data loss incidents." },
      { title: "Defined Access Authorizations", detail: "Access to sensitive/regulated data is explicitly authorized by individual or role." },
      { title: "Guided Sharing Decisions", detail: "A process assists users in making appropriately protective information-sharing decisions." },
      { title: "Enforced Search & Retrieval", detail: "Data search and retrieval functions enforce data protection and sharing restrictions." },
      { title: "Transfer Authorization Verification", detail: "Transfer authorizations are verified before data moves between interconnecting systems." },
      { title: "Data Access Mapping", detail: "ACLs or ISAs generate a logical map of parties with whom sensitive data is shared." },
      { title: "ROTT Data Checks", detail: "Data is checked for redundancy, obsolescence, toxicity, or triviality to ensure accuracy and completeness." },
      { title: "PD Correction", detail: "Technical controls correct inaccurate, outdated, or improperly de-identified personal data." },
      { title: "Data Tagging", detail: "Data tags automate tracking of sensitive/regulated data across its lifecycle." },
      { title: "Primary Source Collection", detail: "Personal data is collected directly from the individual." },
      { title: "Dataset Anonymization", detail: "Datasets are anonymized by removing personal data." },
      { title: "Collection-Time De-Identification", detail: "Datasets are de-identified by not collecting PD in the first place where feasible." },
      { title: "Archival Minimization", detail: "PD elements not needed after archiving are not archived." },
      { title: "Release Minimization", detail: "Unnecessary PD elements are removed before dataset release." },
      { title: "Direct Identifier Removal", detail: "Direct identifiers are removed, masked, encrypted, hashed, or replaced." },
      { title: "Statistical Disclosure Control", detail: "Numerical data and statistical findings are manipulated so individuals/organizations aren't identifiable." },
      { title: "Differential Privacy", detail: "Non-deterministic noise is added to mathematical results to prevent PD disclosure." },
      { title: "Validated De-Identification", detail: "Automated de-identification uses validated algorithms and software." },
      { title: "Motivated Intruder Testing", detail: "De-identified datasets are tested against re-identification attempts." },
      { title: "Non-Descriptive Asset Naming", detail: "Mission-critical or highly sensitive assets use unique aliases not tied to product, project, or data type." }
    ],
    sourceControls: ["DCH-01", "DCH-01.1", "DCH-01.2", "DCH-01.3", "DCH-01.4", "DCH-14", "DCH-14.1", "DCH-14.2", "DCH-14.3", "DCH-22", "DCH-22.1", "DCH-22.2", "DCH-22.3", "DCH-23", "DCH-23.1", "DCH-23.2", "DCH-23.3", "DCH-23.4", "DCH-23.5", "DCH-23.6", "DCH-23.7", "DCH-23.8", "DCH-23.9", "DCH-15", "DCH-17"],
  },

  "DCH-02": {
    statement:
      "ACME categorizes data and assets per applicable statutory, regulatory, and contractual requirements, classifying assets according to the highest sensitivity level of data they store, transmit, or process.",
    requirements: [
      { title: "Data & Asset Categorization", detail: "Data and assets are categorized per applicable statutory, regulatory, and contractual requirements." },
      { title: "Highest Classification Level", detail: "Assets are classified per the highest sensitivity level of data involved." },
      { title: "Media Marking", detail: "Media is marked to alert personnel to distribution limitations, handling caveats, and security requirements." },
      { title: "Automated Marking", detail: "Automated marking of physical and digital media aids DLP technologies." }
    ],
    sourceControls: ["DCH-02", "DCH-02.1", "DCH-04", "DCH-04.1", "DCH-11"],
  },

  "DCH-18": {
    statement:
      "ACME retains media and data per statutory, regulatory, and contractual obligations, minimizing sensitive data collected and used in production, research, testing, and training, and periodically checking temporary files for personal data.",
    requirements: [
      { title: "Compliant Retention", detail: "Media and data retention follows applicable statutory, regulatory, and contractual obligations." },
      { title: "Data Minimization", detail: "Sensitive/regulated data collection and use is minimized to necessary business elements." },
      { title: "Limited Test/Research Use", detail: "Sensitive/regulated data use in research, testing, or training is minimized to legitimate practices." },
      { title: "Temporary File Checks", detail: "Temporary files are periodically checked for personal data." }
    ],
    sourceControls: ["DCH-18", "DCH-18.1", "DCH-18.2", "DCH-18.3", "DCH-21"],
  },

  "DCH-09": {
    statement:
      "ACME sanitizes system media commensurate with its classification before disposal, release, or reuse — documenting and verifying sanitization actions, testing sanitization equipment, applying nondestructive sanitization to new portable devices, and requiring dual authorization for destroying sensitive data.",
    requirements: [
      { title: "Restricted Media Access", detail: "Access to digital and non-digital media is restricted to authorized individuals." },
      { title: "Need-to-Know Disclosure", detail: "Sensitive/regulated data disclosure is restricted to authorized parties with a need to know." },
      { title: "Displayed Data Masking", detail: "Data masking is applied to displayed or printed sensitive/regulated information." },
      { title: "Controlled External Release", detail: "Automated validation of protection attributes occurs before releasing information externally." },
      { title: "Controlled Media Storage", detail: "Media is physically controlled, securely stored, and protected until destroyed or sanitized." },
      { title: "Physical Media Security", detail: "All media containing sensitive information is physically secured." },
      { title: "Sensitive Data Inventories", detail: "Sensitive media inventories are maintained and conducted at least annually." },
      { title: "Unstructured Data Scanning", detail: "Unstructured data sources are periodically scanned for sensitive/regulated data." },
      { title: "Unreadable Stored Data", detail: "Sensitive/regulated data is rendered human-unreadable wherever stored." },
      { title: "Authentication Data Restriction", detail: "Storage of sensitive transaction authentication data after authorization is prohibited." },
      { title: "Transport Protection", detail: "Media is protected and controlled during transport outside controlled areas." },
      { title: "Media Custodians", detail: "Custodians are identified throughout media transport." },
      { title: "Encrypted Transport", detail: "Cryptographic mechanisms protect data on digital media during transport." },
      { title: "Classification-Based Sanitization", detail: "Media sanitization strength matches data classification/sensitivity before disposal or reuse." },
      { title: "Sanitization Documentation", detail: "Sanitization and disposal actions are supervised, tracked, documented, and verified." },
      { title: "Equipment Testing", detail: "Sanitization equipment and procedures are tested to verify effectiveness." },
      { title: "Personal Data Sanitization", detail: "Sanitization processes cover personal data." },
      { title: "First-Use Sanitization", detail: "Nondestructive sanitization applies to portable storage devices before first use." },
      { title: "Dual Authorization for Destruction", detail: "Destruction, disposal, or sanitization of sensitive media requires dual authorization." },
      { title: "Restricted Media Types", detail: "Use of digital media types on systems is restricted." },
      { title: "Use Limitations", detail: "Use and distribution of sensitive/regulated data is limited." },
      { title: "Owner Requirement", detail: "Portable storage devices without an identifiable owner are prohibited." }
    ],
    sourceControls: ["DCH-03", "DCH-03.1", "DCH-03.2", "DCH-03.3", "DCH-06", "DCH-06.1", "DCH-06.2", "DCH-06.3", "DCH-06.4", "DCH-06.5", "DCH-07", "DCH-07.1", "DCH-07.2", "DCH-09", "DCH-09.1", "DCH-09.2", "DCH-09.3", "DCH-09.4", "DCH-09.5", "DCH-10", "DCH-10.1", "DCH-10.2", "DCH-08", "DCH-12"],
  },

  "DCH-19": {
    statement:
      "ACME governs how external parties and third-party services store, process, and transmit data — verifying required controls or processing agreements before authorization, restricting portable storage devices on external systems, and protecting sensitive data on non-organizationally owned assets.",
    requirements: [
      { title: "Governed External Use", detail: "Use of external parties and TAAS to store, process, and transmit data is formally governed." },
      { title: "Verified Authorization", detail: "External TAAS use requires verified controls or a processing agreement before authorization." },
      { title: "Restricted Portable Storage", detail: "Portable storage device use on external systems is restricted or prohibited." },
      { title: "External Data Protection", detail: "Sensitive/regulated data on external TAAS meets applicable statutory, regulatory, and contractual protection requirements." },
      { title: "Non-Organizational Asset Restriction", detail: "Use of non-organizationally owned assets to process, store, or transmit organizational information is restricted." },
      { title: "Information Location Documentation", detail: "The location of information and its system components is identified and documented." },
      { title: "Automated Classification Tracking", detail: "Automated tools identify information by classification type to ensure adequate controls are applied." }
    ],
    sourceControls: ["DCH-13", "DCH-13.1", "DCH-13.2", "DCH-13.3", "DCH-13.4", "DCH-24", "DCH-24.1", "DCH-19"],
  },

  "CRY-05": {
    statement:
      "ACME encrypts sensitive and regulated data at rest — on storage media, in databases, and in offline archives — to prevent unauthorized disclosure.",
    requirements: [
      { title: "Standards-Based Cryptography", detail: "Cryptographic protections use known public standards and trusted cryptographic technologies." },
      { title: "Alternate Physical Protection", detail: "Cryptography prevents unauthorized disclosure as an alternative to physical safeguards." },
      { title: "Export Compliance", detail: "Export of cryptographic technologies complies with applicable statutory and regulatory requirements." },
      { title: "Transmission Protection", detail: "Confidentiality and integrity of information are protected before, during, and after transmission." },
      { title: "Communication Concealment", detail: "Cryptographic mechanisms can conceal or randomize communication patterns where required." },
      { title: "Cipher Suite Inventory", detail: "Deployed cryptographic cipher suites and protocols are identified, documented, and reviewed for continued viability." },
      { title: "Data-at-Rest Encryption", detail: "Cryptographic mechanisms prevent unauthorized disclosure of data at rest." },
      { title: "Storage Media Protection", detail: "Confidentiality and integrity of sensitive/regulated data on storage media is cryptographically protected." },
      { title: "Offline Archival", detail: "Unused data is removed from online storage and archived offline securely until disposed of per retention requirements." },
      { title: "Database Encryption", detail: "Database servers use encryption to protect the confidentiality of stored data." }
    ],
    sourceControls: ["CRY-01", "CRY-01.1", "CRY-01.2", "CRY-01.3", "CRY-01.4", "CRY-01.5", "CRY-05", "CRY-05.1", "CRY-05.2", "CRY-05.3", "CRY-06"],
  },

  "CRY-09": {
    statement:
      "ACME manages the full lifecycle of symmetric and asymmetric cryptographic keys using FIPS-compliant technology and processes, ensuring keys are bound to individual owners, securely distributed, recoverable if lost, and appropriately controlled when shared with third parties or stored on external systems.",
    requirements: [
      { title: "Secure PKI", detail: "PKI is securely implemented internally or obtained from a reputable PKI service provider." },
      { title: "Key Loss Resiliency", detail: "Resiliency mechanisms ensure data availability in the event cryptographic keys are lost." },
      { title: "Key Management Program", detail: "Cryptographic key management controls protect the confidentiality, integrity, and availability of keys." },
      { title: "Symmetric Key Management", detail: "Symmetric keys are produced and managed using FIPS-compliant technology and processes." },
      { title: "Asymmetric Key Management", detail: "Asymmetric keys are produced and managed using FIPS-compliant technology, protecting the user's private key." },
      { title: "Key Loss Recovery", detail: "Information remains available in the event a user's cryptographic keys are lost." },
      { title: "Secure Key Distribution", detail: "Symmetric and asymmetric keys are securely distributed using industry-recognized key management technology." },
      { title: "Assigned Key Ownership", detail: "Cryptographic keys are bound to individual identities." },
      { title: "Third-Party Key Guidance", detail: "Customers receive appropriate key management guidance when cryptographic keys are shared." },
      { title: "External System Key Control", detail: "Control is maintained over cryptographic keys for encrypted material stored or transmitted through external systems." }
    ],
    sourceControls: ["CRY-08", "CRY-08.1", "CRY-09", "CRY-09.1", "CRY-09.2", "CRY-09.3", "CRY-09.4", "CRY-09.5", "CRY-09.6", "CRY-09.7", "CRY-02"],
  },

  "PRI-01": {
    statement:
      "ACME operates a formal data privacy program led by a Chief Privacy Officer and Data Protection Officer, ensuring personal data is processed lawfully, fairly, and transparently — governed by binding corporate rules, appointed data fiduciaries and process managers, and strict limits on disclosure and financial incentives tied to personal data.",
    requirements: [
      { title: "Data Privacy Program", detail: "Data protection controls operate throughout the data lifecycle to ensure lawful, fair, and transparent PD processing." },
      { title: "Chief Privacy Officer", detail: "A CPO (or similar) coordinates, develops, and implements data privacy requirements and manages privacy risk." },
      { title: "Privacy Act Statements", detail: "Individuals receive formal notice covering collection authority, mandatory/optional status, purpose, disclosures, and consequences of non-provision." },
      { title: "Public Program Transparency", detail: "The public can access information about data privacy practices and communicate with the CPO, with notice of changes." },
      { title: "Data Protection Officer", detail: "A qualified DPO is involved in all issues related to PD handling." },
      { title: "Binding Corporate Rules", detail: "BCRs legally bind parties in joint economic activity regarding data subject rights." },
      { title: "PD Security Safeguards", detail: "Logical and physical safeguards protect the confidentiality and integrity of PD." },
      { title: "Limited PD Disclosure", detail: "PD disclosure is limited to authorized parties for the purpose it was obtained." },
      { title: "Data Fiduciary", detail: "An individual determines PD purpose, authorized collection methods, and authorized sharing parties." },
      { title: "PD Process Manager", detail: "Accountability is assigned to ensure PD handling matches data subject consent." },
      { title: "Financial Incentive Governance", detail: "Financial incentives offered for PD comply with legal and regulatory requirements." },
      { title: "Reasonable Privacy Practices", detail: "PD collection and use is limited to what's necessary and proportionate to reasonable consumer expectations." },
      { title: "Processing Activity Documentation", detail: "PD processing activities are documented in sufficient detail to demonstrate conformity with obligations." },
      { title: "Accounting of Disclosures", detail: "Subjects receive an accounting of PD disclosures by ACME and relevant third parties." },
      { title: "Legal Disclosure Notification", detail: "Subjects are notified of applicable legal requests to disclose their PD." }
    ],
    sourceControls: ["PRI-01", "PRI-01.1", "PRI-01.2", "PRI-01.3", "PRI-01.4", "PRI-01.5", "PRI-01.6", "PRI-01.7", "PRI-01.8", "PRI-01.9", "PRI-01.10", "PRI-01.11", "PRI-14", "PRI-14.1", "PRI-14.2", "PRI-08"],
  },

  "PRI-02": {
    statement:
      "ACME provides clear, accessible data privacy notices at first interaction and periodically thereafter — specifying purpose, scope, and third-party recipients of PD processing, offering real-time and accessible-format notices, ensuring symmetric and non-manipulative choice architecture, and maintaining required regulatory filings like SORNs and CMAs.",
    requirements: [
      { title: "Available & Clear Notices", detail: "Privacy notices are available at first interaction, clear, and cover all required scope and retained in prior versions." },
      { title: "Purpose Specification", detail: "Notices identify the purpose(s) for PD collection and use." },
      { title: "Automated Authorization Updates", detail: "Data collection/processing automatically adjusts based on updated data subject authorization." },
      { title: "Computer Matching Agreements", detail: "CMAs are published on the public website where applicable." },
      { title: "System of Records Notices", detail: "SORNs are drafted, published, and kept current per regulatory guidance, with periodic review of routine uses and claimed exemptions." },
      { title: "Real-Time/Layered Notice", detail: "Real-time or layered notice summarizes key points at the point of PD collection." },
      { title: "Purpose Compatibility Review", detail: "Disclosed purposes are periodically assessed against reasonable consumer expectations." },
      { title: "Accessible Notice Formatting", detail: "Notices accommodate accessibility needs (screen size, language, disability)." },
      { title: "Symmetric Choice", detail: "Protective options are not harder or slower to select than less-protective options." },
      { title: "Non-Manipulative Choice Architecture", detail: "Choice architecture avoids impairing informed consumer decisions, and is tested for that effect." },
      { title: "Right to Limit Notice", detail: "Notices disclose the right to limit use/disclosure of sensitive PD and how to exercise it." },
      { title: "Alternative Notice Delivery", detail: "Privacy notice is available through means other than a website or app interface." },
      { title: "Informed Consent", detail: "Data subjects authorize PD processing after receiving plain-language risk disclosure and a way to decline." },
      { title: "Tailored Consent", detail: "Data subjects can modify permissions for selected PD attributes." },
      { title: "Just-In-Time Re-Consent", detail: "Updated consent is requested when original consent circumstances have changed or significant time has passed." },
      { title: "Sale/Sharing Prohibition", detail: "PD sale, processing, or sharing is prevented when instructed by the subject or when the subject is a legally protected minor." },
      { title: "Consent Revocation", detail: "Data subjects can revoke consent for PD processing." },
      { title: "Non-Discrimination", detail: "Subjects exercising consent rights are not denied products/services or charged differently." },
      { title: "Authorized Agent", detail: "Subjects may authorize an agent to make PD processing decisions on their behalf." },
      { title: "Active Consent Selection", detail: "Subjects actively select their appropriate consent level (opt-in, opt-out, etc.)." },
      { title: "Global Privacy Control", detail: "Automated mechanisms honor pre-selected opt-out signals." },
      { title: "Governed Continued Use", detail: "Continued PD use is governed until disposal, retention expiry, or consent withdrawal." },
      { title: "Cessation on Revocation", detail: "PD processing ceases upon consent revocation." },
      { title: "Processing Change Communication", detail: "Subjects are notified of erasure, correction, or restriction affecting their PD." },
      { title: "Opt-In Consent", detail: "Explicit opt-in consent is obtained for PD collection, processing, and sharing actions." },
      { title: "Parental Consent for Minors", detail: "Parental or guardian consent is obtained for minors' PD processing." }
    ],
    sourceControls: ["PRI-02", "PRI-02.1", "PRI-02.2", "PRI-02.3", "PRI-02.4", "PRI-02.5", "PRI-02.6", "PRI-02.7", "PRI-02.8", "PRI-02.9", "PRI-02.10", "PRI-02.11", "PRI-02.12", "PRI-02.13", "PRI-02.14", "PRI-03", "PRI-03.1", "PRI-03.2", "PRI-03.3", "PRI-03.4", "PRI-03.5", "PRI-03.6", "PRI-03.7", "PRI-03.8", "PRI-03.9", "PRI-03.10", "PRI-03.11", "PRI-03.12", "PRI-03.13"],
  },

  "PRI-04": {
    statement:
      "ACME minimizes personal data collection to what's adequate and relevant to its stated purpose, collecting directly from data subjects where possible, validating and re-validating accuracy, and documenting the legal authority behind every collection activity.",
    requirements: [
      { title: "Minimized Collection", detail: "PD collection is limited to what is adequate, relevant, and limited to the identified purpose, with minor protections." },
      { title: "Documented Legal Authority", detail: "The legal authority permitting PD collection/processing is determined and documented." },
      { title: "Primary Source Collection", detail: "Information is collected directly from the data subject whenever possible." },
      { title: "Identifiable Image Restriction", detail: "Photo/video collection that can identify individuals is restricted to legitimate business needs." },
      { title: "Indirect Collection Notice", detail: "Subjects are promptly informed of the purpose when PD is acquired indirectly." },
      { title: "Collection Validation", detail: "Data subjects validate PD accuracy during collection." },
      { title: "Collection Re-Validation", detail: "Data subjects re-validate that previously collected PD remains accurate." },
      { title: "Compliant Collection Methods", detail: "Collection methods are lawful, appropriate, unambiguous, and secure." },
      { title: "Data Quality Management", detail: "Quality, utility, objectivity, integrity, and de-identification of sensitive data are managed across the lifecycle." },
      { title: "Automated Quality Evaluation", detail: "Automated mechanisms support data quality evaluation." },
      { title: "Bias Evaluation", detail: "Analytical processes are evaluated for potential bias." },
      { title: "Documented Update Process", detail: "The process(es) and frequency used to update PD are identified and recorded." },
      { title: "Subject-Enabled Updates", detail: "Data subjects can update their own PD." }
    ],
    sourceControls: ["PRI-04", "PRI-04.1", "PRI-04.2", "PRI-04.3", "PRI-04.4", "PRI-04.5", "PRI-04.6", "PRI-04.7", "PRI-10", "PRI-10.1", "PRI-10.2", "PRI-12", "PRI-12.1"],
  },

  "PRI-05": {
    statement:
      "ACME retains personal data only as long as needed to fulfill its stated purpose or legal requirement, securely disposing of it thereafter — maintaining a current PD inventory, masking sensitive data where appropriate, and restricting use strictly to originally disclosed purposes.",
    requirements: [
      { title: "Retention & Secure Disposal", detail: "PD is retained for a defined period and securely disposed of, destroyed, erased, or anonymized thereafter." },
      { title: "Limited Internal Use", detail: "Use of PD for internal testing, training, and research is minimized and authorized." },
      { title: "Accuracy & Integrity", detail: "PD is kept up to date and inaccuracies are remediated." },
      { title: "Data Masking", detail: "Sensitive/regulated data is masked via anonymization, pseudonymization, redaction, or de-identification." },
      { title: "Usage Restriction", detail: "PD use is restricted to originally disclosed and authorized purposes." },
      { title: "PD Inventory", detail: "A current inventory tracks all systems that handle PD." },
      { title: "Automated Inventory Support", detail: "Automated mechanisms determine whether PD is maintained in electronic form." },
      { title: "Category-Specific Handling", detail: "Handling and protection requirements are defined for specific sensitive PD categories." },
      { title: "Identifiability Limits", detail: "PD is retained in identifiable form no longer than necessary for legitimate purposes." }
    ],
    sourceControls: ["PRI-05", "PRI-05.1", "PRI-05.2", "PRI-05.3", "PRI-05.4", "PRI-05.5", "PRI-05.6", "PRI-05.7", "PRI-05.8"],
  },

  "PRI-06": {
    statement:
      "ACME enables authenticated data subjects to access, correct, port, and erase their personal data, appeal adverse decisions, and receive responsive handling of their privacy requests, verifying identity before acting on any disclosure or change.",
    requirements: [
      { title: "Data Subject Access Rights", detail: "Authenticated subjects can access their PD, its sources, categories, and request correction, erasure, or restriction." },
      { title: "Correction Process", detail: "Inaccurate PD can be corrected or amended, with corrections disseminated to other authorized users." },
      { title: "Correction Notification", detail: "Subjects are notified when their PD is corrected, amended, or deleted." },
      { title: "Appeal Process", detail: "Subjects can appeal adverse decisions." },
      { title: "Feedback Management", detail: "Requests, complaints, and questions about PD handling are efficiently addressed." },
      { title: "Right to Erasure", detail: "A process erases a subject's PD per applicable legal and contractual retention obligations." },
      { title: "Data Portability", detail: "PD exports use a structured, machine-readable, portable format." },
      { title: "PD Export", detail: "A subject's available PD is exported in a usable format upon authenticated request." },
      { title: "Identity Verification", detail: "Data subject identity is verified before disclosing, sharing, correcting, or deleting PD." },
      { title: "Consent-Based Disclosure", detail: "PD is disclosed to third parties only for notice-identified purposes and with data subject consent." },
      { title: "Contractual Privacy Requirements", detail: "Contracts with contractors/service providers establish data privacy roles and responsibilities." },
      { title: "Joint Processing Clarity", detail: "ACME's role in joint PD processing within the data ecosystem is clearly defined and communicated." },
      { title: "Third-Party Change Notification", detail: "Third parties are informed of modifications, deletions, or changes affecting shared PD." },
      { title: "Untrustworthy Request Rejection", detail: "Unauthenticated or untrustworthy disclosure requests are rejected." },
      { title: "Abusive Request Rejection", detail: "Harassing, repetitive, or fraudulent access requests are rejected with justification." },
      { title: "Clear Communications", detail: "Disclosures and communications to data subjects are concise, unambiguous, and understandable." },
      { title: "Conspicuous Privacy Notice Link", detail: "A visible link to the privacy notice appears on consumer-facing websites and apps." },
      { title: "Financial Incentive Notice", detail: "Subjects receive notice explaining the material terms of any financial incentive or price/service difference." },
      { title: "Communications Documentation", detail: "Records of data subject requests and responses are retained per an established schedule." },
      { title: "Communications Metrics", detail: "Metrics on data subject requests and responses are collected." },
      { title: "Public Metrics Disclosure", detail: "Required communications metrics are publicly disclosed per statutory/regulatory obligation." }
    ],
    sourceControls: ["PRI-06", "PRI-06.1", "PRI-06.2", "PRI-06.3", "PRI-06.4", "PRI-06.5", "PRI-06.6", "PRI-06.7", "PRI-06.8", "PRI-07", "PRI-07.1", "PRI-07.2", "PRI-07.3", "PRI-07.4", "PRI-07.5", "PRI-17", "PRI-17.1", "PRI-17.2", "PRI-17.3", "PRI-17.4", "PRI-17.5", "PRI-18"],
  },

  "CFG-01": {
    statement:
      "ACME operates a formal configuration management program that enforces segregation of duties, preventing developers from performing production configuration management activities.",
    requirements: [
      { title: "Configuration Management Controls", detail: "Configuration management controls are formally implemented." },
      { title: "Segregation of Duties", detail: "Developers are prevented from performing production configuration management duties." },
      { title: "License Compliance", detail: "Software usage restrictions comply with applicable contract agreements and copyright laws." },
      { title: "Open Source Parameters", detail: "Parameters govern the secure use of open source software." },
      { title: "Approved Software Only", detail: "Only approved internet browsers and email clients are permitted to run on systems." },
      { title: "Install Restriction", detail: "Non-privileged users are restricted from installing unauthorized software." },
      { title: "Unauthorized Install Alerts", detail: "Systems generate alerts when unauthorized software installation is detected." },
      { title: "Privileged Install Only", detail: "Software installation is prevented unless performed by a privileged user or service." },
      { title: "Access Restriction", detail: "Systems are configured to restrict access to sensitive/regulated data." },
      { title: "Data Action Logging", detail: "Automated event logs are generated whenever sensitive/regulated data is collected, created, updated, deleted, or archived." }
    ],
    sourceControls: ["CFG-01", "CFG-01.1", "CFG-04", "CFG-04.1", "CFG-04.2", "CFG-05", "CFG-05.1", "CFG-05.2", "CFG-08", "CFG-08.1"],
  },

  "CFG-02": {
    statement:
      "ACME develops, documents, and maintains secure baseline configurations for its technology assets, applications, and services in line with industry hardening standards — reviewed at least annually, centrally verified through automated tooling, versioned to support rollback, tailored for high-risk areas and development/test environments, and treated as a security incident when changed without authorization.",
    requirements: [
      { title: "Documented Secure Baselines", detail: "Secure baseline configurations are developed, documented, and maintained per industry hardening standards." },
      { title: "Periodic Review", detail: "Baselines are reviewed and updated at least annually, when required, and during installations/upgrades." },
      { title: "Automated Central Verification", detail: "Automated tooling (e.g., Continuous Diagnostics and Mitigation) governs and reports on baseline configuration compliance." },
      { title: "Rollback Capability", detail: "Previous baseline configuration versions are retained to support rollback." },
      { title: "Dev/Test Separation", detail: "Development and test environment baselines are managed separately from production baselines." },
      { title: "High-Risk Area Hardening", detail: "Assets in high-risk areas use more restrictive baseline configurations." },
      { title: "Network Device Sync", detail: "Network devices synchronize startup and running configuration files." },
      { title: "Approved Deviations", detail: "Deviations from standardized configurations are documented, risk-assessed, and formally approved or denied." },
      { title: "Unauthorized Change Response", detail: "Unauthorized configuration changes are treated and responded to as security incidents." },
      { title: "Baseline Tailoring", detail: "Baseline controls can be tailored to mission/business function, operating environment, or specific threats." }
    ],
    sourceControls: ["CFG-02", "CFG-02.1", "CFG-02.2", "CFG-02.3", "CFG-02.4", "CFG-02.5", "CFG-02.6", "CFG-02.7", "CFG-02.8", "CFG-02.9"],
  },

  "CFG-03": {
    statement:
      "ACME configures systems to provide only essential capabilities, explicitly restricting unnecessary ports, protocols, services, and software execution, with periodic review to disable anything no longer needed.",
    requirements: [
      { title: "Minimal Capability Configuration", detail: "Systems are configured to provide only essential capabilities; unnecessary ports, protocols, and services are prohibited or restricted." },
      { title: "Periodic Review", detail: "System configurations are periodically reviewed to identify and disable unnecessary or non-secure functions." },
      { title: "Unauthorized Software Prevention", detail: "Systems are configured to prevent execution of unauthorized software." },
      { title: "Allow/Deny Listing", detail: "Applications are explicitly allowlisted or denylisted for execution." },
      { title: "Split Tunneling Control", detail: "Split tunneling for remote devices is prevented unless securely provisioned." }
    ],
    sourceControls: ["CFG-03", "CFG-03.1", "CFG-03.2", "CFG-03.3", "CFG-03.4"],
  },

  "CHG-02": {
    statement:
      "ACME governs technical configuration changes through a formal change control process that requires approval, testing, security review, and cryptographic asset oversight before changes reach production, with automated remediation for unauthorized changes.",
    requirements: [
      { title: "Change Governance", detail: "Technical configuration change control processes are formally governed." },
      { title: "Authorized Changes Only", detail: "Unauthorized changes are prohibited; only organization-approved change requests may proceed." },
      { title: "Test & Validate", detail: "Proposed changes are tested and documented in a non-production environment before implementation." },
      { title: "Security Representative Review", detail: "A cybersecurity/data protection representative participates in the change control review process." },
      { title: "Automated Remediation", detail: "Automated mechanisms remediate unauthorized baseline configuration changes upon detection." },
      { title: "Cryptographic Asset Governance", detail: "Assets providing cryptographic protections are governed according to the organization's configuration management processes." },
      { title: "Change Access Restriction", detail: "Configuration restrictions limit which users may make unauthorized changes." },
      { title: "After-the-Fact Auditing", detail: "Configuration change logs are reviewed after the fact to discover unauthorized changes." },
      { title: "Signed Components", detail: "Software and firmware components are verified as digitally signed by an approved certificate authority before installation." },
      { title: "Dual Authorization", detail: "Changes to critical technology assets, applications, or services require a two-person rule." },
      { title: "Limited Change Privileges", detail: "Operational privileges for implementing changes are limited to those with a business need." },
      { title: "Library Privilege Restriction", detail: "Software library privileges are restricted to individuals with a pertinent business need." },
      { title: "Post-Change Verification", detail: "Control functionality is verified following implemented changes to confirm controls operate as designed." },
      { title: "Management Reporting", detail: "Verification results are reported to appropriate organizational management." }
    ],
    sourceControls: ["CHG-02", "CHG-02.1", "CHG-02.2", "CHG-02.3", "CHG-02.4", "CHG-02.5", "CHG-04", "CHG-04.1", "CHG-04.2", "CHG-04.3", "CHG-04.4", "CHG-04.5", "CHG-06", "CHG-06.1", "CHG-03"],
  },

  "CLD-01": {
    statement:
      "ACME governs the security of cloud services across their full lifecycle, from onboarding — ensuring new cloud instances meet organizational, statutory, regulatory, and contractual standards — through offboarding, ensuring data is securely migrated or archived at decommissioning.",
    requirements: [
      { title: "Cloud Management Controls", detail: "Cloud instances are secured in line with industry practices through documented cloud management controls." },
      { title: "Secure Onboarding", detail: "Cloud services are designed and configured to meet applicable organizational, statutory, regulatory, and contractual standards before go-live." },
      { title: "Secure Offboarding", detail: "Decommissioned cloud services securely transition or archive data per organizational, statutory, regulatory, and contractual requirements." }
    ],
    sourceControls: ["CLD-01", "CLD-01.1", "CLD-01.2", "CLD-02", "CLD-09", "CLD-11"],
  },

  "CLD-04": {
    statement:
      "ACME secures interoperability between system components through managed Application Programming Interfaces (APIs), including a controlled API gateway entry point between client-facing requests and backend services.",
    requirements: [
      { title: "Secure API Interoperability", detail: "Mechanisms ensure secure interoperability between components exposed via APIs." },
      { title: "API Gateway", detail: "An API gateway (or equivalent) serves as a controlled entry point managing client-facing requests to backend services." }
    ],
    sourceControls: ["CLD-04", "CLD-04.1"],
  },

  "CLD-06": {
    statement:
      "ACME designs and governs multi-tenant environments so that tenant access is appropriately segmented, responsibilities between ACME and its customers are formally documented, and event logging, forensics, and incident response capabilities are available across the multi-tenant boundary.",
    requirements: [
      { title: "Tenant Segmentation", detail: "Multi-tenant assets are designed and governed so tenant user access is appropriately segmented from other tenants." },
      { title: "Customer Responsibility Matrix", detail: "A formal Customer Responsibility Matrix documents the division of security, compliance, and resilience responsibilities between ACME and its customers." },
      { title: "Multi-Tenant Event Logging", detail: "Security event logging capabilities are available to customers consistent with applicable obligations." },
      { title: "Multi-Tenant Forensics", detail: "Prompt forensic investigation capabilities are available in the event of a suspected or confirmed incident." },
      { title: "Multi-Tenant Incident Response", detail: "Prompt incident response, including timely customer notification, is available for suspected or confirmed incidents and vulnerabilities." }
    ],
    sourceControls: ["CLD-06", "CLD-06.1", "CLD-06.2", "CLD-06.3", "CLD-06.4", "CLD-12"],
  },

  "MON-01": {
    statement:
      "ACME operates enterprise-wide continuous monitoring — combining network and host-based intrusion detection/prevention, SIEM-driven real-time analysis, wireless and file-integrity monitoring, and enhanced oversight of privileged users and higher-risk individuals — to maintain integrated situational awareness and drive automated, prioritized response to security events.",
    requirements: [
      { title: "Enterprise-Wide Monitoring", detail: "Monitoring controls are implemented across the enterprise." },
      { title: "Intrusion Detection/Prevention", detail: "IDS/IPS technologies protect critical systems, key network segments, and choke points." },
      { title: "Real-Time Analysis Tooling", detail: "A SIEM (or similar) supports near real-time analysis and incident escalation." },
      { title: "Traffic Monitoring", detail: "Inbound and outbound communications traffic is continuously monitored for unusual or unauthorized activity." },
      { title: "Integrated Alerting", detail: "Alerts from physical, cybersecurity, data protection, and supply chain activities are generated, correlated, and responded to." },
      { title: "Wireless Monitoring", detail: "Wireless segments are monitored for rogue devices and anomalous or hostile activity." },
      { title: "Host-Based Detection", detail: "HIDS/HIPS actively alert on or block unwanted activity and feed the SIEM." },
      { title: "File Integrity Monitoring", detail: "FIM (or similar) generates alerts for unauthorized modifications to critical assets." },
      { title: "Event Log Review", detail: "Event logs are reviewed on an ongoing basis with incidents escalated per established procedures." },
      { title: "Proxy Logging", detail: "Internet-bound requests are logged to identify prohibited activity and support incident handling." },
      { title: "Deactivated Account Monitoring", detail: "Deactivated accounts are monitored for attempted use." },
      { title: "Automated Response", detail: "Pre-determined corrective actions are automatically implemented for security-relevant events." },
      { title: "Automated Alerts", detail: "Incident response personnel are automatically alerted to anomalous activity." },
      { title: "Threshold Tuning", detail: "Monitoring technologies are tuned based on traffic and event pattern analysis." },
      { title: "Elevated-Risk Individual Monitoring", detail: "Enhanced monitoring applies to individuals identified as higher risk." },
      { title: "Privileged User Oversight", detail: "Enhanced monitoring applies to privileged users." },
      { title: "Prioritized Monitoring", detail: "Monitoring needs are assessed and prioritized based on asset criticality and data sensitivity." },
      { title: "Real-Time Session Monitoring", detail: "Authorized personnel can view/hear live session content per organizational and legal requirements." },
      { title: "Report Generation Capability", detail: "Event log reports aid detection and assessment of anomalous activity." },
      { title: "Personal Data Query Auditing", detail: "Query parameters against personal data sets are auditable." },
      { title: "Trend Analysis", detail: "Trend analyses determine whether control implementations or monitoring activities need modification." },
      { title: "Exfiltration/Disclosure Monitoring", detail: "Evidence of unauthorized exfiltration or disclosure of non-public information is monitored." },
      { title: "Covert Exfiltration Detection", detail: "Network traffic is analyzed to detect covert data exfiltration." },
      { title: "Unauthorized Service Detection", detail: "Unauthorized network services are detected and alerted to incident response." },
      { title: "Indicators of Compromise", detail: "Indicators of Compromise (IoC) are identified and alerted on." },
      { title: "Behavioral Anomaly Detection", detail: "UEBA/UAM solutions detect and respond to anomalous behavior indicating compromise or malicious activity." },
      { title: "Insider Threat Monitoring", detail: "Internal personnel activity is monitored for potential security incidents." },
      { title: "Third-Party Threat Monitoring", detail: "Third-party personnel activity is monitored for potential security incidents." },
      { title: "Unauthorized Activity Monitoring", detail: "Unauthorized activities, accounts, connections, devices, and software are monitored." },
      { title: "Privileged Account Change Logging", detail: "Permission changes to privileged accounts/groups are automatically logged." }
    ],
    sourceControls: ["MON-01", "MON-01.1", "MON-01.2", "MON-01.3", "MON-01.4", "MON-01.5", "MON-01.6", "MON-01.7", "MON-01.8", "MON-01.9", "MON-01.10", "MON-01.11", "MON-01.12", "MON-01.13", "MON-01.14", "MON-01.15", "MON-01.16", "MON-01.17", "MON-06", "MON-06.1", "MON-06.2", "MON-11", "MON-11.1", "MON-11.2", "MON-11.3", "MON-16", "MON-16.1", "MON-16.2", "MON-16.3", "MON-16.4", "MON-15"],
  },

  "MON-02": {
    statement:
      "ACME centrally collects, correlates, and reviews security event logs through a SIEM (or similar), integrating vulnerability scanning, network performance, physical access, and audit data into a time-correlated, organization-wide audit trail, with audit depth adjusted based on evolving threat intelligence.",
    requirements: [
      { title: "Centralized Log Collection", detail: "A SIEM (or similar) centrally collects security-related event logs." },
      { title: "Cross-Enterprise Correlation", detail: "Technical and non-technical information is correlated to enhance situational awareness." },
      { title: "Central Review & Analysis", detail: "Audit records from multiple sources are centrally collected, reviewed, and analyzed." },
      { title: "Integrated Monitoring Analysis", detail: "Audit record analysis integrates vulnerability scanning, network performance, and system monitoring data." },
      { title: "Physical Access Correlation", detail: "Audit records are correlated with physical access monitoring data." },
      { title: "Permitted Actions", detail: "Permitted actions for users and systems regarding audit review, analysis, and reporting are specified." },
      { title: "Threat-Based Audit Adjustment", detail: "Audit review/analysis/reporting depth adjusts based on evolving threat intelligence." },
      { title: "Organization-Wide Audit Trail", detail: "Audit records compile into a time-correlated, organization-wide audit trail." },
      { title: "Authorized Audit Changes", detail: "Privileged users can adjust auditing on specified components within defined criteria and time thresholds." },
      { title: "Logged Asset Inventory", detail: "A current inventory tracks which technology assets are being logged." },
      { title: "Log Failure Response", detail: "Personnel are alerted and remediation occurs when log processing fails." },
      { title: "24x7 Real-Time Alerting", detail: "Near real-time alerting operates continuously for log processing failures." },
      { title: "Storage Capacity Alerting", detail: "Automated alerts fire when event log storage approaches maximum capacity." }
    ],
    sourceControls: ["MON-02", "MON-02.1", "MON-02.2", "MON-02.3", "MON-02.4", "MON-02.5", "MON-02.6", "MON-02.7", "MON-02.8", "MON-02.9", "MON-05", "MON-05.1", "MON-05.2"],
  },

  "MON-03": {
    statement:
      "ACME configures its systems to produce event logs capturing what happened, when, where, the source, the outcome, and the associated user — protecting sensitive log data, limiting personal data captured, verbosely logging network boundary traffic, and ensuring database activity is fully auditable.",
    requirements: [
      { title: "Minimum Log Content", detail: "Event logs capture event type, timestamp, location, source, outcome, and associated user identity." },
      { title: "Sensitive Log Data Protection", detail: "Sensitive/regulated data within log files is protected." },
      { title: "User-Linked Audit Trails", detail: "System access is linked to individual users or service accounts." },
      { title: "Privileged Function Logging", detail: "Actions of users/services with elevated privileges are logged and reviewed." },
      { title: "Boundary Device Verbosity", detail: "All traffic (allowed and blocked) at network boundary devices is verbosely logged." },
      { title: "Personal Data Minimization", detail: "Personal data in audit records is limited to elements identified in the Data Privacy Risk Assessment." },
      { title: "Centralized Log Content Management", detail: "Criteria for what's captured in event logs are centrally managed and updated." },
      { title: "Database Logging", detail: "Databases produce audit records sufficient to monitor database activity." },
      { title: "Authoritative Time Source", detail: "Event log timestamps derive from an authoritative time source." },
      { title: "Clock Synchronization", detail: "Internal system clocks are synchronized with the authoritative time source." }
    ],
    sourceControls: ["MON-03", "MON-03.1", "MON-03.2", "MON-03.3", "MON-03.4", "MON-03.5", "MON-03.6", "MON-03.7", "MON-07", "MON-07.1"],
  },

  "MON-08": {
    statement:
      "ACME protects event logs and audit tools from unauthorized access, modification, and deletion — backing them up to physically separate systems, cryptographically protecting their integrity, restricting management access to privileged users with a business need, and requiring dual authorization to move or delete them.",
    requirements: [
      { title: "Event Log Protection", detail: "Event logs and audit tools are protected from unauthorized access, modification, and deletion." },
      { title: "Separate Backup Systems", detail: "Event logs are backed up onto a physically different system than the SIEM." },
      { title: "Restricted Management Access", detail: "Event log management access is restricted to privileged users with a specific business need." },
      { title: "Cryptographic Integrity", detail: "Cryptographic mechanisms protect the integrity of event logs and audit tools." },
      { title: "Dual Authorization for Movement", detail: "Dual authorization is enforced for moving or deleting event logs." }
    ],
    sourceControls: ["MON-08", "MON-08.1", "MON-08.2", "MON-08.3", "MON-08.4", "MON-10"],
  },

  "THR-01": {
    statement:
      "ACME maintains situational awareness of vulnerabilities and evolving threats by consuming external threat intelligence feeds and translating attacker tactics, techniques, and procedures into organization-specific alerts, advisories, and preventative or compensating controls.",
    requirements: [
      { title: "Threat Intelligence Consumption", detail: "External threat intelligence feeds are monitored to maintain awareness of attacker tactics, techniques, and procedures relevant to ACME." },
      { title: "Internal Alerting & Advisories", detail: "Threat intelligence is translated into organization-specific security alerts, advisories, and directives, and disseminated to relevant teams." },
      { title: "Control Response", detail: "Preventative and compensating controls are adjusted based on the threat intelligence received." },
      { title: "Vulnerability Disclosure Program", detail: "A formal VDP is established to receive unsolicited vulnerability reports from the public." },
      { title: "Published Disclosure Contact", detail: "Security disclosure contact information is published and maintained so external parties can submit vulnerability reports." },
      { title: "Triage & Response", detail: "Reports received through the VDP are triaged and fed into remediation workflows." }
    ],
    sourceControls: ["THR-03", "THR-03.1", "THR-06", "THR-06.1", "THR-01", "THR-02", "THR-04", "THR-09", "THR-10"],
  },

  "OPS-01": {
    statement:
      "ACME operates security-relevant systems and processes according to standardized, documented operating procedures, ensuring day-to-day operational tasks are performed consistently and securely regardless of who executes them.",
    requirements: [
      { title: "Operational Security Controls", detail: "Security controls governing day-to-day operations are implemented and maintained." },
      { title: "Standardized Operating Procedures", detail: "Standardized Operating Procedures (SOPs) are documented for assigned operational tasks to ensure consistent, secure execution." }
    ],
    sourceControls: ["OPS-01", "OPS-01.1", "OPS-02", "OPS-03", "OPS-05"],
  },

  "END-01": {
    statement:
      "ACME manages all endpoint devices through a centralized Unified Endpoint Device Management (UEDM) solution, providing agent or agentless oversight of endpoints regardless of location.",
    requirements: [
      { title: "Endpoint Device Management", detail: "Endpoint Device Management (EDM) controls are formally implemented." },
      { title: "Unified Centralized Management", detail: "A centralized UEDM solution manages endpoint devices regardless of location, agent-based or agentless." },
      { title: "Privileged Install Enforcement", detail: "Automated mechanisms prohibit software installation without explicitly assigned privileged status." },
      { title: "Installation Alerts", detail: "Alerts are generated when new software is detected." },
      { title: "Governed Change Access", detail: "Access restrictions for changes to technology assets, applications, and services are defined, documented, approved, and enforced." },
      { title: "Restricted Security Functions", detail: "Security functions are restricted to authorized individuals under least-privilege requirements." },
      { title: "Host-Based Isolation", detail: "Software separation mechanisms isolate security functions at the host level." }
    ],
    sourceControls: ["END-01", "END-01.1", "END-03", "END-03.1", "END-03.2", "END-16", "END-16.1"],
  },

  "END-02": {
    statement:
      "ACME deploys centrally managed anti-malware technology across endpoints, combining signature-based and heuristic detection, always-on real-time protection that non-privileged users cannot disable, automatic signature updates, and regular testing and evaluation to keep pace with evolving malware threats.",
    requirements: [
      { title: "Anti-Malware Deployment", detail: "Anti-malware technologies detect and eradicate malicious code." },
      { title: "Automatic Signature Updates", detail: "Antimalware signature definitions are automatically updated." },
      { title: "Documented Protection Measures", detail: "Antimalware technologies and their configuration are documented." },
      { title: "Centralized Management", detail: "Antimalware technologies are centrally managed." },
      { title: "Heuristic Detection", detail: "Heuristic/nonsignature-based detection capabilities are used alongside signature-based detection." },
      { title: "Protection Testing", detail: "Antimalware technologies are tested using known benign test cases, verifying both detection and incident reporting." },
      { title: "Evolving Threat Evaluation", detail: "Periodic evaluations assess systems not commonly considered malware targets against evolving threats." },
      { title: "Always-On Protection", detail: "Anti-malware runs continuously in real time and cannot be disabled or altered by non-privileged users absent case-by-case management authorization." }
    ],
    sourceControls: ["END-04", "END-04.1", "END-04.2", "END-04.3", "END-04.4", "END-04.5", "END-04.6", "END-04.7", "END-02", "END-05"],
  },

  "END-06": {
    statement:
      "ACME monitors endpoint and boot-process integrity using File Integrity Monitoring, Endpoint Detection & Response, and Extended Detection & Response technologies, automatically alerting and remediating when unauthorized configuration or firmware changes are detected.",
    requirements: [
      { title: "File Integrity Monitoring", detail: "FIM (or similar) detects and reports unauthorized changes to selected files and configuration settings." },
      { title: "Integrity Checking", detail: "Software and firmware configurations are validated through integrity checking." },
      { title: "Endpoint Detection & Response", detail: "Unauthorized configuration changes are detected and responded to as cybersecurity incidents." },
      { title: "Automated Alerting", detail: "Automated mechanisms alert incident response personnel upon discovering integrity discrepancies." },
      { title: "Automated Remediation", detail: "Automated mechanisms remediate discovered integrity violations." },
      { title: "Boot Process Integrity", detail: "The integrity of the system boot process is automatically verified." },
      { title: "Boot Firmware Protection", detail: "Boot firmware integrity is automatically protected." },
      { title: "Untrusted Code Restriction", detail: "Binary or machine-executable code from sources with limited/no warranty and no source-code access is prohibited." },
      { title: "Extended Detection & Response", detail: "XDR technologies correlate data and respond to threats across endpoints, on-prem and cloud networks, communications, applications, and services." }
    ],
    sourceControls: ["END-06", "END-06.1", "END-06.2", "END-06.3", "END-06.4", "END-06.5", "END-06.6", "END-06.7", "END-06.8", "END-07"],
  },

  "END-08": {
    statement:
      "ACME centrally manages anti-phishing and spam protection technologies across email, keeping them automatically updated in accordance with change management practices.",
    requirements: [
      { title: "Anti-Phishing & Spam Protection", detail: "Technologies detect and act on unsolicited email messages." },
      { title: "Central Management", detail: "Anti-phishing and spam protection technologies are centrally managed." },
      { title: "Automatic Updates", detail: "Protection technologies are automatically updated per configuration and change management practices." }
    ],
    sourceControls: ["END-08", "END-08.1", "END-08.2", "END-09"],
  },

  "VPM-01": {
    statement:
      "ACME operates a formal Vulnerability & Patch Management Program with a clearly defined and managed scope for its attack surface management activities.",
    requirements: [
      { title: "VPM Program", detail: "Vulnerability management controls are implemented and monitored." },
      { title: "Attack Surface Scope", detail: "The scope of attack surface management activities is defined and managed." },
      { title: "Vulnerability Risk Ranking", detail: "Newly discovered vulnerabilities are ranked using reputable outside sources." },
      { title: "Exploitation Analysis", detail: "Potential impact and likelihood of internal/external threats exploiting known vulnerabilities are identified, assessed, prioritized, and documented." },
      { title: "Continuous Remediation", detail: "New threats and vulnerabilities are addressed on an ongoing basis to protect against known attacks." },
      { title: "Stable Versions", detail: "The latest stable software and security updates are installed on applicable systems." },
      { title: "Personal Data Flaw Remediation", detail: "Flaws affecting the collection, use, processing, or dissemination of personal data are identified and corrected." },
      { title: "Deferred Patching Decisions", detail: "Patch deferrals are permitted only when the disadvantages of applying the patch outweigh the benefits." }
    ],
    sourceControls: ["VPM-01", "VPM-01.1", "VPM-03", "VPM-03.1", "VPM-04", "VPM-04.1", "VPM-04.2", "VPM-04.3", "VPM-02"],
  },

  "VPM-05": {
    statement:
      "ACME centrally manages software and firmware patching across all deployed assets — tracking remediation effectiveness against defined benchmarks, automating deployment and version cleanup where feasible, pre-testing updates in non-production, supporting out-of-cycle patches for urgent issues, and verifying patch integrity and source trust.",
    requirements: [
      { title: "Comprehensive Patching", detail: "Software patching, including firmware, is conducted for all deployed technology assets, applications, and services." },
      { title: "Centralized Flaw Remediation", detail: "The flaw remediation process is centrally managed." },
      { title: "Automated Remediation Status", detail: "Automated mechanisms determine the flaw-remediation state of system components." },
      { title: "Remediation Benchmarks", detail: "Remediation effectiveness is tracked through metrics reporting against time-to-remediate benchmarks." },
      { title: "Automated Updates", detail: "Automated mechanisms install the latest stable security-relevant software and firmware updates." },
      { title: "Version Cleanup", detail: "Old software and firmware versions are removed after updated versions are installed." },
      { title: "Pre-Deployment Testing", detail: "Software and firmware update stability is verified through non-production testing before deployment." },
      { title: "Out-of-Cycle Patching", detail: "Out-of-cycle updates address time-sensitive remediations." },
      { title: "Patch Integrity & Source Trust", detail: "Patches are obtained from trusted sources and checked for integrity." }
    ],
    sourceControls: ["VPM-05", "VPM-05.1", "VPM-05.2", "VPM-05.3", "VPM-05.4", "VPM-05.5", "VPM-05.6", "VPM-05.7", "VPM-05.8"],
  },

  "VPM-06": {
    statement:
      "ACME routinely scans systems and applications for vulnerabilities and misconfigurations — internally and externally, quarterly at minimum — using regularly updated tools with defined breadth and depth of coverage, privileged access where needed, trend analysis, historical log review, and correlation of scan results to detect multi-vulnerability attack paths.",
    requirements: [
      { title: "Routine Vulnerability Scanning", detail: "Systems and applications are routinely scanned for vulnerabilities and configuration errors." },
      { title: "Tool Updates", detail: "Vulnerability scanning tools are kept up to date." },
      { title: "Defined Coverage", detail: "The breadth and depth of scanning coverage (components scanned, vulnerability types checked) is defined." },
      { title: "Privileged Scanning Access", detail: "Privileged access authorization is implemented for selected scanning activities." },
      { title: "Trend Analysis", detail: "Automated mechanisms compare scan results over time to identify vulnerability trends." },
      { title: "Historical Log Review", detail: "Historical event logs are reviewed to determine whether identified vulnerabilities were previously exploited." },
      { title: "External Scanning", detail: "Quarterly external vulnerability scans are performed via a reputable provider, with rescans until high vulnerabilities are resolved (CVSS-defined)." },
      { title: "Internal Scanning", detail: "Quarterly internal vulnerability scans cover all internal network segments, with rescans until high vulnerabilities are resolved." },
      { title: "Acceptable Discoverable Information", detail: "Information allowed to be discoverable by adversaries is defined, with corrective action for non-compliant assets." },
      { title: "Scan Correlation", detail: "Automated mechanisms correlate scanning output to detect multi-vulnerability or multi-hop attack vectors." }
    ],
    sourceControls: ["VPM-06", "VPM-06.1", "VPM-06.2", "VPM-06.3", "VPM-06.4", "VPM-06.5", "VPM-06.6", "VPM-06.7", "VPM-06.8", "VPM-06.9"],
  },

  "VPM-07": {
    statement:
      "ACME conducts penetration testing on its technology assets, applications, and services using an independent assessor or penetration team not involved in their development or operation.",
    requirements: [
      { title: "Penetration Testing", detail: "Penetration testing is conducted on technology assets, applications, and services." },
      { title: "Independent Testing Team", detail: "An independent assessor or penetration team performs the testing." }
    ],
    sourceControls: ["VPM-07", "VPM-07.1"],
  },

  "IRO-01": {
    statement:
      "ACME documents, monitors, and reports incident status to internal stakeholders through resolution, maintaining an incident repository and using automated tracking and recurring pattern analysis to identify trends and common root causes.",
    requirements: [
      { title: "Incident Status Reporting", detail: "Incident status is documented, monitored, and reported to internal stakeholders through resolution." },
      { title: "Automated Tracking & Analysis", detail: "Automated mechanisms track, collect, and analyze information from actual and potential incidents." },
      { title: "Recurring Incident Review", detail: "Incident response activities are periodically reviewed for recurring incidents." },
      { title: "Incident Repository", detail: "A repository documents incident details, remediation actions, and root cause analysis summaries." },
      { title: "Pattern Analysis", detail: "Historical incidents are analyzed in aggregate to identify patterns, trends, and common root causes." }
    ],
    sourceControls: ["IRO-09", "IRO-09.1", "IRO-09.2", "IRO-09.3", "IRO-09.4", "IRO-01", "IRO-07"],
  },

  "IRO-02": {
    statement:
      "ACME handles security incidents through a full lifecycle of preparation, detection, analysis, containment, eradication, and recovery — supported by automation, dynamic reconfiguration, insider threat response, incident classification, cross-organization coordination, and automatic isolation of affected assets for forensic analysis.",
    requirements: [
      { title: "Full Incident Lifecycle", detail: "Incident handling covers preparation, detection/intake, analysis, containment, eradication, and recovery." },
      { title: "Automated Incident Handling", detail: "Automated mechanisms support the incident handling process." },
      { title: "Insider Threat Response", detail: "An insider threat program is implemented and governed." },
      { title: "Dynamic Reconfiguration", detail: "System components can be dynamically reconfigured as part of incident response." },
      { title: "Incident Classification", detail: "Incident classes and corresponding actions are defined to sustain organizational missions and functions." },
      { title: "External Coordination", detail: "Approved third parties are coordinated with for cross-organization incident awareness and response." },
      { title: "Automatic Asset Isolation", detail: "Affected assets are automatically disabled upon detection of a qualifying incident to enable forensic analysis." },
      { title: "Forensics & Chain of Custody", detail: "Digital forensics and chain-of-custody integrity are maintained per applicable law and industry practice." },
      { title: "Licensed Investigators", detail: "Licensed forensic investigators perform analysis intended for evidentiary or legal use." },
      { title: "Data Spill Response", detail: "Mechanisms exist to respond to sensitive/regulated data spills." },
      { title: "Assigned Responsibility", detail: "Personnel or roles are formally assigned responsibility for spill response." },
      { title: "Spill Response Training", detail: "Incident response training covers sensitive/regulated data spillage response." },
      { title: "Operational Continuity", detail: "Impacted personnel can continue assigned tasks while contaminated assets undergo corrective action." },
      { title: "Inadvertent Exposure Safeguards", detail: "Security safeguards address personnel exposed to sensitive/regulated data outside their access authorization." }
    ],
    sourceControls: ["IRO-02", "IRO-02.1", "IRO-02.2", "IRO-02.3", "IRO-02.4", "IRO-02.5", "IRO-02.6", "IRO-08", "IRO-08.1", "IRO-12", "IRO-12.1", "IRO-12.2", "IRO-12.3", "IRO-12.4"],
  },

  "IRO-04": {
    statement:
      "ACME maintains a current, viable Incident Response Plan available to all stakeholders — addressing data breach obligations, regularly updated with lessons learned and industry developments, and continuously improved using qualitative and quantitative testing data.",
    requirements: [
      { title: "Incident Response Plan", detail: "A current, viable IRP is maintained and made available to all stakeholders." },
      { title: "Data Breach Response", detail: "Data breaches and unauthorized disclosure incidents are addressed per applicable laws, regulations, and contracts." },
      { title: "Plan Currency", detail: "The IRP is regularly reviewed and updated to reflect lessons learned, process changes, and industry developments." },
      { title: "Continuous Improvement", detail: "Testing data drives continuous improvement of incident response processes and produces accurate, reproducible metrics." },
      { title: "Role-Based IR Training", detail: "Personnel are trained in their incident response roles and responsibilities." },
      { title: "Simulated Incidents", detail: "Simulated events are incorporated into training to build effective crisis response." },
      { title: "Automated Training Environments", detail: "Automated mechanisms provide more thorough, realistic incident response training." }
    ],
    sourceControls: ["IRO-04", "IRO-04.1", "IRO-04.2", "IRO-04.3", "IRO-05", "IRO-05.1", "IRO-05.2"],
  },

  "IRO-06": {
    statement:
      "ACME formally tests its incident response capabilities through realistic exercises coordinated with related organizational plans, to determine operational effectiveness.",
    requirements: [
      { title: "Realistic IR Testing", detail: "Incident response capabilities are formally tested through realistic exercises to determine effectiveness." },
      { title: "Coordination with Related Plans", detail: "Testing is coordinated with organizational elements responsible for related plans." }
    ],
    sourceControls: ["IRO-06", "IRO-06.1"],
  },

  "IRO-10": {
    statement:
      "ACME timely reports incidents to internal stakeholders, affected clients and third parties, and regulatory authorities — using automation to support reporting, covering sensitive data incidents, related vulnerabilities, supply chain notification, and serious incidents requiring mandatory regulatory disclosure.",
    requirements: [
      { title: "Timely Stakeholder Reporting", detail: "Incidents are reported in a timely manner to internal stakeholders, affected clients/third parties, and regulators." },
      { title: "Automated Reporting Support", detail: "Automated mechanisms assist in incident reporting." },
      { title: "Sensitive Data Incident Reporting", detail: "Sensitive/regulated data incidents are reported in a timely manner." },
      { title: "Related Vulnerability Reporting", detail: "System vulnerabilities associated with reported incidents are reported to defined personnel or roles." },
      { title: "Supply Chain Notification", detail: "Incident information is provided to relevant technology providers and supply chain organizations." },
      { title: "Mandatory Regulatory Reporting", detail: "Serious incidents are reported to relevant authorities per mandatory requirements and timelines." },
      { title: "User Incident Assistance", detail: "Users receive advice and assistance for handling and reporting incidents." },
      { title: "Automated Support Availability", detail: "Automated mechanisms increase the availability of incident response information and support." },
      { title: "External Provider Coordination", detail: "A direct, cooperative relationship exists between ACME's incident response function and external service providers." }
    ],
    sourceControls: ["IRO-10", "IRO-10.1", "IRO-10.2", "IRO-10.3", "IRO-10.4", "IRO-10.5", "IRO-11", "IRO-11.1", "IRO-11.2", "IRO-13", "IRO-14"],
  },

  "BCD-01": {
    statement:
      "ACME implements contingency planning through Continuity of Operations Plans and BC/DR playbooks, coordinated with internal, external, and vendor plans, executed against defined Recovery Time and Point Objectives, with clear criteria to trigger activation and communicate recovery status to stakeholders.",
    requirements: [
      { title: "Contingency Planning", detail: "Contingency planning controls (COOP, BC/DR playbooks) ensure resilient technology assets." },
      { title: "Related Plan Coordination", detail: "Contingency plan development is coordinated with internal and external stakeholders responsible for related plans." },
      { title: "External Provider Coordination", detail: "Internal contingency plans are coordinated with external service providers' contingency plans." },
      { title: "Personnel Redeployment", detail: "Personnel can be redeployed to other roles during a disruptive event or continuity plan execution." },
      { title: "RTO/RPO-Based Recovery", detail: "Recovery operations meet defined Recovery Time Objectives and Recovery Point Objectives." },
      { title: "Activation Criteria", detail: "Specific criteria are defined for initiating BC/DR plans capable of meeting RTOs/RPOs." },
      { title: "Recovery Communications", detail: "Recovery status and progress are communicated to designated internal and external stakeholders." },
      { title: "Formal BC/DR Plans", detail: "Process owners maintain formal BC/DR plans detailed and accurate enough to sustain or restore operations under adverse conditions." },
      { title: "Critical Asset Identification", detail: "Critical TAASD supporting essential missions and business functions are identified and documented." },
      { title: "Full Mission Resumption", detail: "All missions and business functions resume within contingency plan RTOs." },
      { title: "Continuity of Essential Functions", detail: "Essential missions continue with little or no operational loss through full restoration." },
      { title: "Essential Function Resumption", detail: "Essential missions resume within a defined time period of contingency activation." },
      { title: "Data Storage Location Review", detail: "Storage locations containing sensitive/regulated data undergo periodic security review." },
      { title: "Contingency Plan Updates", detail: "Plans are updated for changes to people, processes, technology, data, facilities, or testing feedback." },
      { title: "Impact Component Identification", detail: "Components that could impact contingency plan execution are identified." },
      { title: "Stakeholder Notification", detail: "Stakeholders are kept informed of contingency plan changes." }
    ],
    sourceControls: ["BCD-01", "BCD-01.1", "BCD-01.2", "BCD-01.3", "BCD-01.4", "BCD-01.5", "BCD-01.6", "BCD-01.7", "BCD-02", "BCD-02.1", "BCD-02.2", "BCD-02.3", "BCD-02.4", "BCD-06", "BCD-06.1", "BCD-06.2"],
  },

  "BCD-04": {
    statement:
      "ACME tests and exercises its contingency plans to evaluate effectiveness and readiness, coordinating with related plans and testing at alternate storage/processing sites.",
    requirements: [
      { title: "Contingency Role Training", detail: "Contingency personnel and stakeholders are trained in their roles and responsibilities." },
      { title: "Simulated Events", detail: "Simulated events are incorporated into training for effective crisis response." },
      { title: "Automated Training Environments", detail: "Automated mechanisms provide more thorough, realistic contingency training." },
      { title: "Contingency Plan Testing", detail: "Tests and exercises evaluate contingency plan effectiveness and organizational readiness." },
      { title: "Coordinated Testing", detail: "Testing is coordinated with internal and external elements responsible for related plans." },
      { title: "Alternate Site Testing", detail: "Testing occurs at alternate storage and processing sites to familiarize personnel and evaluate site capability." }
    ],
    sourceControls: ["BCD-03", "BCD-03.1", "BCD-03.2", "BCD-04", "BCD-04.1", "BCD-04.2", "BCD-05"],
  },

  "BCD-08": {
    statement:
      "ACME maintains an alternate storage site — separated from the primary site to avoid shared threat exposure — with the assets and agreements necessary to store and recover backup information, and mitigates potential accessibility problems during area-wide disruptions.",
    requirements: [
      { title: "Alternate Storage Site", detail: "An alternate storage site with assets and agreements supports backup storage and recovery." },
      { title: "Primary Site Separation", detail: "The alternate storage site is separated from the primary site to reduce shared threat exposure." },
      { title: "Accessibility Mitigation", detail: "Potential accessibility problems to the alternate site during area-wide disruption are identified and mitigated." },
      { title: "Equivalent Alternate Site", detail: "An alternate processing site provides security measures equivalent to the primary site." },
      { title: "Priority of Service", detail: "Alternate site service agreements address priority-of-service provisions supporting RTOs." },
      { title: "Preparedness for Use", detail: "The alternate site is prepared to support essential missions as a primary site." },
      { title: "Primary Site Loss Planning", detail: "Plans address scenarios preventing return to the primary site." },
      { title: "Reduced Single Points of Failure", detail: "Primary telecommunications services avoid single points of failure." },
      { title: "Priority-of-Service Agreements", detail: "Primary and alternate telecom agreements include priority-of-service provisions supporting RTOs." },
      { title: "Provider Separation", detail: "Alternate telecom providers are separated from primary providers to reduce shared threat exposure." },
      { title: "Provider Contingency Requirement", detail: "External providers are contractually required to maintain contingency plans meeting ACME's requirements." },
      { title: "Alternate Communication Channels", detail: "Command and control is maintained via alternate channels with designated alternate decision-makers." }
    ],
    sourceControls: ["BCD-08", "BCD-08.1", "BCD-08.2", "BCD-09", "BCD-09.1", "BCD-09.2", "BCD-09.3", "BCD-09.4", "BCD-09.5", "BCD-10", "BCD-10.1", "BCD-10.2", "BCD-10.3", "BCD-10.4", "BCD-07"],
  },

  "BCD-11": {
    statement:
      "ACME creates and verifies recurring backups of data, software, and system images to meet Recovery Time and Point Objectives — storing critical backups separately, cryptographically protecting them, restricting access and destruction authority to authorized roles, and routinely testing restoration reliability and integrity.",
    requirements: [
      { title: "Recurring Verified Backups", detail: "Backups of data, software, and system images are created and integrity-verified to meet RTOs/RPOs." },
      { title: "Reliability Testing", detail: "Backups are routinely tested to verify process reliability and data integrity/availability." },
      { title: "Separate Critical Storage", detail: "Critical software and security-related backup copies are stored in a separate, fire-rated, non-collocated facility." },
      { title: "Recovery Images", detail: "Assets are reimaged from configuration-controlled, integrity-protected images representing a secure operational state." },
      { title: "Cryptographic Backup Protection", detail: "Cryptographic mechanisms prevent unauthorized disclosure or modification of backup information." },
      { title: "Sampled Restoration Testing", detail: "Sampling of available backups tests recovery capability during BC/DR plan testing." },
      { title: "Alternate Site Transfer", detail: "Backup data transfers to the alternate storage site at a rate meeting RTOs/RPOs." },
      { title: "Redundant Failover", detail: "A non-collocated failover capability activates with little to no data loss or disruption." },
      { title: "Dual Authorization for Destruction", detail: "Deletion or destruction of sensitive backup media/data requires dual authorization." },
      { title: "Restricted Backup Access", detail: "Backup access is restricted to privileged users with assigned backup/recovery roles." },
      { title: "Restricted Modification/Destruction", detail: "Modifying or deleting backups is restricted to privileged users with assigned backup/recovery roles." },
      { title: "Backup Hardware Protection", detail: "Backup and restoration hardware and software are protected." },
      { title: "Restoration Integrity Verification", detail: "The integrity of backups and restoration assets is verified before use." }
    ],
    sourceControls: ["BCD-11", "BCD-11.1", "BCD-11.2", "BCD-11.3", "BCD-11.4", "BCD-11.5", "BCD-11.6", "BCD-11.7", "BCD-11.8", "BCD-11.9", "BCD-11.10", "BCD-13", "BCD-13.1"],
  },

  "BCD-12": {
    statement:
      "ACME securely recovers and reconstitutes technology assets, applications, and services to a known state after disruption, compromise, or failure — supporting transaction recovery, real-time failover, eDiscovery, and restoration within defined time periods from integrity-protected baselines.",
    requirements: [
      { title: "Secure Recovery & Reconstitution", detail: "Assets are securely recovered and reconstituted to a known state after disruption, compromise, or failure." },
      { title: "Transaction Recovery", detail: "Specialized backup mechanisms enable transaction recovery meeting RPOs." },
      { title: "Failover Capability", detail: "Real-time or near-real-time failover maintains availability of critical assets." },
      { title: "eDiscovery", detail: "Electronic discovery covers current and archived communication transactions." },
      { title: "Time-Bound Restoration", detail: "Assets are restored within defined time periods from configuration-controlled, integrity-protected information." }
    ],
    sourceControls: ["BCD-12", "BCD-12.1", "BCD-12.2", "BCD-12.3", "BCD-12.4"],
  },

  "PES-01": {
    statement:
      "ACME operates physical and environmental protection controls governed by a documented Physical Security Plan and a zone-based approach to physical access.",
    requirements: [
      { title: "Physical & Environmental Controls", detail: "Physical and environmental protection controls are operated." },
      { title: "Physical Security Plan", detail: "A documented PSP summarizes implemented controls, applicable risks, and threats." },
      { title: "Zone-Based Security", detail: "Physical security is implemented using a zone-based approach." },
      { title: "Limited-Access Area Identification", detail: "Systems, equipment, and environments requiring limited physical access are identified and controlled." },
      { title: "Authorized-Only Secure Areas", detail: "Only authorized personnel may access secure areas." },
      { title: "Personnel & Effects Searches", detail: "Personnel and personal effects are inspected to prevent unauthorized exfiltration." },
      { title: "Secure Package Storage", detail: "Undelivered packages are stored in a locked, access-controlled, monitored area." },
      { title: "Power Equipment Protection", detail: "Power equipment and cabling are protected from damage and destruction." },
      { title: "Automatic Voltage Control", detail: "Automatic voltage controls protect critical system components." },
      { title: "Emergency Shutoff", detail: "Emergency power shutoff is accessible to personnel and protected from unauthorized activation." },
      { title: "Emergency Power", detail: "Alternate power maintains minimally required operations during extended primary power loss." },
      { title: "Emergency Lighting", detail: "Automatic emergency lighting covers exits and evacuation routes during outages." },
      { title: "Water Damage Protection", detail: "Accessible master shutoff valves protect against water leakage damage." },
      { title: "Automated Leak Detection", detail: "Water presence near critical systems is detected and alerted to maintenance and IT personnel." },
      { title: "Redundant Cabling", detail: "Physically separated redundant power cabling maintains power flow if one path is damaged." },
      { title: "Fire Suppression & Detection", detail: "Fire suppression and detection systems are supported by an independent energy source." },
      { title: "Automatic Fire Detection", detail: "Detection devices activate automatically and notify personnel and emergency responders." },
      { title: "Automatic Suppression Notification", detail: "Suppression system activation automatically notifies personnel and emergency responders." },
      { title: "Unstaffed Facility Suppression", detail: "Automatic fire suppression covers critical systems when the facility is not continuously staffed." },
      { title: "Environmental Monitoring", detail: "Temperature and humidity levels within the facility are maintained and monitored." },
      { title: "Harmful Change Alerting", detail: "Alarms or notifications trigger for temperature/humidity changes potentially harmful to personnel or equipment." },
      { title: "Hazard-Minimizing Siting", detail: "Components are located to minimize damage from hazards and unauthorized access opportunity." },
      { title: "Transmission Medium Security", detail: "Power and telecommunications cabling is protected from interception, interference, or damage." },
      { title: "Output Device Access Control", detail: "Access to printers and other output devices is restricted to prevent unauthorized retrieval." }
    ],
    sourceControls: ["PES-01", "PES-01.1", "PES-01.2", "PES-04", "PES-04.1", "PES-04.2", "PES-04.3", "PES-07", "PES-07.1", "PES-07.2", "PES-07.3", "PES-07.4", "PES-07.5", "PES-07.6", "PES-07.7", "PES-08", "PES-08.1", "PES-08.2", "PES-08.3", "PES-09", "PES-09.1", "PES-12", "PES-12.1", "PES-12.2", "PES-13", "PES-15"],
  },

  "PES-03": {
    statement:
      "ACME enforces physical access authorizations at all facility entry/exit points, logging every access attempt, protecting system components with lockable casings, and applying additional controls for critical systems and sensitive data.",
    requirements: [
      { title: "Authorized Access List", detail: "A current list of personnel authorized for physical facility access is maintained." },
      { title: "Role-Based Physical Access", detail: "Physical access is authorized based on the individual's position or role." },
      { title: "Dual Authorization for Sensitive Areas", detail: "A two-person rule with separate credentials governs access to highly sensitive areas." },
      { title: "Physical Access Enforcement", detail: "Physical access authorizations are enforced at all controlled facility access points." },
      { title: "Controlled Ingress/Egress", detail: "Access is limited and monitored through controlled entry and exit points." },
      { title: "Lockable Component Protection", detail: "System components are protected from unauthorized physical access via lockable casings." },
      { title: "Physical Access Logging", detail: "A log entry is generated for each access attempt at controlled points." },
      { title: "Critical System Access Controls", detail: "Additional physical access controls apply to critical systems and sensitive/regulated data beyond facility-level controls." },
      { title: "Physical Incident Monitoring", detail: "Physical security incidents are monitored for, detected, and responded to." },
      { title: "Intrusion Alarms & Surveillance", detail: "Physical intrusion alarms and surveillance equipment are monitored." },
      { title: "Critical System Access Monitoring", detail: "Physical access to critical systems and sensitive/regulated data is monitored beyond facility-level monitoring." },
      { title: "Visitor Identification & Authorization", detail: "Visitors are identified, authorized, and monitored before facility access." },
      { title: "Visitor/Personnel Distinction", detail: "Visitors are easily distinguishable from onsite personnel, especially near sensitive data." },
      { title: "Photo ID Requirement", detail: "At least one government- or organization-issued photo ID authenticates visitors before access." },
      { title: "Restricted Unescorted Access", detail: "Unescorted access is restricted to personnel with required clearances and validated need." },
      { title: "Automated Record Review", detail: "Automated mechanisms maintain and review visitor access records." },
      { title: "Visitor Data Minimization", detail: "Personal data collected in visitor records is minimized." },
      { title: "Badge Revocation", detail: "Visitor badges are surrendered or automatically deactivated at a predetermined expiration." }
    ],
    sourceControls: ["PES-02", "PES-02.1", "PES-02.2", "PES-03", "PES-03.1", "PES-03.2", "PES-03.3", "PES-03.4", "PES-05", "PES-05.1", "PES-05.2", "PES-06", "PES-06.1", "PES-06.2", "PES-06.3", "PES-06.4", "PES-06.5", "PES-06.6", "PES-10", "PES-11"],
  },

  "MNT-01": {
    statement:
      "ACME conducts and documents maintenance activities across the lifecycle of its technology assets, applications, and services, using automated scheduling and tracking wherever feasible.",
    requirements: [
      { title: "Lifecycle Maintenance Control", detail: "Maintenance activities are controlled throughout the asset lifecycle." },
      { title: "Automated Scheduling & Documentation", detail: "Automated mechanisms schedule, conduct, and document maintenance and repairs." },
      { title: "RTO-Bound Maintenance Support", detail: "Maintenance support and spare parts are obtained within a defined Recovery Time Objective (RTO)." },
      { title: "Preventive Maintenance", detail: "Preventive maintenance is performed on critical technology assets, applications, and services." },
      { title: "Predictive Maintenance", detail: "Predictive maintenance is performed on critical technology assets, applications, and services." },
      { title: "Automated Predictive Data Transfer", detail: "Predictive maintenance data is automatically transferred to a computerized maintenance management system." }
    ],
    sourceControls: ["MNT-02", "MNT-02.1", "MNT-03", "MNT-03.1", "MNT-03.2", "MNT-03.3", "MNT-01"],
  },

  "MNT-05": {
    statement:
      "ACME authorizes, monitors, and controls remote maintenance and diagnostic activity through pre-approval and scheduling, stakeholder notification, cryptographically protected and session-isolated connections, audited sessions, verified disconnection, and security capabilities comparable to the system being serviced.",
    requirements: [
      { title: "Tool & Media Control", detail: "The use of system maintenance tools is controlled and monitored." },
      { title: "Tool Inspection", detail: "Maintenance tools carried into a facility are inspected for improper or unauthorized modification." },
      { title: "Media Inspection", detail: "Media containing diagnostic and test programs is checked for malicious code before use." },
      { title: "Removal Prevention", detail: "Removal of equipment under maintenance that contains organizational information is prevented or controlled." },
      { title: "Restricted Tool Usage", detail: "Automated mechanisms restrict maintenance tool use to authorized personnel and roles." },
      { title: "Authorization & Control", detail: "Remote, non-local maintenance and diagnostic activities are authorized, monitored, and controlled." },
      { title: "Session Auditing", detail: "Remote maintenance sessions are audited, and the actions performed during them are reviewed." },
      { title: "Stakeholder Notification", detail: "Affected stakeholders are notified when remote maintenance is planned." },
      { title: "Cryptographic Protection", detail: "Cryptographic mechanisms protect the integrity and confidentiality of remote maintenance communications." },
      { title: "Disconnect Verification", detail: "Remote disconnect verification ensures maintenance sessions are properly terminated." },
      { title: "Pre-Approval & Scheduling", detail: "Maintenance personnel must obtain pre-approval and scheduling before remote sessions." },
      { title: "Comparable Security & Session Separation", detail: "Systems performing remote maintenance implement security comparable to the serviced system, with sessions replay-resistant and physically or logically separated from other network traffic." }
    ],
    sourceControls: ["MNT-04", "MNT-04.1", "MNT-04.2", "MNT-04.3", "MNT-04.4", "MNT-05", "MNT-05.1", "MNT-05.2", "MNT-05.3", "MNT-05.4", "MNT-05.5", "MNT-05.6", "MNT-05.7"],
  },

  "NET-01": {
    statement:
      "ACME develops, governs, and updates network security control procedures under a Zero Trust Architecture — treating all users and devices as potential threats until properly authenticated and authorized.",
    requirements: [
      { title: "NSC Procedures", detail: "Network Security Control procedures are developed, governed, and updated." },
      { title: "Zero Trust Architecture", detail: "Users and devices are treated as potential threats and denied access until authenticated and authorized." },
      { title: "Layered Security Functions", detail: "Security functions are implemented as a layered structure minimizing inter-layer dependency." },
      { title: "DoS Protection", detail: "Automated mechanisms protect against or limit denial-of-service attack effects." },
      { title: "Secure Guest Networks", detail: "Guest networks are implemented and managed securely." },
      { title: "Cross Domain Solution", detail: "A CDS mitigates security risks of transferring information between security domains." },
      { title: "Interconnection Security Agreements", detail: "ISAs document interface characteristics, requirements, and information nature for each interconnection." },
      { title: "External Connection Boundary Protection", detail: "Sensitive systems cannot directly connect to external networks without a boundary protection device." },
      { title: "Authorized Internal Connections", detail: "Internal system connections are authorized and documented with interface characteristics and requirements." },
      { title: "NIDS/NIPS Deployment", detail: "Network intrusion detection/prevention systems detect and prevent network intrusions." },
      { title: "DMZ Monitoring", detail: "DMZ segments separate and monitor untrusted from trusted networks." },
      { title: "Wireless IDS/IPS", detail: "WIDS/WIPS protect wireless network segments." },
      { title: "Host Containment", detail: "Automated mechanisms revoke or quarantine a compromised host's network access." },
      { title: "Resource Containment", detail: "Automated mechanisms remove or quarantine a resource's access to other resources." },
      { title: "Session Authenticity & Integrity", detail: "Communication session authenticity and integrity are protected." },
      { title: "Session Invalidation at Logout", detail: "Session identifiers are invalidated upon logout or termination." },
      { title: "Unique Session Identifiers", detail: "Each session receives a unique, system-generated identifier." }
    ],
    sourceControls: ["NET-01", "NET-01.1", "NET-02", "NET-02.1", "NET-02.2", "NET-02.3", "NET-05", "NET-05.1", "NET-05.2", "NET-08", "NET-08.1", "NET-08.2", "NET-08.3", "NET-08.4", "NET-09", "NET-09.1", "NET-09.2", "NET-07"],
  },

  "NET-03": {
    statement:
      "ACME monitors and controls communications at external and key internal network boundaries — limiting concurrent connections, managing external telecom interfaces, preventing exfiltration and internal information disclosure, sandboxing untrusted components, and isolating critical systems into separate security-domain subnets.",
    requirements: [
      { title: "Boundary Monitoring & Control", detail: "Communications at external and internal network boundaries are monitored and controlled." },
      { title: "Connection Limits", detail: "Concurrent external network connections are limited." },
      { title: "Managed External Interfaces", detail: "Each external telecom service has a managed interface protecting confidentiality and integrity." },
      { title: "Internal Information Protection", detail: "Public disclosure of internal network information is prevented." },
      { title: "PD Network Rules", detail: "Network-based processing rules apply to personal data elements." },
      { title: "Exfiltration Prevention", detail: "Automated mechanisms prevent unauthorized exfiltration of sensitive data across managed interfaces." },
      { title: "Dynamic Sandboxing", detail: "Untrusted components are dynamically isolated in a fault-contained environment during runtime." },
      { title: "Critical System Isolation", detail: "Boundary protections isolate assets supporting critical missions and functions." },
      { title: "Security Domain Subnetting", detail: "Separate subnets connect systems in different security domains." }
    ],
    sourceControls: ["NET-03", "NET-03.1", "NET-03.2", "NET-03.3", "NET-03.4", "NET-03.5", "NET-03.6", "NET-03.7", "NET-03.8"],
  },

  "NET-06": {
    statement:
      "ACME segments its network architecture to isolate assets — using security management subnets, VLAN separation, dedicated secure zones for sensitive data with restricted connectivity and internet access, and dynamic microsegmentation via software-defined networking.",
    requirements: [
      { title: "ACL-Based Flow Enforcement", detail: "ACLs restrict network traffic to only what is explicitly authorized." },
      { title: "Deny-by-Default", detail: "Firewalls and routers deny traffic by default and allow only by exception." },
      { title: "Security Attribute-Based Flow Control", detail: "Security attributes on objects inform flow control decisions." },
      { title: "Encrypted Content Checking", detail: "Encrypted data cannot bypass content-checking mechanisms." },
      { title: "Embedded Data Restrictions", detail: "Limitations are enforced on embedding data within other data types." },
      { title: "Metadata-Based Flow Control", detail: "Information flow controls incorporate metadata." },
      { title: "Human Rule Review", detail: "ACLs and similar rulesets undergo routine human review." },
      { title: "Policy Decision Point", detail: "Automated evaluation dynamically and uniformly enforces access rights against established criteria." },
      { title: "Data Type Validation", detail: "Data type identifiers validate information transferred between security domains." },
      { title: "Policy Subcomponent Decomposition", detail: "Information is decomposed into policy-relevant subcomponents for cross-domain enforcement." },
      { title: "Unsanctioned Format Detection", detail: "Security policy filters restrict data structure and content for cross-domain transfers." },
      { title: "Approved Transfer Solutions", detail: "Information is examined for unsanctioned content and blocked from cross-domain transfer if found." },
      { title: "Cross-Domain Authentication", detail: "Source and destination points for information transfer are uniquely identified and authenticated." },
      { title: "Metadata Validation", detail: "Cybersecurity/data protection filters apply to metadata." },
      { title: "Application Proxy", detail: "Application traffic is terminated, inspected, controlled, and reinitiated regardless of user location or network posture." },
      { title: "Network Segmentation", detail: "Network architecture isolates assets from other network resources via segmentation." },
      { title: "Security Management Subnets", detail: "Security tools are isolated on separate managed subnetworks." },
      { title: "VLAN Separation", detail: "VLANs limit direct device communication and lateral movement." },
      { title: "Secure Data Enclaves", detail: "Segmentation restricts inbound/outbound connectivity for sensitive data enclaves." },
      { title: "Enclave Service Segregation", detail: "Secure zones receive enclave-specific IT services separate from corporate IT resources." },
      { title: "Restricted Internet Access", detail: "Internet access from secure zones is prohibited or strictly controlled." },
      { title: "Microsegmentation", detail: "Automated microsegmentation divides the network per application and data workflow needs." },
      { title: "Software-Defined Networking", detail: "SDN enables dynamic, policy-driven segmentation, access control, and traffic management." }
    ],
    sourceControls: ["NET-04", "NET-04.1", "NET-04.2", "NET-04.3", "NET-04.4", "NET-04.5", "NET-04.6", "NET-04.7", "NET-04.8", "NET-04.9", "NET-04.10", "NET-04.11", "NET-04.12", "NET-04.13", "NET-04.14", "NET-06", "NET-06.1", "NET-06.2", "NET-06.3", "NET-06.4", "NET-06.5", "NET-06.6", "NET-06.7"],
  },

  "NET-14": {
    statement:
      "ACME defines, controls, and reviews approved secure remote access methods — encrypting and monitoring sessions, routing access through managed control points, validating endpoint security posture, governing third-party remote access, and enabling expedited session disconnection.",
    requirements: [
      { title: "Cryptographic Transmission Protection", detail: "Strong cryptography and security protocols safeguard sensitive data over open networks." },
      { title: "Wireless Link Protection", detail: "Wireless links are monitored for unauthorized connections and rogue access points." },
      { title: "Messaging Technology Restrictions", detail: "Unprotected sensitive data cannot be transmitted via end-user messaging technologies." },
      { title: "Approved Remote Access Methods", detail: "Secure remote access methods are defined, controlled, and reviewed." },
      { title: "Automated Session Monitoring", detail: "Remote access sessions are automatically monitored and controlled." },
      { title: "Encrypted Sessions", detail: "Cryptographic mechanisms protect remote access session confidentiality and integrity." },
      { title: "Managed Access Control Points", detail: "Remote access routes through managed network access control points." },
      { title: "Restricted Privileged Remote Commands", detail: "Privileged commands and sensitive data access via remote access are restricted to compelling operational need." },
      { title: "Telecommuting Security", detail: "Secure telecommuting practices govern remote worker access." },
      { title: "Third-Party Remote Access Governance", detail: "Third-party remote access accounts are proactively controlled and monitored." },
      { title: "Endpoint Posture Validation", detail: "Endpoint security posture is validated before allowing connection." },
      { title: "Expeditious Disconnect", detail: "Remote sessions can be expeditiously disconnected or disabled." },
      { title: "Wireless Access Control", detail: "Authorized wireless usage is controlled and unauthorized access is monitored." },
      { title: "Authentication & Encryption", detail: "Wi-Fi authenticates connecting devices and encrypts transmitted data." },
      { title: "Disabled Unnecessary Wireless", detail: "Unneeded embedded wireless capability is disabled before issuance." },
      { title: "Restricted User Configuration", detail: "Only explicitly authorized users may configure wireless capabilities." },
      { title: "Wireless Boundaries", detail: "Wireless communications are confined to organization-controlled boundaries." },
      { title: "Rogue Access Point Detection", detail: "Testing identifies authorized and unauthorized wireless access points." }
    ],
    sourceControls: ["NET-12", "NET-12.1", "NET-12.2", "NET-14", "NET-14.1", "NET-14.2", "NET-14.3", "NET-14.4", "NET-14.5", "NET-14.6", "NET-14.7", "NET-14.8", "NET-15", "NET-15.1", "NET-15.2", "NET-15.3", "NET-15.4", "NET-15.5"],
  },

  "NET-17": {
    statement:
      "ACME routes internet-bound traffic through a policy enforcement proxy for URL and DNS filtering — inspecting encrypted traffic, enforcing protocol compliance and DNSSEC validation, denylisting bad addresses and certificates, controlling bandwidth, and authenticating proxy traffic for user/group/location-aware controls.",
    requirements: [
      { title: "Proxy-Enforced Filtering", detail: "Internet-bound traffic is forced through a proxy for URL and DNS content filtering." },
      { title: "Routed Internal Traffic", detail: "Internal communications to external networks route through approved proxy servers." },
      { title: "Encrypted Traffic Visibility", detail: "Proxies make encrypted traffic visible to monitoring tools." },
      { title: "Privileged Access Routing", detail: "Privileged network access routes through a dedicated, managed, audited interface." },
      { title: "Protocol Compliance", detail: "Network traffic complies with IETF protocol specifications." },
      { title: "DNSSEC Validation", detail: "Domain name lookups are validated per DNSSEC." },
      { title: "Address Denylisting", detail: "Traffic to/from denylisted internet addresses is blocked." },
      { title: "Bandwidth Control", detail: "Bandwidth-intensive domain categories are subject to bandwidth control." },
      { title: "Authenticated Proxy", detail: "Internet-bound traffic authenticates with the proxy to enable user/group/location-aware controls." },
      { title: "Certificate Denylisting", detail: "Communication with assets using known-bad certificates is prevented." }
    ],
    sourceControls: ["NET-18", "NET-18.1", "NET-18.2", "NET-18.3", "NET-18.4", "NET-18.5", "NET-18.6", "NET-18.7", "NET-18.8", "NET-18.9", "NET-17", "NET-13"],
  },

  "WEB-01": {
    statement:
      "ACME governs the security of its web properties through an enterprise-wide web management policy and associated technical controls, including protections against unauthorized code being injected into or rendered within secure pages served to end users.",
    requirements: [
      { title: "Web Management Policy", detail: "An enterprise-wide web management policy defines standards, controls, and procedures for securing web properties." },
      { title: "Unauthorized Code Prevention", detail: "Technical controls prevent unauthorized code (e.g., injected scripts, unapproved third-party tags) from being present in secure pages as rendered in a client's browser." }
    ],
    sourceControls: ["WEB-01", "WEB-01.1", "WEB-02", "WEB-10", "WEB-13"],
  },

  "SEA-01": {
    statement:
      "ACME applies industry-recognized secure engineering practices across the specification, design, development, implementation, and modification of its technology assets, applications, and services, with centrally managed controls and resilience against both unintentional error and intentional attack.",
    requirements: [
      { title: "Secure Engineering Practices", detail: "Industry-recognized security, compliance, and resilience practices are applied across the full engineering lifecycle." },
      { title: "Centralized Control Management", detail: "Security, compliance, and resilience controls and processes are centrally managed organization-wide." },
      { title: "Resilience by Design", detail: "Systems are designed to achieve resilience requirements in both normal and adverse conditions." },
      { title: "Resistance to Error & Attack", detail: "Controls are designed to resist unintentional errors and intentional attack or circumvention." },
      { title: "Enterprise Architecture", detail: "An enterprise architecture addresses risk to organizational operations, assets, individuals, and other organizations." },
      { title: "Standardized Terminology", detail: "Technology and process terminology is standardized to reduce confusion across groups and departments." },
      { title: "Deliberate Outsourcing", detail: "Non-essential functions or services considered for outsourcing are evaluated against enterprise architecture and security standards." },
      { title: "Technical Debt Reviews", detail: "Ongoing reviews of hardware and software remediate outdated or unsupported technologies." },
      { title: "Layered Security Functions", detail: "Security functions are implemented as a layered structure minimizing inter-layer dependency." },
      { title: "System Partitioning", detail: "Systems are partitioned so partitions reside in separate physical domains or environments." },
      { title: "Application Partitioning", detail: "User functionality is separated from system management functionality." },
      { title: "Separate Execution Domains", detail: "Each executing process runs in a separate execution domain." },
      { title: "Security Function Isolation", detail: "Security functions are isolated from non-security functions." },
      { title: "Hardware Separation", detail: "Underlying hardware separation mechanisms facilitate process separation." },
      { title: "Thread Separation", detail: "A separate execution domain is maintained for each thread in multi-threaded processing." },
      { title: "System Privilege Isolation", detail: "Applications, services, and processes running with system privileges are isolated or logically separated." },
      { title: "Mean Time to Failure Analysis", detail: "MTTF is determined for system components in their specific operating environments." },
      { title: "Technology Lifecycle Management", detail: "The usable lifecycles of technology assets, applications, and services are managed." },
      { title: "Fail Secure", detail: "Systems fail to an organization-defined known state, preserving state information on failure." },
      { title: "Fail Safe", detail: "Fail-safe procedures are implemented when failure conditions occur." },
      { title: "Concealment & Misdirection", detail: "Techniques are used to confuse and mislead adversaries targeting ACME's systems." },
      { title: "Operational Randomness", detail: "Automated mechanisms introduce randomness into organizational operations and assets." },
      { title: "Randomized Processing/Storage Location", detail: "Automated mechanisms periodically change the location of processing and/or storage." }
    ],
    sourceControls: ["SEA-01", "SEA-01.1", "SEA-01.2", "SEA-01.3", "SEA-02", "SEA-02.1", "SEA-02.2", "SEA-02.3", "SEA-03", "SEA-03.1", "SEA-03.2", "SEA-04", "SEA-04.1", "SEA-04.2", "SEA-04.3", "SEA-04.4", "SEA-07", "SEA-07.1", "SEA-07.2", "SEA-07.3", "SEA-14", "SEA-14.1", "SEA-14.2", "SEA-17", "SEA-20"],
  },

  "TDA-01": {
    statement:
      "ACME tailors its development and acquisition strategies to unique business needs, governing the technology asset lifecycle through formal product management, integrity-verified software updates, pre-release malware testing, and DevSecOps practices integrated throughout the SDLC.",
    requirements: [
      { title: "Tailored Development & Acquisition", detail: "Development and acquisition strategies, contract tools, and procurement methods are tailored to unique business needs." },
      { title: "Product Management", detail: "Product management processes govern design, development, and production across the SDLC to improve functionality, enhance security/resiliency, correct deficiencies, and meet compliance obligations." },
      { title: "Update Integrity Validation", detail: "Security updates use integrity validation mechanisms." },
      { title: "Pre-Release Malware Testing", detail: "Malware detection tooling checks final product binaries and security updates before release." },
      { title: "DevSecOps", detail: "Security, compliance, and resilience are integrated throughout the SDLC via DevSecOps practices." },
      { title: "Risk-Based MVP Security", detail: "Technical and functional specifications ensure an appropriate security and resiliency baseline based on applicable risk." },
      { title: "Early Ports/Protocols/Services Identification", detail: "Developers identify intended functions, ports, protocols, and services early in the SDLC." },
      { title: "Validated IA Products", detail: "Commercially provided Information Assurance products are limited to those NIAP-evaluated or FIPS/NSA-validated." },
      { title: "Secure Development Methods", detail: "Software development employs industry-recognized secure programming, engineering, quality control, and validation techniques." },
      { title: "Pre-Established Secure Configurations", detail: "Vendors deliver assets with secure default configuration, retained across reinstalls and upgrades." },
      { title: "Justified Ports/Protocols/Services", detail: "Process owners identify, document, and justify the business need for ports, protocols, and services used." },
      { title: "Insecure Service Mitigation", detail: "Risk from necessary but insecure ports, protocols, and services is mitigated." },
      { title: "Change Control Security Representation", detail: "Security, compliance, and resilience representatives participate in product change control review." },
      { title: "Attack Surface Minimization", detail: "Known exploitable vulnerabilities are mitigated to minimize attack surface." },
      { title: "Ongoing Security Support", detail: "Security updates are delivered via automatic updates and user notification." },
      { title: "Regular Product Review", detail: "Products are regularly reviewed for appropriate security and resiliency against applicable risk." },
      { title: "Vulnerability Disclosure", detail: "Vulnerability details, affected products, impact, severity, and remediation guidance are disclosed to stakeholders." },
      { title: "Digital Element Requirements", detail: "Security and resiliency requirements are categorized for products/services with digital elements." },
      { title: "Exploitable Vulnerability Reporting", detail: "Stakeholders are notified of potentially exploitable vulnerabilities per statutory, regulatory, or contractual obligation." },
      { title: "Secure Logging Syntax", detail: "Developers use an industry-defined secure logging format at a defined level of detail." },
      { title: "Administrator Documentation", detail: "Documentation covers secure configuration/installation/operation, effective use of security features, and known administrative vulnerabilities." },
      { title: "Functional Property Disclosure", detail: "Developers describe the functional properties of security, compliance, and resilience controls in sufficient detail for analysis and testing." },
      { title: "Software Bill of Materials", detail: "An SBOM lists software packages, versions, and licenses in use." },
      { title: "Design Specification & Security Architecture", detail: "Developer architecture aligns with ACME's enterprise architecture, describes control allocation, and expresses how security functions work together." },
      { title: "Diagnostic Interface Security", detail: "Physical diagnostic and test interfaces are secured against misuse." },
      { title: "Diagnostic Interface Monitoring", detail: "Endpoint devices log and alert on attempts to access diagnostic/test interfaces." }
    ],
    sourceControls: ["TDA-01", "TDA-01.1", "TDA-01.2", "TDA-01.3", "TDA-01.4", "TDA-02", "TDA-02.1", "TDA-02.2", "TDA-02.3", "TDA-02.4", "TDA-02.5", "TDA-02.6", "TDA-02.7", "TDA-02.8", "TDA-02.9", "TDA-02.10", "TDA-02.11", "TDA-02.12", "TDA-02.13", "TDA-02.14", "TDA-04", "TDA-04.1", "TDA-04.2", "TDA-05", "TDA-05.1", "TDA-05.2"],
  },

  "TDA-06": {
    statement:
      "ACME develops applications following Secure Software Development Practices — performing criticality analysis and threat modeling during development, governed by a Software Assurance Maturity Model, supported by automated toolchains, independent design review, and root cause analysis of design issues.",
    requirements: [
      { title: "Secure Development Practices", detail: "Applications are developed based on SSDP." },
      { title: "Criticality Analysis", detail: "Developers perform criticality analysis at defined SDLC decision points." },
      { title: "Threat Modeling", detail: "Threat modeling and secure design techniques identify and account for software threats." },
      { title: "Software Assurance Maturity Model", detail: "A SAMM governs the secure development lifecycle." },
      { title: "Supporting Toolchain", detail: "Automated tooling improves accuracy, consistency, and comprehensiveness of secure practices across the asset lifecycle." },
      { title: "Independent Design Review", detail: "Software design is independently reviewed to validate requirements are met and risks remediated." },
      { title: "Design Root Cause Analysis", detail: "Software design issues undergo root cause analysis, remediation, and monitoring for effectiveness." },
      { title: "Environment Separation", detail: "Development, testing, and operational environments are managed separately to protect production." },
      { title: "Secure Migration", detail: "Migration practices purge test/development/staging data and accounts before production deployment." },
      { title: "Developer Configuration Management", detail: "Configuration management is performed during system design, development, implementation, and operation." },
      { title: "Software/Firmware Integrity Verification", detail: "Integrity verification is enabled for software and firmware components." },
      { title: "Hardware Integrity Verification", detail: "Integrity verification is enabled for hardware components." }
    ],
    sourceControls: ["TDA-06", "TDA-06.1", "TDA-06.2", "TDA-06.3", "TDA-06.4", "TDA-06.5", "TDA-06.6", "TDA-08", "TDA-08.1", "TDA-14", "TDA-14.1", "TDA-14.2", "TDA-07"],
  },

  "TDA-09": {
    statement:
      "ACME tests security, compliance, and resilience throughout development — via a Security Testing and Evaluation plan, static and dynamic code analysis, malformed input testing, application penetration testing, manual code review, and secure-by-default configuration — with a documented flaw remediation process and a continuous monitoring plan carried into production.",
    requirements: [
      { title: "Security Testing & Evaluation Plan", detail: "Developers consult security personnel to create and implement an ST&E plan, remediate identified flaws, and document results." },
      { title: "Continuous Monitoring Plan", detail: "Developers produce a plan for continuous monitoring of control effectiveness." },
      { title: "Static Code Analysis", detail: "Static code analysis tools identify, remediate, and document common flaws." },
      { title: "Dynamic Code Analysis", detail: "Dynamic code analysis tools identify, remediate, and document common flaws." },
      { title: "Malformed Input Testing", detail: "Testing verifies assets continue operating as intended under invalid or unexpected input." },
      { title: "Application Penetration Testing", detail: "Custom-built assets undergo application-level penetration testing." },
      { title: "Secure Settings By Default", detail: "Secure configuration settings are the default to reduce deployment risk." },
      { title: "Manual Code Review", detail: "Manual code review identifies and remediates flaws requiring application-specific knowledge." }
    ],
    sourceControls: ["TDA-09", "TDA-09.1", "TDA-09.2", "TDA-09.3", "TDA-09.4", "TDA-09.5", "TDA-09.6", "TDA-09.7", "TDA-15"],
  },

  "TDA-18": {
    statement:
      "ACME approves, documents, and controls the use of live/production data in development and test environments, ensuring test data integrity through existing security controls.",
    requirements: [
      { title: "Controlled Live Data Use", detail: "Use of live data in development and test environments is approved, documented, and controlled." },
      { title: "Test Data Integrity", detail: "Test data integrity is protected through existing security, compliance, and resilience controls." }
    ],
    sourceControls: ["TDA-10", "TDA-10.1", "TDA-18"],
  },

  "TDA-20": {
    statement:
      "ACME limits privileges to change software within software libraries, publishing integrity verification for releases, archiving releases and their components, escrowing source code for business continuity, and formally governing approval of code and binaries for production use.",
    requirements: [
      { title: "Restricted Library Change Privileges", detail: "Privileges to change software resident in software libraries are limited." },
      { title: "Release Integrity Verification", detail: "Integrity verification information is published for software releases." },
      { title: "Release Archiving", detail: "Software releases and their components (code, packages, third-party libraries, documentation) are archived with integrity verification data." },
      { title: "Software Escrow", detail: "Source code and supporting documentation are escrowed to ensure availability if the provider cannot continue support." },
      { title: "Approved Code Governance", detail: "Approval of binaries and code for production use is formally governed." }
    ],
    sourceControls: ["TDA-20", "TDA-20.1", "TDA-20.2", "TDA-20.3", "TDA-20.4", "TDA-13"],
  },

  "HRS-01": {
    statement:
      "ACME governs personnel security proactively across the full employment lifecycle — onboarding new hires, transferring personnel into new roles, and offboarding departing employees.",
    requirements: [
      { title: "Personnel Security Controls", detail: "Personnel security controls are implemented." },
      { title: "Lifecycle Governance", detail: "Onboarding, role transfers, and offboarding are proactively governed." },
      { title: "Position Risk Designation", detail: "Positions receive risk designations with corresponding screening criteria." },
      { title: "Elevated Privilege Clearance", detail: "Users accessing sensitive/regulated data are cleared and regularly trained." },
      { title: "Probationary Monitoring", detail: "Newly onboarded personnel receive enhanced monitoring during their probationary period." },
      { title: "Defined Cybersecurity Roles", detail: "Cybersecurity roles and responsibilities are defined for all personnel." },
      { title: "User Awareness", detail: "Users are communicated with regarding their roles and responsibilities for a secure environment." },
      { title: "Security Position Competency", detail: "Security-related positions are staffed by individuals with the necessary skill set." },
      { title: "Critical Skills Evaluation", detail: "Critical security, compliance, and resilience skills and gaps are evaluated." },
      { title: "Gap Remediation", detail: "Identified skills deficiencies are remediated." },
      { title: "Vital Staff Identification", detail: "Vital security, compliance, and resilience staff are identified." },
      { title: "Staff Redundancy", detail: "Redundancy is established for vital security, compliance, and resilience staff." },
      { title: "Succession Planning", detail: "Succession planning is performed for vital security, compliance, and resilience roles." }
    ],
    sourceControls: ["HRS-01", "HRS-01.1", "HRS-02", "HRS-02.1", "HRS-02.2", "HRS-03", "HRS-03.1", "HRS-03.2", "HRS-13", "HRS-13.1", "HRS-13.2", "HRS-13.3", "HRS-13.4"],
  },

  "HRS-04": {
    statement:
      "ACME screens individuals before granting access, applying enhanced criteria for specially protected information, formally educating users on data handling, and verifying citizenship where statutory, regulatory, or contractual requirements apply.",
    requirements: [
      { title: "Pre-Access Screening", detail: "Individuals are screened prior to being authorized access." },
      { title: "Special Protection Screening", detail: "Access to specially protected information requires satisfying defined screening criteria." },
      { title: "Formal Data Handling Education", detail: "Authorized users are formally educated on proper data handling for the data types they access." },
      { title: "Citizenship Verification", detail: "Citizenship requirements are verified where statutory, regulatory, or contractual obligations apply." },
      { title: "Foreign National Identification", detail: "Foreign nationals are identified by specific citizenship." },
      { title: "Daily Security Principles", detail: "Employees and contractors apply cybersecurity and data protection principles in their daily work." },
      { title: "Rules of Behavior", detail: "Acceptable and unacceptable technology use rules are defined, with consequences for violations." },
      { title: "Social Media Restrictions", detail: "Rules restrict social media/networking use, posting on commercial sites, and sharing account information." },
      { title: "Technology Use Restrictions", detail: "Usage restrictions reflect the potential damage from malicious use of organizational technologies." },
      { title: "Critical Technology Governance", detail: "Usage policies govern critical technologies." },
      { title: "Mobile Device Risk Management", detail: "Business risks from mobile device access to organizational resources are managed." },
      { title: "Exfiltration-Conscious Dress Code", detail: "Oversized clothing that could conceal exfiltrated data or assets is prohibited." },
      { title: "Recurring Policy Acknowledgement", detail: "Personnel receive recurring policy familiarization and provide acknowledgement." },
      { title: "Signed Access Agreements", detail: "Internal and third-party users sign appropriate access agreements prior to access." },
      { title: "Confidentiality Agreements", detail: "NDAs or similar agreements protect data and operational details for employees and third parties." },
      { title: "Post-Employment Awareness", detail: "Individuals are notified of legally binding post-employment data protection requirements." }
    ],
    sourceControls: ["HRS-04", "HRS-04.1", "HRS-04.2", "HRS-04.3", "HRS-04.4", "HRS-05", "HRS-05.1", "HRS-05.2", "HRS-05.3", "HRS-05.4", "HRS-05.5", "HRS-05.6", "HRS-05.7", "HRS-06", "HRS-06.1", "HRS-06.2"],
  },

  "HRS-09": {
    statement:
      "ACME governs employment termination — retrieving organizational assets, expediting access removal for high-risk terminations, notifying departing individuals of post-employment obligations, and automatically alerting IAM personnel to terminate access.",
    requirements: [
      { title: "Non-Compliance Sanctions", detail: "Personnel failing to comply with security policies, standards, and procedures are sanctioned." },
      { title: "Misconduct Investigations", detail: "Investigations are conducted when policy violation is reasonably suspected." },
      { title: "Disciplinary Process Updates", detail: "Disciplinary practices are periodically reviewed and updated for legal, operational, and threat changes." },
      { title: "Preventative Access Restriction", detail: "Access is proactively restricted for individuals under investigation who may face termination." },
      { title: "Termination Governance", detail: "The termination of individual employment is formally governed." },
      { title: "Asset Retrieval", detail: "Organization-owned assets are retrieved upon termination." },
      { title: "Expedited High-Risk Removal", detail: "Access removal is expedited for individuals designated high-risk upon termination." },
      { title: "Post-Employment Notification", detail: "Terminated individuals are formally notified of post-employment data protection requirements." },
      { title: "Automated Termination Alerts", detail: "IAM personnel are automatically notified upon employment or contract termination." }
    ],
    sourceControls: ["HRS-07", "HRS-07.1", "HRS-07.2", "HRS-07.3", "HRS-09", "HRS-09.1", "HRS-09.2", "HRS-09.3", "HRS-09.4", "HRS-08", "HRS-10"],
  },

  "HRS-11": {
    statement:
      "ACME limits and reviews developer privileges to change production components, avoiding incompatible development roles and enforcing a two-person rule for changes to sensitive technology assets.",
    requirements: [
      { title: "Limited Developer Privileges", detail: "Developer privileges to change hardware, software, and firmware in production are limited and reviewed to avoid incompatible roles." },
      { title: "Two-Person Rule", detail: "A two-person rule governs changes to sensitive technology assets, applications, or services." }
    ],
    sourceControls: ["HRS-12", "HRS-12.1", "HRS-11"],
  },

  "SAT-02": {
    statement:
      "ACME provides every employee and contractor security awareness education relevant to their job function, reinforced through simulated attack exercises and social engineering awareness training.",
    requirements: [
      { title: "Workforce Development Program", detail: "Security workforce development and awareness controls are formally implemented." },
      { title: "Periodic Relevancy Review", detail: "The program is periodically reviewed to reflect changes in policy, roles, threats, and technology." },
      { title: "Role-Relevant Awareness Training", detail: "All employees and contractors receive security, compliance, and resilience awareness education relevant to their job function." },
      { title: "Simulated Attack Exercises", detail: "Training includes simulated cyber-attacks aligned with current threat scenarios." },
      { title: "Social Engineering Awareness", detail: "Training covers recognizing and reporting social engineering and social mining attempts." },
      { title: "Role-Based Training Cadence", detail: "Role-based training is required before access authorization, upon system change, and annually thereafter." },
      { title: "Practical Exercises", detail: "Training includes practical exercises reinforcing training objectives." },
      { title: "Malware & Anomaly Recognition", detail: "Personnel are trained to recognize suspicious communications and anomalous system behavior." },
      { title: "Sensitive Data Handling", detail: "Every user accessing sensitive or regulated data is formally trained in data handling requirements." },
      { title: "Vendor-Specific Training", detail: "Vendor-specific training is incorporated for new technology initiatives." },
      { title: "Privileged User Training", detail: "Privileged users receive training specific to their unique roles and responsibilities." },
      { title: "Current Threat Landscape", detail: "Role-based training reflects the cyber threats users may encounter in day-to-day operations." },
      { title: "Continuing Education (Security & Compliance)", detail: "Security, compliance, and resilience personnel receive Continuing Professional Education (CPE) to maintain proficiency." },
      { title: "Continuing Education (DevOps)", detail: "Application development and operations personnel receive CPE on Secure Software Development Practices." },
      { title: "Counterintelligence Training", detail: "Specialized counterintelligence awareness training enables personnel to recognize signs of hostile actors." }
    ],
    sourceControls: ["SAT-01", "SAT-01.1", "SAT-02", "SAT-02.1", "SAT-02.2", "SAT-03", "SAT-03.1", "SAT-03.2", "SAT-03.3", "SAT-03.4", "SAT-03.5", "SAT-03.6", "SAT-03.7", "SAT-03.8", "SAT-03.9", "SAT-04"],
  },

  "TPM-01": {
    statement:
      "ACME maintains a current, accurate, and complete inventory of external service providers that could impact the confidentiality, integrity, availability, or safety of its technology assets, applications, services, and data.",
    requirements: [
      { title: "Third-Party Management Controls", detail: "Third-party management controls are formally implemented." },
      { title: "ESP Inventory", detail: "A current, accurate, and complete list of External Service Providers is maintained." },
      { title: "Supply Chain Risk Evaluation", detail: "Security risks and threats associated with the technology supply chain are evaluated, with remediation actions taken as needed." },
      { title: "Tailored Acquisition Strategies", detail: "Acquisition strategies, contract tools, and procurement methods are tailored for unique technology purchases." },
      { title: "Adversary Harm Limitation", detail: "Security safeguards limit harm from adversaries who target the organization's supply chain." },
      { title: "Weakness Remediation Process", detail: "Identified weaknesses or deficiencies in supply chain security are addressed through a defined process." },
      { title: "Spare Parts Strategy", detail: "A spare parts strategy ensures an adequate supply of critical components to meet operational needs." }
    ],
    sourceControls: ["TPM-01", "TPM-01.1", "TPM-03", "TPM-03.1", "TPM-03.2", "TPM-03.3", "TPM-03.4", "TPM-02"],
  },

  "TPM-04": {
    statement:
      "ACME mitigates the risks of third-party access to its technology assets, applications, services, and data through pre-acquisition risk assessments, documented connectivity requirements, conflict-of-interest safeguards, and restrictions on where third parties may process or store organizational information.",
    requirements: [
      { title: "Third-Party Access Risk Mitigation", detail: "Risks associated with third-party access to organizational systems and data are mitigated." },
      { title: "Pre-Acquisition Risk Assessment", detail: "A risk assessment is conducted prior to acquiring or outsourcing technology-related assets or services." },
      { title: "Connectivity Requirements", detail: "External Service Providers document the business need for the ports, protocols, and services they require." },
      { title: "Conflict of Interest Management", detail: "External service provider interests are verified to be consistent with organizational interests." },
      { title: "Location Restrictions", detail: "The location of third-party information processing and storage is restricted based on business requirements." },
      { title: "Contractual Security Requirements", detail: "Contracts include applicable security, compliance, and resilience requirements reflecting ACME's needs." },
      { title: "Compromise Notification", detail: "External Service Providers must notify ACME of actual or potential supply chain compromises." },
      { title: "Flow-Down Requirements", detail: "Security, compliance, and resilience requirements flow down to applicable subcontractors and suppliers." },
      { title: "Unique Authentication", detail: "External Service Providers use unique authentication factors for each customer." },
      { title: "RASCI Matrix", detail: "A RASCI matrix documents control assignment between ACME and its External Service Providers." },
      { title: "Recurring Scope Review", detail: "The RASCI matrix is recurringly validated against current contractual obligations, business practices, and deployed assets." },
      { title: "First-Party Declaration", detail: "External Service Providers provide a First-Party Declaration of compliance with specified obligations, including flow-down requirements." },
      { title: "Break Clauses", detail: "Contracts include break clauses for failure to meet security, compliance, or resilience criteria." },
      { title: "Third-Party Attestation", detail: "An independent Third-Party Assessment Organization attests to conformity with specified obligations, including flow-down requirements." }
    ],
    sourceControls: ["TPM-04", "TPM-04.1", "TPM-04.2", "TPM-04.3", "TPM-04.4", "TPM-05", "TPM-05.1", "TPM-05.2", "TPM-05.3", "TPM-05.4", "TPM-05.5", "TPM-05.6", "TPM-05.7", "TPM-05.8", "TPM-06"],
  },
};
