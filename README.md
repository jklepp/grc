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
| `git push` | `.githooks/pre-push`: refuses direct pushes to `main` (GitHub's ruleset refuses them too), then `verify` |
| Pull requests | `.github/workflows/verify.yml`: `verify --container` on the self-hosted runner |
| Pushes to `main` | `.github/workflows/deploy.yml`: `verify --container`, build again in a fresh container, sign build provenance and an SBOM, publish `dist/` to GitHub Pages, then verify the live site; all on the self-hosted runner (see [Deploys: provenance and the live check](#deploys-provenance-and-the-live-check)) |

**On the runner, no npm code runs on the runner itself.** `verify --container` runs every stage that uses npm or loads code from `node_modules` (checks, `npm audit`, signatures, install scripts, workflows, build, bundle) in a throwaway container: the pinned `node` image from `scripts/scanners.mjs`, the committed source streamed in with `git archive`, `npm ci --ignore-scripts`, no network except for npm's own registry checks, unprivileged, read-only root filesystem, no capabilities. The volume is deleted afterwards, pass or fail, and `dist/` is copied out. Only our own scanner scripts run on the runner, and each starts its scanner in its own container. So a malicious dependency never runs as `ghrunner`, next to the runner's key. Locally, plain `npm run verify` still checks the working tree with your installed `node_modules`; `npm run verify:container` gives the runner's result for `HEAD`. The shared container code is `scripts/container-workspace.mjs`.

The runner is self-hosted only. `scripts/check-workflows.mjs` fails `verify` if any job could run on a GitHub-hosted runner. There is no scheduled run, so to check unchanged code against newly published advisories, run `npm run verify` by hand.

Hooks can be skipped with `--no-verify`; they are an early warning, not the gate. The gate is the **"Protect main" ruleset** (Settings → Rules → Rulesets), enforced by GitHub: changes reach `main` only through a pull request, the PR cannot merge until `verify` (from GitHub Actions only) passes on a branch that is up to date with `main`, and `main` cannot be force-pushed or deleted. Its bypass list is empty, admins included. Two consequences: the runner must be online to merge, and renaming the `verify` job means updating the ruleset in the same change, or every PR waits for a check that never arrives.

A push to `main` that fails `verify` is never deployed. The Pages source must be "GitHub Actions" (`deploy.yml`), not "Deploy from a branch", which builds on GitHub's hosted runners.

The terminal shows one line per stage and the full output of failed stages only. Every stage's full output goes to `logs/verify.log` (gitignored). On the runner, each run's log is copied to `/home/ghrunner/verify-logs/` and kept for 90 days; it is not uploaded to GitHub, because the repo is public.

### The self-hosted runner

The runner runs as its own user, `ghrunner`, as a systemd service (`actions.runner.jklepp-grc.jpc-wsl`). Its scanners run under **rootless Podman**, and `ghrunner` is **not** in the `docker` group. Docker Desktop has no rootless mode, and access to its socket is root in all but name: any job could `docker run -v /home/<you>:/x` and read your files, including the `gh` CLI token. Under rootless Podman, a compromised scanner or dependency cannot use Docker to reach other users' Linux files; on WSL it can still reach Windows (see the known gap below).

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

**Known gap on WSL (open):** WSL's Windows integration reaches past `ghrunner`'s own files. Windows drives are mounted readable by every Linux user (`/mnt/c`, `/mnt/d`), and interop lets any Linux user start Windows programs, which run as the signed-in Windows user: `sudo -u ghrunner cmd.exe /c whoami` prints the Windows account. So a compromised job could read Windows files and act as the Windows user, for example to read the Windows `gh` login. Locking the drives to your Linux user (`/etc/wsl.conf` `[automount] options`) closes the reading but not interop, since a job can bring its own `.exe`; closing interop means `[interop] enabled=false`, which also stops `code .`, `explorer.exe` and browser launching from WSL, and needs `"credsStore": "desktop.exe"` removed from `~/.docker/config.json`. The full fix is a runner on its own VM or machine.

## Deploys: provenance and the live check

`deploy.yml` runs four jobs, each with only the permissions it needs:

| Job | Does | Permissions | Runs npm packages? |
| --- | --- | --- | --- |
| `build` | `verify --container`, the site built again in a second container, and `npm run sbom` | `contents: read` | Yes, only inside throwaway containers |
| `attest` | Signs build provenance and the SBOM for each published file | `id-token: write`, `attestations: write` | No |
| `deploy` | Publishes to Pages, only after `attest` succeeds | `pages: write`, `id-token: write` | No |
| `check-live` | Downloads every published file from the live site and verifies it | `contents: read`, `attestations: read` | No |

The job that runs third-party packages cannot sign, and the job that signs runs none, so a malicious dependency cannot get a genuine signature for a file it swapped in.

**The published build.** `npm run build:container` (`scripts/build-in-container.mjs`) builds the commit in a second fresh container that does nothing but install and build, and that output (`dist-container/`) is what gets published. It must be byte-identical to the `dist/` that `verify` checked (`diff -r`, ignoring the unpublished `.vite/` manifest), or nothing deploys. The build is reproducible, so the same commit gives the same files every time.

**Provenance.** `attest` unpacks the exact `artifact.tar` Pages will publish and uses `actions/attest` to sign a [SLSA provenance](https://slsa.dev/provenance/v1) statement listing every file by SHA-256 (hidden files such as `.vite/manifest.json` are never published, so they are not listed), plus a second attestation for the SBOM. Signing is keyless: the action makes a key pair in memory, exchanges the run's GitHub OIDC identity for a Sigstore certificate valid for about ten minutes, signs, records the signature in Sigstore's public transparency log, and discards the key. No signing key is stored anywhere. Attestations are listed at `https://github.com/jklepp/grc/attestations`.

**SBOM.** `npm run sbom` (`scripts/sbom.mjs`) writes `sbom/grc.cdx.json` (CycloneDX, gitignored) with Trivy, in the same locked-down container as the scanners. It includes dev dependencies, because build tools run during the build and could alter it; with them it covers the whole lockfile.

**Verify a file by hand** (needs `gh` 2.49 or later; Ubuntu's packaged `gh` is older, so install it from [cli.github.com](https://cli.github.com)):

```sh
curl -fsSO https://jklepp.github.io/grc/index.html
gh attestation verify index.html --repo jklepp/grc \
  --signer-workflow jklepp/grc/.github/workflows/deploy.yml \
  --source-ref refs/heads/main
```

The two flags require the signature to come from `deploy.yml` building `main`, not just any workflow in the repo. Without a terminal, `gh attestation verify` prints nothing on success; add `--format json` to see the result.

**The live check.** `check-live` runs `scripts/check-live.mjs` against the published bundle: each file is fetched from the live URL, its bytes must equal the build's (retried for up to five minutes while the CDN catches up), and it must pass the same `gh attestation verify`. It reports `N of M live files verified` and fails on any mismatch or on an empty file list. This is detection, not prevention: Pages does not check attestations, so by then the site is live, and a failure turns the run red. Run it by hand with `node scripts/check-live.mjs --site dist --base https://jklepp.github.io/grc/`.

**What this does not prove.** Provenance records which workflow and commit produced a file, and the provenance itself records `runner: self-hosted`. It does not prove the build machine was clean: a compromised runner running the real workflow gets genuine signatures. Dependencies run only in throwaway containers, which keeps them away from the runner's key, but the runner itself (and the container engine on it) is still trusted.

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
| `npm run verify` | All CI stages on this machine; see Local CI |
| `npm run verify:container` | All CI stages as the runner runs them: npm stages in a throwaway container, on `HEAD` |
| `npm run build:container` | Build `HEAD` in a throwaway container into `dist-container/` |
| `npm run scan:secrets` | gitleaks over the full git history |
| `npm run scan:vulns` | Trivy: dependency vulnerabilities and licenses |
| `npm run scan:code` | Semgrep with the rules in `.semgrep/` |
| `npm run sbom` | CycloneDX SBOM of the whole lockfile to `sbom/grc.cdx.json` |

## Status

Prototype / demo. Data represents fictional systems and controls for illustration only.
