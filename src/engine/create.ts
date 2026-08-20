// Builds one engine over one graph.
//
// The wiring order below is the dependency order, and it is the whole reason
// this file exists rather than each module reaching for the others directly:
//
//   classification   what tier does this asset's data earn
//   applicability    given that tier, which controls are required
//   findings         open findings, aged against ctx.now
//   implementation   compose + score one control on one asset
//   rollups          category -> asset -> system -> enterprise
//   risk             what holds a scenario down, and how well
//   compliance       the same implementations, read per framework clause
//   profile          how an asset measures against its tier's required bar
//   selectors        the page-facing surface over all of the above
//
// Two things worth noticing about that list. Nothing later is consulted by
// anything earlier, so there are no cycles to break — the one that used to
// exist (profile <-> rollups, over category weights) went away when weights
// moved to the graph, where a fact belongs.
//
// And every one of these takes its graph as an argument, which is what makes a
// second engine possible: createEngine(syntheticGraph) for a property test,
// createEngine(lastQuartersGraph) to diff posture over time, or one per tenant
// in a server process. None of that was expressible when each module read a
// module-scope singleton.
import type { Graph } from "../graph/types";
import { type EngineContext, defaultContext } from "./context";
import { createClassification } from "./classification";
import { createApplicability } from "./applicability";
import { createFindings } from "./findings";
import { createEvidence } from "./evidence";
import { createAssessment } from "./assessment";
import { createRollups } from "./rollups";
import { createRisk } from "./risk";
import { createCompliance } from "./compliance";
import { createProfile } from "./profile";
import { createSelectors } from "./selectors";
import { validateDerivations } from "./validateDerivations";
import { createIdentity } from "./identity";
import { createExposure } from "./exposure";
import { createVulnerabilities } from "./vulnerabilities";
import { createSecurityTesting } from "./securityTesting";
import { createResilience } from "./resilience";
import { createIncidentResponse } from "./incidentResponse";
import { createVendors } from "./vendors";
import { createSdlc } from "./sdlc";
import { createCockpit } from "./cockpit";
import { createExceptions } from "./exceptions";
import { createReview } from "./review";

export interface EngineOptions {
  ctx?: EngineContext;
  // Derivation integrity runs by default. A test building a deliberately broken
  // graph to assert the checks fire needs to construct the engine first, so it
  // can turn this off and call validateDerivations() itself.
  validate?: boolean;
}

export function createEngine(graph: Graph, options: EngineOptions = {}) {
  const ctx = options.ctx ?? defaultContext();

  const classification = createClassification(graph);
  const applicability = createApplicability(graph, classification);
  const findings = createFindings(graph, ctx);
  const evidence = createEvidence(graph, ctx);
  // The PRISMA layer. Built here so validateDerivations can prove it out, but
  // not yet exported from engine/index.ts and not yet read by any rollup —
  // flipping the consumers is a separate change from proving the derivation.
  const assessment = createAssessment(graph, applicability, evidence, findings, ctx);
  const rollups = createRollups(graph, classification, applicability, assessment, findings);
  const risk = createRisk(graph, rollups, assessment);
  const compliance = createCompliance(graph, assessment, applicability);
  const profile = createProfile(graph, rollups);
  const selectors = createSelectors(
    graph, classification, applicability, assessment, evidence, rollups, risk, compliance
  );

  // System Register cockpit domains. Independent of each other except for
  // findings (the shared POA&M mechanism) and cockpit, which composes them.
  const identity = createIdentity(graph, ctx);
  const exposure = createExposure(graph);
  const exceptions = createExceptions(graph, ctx);
  const vulnerabilities = createVulnerabilities(graph);
  const securityTesting = createSecurityTesting(graph, ctx, findings);
  const resilience = createResilience(graph, ctx);
  const incidentResponse = createIncidentResponse(graph, ctx, findings);
  const vendors = createVendors(graph, ctx);
  const sdlc = createSdlc(graph);
  const cockpit = createCockpit(
    graph, rollups, profile, risk, findings,
    identity, exposure, securityTesting, resilience, incidentResponse, vendors
  );
  const review = createReview(graph, applicability, assessment, compliance, findings);

  const engine = {
    graph, ctx,
    classification, applicability, findings, evidence, assessment,
    rollups, risk, compliance, profile, selectors,
    identity, exposure, exceptions, vulnerabilities, securityTesting, resilience,
    incidentResponse, vendors, sdlc, cockpit, review,
  };

  // Structural integrity was already proved by loadGraph. This is the other
  // half — the checks that need a derived value to make, and so cannot run
  // until an engine exists.
  if (options.validate !== false) validateDerivations(engine);

  return engine;
}

export type Engine = ReturnType<typeof createEngine>;
