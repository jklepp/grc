// Build the site in a fresh, throwaway container instead of on this machine.
//
//   node scripts/build-in-container.mjs [--out <dir>]     (default: dist-container)
//
// Why: `npm ci` and `vite build` run third-party code. On the CI runner that
// code would otherwise run as the runner's own user, able to read the runner's
// files, including its registration key. In here it sees only the committed
// source and its own node_modules, and the container is gone afterwards.
//
//   1. source in    `git archive HEAD` streamed in on stdin: only committed
//                   files; no .git, node_modules, dist or anything uncommitted.
//   2. install      `npm ci --ignore-scripts`: network on (to reach the
//                   registry), but no package's install script runs.
//   3. build        `npm run build` with no network at all.
//   4. dist out     a tar of dist/ streamed out on stdout. The container never
//                   gets a writable path onto this machine.
//   A throwaway volume carries files between the steps (network is fixed per
//   container), and is removed at the end, pass or fail.
//
// Every container runs as the image's unprivileged `node` user, with a
// read-only root filesystem, no capabilities and no-new-privileges. The image
// is pinned by digest in scanners.mjs; the engine is CONTAINER_ENGINE (docker
// by default, podman on the runner), as for the scanners.
//
// The build is reproducible: the same commit gives byte-identical files to a
// normal `npm run build`, so this output carries the same attestations.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ENGINE, IMAGES } from "./scanners.mjs";

if (!["docker", "podman"].includes(ENGINE)) {
  console.error(`  build-in-container: unknown CONTAINER_ENGINE "${ENGINE}" (docker or podman).`);
  process.exit(3);
}

const outIndex = process.argv.indexOf("--out");
const OUT = outIndex !== -1 ? process.argv[outIndex + 1] : "dist-container";
const VOLUME = `grc-build-${process.pid}-${Date.now()}`;

// Mounted on the image's /home/node, which already belongs to `node`: both
// engines copy that ownership into a new, empty volume, so `node` can write.
function containerArgs({ network, stdin = false, workdir = "/home/node/build" }) {
  return [
    "run", "--rm",
    ...(stdin ? ["-i"] : []),
    ...(network ? [] : ["--network", "none"]),
    "--user", "node",
    "--read-only", "--tmpfs", "/tmp",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "-v", `${VOLUME}:/home/node`,
    "-w", workdir,
    IMAGES.node,
  ];
}

// Run a command, optionally piping one process's stdout into another's stdin.
function pipe(from, to) {
  return new Promise((resolve) => {
    const a = spawn(from[0], from.slice(1), { stdio: ["ignore", "pipe", "inherit"] });
    const b = spawn(to[0], to.slice(1), { stdio: ["pipe", "inherit", "inherit"] });
    a.stdout.pipe(b.stdin);
    let pending = 2;
    const codes = {};
    const done = (name) => (code) => {
      codes[name] = code;
      if (--pending === 0) resolve(codes.a === 0 && codes.b === 0);
    };
    a.on("close", done("a"));
    b.on("close", done("b"));
    a.on("error", () => resolve(false));
    b.on("error", () => resolve(false));
  });
}

function run(args) {
  return spawnSync(args[0], args.slice(1), { stdio: "inherit" }).status === 0;
}

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
try {
  if (!run([ENGINE, "volume", "create", VOLUME])) throw new Error("could not create the build volume");

  console.log("\n  1/4 source in (no network)");
  ok = await pipe(
    ["git", "archive", "HEAD"],
    [ENGINE, ...containerArgs({ network: false, stdin: true, workdir: "/home/node" }),
      "sh", "-c", "mkdir build && tar -x -C build"],
  );
  if (!ok) throw new Error("copying the source in failed");

  console.log("\n  2/4 npm ci --ignore-scripts (network on, registry only needed)");
  ok = run([ENGINE, ...containerArgs({ network: true }),
    "npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund", "--no-update-notifier"]);
  if (!ok) throw new Error("npm ci failed");

  console.log("\n  3/4 npm run build (no network)");
  ok = run([ENGINE, ...containerArgs({ network: false }), "npm", "run", "build"]);
  if (!ok) throw new Error("the build failed");

  console.log(`\n  4/4 dist out → ${OUT}/`);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  ok = await pipe([ENGINE, ...containerArgs({ network: false }), "tar", "-c", "-C", "dist", "."], ["tar", "-x", "-C", OUT]);
  if (!ok) throw new Error("copying dist out failed");

  const files = countFiles(OUT);
  if (files === 0) throw new Error(`no files came out in ${OUT}/`);
  console.log(`\n  build-in-container: ${files} files in ${OUT}/ from commit ${commit.slice(0, 7)}`);
} catch (error) {
  ok = false;
  console.error(`\n  build-in-container: ${error.message}`);
} finally {
  spawnSync(ENGINE, ["volume", "rm", "--force", VOLUME], { stdio: "ignore" });
}
process.exit(ok ? 0 : 1);
