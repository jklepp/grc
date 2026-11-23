// Secret scanning with gitleaks.
//
//   node scripts/scan-secrets.mjs           every commit in the checkout's history
//   node scripts/scan-secrets.mjs --all     every commit on every branch and tag
//   node scripts/scan-secrets.mjs --staged  only what is about to be committed
//
// --staged is the pre-commit hook: it is fast enough to run on every commit
// and stops a secret before it exists in history at all. The full-history scan
// belongs in `npm run verify`, to catch anything committed with --no-verify or
// from a clone without the hook installed. --all is the daily
// secrets-history workflow: branches never opened as a PR, and history
// rescanned when gitleaks' rules change. Once a secret is in history, deleting
// the line does not remove it — rotate the secret.
//
// A history scan refuses a shallow clone: actions/checkout fetches one commit
// by default, and gitleaks then scans that slice and reports it clean. Every
// workflow that runs this checks out with fetch-depth: 0.
import { spawnSync } from "node:child_process";
import { IMAGES, SCANNER_UNAVAILABLE, runScanner } from "./scanners.mjs";

const staged = process.argv.includes("--staged");
const all = process.argv.includes("--all");

if (!staged) {
  const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" });
  if (shallow.status !== 0 || shallow.stdout.trim() !== "false") {
    console.error("  gitleaks: blocked: this is a shallow clone, so most of history is not here to scan.");
    console.error("  Check out with fetch-depth: 0 (or `git fetch --unshallow`).");
    process.exit(1);
  }
}

const mode = staged ? ["--pre-commit", "--staged"] : all ? ["--log-opts=--all"] : [];
const status = runScanner(IMAGES.gitleaks, ["git", ...mode, "--redact", "--no-banner", "/repo"]);

// Fail closed: a scan that could not run blocks the commit like a finding does.
if (status === SCANNER_UNAVAILABLE) {
  console.error("\n  gitleaks: commit blocked because the secret scan could not run.");
} else if (status !== 0) {
  console.error(staged
    ? "\n  gitleaks: commit blocked. Remove the secret from the staged changes."
    : "\n  gitleaks: secrets found in git history. Rotate them; deleting the line is not enough.");
}
process.exit(status);
