// Security Engineering Principles — a technical-architecture cut through the
// same procedure library, organized by discipline (Identity, Network,
// DevSecOps...) instead of by procedural ownership. This page exists because
// a framework crosswalk can score every control "Implemented" while still
// missing an architectural premise like "authentication isn't authorization"
// or "tenant isolation can't live in the application layer alone" — premises
// that are easy to state abstractly but only mean something once they're
// concrete requirements inside a real SOP step.
//
// Every principle carries a `status`, derived (never hand-typed) from
// whether it's actually backed by a real SOP step:
//   - "operationalized"     — implementedIn resolves to one or more real
//                              steps, and nothing marks it incomplete.
//   - "partial"              — implementedIn resolves to a real step, but the
//                              author has flagged (via `partial: true` +
//                              `partialNote`) that the step doesn't fully
//                              close the principle yet.
//   - "not-operationalized" — implementedIn is empty; no SOP step covers
//                              this yet. Required to carry a `gapNote`
//                              explaining, neutrally, what building it would
//                              take — this is a gap being named on purpose,
//                              not an alarm.
// That third state is the point of this file: a missing SOP should surface
// a gap, not silently omit the principle. See the validation block at the
// bottom — every implementedIn reference is checked against the real
// procedures.js data (a stale step title fails the build), and every
// principle's controlIds are derived by reading its linked step(s)' own
// `controls` arrays rather than hand-typed, so nothing here can claim
// coverage its linked step doesn't actually have.
import { PROCEDURES } from "./procedures";

// The small set of cross-cutting ideas everything below traces back to. Kept
// deliberately short — this is meant to be a handful of ideas a reviewer can
// actually hold in their head, not a second taxonomy to memorize.
export const FOUNDATIONAL_PRINCIPLES = [
  { id: "secure-by-default", title: "Secure by Default", detail: "Security-relevant defaults start restrictive; exceptions are deliberate, documented, and approved — not accidental." },
  { id: "default-deny", title: "Default Deny", detail: "Access, network paths, and permissions start closed and are opened deliberately — nothing is reachable by default." },
  { id: "least-privilege", title: "Least Privilege", detail: "Every identity — human, service, or AI agent — holds only the access its current task requires, no more, no longer than needed." },
  { id: "short-lived-identity", title: "Short-Lived Identity", detail: "Credentials expire and rotate automatically wherever the platform supports it, instead of remaining valid indefinitely." },
  { id: "blast-radius", title: "Minimize Blast Radius", detail: "Every design decision asks: if this credential, workload, or component is fully compromised, what can the attacker actually reach?" },
  { id: "defense-in-depth", title: "Defense in Depth", detail: "Critical boundaries are enforced at more than one independent layer, so a single bug or failure doesn't become a full breach." },
  { id: "untrusted-input", title: "Treat Inputs as Untrusted", detail: "Crossing a trust boundary never automatically transfers trust in the data, code, prompt, or instruction that crossed it." },
  { id: "tenant-isolation", title: "Strong Tenant Isolation", detail: "Customer or tenant data is walled off by more than an application query — enforcement holds even if the app layer has a bug." },
  { id: "independent-authorization", title: "Independent Authorization", detail: "Authentication proves identity; a separate, explicit check proves permission for the specific resource and action requested." },
  { id: "continuous-verification", title: "Continuously Verify", detail: "A design or configuration is not assumed to remain secure merely because it was secure when deployed — posture is checked on an ongoing basis, not just at launch." },
  { id: "assume-third-party-compromise", title: "Assume Third-Party Compromise", detail: "A vendor or integration is scoped and monitored as if it will eventually be compromised, not trusted because it passed a review once." },
  { id: "assume-credential-compromise", title: "Assume Credential Compromise", detail: "Design assumes any single credential can leak — the response is scope and lifetime limits, not just secrecy." },
  { id: "immutable-recovery", title: "Immutable Recovery", detail: "Backups survive a full compromise of production — an attacker who owns production still can't destroy the way back." },
  { id: "boundaries-outside-ai", title: "Security Boundaries Outside AI", detail: "An AI model's instructions are never the enforcement mechanism — permission checks live in the surrounding system, not the prompt." },
];

