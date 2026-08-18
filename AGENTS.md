# ACME GRC project instructions

## Product model

- Treat this application as a security assurance and visibility platform, not as a compliance checklist.
- The system is the assessment boundary, and `(system, control)` is the unit of assessment.
- Preserve the PRISMA maturity levels: Policy, Procedure, Implemented, Measured, and Managed.
- Represent unassessed controls with a `null` score, never `0`.
- Keep assurance scores separate from assessment coverage percentages.
- Assets may sample the Implemented level only; do not introduce asset-level PRISMA scoring.
- Keep control applicability explainable and deterministic. Do not introduce silent AI decisions.
- Treat all included systems, controls, and related records as fictional demo data.

## Architecture

- Use `src/graph/` as the source of truth for facts and edges.
- Keep assessment, scoring, maturity, assurance, rollup, profile, applicability, and evidence derivations in `src/engine/`.
- Pages and components should consume engine results instead of recreating business logic.
- Reuse existing graph, engine, and UI paths; do not create parallel scoring, applicability, or evidence implementations.

## Development practices

- Match existing React and repository patterns.
- Prefer focused changes and avoid unrelated refactors.
- Start with the files named by the task and their direct dependencies; widen the search only when necessary.
- Do not add or upgrade dependencies without asking first.
- Preserve existing behavior and visual design unless the task explicitly requests a change.
- Do not modify demo data unless the task requires it.

## Change control

- Before non-trivial edits, summarize the intended change and list the files expected to be modified.
- Trivial single-file copy or styling fixes may proceed with a minimal diff.
- Preserve unrelated user changes in the working tree.

## Verification

- Run checks proportionate to the files and behavior changed.
- Use `npm run typecheck` for TypeScript or typed-interface changes.
- Use `npm run lint` for source changes.
- Use `npm run check:validators` when graph data or derivation inputs change.
- Use `npm run build` when changes could affect production bundling.
- Use `npm run check` for broad or cross-cutting changes.
- Report which checks were run and any checks that could not be completed.
