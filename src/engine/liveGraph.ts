// Merges runtime-created facts (from the Add System wizard) with the YAML
// baseline and builds a real engine over the result — the same assembleGraph
// / validateGraph / createEngine / validateDerivations pipeline every
// YAML-authored system goes through, never a second scoring path.
//
// The two-pass build below exists for two reasons, both the same shape:
// something is true about a new system before anyone declares it, and this
// app's hard rule is that a derived or enterprise-wide fact is never
// hand-typed by a user. Pass one builds an engine (with validateDerivations
// switched off) purely to read off what those facts WOULD be; the answers are
// written into the candidate facts as if they had always been there, and pass
// two builds the real, fully-checked engine over the corrected result.
//
//   classification         the user is never asked what it is, only what the
//                          asset touches — expectedClassification is filled
//                          in from what pass one derives.
//   enterprise-wide scope  four of the seven program-scoped key controls
//                          (see program-applicability.yaml) apply to every
//                          system and already carry enterprise-wide evidence
//                          (assetIds: []) that "supports" any system they
//                          become applicable to — the same fact YAML-authored
//                          systems already declare in their own scope.
//                          A brand-new system's scope starts empty, so
//                          without this correction it would fail
//                          validateDerivations's "supported, undeclared"
//                          check the instant it became applicable to one of
//                          them — not a data problem the user caused, an
//                          enterprise fact nobody told the new system about
//                          yet.
import { assembleGraph } from "../graph/assemble";
import { validateGraph } from "../graph/validate";
import { createEngine, type Engine } from "./create";
import { validateDerivations } from "./validateDerivations";
import type { GraphFacts } from "../graph/types";
import type { System } from "../graph/nodes/systems";
import type { Asset } from "../graph/nodes/assets";
import type { AssetDataType } from "../graph/edges/assetDataTypes";
import type { AssessmentScope } from "../graph/nodes/assessmentScope";
import type { ImplementationMechanism, NotImplemented } from "../graph/edges/controlImplementations";
import type { RawEvidence } from "../graph/nodes/evidence";
import type { PrismaLevelOverride } from "../graph/edges/prismaOverrides";
import type { SystemId } from "../graph/ids";
import type { ClassificationTier } from "../graph/nodes/taxonomy";

export interface RuntimeFacts {
  systems: System[];
  assets: Asset[];
  assetDataTypes: AssetDataType[];
  assessmentScopes: AssessmentScope[];
  expectedClassification: Record<SystemId, ClassificationTier>;
  // What a runtime system's controls are actually evaluated against — absent
  // until someone calls the evaluateControl helpers in runtimeMutations.ts,
  // same as their YAML-authored counterparts being authored sparsely.
  implementationMechanisms: ImplementationMechanism[];
  evidence: RawEvidence[];
  notImplemented: NotImplemented[];
  prismaOverrides: PrismaLevelOverride[];
}

export function emptyRuntimeFacts(): RuntimeFacts {
  return {
    systems: [], assets: [], assetDataTypes: [], assessmentScopes: [], expectedClassification: {},
    implementationMechanisms: [], evidence: [], notImplemented: [], prismaOverrides: [],
  };
}

// Appends the eight fact arrays/maps a runtime system can touch. Every other
// fact domain — policies, findings, the other ~35 fact files — is untouched,
// because nothing about creating or evaluating a runtime system authors any
// of those.
export function mergeFacts(base: GraphFacts, runtime: RuntimeFacts): GraphFacts {
  return {
    ...base,
    systems: [...base.systems, ...runtime.systems],
    assets: [...base.assets, ...runtime.assets],
    assetDataTypes: [...base.assetDataTypes, ...runtime.assetDataTypes],
    assessmentScopes: [...base.assessmentScopes, ...runtime.assessmentScopes],
    expectedClassification: { ...base.expectedClassification, ...runtime.expectedClassification },
    implementationMechanisms: [...base.implementationMechanisms, ...runtime.implementationMechanisms],
    evidence: [...base.evidence, ...runtime.evidence],
    notImplemented: [...base.notImplemented, ...runtime.notImplemented],
    prismaOverrides: [...base.prismaOverrides, ...runtime.prismaOverrides],
  };
}

export interface BuildLiveEngineResult {
  engine: Engine | null;
  problems: string[];
}

// The one function used for both the wizard's pre-submit dry run and the real
// save — see the module comment for why this is a two-pass build.
export function buildLiveEngine(baseFacts: GraphFacts, runtime: RuntimeFacts): BuildLiveEngineResult {
  const firstPassFacts = mergeFacts(baseFacts, runtime);
  let graph;
  try {
    graph = assembleGraph(firstPassFacts);
  } catch (err) {
    return { engine: null, problems: [err instanceof Error ? err.message : String(err)] };
  }
  const structuralProblems = validateGraph(graph, { throwOnFailure: false });
  if (structuralProblems.length > 0) return { engine: null, problems: structuralProblems };

  const trialEngine = createEngine(graph, { validate: false });

  const correctedExpectedClassification = { ...runtime.expectedClassification };
  runtime.systems.forEach((s) => {
    if (Object.hasOwn(correctedExpectedClassification, s.id)) return;
    const derived = trialEngine.classification.systemClassification(s.id);
    if (derived) correctedExpectedClassification[s.id] = derived as ClassificationTier;
  });

  // Same predicate validateDerivations's "supported, undeclared" check uses
  // (see validateDerivations.ts's assessment-scope section) — evidence with
  // no assetIds is enterprise-wide by construction (validate.ts requires a
  // program-scoped control's evidence to name no assets), so it supports
  // whichever systems the control is applicable to, not just the ones that
  // happened to exist when it was recorded.
  const enterpriseSupportedControlIds = new Set(
    graph.evidence.filter((e) => e.assetIds.length === 0).map((e) => e.controlId)
  );
  const correctedAssessmentScopes = runtime.assessmentScopes.map((scope) => {
    const applicableIds = new Set(
      trialEngine.applicability.applicableControlsForSystem(scope.systemId).map((c) => c.id)
    );
    const additions = [...enterpriseSupportedControlIds].filter(
      (id) => applicableIds.has(id) && !scope.controlIds.includes(id)
    );
    return additions.length > 0 ? { ...scope, controlIds: [...scope.controlIds, ...additions] } : scope;
  });

  const correctedRuntime: RuntimeFacts = {
    ...runtime,
    expectedClassification: correctedExpectedClassification,
    assessmentScopes: correctedAssessmentScopes,
  };

  const finalFacts = mergeFacts(baseFacts, correctedRuntime);
  let finalGraph;
  try {
    finalGraph = assembleGraph(finalFacts);
  } catch (err) {
    return { engine: null, problems: [err instanceof Error ? err.message : String(err)] };
  }
  const finalStructuralProblems = validateGraph(finalGraph, { throwOnFailure: false });
  if (finalStructuralProblems.length > 0) return { engine: null, problems: finalStructuralProblems };

  const engine = createEngine(finalGraph, { validate: false });
  const derivationProblems = validateDerivations(engine, { throwOnFailure: false });
  if (derivationProblems.length > 0) return { engine: null, problems: derivationProblems };

  return { engine, problems: [] };
}
