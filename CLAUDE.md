# Project
ACME GRC: security assurance and visibility platform (prototype; demo systems).
Not a compliance checklist tool. Risk supports assurance; it is not the primary product model.

## Assessment model
- Boundary: system. Unit: (system, control).
- PRISMA levels: Policy, Procedure, Implemented, Measured, Managed.
- Assets sample Implemented only; no asset-level PRISMA scores.
- Unassessed ⇒ null score, never 0. Inheritance capped.
- Applicability must be explainable; deterministic rules win over silent AI decisions.
- Keep assurance scores separate from assessment coverage %.

## Code map
- Engine: `src/engine/` (assessment, levels, assurance, rollups, profile, applicability, evidence)
- Graph: `src/graph/`
- UI: `src/components/`
- Reuse these; do not create parallel scoring/applicability/evidence paths.

## Development
- Match existing patterns; narrow diffs; no drive-by refactors.
- Start with files in the Code map and directly referenced dependencies; widen search only when required by the task.
- Run only relevant checks for touched files unless the change is cross-cutting.

## Change control
Before non-trivial edits: list files to change/create and why; wait for approval.
Trivial single-file copy/style fixes may proceed with minimal diff.