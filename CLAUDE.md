# Project
ACME ASSURE: security assurance and visibility platform (prototype; demo systems).
Not a compliance checklist tool. Risk supports assurance; it is not the primary product model.

## Assessment model
- Boundary: system. Unit: (system, control).
- PRISMA levels: Policy, Procedure, Implemented, Measured, Managed.
- Assets sample Implemented only; no asset-level PRISMA scores.
- Unassessed ⇒ null score, never 0. Inheritance capped.
- Applicability must be explainable; deterministic rules win over silent AI decisions.
- Keep assurance scores separate from assessment coverage %.

## Code map
- Engine: `src/engine/` (assessment, levels, assurance, rollups, profile, applicability, evidence, cockpit, findings)
- Graph: `src/graph/` — facts/edges, including `Finding`, `Org` (team/user/business unit), `Evidence Source` entities
- UI: `src/components/`
- Wizard kit: `src/components/wizard/WizardUI.tsx` — the only source of wizard/walk chrome (shell, steps, fields, buttons, status pills). Every wizard-like surface (Add/Edit System, Scope Determination, System Readiness, the control assessment walk) composes these primitives; extend `WizardUI.tsx` rather than styling a step in place.
- Control assessment: `src/pages/SystemWorkspace/ControlEvaluationPanel.tsx` is the single assessment UI (direct edit and the guided walk both render it). Do not add a parallel assessment modal or scoring surface.
- Reuse these; do not create parallel scoring/applicability/evidence paths.

## Development
- Match existing patterns; narrow diffs; no drive-by refactors unless they are necessary.
- Start with files in the Code map and directly referenced dependencies; widen search only when required by the task.
- Run only relevant checks for touched files unless the change is cross-cutting.

## Change control
Trivial single-file copy/style fixes may proceed with minimal diff.