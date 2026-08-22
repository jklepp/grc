// Where the loaded dataset's facts live once something has loaded them.
//
// This exists as its own module for one reason: engine/index.ts loads the facts
// and re-exports the page-facing surface, while runtimeMutations.ts needs the
// same facts to answer "what did the authored dataset say about this system
// before anyone edited it". Having runtimeMutations reach back into
// engine/index.ts would be a cycle, and having it import the YAML source
// directly is what this change exists to stop — a static import of
// graph/sources/yaml anywhere in the tree pulls every fact file into the
// initial bundle and evaluates it at import time, which is exactly the
// synchronous coupling an eventual API-backed source cannot satisfy.
//
// So the facts are set once, by whoever loaded them, and read from here.
import type { GraphFacts } from "../graph/types";

let facts: GraphFacts | null = null;

export function setBaseFacts(loaded: GraphFacts): void {
  facts = loaded;
}

// Throws rather than returning null. Every caller runs inside a rendered page,
// and pages do not render until initEngine() has resolved (see src/Boot.tsx),
// so reaching this before the facts exist is a wiring bug in the boot sequence
// rather than a state a caller should be writing a branch for.
export function baseFacts(): GraphFacts {
  if (!facts) {
    throw new Error(
      "baseFacts() called before the dataset finished loading — initEngine() must resolve before anything reads facts"
    );
  }
  return facts;
}

export function hasBaseFacts(): boolean {
  return facts !== null;
}
