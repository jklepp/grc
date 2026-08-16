// One-shot migration: reads the facts out of the TypeScript modules and writes
// them as YAML.
//
// Generated rather than hand-written on purpose. There are ~450 authored
// records across assets, evidence, category assessments and the edge tables,
// and transcribing them by hand is exactly the kind of work that introduces a
// silent single-character error into a dataset whose whole selling point is
// that it doesn't contain silent errors. Emitting them mechanically and then
// proving the two sources assemble to identical Graphs (see
// check-source-parity.mjs) is a stronger guarantee than careful typing.
//
// WHAT IS NOT EXPORTED: the 518-control SCF catalogue. That is a vendor
// catalogue, not ACME's authored facts — every dataset built on this engine
// shares the same one, and re-serializing someone else's reference data into
// our repo would be copying, not modelling. The YAML source imports it from
// the same JSON the TypeScript source does.
import { createServer } from "vite";
import { stringify } from "yaml";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "src", "graph", "facts");

// Header prose per file. These carry the "why" that would otherwise be lost
// moving from a commented TypeScript module to a data file — and unlike a
// comment attached to one record, a file-level note survives any tool that
// rewrites the rows beneath it.
const HEADERS = {
  "systems.yaml": "Trust boundaries. hostingType drives which control domains are inherited from the provider under the shared-responsibility split.",
  "assets.yaml": "The resources inside each boundary. `kind` is load-bearing: it is what applicability rules match on, so an unknown kind would silently exempt an asset from every control.",
  "data-types.yaml": "What the business actually holds. `sensitivity` is the input to every classification rollup — an asset is as sensitive as the most sensitive data it touches.",
  "key-controls.yaml": "The controls tracked at implementation granularity, as opposed to the ones covered only by a category-level assessment. Selected as the material controls for their category, which is the argument for giving them parity with everything they don't cover. Note that every Governance key control is program-scoped, and that is the honest answer rather than an omission: running a risk assessment or governing the AI lifecycle is something ACME does once, not something each S3 bucket does separately. The consequence is real and worth stating — no asset's Governance category is ever control-backed, so every asset carries an 'assessed' basis there, and Model Health surfaces that rather than hiding it.",
  "evidence.yaml": "Observations. Each record is one collection event: what it looked at, when, how much of the population it covered, and what it found. This is the highest-volume table and the one a connector will eventually write.",
  "risks.yaml": "The risk register. Inherent and residual ratings are authored judgments; everything downstream of them is derived.",
  "orgs.yaml": "Teams, business units and people that own things.",
  "findings.yaml": "Open issues against a specific control on a specific asset.",
  "actors.yaml": "Humans and machines that reach into the estate. Modelling agents as actors with access edges — rather than as a questionnaire — is what makes 'what can this agent actually reach' answerable.",
  "control-profile.yaml": "Two independent levers, deliberately kept apart. The tier baseline (and its high-sensitivity bump) decides what bar a category must CLEAR at a given tier; the weights decide how much clearing it COUNTS FOR. Collapsing them into one number is what makes a profile impossible to reason about. The baseline ladder is one full 'how convincingly can we prove this' step per tier: attest it in a doc, show it, have it examined, prove it by machine. highSensitivityCategories (Data Protection, Identity & Access, Detection) carry the most direct exposure when a breach involves sensitive data, so they are held one notch stricter once data actually becomes sensitive. On weights: at the Public tier nothing is secret, so weighting confidentiality controls heavily would be measuring the wrong thing — what can still go wrong to public data is that it gets altered or goes down, which is why Resilience and Configuration carry it there.",
  "asset-data-types.yaml": "Which assets touch which data, and in what role. `accesses` counts: a service account holds no data at all, but compromising it reaches all of it.",
  "data-flows.yaml": "Directed edges between assets. `kind` separates the request path (data) from the control plane, which is what lets the Data Map lay itself out from the flows rather than from a parallel description of them.",
  "actor-access.yaml": "Which actors reach which assets, and which way the call goes. An inbound actor calls into the system; an outbound one is our asset calling out to a third party.",
  "applicability-rules.yaml": "Declarative conditions under which a key control is required. A rule matches when EVERY condition it names holds; several rules for one control are alternatives. An unnamed condition is not a wildcard failure — it simply isn't part of that rule's test.",
  "applicability-exceptions.yaml": "Asset/control pairs a rule would have required, excused with a stated reason. An exception without a reason is indistinguishable from nobody having looked, so the reason is required.",
  "category-assessments.yaml": "The assessed baseline per asset per category — what every in-scope control that is NOT individually tracked falls back to. Every asset needs all six, or its rollup would have a hole that reads as a zero.",
  "ownership.yaml": "Who owns each assurance category, per system, with `program` as the enterprise-wide default a system falls back to.",
  "owner-overrides.yaml": "Where one asset/control pair is owned by someone other than the system+category default in ownership.yaml. That default exists because ownership genuinely tracks team and platform rather than individual resource — but not always: within a single system and category, one asset can be operated by a different team than the rest. The KMS key's administration is PIM-gated and run directly by Cloud Security even though Data Protection on SYS-003 otherwise defaults to Data Platform + IT Security. That is a real split in who-runs-this, not a split in maturity or evidence, which is why it lives here rather than being forced into an implementation override. Requires a note saying why.",
  "implementation-overrides.yaml": "A recorded maturity that differs from the asset's category baseline, with the reasoning. Requires a note.",
  "not-implemented.yaml": "Controls declared absent. Knowing a control is absent IS a measurement — it is the one case where a zero is a finding rather than a blank.",
  "risk-assets.yaml": "Which assets carry which risk scenario. A `primary` contributor carries it; a `contributing` one participates.",
  "risk-controls.yaml": "Which controls hold which risk down. This is the chain that makes 'why did this move' answerable: risk -> control -> implementation -> evidence.",
  "risk-gaps.yaml": "Why a risk names no contributing asset or no holding control. A stated reason rather than an empty list, so 'nothing carries this yet' reads as a deliberate position instead of an edge someone forgot to author. Validated both ways: a risk with no edges needs an entry here, and an entry here for a risk that HAS edges is stale documentation.",
  "expected-classification.yaml": "The top-down human answer that the bottom-up classification rollup has to reproduce. If a data edge changes such that a system's tier would move, that is either a real finding or a data-entry mistake, and both should stop the build rather than silently reclassify a system.",
  "board-material-risks.yaml": "The risks the board sees. Validated to still clear isMaterial() — residual Severe AND above the org's own appetite — so this list cannot quietly drift from the ratings it claims to summarize.",
};

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

