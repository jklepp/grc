// Asset — a specific resource inside a system's boundary. Facts only.
//
// Two fields left this file since the pre-graph version:
//
//   categories{}  -> edges/categoryAssessments.ts. A maturity/evidence/
//                    effectiveness judgment about one assurance category is an
//                    assertion ABOUT an asset, not an attribute OF one, and
//                    modelling it as an edge is what lets a number carry the
//                    "assessed at category level" basis instead of passing
//                    itself off as control-level fact.
//   classification -> DERIVED from the data the asset actually holds
//                    (engine/rollups.ts). It used to be inherited wholesale
//                    from the parent system, which meant all eight Production
//                    AI Platform assets were "Restricted" and all seven Workday
//                    assets "Confidential" regardless of what they carried.
//
// `kind` is new and load-bearing: it's the normalized machine-readable form of
// the free-text `type` string, and it's what edges/applicabilityRules.ts keys
// on to decide which controls a given asset is on the hook for. `type` stays as
// the display label. Keeping both means "AWS ECS Service (Fargate)" can be
// shown verbatim while still resolving to the same `compute-service` rules as
// any other container workload.
//
// criticalityFactors and inherentLikelihood stay — a judgment about what
// happens if this specific resource is compromised is a genuine per-asset fact
// with no upstream to derive it from.
import type { AssetId, SystemId } from "../ids";

// The kinds applicability rules are allowed to reference. Anything not in this
// list fails validation rather than silently matching no rule at all, which
// would quietly exempt an asset from every control.
export const ASSET_KINDS = [
  "api-gateway",
  "compute-service",
  "vector-db",
  "object-storage",
  "relational-db",
  "key-management",
  "secrets-store",
  "saas-tenant",
  "saas-api",
  "service-account",
  "integration-endpoint",
  "export-endpoint",
  "log-feed",
  "waf",
  "model-gateway",
  "policy-service",
  "tool-gateway",
  "cache",
  "egress-gateway",
  "iam",
  "telemetry",
  "siem",
  "runtime-security",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

// The kinds that sit where data crosses into the boundary from outside. Used
// to find the entry point of a system's request path without storing a layout:
// the flow graph alone can't identify one, because a real request path cycles
// (the gateway calls the model service, which answers back to the gateway) and
// so has no node with zero inbound edges.
//
// More than one kind can sit at the boundary together — a WAF in front of an
// API Gateway are both still Ingress, not two separate hops — and the walk
// gets that for free: every ingress-kind asset in the request path seeds the
// breadth-first traversal at depth 0 simultaneously, so an edge between two
// of them (WAF -> API Gateway) just never fires, since both ends are already
// visited before it's followed.
export const BOUNDARY_INGRESS_KINDS: AssetKind[] = ["waf", "api-gateway", "saas-api"];

// The kinds that sit where data crosses OUT of the boundary to an external
// destination: a secure egress proxy, an integration endpoint calling an
// external system, a bulk export leaving the tenant. Depth alone can't be
// trusted to mean "Egress" — the deepest node the BFS below reaches is
// whatever the graph happens to dead-end at, which is just as often an
// internal worker, queue, or log feed as an actual boundary component. So
// Egress is a role assets are given explicitly here, the same way
// BOUNDARY_INGRESS_KINDS makes Ingress a role rather than "depth 0" being
// coincidence. An asset of one of these kinds is pulled out of the normal
// stage walk in engine/rollups.ts and placed in its own Egress section
// regardless of how many hops it took to reach it — mirroring how
// DATABASE_KINDS below are pulled into their own Data Plane section instead
// of occupying a stage.
export const BOUNDARY_EGRESS_KINDS: AssetKind[] = ["egress-gateway", "export-endpoint", "integration-endpoint"];

// The kinds that are primarily data stores — where data actually lands at
// rest — rather than compute or transport. Used to pull these out of the
// request-path stage sequence and into their own Data Plane section on the
// flow diagram: where the data actually lands is a distinct fact from how
// many hops it took to get there. A cache still counts: a session or
// workflow-state store is where its data lands even if the TTL is short.
export const DATABASE_KINDS: AssetKind[] = ["relational-db", "vector-db", "object-storage", "cache"];

export interface CriticalityFactor {
  score: number;
  reason: string;
}

export interface CriticalityFactors {
  confidentiality: CriticalityFactor;
  integrity: CriticalityFactor;
  availability: CriticalityFactor;
  regulatory: CriticalityFactor;
  businessDependency: CriticalityFactor;
}

export interface Asset {
  id: AssetId;
  systemId: SystemId;
  name: string;
  type: string;
  kind: AssetKind;
  provider: string;
  code: string;
  criticalityFactors: CriticalityFactors;
  inherentLikelihood: number;
}
