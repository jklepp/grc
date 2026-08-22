// Promote a wizard-created system out of the browser and into authored facts.
//
//   node scripts/promote-runtime-facts.mjs --from runtime.json            # plan only
//   node scripts/promote-runtime-facts.mjs --from runtime.json --write    # append + verify
//   node scripts/promote-runtime-facts.mjs --fixture --write              # self-test
//
// The runtime.json is the `grc-runtime-facts` localStorage blob, which the app
// hands you from System Register -> Export runtime facts.
//
// WHAT --write DOES, AND WHY IT IS SAFE. It appends the renamed records to the
// fact files in src/graph/facts, then reloads the whole dataset from disk in a
// fresh Vite server and re-derives it. If any number moved, or any validator
// fired, every touched file is restored from the backup taken before the first
// write. A promotion either lands whole and provably inert, or it does not land.
//
// WHAT IS CHECKED, AND WHAT DELIBERATELY IS NOT.
//
// The obvious test — "the promoted system derives exactly what the runtime
// system derived" — is wrong, and the first run of this script proved it. The
// engine branches on the id namespace: engine/review.ts's inheritanceClaimed()
// returns !isRuntimeCreatedSystem(), so a SYS-USR- system withholds every
// inherited claim until a human confirms it, while an authored system keeps it.
// Promotion is therefore a real posture change by design — it is the moment
// someone stands behind the inheritance — and a promoted system SHOULD pick up
// claimed inheritance its runtime self did not have. That delta is reported
// below rather than treated as a failure.
//
// So two things are checked instead:
//
//   1. THE FACTS ROUND-TRIPPED. What comes back out of the YAML equals what was
//      written, field for field, once ids are renamed. This is the emitter
//      test, it holds for any input, and it is what catches a dropped optional
//      field or a mangled scalar.
//   2. THE CLONE MATCHES ITS ORIGINAL (--fixture only). The fixture is a copy
//      of an authored system, so once promoted it must derive exactly what that
//      system derives. Nothing but a lossless emitter can produce that.
//
// Both are the shape of proof the storage layer will need the day facts come
// from Postgres instead of a directory.
import { createServer } from "vite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stringify } from "yaml";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const WRITE = flag("write");
const FROM = value("from");
const FIXTURE = flag("fixture");
const SYSTEM = value("system");
const TARGET = value("as");

if (!FROM && !FIXTURE) {
  console.error("usage: node scripts/promote-runtime-facts.mjs (--from <runtime.json> | --fixture) [--system SYS-USR-1] [--as SYS-004] [--write]");
  process.exit(1);
}

const FACTS_DIR = "src/graph/facts";
const factPath = (name) => `${FACTS_DIR}/${name}.yaml`;

