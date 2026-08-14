// Enterprise Data Map — a custody-chain flow chart per system, built directly
// from the real Systems Register and Asset Register rather than a hand-typed
// business-domain model. Every node here is a real asset (assets.js) with
// real Cyber Assurance numbers already computed by assetSummary() — nothing
// on this page is a second hand-typed figure that could drift out of sync
// with the Asset Register.
import { SYSTEMS } from "./systemRegister";
import { ASSET_SUMMARIES } from "./assets";

const ASSET_BY_ID = {};
ASSET_SUMMARIES.forEach((a) => { ASSET_BY_ID[a.id] = a; });

// A short badge per asset for the flow-chart card, purely cosmetic — the map
// equivalent of the old NODE_DEFS "code" field.
const ASSET_CODE = {
  "AST-003-01": "GW",
  "AST-003-02": "ECS",
  "AST-003-03": "RAG",
  "AST-003-04": "VDB",
  "AST-003-05": "S3",
  "AST-003-06": "RDS",
  "AST-003-07": "KMS",
  "AST-003-08": "SEC",
  "AST-042-01": "TEN",
  "AST-042-02": "API",
  "AST-042-03": "SVC",
  "AST-042-04": "PAY",
  "AST-042-05": "IDN",
  "AST-042-06": "EXP",
  "AST-042-07": "LOG",
};

// Where each system's real assets sit in its own custody chain — a judgment
// call about each asset's role (perimeter, store, compute, egress), the same
// kind of call as DOMAIN_IMPLEMENTATION_TYPE in systemRegister.js, not a fact
// pulled from a source system. `branch` mirrors the prior backup-copy
// convention: a secondary hop stacked under the stage's primary node rather
// than its own column entry — used here for the keys/credentials that secure
// a system's primary store rather than sitting in the request path itself.
const SYSTEM_FLOWS = {
  "SYS-003": {
    Ingress: ["AST-003-01"],
    "Primary Custody": ["AST-003-05", "AST-003-06", "AST-003-04", { key: "AST-003-07", branch: true }, { key: "AST-003-08", branch: true }],
    Processing: ["AST-003-02", "AST-003-03"],
  },
  "SYS-042": {
    Ingress: ["AST-042-02"],
    "Primary Custody": ["AST-042-01", { key: "AST-042-03", branch: true }],
    Processing: ["AST-042-04", "AST-042-05"],
    Delivery: ["AST-042-06", "AST-042-07"],
  },
};

const STAGE_ORDER = ["Ingress", "Primary Custody", "Processing", "Delivery"];

function stage(nodes) {
  return nodes.map((n) => (typeof n === "string" ? { key: n } : n));
}

function buildFlow(systemId) {
  const flow = SYSTEM_FLOWS[systemId] || {};
  return { label: "All Assets", stages: STAGE_ORDER.map((name) => ({ name, nodes: stage(flow[name] || []) })) };
}

// One entry per system in the register — each "mapped" by construction,
// since it's built from that system's own real assets rather than a business
// domain someone may or may not have gotten around to walking yet.
export const SYSTEM_MAPS = SYSTEMS.map((system) => ({
  id: system.id,
  name: system.name,
  classification: system.classification,
  assetCount: ASSET_SUMMARIES.filter((a) => a.system.id === system.id).length,
  dataTypes: { all: buildFlow(system.id) },
}));

// Resolves a flow-chart node key (an asset id) into everything the map needs
// to render and grade it. Unlike the old model there's no "estimated" branch
// — every node is a real Asset Register entry, so every number on it is real.
export function getNode(assetId) {
  const asset = ASSET_BY_ID[assetId];
  return {
    key: asset.id,
    code: ASSET_CODE[asset.id] || asset.id.slice(-2),
    name: asset.name,
    subtitle: asset.type,
    asset,
    system: asset.system,
    classification: asset.classification,
  };
}

// Directed edges actually drawn on the chart for one system's flow: a
// transition between consecutive non-empty stages, plus one per branch
// connector.
export function countEdges(flow) {
  let edges = 0;
  let prevKeys = null;
  flow.stages.forEach((s) => {
    const primary = s.nodes.filter((n) => !n.branch);
    const branches = s.nodes.filter((n) => n.branch);
    edges += branches.length;
    if (prevKeys && prevKeys.length && primary.length) edges += prevKeys.length * primary.length;
    if (primary.length) prevKeys = primary;
  });
  return edges;
}

// Every node across every stage of a flow, deduped by key.
export function allNodes(flow) {
  const keys = new Set();
  flow.stages.forEach((s) => s.nodes.forEach((n) => keys.add(n.key)));
  return [...keys].map(getNode);
}

// Weakest link is the lowest real Cyber Assurance score among a system's
// assets, not a derived/estimated stand-in.
export function weakestLink(flow) {
  const nodes = allNodes(flow);
  if (nodes.length === 0) return null;
  return nodes.reduce((worst, n) => (n.asset.overallAssurance < worst.asset.overallAssurance ? n : worst), nodes[0]);
}

export function flowAssurancePct(flow) {
  const nodes = allNodes(flow);
  if (nodes.length === 0) return null;
  return Math.round(nodes.reduce((a, n) => a + n.asset.overallAssurance, 0) / nodes.length);
}

export const TOTAL_ASSET_COUNT = ASSET_SUMMARIES.length;
export const TOTAL_RELATIONSHIP_COUNT = SYSTEM_MAPS.reduce((a, s) => a + countEdges(s.dataTypes.all), 0);
