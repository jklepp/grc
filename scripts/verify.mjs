// The one definition of "CI" for this repo. The pre-push hook and the
// self-hosted runner both run `npm run verify`, so changing what CI checks
// means changing this file and nothing else.
//
// Every stage runs even if an earlier one failed, so one run reports
// everything that is wrong rather than the first thing. A stage's output is
// shown only when it fails. Exit status is non-zero if any stage failed.
//
// This checks the working tree against the installed node_modules. The runner
// does `npm ci` on a fresh checkout first; the hook does not, so locally an
// uncommitted change can make this pass or fail where the runner would not.
import { spawnSync } from "node:child_process";

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
  // Secrets anywhere in history: catches commits made with --no-verify or
  // from a clone without the pre-commit hook.
  ["gitleaks", "node scripts/scan-secrets.mjs"],
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
  results.push({ name, ok, output: `${run.stdout ?? ""}${run.stderr ?? ""}` });
}

const failed = results.filter((r) => !r.ok);
for (const { name, output } of failed) {
  console.log(`\n── ${name} ${"─".repeat(60 - name.length)}\n${output.trimEnd()}`);
}

console.log(failed.length
  ? `\n  verify: ${failed.length} of ${results.length} stages failed`
  : `\n  verify: all ${results.length} stages passed`);
process.exit(failed.length ? 1 : 0);
