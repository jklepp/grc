// Dependency vulnerabilities and licenses with Trivy.
//
//   node scripts/scan-vulns.mjs
//
// A second opinion to `npm audit`: Trivy merges several advisory sources, so
// each can catch what the other misses. Fails on HIGH and CRITICAL only;
// licenses fail at the same levels (Trivy rates e.g. GPL and AGPL there).
//
// The vulnerability database is not in the image. Aqua publishes it daily, and
// it cannot be pinned without going stale, so it runs in two steps:
//   1. update — network on, repo NOT mounted: fetch the database into a cache.
//   2. scan   — network off, repo and cache read-only.
// The container that touches the internet never sees the code; the one that
// sees the code cannot reach the internet.
//
// A scan against an old database that reports "0 vulnerabilities" is worse
// than no scan, so this fails closed when the database is too old — including
// when the refresh failed because we are offline.
import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { IMAGES, SCANNER_UNAVAILABLE, runScanner } from "./scanners.mjs";

// Per user, outside the repo: the runner's user gets its own copy.
const CACHE = process.env.TRIVY_CACHE_DIR ?? join(homedir(), ".cache", "grc-trivy");
// Built daily; two days allows for one missed build before we refuse.
const MAX_AGE_HOURS = 48;

function readMetadata() {
  try {
    return JSON.parse(readFileSync(join(CACHE, "db", "metadata.json"), "utf8"));
  } catch {
    return null;
  }
}

mkdirSync(CACHE, { recursive: true });

// Trivy's own NextUpdate says when a newer build is due; before then a
// download would fetch the same database again.
const before = readMetadata();
if (!before || Date.now() >= Date.parse(before.NextUpdate)) {
  const status = runScanner(IMAGES.trivy,
    ["--cache-dir", "/cache", "image", "--download-db-only", "--quiet"],
    { network: true, repo: false, mounts: [`${CACHE}:/cache`] });
  if (status === SCANNER_UNAVAILABLE) process.exit(status);
  if (status !== 0) console.error("  trivy: database refresh failed; checking whether the cached copy is still usable.");
}

const meta = readMetadata();
const ageHours = meta ? (Date.now() - Date.parse(meta.UpdatedAt)) / 3_600_000 : Infinity;
if (ageHours > MAX_AGE_HOURS) {
  console.error(meta
    ? `\n  trivy: vulnerability database is ${Math.floor(ageHours)}h old (limit ${MAX_AGE_HOURS}h). Refusing to report a clean scan.`
    : "\n  trivy: no vulnerability database. Run this once with network access.");
  process.exit(1);
}

const status = runScanner(IMAGES.trivy, [
  "--cache-dir", "/cache", "fs",
  "--skip-db-update", "--skip-version-check", "--offline-scan", "--cache-backend", "memory",
  "--scanners", "vuln,license",
  "--severity", "HIGH,CRITICAL",
  "--exit-code", "1",
  "--quiet",
  "/repo",
], { mounts: [`${CACHE}:/cache:ro`] });

if (status === SCANNER_UNAVAILABLE) {
  console.error("\n  trivy: blocked because the vulnerability scan could not run.");
} else if (status !== 0) {
  console.error("\n  trivy: HIGH or CRITICAL findings. Upgrade the package, or record why it is accepted.");
}
process.exit(status);
