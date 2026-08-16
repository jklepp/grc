// The one door facts come through.
//
//   loadGraph(facts) -> assembled, structurally validated Graph
//
// Every source produces GraphFacts and hands them here. A YAML directory, a
// Postgres query, and today's TypeScript modules differ only in how they get to
// GraphFacts; from this function onward nothing downstream can tell which one it
// was. That is the entire point of the seam, and the reason the signature is
// deliberately this small.
import { assembleGraph } from "./assemble";
import type { Graph, GraphFacts } from "./types";

export function loadGraph(facts: GraphFacts): Graph {
  const graph = assembleGraph(facts);
  validateStructure(graph);
  return graph;
}

// Structural checks only — referential integrity and vocabulary conformance.
// Anything needing a derived value lives in engine/validateDerivations.ts,
// because deriving it requires an engine and the graph must stay free of
// scoring.
//
// NOTE: the full structural suite still lives in graph/validate.js, which
// asserts against the ACME modules directly rather than against a passed Graph.
// For the TypeScript source those are the same objects, so importing it there
// is sound today. Porting it to take a Graph is what a YAML or Postgres source
// needs before it can be trusted, and is tracked as the next step.
function validateStructure(graph: Graph): void {
  const problems: string[] = [];

  // Two source names that disagree about what kind of source they are means
  // either two different tools sharing a name or a typo. Both are real problems,
  // and both should stop the build rather than quietly average together.
  problems.push(...graph.sourceConflicts);

  // Every id unique across the whole graph. A duplicate silently shadows in
  // every BY_ID index at once, so the second one simply stops existing.
  const seen = new Set<string>();
  const allNodes = [
    ...graph.assets, ...graph.systems, ...graph.dataTypes, ...graph.keyControls,
    ...graph.evidence, ...graph.risks, ...graph.orgs, ...graph.findings, ...graph.actors,
  ];
  allNodes.forEach((n) => {
    if (seen.has(n.id)) problems.push(`duplicate node id "${n.id}" — ids must be unique across the whole graph`);
    seen.add(n.id);
  });

  // A dangling edge produces a relationship to nowhere, which renders as a
  // quietly missing hop rather than an error.
  graph.assets.forEach((a) => {
    if (!Object.hasOwn(graph.systemById, a.systemId)) {
      problems.push(`asset ${a.id}: systemId "${a.systemId}" is not a system`);
    }
    if ((graph.dataTypesByAsset[a.id] ?? []).length === 0) {
      problems.push(`asset ${a.id}: has no data-type edges, so its classification cannot be derived`);
    }
  });

  graph.dataFlows.forEach((f) => {
    if (!Object.hasOwn(graph.assetById, f.from)) problems.push(`data flow ${f.id}: from "${f.from}" is not an asset`);
    if (!Object.hasOwn(graph.assetById, f.to)) problems.push(`data flow ${f.id}: to "${f.to}" is not an asset`);
    if (f.from === f.to) problems.push(`data flow ${f.id}: connects an asset to itself`);
    if (f.dataTypeIds.length === 0) {
      problems.push(`data flow ${f.id}: carries no data types — an edge with nothing on it is not a relationship`);
    }
  });

  // A tier whose weights quietly summed to 95 instead of 100 would rescale every
  // asset at that tier without anything looking wrong, so this is checked rather
  // than trusted.
  Object.entries(graph.categoryWeights).forEach(([tier, weights]) => {
    const total = Object.values(weights).reduce((a, w) => a + w, 0);
    if (total !== 100) problems.push(`controlProfile: tier "${tier}" weights sum to ${total}, not 100`);
  });

  if (problems.length > 0) {
    throw new Error(
      `Graph integrity check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n  - ${problems.join("\n  - ")}`
    );
  }
}
