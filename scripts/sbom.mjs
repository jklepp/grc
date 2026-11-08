// Software Bill of Materials: every npm package in the lockfile, as CycloneDX.
//
//   node scripts/sbom.mjs        → sbom/grc.cdx.json
//
// The deploy workflow signs this file next to the build's provenance, so a
// later advisory ("package X@Y was malicious") can be checked against exactly
// what went into a given deploy, without rebuilding it.
//
// --include-dev-deps: build tools (TypeScript, the Vite plugin, oxlint) never
// ship to visitors, but they run during the build and could alter it, so they
// belong in the list. With them, the SBOM covers the whole lockfile.
//
// Trivy only reads package-lock.json here: no vulnerability database and no
// network. It runs in the same locked-down container as the scanners (see
// scanners.mjs), with one writable mount for the output.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { IMAGES, SCANNER_UNAVAILABLE, runScanner } from "./scanners.mjs";

const OUT_DIR = join(process.cwd(), "sbom");
mkdirSync(OUT_DIR, { recursive: true });

const status = runScanner(IMAGES.trivy, [
  "fs",
  "--quiet",
  "--include-dev-deps",
  "--format", "cyclonedx",
  "--output", "/out/grc.cdx.json",
  "/repo",
], { mounts: [`${OUT_DIR}:/out`] });

if (status === SCANNER_UNAVAILABLE) {
  console.error("\n  sbom: not generated because the container could not run.");
} else if (status !== 0) {
  console.error("\n  sbom: Trivy failed; see its output above.");
}
process.exit(status);
