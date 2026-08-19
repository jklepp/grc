// ASSET —[carries data type]→ ASSET
//
// Real relationship records. The Systems Data Flow page previously had no edge
// data at all: it held a per-system dictionary of stage names to asset ids
// ("Ingress", "Primary Custody", "Processing", "Delivery") and drew a line from
// every asset in one stage to every asset in the next. countEdges() then
// counted that cartesian product and reported it as the relationship total. So
// the map asserted, for instance, that the API Gateway sends data to the KMS
// key, because they happened to land in adjacent stages.
//
// Here each edge is a connection someone asserted, carrying the specific data
// types that move along it. That restores what the map had to give up: the
// per-data-type filter (SYSTEM_MAPS collapsed to a single `{ all: ... }` flow
// because there was nothing to filter on), and a relationship count that counts
// relationships.
//
// `kind` separates the request path from the control plane. A KMS key is not
// downstream of an S3 bucket in any data sense — it's the thing that protects
// it — and the old model expressed that with a `branch: true` cosmetic flag on
// the layout. Making it semantic means the map can still render it as a branch
// while the engine can correctly exclude it from custody-chain reasoning.
//
// Stage ordering is deliberately NOT stored. It's derived from the graph in
// engine/rollups.ts by walking inbound edges, so a new flow reshapes the map
// instead of requiring someone to also remember to re-slot the asset.

export const FLOW_KINDS = {
  DATA: "data",
  CONTROL_PLANE: "control-plane",
  DEPLOYS_TO: "deploys-to",
  BACKUP: "backup",
  RESTORE: "restore",
} as const;
export type FlowKind = (typeof FLOW_KINDS)[keyof typeof FLOW_KINDS];

import type { AssetId, DataTypeId } from "../ids";

export interface DataFlow {
  id: string;
  from: AssetId;
  to: AssetId;
  kind: FlowKind;
  dataTypeIds: DataTypeId[];
  note?: string;
}
