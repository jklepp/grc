// Merges runtime-created facts (from the Add System wizard) with the YAML
// baseline and builds a real engine over the result — the same assembleGraph
// / validateGraph / createEngine / validateDerivations pipeline every
// YAML-authored system goes through, never a second scoring path.
//
// The two-pass build below exists for one reason: classification is a derived
// value, and this app's hard rule is that a derived value is never hand-typed
// by a user. But validateDerivations checks a system's derived classification
// against a curated expectedClassification entry — so a system with none would
// always fail that check. Pass one builds an engine (with validateDerivations
// switched off) purely to read off what the classification WOULD derive to;
// that answer is written into expectedClassification as if it had always been
// there, and pass two builds the real, fully-checked engine over the corrected
// facts. The user is never asked what the classification is — only what the
// asset touches.
import { assembleGraph } from "../graph/assemble";
import { validateGraph } from "../graph/validate";
import { createEngine, type Engine } from "./create";
import { validateDerivations } from "./validateDerivations";
import type { GraphFacts } from "../graph/types";
import type { System } from "../graph/nodes/systems";
import type { Asset } from "../graph/nodes/assets";
import type { AssetDataType } from "../graph/edges/assetDataTypes";
import type { AssessmentScope } from "../graph/nodes/assessmentScope";
import type { SystemId } from "../graph/ids";
import type { ClassificationTier } from "../graph/nodes/taxonomy";

export interface RuntimeFacts {
  systems: System[];
  assets: Asset[];
  assetDataTypes: AssetDataType[];
  assessmentScopes: AssessmentScope[];
  expectedClassification: Record<SystemId, ClassificationTier>;
}

export function emptyRuntimeFacts(): RuntimeFacts {
  return { systems: [], assets: [], assetDataTypes: [], assessmentScopes: [], expectedClassification: {} };
}

// Appends the five fact arrays/maps a runtime system can touch. Every other
// fact domain — evidence, policies, findings, the other ~35 fact files — is
// untouched, because nothing about creating a new system authors any of those.
export function mergeFacts(base: GraphFacts, runtime: RuntimeFacts): GraphFacts {
  return {
    ...base,
    systems: [...base.systems, ...runtime.systems],
    assets: [...base.assets, ...runtime.assets],
    assetDataTypes: [...base.assetDataTypes, ...runtime.assetDataTypes],
    assessmentScopes: [...base.assessmentScopes, ...runtime.assessmentScopes],
    expectedClassification: { ...base.expectedClassification, ...runtime.expectedClassification },
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
  const correctedRuntime: RuntimeFacts = { ...runtime, expectedClassification: correctedExpectedClassification };

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
