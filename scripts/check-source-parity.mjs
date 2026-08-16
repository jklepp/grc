// Asserts the TypeScript source and the YAML source are indistinguishable.
//
// This is the check that makes the seam a claim rather than a hope. If
// loadGraph(ACME_FACTS) and loadGraph(YAML_FACTS) assemble to identical graphs,
// then "the engine cannot tell which source it got" is a verified property, not
// a design intention — and the YAML migration is safe to switch over.
//
// It compares three layers, because they can fail independently:
//
//   facts   did the export lose or mangle a record on the way out
//   graph   do the two assemble to the same indexes and normalized collections
//   engine  do they derive the same numbers, which is what anyone actually sees
//
// LIFECYCLE — read this before treating a failure as a bug. This script exists
// to prove the YAML migration was lossless, and YAML is now the live source. It
// is NOT wired into build or typecheck, deliberately: the moment someone edits a
// YAML fact (which is the whole point of having migrated), the TypeScript
// modules become stale and this will report differences that are correct and
// intended. At that point retire sources/acme.ts and delete this script — the
// golden master in snapshot-derivations.mjs is the ongoing safety net, and it
// needs only one source. Until then this is worth keeping, because it is the
// only thing standing between "the two sources agree" and "we assume they do."
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

let failures = 0;

// Both engines are built with the SAME clock. Evidence freshness decays
// continuously, so two engines constructed even seconds apart can legitimately
// disagree in the low decimals — which would look exactly like a parity bug.
const FIXED_NOW = new Date("2026-08-15T12:00:00.000Z");

// Sorts object keys, preserves array order. Two adapters that declare the same
// fields in a different order produce the same graph — JS insertion order is not
// semantically meaningful here, and comparing raw JSON.stringify output would
// report that cosmetic difference as a parity failure. Array order IS meaningful
// (a rollup's steps, an evidence allocation) and is left alone.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

function compare(label, a, b) {
  const left = JSON.stringify(canonical(a));
  const right = JSON.stringify(canonical(b));
  if (left === right) {
    console.log(`  ok    ${label}`);
    return;
  }
  failures++;
  console.log(`  FAIL  ${label}`);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] !== right[i]) {
      console.log(`        first divergence at char ${i}:`);
      console.log(`          ts:   ...${left.slice(Math.max(0, i - 80), i + 80)}`);
      console.log(`          yaml: ...${right.slice(Math.max(0, i - 80), i + 80)}`);
      break;
    }
  }
}

try {
  const { loadGraph } = await server.ssrLoadModule("/src/graph/load.ts");
  const { createEngine } = await server.ssrLoadModule("/src/engine/create.ts");
  const { ACME_FACTS } = await server.ssrLoadModule("/src/graph/sources/acme.ts");
  const { YAML_FACTS } = await server.ssrLoadModule("/src/graph/sources/yaml.ts");

  console.log("\nFacts (did the export lose anything)");
  const factKeys = [...new Set([...Object.keys(ACME_FACTS), ...Object.keys(YAML_FACTS)])].sort();
  factKeys.forEach((k) => compare(k, ACME_FACTS[k], YAML_FACTS[k]));

  console.log("\nAssembled graph");
  const tsGraph = loadGraph(ACME_FACTS);
  const yamlGraph = loadGraph(YAML_FACTS);
  const graphKeys = Object.keys(tsGraph).sort();
  graphKeys.forEach((k) => compare(k, tsGraph[k], yamlGraph[k]));

  console.log("\nDerived numbers (same clock for both)");
  const tsEngine = createEngine(tsGraph, { ctx: { now: FIXED_NOW } });
  const yamlEngine = createEngine(yamlGraph, { ctx: { now: FIXED_NOW } });

  compare("enterprise", tsEngine.rollups.enterprise, yamlEngine.rollups.enterprise);
  compare("assetRollups", tsEngine.rollups.assetRollups, yamlEngine.rollups.assetRollups);
  compare("systemRollups", tsEngine.rollups.systemRollups, yamlEngine.rollups.systemRollups);
  compare("riskRollups", tsEngine.risk.riskRollups, yamlEngine.risk.riskRollups);
  compare("materialRisks", tsEngine.risk.MATERIAL_RISKS, yamlEngine.risk.MATERIAL_RISKS);
  compare("categoryAverages", tsEngine.rollups.categoryPortfolioAverages, yamlEngine.rollups.categoryPortfolioAverages);
  compare("enterpriseCoverage", tsEngine.compliance.ENTERPRISE_COVERAGE, yamlEngine.compliance.ENTERPRISE_COVERAGE);
  compare("frameworkPosture", tsEngine.compliance.FRAMEWORK_POSTURE, yamlEngine.compliance.FRAMEWORK_POSTURE);
  compare("systemCoverage", tsEngine.compliance.SYSTEM_COVERAGE, yamlEngine.compliance.SYSTEM_COVERAGE);
  compare("findings", tsEngine.findings.ALL_FINDINGS, yamlEngine.findings.ALL_FINDINGS);
  compare("modelHealth", tsEngine.selectors.modelHealth(), yamlEngine.selectors.modelHealth());

  console.log(
    failures === 0
      ? "\n*** SOURCES ARE INTERCHANGEABLE — the engine cannot tell them apart ***\n"
      : `\n*** ${failures} DIFFERENCE(S) ***\n`
  );
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  await server.close();
}
