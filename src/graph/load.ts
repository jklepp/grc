// The one door facts come through.
//
//   loadGraph(facts) -> assembled, structurally validated Graph
//
// Every source produces GraphFacts and hands them here. A YAML directory, a
// Postgres query, and today's TypeScript modules differ only in how they get to
// GraphFacts; from this function onward nothing downstream can tell which one it
// was. That is the entire point of the seam, and the reason the signature is
// deliberately this small.
//
// Anything this returns has been checked. validateGraph() runs the full
// structural suite against the assembled Graph — every referential and
// vocabulary check, source-agnostically — so a YAML file with a typo'd asset id
// fails exactly as loudly as a TypeScript one always did. Checks that need a
// derived value live in engine/validateDerivations.ts and run when an engine is
// built, because deriving them requires one.
import { assembleGraph } from "./assemble";
import { validateGraph } from "./validate";
import type { Graph, GraphFacts } from "./types";

export function loadGraph(facts: GraphFacts): Graph {
  const graph = assembleGraph(facts);
  validateGraph(graph);
  return graph;
}
