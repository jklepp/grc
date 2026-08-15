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
// Here every control resolves to one of four states, each of which means
// something specific:
//
//   inherited  the provider's certification covers this domain under the
//              shared-responsibility split (graph/nodes/systems.js)
//   measured   a key control with real implementations on this system's assets
//   assessed   no key control, but the domain rolls up to an assurance category
//              this system's assets have been assessed against
//   unassessed nothing covers it
//
// Nothing is fabricated, and the matrix stays fully populated — the honest
// answer for most controls is "assessed at category level," which is a weaker
// claim than measured but a real one.
import { SYSTEMS, SYSTEM_BY_ID, inheritsDomain } from "../graph/nodes/systems";
import { assetsForSystem } from "../graph/nodes/assets";
import { controlsForStandards, controlsSatisfyingClause, clausesForFramework, CONTROL_BY_ID } from "../graph/nodes/controls";
import { isKeyControl, KEY_CONTROL_BY_ID } from "../graph/nodes/keyControls";
import { BASIS } from "../graph/nodes/taxonomy";
import { buildImplementation, programImplementation, type Implementation } from "./implementation";
import { assetsRequiringControl, PROGRAM_CONTROL_IDS } from "./applicability";
import { ASSET_ROLLUP_BY_ID, SYSTEM_ROLLUP_BY_ID } from "./rollups";
import { mean, assuranceBand, display } from "./assurance";

export const COVERAGE_STATES = ["measured", "inherited", "assessed", "unassessed"];

export const COVERAGE_STATUS_META = {
  satisfied: { label: "Satisfied", color: "green", basis: BASIS.MEASURED },
  partial: { label: "Partial", color: "amber", basis: BASIS.MEASURED },
  deficient: { label: "Deficient", color: "red", basis: BASIS.MEASURED },
  "not-implemented": { label: "Not implemented", color: "red", basis: BASIS.MEASURED },
  inherited: { label: "Inherited", color: "accent", basis: BASIS.INHERITED },
  assessed: { label: "Assessed at category level", color: "muted", basis: BASIS.ASSESSED },
  unassessed: { label: "Unassessed", color: "muted", basis: BASIS.UNASSESSED },
};

// Worst status across a control's implementations on one system's assets. A
// control that is effective on five assets and deficient on a sixth is not
// "mostly satisfied" — the sixth is the finding.
const STATUS_RANK: Record<string, number> = { "not-implemented": 0, deficient: 1, partial: 2, unevidenced: 3, effective: 4 };

function aggregateImplementationStatus(implementations: Implementation[]): string | null {
  if (implementations.length === 0) return null;
  const worst = implementations.reduce((w, i) => (STATUS_RANK[i.status] < STATUS_RANK[w.status] ? i : w));
  const map: Record<string, string> = { effective: "satisfied", partial: "partial", deficient: "deficient", "not-implemented": "not-implemented", unevidenced: "assessed" };
  return map[worst.status] ?? "assessed";
}

// One row of a system's control matrix.
export function controlCoverageForSystem(systemId: string, controlId: string) {
  const system = SYSTEM_BY_ID[systemId];
  const control = CONTROL_BY_ID[controlId];
  const rollup = SYSTEM_ROLLUP_BY_ID[systemId];

  if (inheritsDomain(system.hostingType, control.domain)) {
    return {
      controlId, control, systemId, status: "inherited", basis: BASIS.INHERITED, score: null as number | null, implementations: [] as Implementation[],
      explanation: `${system.provider} carries this domain under the ${system.hostingType === "saas" ? "SaaS" : "cloud"} shared-responsibility split.`,
      keyControl: undefined as ReturnType<typeof buildImplementation>["control"] | undefined,
    };
  }

  if (isKeyControl(controlId)) {
    const keyControl = KEY_CONTROL_BY_ID[controlId];

    if (keyControl.scope === "program") {
      const impl = programImplementation(controlId)!;
      return {
        controlId, control, systemId, keyControl,
        status: aggregateImplementationStatus([impl]) ?? "unassessed",
        basis: impl.basis, score: impl.score, implementations: [impl],
        explanation: "Operated once for the whole program rather than per resource.",
      };
    }

    const assets = assetsRequiringControl(controlId).filter((a) => a.systemId === systemId);
    const implementations = assets.map((a) => buildImplementation(a.id, controlId));
    if (implementations.length > 0) {
      return {
        controlId, control, systemId, keyControl,
        status: aggregateImplementationStatus(implementations)!,
        basis: implementations.some((i) => i.basis === BASIS.MEASURED) ? BASIS.MEASURED : BASIS.ASSESSED,
        score: display(mean(implementations.map((i) => i.rawScore as number))),
        implementations,
        explanation: `Implemented on ${implementations.length} asset${implementations.length === 1 ? "" : "s"} in this boundary.`,
      };
    }
  }

  // Not key-tracked. It still rolls up to an assurance category this system's
  // assets have been assessed against, so the honest status is "assessed",
  // carrying that category's real score.
  const categoryScore = rollup?.categoryScores?.[control.category];
  if (categoryScore != null) {
    return {
      controlId, control, systemId, status: "assessed", basis: BASIS.ASSESSED, score: categoryScore, implementations: [] as Implementation[],
      explanation: `Not individually tracked. Covered by this system's ${control.category} assessment.`,
    };
  }

  return {
    controlId, control, systemId, status: "unassessed", basis: BASIS.UNASSESSED, score: null as number | null, implementations: [] as Implementation[],
    explanation: "No implementation, inheritance, or category assessment covers this control.",
  };
}

