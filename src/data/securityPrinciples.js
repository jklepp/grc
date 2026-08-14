// Security Engineering Principles — a technical-architecture cut through the
// same procedure library, organized by discipline (Identity, Network,
// DevSecOps...) instead of by procedural ownership. This page exists because
// a framework crosswalk can score every control "Implemented" while still
// missing an architectural premise like "authentication isn't authorization"
// or "tenant isolation can't live in the application layer alone" — premises
// that are easy to state abstractly but only mean something once they're
// concrete requirements inside a real SOP step.
//
// Nothing here is a parallel source of truth: every principle below points
// back at the specific SOP step(s) that actually operationalize it, and the
// control IDs shown are derived by reading those steps' own `controls`
// arrays at load time — never hand-typed — so a principle can't claim
// coverage its linked step doesn't actually have. See the validation block
// at the bottom, same pattern as procedures.js.
import { PROCEDURES } from "./procedures";

// The small set of cross-cutting ideas everything below traces back to. Kept
// deliberately short — this is meant to be a handful of ideas a reviewer can
// actually hold in their head, not a second taxonomy to memorize.
export const FOUNDATIONAL_PRINCIPLES = [
  { id: "default-deny", title: "Default Deny", detail: "Access, network paths, and permissions start closed and are opened deliberately — nothing is reachable by default." },
  { id: "least-privilege", title: "Least Privilege", detail: "Every identity — human, service, or AI agent — holds only the access its current task requires, no more, no longer than needed." },
  { id: "short-lived-identity", title: "Short-Lived Identity", detail: "Credentials expire and rotate automatically wherever the platform supports it, instead of remaining valid indefinitely." },
  { id: "blast-radius", title: "Minimize Blast Radius", detail: "Every design decision asks: if this credential, workload, or component is fully compromised, what can the attacker actually reach?" },
  { id: "defense-in-depth", title: "Defense in Depth", detail: "Critical boundaries are enforced at more than one independent layer, so a single bug or failure doesn't become a full breach." },
  { id: "tenant-isolation", title: "Strong Tenant Isolation", detail: "Customer or tenant data is walled off by more than an application query — enforcement holds even if the app layer has a bug." },
  { id: "independent-authorization", title: "Independent Authorization", detail: "Authentication proves identity; a separate, explicit check proves permission for the specific resource and action requested." },
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
    ],
  },
  {
    id: "network",
    title: "Network",
    summary: "Segmentation, inspection, and encryption for traffic and the perimeter it crosses.",
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
    ],
  },
  {
    id: "devsecops",
    title: "DevSecOps & CI/CD",
    summary: "How code becomes a production artifact, and what has to be true along the way.",
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
    ],
  },
  {
    id: "data-encryption",
    title: "Data Protection & Encryption",
    summary: "Encryption and key management as blast-radius control, not a checkbox.",
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
    ],
  },
  {
    id: "logging-monitoring",
    title: "Logging & Monitoring",
    summary: "Logging enough to answer an investigation's questions, without burying the answer in noise.",
    principles: [
      {
        id: "signal-over-noise",
        statement: "Logging captures security-relevant events and their outcomes — not every routine, successful execution of a normal operation.",
        rationale: "A log of everything is functionally a log of nothing an analyst can act on in time. Scoping what's forwarded to what's actually security-relevant is what keeps the signal findable during an investigation.",
        tags: ["defense-in-depth"],
        implementedIn: [{ procedureCode: "SOP-03", step: "Capture logs that are actually useful in an investigation" }],
      },
    ],
  },
  {
    id: "backup-recovery",
    title: "Backup & Recovery",
    summary: "Recovery has to survive the same compromise it's meant to recover from.",
    principles: [
      {
        id: "immutable-isolated-backups",
        statement: "A full compromise of production must not provide the ability to destroy all recovery copies — backups are isolated and, where feasible, immutable.",
        rationale: "A backup reachable with the same credentials as production isn't a separate recovery path, it's a second copy of the same single point of failure. Isolation and immutability are what make the backup actually independent of a production compromise.",
        tags: ["immutable-recovery", "blast-radius"],
        implementedIn: [{ procedureCode: "SOP-06", step: "Configure scheduled, isolated backups" }],
      },
    ],
  },
];

// --- Derivation & validation, same pattern as procedures.js: every
// `implementedIn` reference is checked against the real PROCEDURES data at
// load time (a typo'd step title fails the build, not the page), and each
// principle's controlIds are read off the steps it points to rather than
// hand-typed, so a principle's claimed coverage can never drift from the SOP
// step that actually backs it.
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
    return { ...p, implementedIn, controlIds };
  }),
}));
