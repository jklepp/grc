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
