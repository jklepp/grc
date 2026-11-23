# ACME ASSURE project instructions

ACME ASSURE is a security assurance and visibility platform (a prototype). It is not a compliance checklist tool. Risk supports assurance; it is not the primary product model.
All systems, controls, and related records are fictional demo data.

## Assessment model
- Boundary: system. Unit of assessment: (system, control).
- PRISMA levels: Policy, Procedure, Implemented, Measured, Managed.
- Assets sample Implemented only; no asset-level PRISMA scores.
- Unassessed ⇒ `null` score, never `0`. Inheritance is capped.
- Applicability must be explainable and deterministic; deterministic rules win over silent AI decisions.
- Keep assurance scores separate from assessment coverage %.

## Vocabulary
Use the app's own words in code, UI, and discussion; do not invent shorthand for concepts that already have names.
- **Enterprise**: the all-systems rollup. The rename from "portfolio" is complete; never reintroduce the old word for this figure.
- **Ladder** / **rung**: the PRISMA maturity ladder only (Policy → Managed). Never say "ladder" about tiers.
- **Tier baseline**: the control set a classification tier puts in scope (`control-baselines.yaml`, `baselineForSystem`). Tiers select baselines; they do not have rungs.
- **External Inheritance**: provider-run domains, backed by a report or certification. Say "report", never a generic "attestation" (SOC 2 is specifically an attestation engagement).
- **Internal Inheritance**: ACME-run central programs, backed by ACME's own program-level evidence. Never "self-attestation".
- **The authored dataset**: the facts in `src/graph/facts/*.yaml`. Not "the corpus".
- **Promotion**: the build-time operation that moves wizard-created facts from the browser into the authored dataset (`engine/promote.ts`, `scripts/promote-runtime-facts.mjs`). An internal operation, not a concept the UI teaches; explain it before leaning on it.
- **Compliance score**: of a system's applicable controls that are assessed, the share that is met (implemented or inherited). Partial earns nothing, as in ISO 27001. Every system has one, and it is the Enterprise rollup.
- **Cyber Assurance**: the PRISMA-level score. Only systems with HITRUST r2 in scope are scored on it (`requiresCyberAssurance`); for every other system it is null by design, not low.
- **Framework baseline**: how systems without HITRUST are assessed: per control, a statement, status, owner, and the frequency and evidence references the in-scope frameworks ask for (`src/graph/nodes/controlRecords.ts`).
- **Common** / **Hybrid** / **System-specific**: where a control's statement lives. Common is written once centrally (`common-controls.yaml`); Hybrid has a central method plus each system's part (`control-records.yaml`); System-specific is the system's alone. Do not call these "shared": that word means provider shared responsibility.
- **System of record**: a system's current control records. Versioned, never overwritten: each save appends a version, the latest is current, and any earlier date can be read back.
- **Engagement** (shown as an **audit**): a bounded piece of work against the system of record: frameworks, systems, a period, an audit firm. It keeps drafts of the records it changes, the auditor's result per control (a separate voice from management's statement), and on close publishes the drafts as new versions after a reviewed diff, freezes a snapshot, and records the certificate or report.
- Not app words, do not use: "thin system", "corpus", "portfolio", "baseline ladder". A standard's own control text keeps its own wording (PRM-07 really does say "portfolio"); the ban is on the app's voice.

## Code map
- Graph: `src/graph/` is the source of truth for facts and edges, including `Finding`, `Org` (team/user/business unit), and `Evidence Source` entities.
- Engine: `src/engine/` holds the derivations (assessment, levels, assurance, rollups, profile, applicability, evidence, cockpit, findings, review) and the write path (`runtimeMutations.ts`, `liveGraph.ts`, `runtimeFactsStore.ts`, `promote.ts`). Pages and components consume engine results; they never recreate business logic or hand-assemble fact records.
- Auth: `src/auth/` holds session, roster, and `gates.ts`. Every permission decision and every signature comes from here; a surface never decides policy locally.
- Pages: `src/pages/`; `src/pages/SystemWorkspace/` is where most system-level work lands.
- UI: `src/components/`.
- Canvas: `src/components/canvas/`: `SystemCanvas.tsx` with `canvasLayout.ts` (bands, swimlanes, edge kinds), `CanvasNodes.tsx`, `assetKindMeta.ts`. `DataMap` renders it; `FlowDiagramSVG`/`FlowMatrixSVG` are the older diagram views on the same page.
- Wizard kit: `src/components/wizard/WizardUI.tsx` is the only source of wizard/walk chrome (shell, steps, fields, buttons, status pills). Every wizard-like surface (Add/Edit System, Scope Review, the Assurance Walk, the control assessment walk, the evaluation panel, the Finding Editor, Settings' User Editor) composes these primitives; extend `WizardUI.tsx` rather than styling a step in place.
- Wizard rules: `src/components/wizard/CONTRACT.md` covers composition, naming, what to ask a human, navigation/state, and write discipline. Read it before changing any wizard surface.
- Control assessment: `src/pages/SystemWorkspace/ControlEvaluationPanel.tsx` is the single assessment UI (direct edit and the guided walk both render it). Do not add a parallel assessment modal or scoring surface.
- Framework baseline: `src/graph/nodes/controlRecords.ts` (records, versions, `requiresCyberAssurance`), `src/engine/controlRecords.ts` (resolution), `src/pages/SystemWorkspace/BaselineControls.tsx` (the Controls tab for systems without HITRUST). `ControlEvaluationPanel` and the PRISMA walk are for HITRUST systems only.
- Audits: `src/graph/nodes/engagements.ts`, `src/engine/engagements.ts` (rows, requests, populations, close plan), `src/pages/Audits/`.
- Reuse these paths; do not create parallel scoring, applicability, or evidence implementations.

## Development
- Match existing React and repository patterns; keep diffs narrow; no drive-by refactors unless necessary.
- Start with the files the task names, the Code map, and their direct dependencies; widen the search only when the task requires it.
- Do not add or upgrade dependencies without asking first.
- Preserve existing behavior and visual design unless the task explicitly asks for a change.
- Do not modify demo data unless the task requires it.

## Change control
- Before non-trivial edits, summarize the intended change and list the files expected to be modified.
- Trivial single-file copy or styling fixes may proceed with a minimal diff.
- Preserve unrelated user changes in the working tree.

## Verification
Run checks proportionate to the files and behavior changed:
- `npm run typecheck` for TypeScript or typed-interface changes.
- `npm run lint` for source changes.
- `npm run check:validators` when graph data or derivation inputs change.
- `npm run build` when changes could affect production bundling.
- `npm run check` for broad or cross-cutting changes (typecheck, lint, `check:validators`, `check:roster`).

Report which checks were run and any that could not be completed.
