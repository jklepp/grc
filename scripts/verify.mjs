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
// Two modes:
//   node scripts/verify.mjs              everything on this machine, against the
//                                        working tree and the installed
//                                        node_modules. The pre-push hook.
//   node scripts/verify.mjs --container  the CI runner. Every stage that runs
//                                        npm or code from node_modules runs in a
//                                        throwaway container instead, on the
//                                        committed source with its own
//                                        `npm ci --ignore-scripts`
//                                        (container-workspace.mjs). Only our own
//                                        scanner scripts run here, and they run
//                                        each scanner in its own container. No
//                                        `npm ci` is needed on this machine, so
//                                        no dependency ever runs as the
//                                        runner's user. dist/ is copied out at
//                                        the end.
// Locally an uncommitted change can make the first mode pass or fail where the
// runner would not; the second only ever sees HEAD.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { ENGINE, IMAGES, createWorkspace } from "./container-workspace.mjs";

const LOG_PATH = "logs/verify.log";

// `host`: always runs on this machine (our own script; any third-party tool
// it starts runs in its own locked-down container). Otherwise, with
// --container, the stage runs in the workspace; `network` only for npm's own
// registry checks, never for a stage that loads code from node_modules.
const STAGES = [
  // Types, lint, the validators and the roster: is the code itself correct?
  { name: "check", command: "npm run check" },
  // Known vulnerabilities anywhere in the locked tree, not just direct deps.
  { name: "npm-audit", command: "npm audit", network: true },
  // Trivy: a second vulnerability database, plus licenses. Refreshes its
  // database first when one is due, so this stage needs network access then.
  { name: "trivy", command: "node scripts/scan-vulns.mjs", host: true },
  // Registry signatures and provenance attestations: is each package really
  // what npm published, not something swapped in on the way?
  { name: "signatures", command: "npm audit signatures", network: true },
  // A dependency that gained an install script nobody has reviewed. npm blocks
  // the script; this makes the block visible instead of a warning in a log.
  { name: "install-scripts", command: "npm install-scripts ls" },
  // Every Actions job runs on our self-hosted runner, never GitHub's hosted
  // runners: on GitHub Free those spend a capped minute allowance.
  { name: "workflows", command: "node scripts/check-workflows.mjs" },
  // Secrets anywhere in history: catches commits made with --no-verify or
  // from a clone without the pre-commit hook. Needs .git, so on the host.
  { name: "gitleaks", command: "node scripts/scan-secrets.mjs", host: true },
  // Our own code: dangerous DOM and code-execution calls oxlint can't express.
  { name: "semgrep", command: "node scripts/scan-code.mjs", host: true },
  { name: "build", command: "npm run build" },
  // Runs after build: it reads the manifest the build writes.
  { name: "bundle", command: "npm run check:bundle" },
];

const CONTAINER = process.argv.includes("--container");
const results = [];

function record(name, command, run, started) {
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const ok = run.status === 0;
  console.log(`${ok ? "ok  " : "FAIL"}  ${seconds}s`);
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}${run.error ? run.error.message : ""}`;
  results.push({ name, command, ok, seconds, output });
  return ok;
}

// The workspace is set up as a stage of its own, so a failed install is
// reported like any other failure. If it fails, every container stage fails
// with it; the host stages still run.
let workspace = null;
let workspaceError = null;
if (CONTAINER) {
  process.stdout.write(`  ${"install".padEnd(16)}`);
  const started = Date.now();
  try {
    workspace = createWorkspace();
    await workspace.create();
    const run = workspace.install({ capture: true });
    if (!record("install", "npm ci --ignore-scripts (in container)", run, started)) workspaceError = "npm ci failed";
  } catch (error) {
    workspaceError = error.message;
    record("install", "create the container workspace", { status: 1, stdout: "", stderr: error.message }, started);
  }
}

try {
  for (const { name, command, host, network } of STAGES) {
    process.stdout.write(`  ${name.padEnd(16)}`);
    const started = Date.now();
    if (!CONTAINER || host) {
      record(name, command, spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }), started);
    } else if (workspaceError) {
      record(name, `${command} (in container)`, { status: 1, stderr: `not run: ${workspaceError}` }, started);
    } else {
      record(name, `${command} (in container${network ? ", network on" : ""})`, workspace.run(command, { network, capture: true }), started);
    }
  }

  // dist/ out, so the workflow can compare and publish what verify checked.
  if (workspace && !workspaceError && results.find((r) => r.name === "build")?.ok) {
    process.stdout.write(`  ${"dist-out".padEnd(16)}`);
    const started = Date.now();
    try {
      await workspace.copyOut("dist", "dist");
      record("dist-out", "copy dist/ out of the container", { status: 0 }, started);
    } catch (error) {
      record("dist-out", "copy dist/ out of the container", { status: 1, stderr: error.message }, started);
    }
  }
} finally {
  workspace?.remove();
}

// What was checked, when, and with what: enough to tell two logs apart.
const commit = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim() ?? "unknown";
const header = [
  `verify log`,
  `date:   ${new Date().toISOString()}`,
  `commit: ${commit}`,
  `node:   ${process.version}`,
  `mode:   ${CONTAINER ? `container (${ENGINE}, ${IMAGES.node.split("@")[0]}), committed HEAD only` : "this machine, working tree"}`,
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
