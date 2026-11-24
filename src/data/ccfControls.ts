import scf from "./scfControls.json";

interface ScfControlSource {
  id: string;
  domain: string;
  name: string;
  description: string;
  frameworks: Record<string, string[]>;
}

interface ScfSource {
  controls: ScfControlSource[];
  domains: Array<{ name: string }>;
  standards: string[];
}

// JSON imports preserve exact property keys; the crosswalk itself is dynamic
// by standard name, so normalize that external boundary to a string record.
const SCF_SOURCE = scf as ScfSource;

// Curated common-control catalog: every control gets a framework entry only where
// the SCF crosswalk actually lists clauses. Shared by the Unified Compliance
// Matrix and the Data Classification Register so both pages count against the
// same matched-control pool (read CCF_VISIBLE_CONTROLS.length rather than a
// hardcoded count).
//
// No status here: a control either maps to an in-scope framework clause or it
// doesn't. How well a control is *doing* comes from the engine.
export const CCF_CONTROLS = SCF_SOURCE.controls.map((c) => {
  const frameworks = SCF_SOURCE.standards
    .map((std) => ({ standard: std, clauses: c.frameworks[std] || [] }))
    .filter((f) => f.clauses.length > 0);
  return { id: c.id, domain: c.domain, name: c.name, description: c.description, frameworks, owner: null };
});

// Only controls that map to at least one in-scope framework — the SCF controls
// with no crosswalk hit are real but out of scope for either page. Same rule and same
// set as graph.inScopeControls, which is the engine's name for this pool.
export const CCF_VISIBLE_CONTROLS = CCF_CONTROLS.filter((c) => c.frameworks.length > 0);
export const CCF_DOMAINS = SCF_SOURCE.domains
  .map((d) => ({ name: d.name, total: CCF_VISIBLE_CONTROLS.filter((c) => c.domain === d.name).length }))
  .filter((d) => d.total > 0);
export const CCF_STANDARDS = SCF_SOURCE.standards;

// Which of the matched CCF controls apply to a system, given the compliance
// standards it's in scope for — the real list, not just a count.
export function requiredControls(standards: readonly string[]) {
  return CCF_VISIBLE_CONTROLS.filter((c) => c.frameworks.some((f) => standards.includes(f.standard)));
}

export function requiredControlsCount(standards: readonly string[]) {
  return requiredControls(standards).length;
}
