// After a deploy, check the LIVE site the way a visitor sees it.
//
//   node scripts/check-live.mjs --site <dir> --base <url>
//
// <dir> holds the files we meant to publish (the deploy's github-pages bundle,
// unpacked). For each one, this downloads the same path from <url> and checks
// two things:
//   1. the live bytes are the bytes we built (sha256), and
//   2. `gh attestation verify` accepts the live file: signed by deploy.yml,
//      from a build of main.
// Every file must pass, and the run reports how many were checked, so a check
// that silently looked at nothing cannot pass.
//
// Pages sits behind a CDN, so right after a deploy some paths can still serve
// the previous version. A byte mismatch is retried until --wait seconds have
// passed; a file that is still wrong after that is a failure. A failed
// attestation is not retried: the live bytes are already the expected ones,
// so a missing or invalid receipt will not fix itself.
//
// Detection, not prevention: by the time this runs the site is already live.
// A failure turns the deploy run red, which emails the repo owner.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

const REPO = "jklepp/grc";
const SIGNER = `${REPO}/.github/workflows/deploy.yml`;
const REF = "refs/heads/main";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  console.error(`  check-live: missing --${name}`);
  process.exit(2);
}

const site = arg("site");
const base = arg("base").replace(/\/?$/, "/");
const waitSeconds = Number(arg("wait", "300"));

// Hidden files are never published (upload-pages-artifact leaves them out).
function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchLive(path) {
  // A fresh query string asks the CDN for a current copy rather than a cached one.
  const url = `${base}${path}?check=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) return { error: `HTTP ${response.status}` };
  return { bytes: Buffer.from(await response.arrayBuffer()) };
}

const files = listFiles(site).map((full) => relative(site, full).split(sep).join("/")).sort();
if (files.length === 0) {
  console.error(`  check-live: no files found in ${site}; refusing to pass an empty check.`);
  process.exit(1);
}

const download = mkdtempSync(join(tmpdir(), "check-live-"));
const deadline = Date.now() + waitSeconds * 1000;
const failures = [];

console.log(`  checking ${files.length} files at ${base}`);
for (const path of files) {
  const expected = sha256(readFileSync(join(site, path)));
  let live;
  for (;;) {
    live = await fetchLive(path);
    if (live.bytes && sha256(live.bytes) === expected) break;
    if (Date.now() > deadline) break;
    await sleep(10_000);
  }

  if (!live.bytes || sha256(live.bytes) !== expected) {
    failures.push(`${path}: ${live.error ?? "live bytes differ from the build"}`);
    console.log(`  FAIL  ${path}`);
    continue;
  }

  const localCopy = join(download, path.replaceAll("/", "__"));
  writeFileSync(localCopy, live.bytes);
  const verify = spawnSync("gh", [
    "attestation", "verify", localCopy,
    "--repo", REPO, "--signer-workflow", SIGNER, "--source-ref", REF,
    "--format", "json",
  ], { encoding: "utf8" });
  if (verify.status !== 0) {
    const reason = (verify.stderr || verify.error?.message || "").trim().split("\n").pop();
    failures.push(`${path}: attestation not verified (${reason})`);
    console.log(`  FAIL  ${path}`);
    continue;
  }
  console.log(`  ok    ${path}`);
}

const passed = files.length - failures.length;
console.log(`\n  check-live: ${passed} of ${files.length} live files verified`);
if (failures.length) {
  console.log(failures.map((f) => `    ${f}`).join("\n"));
  process.exit(1);
}
