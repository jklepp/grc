// The one definition of "CI" for this repo. The pre-push hook and the
// self-hosted runner both run `npm run verify`, so changing what CI checks
// means changing this file and nothing else.
//
// Every stage runs even if an earlier one failed, so one run reports
// everything that is wrong rather than the first thing. A stage's output is
// shown only when it fails. Exit status is non-zero if any stage failed.
//
// Every stage's full output, passing or failing, is also written to
// logs/verify.log (gitignored), so a green run still records what each tool
// saw. The terminal stays short; the file is the record.
//
// This checks the working tree against the installed node_modules. The runner
// does `npm ci` on a fresh checkout first; the hook does not, so locally an
// uncommitted change can make this pass or fail where the runner would not.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const LOG_PATH = "logs/verify.log";

const STAGES = [
  // Types, lint, the validators and the roster: is the code itself correct?
  ["check", "npm run check"],
  // Known vulnerabilities anywhere in the locked tree, not just direct deps.
  ["npm-audit", "npm audit"],
  // Trivy: a second vulnerability database, plus licenses. Refreshes its
  // database first when one is due, so this stage needs network access then.
  ["trivy", "node scripts/scan-vulns.mjs"],
  // Registry signatures and provenance attestations: is each package really
  // what npm published, not something swapped in on the way?
  ["signatures", "npm audit signatures"],
  // A dependency that gained an install script nobody has reviewed. npm blocks
  // the script; this makes the block visible instead of a warning in a log.
  ["install-scripts", "npm install-scripts ls"],
  // Every Actions job runs on our self-hosted runner, never GitHub's hosted
  // runners: on GitHub Free those spend a capped minute allowance.
  ["workflows", "node scripts/check-workflows.mjs"],
  // Secrets anywhere in history: catches commits made with --no-verify or
  // from a clone without the pre-commit hook.
  ["gitleaks", "node scripts/scan-secrets.mjs"],
  // Our own code: dangerous DOM and code-execution calls oxlint can't express.
  ["semgrep", "node scripts/scan-code.mjs"],
  ["build", "npm run build"],
  // Runs after build: it reads the manifest the build writes.
  ["bundle", "npm run check:bundle"],
];

const results = [];
for (const [name, command] of STAGES) {
  process.stdout.write(`  ${name.padEnd(16)}`);
  const started = Date.now();
  const run = spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const ok = run.status === 0;
  console.log(`${ok ? "ok  " : "FAIL"}  ${seconds}s`);
  results.push({ name, command, ok, seconds, output: `${run.stdout ?? ""}${run.stderr ?? ""}` });
}

// What was checked, when, and with what: enough to tell two logs apart.
const commit = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim() ?? "unknown";
const header = [
  `verify log`,
  `date:   ${new Date().toISOString()}`,
  `commit: ${commit}`,
  `node:   ${process.version}`,
];
const sections = results.map(({ name, command, ok, seconds, output }) =>
  `\n══ ${name} — ${ok ? "ok" : "FAIL"} — ${seconds}s\n$ ${command}\n${output.trimEnd() || "(no output)"}`);
mkdirSync("logs", { recursive: true });
writeFileSync(LOG_PATH, `${header.join("\n")}\n${sections.join("\n")}\n`);

const failed = results.filter((r) => !r.ok);
for (const { name, output } of failed) {
  console.log(`\n── ${name} ${"─".repeat(60 - name.length)}\n${output.trimEnd()}`);
}

console.log(failed.length
  ? `\n  verify: ${failed.length} of ${results.length} stages failed`
  : `\n  verify: all ${results.length} stages passed`);
console.log(`  full output: ${LOG_PATH}`);
process.exit(failed.length ? 1 : 0);
