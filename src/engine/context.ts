// The engine's non-graph inputs.
//
// Right now that is exactly one thing: what "now" means. It earns its own type
// anyway, because the alternative is what this codebase had — two separate
// `const NOW = new Date()` declarations, in implementation.ts and findings.ts,
// each captured when its module first evaluated.
//
// That was wrong in two directions at once. In a long-lived browser tab the two
// clocks drift apart from each other and from the wall, so evidence could be
// reported stale on one page and fresh on another. And it made the engine
// untestable: "does this evidence record decay correctly after 400 days" has no
// answer you can write down when the answer depends on when the bundle loaded.
//
// Passing it in makes freshness a function of stated inputs, which is what the
// rest of the engine already is.
export interface EngineContext {
  // The instant every freshness and age calculation is measured against.
  now: Date;
}

export function defaultContext(): EngineContext {
  return { now: new Date() };
}
