// Composes one control implementation, and scores it.
//
// An implementation is assembled rather than stored, from four inputs that each
// already exist for their own reasons:
//
//   applicability  is this control required here at all
//   assessment     the asset's category-level baseline (the "assessed" floor)
//   overrides      a recorded maturity that differs from that baseline, with why
//   evidence       what a collection against THIS control on THIS asset showed
//
// Evidence is the only per-pair input, and that is the intended reading: what
// separates a strong implementation of a control from a weak one is what you
// can actually show about it. CLD-06 on the S3 bucket and CLD-06 on the RAG
// service start from similar baselines and end up far apart because one has a
// passing cross-tenant test and the other has a failing one.
//
// EVIDENCE CONFIDENCE
// -------------------
// The old evidenceConfidenceScore() averaged the EVIDENCE_CONFIDENCE value of
// six type strings. That treats a continuous telemetry feed that stopped
// reporting nine months ago as identical to one reading live, and a test
// covering 40% of a fleet as identical to one covering all of it. Here the base
// rate for the type is multiplied by the collection's coverage and by a
// freshness factor that decays past the record's own validity window. A stale
// record still counts for something — it was true once — but not for what it
// was worth on the day it was collected.
//
// Freshness is measured against ctx.now rather than a module-level clock read
// at import time. See engine/context.ts for why that mattered.
import type { Graph } from "../graph/types";
import {
  BASIS, ASSURANCE_CATEGORIES, MATURITY_STAGES,
  type AssuranceCategory, type MaturityStage, type EvidenceType,
} from "../graph/nodes/taxonomy";
import { POLICY_REVIEW_INTERVAL_DAYS, type PolicyRecord } from "../graph/nodes/programArtifacts";
import { RESPONSIBILITIES, type Responsibility } from "../graph/edges/controlImplementations";
import type { SystemScope } from "../graph/ids";
import type { ApplicabilityApi } from "./applicability";
import { blendAssurance, evidenceBaseConfidence, meetsEvidence, mean, display } from "./assurance";
import {
  VERIFYING_EVIDENCE_FLOOR, composeEvidenceConfidence, effectivenessFactor, governingRecord,
  type ComposedEvidenceConfidence, type EvidenceApi, type ScoredEvidence,
} from "./evidence";
import type { AssetId, ControlId, SystemId } from "../graph/ids";

// THE MATURITY CEILING
// ---------------------
// The ladder is a ladder: each rung is a precondition for the one above it, not
// an alternative to it. You cannot implement encryption at rest properly without
// a policy requiring it and a procedure telling somebody how — so a claim of
// "Managed" on a control with neither is not a measurement, it is an assertion
// with nothing under it.
//
// The library already said so. SOP-01's final step reads: "A Vanta automated
// test confirms encryption is actually active before the asset's Data Protection
// category is marked Managed. A control that's configured but unverified doesn't
// count." That rule was written down and never enforced — someone typed
// maturityStage: "Managed" into a category assessment and it scored 100.
//
// So the category assessment now supplies a CLAIM, and the artifacts supply a
// CEILING, and what scores is min(claim, ceiling). The gap between them is kept
// and reported rather than silently resolved, because "we believe this is
// Managed but can only support Procedure" is the single most useful sentence
// this model can produce about a control.
//
// The one case that isn't a cap is a control no policy cites at all. That's a
// hole in the policy library rather than a statement about how well anything is
// running, so engine/validateDerivations.ts fails the build on it instead.
//
// VERIFYING_EVIDENCE_FLOOR, and everything about scoring a single collection,
// now lives in engine/evidence.ts — the same question is asked by the
// system-level PRISMA assessment, and it should not have to import it from here.

export interface MaturitySupport {
  // null means nothing documented cites this control — not a low ceiling, an
  // absent foundation. Callers treat it as a build failure, not a score.
  ceiling: MaturityStage | null;
  policies: readonly PolicyRecord[];
  stalePolicies: readonly PolicyRecord[];
  procedureSteps: readonly { procedure: { code: string; title: string }; stepTitle: string }[];
  // Why the ceiling sits where it does, in the words a reviewer needs.
  limitedBy: string | null;
}

