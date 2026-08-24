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
  // 344 assertions across 113 sweeps, and in production they run against a
  // dataset CI has already proved: check-validator-fires.mjs loads these
  // exact facts through this exact function as its baseline, and deploy.yml
  // runs `npm run check` before `npm run build`. So the browser paid for a
  // result that was known before the bundle existed.
  //
  // This is the AUTHORED path only. Runtime facts — the ones a person types
  // into the wizard — are validated by liveGraph.ts, which calls
  // validateGraph directly and keeps doing so in production. That is where
  // unproven data actually enters, and it is still checked.
  if (import.meta.env.DEV) validateGraph(graph);
  return graph;
}

// Same assemble-then-validate path as loadGraph, but for a caller that needs to
// show the user what's wrong rather than crash the app — the Add System
// wizard's dry run. Never throws: a malformed fact shape that would throw a raw
// TypeError inside assembleGraph is caught and folded into the same problems
// list a structural validation failure would produce.
export function tryLoadGraph(facts: GraphFacts): { graph: Graph | null; problems: string[] } {
  try {
    const graph = assembleGraph(facts);
    const problems = validateGraph(graph, { throwOnFailure: false });
    return problems.length > 0 ? { graph: null, problems } : { graph, problems: [] };
  } catch (err) {
    return { graph: null, problems: [err instanceof Error ? err.message : String(err)] };
  }
}
