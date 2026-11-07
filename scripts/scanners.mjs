// Security scanners, run as pinned Docker images in a locked-down container.
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
};

// Returned when the scanner never ran. Distinct from 1, which gitleaks and
// docker both use: without this, "no access to Docker" would read as a finding.
export const SCANNER_UNAVAILABLE = 3;

export function runScanner(image, args) {
  const probe = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" });
  if (probe.status !== 0) {
    console.error("  scanner did not run: cannot reach Docker.");
    console.error(`  ${(probe.stderr || probe.error?.message || "").trim().split("\n")[0]}`);
    console.error("  Is Docker Desktop running, and is this user in the docker group?");
    return SCANNER_UNAVAILABLE;
  }

  const result = spawnSync("docker", [
    "run", "--rm",
    "--network", "none",
    "--read-only", "--tmpfs", "/tmp",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", `${process.getuid()}:${process.getgid()}`,
    "-e", "HOME=/tmp",
    "-v", `${process.cwd()}:/repo:ro`,
    "-w", "/repo",
    image,
    ...args,
  ], { stdio: "inherit" });

  if (result.error) {
    console.error(`  could not run docker: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}