export type ControlCoverage = ReturnType<typeof controlCoverageForSystem>;

// The full matrix for one system — every control its standards actually
// require, sorted by domain then id, same ordering the SSP page used.
export function systemControlMatrix(systemId: string): ControlCoverage[] {
  const system = SYSTEM_BY_ID[systemId];
  return controlsForStandards(system.standards)
    .map((c) => controlCoverageForSystem(systemId, c.id))
    .sort((a, b) => (a.control.domain === b.control.domain ? a.controlId.localeCompare(b.controlId) : a.control.domain.localeCompare(b.control.domain)));
}

export function systemCoverageBreakdown(systemId: string) {
  const rows = systemControlMatrix(systemId);
  const count = (...statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;
  return {
    required: rows.length,
    inherited: count("inherited"),
    satisfied: count("satisfied"),
    partial: count("partial"),
    deficient: count("deficient", "not-implemented"),
    assessed: count("assessed"),
    unassessed: count("unassessed"),
    // Two different questions, deliberately reported as two numbers.
    //
    // coveredPct — does this control have an accepted basis and no known
    // failure? A category-assessed control counts: it is governed by a
    // documented procedure and a real assessment. Calling it uncovered would be
    // as wrong as calling it satisfied.
    //
    // measuredPct — how much of that rests on control-level evidence rather
    // than a category judgment? This is the honesty check on the first number,
    // and it is the one that should be uncomfortable.
    coveredPct: Math.round(((count("inherited") + count("satisfied") + count("assessed")) / rows.length) * 100),
    measuredPct: Math.round((count("satisfied", "partial", "deficient", "not-implemented") / rows.length) * 100),
  };
}

export const SYSTEM_COVERAGE = Object.fromEntries(SYSTEMS.map((s) => [s.id, systemCoverageBreakdown(s.id)]));

// ---- Framework posture ------------------------------------------------------------
// A clause is as covered as the controls that satisfy it, across every system
// certifying against that framework. This is the payoff the old model couldn't
// reach: when an S3 IAM control fails, the SOC 2 clauses citing that control
// move, without anyone editing a compliance page.
export function clauseCoverage(standard: string, clause: string) {
  const controls = controlsSatisfyingClause(standard, clause);
  const systems = SYSTEMS.filter((s) => s.standards.includes(standard));
  const rows = systems.flatMap((s) => controls.map((c) => controlCoverageForSystem(s.id, c.id)));

  const scored = rows.filter((r) => r.score != null);
  const worst = rows.reduce((w: ControlCoverage | null, r) => {
    const rank: Record<string, number> = { "not-implemented": 0, deficient: 1, partial: 2, assessed: 3, inherited: 4, satisfied: 5, unassessed: 6 };
    return w === null || rank[r.status] < rank[w.status] ? r : w;
  }, null);

  return {
    standard, clause, controls, rows,
    score: display(mean(scored.map((r) => r.score as number))),
    band: assuranceBand(display(mean(scored.map((r) => r.score as number)))),
    weakest: worst,
    satisfiedCount: rows.filter((r) => r.status === "satisfied" || r.status === "inherited").length,
    totalCount: rows.length,
  };
}

export function frameworkPosture(standard: string) {
  const clauses = clausesForFramework(standard);
  const systems = SYSTEMS.filter((s) => s.standards.includes(standard));
  if (systems.length === 0) return { standard, inScope: false, clauses: [] as string[], score: null as number | null };

  const controlRows = systems.flatMap((s) =>
    controlsForStandards([standard]).map((c) => controlCoverageForSystem(s.id, c.id))
  );
  const scored = controlRows.filter((r) => r.score != null);
  const score = display(mean(scored.map((r) => r.score as number)));

  return {
    standard,
    inScope: true,
    systems,
    clauseCount: clauses.length,
    controlCount: controlRows.length,
    score,
    band: assuranceBand(score),
    satisfiedPct: Math.round((controlRows.filter((r) => r.status === "satisfied" || r.status === "inherited").length / controlRows.length) * 100),
    measuredPct: Math.round((controlRows.filter((r) => r.basis === BASIS.MEASURED).length / controlRows.length) * 100),
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
export function systemStandardMappings(systemId: string, standard: string) {
  const system = SYSTEM_BY_ID[systemId];
  if (!system?.standards.includes(standard)) return [];

  const rows: {
    req: string; control: string; controlId: string; confidence: number;
    status: string; basis: string; reasoning: string;
  }[] = [];
  const seen = new Set<string>();

  controlsForStandards([standard])
    .filter((c) => isKeyControl(c.id))
    .forEach((control) => {
      const coverage = controlCoverageForSystem(systemId, control.id);
      if (coverage.status === "assessed" || coverage.status === "unassessed") return;
      const clauses = control.frameworks.find((f) => f.standard === standard)?.clauses ?? [];
      // The shortest clause id is the parent requirement; the rest are its
      // points-of-focus sub-items, which would bury the row in near-duplicates.
      const primary = [...clauses].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
      if (!primary || seen.has(`${primary}::${control.id}`)) return;
      seen.add(`${primary}::${control.id}`);

      const weakest = coverage.implementations.reduce(
        (w: Implementation | null, i) => (w === null || (i.score as number) < (w.score as number) ? i : w),
        null
      );
      const weakAsset = weakest?.assetId ? assetsForSystem(systemId).find((a) => a.id === weakest.assetId) : null;

      rows.push({
        req: primary,
        control: KEY_CONTROL_BY_ID[control.id].friendlyName,
        controlId: control.id,
        confidence: coverage.score ?? 0,
        status: coverage.status === "satisfied" || coverage.status === "inherited" ? "full" : coverage.status === "partial" ? "partial" : "gap",
        basis: coverage.basis,
        reasoning:
          coverage.status === "inherited"
            ? coverage.explanation
            : weakest
              ? `${weakest.note ?? coverage.explanation} Weakest implementation: ${weakest.score} on ${weakAsset?.name ?? "the program"}${weakest.evidence[0] ? `, per ${weakest.evidence[0].source} (${weakest.evidence[0].result.toUpperCase()}, ${weakest.evidence[0].coveragePct}% coverage, ${weakest.evidence[0].ageDays} days ago).` : "."}`
              : coverage.explanation,
      });
    });

  return rows.sort((a, b) => a.confidence - b.confidence);
}

// Which frameworks any system is actually in scope for.
export const IN_SCOPE_FRAMEWORKS = [...new Set(SYSTEMS.flatMap((s) => s.standards))].sort();

export const FRAMEWORK_POSTURE = IN_SCOPE_FRAMEWORKS.map(frameworkPosture);

// Enterprise-wide control coverage, replacing dataClassification.js's
// DATA_PROTECTION_PCT.
const ALL_ROWS = SYSTEMS.flatMap((s) => systemControlMatrix(s.id));
const COVERED_STATUSES = ["satisfied", "inherited", "assessed"];
export const ENTERPRISE_COVERAGE = {
  required: ALL_ROWS.length,
  covered: ALL_ROWS.filter((r) => COVERED_STATUSES.includes(r.status)).length,
  coveredPct: Math.round((ALL_ROWS.filter((r) => COVERED_STATUSES.includes(r.status)).length / ALL_ROWS.length) * 100),
  measuredPct: Math.round((ALL_ROWS.filter((r) => r.basis === BASIS.MEASURED).length / ALL_ROWS.length) * 100),
  deficient: ALL_ROWS.filter((r) => r.status === "deficient" || r.status === "not-implemented").length,
};

// Which assets a program-scoped control effectively covers — everything, which
// is why it's program-scoped. Exposed so the Graph Explorer can show program
// controls without pretending they have asset edges.
export function programControlReach() {
  return PROGRAM_CONTROL_IDS.map((id) => ({
    controlId: id,
    control: KEY_CONTROL_BY_ID[id],
    implementation: programImplementation(id),
    reach: Object.keys(ASSET_ROLLUP_BY_ID).length,
  }));
}

export { assetsForSystem };
