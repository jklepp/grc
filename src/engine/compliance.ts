// Framework posture, derived from implementations rather than asserted.
//
// Two things this replaces, both of which produced numbers with nothing under
// them:
//
//   controlBreakdown()  split a system's required-control count into Inherited /
//                       Satisfied / Open Gaps / Not Implemented by applying the
//                       compliant/partial/gap ratio of six tracked controls to
//                       the whole 323-control total. So a system's compliance
//                       posture was six data points wearing a much larger
//                       number's clothes.
//
//   getSystemControlMatrix()  needed a status for every control and had one for
//                       six of them, so it ordered the rest by hashStr(systemId
//                       + controlId) and dealt them into buckets until the
//                       totals matched. It was deterministic and clearly
//                       labelled, but the status on any given row was invented.
//
// Here every control resolves to one of these states, each meaning something
// specific:
//
//   inherited  the provider's certification covers this domain under the
//              shared-responsibility split (graph/nodes/systems.ts)
//   satisfied  assessed, and every sampled instance holds it
//   partial    assessed, and some do
//   deficient  assessed, and most do not
//   not-implemented  assessed, and it is absent
//   unassessed applicable, and outside the declared assessment scope
//
// The matrix no longer stays fully populated with scores, and that is the
// change. It used to fall back to "assessed at category level" for every
// control nobody tracked, which kept every row carrying a number — but the
// number came from a category judgment typed once per asset, not from anything
// about the control. Now a control nobody assessed says so, and the coverage
// figure beside the score says how many of those there are.
import type { Graph } from "../graph/types";
import type { Control } from "../graph/nodes/controls";
import { BASIS } from "../graph/nodes/taxonomy";
import type { AssessmentApi, ControlAssessment } from "./assessment";
import type { ApplicabilityApi } from "./applicability";
import { mean, assuranceBand, display } from "./assurance";
import { inheritsDomain } from "../graph/nodes/systems";
import { RESPONSIBILITIES, SHARED_RESPONSIBILITY_DOMAINS, type Responsibility } from "../graph/edges/controlImplementations";
import type { SystemId, ControlId } from "../graph/ids";

export const COVERAGE_STATES = ["measured", "inherited", "assessed", "unassessed"];

export const COVERAGE_STATUS_META = {
  satisfied: { label: "Satisfied", color: "green", basis: BASIS.MEASURED },
  partial: { label: "Partial", color: "amber", basis: BASIS.MEASURED },
  deficient: { label: "Deficient", color: "red", basis: BASIS.MEASURED },
  "not-implemented": { label: "Not implemented", color: "red", basis: BASIS.MEASURED },
  inherited: { label: "Inherited", color: "accent", basis: BASIS.INHERITED },
  // "Assessed at category level" is gone with the category assessments it named.
  // A control outside the declared scope is unassessed, and saying so is the
  // point — the old label let an unexamined control read as an examined one.
  unassessed: { label: "Not in assessment scope", color: "muted", basis: BASIS.UNASSESSED },
};

// Worst status first, for the pages that rank rows by how bad they are. A
// control that holds on five assets and fails on a sixth is not "mostly
// satisfied" — the sixth is the finding.
//
// aggregateImplementationStatus() used to live here and derive a status by
// walking a control's per-asset implementations. It is gone: the status is now
// read off the assessment's Implemented level, which is one named rating rather
// than a second aggregation that could disagree with the score beside it.
export const STATUS_RANK: Record<string, number> = {
  "not-implemented": 0, deficient: 1, partial: 2, unassessed: 3, inherited: 4, satisfied: 5,
};

