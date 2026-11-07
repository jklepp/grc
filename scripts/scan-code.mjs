// Static analysis of our own code with Semgrep, using only the rules in
// .semgrep/ (see the header there for what they cover and why).
//
//   node scripts/scan-code.mjs
//
// Rules come from the repo, never from Semgrep's registry: a registry config
// is fetched on every run, can change underneath us, and needs the network.
// Committed rules are reviewed like code, and the scan runs offline.
// --metrics=off: Semgrep otherwise reports usage to its servers.
import { IMAGES, SCANNER_UNAVAILABLE, runScanner } from "./scanners.mjs";

const status = runScanner(IMAGES.semgrep, [
  "semgrep", "scan",
  "--config", "/repo/.semgrep",
  "--metrics=off",
  "--disable-version-check",
  "--error",
  "--quiet",
  "/repo",
]);

if (status === SCANNER_UNAVAILABLE) {
  console.error("\n  semgrep: blocked because the code scan could not run.");
} else if (status !== 0) {
  console.error("\n  semgrep: findings above. Fix them, or suppress one on its line with a reason (see .semgrep/acme.yaml).");
}
process.exit(status);
