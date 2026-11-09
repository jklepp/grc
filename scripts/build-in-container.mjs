// Build the site in a fresh, throwaway container instead of on this machine.
//
//   node scripts/build-in-container.mjs [--out <dir>]     (default: dist-container)
//
// Source in, `npm ci --ignore-scripts`, `npm run build` with no network, dist
// out; then the workspace is deleted, pass or fail. The isolation and each
// step are described in container-workspace.mjs.
//
// The build is reproducible: the same commit gives byte-identical files to a
// normal `npm run build`, so this output carries the same attestations.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ENGINE, IMAGES, createWorkspace } from "./container-workspace.mjs";

const outIndex = process.argv.indexOf("--out");
const OUT = outIndex !== -1 ? process.argv[outIndex + 1] : "dist-container";

function countFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((n, entry) => {
    if (entry.name.startsWith(".")) return n;
    return n + (entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1);
  }, 0);
}

const commit = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const dirty = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).stdout.trim();
console.log(`  building commit ${commit} in ${IMAGES.node.split("@")[0]} (${ENGINE})`);
if (dirty) console.log("  note: uncommitted changes are NOT in this build; it builds HEAD as committed.");

let ok = false;
let workspace;
try {
  workspace = createWorkspace();

  console.log("\n  1/4 source in (no network)");
  await workspace.create();

  console.log("\n  2/4 npm ci --ignore-scripts (network on, registry only needed)");
  if (workspace.install().status !== 0) throw new Error("npm ci failed");

  console.log("\n  3/4 npm run build (no network)");
  if (workspace.run("npm run build").status !== 0) throw new Error("the build failed");

  console.log(`\n  4/4 dist out → ${OUT}/`);
  await workspace.copyOut("dist", OUT);

  const files = countFiles(OUT);
  if (files === 0) throw new Error(`no files came out in ${OUT}/`);
  console.log(`\n  build-in-container: ${files} files in ${OUT}/ from commit ${commit.slice(0, 7)}`);
  ok = true;
} catch (error) {
  console.error(`\n  build-in-container: ${error.message}`);
} finally {
  workspace?.remove();
}
process.exit(ok ? 0 : 1);
