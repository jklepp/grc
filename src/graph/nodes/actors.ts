// Actor — a human or machine identity that calls into a system from outside
// its boundary. This is "who or what is knocking," which is a different
// question from Org's `user` kind (orgs.ts): an Org user is who is
// internally ACCOUNTABLE for a control or risk, not who is making requests
// against a system at runtime. Kept in its own id space so the two never
// collide even where the same person or account could plausibly answer to
// both descriptions.
//
// An Actor carries no control coverage of its own — it isn't a resource
// inside the boundary the way an Asset is. Where the actor's credential IS a
// resource that needs its own control evidence (rotation, storage, MFA), that
// stays modelled as an Asset in the control plane (e.g. AST-042-03); the
// Actor here is the identity behind it that the request path actually
// starts from, cross-referenced by name rather than merged into one entity,
// since "the credential as a thing to secure" and "the identity making the
// call" are different facts even when they're the same account.
import type { ActorId } from "../ids";

export const ACTOR_KINDS = { HUMAN: "human", MACHINE: "machine" } as const;
export type ActorKind = (typeof ACTOR_KINDS)[keyof typeof ACTOR_KINDS];

export interface Actor {
  id: ActorId;
  name: string;
  kind: ActorKind;
  description: string;
}

export const ACTORS: Actor[] = [
  {
    id: "ACTOR-CUSTOMER",
    name: "Authenticated Customer",
    kind: ACTOR_KINDS.HUMAN,
    description: "Product UI",
  },
  {
    id: "ACTOR-PARTNER-API",
    name: "Partner API Integration",
    kind: ACTOR_KINDS.MACHINE,
    description: "Direct API access",
  },
  {
    id: "ACTOR-WORKDAY-INTEGRATION",
    name: "Integration Service Account",
    kind: ACTOR_KINDS.MACHINE,
    description: "Integration credential",
  },
  {
    id: "ACTOR-MODEL-PROVIDER",
    name: "Third-Party Model Provider",
    kind: ACTOR_KINDS.MACHINE,
    description: "External LLM API",
  },
  {
    id: "ACTOR-PAYROLL-PROCESSOR",
    name: "External Payroll Processor",
    kind: ACTOR_KINDS.MACHINE,
    description: "External payroll vendor",
  },
  {
    id: "ACTOR-PLATFORM-ADMIN",
    name: "Platform Administrator",
    kind: ACTOR_KINDS.HUMAN,
    description: "Privileged IAM access",
  },
  {
    id: "ACTOR-EXTERNAL-SAAS",
    name: "External SaaS / Tool APIs",
    kind: ACTOR_KINDS.MACHINE,
    description: "Agent tool destinations",
  },
];

export const ACTOR_BY_ID: Record<ActorId, Actor> = Object.fromEntries(ACTORS.map((a) => [a.id, a]));
