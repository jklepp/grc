// Security scanners, run as pinned container images in a locked-down container
// (Docker by default, rootless Podman on the CI runner; see ENGINES below).
//
// Pinned by digest, not tag: a tag is a label the publisher (or anyone holding
// their credentials) can move. In March 2026 trivy-action's tags were rewritten
// to point at an infostealer (CVE-2026-33634); a digest is a hash of the image
// itself and cannot be repointed. The tag is kept beside it for humans only —
// when both are given, Docker ignores the tag.
//
// Upgrading a scanner is a deliberate change: let the release age a week or
// more, check it for advisories, then bump tag and digest together.
// `docker buildx imagetools inspect <image>:<tag>` prints the index digest.
//
// Pinning cannot help if we pin a bad release, so every scanner also runs
// isolated: no network, the repo mounted read-only, no Linux capabilities,
// not root, nothing from the host's environment or home directory. A
// compromised scanner should find nothing to steal and no way to send it.
import { spawnSync } from "node:child_process";

export const IMAGES = {
  gitleaks: "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f",
  // Not 0.69.4–0.69.6 (the March 2026 malicious releases). Must stay ≥ 0.71.1:
  // GHSA-mcj4-mphf-j9ff let a crafted database download write anywhere on disk.
  trivy: "ghcr.io/aquasecurity/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c",
  semgrep: "docker.io/semgrep/semgrep:1.182.0@sha256:4a34048c04fef049f71665047f074cffb00cc3d89482f965a5cd151d589237af",
  // Not a scanner: the clean environment scripts/build-in-container.mjs builds
  // the site in. Exact Node version (.nvmrc only says 24), Debian slim, the
  // index digest. Built 2026-10-28 from nodejs/docker-node@80f02a5.
  node: "docker.io/library/node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c",
};

// Returned when the scanner never ran. Distinct from 1, which gitleaks and
// docker both use: without this, "no access to Docker" would read as a finding.
export const SCANNER_UNAVAILABLE = 3;

// Which container engine runs the scanners. Docker by default (Docker Desktop
// on a workstation). The CI runner sets CONTAINER_ENGINE=podman: rootless
// Podman runs each scan as the runner's own user, with no daemon and no
// root-equivalent socket, so a compromised scanner gets that user's files and
// nothing else. Docker Desktop has no rootless mode, and docker-group
// membership is root in all but name.
const ENGINES = {
  docker: {
    probe: ["version", "--format", "{{.Server.Version}}"],
    runArgs: [],
    hint: "Is Docker Desktop running, and is this user in the docker group?",
  },
  podman: {
    probe: ["version", "--format", "{{.Client.Version}}"],
    // Rootless Podman maps the host user to root inside the container, so
    // without keep-id `--user` below names a stranger: git then refuses the
    // repo as "dubious ownership" and gitleaks reports 0 commits scanned,
    // exit 0 — a silent pass. keep-id makes the uid the same on both sides.
    runArgs: ["--userns=keep-id"],
    hint: "Is podman installed for this user (apt install podman uidmap)?",
  },
};
export const ENGINE = process.env.CONTAINER_ENGINE || "docker";

// The defaults are the scan: repo read-only, no network. A step that must
// download (Trivy's database) passes network: true and repo: false, so the one
// container that can reach the internet never sees the code. `mounts` adds
// host directories, e.g. ["/home/me/.cache/x:/cache:ro"].
export function runScanner(image, args, { network = false, repo = true, mounts = [] } = {}) {
  const engine = ENGINES[ENGINE];
  if (!engine) {
    console.error(`  scanner did not run: unknown CONTAINER_ENGINE "${ENGINE}" (docker or podman).`);
    return SCANNER_UNAVAILABLE;
  }
  const probe = spawnSync(ENGINE, engine.probe, { encoding: "utf8" });
  if (probe.status !== 0) {
    console.error(`  scanner did not run: cannot reach ${ENGINE}.`);
    console.error(`  ${(probe.stderr || probe.error?.message || "").trim().split("\n")[0]}`);
    console.error(`  ${engine.hint}`);
    return SCANNER_UNAVAILABLE;
  }

  const result = spawnSync(ENGINE, [
    "run", "--rm",
    ...engine.runArgs,
    ...(network ? [] : ["--network", "none"]),
    "--read-only", "--tmpfs", "/tmp",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", `${process.getuid()}:${process.getgid()}`,
    "-e", "HOME=/tmp",
    ...(repo ? ["-v", `${process.cwd()}:/repo:ro`, "-w", "/repo"] : []),
    ...mounts.flatMap((m) => ["-v", m]),
    image,
    ...args,
  ], { stdio: "inherit" });

  if (result.error) {
    console.error(`  could not run ${ENGINE}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}
