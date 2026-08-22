// What the PRISMA assessment actually concluded, printed.
//
// The golden master proves a change moved nothing; this proves a change moved
// the RIGHT thing. A score is only defensible if you can watch it being built,
// so this prints every level's rating and the sentence behind it for a worked
// example, alongside the distributions that show whether a level is
// discriminating or just returning a constant.
//
// Run it after any change to engine/levels.ts. A level whose distribution
// collapses to one value has stopped measuring anything, which is a failure the
// snapshot cannot see — the numbers all changed, so the diff looks intentional.
//
//   node scripts/prisma-report.mjs                 both systems, summary
//   node scripts/prisma-report.mjs SYS-003 CRY-05  one control, in full
import { createServer } from "vite";

const [argSystem, argControl] = process.argv.slice(2);
const LEVELS = ["Policy", "Procedure", "Implemented", "Measured", "Managed"];
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fixed = (n, d = 1) => (n === null ? "n/a" : n.toFixed(d));

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

try {
  const mod = await server.ssrLoadModule("/src/engine/index.ts");
  await mod.initEngine();
  const engine = mod.getLiveEngine();
  const { graph, assessment } = engine;

  function printControl(a) {
    console.log(`\n${a.systemId} / ${a.controlId} — ${a.control.name}`);
    console.log(`  score ${a.score} (raw ${fixed(a.rawScore, 3)}) — ${a.band.label}, basis ${a.basis}${a.inherited ? ", inherited" : ""}`);
    LEVELS.forEach((level) => {
      const L = a.levels[level];
      const overridden = L.rating !== L.derived ? ` (derived ${L.derived}, overridden)` : "";
      console.log(`    ${level.padEnd(12)} ${String(L.rating).padStart(3)} x${L.weight} = ${L.contribution.toFixed(2)}${overridden}`);
      console.log(`                 ${L.rationale}`);
    });
    if (a.ladderInversions.length) console.log(`    ladder inversions: ${a.ladderInversions.join(", ")}`);
    if (a.instances.length) {
      console.log(`    instances (${a.instances.length}) — the asset drill-down:`);
      a.instances.forEach((i) =>
        console.log(`      ${i.assetId.padEnd(12)} ${i.status.padEnd(16)} credit ${i.credit}  ${i.statement}`)
      );
    }
  }

  if (argSystem && argControl) {
    const a = assessment.assessmentFor(argSystem, argControl);
    if (!a) {
      console.error(`no assessment for ${argSystem} / ${argControl}`);
      process.exitCode = 1;
    } else {
      printControl(a);
    }
  } else {
    for (const sys of graph.systems) {
      const all = assessment.assessmentsForSystem(sys.id);
      const scored = all.filter((a) => a.assessed);
      const self = scored.filter((a) => !a.inherited);
      const inherited = scored.filter((a) => a.inherited);

      console.log(`\n=== ${sys.id} ${sys.name} (${sys.hostingType}, ${sys.provider}) ===`);
      console.log(`applicable ${all.length} | self-assessed ${self.length} | inherited ${inherited.length} | unassessed ${all.length - scored.length}`);
      console.log(`coverage ${Math.round((scored.length / all.length) * 100)}%  |  mean scored score ${fixed(mean(scored.map((a) => a.rawScore)))}`);
      console.log(`  self-assessed ${fixed(mean(self.map((a) => a.rawScore)))}   inherited ${fixed(mean(inherited.map((a) => a.rawScore)))}`);

      console.log(`  per level, across scored controls:`);
      LEVELS.forEach((level) => {
        const vals = scored.map((a) => a.levels[level].rating);
        const dist = {};
        vals.forEach((v) => (dist[v] = (dist[v] ?? 0) + 1));
        const spread = Object.keys(dist).length;
        const flag = spread === 1 ? "  <-- CONSTANT, measuring nothing" : "";
        console.log(`    ${level.padEnd(12)} mean ${fixed(mean(vals)).padStart(6)}  dist ${JSON.stringify(dist)}${flag}`);
      });

      const byCategory = {};
      scored.forEach((a) => (byCategory[a.category] ||= []).push(a.rawScore));
      console.log(`  by assurance category:`);
      Object.entries(byCategory).sort().forEach(([c, xs]) =>
        console.log(`    ${c.padEnd(20)} n=${String(xs.length).padStart(3)}  mean ${fixed(mean(xs))}`)
      );

      console.log(`  ladder inversions: ${scored.filter((a) => a.ladderInversions.length > 0).length} of ${scored.length} scored controls`);

      const weakest = scored.reduce((w, a) => (a.rawScore < w.rawScore ? a : w));
      console.log(`  weakest assessed control: ${weakest.controlId} at ${weakest.score} (${weakest.control.name})`);
    }
  }
} finally {
  await server.close();
}
