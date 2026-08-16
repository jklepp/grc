// Fault injection against validateGraph and validateDerivations.
//
// A validator that passes proves nothing. The only way to know these checks are
// live is to hand them a graph that is definitely wrong and confirm they refuse
// it — which is exactly the thing that was impossible before the seam existed,
// because the checks ran as an import side effect against one hard-coded
// dataset and there was no way to construct a second, broken one.
//
// Each case below corrupts ONE fact and asserts the failure names it. A case
// that stops throwing means a real check silently died.
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

let passed = 0;
let failed = 0;

try {
  const { loadGraph } = await server.ssrLoadModule("/src/graph/load.ts");
  const { createEngine } = await server.ssrLoadModule("/src/engine/create.ts");
  const { YAML_FACTS } = await server.ssrLoadModule("/src/graph/sources/yaml.ts");

  // Deep-ish clone so each case starts from clean facts. Structured clone would
  // choke on nothing here — these are plain data — and it keeps a corruption in
  // one case from leaking into the next.
  const fresh = () => structuredClone(YAML_FACTS);

  // The baseline has to load cleanly, or every "it threw" below is meaningless.
  try {
    loadGraph(YAML_FACTS);
    console.log("  ok    baseline graph loads clean");
    passed++;
  } catch (err) {
    console.log(`  FAIL  baseline ACME graph should load clean but threw: ${err.message.slice(0, 300)}`);
    failed++;
  }

  const structural = [
    ["dangling asset.systemId", (f) => { f.assets[0].systemId = "SYS-NOPE"; }, /is not a system/],
    ["unknown asset kind", (f) => { f.assets[0].kind = "teapot"; }, /is not one of ASSET_KINDS/],
    ["duplicate node id", (f) => { f.assets[1].id = f.assets[0].id; }, /duplicate node id/],
    ["data type with bogus sensitivity", (f) => { f.dataTypes[0].sensitivity = "Spicy"; }, /is not a classification tier/],
    ["flow to a non-existent asset", (f) => { f.dataFlows[0].to = "AST-NOPE"; }, /is not an asset/],
    ["flow pointing at itself", (f) => { f.dataFlows[0].to = f.dataFlows[0].from; }, /connects an asset to itself/],
    ["flow carrying nothing", (f) => { f.dataFlows[0].dataTypeIds = []; }, /carries no data types/],
    ["tier weights not summing to 100", (f) => { f.controlProfile.categoryWeights.Restricted.Governance += 5; }, /weights sum to/],
    ["zero weight for a category", (f) => {
      const w = f.controlProfile.categoryWeights.Internal;
      w.Detection = 0; w.Governance += 0; // leave the sum wrong too; both should fire
    }, /no positive weight/],
    // Picked dynamically rather than hard-coded: the first hand-chosen id here
    // was AAT-01, which is itself a key control, so the validator correctly
    // reported a DIFFERENT violation and the case looked like a failure.
    ["evidence against a non-key control", (f) => {
      const nonKey = f.controls.find((c) => !f.keyControls.some((k) => k.id === c.id));
      f.evidence[0].controlId = nonKey.id;
    }, /is not a key control/],
    ["evidence coverage out of range", (f) => { f.evidence[0].coveragePct = 140; }, /coveragePct .* is outside 0-100/],
    ["population without exceptions", (f) => {
      const e = f.evidence.find((x) => x.population !== undefined);
      if (e) delete e.exceptions;
    }, /population and exceptions must be given together/],
    ["a 'pass' that found exceptions", (f) => {
      const e = f.evidence.find((x) => x.population !== undefined && x.exceptions > 0);
      if (e) e.result = "pass";
    }, /did not pass/],
    ["missing category assessment", (f) => { f.categoryAssessments.shift(); }, /no category assessment for/],
    ["applicability rule on a program control", (f) => {
      const program = f.keyControls.find((c) => c.scope === "program");
      if (program) f.applicabilityRules[0].controlId = program.id;
    }, /program-scoped/],
    ["exception with no reason", (f) => { f.applicabilityExceptions[0].reason = "  "; }, /needs a reason/],
    ["ownership naming a non-org", (f) => { f.ownership.program.Governance = ["not-a-team"]; }, /is not an org/],
    ["finding against a non-key control", (f) => {
      const nonKey = f.controls.find((c) => !f.keyControls.some((k) => k.id === c.id));
      f.findings[0].controlId = nonKey.id;
      // Evidence citing this finding would otherwise trip its own consistency
      // check first, masking the one under test.
      f.evidence.forEach((e) => { if (e.findingId === f.findings[0].id) delete e.findingId; });
    }, /is not a key control/],
    ["risk owned by a non-org", (f) => { f.risks[0].ownerId = "nobody"; }, /is not an org/],
    ["stale risksWithoutAssets note", (f) => {
      const linked = f.riskAssets[0].riskId;
      f.risksWithoutAssets[linked] = "stale explanation";
    }, /remove the stale explanation/],
    ["actor access to a non-existent actor", (f) => { f.actorAccess[0].actorId = "ACT-NOPE"; }, /is not an actor/],
  ];

  console.log("\nStructural checks (validateGraph, via loadGraph)");
  structural.forEach(([label, corrupt, expected]) => {
    const facts = fresh();
    corrupt(facts);
    try {
      loadGraph(facts);
      console.log(`  FAIL  ${label} — loadGraph accepted it`);
      failed++;
    } catch (err) {
      if (expected.test(err.message)) {
        console.log(`  ok    ${label}`);
        passed++;
      } else {
        console.log(`  FAIL  ${label} — threw, but not for the expected reason`);
        console.log(`        expected /${expected.source}/`);
        console.log(`        got: ${err.message.split("\n").slice(0, 2).join(" ").slice(0, 220)}`);
        failed++;
      }
    }
  });

  // Derivational checks need a graph that is structurally FINE but says
  // something false, which is the whole distinction between the two suites.
  const derivational = [
    ["exception excusing a control nothing required", (f) => {
      // A control that no rule would have required on this asset.
      const asset = f.assets.find((a) => a.kind === "iam-role") ?? f.assets[0];
      const control = f.keyControls.find((c) => c.scope === "asset");
      f.applicabilityExceptions.push({ assetId: asset.id, controlId: control.id, reason: "invented for this test" });
    }, /excuses nothing|no rule would have required/],
    ["classification no longer reproducing the curated answer", (f) => {
      f.expectedClassification[f.systems[0].id] = "Public";
    }, /classification derives to/],
  ];

  console.log("\nDerivational checks (validateDerivations, via createEngine)");
  derivational.forEach(([label, corrupt, expected]) => {
    const facts = fresh();
    corrupt(facts);
    try {
      createEngine(loadGraph(facts));
      console.log(`  FAIL  ${label} — createEngine accepted it`);
      failed++;
    } catch (err) {
      if (expected.test(err.message)) {
        console.log(`  ok    ${label}`);
        passed++;
      } else {
        console.log(`  FAIL  ${label} — threw, but not for the expected reason`);
        console.log(`        expected /${expected.source}/`);
        console.log(`        got: ${err.message.split("\n").slice(0, 2).join(" ").slice(0, 220)}`);
        failed++;
      }
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  await server.close();
}
