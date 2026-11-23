// Static analysis of our own code with Semgrep, using only the rules in
// .semgrep/ (see the header there for what they cover and why).
//
//   node scripts/scan-code.mjs
//
// Rules come from the repo, never from Semgrep's registry: a registry config
// is fetched on every run, can change underneath us, and needs the network.
// Committed rules are reviewed like code, and the scan runs offline.
// --metrics=off: Semgrep otherwise reports usage to its servers.
//
// The exit code alone is not the scan: Semgrep exits 0 when it cannot parse a
// file, having checked only part of it. So the JSON report decides too: any
// error (a file it could not parse, a rule it could not load) fails the scan
// and is named, and so does a scan that read no files at all.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IMAGES, SCANNER_UNAVAILABLE, runScanner } from "./scanners.mjs";

const out = mkdtempSync(join(tmpdir(), "scan-code-"));
let status;
let report = null;
try {
  status = runScanner(IMAGES.semgrep, [
    "semgrep", "scan",
    "--config", "/repo/.semgrep",
    "--metrics=off",
    "--disable-version-check",
    "--error",
    "--quiet",
    "--json-output=/out/semgrep.json",
    "/repo",
  ], { mounts: [`${out}:/out`] });
  try {
    report = JSON.parse(readFileSync(join(out, "semgrep.json"), "utf8"));
  } catch {
    report = null;
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}

if (status === SCANNER_UNAVAILABLE) {
  console.error("\n  semgrep: blocked because the code scan could not run.");
  process.exit(status);
}

const problems = [];
if (!report) {
  problems.push("no readable report, so nothing shows what was scanned");
} else {
  const scanned = report.paths?.scanned ?? [];
  if (!scanned.length) problems.push("no files were scanned; a scan of nothing is not a pass");
  for (const e of report.errors ?? []) {
    const span = e.spans?.[0];
    const where = `${String(e.path ?? "(no path)").replace(/^\/repo\//, "")}${span?.start?.line ? `:${span.start.line}` : ""}`;
    const kind = Array.isArray(e.type) ? e.type[0] : e.type;
    problems.push(`${kind} ${where}: ${String(e.message ?? "").replace(/\s+/g, " ").slice(0, 200)}`);
  }
}

if (problems.length) {
  console.error(`\n  semgrep: the scan did not cover everything:`);
  for (const p of problems) console.error(`    ${p}`);
  process.exit(status || 1);
}
if (status !== 0) {
  console.error("\n  semgrep: findings above. Fix them, or suppress one on its line with a reason (see .semgrep/acme.yaml).");
}
process.exit(status);
