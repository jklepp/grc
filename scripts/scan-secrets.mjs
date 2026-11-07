// Secret scanning with gitleaks.
//
//   node scripts/scan-secrets.mjs           every commit in history
//   node scripts/scan-secrets.mjs --staged  only what is about to be committed
//
// --staged is the pre-commit hook: it is fast enough to run on every commit
// and stops a secret before it exists in history at all. The full-history scan
// belongs in `npm run verify`, to catch anything committed with --no-verify or
// from a clone without the hook installed. Once a secret is in history, deleting
// the line does not remove it — rotate the secret.
import { IMAGES, SCANNER_UNAVAILABLE, runScanner } from "./scanners.mjs";

const staged = process.argv.includes("--staged");
const mode = staged ? ["--pre-commit", "--staged"] : [];

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
