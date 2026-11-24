// ASSET —[carries data type]→ ASSET
//
// Each edge is a connection someone asserted, carrying the specific data types
// that move along it.
//
// `kind` separates the request path from the control plane. A KMS key is not
// downstream of an S3 bucket in any data sense — it's the thing that protects
// it. Making that semantic means the map can still render it as a branch
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