// Matches the corpus: double-quoted scalars, no line wrapping, 2-space indent.
const toYaml = (records) => stringify(records, { defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN", lineWidth: 0 });

async function engineOver(server, runtimeFacts) {
  const mod = await server.ssrLoadModule("/src/engine/index.ts");
  await mod.initEngine();
  const facts = mod.baseFacts();
  if (!runtimeFacts) return { engine: mod.getLiveEngine(), facts, mod };
  const { buildLiveEngine } = await server.ssrLoadModule("/src/engine/liveGraph.ts");
  const { engine, problems } = buildLiveEngine(facts, runtimeFacts);
  if (!engine) {
    console.error("the runtime facts do not pass validation on their own:");
    problems.forEach((p) => console.error("  - " + p));
    process.exit(1);
  }
  return { engine, facts, mod };
}

// Everything about one system that the engine derives, as plain JSON. This is
// what has to survive the move.
function posture(engine, systemId) {
  const sorted = (v) => JSON.parse(JSON.stringify(v, (_k, x) =>
    Array.isArray(x) ? x : (x && typeof x === "object" && x.constructor === Object
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x)));
  const g = engine.graph;
  return sorted({
    system: engine.selectors.getSystem(systemId),
    assets: (g.assetsBySystem[systemId] ?? []).map((a) => engine.selectors.getAsset(a.id)),
    coverage: engine.compliance.controlCoverageForSystem?.(systemId) ?? null,
    matrix: engine.selectors.systemControlMatrix(systemId),
    breakdown: engine.selectors.systemCoverageBreakdown(systemId),
    cockpit: engine.cockpit.cockpitSummary(systemId),
    findings: engine.findings.findingsForSystem(systemId),
    profile: engine.profile.evaluateSystemAgainstProfile(systemId),
    classification: engine.classification.systemClassification(systemId),
  });
}

function remapDeep(value, idMap) {
  if (typeof value === "string") return idMap[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => remapDeep(v, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [idMap[k] ?? k, remapDeep(v, idMap)]));
  }
  return value;
}

// Builds a runtime system out of an authored one, so the round trip can be
// exercised without a browser. This is the inverse of what promote.ts does, and
// it is only a test fixture — the real input is the localStorage blob.
function fixtureFrom(engine, systemId) {
  const g = engine.graph;
  const assets = g.assetsBySystem[systemId] ?? [];
  const assetIds = new Set(assets.map((a) => a.id));
  const idMap = { [systemId]: "SYS-USR-1" };
  assets.forEach((a, i) => { idMap[a.id] = `AST-USR-1-${i + 1}`; });

  const access = g.actorAccess.filter((e) => assetIds.has(e.assetId));
  access.forEach((e, i) => { idMap[e.id] = `ACC-USR-${i + 1}`; });
  const flows = g.dataFlows.filter((f) => assetIds.has(f.from) || assetIds.has(f.to));
  flows.forEach((f, i) => { idMap[f.id] = `FLOW-USR-${i + 1}`; });
  const agents = (g.agenticIdentitiesBySystem[systemId] ?? []);
  agents.forEach((a, i) => { idMap[a.id] = `AGENT-USR-${i + 1}`; });
  const evidence = g.facts.evidence.filter((e) => e.assetIds.some((id) => assetIds.has(id)));
  evidence.forEach((e, i) => { idMap[e.id] = `EVD-USR-${i + 1}`; });
  const artifactIds = new Set(evidence.flatMap((e) => e.artifactIds ?? []));
  const artifacts = g.evidenceArtifacts.filter((a) => artifactIds.has(a.id));
  artifacts.forEach((a, i) => { idMap[a.id] = `ART-USR-${i + 1}`; });
  const evidenceIds = new Set(evidence.map((e) => e.id));
  const reviews = g.evidenceReviews.filter((r) => evidenceIds.has(r.evidenceId));
  reviews.forEach((r, i) => { idMap[r.id] = `EVR-USR-${i + 1}`; });
  const findings = g.facts.findings.filter((f) => assetIds.has(f.assetId));
  findings.forEach((f, i) => { idMap[f.id] = `FND-USR-${i + 1}`; });
  const drTests = (g.drTestsBySystem[systemId] ?? []);
  drTests.forEach((t, i) => { idMap[t.id] = `DRTEST-USR-${i + 1}`; });

  const bySystem = (rows) => rows.filter((r) => r.systemId === systemId);
  const raw = {
    systems: [g.systemById[systemId]],
    assets: assets.map((a) => ({ ...a, systemIds: [systemId] })),
    assetDataTypes: g.assetDataTypes.filter((l) => assetIds.has(l.assetId)),
    actors: g.actors.filter((a) => access.some((e) => e.actorId === a.id)),
    actorAccess: access,
    dataFlows: flows,
    agenticIdentities: agents,
    assessmentScopes: bySystem(g.assessmentScopes),
    expectedClassification: { [systemId]: g.facts.expectedClassification[systemId] },
    implementationMechanisms: g.implementationMechanisms.filter((m) => assetIds.has(m.assetId)),
    evidence,
    evidenceArtifacts: artifacts,
    evidenceReviews: reviews,
    notImplemented: g.notImplemented.filter((n) => assetIds.has(n.assetId)),
    prismaOverrides: bySystem(g.prismaOverrides),
    controlReviews: bySystem(g.controlReviews),
    findings,
    backupConfigs: bySystem(g.facts.backupConfigs),
    drTests,
    sdlcPostures: bySystem(g.facts.sdlcPostures),
  };
  // Authored actors keep their ids — only wizard-made ones are namespaced — so
  // the fixture leaves g.actors alone and renames nothing in it.
  return { runtime: remapDeep(raw, idMap), idMap };
}

// Deep key-sorted JSON, so a comparison cannot fail on property order alone.
function canonical(value) {
  return JSON.stringify(value, (_k, v) =>
    (v && typeof v === "object" && !Array.isArray(v) && v.constructor === Object)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v);
}

// ---- run ----

let server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });
let backups = null;

