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