export const IMPLEMENTATION_STATUS_META = {
  effective: { label: "Effective", color: "green" },
  partial: { label: "Partial", color: "amber" },
  deficient: { label: "Deficient", color: "red" },
  unevidenced: { label: "Unevidenced", color: "muted" },
  "not-implemented": { label: "Not implemented", color: "red" },
  "not-applicable": { label: "Not applicable", color: "muted" },
};

export function createImplementation(
  graph: Graph,
  applicabilityApi: ApplicabilityApi,
  evidenceApi: EvidenceApi
) {
  const { ageInDays, freshnessFactor, scoreEvidence, evidenceFor, policyOverdue } = evidenceApi;

  // What the documented program can actually support for this control, before
  // anything about a particular asset is considered. Policy and procedure are
  // company-wide facts — there is one encryption policy, not twenty-six — so
  // this half of the ceiling is computed per control and shared.
  function maturitySupport(controlId: ControlId, records: ScoredEvidence[]): MaturitySupport {
    const policies = graph.policiesByControl[controlId] ?? [];
    const procedureSteps = graph.procedureStepsByControl[controlId] ?? [];
    const stalePolicies = policies.filter(policyOverdue);
    const base = { policies, stalePolicies, procedureSteps };

    if (policies.length === 0) {
      return { ...base, ceiling: null, limitedBy: `No policy in the library cites ${controlId}.` };
    }

    // Overdue everywhere it's cited. The policy still exists and was true once,
    // so it holds the bottom rung — the same reasoning that gives stale evidence
    // a floor rather than a zero — but it can't carry a claim above itself.
    if (stalePolicies.length === policies.length) {
      return {
        ...base,
        ceiling: "Policy",
        limitedBy: `Every policy citing ${controlId} is past its ${POLICY_REVIEW_INTERVAL_DAYS}-day review interval (${policies.map((p) => p.code).join(", ")}).`,
      };
    }

    if (procedureSteps.length === 0) {
      return {
        ...base,
        ceiling: "Policy",
        limitedBy: `${controlId} is required by policy but no SOP step tells anyone how to operate it.`,
      };
    }

    // A documented, procedurally-covered control with nothing collected against
    // it is exactly "Procedure" — written down, not shown.
    if (records.length === 0) {
      return { ...base, ceiling: "Procedure", limitedBy: `No evidence has been collected for ${controlId} here.` };
    }

    const verifying = records.some(
      (r) => !r.stale && r.result === "pass" && meetsEvidence(r.evidenceType, VERIFYING_EVIDENCE_FLOOR)
    );
    if (!verifying) {
      return {
        ...base,
        ceiling: "Implemented",
        limitedBy: `No current passing evidence at ${VERIFYING_EVIDENCE_FLOOR} grade or better — configured but unverified, which SOP-01 says doesn't count.`,
      };
    }

    return { ...base, ceiling: "Managed", limitedBy: null };
  }

  // min(claim, ceiling) over the ordered vocabulary. Index arithmetic rather
  // than a lookup table, so this can't drift from MATURITY_STAGES itself.
  function capMaturity(claimed: MaturityStage, ceiling: MaturityStage): MaturityStage {
    return MATURITY_STAGES[Math.min(MATURITY_STAGES.indexOf(claimed), MATURITY_STAGES.indexOf(ceiling))];
  }

  // The category baseline for program-scoped controls: the portfolio mean of
  // that category across every asset. Derived rather than a separate hand-set
  // figure, so a program control's floor moves with the estate it governs.
  const programBaseline = {} as Record<AssuranceCategory, { maturityStage: MaturityStage; effectivenessPct: number }>;
  ASSURANCE_CATEGORIES.forEach((category) => {
    const rows = graph.categoryAssessments.filter((a) => a.category === category);
    programBaseline[category] = {
      maturityStage: rows[0]?.maturityStage ?? "Procedure",
      effectivenessPct: mean(rows.map((r) => r.effectivenessPct)) ?? 0,
    };
  });

  // assetId of null means a program-scoped control.
  function buildImplementation(assetId: AssetId | null, controlId: ControlId) {
    const control = graph.keyControlById[controlId];
    const isProgram = assetId === null;
    const asset = isProgram ? null : graph.assetById[assetId];
    const systemId = asset?.systemId ?? "program";

    const applicability = isProgram
      ? {
          required: true,
          reasons: [{ rationale: "Governs the program as a whole rather than any one resource.", source: "Program scope" }],
          exception: null,
          notRequiredBecause: null,
        }
      : applicabilityApi.resolveApplicability(assetId, controlId);

    const baseline = isProgram
      ? programBaseline[control.category]
      : graph.assessmentByPair[`${assetId}::${control.category}`] ?? null;
    const override = isProgram ? null : graph.overrideByPair[`${assetId}::${controlId}`] ?? null;
    const ownerOverride = isProgram ? null : graph.ownerOverrides.find((o) => o.assetId === assetId && o.controlId === controlId) ?? null;
    const declaredMissing = isProgram ? null : graph.notImplementedByPair[`${assetId}::${controlId}`] ?? null;
    const records = evidenceFor(assetId, controlId).map(scoreEvidence);

    // A system's own owner for this category, falling back to the program-wide
    // default when the system doesn't name one.
    const ownerIdsFor = (scope: SystemScope, category: AssuranceCategory) =>
      graph.ownership[scope]?.[category] ?? graph.ownership.program[category];

    const ownerIds = ownerOverride?.ownerIds ?? ownerIdsFor(systemId, control.category);
    const owners = ownerIds.map((id) => graph.orgById[id]);

    // The per-implementation facts a person owns. Absent for most pairs, and
    // that's the honest default: internal responsibility with an unstated
    // mechanism beats 176 invented mechanism strings.
    const mechanismRecord = isProgram ? null : graph.mechanismByPair[`${assetId}::${controlId}`] ?? null;
    const responsibility: Responsibility = mechanismRecord?.responsibility ?? RESPONSIBILITIES.INTERNAL;

    const support = maturitySupport(controlId, records);

    const common = {
      // A stable identity, which is what lets evidence, findings, overrides and
      // owner assignments point at ONE record rather than at four parallel
      // tables keyed on a composite string.
      id: `IMP-${assetId ?? "PROGRAM"}-${controlId}`,
      assetId,
      controlId,
      control,
      systemId,
      category: control.category,
      scope: control.scope,
      owners,
      ownerNames: owners.map((o) => o.name).join(" / "),
      ownerOverride,
      // HOW the control is satisfied, and who runs it. A vendor-run control is
      // required and implemented — by someone else — rather than excused.
      mechanism: mechanismRecord?.mechanism ?? null,
      responsibility,
      provider: mechanismRecord?.provider ?? null,
      findingId: override?.findingId ?? null,
      applicability,
      evidence: records,
      baseline,
      override,
      // What policy and procedure can actually support here, kept on every
      // implementation so a capped score can always name what capped it.
      support,
    };

    // Fields only the fully-scored branch below computes for real. Included as
    // null/empty in the earlier branches too so every return of this function
    // has one consistent shape rather than a narrower one callers have to guard.
    const unscored = {
      result: null as string | null,
      claimedMaturity: null as MaturityStage | null,
      maturityCapped: false,
      maturityCappedBy: null as string | null,
      rawEffectivenessPct: null as number | null,
      governing: null as ScoredEvidence | null,
      exceptionRate: null as number | null,
      exceptionSummary: null as { exceptions?: number; population?: number; unit?: string; rate: number; source: string } | null,
      effectivenessFactor: null as number | null,
      rawEvidenceConfidence: null as number | null,
      evidenceAllocation: [] as ComposedEvidenceConfidence["allocation"],
      evidenceUncovered: null as number | null,
    };

    if (!applicability.required) {
      return {
        ...common, ...unscored,
        status: "not-applicable", basis: BASIS.UNASSESSED, score: null, rawScore: null,
        evidenceConfidence: null, effectivenessPct: null, maturityStage: null, note: null as string | null,
      };
    }

    if (declaredMissing) {
      return {
        ...common,
        ...unscored,
        status: "not-implemented",
        // Knowing a control is absent IS a measurement — it's the one case where
        // a zero is a finding rather than a blank.
        basis: BASIS.MEASURED,
        score: 0,
        rawScore: 0,
        evidenceConfidence: 0,
        effectivenessPct: 0,
        maturityStage: null,
        note: declaredMissing.reason,
      };
    }

    const baselineEntry = baseline!;

    // The claim, from the category assessment or an explicit override — then
    // the ceiling. A null ceiling means no policy cites this control at all,
    // which validateDerivations fails the build on; scoring it as Policy here
    // keeps the engine from throwing before the validator can say why.
    const claimedMaturity = override?.maturityStage ?? baselineEntry.maturityStage;
    const maturityStage = support.ceiling ? capMaturity(claimedMaturity, support.ceiling) : claimedMaturity;
    const maturityCapped = maturityStage !== claimedMaturity;

    // The worst verified condition governs, and it stays nameable: `governing`
    // is the specific collection this implementation's status and prevalence
    // come from, so a deficient control can always say which test made it so.
    const governing = governingRecord(records);
    const result = governing ? governing.result : null;
    const exceptionRate = governing ? governing.exceptionRate : null;

    const composed = composeEvidenceConfidence(records);
    const evidenceConfidence = composed ? composed.confidence : null;

    const factor = effectivenessFactor(result, exceptionRate);
    const effectivenessPct = result === null ? baselineEntry.effectivenessPct : baselineEntry.effectivenessPct * factor;

    const basis = records.length > 0 ? BASIS.MEASURED : BASIS.ASSESSED;

    // With no evidence, confidence falls back to the assessment's own declared
    // evidence type — the honest reading of "someone said so at this grade."
    const confidenceForScore =
      evidenceConfidence ?? evidenceBaseConfidence((baselineEntry as { evidenceType?: EvidenceType }).evidenceType);

    const raw = blendAssurance({ maturityStage, evidenceConfidence: confidenceForScore, effectivenessPct });

    return {
      ...common,
      status:
        result === null ? "unevidenced" : result === "pass" ? "effective" : result === "partial" ? "partial" : "deficient",
      basis,
      result,
      maturityStage,
      // The claim and the gap, kept alongside the capped value. "We believe this
      // is Managed but can only support Procedure" is the most useful sentence
      // this model produces about a control, and it only exists if both halves
      // survive the calculation.
      claimedMaturity,
      maturityCapped,
      maturityCappedBy: maturityCapped ? support.limitedBy : null,
      effectivenessPct: display(effectivenessPct),
      rawEffectivenessPct: effectivenessPct,
      // Where the status and the size of the hit came from, kept together so the
      // drawer and the trace can say "deficient because THIS test found N of M".
      governing,
      exceptionRate,
      exceptionSummary:
        governing && governing.exceptionRate != null
          ? {
              exceptions: governing.exceptions,
              population: governing.population,
              unit: governing.populationUnit,
              rate: governing.exceptionRate,
              source: governing.source,
            }
          : null,
      effectivenessFactor: factor,
      evidenceConfidence: display(confidenceForScore),
      rawEvidenceConfidence: confidenceForScore,
      evidenceAllocation: composed ? composed.allocation : [],
      evidenceUncovered: composed ? composed.uncovered : null,
      // `score` is for display; `rawScore` is what the category rollup consumes,
      // so a control's movement survives the trip upward instead of being rounded
      // away at the first hop.
      score: display(raw),
      rawScore: raw,
      note: override?.note ?? null,
    };
  }

  // Return types are inferred rather than annotated: annotating them with
  // Implementation would be circular, since Implementation is itself derived
  // from buildImplementation's inferred return.
  function implementationsForAsset(assetId: AssetId) {
    return applicabilityApi.requiredControlsForAsset(assetId).map((c) => buildImplementation(assetId, c.id));
  }

  function implementationsForAssetInCategory(assetId: AssetId, category: string) {
    return implementationsForAsset(assetId).filter((i) => i.category === category);
  }

  const programImplementations = graph.programScopedControls.map((c) => buildImplementation(null, c.id));

  function programImplementation(controlId: ControlId) {
    return programImplementations.find((i) => i.controlId === controlId) || null;
  }

  // ---- Program controls, per system ------------------------------------------
  // These score from the bottom like everything else: one implementation per
  // (system, control) a rule confirms, joining that system's pool and rolling up
  // the ordinary path. Before this they were composed, scored, and then consumed
  // by nothing that produced a posture number — the program layer reached the
  // hero figure not at all.
  //
  // ONE PER SYSTEM, NOT ONE PER ASSET. Asking nineteen assets whether ACME runs
  // an incident-response process is the duplication keyControls.ts calls
  // theatre. The baseline comes from the system's own assets' assessments in the
  // control's category, so a program control's floor moves with the estate it
  // governs inside that boundary rather than with the whole portfolio.
  function buildProgramImplementationForSystem(systemId: SystemId, controlId: ControlId) {
    const control = graph.keyControlById[controlId];
    const applicability = applicabilityApi.resolveProgramApplicability(systemId, controlId);
    const records = evidenceFor(null, controlId).map(scoreEvidence);
    const support = maturitySupport(controlId, records);

    const systemAssets = graph.assetsBySystem[systemId] ?? [];
    const rows = systemAssets
      .map((a) => graph.assessmentByPair[`${a.id}::${control.category}`])
      .filter(Boolean);
    const claimedMaturity = rows[0]?.maturityStage ?? "Procedure";
    const baselineEffectiveness = mean(rows.map((r) => r.effectivenessPct)) ?? 0;

    const ownerIds = graph.ownership[systemId]?.[control.category] ?? graph.ownership.program[control.category];
    const owners = ownerIds.map((id) => graph.orgById[id]);

    const maturityStage = support.ceiling ? capMaturity(claimedMaturity, support.ceiling) : claimedMaturity;
    const maturityCapped = maturityStage !== claimedMaturity;

    const governing = governingRecord(records);
    const result = governing ? governing.result : null;
    const composed = composeEvidenceConfidence(records);
    const factor = effectivenessFactor(result, governing ? governing.exceptionRate : null);
    const effectivenessPct = result === null ? baselineEffectiveness : baselineEffectiveness * factor;
    const confidenceForScore = composed ? composed.confidence : 0;
    const raw = blendAssurance({ maturityStage, evidenceConfidence: confidenceForScore, effectivenessPct });

    return {
      id: `IMP-${systemId}-${controlId}`,
      systemId,
      assetId: null as AssetId | null,
      controlId,
      control,
      category: control.category,
      scope: control.scope,
      owners,
      ownerNames: owners.map((o) => o.name).join(" / "),
      responsibility: RESPONSIBILITIES.INTERNAL as Responsibility,
      applicability,
      evidence: records,
      support,
      status:
        result === null ? "unevidenced" : result === "pass" ? "effective" : result === "partial" ? "partial" : "deficient",
      basis: records.length > 0 ? BASIS.MEASURED : BASIS.ASSESSED,
      result,
      maturityStage,
      claimedMaturity,
      maturityCapped,
      maturityCappedBy: maturityCapped ? support.limitedBy : null,
      governing,
      effectivenessPct: display(effectivenessPct),
      rawEffectivenessPct: effectivenessPct,
      evidenceConfidence: display(confidenceForScore),
      score: display(raw),
      rawScore: raw,
    };
  }

  // Built once. Every system's confirmed program controls, keyed for the rollup.
  const programImplementationsBySystem: Record<string, ReturnType<typeof buildProgramImplementationForSystem>[]> = {};
  graph.systems.forEach((s) => {
    programImplementationsBySystem[s.id] = applicabilityApi
      .programControlsForSystem(s.id)
      .map((c) => buildProgramImplementationForSystem(s.id, c.id));
  });

  return {
    ageInDays,
    freshnessFactor,
    scoreEvidence,
    evidenceFor,
    maturitySupport,
    buildImplementation,
    implementationsForAsset,
    implementationsForAssetInCategory,
    PROGRAM_IMPLEMENTATIONS: programImplementations,
    programImplementation,
    buildProgramImplementationForSystem,
    programImplementationsForSystem: (systemId: SystemId) => programImplementationsBySystem[systemId] ?? [],
  };
}

export type ImplementationApi = ReturnType<typeof createImplementation>;

// The shape buildImplementation returns. Declared via the factory's own return
// type so it stays in lockstep with the function rather than being restated.
export type Implementation = ReturnType<ImplementationApi["buildImplementation"]>;
