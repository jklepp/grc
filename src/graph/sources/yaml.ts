// ACME's facts, read from YAML.
//
// A source adapter: it answers "what are the facts?" and nothing downstream of
// loadGraph() can tell which adapter produced a graph. It is currently the only
// one — the TypeScript source it was proved equivalent to (sources/acme.ts) and
// the parity check that proved it (scripts/check-source-parity.mjs) were both
// retired once this became authoritative. An API-backed adapter would sit
// beside this file and export the same GraphFacts shape.
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
// WHAT ISN'T HERE: the common-control catalogue. It is a vendor-derived catalogue
// shared by every dataset built on this engine, not something ACME authors, so
// it comes from the same module the TypeScript source reads it from rather than
// being copied into our YAML.
import { parse } from "yaml";
import { CONTROLS } from "../nodes/controls";
import { POLICIES } from "../../data/policies";
import { PROCEDURES } from "../../data/procedures";
import { SCHEDULED_ACTIVITIES } from "../../data/scheduledActivities";
import type { GraphFacts } from "../types";
import type { PolicyRecord, ProcedureRecord } from "../nodes/programArtifacts";
import type { ActivityFrequency, ScheduledActivityInstance, ScheduledActivityRecord } from "../nodes/scheduledActivities";
import type { EvidenceType } from "../nodes/taxonomy";

// Eager + raw so the YAML is inlined and parsed as this module evaluates, which
// keeps loadGraph() synchronous once the facts are in hand.
//
// The asynchrony is one level up instead: engine/index.ts reaches this module
// through a dynamic import, so the whole dataset lands in its own chunk and is
// fetched rather than shipped in the entry bundle. That is the seam an
// API-backed source would replace — awaiting a response instead of awaiting a
// chunk — and it is why nothing may import this module statically.
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
  evidenceArtifacts: read("evidence-artifacts"),
  evidenceReviews: read("evidence-reviews"),
  risks: read("risks"),
  orgs: read("orgs"),
  findings: read("findings"),
  actors: read("actors"),

  // Not YAML, and deliberately so. The policy library and SOP library carry
  // paragraphs of employee-facing prose that no scoring path reads; migrating
  // several thousand lines of it to reach two date fields and a control list
  // would be motion without benefit. What matters for the seam is that
  // GraphFacts is still the only contract — a future Postgres source supplies
  // these the same way, and nothing downstream of loadGraph can tell where any
  // of it came from.
  // Projected field-by-field rather than passed through. The authored records
  // carry things the graph has no business holding — prose, role tables, and on
  // SOP steps an `evidence.reconcile.check` CLOSURE the execution engine uses to
  // validate what an operator typed. A fact set has to be plain data: it gets
  // structuredClone'd by scripts/check-validator-fires.mjs to build deliberately
  // broken variants, and a function in it makes that impossible.
  policies: POLICIES.map(
    (p): PolicyRecord => ({
      id: p.id, code: p.code, title: p.title,
      controlIds: [...p.controlIds], domains: [...p.domains],
      created: p.created, lastReviewed: p.lastReviewed,
    })
  ),
  procedures: PROCEDURES.map(
    (p): ProcedureRecord => ({
      id: p.id, code: p.code, title: p.title, category: p.category,
      domains: [...p.domains], policyId: p.policyId, owner: p.owner,
      // Same cast rationale as the YAML above: src/data is untyped JS, so these
      // arrive as `string` and validateGraph is what establishes they are in
      // vocabulary. Narrow casts rather than a blanket one on the record, so a
      // field that stops existing is still a compile error.
      reviewCadence: p.reviewCadence, evidenceType: p.evidenceType as EvidenceType,
      controlIds: [...p.controlIds],
      steps: p.steps.map((s) => ({ title: s.title, controls: s.controls ? [...s.controls] : undefined })),
    })
  ),

  // Projected the same way and for the same reason: the authored records carry
  // page-facing prose, derived framework badges, and a status computed against a
  // module-level `new Date()`. Status in particular must NOT come across — the
  // engine re-derives it against ctx.now, so the same facts scored on a different
  // day give a different and correct answer instead of one baked in at build time.
  scheduledActivities: SCHEDULED_ACTIVITIES.map(
    (a): ScheduledActivityRecord => ({
      id: a.id, title: a.title, frequency: a.frequency as ActivityFrequency,
      controlIds: [...a.controls], procedureId: a.procedureId,
      instances: a.instances.map((i): ScheduledActivityInstance => {
        // Destructured rather than read by property so the projection names
        // exactly what crosses, and `status` — derived in src/data against a
        // module-level clock — provably does not.
        const { period, dueDate, completedAt, inProgress } = i as ScheduledActivityInstance;
        return { period, dueDate, completedAt, inProgress };
      }),
    })
  ),

  controlProfile: read("control-profile"),
  controlBaselines: read("control-baselines"),

  // Edges
  assetDataTypes: read("asset-data-types"),
  dataFlows: read("data-flows"),
  actorAccess: read("actor-access"),
  applicabilityRules: read("applicability-rules"),
  applicabilityExceptions: read("applicability-exceptions"),
  ownership: read("ownership"),
  ownerOverrides: read("owner-overrides"),
  implementationOverrides: read("implementation-overrides"),
  notImplemented: read("not-implemented"),
  implementationMechanisms: read("implementation-mechanisms"),
  operatingHistory: read("operating-history"),
  programApplicabilityRules: read("program-applicability"),
  programApplicabilityExceptions: read("program-applicability-exceptions"),
  riskAssets: read("risk-assets"),
  riskControls: read("risk-controls"),
  risksWithoutAssets: riskGaps.withoutAssets,
  risksWithoutControls: riskGaps.withoutControls,

  prismaOverrides: read("prisma-overrides"),
  controlReviews: read("control-reviews"),

  // Curated expectations
  expectedClassification: read("expected-classification"),
  boardMaterialRiskIds: read("board-material-risks"),
  assessmentScopes: read("assessment-scope"),
  providerCertifications: read("provider-certifications"),
  enterpriseAttestations: read("enterprise-attestations"),
  pendingApplicability: read("applicability-pending"),

  // System Register cockpit domains
  identityPopulations: read("identity-populations"),
  accessReviews: read("access-reviews"),
  agenticIdentities: read("agentic-identities"),
  exposurePostures: read("exposure-posture"),
  externalServices: read("external-services"),
  exposureExceptions: read("exposure-exceptions"),
  vulnSnapshots: read("vuln-snapshots"),
  securityTests: read("security-tests"),
  backupConfigs: read("backup-config"),
  drTests: read("dr-tests"),
  irPlanCurrency: read("ir-plan-currency"),
  tabletopExercises: read("tabletop-exercises"),
  productionIncidents: read("production-incidents"),
  vendors: read("vendors"),
  vendorAssurance: read("vendor-assurance"),
  systemVendors: read("system-vendors"),
  sdlcPostures: read("sdlc-posture"),
};
