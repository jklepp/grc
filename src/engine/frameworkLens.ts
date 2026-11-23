// The Framework Lens: one control seen through a chosen set of frameworks.
//
// A common control aggregates every framework ACME adheres to, so its full
// requirement list is the default view. A lens narrows it to the requirements
// the chosen frameworks' clauses land on (data/requirementClauses.ts), and
// groups the rest by the framework that would add them.
//
// This is a view of the catalog only. It never changes applicability,
// assessment, or scoring: a (system, control) pair is assessed against the
// whole control regardless of what anyone's lens shows.
import { CONSOLIDATED_CONTROLS, type ConsolidatedControl } from "../data/consolidatedControls";
import { REQUIREMENT_CLAUSES } from "../data/requirementClauses";
import type { Control } from "../graph/nodes/controls";

export interface LensRequirement {
  /** 1-based position in the consolidated control; stable under any lens. */
  number: number;
  title: string;
  detail: string;
  /** Frameworks with at least one clause on this requirement, in catalog order. */
  standards: string[];
}

export interface LensOutsideGroup {
  /** A framework name, or null for requirements no framework clause reaches. */
  standard: string | null;
  requirements: LensRequirement[];
}

export interface ControlLensView {
  /** False when the lens is on and none of its frameworks maps to this control. */
  reached: boolean;
  /** Requirements in the consolidated control; 0 when it has no consolidated text. */
  total: number;
  /** What the lens shows. Requirements no framework reaches show whenever the control is reached. */
  shown: LensRequirement[];
  /** Everything else, grouped by the framework that would add it. Empty with no lens. */
  outside: LensOutsideGroup[];
  /** The control's crosswalk, limited to the lens (all of it with no lens). */
  mappings: Control["frameworks"];
}

function requirementsFor(control: Control, consolidated: ConsolidatedControl): LensRequirement[] {
  const clauses = REQUIREMENT_CLAUSES[control.id] ?? {};
  return consolidated.requirements.map((r, i) => {
    const number = i + 1;
    const standards = control.frameworks
      .map((f) => f.standard)
      .filter((std) => Object.values(clauses[std] ?? {}).some((reqs) => reqs.includes(number)));
    return { number, title: r.title, detail: r.detail, standards };
  });
}

export function controlLensView(control: Control, lens: readonly string[]): ControlLensView {
  const active = lens.length > 0;
  const inLens = (std: string) => !active || lens.includes(std);
  const reached = !active || control.frameworks.some((f) => lens.includes(f.standard));
  const mappings = control.frameworks.filter((f) => inLens(f.standard));

  const consolidated = CONSOLIDATED_CONTROLS[control.id];
  if (!consolidated) return { reached, total: 0, shown: [], outside: [], mappings };

  const all = requirementsFor(control, consolidated);
  if (!active) return { reached, total: all.length, shown: all, outside: [], mappings };

  const isShown = (r: LensRequirement) =>
    r.standards.some((s) => lens.includes(s)) || (reached && r.standards.length === 0);
  const shown = all.filter(isShown);
  const rest = all.filter((r) => !isShown(r));

  const outside: LensOutsideGroup[] = control.frameworks
    .filter((f) => !lens.includes(f.standard))
    .map((f) => ({ standard: f.standard, requirements: rest.filter((r) => r.standards.includes(f.standard)) }))
    .filter((g) => g.requirements.length > 0);
  const unmapped = rest.filter((r) => r.standards.length === 0);
  if (unmapped.length > 0) outside.push({ standard: null, requirements: unmapped });

  return { reached, total: all.length, shown, outside, mappings };
}

/**
 * Checks requirementClauses.ts against the crosswalk and the consolidated text.
 * Inputs are parameters so the fault-injection harness can hand it broken data.
 */
export function validateRequirementClauses(
  controls: readonly Control[],
  consolidated: Record<string, ConsolidatedControl>,
  clauses: Record<string, Record<string, Record<string, number[]>>>,
): string[] {
  const problems: string[] = [];
  const known = new Set(controls.map((c) => c.id));
  for (const id of Object.keys(clauses)) {
    if (!known.has(id)) problems.push(`${id}: requirement clauses for a control that is not in the catalog`);
    else if (!consolidated[id]) problems.push(`${id}: requirement clauses for a control with no consolidated requirements`);
  }
  for (const control of controls) {
    const text = consolidated[control.id];
    if (!text) continue;
    const entry = clauses[control.id];
    if (!entry) {
      problems.push(`${control.id}: has consolidated requirements but no requirement clauses`);
      continue;
    }
    const n = text.requirements.length;
    const crosswalk = new Map(control.frameworks.map((f) => [f.standard, new Set(f.clauses)]));
    for (const [std, byClause] of Object.entries(entry)) {
      const expected = crosswalk.get(std);
      for (const [clause, reqs] of Object.entries(byClause)) {
        if (!expected?.has(clause)) problems.push(`${control.id} ${std} ${clause}: not in the control's crosswalk`);
        if (reqs.length === 0) problems.push(`${control.id} ${std} ${clause}: lands on no requirement`);
        for (const r of reqs) {
          if (!Number.isInteger(r) || r < 1 || r > n) problems.push(`${control.id} ${std} ${clause}: requirement ${r} is not 1..${n}`);
        }
      }
    }
    for (const f of control.frameworks) {
      for (const clause of f.clauses) {
        if (!entry[f.standard]?.[clause]) problems.push(`${control.id} ${f.standard} ${clause}: crosswalk clause with no requirement`);
      }
    }
  }
  return problems;
}
