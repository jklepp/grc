// Golden master for the engine/graph refactor.
//
// Dumps every derived number the engine produces to a JSON file, loaded through
// Vite's SSR pipeline so module resolution matches the real app exactly. Run it
// before a refactor and again after; a byte-identical file is the proof that
// restructuring the seam moved nothing that the UI actually renders.
//
// This is deliberately exhaustive rather than a sample. A refactor that shifts
// one asset's Detection score by 0.1 is precisely the failure a spot-check
// misses and the whole app's credibility depends on catching.
import { createServer } from "vite";
import { writeFileSync } from "node:fs";

const outPath = process.argv[2];
if (!outPath) {
  console.error("usage: node scripts/snapshot-derivations.mjs <output.json>");
  process.exit(1);
}

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

try {
  const engine = await server.ssrLoadModule("/src/engine/index.ts");

  // Sort keys everywhere so the output is order-independent: a refactor that
  // changes the order collections are built in shouldn't read as a diff.
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object" && value.constructor === Object) {
      return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
    }
    return value;
  };

  const snapshot = {};

  // The `engine` export is the instance handle, not a derivation: it carries
  // ctx.now (a fresh timestamp every run) and the whole graph hanging off it,
  // so including it guarantees a false diff on every comparison and drowns a
  // real one. Everything it exposes that IS a derivation is already reached
  // through the named exports below.
  const NOT_A_DERIVATION = new Set(["engine"]);

  // Every non-function export the engine's public API exposes, plus the zero-arg
  // accessors selectors.ts wraps the enterprise rollups in (getEnterprise,
  // getCategoryAverages). Functions taking ids are exercised separately below.
  for (const key of Object.keys(engine).sort()) {
    if (NOT_A_DERIVATION.has(key)) continue;
    const value = engine[key];
    try {
      if (typeof value === "function") {
        if (value.length !== 0) continue;
        snapshot[key] = sortKeys(JSON.parse(JSON.stringify(value())));
      } else {
        snapshot[key] = sortKeys(JSON.parse(JSON.stringify(value)));
      }
    } catch (err) {
      snapshot[key] = `<unserializable: ${err.message}>`;
    }
  }

  // Per-entity derivations, keyed by id so a rename shows up as a diff too.
  const graph = await server.ssrLoadModule("/src/graph/nodes/assets.ts");
  const systems = await server.ssrLoadModule("/src/graph/nodes/systems.ts");

  const call = (fn, arg) => {
    try {
      return sortKeys(JSON.parse(JSON.stringify(fn(arg))));
    } catch (err) {
      return `<threw: ${err.message}>`;
    }
  };

  snapshot["__assetRollups"] = Object.fromEntries(
    graph.ASSETS.map((a) => [a.id, engine.assetRollup ? call(engine.assetRollup, a.id) : null]).sort()
  );
  snapshot["__systemRollups"] = Object.fromEntries(
    systems.SYSTEMS.map((s) => [s.id, engine.systemRollup ? call(engine.systemRollup, s.id) : null]).sort()
  );

  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  const exportCount = Object.keys(snapshot).length;
  console.log(`wrote ${outPath} — ${exportCount} top-level entries`);
} finally {
  await server.close();
}
