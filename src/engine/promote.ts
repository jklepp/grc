// Promoting a runtime-created system into authored facts.
//
// The Add System wizard writes to localStorage (see runtimeFactsStore.ts), so
// everything a user builds in the app is trapped in one browser with ids in a
// deliberately separate namespace — SYS-USR-1, AST-USR-1-3, EVD-USR-2. Useful
// for a sandbox, useless for growing the dataset: the authored corpus in
// src/graph/facts/*.yaml is the thing that gets reviewed, validated at build
// time, and shared.
//
// This module is the bridge. It takes a RuntimeFacts blob and one runtime
// system, and produces the same records renamed into the authored namespace and
// grouped by the fact file each belongs in. scripts/promote-runtime-facts.mjs
// writes them out and proves the round trip.
//
// WHY THE ID REWRITE IS GENERIC. Every reference between facts is a string id,
// and there are enough of them (asset -> data type, actor -> asset, evidence ->
// assets, flow -> from/to, finding -> asset) that enumerating the fields by hand
// guarantees missing one the next time a fact type gains a reference. So the
// rewrite walks each record and replaces any string that IS a renamed id,
// wherever it appears — object values, array elements, and map keys alike. The
// tradeoff is that a note whose prose happens to contain a bare runtime id gets
// rewritten too; that is the right answer often enough (the note is usually
// referring to the thing) and harmless the rest of the time.
//
// WHAT IS DELIBERATELY OUT OF SCOPE. RuntimeFacts can also hold edits to
// YAML-authored systems — an assessment scope row added to SYS-003 by walking a
// control, say. Those are not part of any runtime system and promoting them
// would mean merging into records that already exist rather than appending new
// ones. They are reported as warnings instead of being silently dropped.
import type { RuntimeFacts } from "./liveGraph";
import type { GraphFacts } from "../graph/types";

// Each group of promoted records, keyed by the fact file it belongs in. The
// value is the file's basename in src/graph/facts, which is what the script
// appends to — keeping the mapping here rather than in the script means a new
// runtime fact domain is a compile error in one place.
export const PROMOTION_FILES = {
  systems: "systems",
  assets: "assets",
  assetDataTypes: "asset-data-types",
  actors: "actors",
  actorAccess: "actor-access",
  dataFlows: "data-flows",
  agenticIdentities: "agentic-identities",
  assessmentScopes: "assessment-scope",
  implementationMechanisms: "implementation-mechanisms",
  evidence: "evidence",
  evidenceArtifacts: "evidence-artifacts",
  evidenceReviews: "evidence-reviews",
  notImplemented: "not-implemented",
  prismaOverrides: "prisma-overrides",
  controlReviews: "control-reviews",
  findings: "findings",
  backupConfigs: "backup-config",
  drTests: "dr-tests",
  sdlcPostures: "sdlc-posture",
} as const;

export type PromotionGroup = keyof typeof PROMOTION_FILES;

export interface PromotionPlan {
  sourceSystemId: string;
  targetSystemId: string;
  // Runtime id -> authored id, for every record this promotion renames.
  idMap: Record<string, string>;
  // Records to append, already renamed, grouped by fact file.
  records: Record<PromotionGroup, unknown[]>;
  // expected-classification.yaml is a map rather than a list, so it travels
  // separately instead of being forced into the same shape.
  expectedClassification: Record<string, string>;
  warnings: string[];
}

// ---- id allocation -----------------------------------------------------------

function numericSuffixes(ids: readonly string[], prefix: string): number[] {
  return ids
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number.parseInt(id.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
}

function nextNumbered(ids: readonly string[], prefix: string, pad: number): string {
  const used = numericSuffixes(ids, prefix);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(pad, "0")}`;
}

function slug(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "UNNAMED";
}

function uniqueSlugId(prefix: string, name: string, taken: Set<string>): string {
  const base = `${prefix}${slug(name)}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// ---- generic id rewriting ----------------------------------------------------

function remapDeep<T>(value: T, idMap: Record<string, string>): T {
  if (typeof value === "string") return (idMap[value] ?? value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => remapDeep(item, idMap)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[idMap[key] ?? key] = remapDeep(item, idMap);
    }
    return out as unknown as T;
  }
  return value;
}