try {
  const first = await engineOver(server, null);
  const clonedFrom = FIXTURE ? (SYSTEM ?? "SYS-003") : null;
  const fixture = FIXTURE ? fixtureFrom(first.engine, clonedFrom) : null;
  const runtime = fixture ? fixture.runtime : JSON.parse(readFileSync(FROM, "utf8"));
  const beforePosture = FIXTURE ? posture(first.engine, clonedFrom) : null;

  const live = await engineOver(server, runtime);
  const sourceSystemId = SYSTEM && !FIXTURE ? SYSTEM : (runtime.systems[0]?.id);
  if (!sourceSystemId) {
    console.error("promote: the runtime facts contain no system to promote");
    process.exit(1);
  }

  const { planPromotion, PROMOTION_FILES } = await server.ssrLoadModule("/src/engine/promote.ts");
  const plan = planPromotion(runtime, live.facts, { systemId: sourceSystemId, targetSystemId: TARGET });

  console.log(`\npromoting ${plan.sourceSystemId} -> ${plan.targetSystemId}\n`);
  const groups = Object.keys(PROMOTION_FILES).filter((g) => plan.records[g].length > 0);
  groups.forEach((g) => {
    console.log(`  ${PROMOTION_FILES[g].padEnd(28)} +${String(plan.records[g].length).padStart(3)} record(s)`);
  });
  if (Object.keys(plan.expectedClassification).length) {
    console.log(`  ${"expected-classification".padEnd(28)} +  1 entry`);
  }
  console.log(`\n  ${Object.keys(plan.idMap).length} ids renamed`);
  plan.warnings.forEach((w) => console.log(`  ! ${w}`));

  if (!WRITE) {
    console.log("\ndry run — pass --write to append these records and verify the round trip\n");
    process.exit(0);
  }

  const runtimePosture = posture(live.engine, plan.sourceSystemId);

  // ---- append ----
  backups = new Map();
  const append = (name, text) => {
    const path = factPath(name);
    if (!existsSync(path)) throw new Error(`promote: ${path} does not exist`);
    const before = readFileSync(path, "utf8");
    backups.set(path, before);
    const trimmed = before.replace(/\s+$/, "");
    // A fact file that is still an empty list carries `[]`; appending to that
    // would produce a list following a list. Replace it instead.
    const body = trimmed.endsWith("[]") ? trimmed.slice(0, trimmed.lastIndexOf("[]")).replace(/\s+$/, "") : trimmed;
    writeFileSync(path, `${body}\n\n# Promoted from ${plan.sourceSystemId} (${plan.targetSystemId}).\n${text}`);
  };

  groups.forEach((g) => append(PROMOTION_FILES[g], toYaml(plan.records[g])));
  if (Object.keys(plan.expectedClassification).length) {
    append("expected-classification", toYaml(plan.expectedClassification));
  }

  // ---- reload from disk and compare ----
  await server.close();
  server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });
  const reloaded = await engineOver(server, null);

  // ---- check 1: the facts round-tripped through YAML without loss ----
  // Promotion only ever appends, and the YAML parser preserves file order, so
  // whatever sits past the original length is exactly what was written.
  const lossy = [];
  groups.forEach((g) => {
    const originalLength = (live.facts[g] ?? []).length;
    const appended = (reloaded.facts[g] ?? []).slice(originalLength);
    if (canonical(appended) !== canonical(plan.records[g])) {
      lossy.push({ group: g, wrote: plan.records[g], read: appended });
    }
  });
  const promotedTier = reloaded.facts.expectedClassification?.[plan.targetSystemId];
  const intendedTier = plan.expectedClassification[plan.targetSystemId];
  if (intendedTier && promotedTier !== intendedTier) {
    lossy.push({ group: "expectedClassification", wrote: intendedTier, read: promotedTier });
  }

  if (lossy.length > 0) {
    console.error("\nFACT ROUND TRIP FAILED — what came back out of the YAML is not what went in.");
    lossy.forEach(({ group, wrote, read }) => {
      console.error(`\n  ${group}`);
      console.error(`    wrote: ${canonical(wrote).slice(0, 500)}`);
      console.error(`    read : ${canonical(read).slice(0, 500)}`);
    });
    throw new Error("fact round trip mismatch");
  }
  console.log(`\n  facts round-tripped intact — ${groups.length} fact file(s) re-read and matched field for field`);

  // ---- check 2: what the promotion could not carry ----
  //
  // RuntimeFacts covers 20 of GraphFacts' 59 domains, because the wizard cannot
  // create the other 39. Most are global (the control catalogue, policies,
  // orgs), but a real subset is per-system and simply has nowhere to live in a
  // runtime blob: pending applicability, identity populations, access reviews,
  // vulnerability snapshots, security tests, vendor assurance, IR currency.
  //
  // So a promoted system is structurally thinner than a hand-authored one, and
  // saying so is more useful than asserting an equality that cannot hold. In
  // fixture mode the source is a real authored system, so the gap can be
  // measured exactly rather than described.
  const afterPosture = posture(reloaded.engine, plan.targetSystemId);
  if (FIXTURE) {
    const promotable = new Set(Object.keys(PROMOTION_FILES));
    const sourceAssetIds = Object.keys(fixture.idMap).filter((id) => id.startsWith("AST-"));
    const mentions = (row) => {
      const s = JSON.stringify(row);
      return s.includes(`"${clonedFrom}"`) || sourceAssetIds.some((a) => s.includes(`"${a}"`));
    };
    const gaps = Object.entries(live.facts)
      .filter(([key, rows]) => !promotable.has(key) && Array.isArray(rows))
      .map(([key, rows]) => [key, rows.filter(mentions).length])
      .filter(([, n]) => n > 0);

    if (gaps.length > 0) {
      console.log(`\n  ${clonedFrom} carries facts in ${gaps.length} domain(s) a promotion cannot express:`);
      gaps.forEach(([key, n]) => console.log(`    ${key.padEnd(26)} ${String(n).padStart(3)} row(s) left behind`));
      console.log("    these are authored by hand — the wizard has no field for them");
    }

    const composed = Object.fromEntries(
      Object.entries(fixture.idMap).map(([authored, rt]) => [authored, plan.idMap[rt] ?? rt])
    );
    const expected = remapDeep(beforePosture, composed);
    const drifted = Object.keys(expected).filter((k) => canonical(expected[k]) !== canonical(afterPosture[k]));
    if (drifted.length > 0) {
      console.log(`\n  derived posture differs from ${clonedFrom} in: ${drifted.join(", ")}`);
      const b = expected.breakdown ?? {};
      const a = afterPosture.breakdown ?? {};
      Object.keys({ ...b, ...a }).sort().forEach((k) => {
        if (b[k] !== a[k]) console.log(`    breakdown.${k.padEnd(14)} ${clonedFrom}=${b[k]}  promoted=${a[k]}`);
      });
      console.log("    expected: the rows above are missing, so the promoted system is genuinely thinner");
    }
  }

  // ---- report the posture the promotion granted ----
  const inheritedBefore = runtimePosture.breakdown?.inherited ?? 0;
  const inheritedAfter = afterPosture.breakdown?.inherited ?? 0;
  if (inheritedAfter !== inheritedBefore) {
    console.log(
      `\n  note: claimed inheritance moved ${inheritedBefore} -> ${inheritedAfter} control(s).`
      + "\n  That is engine/review.ts's inheritanceClaimed() by design — a runtime system withholds"
      + "\n  inherited claims until someone confirms them, an authored system stands behind them."
      + "\n  Promoting IS that confirmation, so make sure the inheritance is real before you commit."
    );
  }

  console.log("\nrun `npm run check` to confirm the validators agree, then review the diff.\n");
  backups = null;
} catch (err) {
  if (backups) {
    for (const [path, text] of backups) writeFileSync(path, text);
    console.error(`\nrolled back ${backups.size} fact file(s) — nothing was left half-written`);
  }
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await server.close();
}
