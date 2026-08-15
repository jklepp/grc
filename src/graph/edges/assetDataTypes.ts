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

export const ASSET_DATA_TYPES: AssetDataType[] = [
  // ---- SYS-003 Production AI Platform ----------------------------------------
  { assetId: "AST-003-01", dataTypeId: "DT-001", role: "transits" },
  { assetId: "AST-003-01", dataTypeId: "DT-002", role: "transits" },
  { assetId: "AST-003-01", dataTypeId: "DT-003", role: "transits" },

  { assetId: "AST-003-02", dataTypeId: "DT-003", role: "processes" },
  { assetId: "AST-003-02", dataTypeId: "DT-001", role: "processes" },

  { assetId: "AST-003-03", dataTypeId: "DT-002", role: "processes" },
  { assetId: "AST-003-03", dataTypeId: "DT-003", role: "processes" },
  { assetId: "AST-003-03", dataTypeId: "DT-001", role: "processes" },

  // Embeddings rather than documents — but inversion-recoverable, so the edge
  // is `derives` and the tier does not drop.
  { assetId: "AST-003-04", dataTypeId: "DT-002", role: "derives" },

  { assetId: "AST-003-05", dataTypeId: "DT-002", role: "stores" },
  { assetId: "AST-003-05", dataTypeId: "DT-001", role: "stores" },

  { assetId: "AST-003-06", dataTypeId: "DT-005", role: "stores" },
  { assetId: "AST-003-06", dataTypeId: "DT-001", role: "stores" },

  { assetId: "AST-003-07", dataTypeId: "DT-004", role: "stores" },
  { assetId: "AST-003-08", dataTypeId: "DT-004", role: "stores" },
  { assetId: "AST-003-09", dataTypeId: "DT-003", role: "transits" },

  // ---- SYS-042 Workday ---------------------------------------------------------
  { assetId: "AST-042-01", dataTypeId: "DT-007", role: "stores" },
  { assetId: "AST-042-01", dataTypeId: "DT-008", role: "stores" },
  { assetId: "AST-042-01", dataTypeId: "DT-009", role: "stores" },

  { assetId: "AST-042-02", dataTypeId: "DT-007", role: "transits" },
  { assetId: "AST-042-02", dataTypeId: "DT-008", role: "transits" },
  { assetId: "AST-042-02", dataTypeId: "DT-009", role: "transits" },

  // Holds nothing; authenticates every integration that does.
  { assetId: "AST-042-03", dataTypeId: "DT-007", role: "accesses" },
  { assetId: "AST-042-03", dataTypeId: "DT-008", role: "accesses" },
  { assetId: "AST-042-03", dataTypeId: "DT-009", role: "accesses" },

  { assetId: "AST-042-04", dataTypeId: "DT-008", role: "transits" },
  { assetId: "AST-042-04", dataTypeId: "DT-007", role: "transits" },

  { assetId: "AST-042-05", dataTypeId: "DT-007", role: "transits" },

  { assetId: "AST-042-06", dataTypeId: "DT-007", role: "transits" },
  { assetId: "AST-042-06", dataTypeId: "DT-008", role: "transits" },
  { assetId: "AST-042-06", dataTypeId: "DT-009", role: "transits" },

  { assetId: "AST-042-07", dataTypeId: "DT-006", role: "stores" },
];

const BY_ASSET: Record<AssetId, AssetDataType[]> = {};
const BY_DATA_TYPE: Record<DataTypeId, AssetDataType[]> = {};
ASSET_DATA_TYPES.forEach((e) => {
  (BY_ASSET[e.assetId] ||= []).push(e);
  (BY_DATA_TYPE[e.dataTypeId] ||= []).push(e);
});

export function dataTypesForAsset(assetId: AssetId): AssetDataType[] {
  return BY_ASSET[assetId] || [];
}

export function assetsForDataType(dataTypeId: DataTypeId): AssetDataType[] {
  return BY_DATA_TYPE[dataTypeId] || [];
}
