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
        implementedIn: [{ procedureCode: "SOP-10", step: "Constrain server-side requests to prevent SSRF" }],
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
        gapNote: "Would require an explicit rule — in SOP-01 or the Data Classification & Handling Policy — that a derived artifact (embedding, export, log excerpt) is tagged and protected at its source data's classification tier rather than reclassified independently. Especially relevant as the Systems Data Flow page grows to track derived and AI-processed copies, not just primary stores.",
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
    id: "api-security",
    title: "API Security",
    summary: "An authenticated caller is not an authorized caller — every object, field, and function gets its own check.",
    principles: [
      {
        id: "api-object-authorization",
        statement: "Every API request that references a specific object — by integer ID, UUID, filename, or account/tenant/transaction identifier — is authorized server-side against that specific object, not inferred from a valid session or an identifier being hard to guess.",
        rationale: "Knowing or guessing an object ID is not the same claim as being allowed to act on it. An unguessable UUID raises the cost of guessing; it doesn't check permission, and treating it as if it did is how `DELETE /users/414` becomes reachable by anyone who can enumerate or intercept an ID.",
        tags: ["independent-authorization", "untrusted-input"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Enforce object-level authorization on every request" }],
      },
      {
        id: "api-property-authorization",
        statement: "A caller authorized to access an object is not automatically authorized to read or modify every field on it — responses return only what the calling function needs, and write endpoints define an explicit allowlist of fields rather than binding arbitrary JSON properties to protected attributes.",
        rationale: "Serializing a full database row and trusting the frontend to hide sensitive fields is how excessive data exposure happens. Binding incoming JSON directly to application/database properties is how a `PATCH` request adding `\"is_admin\": true` becomes a privilege escalation the API never actually decided to allow.",
        tags: ["independent-authorization", "untrusted-input", "least-privilege"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Authorize what a request can read or write, not just the object" }],
      },
      {
        id: "api-function-authorization",
        statement: "Authorization is evaluated against the specific function or action being requested — read, write, delete, approve, export, administrative, bulk — not merely against whether the caller can reach the object or the API at all.",
        rationale: "Being able to `GET` a resource says nothing about whether the same caller may `DELETE` it, and a route that's only reachable by not being linked in the UI is hidden, not authorized. Function-level checks are what stop a standard user from reaching an administrative or bulk action a more privileged role was meant to gate.",
        tags: ["independent-authorization", "least-privilege", "default-deny"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Scope authorization to the requested function, not just the object" }],
      },
      {
        id: "gateway-is-not-authorization",
        statement: "An API gateway, WAF, load balancer, or identity-aware proxy establishes an outer boundary — coarse authentication, filtering, routing — it does not perform application or data authorization for the services behind it.",
        rationale: "\"The gateway accepted a valid JWT\" and \"everything behind the gateway is trusted\" are not the same claim, and collapsing them is how a single compromised or misconfigured internal service becomes a path around every check the edge was supposed to enforce.",
        tags: ["independent-authorization", "defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Treat the API gateway as a boundary, not the authorization decision" }],
      },
      {
        id: "api-token-claims-validated",
        statement: "An API accepting a bearer or JWT token validates its signature, algorithm, issuer, audience, expiration, and scopes before trusting any claim in it, fails closed on any mismatch, and — where OAuth 2.0/OIDC is used — follows current best practice: Authorization Code flow with PKCE, exact redirect validation, short-lived single-use codes, refresh-token rotation, and minimum scopes, never the Resource Owner Password Credentials grant.",
        rationale: "A token that's merely decoded and read, without verifying who issued it, for whom, and with what algorithm, is a token an attacker can forge or replay from a different context. An OAuth access token proves delegated authorization context, not blanket access — the object/property/function checks above still apply to what it's allowed to do.",
        tags: ["independent-authorization", "untrusted-input", "assume-credential-compromise"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Validate bearer tokens and OAuth flows on every call" }],
      },
      {
        id: "api-contract-enforced",
        statement: "APIs reject requests outside their declared schema — unexpected fields, wrong types, out-of-bounds values — and responses are held to the same contract: only approved fields, no internal implementation details, no credentials or tokens, no unnecessary Restricted data.",
        rationale: "A schema nobody validates against at runtime is documentation, not a control. Enforcing it in both directions is what keeps a spec describing actual behavior instead of drifting into something nobody can trust — and response-side enforcement is the mechanical backstop for property-level authorization.",
        tags: ["untrusted-input", "secure-by-default"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Enforce the API contract on requests and responses" }],
      },
      {
        id: "api-inventory-complete",
        statement: "Every production API and endpoint is tracked with an owner, purpose, classification, authentication/authorization model, and lifecycle status — an API nobody registered isn't a known API, whatever traffic it's actually serving.",
        rationale: "Answering \"are our APIs secure\" is impossible before answering \"what APIs exist.\" An inventory that only reflects what a team remembers to register is a map that's already wrong the day an endpoint ships without going through the process.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Maintain a complete API inventory — and retire what's no longer in it" }],
      },
      {
        id: "shadow-zombie-apis-removed",
        statement: "APIs actually reachable at runtime are reconciled against the approved inventory, so a shadow API (deployed but never registered) or a zombie API (a deprecated version nobody retired) doesn't stay reachable indefinitely just because no one noticed.",
        rationale: "An old `/api/v1` left running because someone might still be using it is exactly the endpoint that stops getting security fixes first. Runtime discovery is what catches the gap between what's registered and what's actually exposed.",
        tags: ["continuous-verification", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Maintain a complete API inventory — and retire what's no longer in it" }],
      },
      {
        id: "api-version-lifecycle-governed",
        statement: "Every API version has an owner, a deprecation date, and a retirement date, and a security fix lands on every supported version — not only the newest one — until it's actually retired.",
        rationale: "APIs need lifecycle management the same way software does. A vulnerable legacy version that stays reachable because retiring it might break someone's integration is a risk decision made by default, not one anyone actually signed off on.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Maintain a complete API inventory — and retire what's no longer in it" }],
      },
      {
        id: "api-resource-consumption-bounded",
        statement: "Rate limits, quotas, payload/response size limits, pagination caps, and timeouts are set per endpoint based on its actual cost, applied at the identity boundary that matters — per-user, per-client, or per-tenant, not source IP alone — with expensive operations (exports, search, bulk actions, AI calls) getting stricter bounds or asynchronous handling.",
        rationale: "A rate limit keyed only to source IP treats an entire NAT'd office as one caller, which either blocks legitimate users together or protects nobody. And not every request costs the same — a report-generation endpoint with a web-request rate limit is a denial-of-wallet path with a compliant-looking configuration in front of it.",
        tags: ["default-deny", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Bound resource consumption per endpoint, not just per request" }],
      },
      {
        id: "sensitive-business-flows-protected",
        statement: "A request that's fully authenticated and authorized can still be an abusive pattern — automated account creation, coupon or referral abuse, ticket/inventory hoarding, password-reset flooding — and sensitive business flows get velocity limits, per-account thresholds, or risk-based friction on top of the standard authorization check.",
        rationale: "`HTTP 200 + a valid session` proves the request was allowed, not that the business action behind it is legitimate. That's a different question, and answering it requires controls authorization alone was never designed to provide.",
        tags: ["untrusted-input", "default-deny"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Protect sensitive business flows from automation abuse" }],
      },
      {
        id: "server-side-destinations-constrained",
        statement: "A destination an API accepts or derives from caller input — a webhook target, callback, image or import URL, redirect — never becomes unrestricted server-side network access; loopback, link-local, cloud metadata endpoints, and private ranges are blocked unless a specific task requires one, and redirects are revalidated rather than followed blindly.",
        rationale: "This is the constrained-egress principle applied to the specific case where the destination itself is attacker-influenced input, not just outbound traffic in general — the same SSRF path that turns an image-import feature into a cloud-credential theft primitive if the server will connect to whatever URL it's handed.",
        tags: ["untrusted-input", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Constrain server-side requests to prevent SSRF" }],
      },
      {
        id: "service-identity-required",
        statement: "Every service-to-service call carries an attributable workload identity — not source IP, VPC membership, or \"it's behind the firewall\" — and when one service calls another on a user's or tenant's behalf, the receiving service evaluates the caller workload, the originating identity, the tenant, and the target resource together rather than trusting that the caller was allowed to ask.",
        rationale: "A highly privileged backend service that trusts any request from a known caller IP is a confused deputy waiting for the first caller that shouldn't have asked. Preserving identity and tenant context through the call chain is what keeps one tenant's request from silently operating on another tenant's resource three services downstream.",
        tags: ["independent-authorization", "short-lived-identity", "tenant-isolation"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Authenticate and authorize every service call, including internal ones" }],
      },
      {
        id: "internal-apis-not-trusted-by-location",
        statement: "An API reachable only from the VPC, the cluster, or the corporate network still gets authorization, encryption, input validation, and logging appropriate to its risk — regardless of protocol (REST, GraphQL, gRPC, or an internal message API) — because network location is never the only security boundary.",
        rationale: "Internal APIs routinely carry higher-privilege functionality than anything public-facing, precisely because nobody expected them to need public-grade defenses. That assumption is exactly what a single compromised internal host turns into a lateral-movement highway.",
        tags: ["defense-in-depth", "least-privilege"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Authenticate and authorize every service call, including internal ones" }],
      },
      {
        id: "third-party-api-data-untrusted",
        statement: "A response from another API — including a trusted vendor's — is untrusted payload: schema, content type, and size are validated, timeouts are enforced, and the data is sanitized before it reaches a downstream interpreter, template, or query.",
        rationale: "A trusted vendor is not a trusted payload. A compromised or simply buggy partner API returning unexpected data must not become injection or remote code execution inside ACME just because the call that fetched it was legitimate.",
        tags: ["untrusted-input", "assume-third-party-compromise"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Treat data from another API as untrusted input" }],
      },
      {
        id: "api-telemetry-attributable",
        statement: "API telemetry answers, per call, who or what called which endpoint, for which tenant, with what authorization decision and outcome — and access tokens, API keys, passwords, and full Restricted-tier payloads are never logged in the clear to get there.",
        rationale: "\"The endpoint returned a 200\" doesn't tell an investigator who called it, for which customer, or whether the authorization check that mattered actually ran. Attribution is what turns API telemetry into evidence instead of a request count.",
        tags: ["independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-03", step: "Capture telemetry that can reconstruct an API call" }],
      },
      {
        id: "api-negative-authorization-tested",
        statement: "API changes are tested for whether every invalid or unauthorized request actually fails — broken object/property/function-level authorization, tenant escape, expired or wrong-audience tokens, missing scopes — not only whether a valid request succeeds, with representative cases run as automated regression tests in CI/CD.",
        rationale: "Testing only the happy path proves the feature works; it says nothing about whether the authorization check around it does. Multi-tenant SaaS in particular needs \"Tenant A's token against Tenant B's object → deny\" as a standing regression test, or a future refactor can silently reintroduce a broken-authorization bug nobody notices until a customer does.",
        tags: ["continuous-verification", "independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Run negative-authorization and contract-drift tests in CI/CD" }],
      },
      {
        id: "api-replay-sensitive-actions-protected",
        statement: "A state-changing operation that must not execute twice — a payment, a refund, provisioning, an order — uses an idempotency key, nonce, or duplicate-transaction check so a retry can't repeat it; an inbound webhook is verified by signature, timestamp window, and event-ID deduplication rather than trusted because the URL is hard to guess.",
        rationale: "A network retry and a replayed or forged webhook look identical to an API that isn't checking — both are \"a request that already happened, arriving again.\" Idempotency and replay verification are the same control applied to two different sources of the same failure mode.",
        tags: ["untrusted-input", "assume-credential-compromise"],
        implementedIn: [{ procedureCode: "SOP-10", step: "Protect sensitive operations against replay" }],
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
        implementedIn: [{ procedureCode: "SOP-16", step: "Require human oversight, tiered to the action's impact" }],
      },
      {
        id: "ai-actions-risk-tiered",
        statement: "Every AI or agent action is classified in advance into a read-only, reversible-write, or sensitive/high-impact tier, and that tier — set by policy, not claimed by the model — determines whether the action runs automatically, runs within a policy limit, or needs a human in the loop.",
        rationale: "Asking whether an action needs approval only works if something other than the model is answering. Pre-classifying the tiers means the policy layer can enforce the answer instead of evaluating the model's own claim about how consequential its own request is.",
        tags: ["boundaries-outside-ai", "independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Require human oversight, tiered to the action's impact" }],
      },
      {
        id: "high-impact-output-independently-verified",
        statement: "Where AI output drives a material security, legal, financial, or operational decision, the model's stated confidence is never the verification — the strength of independent grounding (citations, an authoritative-system lookup, deterministic validation, or human review) scales with how costly a wrong answer would be.",
        rationale: "A model that sounds certain and a model that's correct are not the same claim, and there's no reliable way to tell them apart from the output alone. The higher the cost of being wrong, the less that distinction can be left unverified.",
        tags: ["untrusted-input", "independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Require human oversight, tiered to the action's impact" }],
      },
      {
        id: "rag-authorization-precedes-retrieval",
        statement: "The retrieval system enforces the requester's tenant and resource authorization before a document or embedding becomes available to the model — not after, and not by asking the model to self-filter what it was already given.",
        rationale: "Once a document is in the model's context window, asking the model to politely ignore the parts it shouldn't have seen is not a security control. The filtering has to happen before retrieval hands anything to the model.",
        tags: ["tenant-isolation", "boundaries-outside-ai"],
        implementedIn: [
          { procedureCode: "SOP-16", step: "Enforce authorization outside the model, never inside a prompt" },
          { procedureCode: "SOP-16", step: "Secure the vector index and retrieval pipeline" },
        ],
      },
      {
        id: "rag-index-integrity",
        statement: "A vector store or retrieval index enforces tenant and document-level authorization inside the index itself, and a document's authorization metadata, revocation, or deletion propagates into the index rather than leaving a stale copy searchable.",
        rationale: "An embedding is a representation of the data it was built from, not a lower-sensitivity derivative of it — the retrieval-authorization principle above only holds if the index itself can't be queried around it.",
        tags: ["tenant-isolation", "boundaries-outside-ai"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Secure the vector index and retrieval pipeline" }],
      },
      {
        id: "training-data-integrity",
        statement: "Training data, fine-tuning sets, and RAG source documents are ingested only from authorized sources, with restricted write access, an audit trail, and the ability to roll back a source found to be compromised or poisoned.",
        rationale: "A model is only as trustworthy as what it learned from or retrieves. Deliberately contaminating a training set or a knowledge base is a real, demonstrated attack path — the same discipline applied to any other production data store's write access has to apply to the data that shapes what a model says.",
        tags: ["untrusted-input", "continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Track training, fine-tuning, and retrieval data provenance — and guard against poisoning" }],
      },
      {
        id: "untrusted-prompt-content",
        statement: "Everything that enters a model's context other than the application's own trusted instructions is treated as untrusted data — direct prompts, retrieved documents, web pages, email, uploaded files, database content, API and MCP responses, other tool output, agent-to-agent messages, and an agent's own persistent memory — never as an authoritative instruction, regardless of where it appears in the context window.",
        rationale: "A document retrieved into context can contain text engineered to look like a system instruction, and it doesn't matter whether that text arrived through a web page, a database row, or another agent's message — nothing that entered through a data path gets to act with the authority of an instruction path just because it's now inside the same context window as a real one.",
        tags: ["untrusted-input", "boundaries-outside-ai"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Separate instructions from untrusted context" }],
      },
      {
        id: "untrusted-model-output",
        statement: "Model output is validated before it becomes a SQL query, a shell command, an API parameter, a URL, HTML, source code, an IAM or cloud action, a database write, a file path, or another privileged action — the model isn't trusted just because its output looked syntactically plausible.",
        rationale: "This is the same input-validation discipline SOP-10 requires of any user-controlled input, applied to a source that's easy to forget is user-influenced: the model's own output.",
        tags: ["untrusted-input", "independent-authorization"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Validate model output before it crosses a trust boundary" }],
      },
      {
        id: "credentials-outside-model",
        statement: "The model itself never holds a reusable credential — an OAuth token, API key, database credential, or cloud secret is held by the surrounding harness or a credential broker and attached to a request only after authorization succeeds.",
        rationale: "A model that holds the actual secret can leak it in output, hand it to a manipulated tool call, or have it extracted through a crafted prompt. Keeping credentials outside the model entirely means there's nothing there to leak in the first place — the same reasoning that keeps a service from embedding a database password in its own source.",
        tags: ["boundaries-outside-ai", "short-lived-identity", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Keep reusable credentials out of the model" }],
      },
      {
        id: "mcp-is-security-boundary",
        statement: "Connecting an MCP server or tool to an agent is a privileged integration, inventoried and reviewed the same way any other third-party integration is — not a lightweight configuration change.",
        rationale: "An MCP server is code ACME didn't write, running with whatever access the agent grants it. Treating that connection as casual is how a convenience integration quietly becomes the widest, least-reviewed access path into ACME's data.",
        tags: ["assume-third-party-compromise", "boundaries-outside-ai"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Treat tools and MCP servers as privileged integrations" }],
      },
      {
        id: "tool-schema-enforcement",
        statement: "Tool calls are constrained by a strongly defined schema — an unknown parameter, an unexpected action, or a model-generated command standing in for a specific action API is rejected, not passed through.",
        rationale: "A model that can phrase its way into a broader action than the one it was given a tool for has effectively escalated its own privilege. A schema that only accepts the exact shape of request a tool was built for closes that path regardless of how persuasive the phrasing is.",
        tags: ["boundaries-outside-ai", "independent-authorization", "default-deny"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Treat tools and MCP servers as privileged integrations" }],
      },
      {
        id: "tool-execution-isolated",
        statement: "An agent that executes code, manipulates files, browses the web, or runs system commands runs inside a constrained execution environment — non-root, minimally mounted, resource-limited, and isolated from the host — not inside the same trust zone as an ordinary inference-only workload.",
        rationale: "The blast radius of a compromised code-execution agent is a compromised host, not just a bad answer. The isolation a container or sandbox already provides other untrusted workloads applies at least as strongly here.",
        tags: ["blast-radius", "least-privilege", "defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Sandbox high-risk tool execution" }],
      },
      {
        id: "agent-egress-constrained",
        statement: "An agent workload can't arbitrarily reach loopback addresses, cloud metadata endpoints, internal networks, or the open internet unless its specific task requires it.",
        rationale: "An agent that legitimately needs internet access for its task has a much larger attack and exfiltration surface than a typical service — the same egress discipline the Network domain calls for matters even more here.",
        tags: ["boundaries-outside-ai", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Constrain agent egress by default" }],
      },
      {
        id: "agent-memory-governed",
        statement: "Persistent agent memory is a governed, classified datastore — scoped to its tenant or user, authorized like any other read or write, retained on a defined schedule, auditable, and deletable — not an extension of the model's own trusted judgment.",
        rationale: "Memory the model wrote to itself is still just stored data, and can still be poisoned, leaked across tenants, or kept indefinitely by default if nobody applies the same controls any other datastore gets. Trusting it because the model produced it is the same mistake as trusting any other model output.",
        tags: ["tenant-isolation", "untrusted-input"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Treat agent memory as governed data, not trusted model state" }],
      },
      {
        id: "system-prompts-contain-no-secrets",
        statement: "A system prompt or prompt template never contains a credential, encryption key, or other secret whose confidentiality the security model depends on — it's written assuming it may eventually be disclosed.",
        rationale: "A system prompt is closer to client-side code than server-side secret storage — a clever enough prompt or a misconfigured log can surface it. If the whole security model collapses when the prompt leaks, the boundary was drawn in the wrong place, not the prompt insufficiently hidden.",
        tags: ["boundaries-outside-ai", "secure-by-default"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Keep secrets out of system prompts and templates" }],
      },
      {
        id: "agent-execution-bounded",
        statement: "AI and agent workloads carry explicit consumption limits — rate limits, token/context and cost thresholds, and a deterministic maximum number of steps or tool calls per task — so a model can't drive unbounded spend or keep calling itself because it decided a task wasn't finished.",
        rationale: "A traditional service that loops forever or floods an API is a bug an on-call engineer would catch quickly. A model that decides on its own a task needs one more tool call, indefinitely, fails the same way but looks like normal operation until the bill or the outage makes it obvious.",
        tags: ["default-deny", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Bound AI consumption and agent execution loops" }],
      },
      {
        id: "ai-supply-chain-verified",
        statement: "A foundation model, downloaded weights, a fine-tune, an inference runtime, an agent framework, or an MCP server is a software supply-chain artifact — pulled from a trusted, version-pinned source and checked for integrity before it's trusted, the same as any other dependency.",
        rationale: "A model downloaded from a public repository is code and data ACME didn't write, verified only by its popularity unless someone actually checks it. That's exactly the gap software supply-chain attacks already exploit outside AI — there's no reason to assume it doesn't apply here too.",
        tags: ["assume-third-party-compromise", "continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Protect AI artifacts across their lifecycle" }],
      },
      {
        id: "model-artifacts-protected",
        statement: "A proprietary model, fine-tune, or training dataset ACME builds is protected as a high-value asset — restricted access, monitored transfers, and encrypted storage — proportional to what it would cost to lose, not treated as an ordinary file.",
        rationale: "A model ACME trained on its own data can be as sensitive as the data it was trained on, and takes real investment to reproduce. Applicable teams need to protect it the way they'd protect the source data, not assume a model file is somehow less exposed than a database export.",
        tags: ["blast-radius", "assume-credential-compromise"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Protect AI artifacts across their lifecycle" }],
      },
      {
        id: "ai-telemetry-reconstructs-actions",
        statement: "Production AI telemetry is sufficient to answer, after the fact, who or what caused which agent to access which information and take which action, under which policy and model version — not just that \"a request happened.\"",
        rationale: "An incident review that can't attribute an AI action to a requesting identity, a model version, and a policy decision can't actually determine what went wrong or whether it'll happen again. Attribution is what turns AI telemetry into evidence instead of noise.",
        tags: ["continuous-verification", "boundaries-outside-ai"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Capture AI telemetry that can reconstruct who did what" }],
      },
      {
        id: "ai-runtime-anomalies-detected",
        statement: "Deployed AI and agent systems are monitored for the failure patterns specific to how they misbehave — repeated denied tool calls, abnormal recursion, unusual outbound destinations, cross-tenant authorization failures, sudden cost spikes — not just the general telemetry every other system gets.",
        rationale: "Pre-launch red-teaming only catches what someone thought to test. An agent that starts behaving strangely in production — quietly, without an obvious outage — needs its own detection surface, or nobody notices until the consequence shows up somewhere else.",
        tags: ["continuous-verification", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Watch for anomalous AI and agent behavior in production" }],
      },
      {
        id: "ai-kill-switch-independent",
        statement: "ACME can disable an AI feature or tool, revoke an agent's credentials, block a model or provider, isolate a poisoned source, or terminate an active agent workflow through a deterministic control the surrounding system enforces — without depending on the model itself to cooperate.",
        rationale: "A model that's been jailbroken or is actively misbehaving is exactly the situation where asking it nicely to stop doesn't work. Containment has to be something the system does to the model, not something the model agrees to.",
        tags: ["boundaries-outside-ai", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Maintain an AI kill switch, independent of model cooperation" }],
      },
      {
        id: "model-changes-trigger-revalidation",
        statement: "A material change to an AI system — a model upgrade, a new provider, a prompt-template change affecting security behavior, a new tool or RAG source, increased tool privilege, or a provider silently changing a hosted model's behavior — triggers a re-evaluation proportional to its risk, not a routine update nobody re-reviews.",
        rationale: "Application code that doesn't change can still get materially riskier underneath it when the model it calls changes. Treating a model swap as equivalent to a routine dependency bump misses exactly the kind of change most likely to alter security-relevant behavior.",
        tags: ["continuous-verification"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Re-validate on material AI or model change" }],
      },
      {
        id: "ai-security-regression-testing",
        statement: "Prompt injection, jailbreak, and related adversarial testing is repeatable, not a one-time pre-launch gate — the same scenarios are re-run after a material change, and a previously-mitigated behavior is kept as a regression test so an upgrade can't silently reintroduce it.",
        rationale: "A model, prompt, or provider upgrade can quietly undo a fix that testing already caught once, with nothing else in the deployment process likely to notice. Regression tests are what makes a past finding stay fixed instead of staying fixed only until the next upgrade.",
        tags: ["continuous-verification", "untrusted-input"],
        implementedIn: [{ procedureCode: "SOP-16", step: "Test for prompt injection and adversarial misuse — continuously, not just once" }],
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
