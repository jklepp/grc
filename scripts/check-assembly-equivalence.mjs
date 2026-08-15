// Proves assembleGraph(ACME_FACTS) reproduces the indexes that currently live as
// module-level consts inside the node and edge files.
//
// This is the check that makes the rest of the refactor safe to do quickly. If
// the assembled graph agrees with the modules everywhere, then swapping the
// engine over to read from the graph cannot change a derived number, and any
// later golden-master diff is a genuine regression rather than an artifact of
// the indexes having been rebuilt slightly differently.
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

let failures = 0;
const compare = (label, a, b) => {
  const norm = (v) => JSON.stringify(v, Object.keys(v ?? {}).sort?.() ?? undefined);
  const left = JSON.stringify(a);
  const right = JSON.stringify(b);
  if (left === right) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`);
    console.log(`        module   length=${Array.isArray(a) ? a.length : Object.keys(a ?? {}).length}`);
    console.log(`        assembled length=${Array.isArray(b) ? b.length : Object.keys(b ?? {}).length}`);
    // Show the first divergence rather than dumping two large blobs.
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      if (left[i] !== right[i]) {
        console.log(`        first divergence at char ${i}:`);
        console.log(`          module:    ...${left.slice(Math.max(0, i - 60), i + 60)}`);
        console.log(`          assembled: ...${right.slice(Math.max(0, i - 60), i + 60)}`);
        break;
      }
    }
  }
};

try {
  const { assembleGraph } = await server.ssrLoadModule("/src/graph/assemble.ts");
  const { ACME_FACTS } = await server.ssrLoadModule("/src/graph/sources/acme.ts");
  const g = assembleGraph(ACME_FACTS);

  const assets = await server.ssrLoadModule("/src/graph/nodes/assets.ts");
  const systems = await server.ssrLoadModule("/src/graph/nodes/systems.ts");
  const dataTypes = await server.ssrLoadModule("/src/graph/nodes/dataTypes.ts");
  const controls = await server.ssrLoadModule("/src/graph/nodes/controls.ts");
  const keyControls = await server.ssrLoadModule("/src/graph/nodes/keyControls.ts");
  const evidence = await server.ssrLoadModule("/src/graph/nodes/evidence.ts");
  const evidenceSources = await server.ssrLoadModule("/src/graph/nodes/evidenceSources.ts");
  const risks = await server.ssrLoadModule("/src/graph/nodes/risks.ts");
  const orgs = await server.ssrLoadModule("/src/graph/nodes/orgs.ts");
  const actors = await server.ssrLoadModule("/src/graph/nodes/actors.ts");
  const profiles = await server.ssrLoadModule("/src/graph/nodes/controlProfiles.ts");
  const assetDataTypes = await server.ssrLoadModule("/src/graph/edges/assetDataTypes.ts");
  const dataFlows = await server.ssrLoadModule("/src/graph/edges/dataFlows.ts");
  const actorAccess = await server.ssrLoadModule("/src/graph/edges/actorAccess.ts");
  const applicability = await server.ssrLoadModule("/src/graph/edges/applicabilityRules.ts");
  const assessments = await server.ssrLoadModule("/src/graph/edges/categoryAssessments.ts");
  const riskContrib = await server.ssrLoadModule("/src/graph/edges/riskContributors.ts");

  console.log("\nNormalized collections");
  compare("EVIDENCE (validity defaults + sourceId)", evidence.EVIDENCE, g.evidence);
  compare("EVIDENCE_SOURCES (derived)", evidenceSources.EVIDENCE_SOURCES, g.evidenceSources);
  compare("EVIDENCE_SOURCE_CONFLICTS", evidenceSources.EVIDENCE_SOURCE_CONFLICTS, g.sourceConflicts);

  console.log("\nEntity indexes");
  compare("ASSET_BY_ID", assets.ASSET_BY_ID, g.assetById);
  compare("SYSTEM_BY_ID", systems.SYSTEM_BY_ID, g.systemById);
  compare("DATA_TYPE_BY_ID", dataTypes.DATA_TYPE_BY_ID, g.dataTypeById);
  compare("CONTROL_BY_ID", controls.CONTROL_BY_ID, g.controlById);
  compare("KEY_CONTROL_BY_ID", keyControls.KEY_CONTROL_BY_ID, g.keyControlById);
  compare("EVIDENCE_BY_ID", evidence.EVIDENCE_BY_ID, g.evidenceById);
  compare("EVIDENCE_SOURCE_BY_ID", evidenceSources.EVIDENCE_SOURCE_BY_ID, g.evidenceSourceById);
  compare("RISK_BY_ID", risks.RISK_BY_ID, g.riskById);
  compare("ORG_BY_ID", orgs.ORG_BY_ID, g.orgById);
  compare("ACTOR_BY_ID", actors.ACTOR_BY_ID, g.actorById);

  console.log("\nControl profile resolution");
  compare("CONTROL_PROFILES", profiles.CONTROL_PROFILES, g.controlProfiles);
  compare("CATEGORY_WEIGHTS", profiles.CATEGORY_WEIGHTS, g.categoryWeights);

  console.log("\nMembership sets");
  compare("ASSESSED_ASSET_IDS", assessments.ASSESSED_ASSET_IDS, g.assessedAssetIds);
  compare("ASSET_SCOPED_CONTROLS", keyControls.ASSET_SCOPED_CONTROLS, g.assetScopedControls);
  compare("PROGRAM_SCOPED_CONTROLS", keyControls.PROGRAM_SCOPED_CONTROLS, g.programScopedControls);

  console.log("\nTraversal helpers (every id, both directions)");
  const perId = (label, ids, moduleFn, assembledLookup) => {
    const mismatches = ids.filter(
      (id) => JSON.stringify(moduleFn(id)) !== JSON.stringify(assembledLookup[id] ?? [])
    );
    if (mismatches.length === 0) {
      console.log(`  ok    ${label} (${ids.length} ids)`);
    } else {
      failures++;
      console.log(`  FAIL  ${label} — ${mismatches.length}/${ids.length} mismatched, e.g. ${mismatches[0]}`);
      console.log(`        module:    ${JSON.stringify(moduleFn(mismatches[0])).slice(0, 200)}`);
      console.log(`        assembled: ${JSON.stringify(assembledLookup[mismatches[0]] ?? []).slice(0, 200)}`);
    }
  };

  const assetIds = assets.ASSETS.map((a) => a.id);
  const systemIds = systems.SYSTEMS.map((s) => s.id);
  const riskIds = risks.RISKS.map((r) => r.id);
  const dataTypeIds = dataTypes.DATA_TYPES.map((d) => d.id);
  const controlIds = keyControls.KEY_CONTROLS.map((c) => c.id);

  perId("assetsForSystem", systemIds, systems && assets.assetsForSystem, g.assetsBySystem);
  perId("dataTypesForAsset", assetIds, assetDataTypes.dataTypesForAsset, g.dataTypesByAsset);
  perId("assetsForDataType", dataTypeIds, assetDataTypes.assetsForDataType, g.assetsByDataType);
  perId("flowsFrom", assetIds, dataFlows.flowsFrom, g.flowsFromAsset);
  perId("flowsTo", assetIds, dataFlows.flowsTo, g.flowsToAsset);
  perId("actorAccessForAsset", assetIds, actorAccess.actorAccessForAsset, g.actorAccessByAsset);
  perId("rulesForControl", controlIds, applicability.rulesForControl, g.rulesByControl);
  perId("assetsForRisk", riskIds, riskContrib.assetsForRisk, g.assetsByRisk);
  perId("controlsForRisk", riskIds, riskContrib.controlsForRisk, g.controlsByRisk);
  perId("risksForAsset", assetIds, riskContrib.risksForAsset, g.risksByAsset);
  perId("risksForControl", controlIds, riskContrib.risksForControl, g.risksByControl);

  console.log("\nPair lookups (every asset x every key control)");
  const pairChecks = [
    ["evidenceFor", (a, c) => evidence.evidenceFor(a, c), (a, c) => g.evidenceByPair[`${a}::${c}`] ?? []],
    ["assessmentFor", (a, c) => assessments.assessmentFor(a, c), null],
    ["exceptionFor", (a, c) => applicability.exceptionFor(a, c), (a, c) => g.exceptionByPair[`${a}::${c}`] ?? null],
  ];
  let pairMismatch = 0;
  let pairTotal = 0;
  for (const assetId of assetIds) {
    for (const controlId of controlIds) {
      pairTotal++;
      const modEvidence = JSON.stringify(evidence.evidenceFor(assetId, controlId));
      const asmEvidence = JSON.stringify(g.evidenceByPair[`${assetId}::${controlId}`] ?? []);
      const modExc = JSON.stringify(applicability.exceptionFor(assetId, controlId));
      const asmExc = JSON.stringify(g.exceptionByPair[`${assetId}::${controlId}`] ?? null);
      if (modEvidence !== asmEvidence || modExc !== asmExc) pairMismatch++;
    }
  }
  if (pairMismatch === 0) console.log(`  ok    evidenceFor + exceptionFor (${pairTotal} pairs)`);
  else {
    failures++;
    console.log(`  FAIL  ${pairMismatch}/${pairTotal} pairs mismatched`);
  }

  console.log(failures === 0 ? "\nALL EQUIVALENT\n" : `\n${failures} CHECK(S) FAILED\n`);
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  await server.close();
}
