# ACME ASSURE

An enterprise security system of record that connects systems, identities, assets, data, controls, evidence, risks and operational decisions into one continuously derived model.

## Concept

- **Boundary is the system; the unit of assessment is (system, control).**
- Controls are scored on PRISMA's five maturity levels — Policy, Procedure, Implemented, Measured, Managed — per system, not enterprise-wide.
- Unassessed controls carry a `null` score, never a `0`. Inheritance from enterprise-level controls is capped, not automatic.
- Applicability of a control to a system must be explainable — deterministic rules, not a silent AI judgment call.
- Assurance scores (how well a control actually works) are kept separate from assessment coverage (how much has been assessed).
- Assets are diagnostic and sample `Implemented` only — there's no asset-level PRISMA scoring.

## Architecture

```
src/graph/     facts and edges — the source of truth (YAML-backed)
src/engine/    all derivations: assessment, levels, assurance, rollups,
               profile, applicability, evidence, cockpit, findings
src/components/wizard/  shared wizard UI kit (WizardUI.tsx) — every
               wizard/walk surface renders through these primitives
src/pages/       app pages: Overview, Systems, System Workspace (the
                 per-system assurance cockpit — Identity, Security,
                 Data, Assets, Controls, Testing, Risk, Findings,
                 Architecture tabs), Controls, Common Control Framework,
                 Policy Center, Procedure Library, Security Principles,
                 Risk Register, Exception Register, Asset Register,
                 Data Map/Footprint, Executive Dashboard, Graph Explorer,
                 Scheduled Activities
```

`src/graph` holds facts and edges (types/vocab in TypeScript, data in YAML), including first-class `Finding`, `Org` (team/user/business unit), and `Evidence Source` entities. Everything derived — scores, rollups, applicability, cockpit summaries — lives in `src/engine`. Pages read from the engine; nothing recomputes scoring or applicability logic on its own. Control assessment has a single UI surface, `ControlEvaluationPanel` (in `src/pages/SystemWorkspace/`), used both for direct row-click editing and for the guided key-control walk. See `CLAUDE.md` for the full contributor notes.

## Getting started

```sh
npm install
npm run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run check:validators` | Build-time data integrity validators for the graph |
| `npm run snapshot` | Snapshot derived engine output |
| `npm run prisma-report` | Generate a PRISMA scoring report |
| `npm run check` | typecheck + lint + validators |

## Status

Prototype / demo. Data represents fictional systems and controls for illustration only.
