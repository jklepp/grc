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

## Prerequisites

Versions are pinned in one place each; this list says where, not what, so it can't drift.

| Need | Version pinned in | Notes |
| --- | --- | --- |
| Linux or WSL 2, with `git` and `bash` | — | The git hooks are bash scripts. |
| Node.js, via [nvm](https://github.com/nvm-sh/nvm) | `.nvmrc` | `nvm use` picks it up; the hooks do the same. |
| npm packages | `package-lock.json` | Install with `npm ci`, which installs exactly the lockfile and fails if it disagrees with `package.json`. |
| Docker, reachable without `sudo` | — | The scanners run in containers. Your user must be in the `docker` group (log out and back in, or `wsl --shutdown`, after adding it). |
| Scanner images: gitleaks, Trivy, Semgrep | `scripts/scanners.mjs` | Pinned by digest; Docker pulls each on first use. |
| Network access to `registry.npmjs.org`, `ghcr.io`, `docker.io` | — | For installs, first image pulls, and Trivy's daily database (about 1.7 GB, cached in `~/.cache/grc-trivy`). |

## Getting started

```sh
nvm use
npm ci          # also points git at .githooks/ (the "prepare" script)
npm run dev
```

## Local CI

`npm run verify` (`scripts/verify.mjs`) is the single definition of CI. It runs every stage even after one fails, then prints a summary. The stages are type and lint checks, `npm audit`, Trivy, registry signatures, unreviewed install scripts, workflow runners, gitleaks, Semgrep, build and bundle budget. It runs in three places:

| When | What runs |
| --- | --- |
| `git commit` | `.githooks/pre-commit`: gitleaks on the staged changes |
| `git push` | `.githooks/pre-push`: refuses direct pushes to `main`, then `verify` |
| Pull requests | `.github/workflows/verify.yml`: `npm ci` + `verify` on the self-hosted runner |
| Pushes to `main` | `.github/workflows/deploy.yml`: `npm ci` + `verify`, then publish `dist/` to GitHub Pages, all on the self-hosted runner |

The runner is self-hosted only. `scripts/check-workflows.mjs` fails `verify` if any job could run on a GitHub-hosted runner. There is no scheduled run, so to check unchanged code against newly published advisories, run `npm run verify` by hand.

Hooks can be skipped with `--no-verify`. A push to `main` that fails `verify` is never deployed. The Pages source must be "GitHub Actions" (`deploy.yml`), not "Deploy from a branch", which builds on GitHub's hosted runners.

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
| `npm run check` | typecheck + lint + validators + roster |
| `npm run check:bundle` | Bundle size against its budget (after a build) |
| `npm run verify` | All CI stages; see Local CI |
| `npm run scan:secrets` | gitleaks over the full git history |
| `npm run scan:vulns` | Trivy: dependency vulnerabilities and licenses |
| `npm run scan:code` | Semgrep with the rules in `.semgrep/` |

## Status

Prototype / demo. Data represents fictional systems and controls for illustration only.
