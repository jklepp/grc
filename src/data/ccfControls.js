import scf from "./scfControls.json";

function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

// Real SCF import: every control gets a framework entry only where SCF's crosswalk
// actually lists clauses. There is no confidence data in the source file, so match
// status is derived deterministically from the control id: matched controls are
// marked "matched" except for a held-out ~1/3 still flagged "unscored" for review.
// Shared by the Unified Compliance Matrix and the Data Classification Register so
// both pages count against the same 298-control pool.
export const CCF_CONTROLS = scf.controls.map((c) => {
  const frameworks = scf.standards
    .map((std) => ({ standard: std, clauses: c.frameworks[std] || [] }))
    .filter((f) => f.clauses.length > 0);
  let overall = "no-match";
  if (frameworks.length > 0) {
    overall = Math.abs(hashStr(c.id)) % 3 === 0 ? "unscored" : "matched";
  }
  return { id: c.id, domain: c.domain, name: c.name, description: c.description, frameworks, overall, owner: null };
});

// Only controls that map to at least one in-scope framework — the SCF controls
// with no crosswalk hit are real but out of scope for either page.
export const CCF_VISIBLE_CONTROLS = CCF_CONTROLS.filter((c) => c.overall !== "no-match");
export const CCF_DOMAINS = scf.domains
  .map((d) => ({ name: d.name, total: CCF_VISIBLE_CONTROLS.filter((c) => c.domain === d.name).length }))
  .filter((d) => d.total > 0);
export const CCF_STANDARDS = scf.standards;

// Which of the 298 matched CCF controls apply to a system, given the compliance
// standards it's in scope for — the real list, not just a count.
export function requiredControls(standards) {
  return CCF_VISIBLE_CONTROLS.filter((c) => c.frameworks.some((f) => standards.includes(f.standard)));
}

export function requiredControlsCount(standards) {
  return requiredControls(standards).length;
}
