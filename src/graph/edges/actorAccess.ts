// ACTOR —[calls]→ ASSET, the request path's real starting and ending points.
//
// Kept as its own edge list rather than folded into DATA_FLOWS: a DataFlow
// connects two assets already inside a system's boundary and carries data
// types, but an Actor isn't an asset and doesn't hold data — it's the
// identity outside the boundary that a system's request path either starts
// from or hands off to.
//
// `direction` records which way the call goes — inbound (the actor calls
// in) or outbound (one of our assets calls out to it, e.g. a third-party
// model provider) — because that's a real fact worth keeping even though
// both kinds render together in the same Actors stage rather than being
// split into separate categories on the diagram. `assetId` is whichever
// asset the call touches: the ingress asset for an inbound actor, or
// whichever interior asset makes the call for an outbound one — the model
// provider, for instance, is reached from a mid-flow compute service, not
// the last hop, so this isn't tied to depth the way a stage position is.
import type { ActorId, AssetId } from "../ids";

export const ACTOR_DIRECTIONS = { INBOUND: "inbound", OUTBOUND: "outbound" } as const;
export type ActorDirection = (typeof ACTOR_DIRECTIONS)[keyof typeof ACTOR_DIRECTIONS];

export interface ActorAccess {
  id: string;
  actorId: ActorId;
  assetId: AssetId;
  direction: ActorDirection;
  note?: string;
}

export const ACTOR_ACCESS: ActorAccess[] = [
  { id: "ACC-003-01", actorId: "ACTOR-CUSTOMER", assetId: "AST-003-10", direction: "inbound", note: "Authenticated customer query enters through the WAF." },
  { id: "ACC-003-03", actorId: "ACTOR-PARTNER-API", assetId: "AST-003-10", direction: "inbound", note: "Partner integrations call the gateway directly with an API key, outside the product UI." },
  { id: "ACC-003-04", actorId: "ACTOR-PLATFORM-ADMIN", assetId: "AST-003-16", direction: "inbound", note: "Privileged administrators authenticate via IAM roles and SSO rather than the public API surface." },
  { id: "ACC-042-01", actorId: "ACTOR-WORKDAY-INTEGRATION", assetId: "AST-042-02", direction: "inbound", note: "Every integration authenticates as this single account before calling the API Endpoint." },

  { id: "ACC-003-02", actorId: "ACTOR-MODEL-PROVIDER", assetId: "AST-003-11", direction: "outbound", note: "Prompts and completions are exchanged with the third-party model provider through the model gateway, using keys resolved from Secrets Manager." },
  { id: "ACC-003-05", actorId: "ACTOR-EXTERNAL-SAAS", assetId: "AST-003-15", direction: "outbound", note: "Represents external SaaS APIs and internet destinations agent tool calls may reach, subject to destination allow-listing." },
  { id: "ACC-042-02", actorId: "ACTOR-PAYROLL-PROCESSOR", assetId: "AST-042-04", direction: "outbound", note: "Compensation data is released to the external payroll processor on the pay-cycle schedule." },
];

export function actorAccessForAsset(assetId: AssetId): ActorAccess[] {
  return ACTOR_ACCESS.filter((a) => a.assetId === assetId);
}
