// Derives the per-tier control baselines from the systems already in the graph.
//
// The methodology, so the output is reviewable as a policy document rather
// than trusted as a black box:
//
//   baseline[tier] = the INTERSECTION of applicableControlsForSystem() across
//                    every YAML-authored system whose classification derives
//                    to that tier.
//
// Intersection is what makes the list a baseline instead of a snapshot.
// Content-conditional controls fall out on their own: AAT controls apply to
// the AI platform but not to Workday, so they are not in the Restricted
// baseline — they stay with the applicability rules as a conditional overlay.
// The same happens to standards only one system certifies against (ISO 42001,
// GDPR): certification-driven scope remains per-system, not per-tier.
//
// Tiers with no authored reference system get no baseline. That is deliberate:
// a baseline is a policy statement, and this script refuses to invent policy
// from zero examples. The engine treats a missing tier as "no baseline
// contribution" and scope for such systems derives exactly as before.
//
// Run: node scripts/generate-control-baselines.mjs            (prints the YAML)
//      node scripts/generate-control-baselines.mjs --write    (writes src/graph/facts/control-baselines.yaml)
import { createServer } from "vite";
import { writeFileSync } from "node:fs";

const write = process.argv.includes("--write");
const outPath = "src/graph/facts/control-baselines.yaml";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

try {
  const { engine } = await server.ssrLoadModule("/src/engine/index.ts");
  const { CLASSIFICATION_TIERS } = await server.ssrLoadModule("/src/graph/nodes/taxonomy.ts");

  // YAML-authored systems only — a runtime-created system is one user's
  // sandbox, not a reference for company policy.
  const systems = engine.graph.systems.filter((s) => !s.id.startsWith("SYS-USR-"));

  const byTier = new Map();
  systems.forEach((s) => {
    const tier = engine.classification.systemClassification(s.id);
    if (!tier) return;
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier).push(s);
  });

  const lines = [];
  lines.push("# Per-tier control baselines — WHICH controls a system at a classification tier");
  lines.push("# carries, completing the control profile (control-profile.yaml), which says how");
  lines.push("# WELL they must be done. The 800-53 shape: categorize, select the published");
  lines.push("# baseline, tailor out with documented justification (control reviews).");
  lines.push("#");
  lines.push("# Derived by scripts/generate-control-baselines.mjs as the intersection of");
  lines.push("# applicable controls across every authored system at the tier — content-");
  lines.push("# conditional controls (AI, custom SDLC, single-system certifications) fall to");
  lines.push("# the applicability rules as overlays rather than being frozen into policy here.");
  lines.push("# Reviewing an edit to this file IS the policy act; the build validates every id");
  lines.push("# and that lower tiers stay subsets of higher ones.");
  lines.push("#");
  lines.push("# A tier with no authored reference system is deliberately absent: the engine");
  lines.push("# derives scope for such systems from rules and frameworks exactly as before.");
  lines.push("");

  const summary = [];
  CLASSIFICATION_TIERS.forEach((tier) => {
    const refs = byTier.get(tier) ?? [];
    if (refs.length === 0) {
      lines.push(`# ${tier}: no authored reference system — no baseline defined.`);
      summary.push(`${tier}: (none)`);
      return;
    }
    const sets = refs.map((s) => new Set(engine.applicability.applicableControlsForSystem(s.id).map((c) => c.id)));
    const union = new Set(sets.flatMap((set) => [...set]));
    const intersection = [...union].filter((id) => sets.every((set) => set.has(id))).sort();
    const overlayOnly = [...union].filter((id) => !sets.every((set) => set.has(id))).sort();

    lines.push(`# ${tier} — intersection of ${refs.map((s) => `${s.id} (${s.name})`).join(" ∩ ")}.`);
    if (overlayOnly.length > 0) {
      lines.push(`# Applicable somewhere at this tier but left to conditional overlays: ${overlayOnly.join(", ")}.`);
    }
    lines.push(`${tier}:`);
    intersection.forEach((id) => {
      const control = engine.graph.controlById[id];
      lines.push(`  - "${id}" # ${control?.name ?? ""}`);
    });
    lines.push("");
    summary.push(`${tier}: ${intersection.length} controls (${overlayOnly.length} left to overlays) from ${refs.length} reference system(s)`);
  });

  const yaml = lines.join("\n");
  if (write) {
    writeFileSync(outPath, yaml + "\n");
    console.log(`wrote ${outPath}`);
  } else {
    console.log(yaml);
  }
  console.log("\n" + summary.join("\n"));
} finally {
  await server.close();
}