export function createCompliance(
  graph: Graph,
  assessment: AssessmentApi,
  applicability: ApplicabilityApi
) {
  // Moved to engine/applicability.ts — "which controls apply" is that module's
  // question. Re-exported here because the framework pages ask it by standard.
  const controlsForStandards = applicability.controlsForStandards;

  function controlsSatisfyingClause(standard: string, clause: string): Control[] {
    return (graph.controlsByClause[`${standard}::${clause}`] ?? []) as Control[];
  }

  function clausesForFramework(standard: string): string[] {
    return [
      ...new Set(
        graph.inScopeControls.flatMap((c) =>
          c.frameworks.filter((f) => f.standard === standard).flatMap((f) => f.clauses)
        )
      ),
    ].sort();
  }

  const isKeyControl = (controlId: ControlId) => Object.hasOwn(graph.keyControlById, controlId);

  function assetsForSystem(systemId: SystemId) {
    return graph.assetsBySystem[systemId] ?? [];
  }

  // Where one assessment lands on the coverage vocabulary.
  //
  // Driven by the Implemented level alone, because that is the level that says
  // whether the control is actually in place — the other four describe how well
  // it is documented, measured and managed, which is the score's job to weigh,
  // not this status's. Deriving it from one named rating also means a row's
  // status and its score can never tell different stories.
  //
  // "assessed" is gone from the produced set. It used to mean "not tracked
  // individually, but its category was judged," and that fallback died with the
  // category assessments. A control nobody assessed is now unassessed, which is
  // the same fact stated honestly.
  function coverageStatus(a: ControlAssessment): string {
    if (!a.assessed) return "unassessed";
    if (a.inherited) return "inherited";
    const implemented = a.levels.Implemented.rating;
    if (implemented === 100) return "satisfied";
    if (implemented >= 50) return "partial";
    if (implemented >= 25) return "deficient";
    return "not-implemented";
  }

  // One row of a system's control matrix — a projection of the assessment, not
  // a second derivation of it.
  function controlCoverageForSystem(systemId: SystemId, controlId: ControlId) {
    const control = graph.controlById[controlId];
    const a = assessment.assessmentFor(systemId, controlId);

    if (a === null) {
      return {
        controlId, control, systemId, status: "unassessed", basis: BASIS.UNASSESSED,
        score: null as number | null, assessment: null as ControlAssessment | null,
        instances: [] as ControlAssessment["instances"],
        explanation: `${controlId} does not apply to this system.`,
        keyControl: graph.keyControlById[controlId],
      };
    }

    return {
      controlId, control, systemId,
      status: coverageStatus(a),
      basis: a.basis,
      score: a.score,
      assessment: a,
      instances: a.instances,
      explanation: a.assessed
        ? `${a.levels.Implemented.rationale}`
        : `Applicable to this system and outside the declared assessment scope — reported as unassessed rather than scored.`,
      keyControl: graph.keyControlById[controlId],
    };
  }

  // The full matrix for one system — every control that applies to it, sorted
  // by domain then id, the same ordering the SSP page used.
  //
  // The row set widened here. It used to be controlsForStandards(); it is now
  // everything applicability says applies, which additionally picks up controls
  // a rule requires on an asset even where the system's standards do not name
  // them. See applicability.applicableControlsForSystem for why.
  function systemControlMatrix(systemId: SystemId) {
    return applicability
      .applicableControlsForSystem(systemId)
      .map((c) => controlCoverageForSystem(systemId, c.id))
      .sort((a, b) =>
        a.control.domain === b.control.domain
          ? a.controlId.localeCompare(b.controlId)
          : a.control.domain.localeCompare(b.control.domain)
      );
  }

  function systemCoverageBreakdown(systemId: SystemId) {
    const rows = systemControlMatrix(systemId);
    const count = (...statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;
    const scored = rows.filter((r) => r.score != null).length;
    return {
      required: rows.length,
      inherited: count("inherited"),
      satisfied: count("satisfied"),
      partial: count("partial"),
      deficient: count("deficient", "not-implemented"),
      unassessed: count("unassessed"),
      scored,
      // Two different questions, and the second is the one that should be
      // uncomfortable.
      //
      // coveredPct — of the controls actually assessed, how many are holding?
      // Its denominator is the assessed set, so it never quietly counts an
      // unexamined control as covered.
      //
      // assessedPct — how much of what applies was examined at all? This is the
      // honesty check on the first number. It is low, and it is supposed to be:
      // a real engagement covers a chosen set of requirement statements, and
      // saying so is the difference between a gap map and a claim.
      coveredPct: scored === 0 ? 0 : Math.round(((count("inherited") + count("satisfied")) / scored) * 100),
      assessedPct: rows.length === 0 ? 0 : Math.round((scored / rows.length) * 100),
    };
  }

  // ---- Applicability and responsibility --------------------------------------
  // Two axes the matrix above doesn't answer. systemControlMatrix only ever
  // walked the applicable set — a control that doesn't apply was invisible,
  // not reported as excluded. And every row it does carry reads as ACME's own
  // regardless of who actually operates it. Both are real, both are derivable
  // from facts already in the graph, and neither changes a score: this is a
  // second read of the same assessments, not a new one.

  // Who actually runs a control on a system, independent of whether it was
  // assessed. Order of resolution: an explicit per-pair mechanism record (the
  // most specific fact available) beats the domain defaults below it, which
  // in turn only apply because nothing more specific was authored — the same
  // "sparse authoring, honest default" convention ImplementationMechanism
  // already uses for the internal default.
  function responsibilityForControl(systemId: SystemId, controlId: ControlId): Responsibility {
    const system = graph.systemById[systemId];
    const control = graph.controlById[controlId];
    if (!system || !control) return RESPONSIBILITIES.INTERNAL;

    const explicit = (graph.assetsBySystem[systemId] ?? [])
      .map((a) => graph.mechanismByPair[`${a.id}::${controlId}`])
      .find((m) => m?.responsibility)?.responsibility;
    if (explicit) return explicit;

    const domain = control.domain;
    if (inheritsDomain(system.hostingType, domain)) return RESPONSIBILITIES.VENDOR;
    if (graph.enterpriseInheritedDomains.has(domain)) return RESPONSIBILITIES.ENTERPRISE;
    if (SHARED_RESPONSIBILITY_DOMAINS.includes(domain)) return RESPONSIBILITIES.SHARED;
    return RESPONSIBILITIES.INTERNAL;
  }

  // A control this system's applicability never resolved to Applicable or
  // Pending — reported with the honest generic reason (no certifying
  // framework and no matching rule) rather than silently absent from every
  // count. Per-asset exceptions still carry their own specific reason; this is
  // the system-level read for a control no asset-level machinery even
  // considered.
  function notApplicableControlsForSystem(systemId: SystemId): { control: Control; reason: string }[] {
    const system = graph.systemById[systemId];
    const applicableIds = new Set(applicability.applicableControlsForSystem(systemId).map((c) => c.id));
    const pendingIds = new Set(applicability.pendingControlsForSystem(systemId).map((p) => p.control.id));
    return graph.inScopeControls
      .filter((c) => !applicableIds.has(c.id) && !pendingIds.has(c.id))
      .map((control) => ({
        control,
        reason: `No framework ${system.name} certifies against (${system.standards.join(", ")}) cites ${control.id}, and no applicability rule matches an asset in this boundary.`,
      }));
  }

  // The header block a Controls page reads: the full in-scope catalog against
  // one system, split into Applicable (with its responsibility breakdown),
  // Not Applicable, and Pending — the three-way split systemControlMatrix
  // never made because it only ever walked the applicable rows.
  function controlApplicabilitySummary(systemId: SystemId) {
    const applicable = applicability.applicableControlsForSystem(systemId);
    const pending = applicability.pendingControlsForSystem(systemId);
    const notApplicable = notApplicableControlsForSystem(systemId);

    const byResponsibility = { owned: 0, shared: 0, enterprise: 0, vendor: 0 };
    applicable.forEach((c) => {
      const r = responsibilityForControl(systemId, c.id);
      if (r === RESPONSIBILITIES.VENDOR) byResponsibility.vendor += 1;
      else if (r === RESPONSIBILITIES.ENTERPRISE) byResponsibility.enterprise += 1;
      else if (r === RESPONSIBILITIES.SHARED) byResponsibility.shared += 1;
      else byResponsibility.owned += 1;
    });

    return {
      total: graph.inScopeControls.length,
      applicable: applicable.length,
      byResponsibility,
      notApplicable: notApplicable.length,
      notApplicableControls: notApplicable,
      pending: pending.length,
      pendingControls: pending,
    };
  }

  // ---- Framework posture ----------------------------------------------------
  // A clause is as covered as the controls that satisfy it, across every system
  // certifying against that framework. This is the payoff the old model couldn't
  // reach: when an S3 IAM control fails, the SOC 2 clauses citing that control
  // move, without anyone editing a compliance page.
  function clauseCoverage(standard: string, clause: string) {
    const controls = controlsSatisfyingClause(standard, clause);
    const systems = graph.systems.filter((s) => s.standards.includes(standard));
    const rows = systems.flatMap((s) => controls.map((c) => controlCoverageForSystem(s.id, c.id)));

    const scored = rows.filter((r) => r.score != null);
    const worst = rows.reduce((w: ControlCoverage | null, r) => {
      const rank: Record<string, number> = {
        "not-implemented": 0, deficient: 1, partial: 2, assessed: 3, inherited: 4, satisfied: 5, unassessed: 6,
      };
      return w === null || rank[r.status] < rank[w.status] ? r : w;
    }, null);

    return {
      standard, clause, controls, rows,
      score: display(mean(scored.map((r) => r.score as number))),
      band: assuranceBand(display(mean(scored.map((r) => r.score as number)))),
      weakest: worst,
      satisfiedCount: rows.filter((r) => r.status === "satisfied" || r.status === "inherited").length,
      totalCount: rows.length,
      // The score above covers only the rows that were actually assessed, and
      // never blends an unassessed control in as a zero. Reported so a reader
      // can see how much of the clause the number is speaking for.
      scoredCount: scored.length,
    };
  }

  function frameworkPosture(standard: string) {
    const clauses = clausesForFramework(standard);
    const systems = graph.systems.filter((s) => s.standards.includes(standard));
    if (systems.length === 0) {
      return { standard, inScope: false, clauses: [] as string[], score: null as number | null };
    }

    const controlRows = systems.flatMap((s) =>
      controlsForStandards([standard]).map((c) => controlCoverageForSystem(s.id, c.id))
    );
    // Reported over the ASSESSED subset only, with the count stated. The
    // alternative — treating the ~230 unassessed controls per system as zeros —
    // would put a number on work nobody did, which is the one thing the scope
    // model exists to prevent. A posture over 44 rows honestly labelled beats a
    // posture over 271 rows that is mostly fiction.
    const scored = controlRows.filter((r) => r.score != null);
    const score = display(mean(scored.map((r) => r.score as number)));

    return {
      standard,
      inScope: true,
      systems,
      clauseCount: clauses.length,
      controlCount: controlRows.length,
      scoredCount: scored.length,
      assessedPct: controlRows.length === 0 ? 0 : Math.round((scored.length / controlRows.length) * 100),
      score,
      band: assuranceBand(score),
      satisfiedPct: scored.length === 0 ? 0 : Math.round(
        (controlRows.filter((r) => r.status === "satisfied" || r.status === "inherited").length / scored.length) * 100
      ),
      measuredPct: scored.length === 0 ? 0 : Math.round(
        (controlRows.filter((r) => r.basis === BASIS.MEASURED).length / scored.length) * 100
      ),
      deficient: controlRows.filter((r) => r.status === "deficient" || r.status === "not-implemented"),
    };
  }

  // The per-clause detail one system shows for one standard.
  //
  // This is what `standardMappings` used to be: a hand-typed list per system of
  // "CC6.1 — Encryption at Rest — 92% confident — full — <reasoning>". Every one
  // of those four fields was written next to the others and checked by nobody.
  // Now the clause comes from the crosswalk, the control from the crosswalk, the
  // confidence from the implementations' real scores, the status from their real
  // worst case, and the reasoning states which control and asset drove it.
  //
  // Only key controls are shown. A clause satisfied purely by category-assessed
  // controls has nothing specific to say about itself, and listing it with a
  // derived-looking number would be the exact overclaim this replaced.
  function systemStandardMappings(systemId: SystemId, standard: string) {
    const system = graph.systemById[systemId];
    if (!system?.standards.includes(standard)) return [];

    const rows: {
      req: string; control: string; controlId: ControlId; confidence: number;
      status: string; basis: string; reasoning: string;
    }[] = [];
    const seen = new Set<string>();

    controlsForStandards([standard])
      .filter((c) => isKeyControl(c.id))
      .forEach((control) => {
        const coverage = controlCoverageForSystem(systemId, control.id);
        if (coverage.status === "unassessed") return;
        const clauses = control.frameworks.find((f) => f.standard === standard)?.clauses ?? [];
        // The shortest clause id is the parent requirement; the rest are its
        // points-of-focus sub-items, which would bury the row in near-duplicates.
        const primary = [...clauses].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
        if (!primary || seen.has(`${primary}::${control.id}`)) return;
        seen.add(`${primary}::${control.id}`);

        // The instance that made the control what it is. Ranked by status
        // rather than by score, because an instance no longer has one — the
        // whole point of the change is that the asset is a sample, not a
        // scoring subject.
        const rank: Record<string, number> = {
          "not-implemented": 0, undetermined: 1, partial: 2, implemented: 3, "not-applicable": 4,
        };
        const weakest = coverage.instances.reduce(
          (w: (typeof coverage.instances)[number] | null, i) => (w === null || rank[i.status] < rank[w.status] ? i : w),
          null
        );

        rows.push({
          req: primary,
          control: graph.keyControlById[control.id].friendlyName,
          controlId: control.id,
          confidence: coverage.score ?? 0,
          status:
            coverage.status === "satisfied" || coverage.status === "inherited"
              ? "full"
              : coverage.status === "partial" ? "partial" : "gap",
          basis: coverage.basis,
          reasoning: weakest ? `${coverage.explanation} Weakest instance: ${weakest.statement}` : coverage.explanation,
        });
      });

    return rows.sort((a, b) => a.confidence - b.confidence);
  }

  // Which frameworks any system is actually in scope for.
  const inScopeFrameworks = [...new Set(graph.systems.flatMap((s) => s.standards))].sort();

  // Enterprise-wide control coverage.
  const allRows = graph.systems.flatMap((s) => systemControlMatrix(s.id));
  const allScored = allRows.filter((r) => r.score != null);
  const COVERED_STATUSES = ["satisfied", "inherited"];

  return {
    controlsForStandards,
    controlsSatisfyingClause,
    clausesForFramework,
    isKeyControl,
    assetsForSystem,
    controlCoverageForSystem,
    systemControlMatrix,
    systemCoverageBreakdown,
    responsibilityForControl,
    notApplicableControlsForSystem,
    controlApplicabilitySummary,
    SYSTEM_COVERAGE: Object.fromEntries(graph.systems.map((s) => [s.id, systemCoverageBreakdown(s.id)])),
    clauseCoverage,
    frameworkPosture,
    systemStandardMappings,
    IN_SCOPE_FRAMEWORKS: inScopeFrameworks,
    FRAMEWORK_POSTURE: inScopeFrameworks.map(frameworkPosture),
    ENTERPRISE_COVERAGE: {
      applicable: allRows.length,
      assessed: allScored.length,
      covered: allScored.filter((r) => COVERED_STATUSES.includes(r.status)).length,
      // Denominated on what was assessed, not on what applies. The two used to
      // be the same number because every control fell back to a category score;
      // now they are different questions and both are reported, because a
      // "covered" figure that silently counts unexamined controls is the exact
      // overclaim this model was rebuilt to stop making.
      coveredPct: allScored.length === 0 ? 0 : Math.round((allScored.filter((r) => COVERED_STATUSES.includes(r.status)).length / allScored.length) * 100),
      assessedPct: allRows.length === 0 ? 0 : Math.round((allScored.length / allRows.length) * 100),
      measuredPct: allScored.length === 0 ? 0 : Math.round((allScored.filter((r) => r.basis === BASIS.MEASURED).length / allScored.length) * 100),
      deficient: allRows.filter((r) => r.status === "deficient" || r.status === "not-implemented").length,
    },
    // Which assets a program-scoped control effectively covers — everything,
    // which is why it's program-scoped. Exposed so the Graph Explorer can show
    // program controls without pretending they have asset edges.
    programControlReach: () =>
      applicability.PROGRAM_CONTROL_IDS.map((id) => ({
        controlId: id,
        control: graph.keyControlById[id],
        assessments: graph.systems
          .map((s) => assessment.assessmentFor(s.id, id))
          .filter((a): a is ControlAssessment => a !== null && a.assessed),
        reach: graph.assets.length,
      })),
  };
}

export type ComplianceApi = ReturnType<typeof createCompliance>;
export type ControlCoverage = ReturnType<ComplianceApi["controlCoverageForSystem"]>;
