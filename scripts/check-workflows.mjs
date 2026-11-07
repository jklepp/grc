// Every GitHub Actions job must run on our self-hosted runner, never on
// GitHub's hosted (cloud) runners.
//
// This repo is on GitHub Free: hosted runners spend a capped monthly minute
// allowance, and CI built on them gets blocked when it runs out. Self-hosted
// jobs spend none. One `runs-on: ubuntu-latest` would quietly change that, so
// it fails here rather than relying on someone noticing in review.
//
// A job passes only if its runs-on is literally ["self-hosted", "grc"] (in any
// order, extra labels allowed). Anything this script cannot verify fails too:
// an expression like ${{ matrix.os }}, a runner group, or a job that calls a
// reusable workflow (whose runs-on lives in another file).
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const DIR = ".github/workflows";
const REQUIRED = ["self-hosted", "grc"];

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)) : [];
const problems = [];

for (const file of files) {
  const workflow = parse(readFileSync(join(DIR, file), "utf8")) ?? {};
  for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
    const where = `${file}: job "${name}"`;
    if (job.uses) {
      problems.push(`${where} calls a reusable workflow; its runner cannot be checked from here`);
      continue;
    }
    const labels = typeof job["runs-on"] === "string" ? [job["runs-on"]] : job["runs-on"];
    if (!Array.isArray(labels) || labels.some((l) => typeof l !== "string" || l.includes("${{"))) {
      problems.push(`${where} has runs-on ${JSON.stringify(job["runs-on"])}; it must be a plain list of labels`);
    } else if (!REQUIRED.every((l) => labels.includes(l))) {
      problems.push(`${where} runs on [${labels.join(", ")}]; it must include ${REQUIRED.join(" and ")}`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`  FAIL  ${p}`);
  console.error("\n  Jobs must run on the self-hosted runner, never on GitHub's hosted runners.");
  process.exit(1);
}
console.log(`  ok    ${files.length} workflow file(s), every job on [${REQUIRED.join(", ")}]`);
