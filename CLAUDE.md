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

## Vocabulary
Use the app's own words in code, UI, and discussion; do not invent shorthand for concepts that already have names.
- **Enterprise** — the all-systems rollup. Canonical. `PORTFOLIO_ASSURANCE_PCT` / `categoryPortfolioAverages` are the old name for the same figure: rename when you touch them, never add a new use of "portfolio".
- **Ladder** / **rung** — the PRISMA maturity ladder only (Policy → Managed). Never say "ladder" about tiers.
- **Tier baseline** — the control set a classification tier puts in scope (`control-baselines.yaml`, `baselineForSystem`). Tiers select baselines; they do not have rungs.
- **External Inheritance** — provider-run domains, backed by a report or certification. Say "report", never a generic "attestation" (SOC 2 is specifically an attestation engagement).
- **Internal Inheritance** — ACME-run central programs, backed by ACME's own program-level evidence. Never "self-attestation".
- **The authored dataset** — the facts in `src/graph/facts/*.yaml`. Not "the corpus".
- **Promotion** — the build-time operation that moves wizard-created facts from the browser into the authored dataset. An internal operation, not a concept the UI teaches; explain it before leaning on it.
- Not app words, do not use: "thin system", "corpus", "portfolio", "baseline ladder".

## Code map
- Engine: `src/engine/` (assessment, levels, assurance, rollups, profile, applicability, evidence, cockpit, findings)
- Graph: `src/graph/` — facts/edges, including `Finding`, `Org` (team/user/business unit), `Evidence Source` entities
- UI: `src/components/`
- Wizard kit: `src/components/wizard/WizardUI.tsx` — the only source of wizard/walk chrome (shell, steps, fields, buttons, status pills). Every wizard-like surface (Add/Edit System, Scope Review, System Readiness, the control assessment walk) composes these primitives; extend `WizardUI.tsx` rather than styling a step in place.
- Wizard rules: `src/components/wizard/CONTRACT.md` — composition, naming, what to ask a human, navigation/state, and write discipline. Read before changing any wizard surface.
- Control assessment: `src/pages/SystemWorkspace/ControlEvaluationPanel.tsx` is the single assessment UI (direct edit and the guided walk both render it). Do not add a parallel assessment modal or scoring surface.
- Reuse these; do not create parallel scoring/applicability/evidence paths.

## Development
- Match existing patterns; narrow diffs; no drive-by refactors unless they are necessary.
- Start with files in the Code map and directly referenced dependencies; widen search only when required by the task.
- Run only relevant checks for touched files unless the change is cross-cutting.

## Change control
Trivial single-file copy/style fixes may proceed with minimal diff.