const PRINCIPLE_DOMAIN_DEFS = [
  {
    id: "identity-authorization",
    title: "Identity & Authorization",
    summary: "Who — or what — is allowed to act, for how long, and who checks.",
    principles: [
      {
        id: "no-standing-privilege",
        statement: "No standing privilege where JIT/JEA is technically feasible.",
        rationale: "A privileged role that's always active is a target that's always live. If the platform supports just-in-time or just-enough-access, a standing grant should require its own documented justification, not be the default shape of privileged access.",
        tags: ["least-privilege", "short-lived-identity"],
        implementedIn: [{ procedureCode: "SOP-04", step: "Grant least privilege at request time" }],
      },
      {
        id: "no-long-lived-service-credentials",
        statement: "No long-lived credentials for services, workloads, or integrations where short-lived or managed identity is supported.",
        rationale: "A static API key or password that never expires is a permanent liability the moment it leaks — there's no window in which it stops working on its own. Managed/workload identity and short-lived, minimum-scope tokens close that window by design.",
        tags: ["short-lived-identity", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-04", step: "Retire long-lived credentials for services and integrations" }],
      },
      {
        id: "production-access-is-exceptional",
        statement: "Human production access is exceptional, time-bound, attributable, and logged — not a standing working mode.",
        rationale: "\"I have standing prod access because I might need it\" is exactly the access an incident review can't account for. Task-scoped, named, logged access means the log can always answer who touched production and when.",
        tags: ["least-privilege", "assume-credential-compromise"],
        implementedIn: [{ procedureCode: "SOP-04", step: "Treat production access as the exception, not the default" }],
      },
      {
        id: "authentication-is-not-authorization",
        statement: "Possession of valid authentication credentials does not imply authorization — every protected resource or action is independently authorized.",
        rationale: "\"This request came from an authenticated integration\" and \"this request may read this customer's data\" are two different claims. Collapsing them into one check is how a valid token ends up reading data it was never meant to touch.",
        tags: ["independent-authorization", "default-deny"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Enforce authorization independently of authentication" }],
      },
      {
        id: "phishing-resistant-mfa",
        statement: "Privileged and high-risk interactive authentication is phishing-resistant wherever technically feasible — not just \"MFA is on.\"",
        rationale: "A one-time code or a push notification can be relayed to a fake login page or fatigued into an accidental approval. A passkey or hardware security key can't — it's cryptographically bound to the real site, so there's nothing to relay.",
        tags: ["assume-credential-compromise", "secure-by-default"],
        implementedIn: [{ procedureCode: "SOP-04", step: "Enforce MFA with no exceptions" }],
      },
      {
        id: "break-glass-access",
        statement: "Break-glass emergency access is separate from normal administrative access, tightly monitored, tested, and cannot quietly become the normal way work gets done.",
        rationale: "An emergency-only path that gets used every week isn't an emergency path anymore — it's unmonitored standing access with an excuse attached. Keeping it separate, logged, and reviewed after every use is what keeps it actually exceptional.",
        tags: ["least-privilege", "assume-credential-compromise"],
        implementedIn: [],
        gapNote: "Would require a dedicated emergency-access mechanism — its own request/approval path, real-time alerting on use, and a mandatory post-use review — distinct from standard Privileged Identity Management activation.",
      },
    ],
  },
  {
    id: "network",
    title: "Network & Egress",
    summary: "Segmentation, inspection, and encryption for traffic — in both directions across the perimeter.",
    principles: [
      {
        id: "layered-perimeter",
        statement: "The perimeter uses multiple independent controls (firewall, IDS/IPS, proxy) — never a single control an attacker only has to beat once.",
        rationale: "A perimeter that's one control deep fails all at once. Independent, overlapping layers mean a bypass of one still has to clear the next.",
        tags: ["defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-08", step: "Layer defenses at the boundary" }],
      },
      {
        id: "verified-segmentation",
        statement: "Network segmentation is verified by actually attempting cross-segment lateral movement — a diagram isn't evidence it holds.",
        rationale: "A segmentation diagram shows intent, not enforcement. An annual test that actually tries to cross the boundary is the difference between a design and a control.",
        tags: ["defense-in-depth", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-08", step: "Segment production from corporate and guest networks — and verify it" }],
      },
      {
        id: "encrypted-sessions-over-open-networks",
        statement: "Traffic over any open or untrusted network is encrypted end-to-end and sessions are protected against hijacking or replay — not just authenticated once at connection time.",
        rationale: "A session that's checked once at login and trusted forever after is a session an attacker only has to hijack once. Continuous protection, not a one-time handshake, is what actually holds over an open network.",
        tags: ["assume-credential-compromise"],
        implementedIn: [{ procedureCode: "SOP-08", step: "Protect data and session integrity over open networks" }],
      },
      {
        id: "public-apps-behind-inspected-edge",
        statement: "Public-facing applications sit behind a WAF/CDN that inspects and rate-limits traffic — including automated/bot traffic — and are never exposed directly; egress is monitored for intrusion.",
        rationale: "The public internet is the least trusted network ACME has. Nothing customer-facing should be one misconfiguration away from being reachable without an inspection layer in front of it, in either direction.",
        tags: ["defense-in-depth", "default-deny"],
        implementedIn: [
          { procedureCode: "SOP-08", step: "Put public-facing web apps behind a WAF" },
          { procedureCode: "SOP-08", step: "Monitor for intrusion at egress" },
        ],
      },
      {
        id: "constrained-egress",
        statement: "A compromised workload cannot automatically reach arbitrary destinations — cloud metadata endpoints, loopback, and internal control-plane addresses are never reachable through a user-controlled URL, and outbound traffic follows an approved-destination model where feasible.",
        rationale: "Ingress gets the inspection budget by default, but an attacker who's already inside usually needs to call out — to exfiltrate data, reach a cloud metadata endpoint for credentials, or pivot to an internal service. Treating egress as an unmonitored given is how a contained compromise becomes a cloud-account takeover.",
        tags: ["blast-radius", "defense-in-depth"],
        implementedIn: [],
        gapNote: "Would require an explicit egress-control step — destination allowlisting, cloud-metadata-endpoint protection, blocked loopback/link-local ranges — added to SOP-08 or SOP-10 as workloads move toward a service-mesh or egress-proxy model. SOP-08 currently monitors egress for intrusion, but doesn't yet restrict what a workload can reach in the first place.",
      },
    ],
  },
  {
    id: "secure-architecture",
    title: "Secure Architecture & Configuration",
    summary: "What a system looks like on day one, and whether it still looks that way six months later.",
    principles: [
      {
        id: "hardened-by-default",
        statement: "Production resources start from an approved, hardened configuration baseline; a security-reducing deviation requires an explicit, documented exception — not silent drift.",
        rationale: "Default settings are tuned for compatibility, not security. Starting every resource from a baseline that's already been hardened is cheaper than finding and fixing the gaps one at a time after the fact.",
        tags: ["secure-by-default", "defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-02", step: "Start from the approved baseline" }],
      },
      {
        id: "configuration-drift-detected",
        statement: "Security posture doesn't depend on someone remembering what the Terraform said six months ago — actual runtime configuration is continuously compared against intended state.",
        rationale: "Infrastructure-as-code describes intent at the moment it was applied, not the system's state today. Only continuous comparison against the live environment catches the manual console change nobody wrote down.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-02", step: "Watch for drift automatically" }],
      },
      {
        id: "threat-modeled-before-shipping",
        statement: "Trust boundaries and abuse paths are explicitly threat-modeled before a high-risk system ships, and again after a material architectural change — not discovered for the first time during an incident.",
        rationale: "Every other principle on this page assumes someone already identified where the trust boundaries are — identity, tenant, network, model, third-party, production. Threat modeling is the exercise that actually draws those boundaries on a diagram before an attacker draws them for you.",
        tags: ["defense-in-depth", "secure-by-default"],
        implementedIn: [],
        gapNote: "Would require a documented threat-modeling step (e.g., STRIDE or an equivalent structured review) added to SOP-10's pre-launch gate for systems above a defined risk threshold, and repeated after a material architecture change.",
      },
    ],
  },
  {
    id: "workload-runtime",
    title: "Workload & Runtime Security",
    summary: "What a workload can do to its own host, its neighbors, and the cloud account underneath it.",
    principles: [
      {
        id: "least-privileged-workloads",
        statement: "Containers and services run non-root, without privileged mode, unnecessary Linux capabilities, host mounts, or host networking — the workload gets exactly the access it needs to do its job, nothing the host has.",
        rationale: "A workload running as root with the host's network namespace doesn't need to be exploited cleverly — a single bug already hands over most of what an attacker would want from the host itself.",
        tags: ["least-privilege", "blast-radius"],
        implementedIn: [],
        gapNote: "Would require a workload-hardening baseline (non-root images, dropped capabilities, seccomp/AppArmor profiles, no privileged containers) as an explicit step in SOP-02's baseline configuration or a dedicated container/runtime security procedure.",
      },
      {
        id: "compromise-stops-at-workload-boundary",
        statement: "A compromised container or workload does not automatically yield access to its host node, the orchestration control plane, the cloud account, or an adjacent workload.",
        rationale: "This is Minimize Blast Radius applied to the one layer traditional network segmentation doesn't reach — the boundary between a single running workload and everything it happens to share a host or cloud account with.",
        tags: ["blast-radius", "defense-in-depth"],
        implementedIn: [],
        gapNote: "Would require runtime isolation controls verified as part of the platform's runtime security baseline — task-scoped IAM roles instead of node-wide credentials, network policy between workloads, and, where warranted, stronger sandboxing (e.g., gVisor/Kata) for untrusted or high-risk workloads.",
      },
    ],
  },
  {
    id: "vulnerability-management",
    title: "Vulnerability & Exposure Management",
    summary: "Finding weaknesses continuously, and fixing the ones that actually matter first.",
    principles: [
      {
        id: "exposure-based-prioritization",
        statement: "Vulnerability priority considers exploitability, reachability, asset criticality, and compensating controls — not CVSS alone.",
        rationale: "A Critical-CVSS finding on an isolated, non-internet-facing test box is a different risk than a Medium finding reachable from the open internet on a Restricted-tier system. Priority should reflect the actual attack path, not just the vendor's severity label.",
        tags: ["continuous-verification", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-11", step: "Rank findings by real risk" }],
      },
      {
        id: "kev-emergency-bypass",
        statement: "A known-exploited or actively-exploited vulnerability on an internet-facing asset bypasses the routine remediation SLA and gets emergency treatment.",
        rationale: "The routine Critical/High/Medium/Low remediation clock assumes a theoretical risk. A vulnerability with confirmed active exploitation in the wild, sitting on something the internet can already reach, isn't theoretical — the SLA that fits it is 'now,' not 'within 7 days.'",
        tags: ["continuous-verification"],
        implementedIn: [],
        gapNote: "Would require an explicit known-exploited-vulnerability (KEV) catalog check and an expedited-response trigger added to SOP-11's remediation-SLA step, distinct from the routine Critical/High/Medium/Low timeline.",
      },
      {
        id: "no-silent-unsupported-tech",
        statement: "An asset that's fallen out of its vendor's supported patch/security lifecycle doesn't stay in production silently — it's flagged and either upgraded or carries an explicitly accepted risk exception.",
        rationale: "Software past end-of-life doesn't get CVEs published against it anymore because nobody's patching it, which can look like a clean scan instead of what it actually is — an unfixable, growing risk.",
        tags: ["continuous-verification", "blast-radius"],
        implementedIn: [],
        gapNote: "Would require an end-of-life/end-of-support tracking step added to SOP-09 (Asset Management) or SOP-11, cross-referencing each asset's platform/software version against vendor support timelines.",
      },
    ],
  },
  {
    id: "devsecops",
    title: "DevSecOps & Software Supply Chain",
    summary: "How code becomes a trusted production artifact, and what has to be true about everything it's built from.",
    principles: [
      {
        id: "no-self-approved-changes",
        statement: "Every change is reviewed by someone other than its author, with a documented rationale — an undocumented, self-approved change doesn't ship.",
        rationale: "A single person's judgment is a single point of failure. A second reviewer isn't bureaucracy, it's the actual control against a mistake or a malicious change shipping unnoticed.",
        tags: ["defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Require peer review with documentation before merge" }],
      },
      {
        id: "automated-gate-blocks-merge",
        statement: "Static analysis, dependency/SCA scanning, secret scanning, and security tests run on every PR, and a Critical/High finding blocks the merge automatically.",
        rationale: "A security gate that can be skipped under deadline pressure isn't a gate. Blocking the merge — not just flagging it — is what makes the control real instead of advisory.",
        tags: ["defense-in-depth", "assume-credential-compromise"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Run the automated gate" }],
      },
      {
        id: "traceable-production-artifacts",
        statement: "Every production artifact is traceable to the exact source commit and pipeline run that built it — no manual push, copy, or hotfix into production outside the pipeline.",
        rationale: "If a production binary can't be traced back to a reviewed commit, the review and the gate upstream of it didn't actually protect production — they protected a different artifact than the one that shipped.",
        tags: ["blast-radius", "assume-credential-compromise"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Build, stage, and gate production separately" }],
      },
      {
        id: "no-embedded-secrets",
        statement: "Secrets are never embedded in source code, container images, config files, or CI/CD variables where a managed identity or vault reference is feasible.",
        rationale: "A secret committed to a repo or baked into an image outlives every access review built around it — deleting the commit doesn't rotate the credential. Vault references keep the secret revocable and out of anything that gets copied, forked, or archived.",
        tags: ["assume-credential-compromise", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-01", step: "Own and rotate keys in Key Vault" }],
      },
      {
        id: "pinned-dependency-review",
        statement: "Dependencies are pinned to specific versions, monitored for new vulnerabilities, and introduced through a controlled review — not pulled arbitrarily from a public registry at build time.",
        rationale: "An unpinned dependency means the code that ships today isn't necessarily the code that gets built tomorrow from the same source. Pinning plus review is what makes 'the dependency tree' a reviewed decision instead of whatever a registry happened to serve at build time.",
        tags: ["assume-credential-compromise", "continuous-verification"],
        partial: true,
        partialNote: "SOP-10's automated gate scans dependencies for known vulnerabilities on every PR, but doesn't yet require pinned versions or a distinct review gate specifically for introducing a brand-new dependency.",
        implementedIn: [{ procedureCode: "SOP-10", step: "Run the automated gate" }],
      },
      {
        id: "sbom-inventory",
        statement: "Every production artifact has a machine-readable inventory of the dependencies it's built from — an SBOM, not tribal knowledge of what's probably in the image.",
        rationale: "When the next critical open-source CVE lands, the useful question is \"which of our production artifacts contain this component,\" answerable in minutes. Without an SBOM, that's a manual archaeology project instead.",
        tags: ["continuous-verification"],
        implementedIn: [],
        gapNote: "Would require SBOM generation (e.g., Syft/CycloneDX) added as a build-pipeline step in SOP-10, alongside the existing SAST/SCA/secret-scanning gate.",
      },
      {
        id: "artifact-signing",
        statement: "Production artifacts, container images, and packages are cryptographically signed at build time and verified before deployment — provenance is checkable, not just claimed.",
        rationale: "Traceability today means the pipeline records what it built. Signing means production can mechanically refuse to run anything that record doesn't vouch for, instead of trusting that nothing slipped in between build and deploy.",
        tags: ["continuous-verification", "assume-credential-compromise"],
        implementedIn: [],
        gapNote: "Would require artifact signing (e.g., Sigstore/cosign) and a deployment-time signature-verification gate added to SOP-10's build/stage/production pipeline.",
      },
    ],
  },
  {
    id: "data-lifecycle",
    title: "Data Protection & Lifecycle",
    summary: "Encryption is one part of protecting data — collection, retention, and every downstream copy are the rest.",
    principles: [
      {
        id: "encryption-limits-blast-radius",
        statement: "Encryption is scoped to limit blast radius, not just to satisfy an \"encrypted at rest\" checkbox — key access follows least privilege and separation of duties.",
        rationale: "\"Encrypted at rest\" says nothing about who can decrypt it or how much a single compromised key exposes. Separating keys, and separating who manages a key from who approves access to it, is what actually bounds the damage of a single failure.",
        tags: ["blast-radius", "least-privilege"],
        implementedIn: [{ procedureCode: "SOP-01", step: "Restrict administrative access to keys" }],
      },
      {
        id: "centralized-key-rotation",
        statement: "Keys are generated and held centrally, with defined rotation — never generated or stored on an individual's machine.",
        rationale: "A key that can live anywhere is a key nobody can reliably rotate, revoke, or audit. Centralizing custody is what makes rotation and revocation actually enforceable.",
        tags: ["short-lived-identity"],
        implementedIn: [{ procedureCode: "SOP-01", step: "Own and rotate keys in Key Vault" }],
      },
      {
        id: "minimize-sensitive-data",
        statement: "Sensitive data is not collected, copied, logged, embedded, or retained without an explicit, identified need.",
        rationale: "Data that was never collected can't be breached, subpoenaed, or misused. Minimization is the one control that reduces exposure before any other control even has to work.",
        tags: ["blast-radius", "least-privilege"],
        implementedIn: [{ procedureCode: "SOP-07", step: "Collect only what the purpose needs" }],
      },
      {
        id: "retention-enforced-technically",
        statement: "Expired sensitive data is deleted automatically according to its retention schedule — retention is a technical control, not a policy sentence nobody automates.",
        rationale: "A retention schedule that depends on a person remembering to run a cleanup script is a retention schedule that slips the first time that person is on vacation during the busy quarter.",
        tags: ["continuous-verification"],
        partial: true,
        partialNote: "SOP-07 requires deletion per the retention schedule once data is no longer needed, but doesn't yet specify that deletion is enforced by an automated technical control rather than a process a person has to remember to run.",
        implementedIn: [{ procedureCode: "SOP-07", step: "Delete on schedule, not indefinitely" }],
      },
      {
        id: "copies-inherit-classification",
        statement: "Backups, replicas, logs, exports, embeddings/vectors, analytics copies, and other derived datasets inherit the classification of the data they came from — a copy doesn't get to start over at a lower sensitivity tier.",
        rationale: "A support ticket's PII doesn't stop being PII once it's embedded into a vector, excerpted into a debug log, or exported to an analytics warehouse. Classification has to travel with the data through every derived form, not just the original record.",
        tags: ["blast-radius", "tenant-isolation"],
        implementedIn: [],
        gapNote: "Would require an explicit rule — in SOP-01 or the Data Classification & Handling Policy — that a derived artifact (embedding, export, log excerpt) is tagged and protected at its source data's classification tier rather than reclassified independently. Especially relevant as the Enterprise Data Map grows to track derived and AI-processed copies, not just primary stores.",
      },
    ],
  },
  {
    id: "multi-tenancy",
    title: "Multi-Tenancy & Data Isolation",
    summary: "Keeping one tenant's data unreachable to another when — not if — a layer above the database has a bug.",
    principles: [
      {
        id: "isolation-beyond-application-layer",
        statement: "Tenant isolation is enforced at more than the application query layer — including at the data layer itself where supported (e.g., row-level security).",
        rationale: "React → API → \"WHERE tenant_id = ?\" → database is one enforcement layer. One bug in that one layer is a cross-tenant breach. Enforcement inside the database itself means an application-layer mistake doesn't automatically become a data leak.",
        tags: ["tenant-isolation", "defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Isolate tenants at more than the application layer" }],
      },
    ],
  },
  {
    id: "third-party-integration",
    title: "Third-Party & Integration Security",
    summary: "A vendor's own security posture and the specific integration ACME builds with them are two different questions.",
    principles: [
      {
        id: "vendor-assurance-is-not-integration-assurance",
        statement: "A vendor's SOC 2 or ISO 27001 certification establishes trust in the vendor — it does not establish that a specific integration with them is configured securely.",
        rationale: "A 97/100 vendor assurance score says nothing about what scopes ACME granted a specific OAuth integration, where that token lives, or whether it can be revoked in minutes. Those are answered by reviewing the integration itself, not by re-reading the vendor's audit report.",
        tags: ["assume-third-party-compromise", "independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-15", step: "Assess the integration separately from the vendor" }],
      },
      {
        id: "vendor-access-least-privilege",
        statement: "Vendor and integration access is scoped to the minimum necessary and reviewed on the same cadence as employee access — not a standing exception.",
        rationale: "A vendor integration that never gets recertified is a standing grant nobody's watching. The same access-review discipline ACME applies to its own employees applies here.",
        tags: ["least-privilege", "assume-third-party-compromise"],
        implementedIn: [{ procedureCode: "SOP-15", step: "Scope and review vendor access" }],
      },
    ],
  },
  {
    id: "ai-agent",
    title: "AI & Agent Security",
    summary: "The model recommends; the surrounding system — not the prompt — decides what it's allowed to touch.",
    principles: [
      {
        id: "authorization-outside-the-model",
        statement: "Authorization happens outside the model — a system prompt telling the model what it may or may not access is not a security boundary.",
        rationale: "A prompt instruction is a suggestion the model can be talked out of by the next clever input. Tenant- and data-scoping has to be enforced by the retrieval index or tool call before the request ever reaches the model, not by hoping the model honors an instruction.",
        tags: ["boundaries-outside-ai", "independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Enforce authorization outside the model, never inside a prompt" }],
      },
      {
        id: "agents-scoped-to-task",
        statement: "An AI agent gets only the tool permissions and data access its current task requires — never the full permission set of the account it runs under.",
        rationale: "An agent inherits an operator's full permission set by default unless someone deliberately narrows it. Scoping to the task, the same way a service account would be scoped, keeps a jailbroken or misled agent's reach bounded.",
        tags: ["least-privilege", "boundaries-outside-ai"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Scope agent permissions to the task, not the operator" }],
      },
      {
        id: "mediated-tool-calls",
        statement: "When a model requests a tool call or action, a deterministic policy-enforcement layer independently decides whether that specific action is allowed — the model's request is a proposal, not an approval.",
        rationale: "A model that can both decide an action is appropriate and cause that action to happen has no separation between recommendation and authorization. A mediation layer is what keeps those two things distinct.",
        tags: ["boundaries-outside-ai", "independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Enforce authorization outside the model, never inside a prompt" }],
      },
      {
        id: "high-impact-actions-require-approval",
        statement: "An irreversible or high-impact agent action — a refund, a production change, a data deletion — requires a deterministic authorization check and, above a defined threshold, human approval before it executes.",
        rationale: "The model recommends; a person or policy engine decides. That split matters most exactly when the action is hardest to undo.",
        tags: ["independent-authorization", "boundaries-outside-ai"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Require human oversight for consequential decisions" }],
      },
      {
        id: "rag-authorization-precedes-retrieval",
        statement: "The retrieval system enforces the requester's tenant and resource authorization before a document or embedding becomes available to the model — not after, and not by asking the model to self-filter what it was already given.",
        rationale: "Once a document is in the model's context window, asking the model to politely ignore the parts it shouldn't have seen is not a security control. The filtering has to happen before retrieval hands anything to the model.",
        tags: ["tenant-isolation", "boundaries-outside-ai"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Enforce authorization outside the model, never inside a prompt" }],
      },
      {
        id: "untrusted-prompt-content",
        statement: "User prompts, retrieved documents, web pages, emails, and tool outputs are treated as untrusted data — never as authoritative instructions — the same way a web app treats any other user-controlled input.",
        rationale: "A document retrieved into context can contain text engineered to look like a system instruction. Nothing that entered through a data path should be able to act with the authority of an instruction path.",
        tags: ["untrusted-input", "boundaries-outside-ai"],
        partial: true,
        partialNote: "SOP-16 requires pre-launch testing for prompt injection and jailbreak attempts, but doesn't yet state the broader architectural rule that retrieved or tool-returned content is treated as untrusted data by design, independent of testing.",
        implementedIn: [{ procedureCode: "SOP-16", step: "Test for prompt injection and adversarial misuse before go-live" }],
      },
      {
        id: "untrusted-model-output",
        statement: "Model output is validated before it becomes a SQL query, a shell command, an API parameter, HTML, code, or another privileged action — the model isn't trusted just because its output looked syntactically plausible.",
        rationale: "This is the same input-validation discipline SOP-10 requires of any user-controlled input, applied to a source that's easy to forget is user-influenced: the model's own output.",
        tags: ["untrusted-input", "independent-authorization"],
        implementedIn: [],
        gapNote: "Would require an output-validation/sanitization step for any AI system whose output drives a downstream action, analogous to SOP-10's input-validation-by-design requirement but applied specifically to model output.",
      },
      {
        id: "agent-egress-constrained",
        statement: "An agent workload can't arbitrarily reach loopback addresses, cloud metadata endpoints, internal networks, or the open internet unless its specific task requires it.",
        rationale: "An agent that legitimately needs internet access for its task has a much larger attack and exfiltration surface than a typical service — the same egress discipline the Network domain calls for matters even more here.",
        tags: ["boundaries-outside-ai", "blast-radius"],
        implementedIn: [],
        gapNote: "Would require the same egress-control mechanism flagged under Network & Egress's \"Constrain egress\" principle, applied specifically to agent/tool-execution workloads, which typically have a broader and less predictable network need than a standard service.",
      },
    ],
  },
  {
    id: "logging-monitoring",
    title: "Logging, Detection & Response",
    summary: "Logging enough to answer an investigation's questions, without burying the answer in noise.",
    principles: [
      {
        id: "signal-over-noise",
        statement: "Logging captures security-relevant events and their outcomes — not every routine, successful execution of a normal operation.",
        rationale: "A log of everything is functionally a log of nothing an analyst can act on in time. Scoping what's forwarded to what's actually security-relevant is what keeps the signal findable during an investigation.",
        tags: ["defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-03", step: "Capture logs that are actually useful in an investigation" }],
      },
      {
        id: "identity-follows-the-event",
        statement: "A security-relevant action is attributable to a specific human or workload identity, tenant, resource, action, and outcome — not just \"something happened.\"",
        rationale: "\"An error occurred\" is not an investigable log line. \"User X performed action Y on resource Z with outcome W\" is — attribution is what turns a log entry into evidence.",
        tags: ["independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-03", step: "Capture logs that are actually useful in an investigation" }],
      },
      {
        id: "logs-survive-compromise",
        statement: "High-value security logs leave the system being monitored and can't be altered by the workload or administrator whose own actions they record.",
        rationale: "A log an attacker (or a rogue insider) can edit isn't evidence, it's a suggestion. Logs have to be write-protected and stored somewhere the thing being monitored can't reach.",
        tags: ["assume-credential-compromise", "immutable-recovery"],
        implementedIn: [{ procedureCode: "SOP-03", step: "Retain and protect logs" }],
      },
      {
        id: "detection-accompanies-telemetry",
        statement: "Collecting a log isn't a security control by itself — it only counts once the conditions that matter are actually detected and reviewable within a useful timeframe.",
        rationale: "Telemetry sitting in a data lake nobody queries is a cost center, not a control. A defined triage SLA is what converts collection into detection.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-03", step: "Triage against a defined SLA" }],
      },
      {
        id: "trustworthy-time",
        statement: "Security systems share reliable, synchronized time, so events across different systems can actually be correlated during an investigation.",
        rationale: "A forensic timeline built from logs whose clocks disagree by even a few minutes can make an attacker's actions look like they happened in the wrong order — or on the wrong system entirely.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Keep clocks synchronized" }],
      },
    ],
  },
  {
    id: "backup-recovery",
    title: "Resilience, Backup & Recovery",
    summary: "Recovery has to survive the same compromise it's meant to recover from.",
    principles: [
      {
        id: "recovery-objectives-defined",
        statement: "Every business-critical asset has a defined recovery point and recovery time objective (RPO/RTO), set before there's ever an incident — not improvised during one.",
        rationale: "\"We'll figure out how much data loss is acceptable during the outage\" is not a recovery plan. RPO/RTO set in advance is what tells the responding team whether they're on pace or falling behind, in real time.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-06", step: "Assign a recovery tier at onboarding" }],
      },
      {
        id: "immutable-isolated-backups",
        statement: "A full compromise of production must not provide the ability to destroy all recovery copies — backups are isolated and, where feasible, immutable, using credentials and an access path separate from production's own.",
        rationale: "A backup reachable with the same credentials as production isn't a separate recovery path, it's a second copy of the same single point of failure. Isolation and immutability are what make the backup actually independent of a production compromise.",
        tags: ["immutable-recovery", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-06", step: "Configure scheduled, isolated backups" }],
      },
      {
        id: "restore-actually-tested",
        statement: "A backup that has never been successfully restored is not a proven recovery capability — it's an assumption wearing a backup's clothes.",
        rationale: "A backup job that completes without error every night for a year proves the backup process runs. It proves nothing about whether the resulting file can actually rebuild a working system.",
        tags: ["continuous-verification", "immutable-recovery"],
        implementedIn: [{ procedureCode: "SOP-06", step: "Actually test the restore" }],
      },
      {
        id: "dr-site-verified",
        statement: "A disaster-recovery or standby site is only a real standby site once someone has actually confirmed it can run production — not just that data replicates there.",
        rationale: "Data arriving at a second region proves replication works. It doesn't prove that region has the compute, network, and configuration to actually serve production traffic if called on.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-06", step: "Replicate Tier 1 workloads" }],
      },
    ],
  },
];