try {
  const { ACME_FACTS } = await server.ssrLoadModule("/src/graph/sources/acme.ts");
  mkdirSync(OUT_DIR, { recursive: true });

  // stringify options tuned for review, not for machines: generous line width so
  // a rationale sentence isn't folded across four lines, and block strings kept
  // literal so prose stays readable in a diff.
  const opts = { lineWidth: 100, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" };

  const write = (file, data) => {
    const header = HEADERS[file];
    const prose = header
      ? header.replace(/(.{1,86})(\s|$)/g, "# $1\n").trimEnd() + "\n#\n# Generated by scripts/export-facts-to-yaml.mjs. Edit this file, not a TypeScript module.\n\n"
      : "";
    writeFileSync(join(OUT_DIR, file), prose + stringify(data, opts));
    const count = Array.isArray(data) ? data.length : Object.keys(data).length;
    console.log(`  ${String(count).padStart(4)}  ${file}`);
  };

  const f = ACME_FACTS;

  console.log("\nNodes");
  write("systems.yaml", f.systems);
  write("assets.yaml", f.assets);
  write("data-types.yaml", f.dataTypes);
  write("key-controls.yaml", f.keyControls);
  write("evidence.yaml", f.evidence);
  write("risks.yaml", f.risks);
  write("orgs.yaml", f.orgs);
  write("findings.yaml", f.findings);
  write("actors.yaml", f.actors);

  console.log("\nProfile + curated expectations");
  write("control-profile.yaml", f.controlProfile);
  write("expected-classification.yaml", f.expectedClassification);
  write("board-material-risks.yaml", f.boardMaterialRiskIds);

  console.log("\nEdges");
  write("asset-data-types.yaml", f.assetDataTypes);
  write("data-flows.yaml", f.dataFlows);
  write("actor-access.yaml", f.actorAccess);
  write("applicability-rules.yaml", f.applicabilityRules);
  write("applicability-exceptions.yaml", f.applicabilityExceptions);
  write("category-assessments.yaml", f.categoryAssessments);
  write("ownership.yaml", f.ownership);
  write("owner-overrides.yaml", f.ownerOverrides);
  write("implementation-overrides.yaml", f.implementationOverrides);
  write("not-implemented.yaml", f.notImplemented);
  write("risk-assets.yaml", f.riskAssets);
  write("risk-controls.yaml", f.riskControls);
  write("risk-gaps.yaml", { withoutAssets: f.risksWithoutAssets, withoutControls: f.risksWithoutControls });

  console.log(`\nwrote ${Object.keys(HEADERS).length} files to src/graph/facts/\n`);
} finally {
  await server.close();
}