// ---- the plan ----------------------------------------------------------------

export interface PromotionOptions {
  systemId: string;
  // Authored id to promote into. Defaults to the next free SYS-nnn.
  targetSystemId?: string;
}

export function planPromotion(
  runtime: RuntimeFacts,
  existing: GraphFacts,
  options: PromotionOptions
): PromotionPlan {
  const { systemId } = options;
  const warnings: string[] = [];

  const system = runtime.systems.find((s) => s.id === systemId);
  if (!system) {
    throw new Error(
      `promote: no runtime system ${systemId} — found ${runtime.systems.map((s) => s.id).join(", ") || "none"}`
    );
  }
  if (existing.systems.some((s) => s.id === systemId)) {
    throw new Error(`promote: ${systemId} is already an authored system, not a runtime one`);
  }

  const targetSystemId = options.targetSystemId
    ?? nextNumbered(existing.systems.map((s) => s.id), "SYS-", 3);
  if (existing.systems.some((s) => s.id === targetSystemId)) {
    throw new Error(`promote: target id ${targetSystemId} is already taken`);
  }
  const sysNum = targetSystemId.replace(/^SYS-/, "");

  // ---- select what belongs to this system ----
  const assets = runtime.assets.filter((a) => a.systemIds.includes(systemId));
  const assetIds = new Set(assets.map((a) => a.id));
  if (assets.some((a) => a.systemIds.length > 1)) {
    warnings.push("an asset is shared with another system; its other memberships travel with it unchanged");
  }

  const actorAccess = runtime.actorAccess.filter((edge) => assetIds.has(edge.assetId));
  const referencedActorIds = new Set(actorAccess.map((edge) => edge.actorId));
  // Only actors the wizard created need new ids. An authored actor
  // (ACTOR-CUSTOMER and friends) already exists and is simply referenced.
  const actors = runtime.actors.filter((actor) => referencedActorIds.has(actor.id));
  const dataFlows = runtime.dataFlows.filter((flow) => assetIds.has(flow.from) || assetIds.has(flow.to));
  const evidence = runtime.evidence.filter((e) => e.assetIds.some((id) => assetIds.has(id)));
  const evidenceIds = new Set(evidence.map((e) => e.id));
  const artifactIds = new Set(evidence.flatMap((e) => e.artifactIds ?? []));
  const evidenceArtifacts = runtime.evidenceArtifacts.filter((a) => artifactIds.has(a.id));
  const evidenceReviews = runtime.evidenceReviews.filter((r) => evidenceIds.has(r.evidenceId));
  const findings = runtime.findings.filter((f) => f.systemId === systemId);

  const bySystem = <T extends { systemId: string }>(rows: readonly T[]): T[] =>
    rows.filter((row) => row.systemId === systemId);

  // ---- report what is being left behind ----
  const foreign = (label: string, count: number) => {
    if (count > 0) warnings.push(`${count} ${label} belong to other systems and are not part of this promotion`);
  };
  foreign("runtime system(s)", runtime.systems.length - 1);
  foreign("assessment scope row(s)", runtime.assessmentScopes.length - bySystem(runtime.assessmentScopes).length);
  foreign("control review(s)", runtime.controlReviews.length - bySystem(runtime.controlReviews).length);
  foreign("PRISMA override(s)", runtime.prismaOverrides.length - bySystem(runtime.prismaOverrides).length);
  foreign("evidence record(s)", runtime.evidence.length - evidence.length);
  foreign("finding(s)", runtime.findings.length - findings.length);

  // ---- allocate authored ids ----
  const idMap: Record<string, string> = { [systemId]: targetSystemId };

  assets.forEach((asset, i) => {
    idMap[asset.id] = `AST-${sysNum}-${String(i + 1).padStart(2, "0")}`;
  });
  actorAccess.forEach((edge, i) => {
    idMap[edge.id] = `ACC-${sysNum}-${String(i + 1).padStart(2, "0")}`;
  });
  dataFlows.forEach((flow, i) => {
    idMap[flow.id] = `FLOW-${sysNum}-${String(i + 1).padStart(2, "0")}`;
  });

  const takenActorIds = new Set(existing.actors.map((a) => a.id));
  actors.forEach((actor) => {
    // An actor already living in the authored set keeps its id and is not
    // re-emitted; only wizard-created ones are renamed and appended.
    if (takenActorIds.has(actor.id)) return;
    const id = uniqueSlugId("ACTOR-", actor.name, takenActorIds);
    takenActorIds.add(id);
    idMap[actor.id] = id;
  });
  const newActors = actors.filter((actor) => idMap[actor.id] !== undefined);

  const takenAgentIds = new Set(existing.agenticIdentities.map((a) => a.id));
  bySystem(runtime.agenticIdentities).forEach((agent) => {
    const id = uniqueSlugId(`AGENT-${sysNum}-`, agent.name, takenAgentIds);
    takenAgentIds.add(id);
    idMap[agent.id] = id;
  });

  let evidenceCursor = existing.evidence.map((e) => e.id);
  evidence.forEach((record) => {
    const id = nextNumbered(evidenceCursor, "EV-", 4);
    evidenceCursor = [...evidenceCursor, id];
    idMap[record.id] = id;
  });

  let artifactCursor = existing.evidenceArtifacts.map((a) => a.id);
  evidenceArtifacts.forEach((artifact) => {
    const id = nextNumbered(artifactCursor, "ART-", 4);
    artifactCursor = [...artifactCursor, id];
    idMap[artifact.id] = id;
  });

  let reviewCursor = existing.evidenceReviews.map((r) => r.id);
  evidenceReviews.forEach((review) => {
    const id = nextNumbered(reviewCursor, "EVR-", 4);
    reviewCursor = [...reviewCursor, id];
    idMap[review.id] = id;
  });

  let findingCursor = existing.findings.map((f) => f.id);
  findings.forEach((finding) => {
    const id = nextNumbered(findingCursor, "SEC-", 4);
    findingCursor = [...findingCursor, id];
    idMap[finding.id] = id;
  });

  const takenDrIds = new Set(existing.drTests.map((t) => t.id));
  bySystem(runtime.drTests).forEach((test) => {
    const period = (test.conductedAt ?? "").slice(0, 7) || "undated";
    let id = `DRTEST-${targetSystemId}-${period}`;
    let n = 2;
    while (takenDrIds.has(id)) {
      id = `DRTEST-${targetSystemId}-${period}-${n}`;
      n += 1;
    }
    takenDrIds.add(id);
    idMap[test.id] = id;
  });

  // ---- rewrite and group ----
  const map = <T>(rows: readonly T[]): unknown[] => rows.map((row) => remapDeep(row, idMap));

  const records: Record<PromotionGroup, unknown[]> = {
    systems: map([system]),
    assets: map(assets),
    assetDataTypes: map(runtime.assetDataTypes.filter((link) => assetIds.has(link.assetId))),
    actors: map(newActors),
    actorAccess: map(actorAccess),
    dataFlows: map(dataFlows),
    agenticIdentities: map(bySystem(runtime.agenticIdentities)),
    assessmentScopes: map(bySystem(runtime.assessmentScopes)),
    implementationMechanisms: map(runtime.implementationMechanisms.filter((m) => assetIds.has(m.assetId))),
    evidence: map(evidence),
    evidenceArtifacts: map(evidenceArtifacts),
    evidenceReviews: map(evidenceReviews),
    notImplemented: map(runtime.notImplemented.filter((n) => assetIds.has(n.assetId))),
    prismaOverrides: map(bySystem(runtime.prismaOverrides)),
    controlReviews: map(bySystem(runtime.controlReviews)),
    findings: map(findings),
    backupConfigs: map(bySystem(runtime.backupConfigs)),
    drTests: map(bySystem(runtime.drTests)),
    sdlcPostures: map(bySystem(runtime.sdlcPostures)),
  };

  const tier = runtime.expectedClassification[systemId as keyof typeof runtime.expectedClassification];
  const expectedClassification = tier ? { [targetSystemId]: tier as string } : {};
  if (!tier) {
    warnings.push(
      "no expected classification was recorded for this system — expected-classification.yaml is the "
      + "top-down answer the bottom-up rollup has to reproduce, so add one before relying on that check"
    );
  }

  return { sourceSystemId: systemId, targetSystemId, idMap, records, expectedClassification, warnings };
}
