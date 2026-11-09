// A throwaway workspace for running the project's own npm code in a container
// instead of on this machine. Used by build-in-container.mjs and, with
// --container, by verify.mjs.
//
// Why: `npm ci`, the build and the checks run third-party code. On the CI
// runner that code would otherwise run as the runner's own user, able to read
// the runner's files, including its registration key. In here it sees only
// the committed source and its own node_modules, and it is all gone afterwards.
//
//   create()      a fresh volume, and the committed source in: `git archive
//                 HEAD` streamed in on stdin, so no .git, node_modules, dist or
//                 anything uncommitted.
//   install()     `npm ci --ignore-scripts`: network on (to reach the
//                 registry), but no package's install script runs.
//   run(cmd)      a command in the source tree. No network unless asked for;
//                 only npm's own commands (audit, signatures) ask for it, never
//                 one that loads code from node_modules.
//   copyOut()     a directory out as a tar on stdout. The container never gets
//                 a writable path onto this machine.
//   remove()      deletes the volume; call it in a finally.
//   The volume carries files between steps (network is fixed per container).
//
// Every container runs as the image's unprivileged `node` user, with a
// read-only root filesystem, no capabilities and no-new-privileges. The image
// is pinned by digest in scanners.mjs; the engine is CONTAINER_ENGINE (docker
// by default, podman on the runner), as for the scanners.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { ENGINE, IMAGES } from "./scanners.mjs";

export { ENGINE, IMAGES };

// Run one process's stdout into another's stdin; true if both exit 0.
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

export function createWorkspace() {
  if (!["docker", "podman"].includes(ENGINE)) {
    throw new Error(`unknown CONTAINER_ENGINE "${ENGINE}" (docker or podman)`);
  }
  const volume = `grc-build-${process.pid}-${Date.now()}`;

  // Mounted on the image's /home/node, which already belongs to `node`: both
  // engines copy that ownership into a new, empty volume, so `node` can write.
  const containerArgs = ({ network = false, stdin = false, workdir = "/home/node/build" } = {}) => [
    "run", "--rm",
    ...(stdin ? ["-i"] : []),
    ...(network ? [] : ["--network", "none"]),
    "--user", "node",
    "--read-only", "--tmpfs", "/tmp",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "-v", `${volume}:/home/node`,
    "-w", workdir,
    IMAGES.node,
  ];

  return {
    volume,

    async create() {
      if (spawnSync(ENGINE, ["volume", "create", volume], { stdio: "ignore" }).status !== 0) {
        throw new Error(`could not create volume ${volume} with ${ENGINE}`);
      }
      const ok = await pipe(
        ["git", "archive", "HEAD"],
        [ENGINE, ...containerArgs({ stdin: true, workdir: "/home/node" }), "sh", "-c", "mkdir build && tar -x -C build"],
      );
      if (!ok) throw new Error("copying the source in failed");
    },

    // `capture: true` returns the output instead of printing it.
    run(command, { network = false, capture = false } = {}) {
      return spawnSync(ENGINE, [...containerArgs({ network }), "sh", "-c", command],
        capture
          ? { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
          : { stdio: "inherit" });
    },

    install(options) {
      return this.run("npm ci --ignore-scripts --no-audit --no-fund --no-update-notifier", { network: true, ...options });
    },

    // Replaces `dest` on this machine with the workspace's `dir`.
    async copyOut(dir, dest) {
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dest, { recursive: true });
      const ok = await pipe([ENGINE, ...containerArgs(), "tar", "-c", "-C", dir, "."], ["tar", "-x", "-C", dest]);
      if (!ok) throw new Error(`copying ${dir}/ out failed`);
    },

    remove() {
      spawnSync(ENGINE, ["volume", "rm", "--force", volume], { stdio: "ignore" });
    },
  };
}