// --- Derivation & validation, same pattern as procedures.js: every
// `implementedIn` reference is checked against the real PROCEDURES data at
// load time (a typo'd step title fails the build, not the page), each
// principle's controlIds are read off the steps it points to rather than
// hand-typed, and `status` is computed rather than asserted — a principle
// can't claim "operationalized" just because someone wrote that word next
// to it. See the file header for what each status means.
const FOUNDATIONAL_IDS = new Set(FOUNDATIONAL_PRINCIPLES.map((f) => f.id));

function resolveStepRef(domainId, principleId, { procedureCode, step: stepTitle }) {
  const proc = PROCEDURES.find((p) => p.code === procedureCode);
  if (!proc) {
    throw new Error(`securityPrinciples.js: domain "${domainId}" principle "${principleId}" references ${procedureCode}, which doesn't exist in procedures.js`);
  }
  const step = proc.steps.find((s) => s.title === stepTitle);
  if (!step) {
    throw new Error(`securityPrinciples.js: domain "${domainId}" principle "${principleId}" references a step titled "${stepTitle}" on ${procedureCode}, which doesn't exist — check for drift against procedures.js`);
  }
  return { procedureCode, procedureId: proc.id, procedureTitle: proc.title, step: stepTitle, controlIds: step.controls || [] };
}

