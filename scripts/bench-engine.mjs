// Where engine time actually goes.
//
// The premise of the caching work is that the derivation graph is re-entrant:
// one call to formalAssessmentForSystem rebuilds the control matrix several
// times over, and nothing remembers the answer. That is invisible at the
// production dataset's two systems, and it is not measurable in a browser under
// automation — a backgrounded tab throttles timers and never paints, so
// longtask and rAF both lie.
//
// So measure it here instead: Node, deterministic, no rendering. Two readings.
//
//   1. CALL COUNTS. Every engine namespace method is wrapped in a counter, then
//      a realistic page's worth of derivations is run. A function called six
//      times for one screen is the case for caching it, and the count is the
//      same at n=2 as at n=200 — which is why this reading is useful today.
//   2. WALL TIME per call, so the counts can be turned into milliseconds.
//
// Usage: node scripts/bench-engine.mjs
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "warn",
});

function fmt(ms) {
  return `${ms.toFixed(2)} ms`;
}

function time(label, fn, runs = 1) {
  // One warm-up so we are not measuring first-call JIT.
  fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const total = performance.now() - t0;
  return { label, runs, total, each: total / runs };
}

try {
  const { loadGraph } = await server.ssrLoadModule("/src/graph/load.ts");
  const { createEngine } = await server.ssrLoadModule("/src/engine/create.ts");
  const { buildLiveEngine, emptyRuntimeFacts } = await server.ssrLoadModule("/src/engine/liveGraph.ts");
  const { YAML_FACTS } = await server.ssrLoadModule("/src/graph/sources/yaml.ts");

  const graph = loadGraph(YAML_FACTS);
  const engine = createEngine(graph);
  const systems = engine.rollups.systemRollups;

  console.log(`dataset: ${systems.length} systems, ${graph.assets.length} assets, ${engine.applicability.applicableControlsForSystem(engine.rollups.systemRollups[0].id).length} applicable controls on system 1\n`);

  // ---- 1. Call counts for one system workspace render -----------------------
  //
  // Wrap every method on the namespaces the workspace touches, run what
  // SystemWorkspace's memo block runs, and see what got asked twice.
  const counts = new Map();
  const namespaces = ["compliance", "review", "cockpit", "profile", "assessment", "applicability", "rollups"];
  for (const ns of namespaces) {
    const target = engine[ns];
    if (!target) continue;
    for (const key of Object.keys(target)) {
      const original = target[key];
      if (typeof original !== "function") continue;
      target[key] = (...args) => {
        const name = `${ns}.${key}`;
        counts.set(name, (counts.get(name) ?? 0) + 1);
        return original(...args);
      };
    }
  }

  const systemId = systems[0].id;
  // The derivations SystemWorkspace asks for on one render.
  engine.compliance.systemControlMatrix(systemId);
  engine.compliance.systemCoverageBreakdown(systemId);
  engine.compliance.controlApplicabilitySummary(systemId);
  engine.profile.profileSummary(systemId);
  engine.cockpit.cockpitSummary(systemId);
  engine.review.formalAssessmentForSystem(systemId);

  const repeated = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);

  console.log("call counts for ONE system workspace render");
  console.log("(anything above 1 is work repeated inside a single screen)\n");
  for (const [name, n] of repeated.slice(0, 18)) {
    console.log(`  ${String(n).padStart(5)}x  ${name}`);
  }
  const totalCalls = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`\n  ${String(totalCalls).padStart(5)}   total engine calls\n`);

  // Unwrap before timing, so the counter does not distort the numbers.
  const fresh = createEngine(loadGraph(YAML_FACTS));

  // ---- 2. Wall time ---------------------------------------------------------
  const { assembleGraph } = await server.ssrLoadModule("/src/graph/assemble.ts");
  const { validateGraph } = await server.ssrLoadModule("/src/graph/validate.ts");
  const { validateDerivations } = await server.ssrLoadModule("/src/engine/validateDerivations.ts");
  const assembled = assembleGraph(YAML_FACTS);
  const builtEngine = createEngine(assembled, { validate: false });

  const rows = [
    time("assembleGraph", () => assembleGraph(YAML_FACTS), 20),
    time("  validateGraph (dev only now)", () => validateGraph(assembled), 20),
    time("createEngine (no validation)", () => createEngine(assembled, { validate: false }), 20),
    time("  validateDerivations (dev only now)", () => validateDerivations(builtEngine), 20),
    time("loadGraph + createEngine (boot)", () => createEngine(loadGraph(YAML_FACTS)), 5),
    time("buildLiveEngine (every save)", () => buildLiveEngine(YAML_FACTS, emptyRuntimeFacts()), 5),
    time("systemControlMatrix", () => fresh.compliance.systemControlMatrix(systemId), 50),
    time("controlApplicabilitySummary", () => fresh.compliance.controlApplicabilitySummary(systemId), 50),
    time("profileSummary", () => fresh.profile.profileSummary(systemId), 50),
    time("cockpitSummary", () => fresh.cockpit.cockpitSummary(systemId), 50),
    time("formalAssessmentForSystem", () => fresh.review.formalAssessmentForSystem(systemId), 20),
  ];

  console.log("wall time per call");
  console.log(`  ${"".padEnd(34)}${"each".padStart(12)}${"runs".padStart(7)}`);
  for (const r of rows) {
    console.log(`  ${r.label.padEnd(34)}${fmt(r.each).padStart(12)}${String(r.runs).padStart(7)}`);
  }

  // A workspace render costs the repeated calls, not one of each.
  const matrix = rows.find((r) => r.label === "systemControlMatrix");
  const matrixCalls = counts.get("compliance.systemControlMatrix") ?? 0;
  if (matrix && matrixCalls > 1) {
    const wasted = matrix.each * (matrixCalls - 1);
    console.log(
      `\n  systemControlMatrix runs ${matrixCalls}x per render at ${fmt(matrix.each)} each;` +
      `\n  caching it per engine instance would return ${fmt(wasted)} per render, per system.`
    );
  }
  // ---- 3. Scaling ---------------------------------------------------------
  //
  // The per-system derivations above are cheap and stay cheap: they are keyed
  // by system, so fifty systems do not make any one workspace slower. What
  // does grow is engine CONSTRUCTION, whose eager pass walks every asset x
  // every control and every system x every applicable control — and it runs
  // on boot and twice on every save.
  //
  // So clone the dataset's busiest system N times and watch construction.
  // The clone is crude on purpose: stringify the whole fact set, rewrite the
  // ids belonging to one system, and keep the rows that changed. If it
  // produced an invalid graph, validateGraph below says so and the number is
  // discarded rather than quietly believed.
  const busiest = [...systems].sort((a, b) => b.assetCount - a.assetCount)[0];
  const assetIds = graph.assets.filter((a) => a.systemIds.includes(busiest.id)).map((a) => a.id);
  // Findings carry their own ids and are pointed at by implementation
  // overrides, so they have to be renamed alongside the assets or the clone
  // ends up referencing the original system's findings.
  const findingIds = (YAML_FACTS.findings ?? [])
    .filter((f) => JSON.stringify(f).includes(busiest.id))
    .map((f) => f.id);

  function withClones(count) {
    const merged = structuredClone(YAML_FACTS);
    for (let k = 1; k <= count; k++) {
      let text = JSON.stringify(YAML_FACTS);
      text = text.split(busiest.id).join(`${busiest.id}-K${k}`);
      for (const assetId of assetIds) text = text.split(assetId).join(`${assetId}-K${k}`);
      for (const findingId of findingIds) text = text.split(`"${findingId}"`).join(`"${findingId}-K${k}"`);
      const clone = JSON.parse(text);
      const marker = `-K${k}`;
      for (const key of Object.keys(merged)) {
        if (!Array.isArray(merged[key]) || !Array.isArray(clone[key])) continue;
        for (const row of clone[key]) {
          // Only rows whose OWN identity moved. A control or policy whose prose
          // happens to mention the system also picks up the marker, and copying
          // those duplicates their ids.
          const changed = row && typeof row === "object" && "id" in row
            ? String(row.id).includes(marker)
            : JSON.stringify(row).includes(marker);
          if (changed) merged[key].push(row);
        }
      }
    }
    return merged;
  }

  console.log("\nengine construction as the dataset grows");
  console.log(`  ${"systems".padStart(9)}${"assemble".padStart(12)}${"createEngine".padStart(14)}${"buildLiveEngine".padStart(17)}`);
  for (const extra of [0, 8, 23, 48]) {
    let facts;
    try {
      facts = withClones(extra);
      validateGraph(assembleGraph(facts));
    } catch (error) {
      console.log(`  ${String(systems.length + extra).padStart(9)}   clone invalid — skipped (${String(error).replace(/s+/g," ").slice(0, 260)})`);
      continue;
    }
    const n = systems.length + extra;
    const asm = time("asm", () => assembleGraph(facts), 3);
    const built = assembleGraph(facts);
    const eng = time("eng", () => createEngine(built, { validate: false }), 3);
    const live = time("live", () => buildLiveEngine(facts, emptyRuntimeFacts()), 3);
    console.log(
      `  ${String(n).padStart(9)}${fmt(asm.each).padStart(12)}${fmt(eng.each).padStart(14)}${fmt(live.each).padStart(17)}`
    );
  }
  // ---- 4. Inside createEngine ---------------------------------------------
  //
  // createEngine is the largest number above and it grows with the dataset, so
  // it is worth knowing which of its eager passes owns the time rather than
  // guessing. Each factory is constructed here in the same dependency order
  // create.ts uses, and timed on its own.
  const mods = {};
  for (const name of [
    "classification", "applicability", "findings", "evidence", "assessment",
    "rollups", "risk", "compliance", "profile", "selectors", "identity",
    "exposure", "exceptions", "vulnerabilities", "securityTesting",
    "resilience", "incidentResponse", "vendors", "sdlc", "cockpit", "review",
  ]) {
    mods[name] = await server.ssrLoadModule(`/src/engine/${name}.ts`);
  }
  const { defaultContext } = await server.ssrLoadModule("/src/engine/context.ts");

  const bigFacts = withClones(48);
  const bigGraph = assembleGraph(bigFacts);
  const ctx = defaultContext();

  const stage = [];
  const run = (label, fn) => { const r = time(label, fn, 3); stage.push(r); return fn(); };

  const cls = run("classification", () => mods.classification.createClassification(bigGraph));
  const app = run("applicability", () => mods.applicability.createApplicability(bigGraph, cls));
  const fnd = run("findings", () => mods.findings.createFindings(bigGraph, ctx));
  const evi = run("evidence", () => mods.evidence.createEvidence(bigGraph, ctx));
  const asm2 = run("assessment", () => mods.assessment.createAssessment(bigGraph, app, evi, fnd, ctx));
  const rol = run("rollups", () => mods.rollups.createRollups(bigGraph, cls, app, asm2, fnd));
  run("risk", () => mods.risk.createRisk(bigGraph, rol, asm2));
  run("compliance", () => mods.compliance.createCompliance(bigGraph, asm2, app));
  run("profile", () => mods.profile.createProfile(bigGraph, rol));

  stage.sort((a, b) => b.each - a.each);
  const stageTotal = stage.reduce((s, r) => s + r.each, 0);
  console.log(`\ninside createEngine at ${bigGraph.systems.length} systems (factory construction)`);
  for (const r of stage) {
    const pct = Math.round((r.each / stageTotal) * 100);
    console.log(`  ${r.label.padEnd(18)}${fmt(r.each).padStart(11)}${String(pct).padStart(5)}%`);
  }
  console.log(`  ${"".padEnd(18)}${fmt(stageTotal).padStart(11)}`);
} finally {
  await server.close();
}
