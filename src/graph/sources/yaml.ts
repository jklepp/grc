// ACME's facts, read from YAML.
//
// The second source adapter, and the one that proves the seam is real. It
// answers exactly the same question sources/acme.ts does — "what are the
// facts?" — in exactly the same shape, and nothing downstream of loadGraph()
// can tell which of the two produced a graph. scripts/check-source-parity.mjs
// asserts that equivalence rather than assuming it.
//
// WHY THE CAST IS SAFE. Parsed YAML is `unknown`: a data file can say anything,
// and TypeScript has no way to know it didn't. Casting here would be reckless
// on its own — but every fact this returns goes through validateGraph(), which
// checks referential integrity and vocabulary conformance on the assembled
// graph and throws on the first bad one. So the type assertion is not a promise
// that the YAML is correct; it is a statement that the runtime check
// immediately downstream is what establishes correctness. That check is the
// same one the TypeScript source is held to, which is the entire point of
// having ported it in the first place.
//
// WHAT ISN'T HERE: the 518-control SCF catalogue. It is a vendor catalogue
// shared by every dataset built on this engine, not something ACME authors, so
// it comes from the same module the TypeScript source reads it from rather than
// being copied into our YAML.
import { parse } from "yaml";
import { CONTROLS } from "../nodes/controls";
import type { GraphFacts } from "../types";

// Eager + raw so the YAML is inlined at build time. The alternative — fetching
// and parsing at runtime — would make loadGraph async, and an async graph would
// force every page to handle a loading state for data that is, in this
// deployment, a build-time constant.
const files = import.meta.glob("../facts/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function read<T>(name: string): T {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}.yaml`));
  if (!key) {
    throw new Error(
      `yaml source: no facts/${name}.yaml — found ${Object.keys(files).length} fact files: ${Object.keys(files)
        .map((k) => k.split("/").pop())
        .join(", ")}`
    );
  }
  const parsed = parse(files[key]);
  if (parsed === null || parsed === undefined) {
    throw new Error(`yaml source: facts/${name}.yaml parsed to nothing — an empty fact file is almost certainly a mistake`);
  }
  return parsed as T;
}

const riskGaps = read<{
  withoutAssets: Record<string, string>;
  withoutControls: Record<string, string>;
}>("risk-gaps");

export const YAML_FACTS: GraphFacts = {
  // Nodes
  systems: read("systems"),
  assets: read("assets"),
  dataTypes: read("data-types"),
  controls: CONTROLS,
  keyControls: read("key-controls"),
  evidence: read("evidence"),
  risks: read("risks"),
  orgs: read("orgs"),
  findings: read("findings"),
  actors: read("actors"),
  controlProfile: read("control-profile"),

  // Edges
  assetDataTypes: read("asset-data-types"),
  dataFlows: read("data-flows"),
  actorAccess: read("actor-access"),
  applicabilityRules: read("applicability-rules"),
  applicabilityExceptions: read("applicability-exceptions"),
  categoryAssessments: read("category-assessments"),
  ownership: read("ownership"),
  ownerOverrides: read("owner-overrides"),
  implementationOverrides: read("implementation-overrides"),
  notImplemented: read("not-implemented"),
  riskAssets: read("risk-assets"),
  riskControls: read("risk-controls"),
  risksWithoutAssets: riskGaps.withoutAssets,
  risksWithoutControls: riskGaps.withoutControls,

  // Curated expectations
  expectedClassification: read("expected-classification"),
  boardMaterialRiskIds: read("board-material-risks"),
};