export const PRINCIPLE_DOMAINS = PRINCIPLE_DOMAIN_DEFS.map((domain) => ({
  ...domain,
  principles: domain.principles.map((p) => {
    (p.tags || []).forEach((t) => {
      if (!FOUNDATIONAL_IDS.has(t)) {
        throw new Error(`securityPrinciples.js: domain "${domain.id}" principle "${p.id}" tags unknown foundational principle "${t}"`);
      }
    });
    const implementedIn = (p.implementedIn || []).map((ref) => resolveStepRef(domain.id, p.id, ref));
    const controlIds = [...new Set(implementedIn.flatMap((r) => r.controlIds))];

    if (implementedIn.length === 0 && !p.gapNote) {
      throw new Error(`securityPrinciples.js: domain "${domain.id}" principle "${p.id}" has no implementedIn and no gapNote — a not-operationalized principle must explain what building it would take`);
    }
    if (p.partial && (implementedIn.length === 0 || !p.partialNote)) {
      throw new Error(`securityPrinciples.js: domain "${domain.id}" principle "${p.id}" is marked partial but is missing a linked step or a partialNote`);
    }

    const status = implementedIn.length === 0 ? "not-operationalized" : p.partial ? "partial" : "operationalized";

    return { ...p, implementedIn, controlIds, status };
  }),
}));

export const STATUS_META = {
  operationalized: { label: "Operationalized" },
  partial: { label: "Partially Operationalized" },
  "not-operationalized": { label: "Not Yet Operationalized" },
};

// A simple, honest, mechanically-derived rollup — never hand-typed — for the
// page header. Nothing here claims per-system coverage; it's just a count
// across the principles actually defined above.
export const PRINCIPLE_STATUS_COUNTS = PRINCIPLE_DOMAINS.reduce(
  (acc, d) => {
    d.principles.forEach((p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      acc.total += 1;
    });
    return acc;
  },
  { operationalized: 0, partial: 0, "not-operationalized": 0, total: 0 }
);
