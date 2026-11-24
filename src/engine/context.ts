// The engine's non-graph inputs.
//
// Right now that is exactly one thing: what "now" means. Never read a
// module-level `new Date()`: separate clocks drift apart in a long-lived tab,
// and freshness becomes untestable. Passing it in makes freshness a function of
// stated inputs.
export interface EngineContext {
  // The instant every freshness and age calculation is measured against.
  now: Date;
}

export function defaultContext(): EngineContext {
  return { now: new Date() };
}
