// Control definitions — the universal half of the control model.
//
// A control's definition (what it requires, which domain it belongs to, which
// framework clauses cite it) is the same everywhere it appears. Its
// IMPLEMENTATION is contextual, and lives in edges/controlImplementations.js.
// Keeping the two apart is the point: "Least Privilege" means one thing, but it
// works very well on the KMS key and poorly on the RAG service, and there is no
// single honest number for "how good is Least Privilege at ACME."
//
// This file owns no data. Every control comes from the real SCF import, and
// every framework clause comes from that import's crosswalk — the same source
// policies.js, procedures.js, and the Unified Compliance Matrix already read.
import scf from "../../data/scfControls.json";
import { categoryForDomain, getImplementationType, getToolHint } from "./taxonomy";

export const FRAMEWORKS = scf.standards;
export const DOMAINS = scf.domains.map((d) => d.name);

export const CONTROLS = scf.controls.map((c) => {
  const frameworks = scf.standards
    .map((standard) => ({ standard, clauses: c.frameworks[standard] || [] }))
    .filter((f) => f.clauses.length > 0);
  return {
    id: c.id,
    domain: c.domain,
    name: c.name,
    description: c.description,
    frameworks,
    category: categoryForDomain(c.domain),
    implementationType: getImplementationType(c.domain),
    toolHint: getToolHint(c.domain),
  };
});

export const CONTROL_BY_ID = Object.fromEntries(CONTROLS.map((c) => [c.id, c]));

// Controls with at least one framework clause citing them. The rest are real
// SCF controls but out of scope for a program certifying against the standards
// ACME actually claims.
export const IN_SCOPE_CONTROLS = CONTROLS.filter((c) => c.frameworks.length > 0);

// Which in-scope controls apply to a system given the standards it's certifying
// against — the same selection requiredControls() in ccfControls.js makes, kept
// here so the graph doesn't reach back into src/data for a relationship.
export function controlsForStandards(standards) {
  return IN_SCOPE_CONTROLS.filter((c) => c.frameworks.some((f) => standards.includes(f.standard)));
}

// Every clause a control cites for one framework, and the inverse: every
// control a given clause is satisfied by. The inverse index is what lets
// engine/compliance.js answer "how covered is SOC 2 CC6.1" by looking at the
// implementations of the controls that actually satisfy it.
const CLAUSE_INDEX = {};
IN_SCOPE_CONTROLS.forEach((control) => {
  control.frameworks.forEach(({ standard, clauses }) => {
    clauses.forEach((clause) => {
      const key = `${standard}::${clause}`;
      (CLAUSE_INDEX[key] ||= []).push(control.id);
    });
  });
});

export function controlsSatisfyingClause(standard, clause) {
  return (CLAUSE_INDEX[`${standard}::${clause}`] || []).map((id) => CONTROL_BY_ID[id]);
}

export function clausesForFramework(standard) {
  return [...new Set(IN_SCOPE_CONTROLS.flatMap((c) => c.frameworks.filter((f) => f.standard === standard).flatMap((f) => f.clauses)))].sort();
}
