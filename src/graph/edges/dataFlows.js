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
// engine/rollups.js by walking inbound edges, so a new flow reshapes the map
// instead of requiring someone to also remember to re-slot the asset.

export const FLOW_KINDS = { DATA: "data", CONTROL_PLANE: "control-plane" };

export const DATA_FLOWS = [
  // ---- SYS-003 Production AI Platform: request path ---------------------------
  { id: "FLOW-003-01", from: "AST-003-01", to: "AST-003-03", kind: "data", dataTypeIds: ["DT-003", "DT-001"], note: "Authenticated customer query enters retrieval." },
  { id: "FLOW-003-02", from: "AST-003-01", to: "AST-003-02", kind: "data", dataTypeIds: ["DT-003"], note: "Prompt forwarded to the model service." },
  { id: "FLOW-003-03", from: "AST-003-01", to: "AST-003-06", kind: "data", dataTypeIds: ["DT-005"], note: "Session and usage records written per request." },
  { id: "FLOW-003-04", from: "AST-003-03", to: "AST-003-04", kind: "data", dataTypeIds: ["DT-002"], note: "Similarity search against document embeddings." },
  { id: "FLOW-003-05", from: "AST-003-03", to: "AST-003-05", kind: "data", dataTypeIds: ["DT-002", "DT-001"], note: "Retrieval of matched source documents." },
  { id: "FLOW-003-06", from: "AST-003-03", to: "AST-003-06", kind: "data", dataTypeIds: ["DT-005"], note: "Tenant scoping lookup on every retrieval." },
  { id: "FLOW-003-07", from: "AST-003-03", to: "AST-003-02", kind: "data", dataTypeIds: ["DT-002", "DT-003"], note: "Retrieved context injected into the model prompt." },
  { id: "FLOW-003-08", from: "AST-003-02", to: "AST-003-01", kind: "data", dataTypeIds: ["DT-003"], note: "Completion returned to the caller." },
  { id: "FLOW-003-09", from: "AST-003-05", to: "AST-003-04", kind: "data", dataTypeIds: ["DT-002"], note: "Ingestion pipeline embeds source documents into the vector store." },

  // ---- SYS-003: control plane --------------------------------------------------
  { id: "FLOW-003-10", from: "AST-003-07", to: "AST-003-05", kind: "control-plane", dataTypeIds: ["DT-004"], note: "Envelope encryption of objects at rest." },
  { id: "FLOW-003-11", from: "AST-003-07", to: "AST-003-06", kind: "control-plane", dataTypeIds: ["DT-004"], note: "Storage encryption for the metadata database." },
  { id: "FLOW-003-12", from: "AST-003-07", to: "AST-003-04", kind: "control-plane", dataTypeIds: ["DT-004"], note: "Encryption of the vector index at rest." },
  { id: "FLOW-003-13", from: "AST-003-08", to: "AST-003-03", kind: "control-plane", dataTypeIds: ["DT-004"], note: "Runtime credential resolution for the retrieval service." },
  { id: "FLOW-003-14", from: "AST-003-08", to: "AST-003-02", kind: "control-plane", dataTypeIds: ["DT-004"], note: "Model provider API keys resolved at runtime." },
  { id: "FLOW-003-15", from: "AST-003-08", to: "AST-003-01", kind: "control-plane", dataTypeIds: ["DT-004"], note: "Authorizer signing material." },

  // ---- SYS-042 Workday ----------------------------------------------------------
  { id: "FLOW-042-01", from: "AST-042-02", to: "AST-042-01", kind: "data", dataTypeIds: ["DT-007", "DT-008", "DT-009"], note: "Integration reads and writes against the tenant." },
  { id: "FLOW-042-02", from: "AST-042-01", to: "AST-042-04", kind: "data", dataTypeIds: ["DT-008", "DT-007"], note: "Compensation data released on the pay-cycle schedule." },
  { id: "FLOW-042-03", from: "AST-042-01", to: "AST-042-05", kind: "data", dataTypeIds: ["DT-007"], note: "Joiner/mover/leaver events for downstream provisioning." },
  { id: "FLOW-042-04", from: "AST-042-01", to: "AST-042-06", kind: "data", dataTypeIds: ["DT-007", "DT-008", "DT-009"], note: "Bulk export for downstream reporting and analytics." },
  { id: "FLOW-042-05", from: "AST-042-01", to: "AST-042-07", kind: "data", dataTypeIds: ["DT-006"], note: "Access and change events exported to central monitoring." },
  { id: "FLOW-042-06", from: "AST-042-03", to: "AST-042-02", kind: "control-plane", dataTypeIds: ["DT-007", "DT-008", "DT-009"], note: "Every integration authenticates as this single account, which is why its reach is the reach of all three data types." },
];

const OUTBOUND = {};
const INBOUND = {};
DATA_FLOWS.forEach((f) => {
  (OUTBOUND[f.from] ||= []).push(f);
  (INBOUND[f.to] ||= []).push(f);
});

export function flowsFrom(assetId) {
  return OUTBOUND[assetId] || [];
}

export function flowsTo(assetId) {
  return INBOUND[assetId] || [];
}

// Every flow carrying a given data type — the filter the Data Map lost when
// its per-data-type view collapsed into a single combined chart.
export function flowsCarrying(dataTypeId) {
  return DATA_FLOWS.filter((f) => f.dataTypeIds.includes(dataTypeId));
}
