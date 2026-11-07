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
| A container engine, reachable without `sudo` | — | The scanners run in containers. Docker by default: your user must be in the `docker` group (log out and back in, or `wsl --shutdown`, after adding it). Or rootless Podman with `CONTAINER_ENGINE=podman`, which is what the runner uses (see [The self-hosted runner](#the-self-hosted-runner)). |
| Scanner images: gitleaks, Trivy, Semgrep | `scripts/scanners.mjs` | Pinned by digest; the engine pulls each on first use. |
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

The terminal shows one line per stage and the full output of failed stages only. Every stage's full output goes to `logs/verify.log` (gitignored). On the runner, each run's log is copied to `/home/ghrunner/verify-logs/` and kept for 90 days; it is not uploaded to GitHub, because the repo is public.

### The self-hosted runner

The runner runs as its own user, `ghrunner`, as a systemd service (`actions.runner.jklepp-grc.jpc-wsl`). Its scanners run under **rootless Podman**, and `ghrunner` is **not** in the `docker` group. Docker Desktop has no rootless mode, and access to its socket is root in all but name: any job could `docker run -v /home/<you>:/x` and read your files, including the `gh` CLI token. Under rootless Podman, a compromised scanner or dependency gets `ghrunner`'s files and nothing else.

To set up a runner machine (after installing the runner as `ghrunner`):

```sh
sudo apt install -y podman uidmap         # uidmap applies ghrunner's /etc/subuid range
sudo loginctl enable-linger ghrunner      # keeps /run/user/<uid> alive for a service user
sudo -u ghrunner tee -a /home/ghrunner/actions-runner/.env <<EOF
CONTAINER_ENGINE=podman
XDG_RUNTIME_DIR=/run/user/$(id -u ghrunner)
EOF
sudo gpasswd -d ghrunner docker           # if it was ever added
sudo systemctl restart actions.runner.jklepp-grc.jpc-wsl.service
```

The engine is set in the runner's `.env`, not in the workflows: it belongs to the machine, as Docker Desktop belongs to a workstation. Under Podman, `scripts/scanners.mjs` adds `--userns=keep-id`; without it, `git` inside the container refuses the repo and gitleaks reports 0 commits scanned with exit 0, a silent pass.

To check: `id ghrunner` lists no `docker` group, and `sudo -u ghrunner docker ps` is denied on `/var/run/docker.sock`. Podman's `"/" is not a shared mount` warning in a runner log means the scans ran under Podman; on WSL it is harmless.

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
