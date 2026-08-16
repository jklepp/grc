// ASSET —[role]→ DATA TYPE
//
// The edge that makes "which assets hold Customer PII?" answerable. Before
// this, data was a `dataElements` array on the system, one tier too coarse to
// answer anything useful: it could say the Production AI Platform handles
// Customer PII, but not that the KMS key doesn't, or that the vector database
// holds it only in derived form.
//
// Two things read this edge and both matter:
//
//   Classification. An asset's tier is the high-water mark across every data
//   type it touches, and a system's is the high-water mark across its assets
//   (engine/rollups.ts). Classification used to be a single value on the system
//   that every asset inherited wholesale, which meant an asset's tier could
//   never be wrong — and could never be informative either.
//
//   Applicability. Several control rules turn on what an asset actually
//   handles rather than what kind of thing it is: PRI-05 applies wherever
//   personal data lands, regardless of whether that's a bucket or an endpoint.
//
// `role` distinguishes claims that are genuinely different. An asset that
// STORES customer documents and one that merely TRANSITS them carry different
// exposure, and `derives` exists because embeddings are not a copy of the
// source documents but are re-identifiable from them — a distinction the old
// model had no way to express. Every role counts toward classification: a
// service account holds no data at all, but compromising it reaches all of it.

export const DATA_ROLES = {
  STORES: "stores",
  PROCESSES: "processes",
  TRANSITS: "transits",
  DERIVES: "derives",
  ACCESSES: "accesses",
} as const;
export type DataRole = (typeof DATA_ROLES)[keyof typeof DATA_ROLES];

export const DATA_ROLE_META: Record<DataRole, { label: string; detail: string }> = {
  stores: { label: "Stores", detail: "Holds this data at rest." },
  processes: { label: "Processes", detail: "Operates on this data in memory without being its system of record." },
  transits: { label: "Transits", detail: "This data passes through, but is not retained here." },
  derives: { label: "Derives", detail: "Holds a transformation of this data that remains re-identifiable from it." },
  accesses: { label: "Accesses", detail: "Holds no data itself, but grants reach to it." },
};

import type { AssetId, DataTypeId } from "../ids";

export interface AssetDataType {
  assetId: AssetId;
  dataTypeId: DataTypeId;
  role: DataRole;
}
