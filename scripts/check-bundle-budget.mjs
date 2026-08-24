// Size gate for the built bundle.
//
// The load work this repo just did is the kind that decays quietly: one static
// import of a route component, or of the PDF path, silently merges two chunks
// and puts a few hundred kilobytes back in front of every session. Nothing in
// the build fails when that happens — the app still works, it is just slower,
// and nobody notices for a release or two.
//
// So the invariants get asserted here, the same way check-validator-fires.mjs
// asserts that the validators still fire. Run after `npm run build`.
//
// The budgets are literals with the measured value beside them. A change that
// legitimately grows one updates the number in the PR, which is the point:
// growth becomes something a reviewer sees rather than something that happens.
import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const MANIFEST = join(DIST, ".vite", "manifest.json");

if (!existsSync(MANIFEST)) {
  console.error(`no ${MANIFEST} — run \`npm run build\` first (needs build.manifest in vite.config.ts)`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const bytes = (file) => statSync(join(DIST, file)).size;

// Everything reachable from the entry by STATIC import. Dynamic imports are
// deliberately not followed: deferring a chunk behind one is exactly how the
// weight below was removed, so counting them would erase the win being guarded.
function staticClosure(startKey) {
  const seen = new Set();
  const walk = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const next of manifest[key]?.imports ?? []) walk(next);
  };
  walk(startKey);
  return [...seen];
}

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entryKey) {
  console.error("no entry in manifest");
  process.exit(1);
}

const entryFile = manifest[entryKey].file;
const entryBytes = bytes(entryFile);

// Two different questions, and the first one alone is not enough.
//
// The ENTRY closure is the login screen: Boot lazy-loads App, so almost
// nothing else is statically reachable from index.html. A regression inside
// App — a route un-lazied, the PDF path re-imported — never touches it. That
// is exactly the mistake this file made first, and it passed a deliberate
// static import of Governance without noticing.
//
// The LANDING closure is what a signed-in user actually downloads to reach
// the dashboard: the entry, plus App, plus the default route, plus the
// dataset. That is the number worth guarding.
const LANDING_ROOTS = [entryKey, "src/App.tsx", "src/pages/Systems.tsx", "src/graph/sources/yaml.ts"];
const missingRoots = LANDING_ROOTS.filter((k) => !manifest[k]);
if (missingRoots.length > 0) {
  console.error(`manifest has no entry for: ${missingRoots.join(", ")}`);
  console.error("If a file moved, update LANDING_ROOTS — a root that silently");
  console.error("vanishes turns this gate into one that cannot fail.");
  process.exit(1);
}

const landing = [...new Set(LANDING_ROOTS.flatMap((k) => staticClosure(k)))];
const jsFiles = landing.map((k) => manifest[k].file).filter((f) => f.endsWith(".js"));
const initialBytes = jsFiles.reduce((sum, f) => sum + bytes(f), 0);

// Measured 2026-08-24, after route splitting and deferring the PDF path.
// Entry is React + react-dom + the login screen, and there is little in it to
// cut; initial is everything the browser must parse before the login form.
const ENTRY_BUDGET = 480_000;    // measured 451,644
const LANDING_BUDGET = 1_850_000; // measured ~1,760,000

// These must stay OUT of the static closure. Each one is a deferral this repo
// made on purpose, and a stray static import is what would undo it.
const MUST_BE_DEFERRED = [
  { name: "jsPDF", re: /jspdf|html2canvas|purify/i },
  { name: "route: Governance", re: /Governance-/ },
  { name: "route: GraphExplorer", re: /GraphExplorer-/ },
  { name: "route: Settings", re: /Settings-/ },
];

const failures = [];

if (entryBytes > ENTRY_BUDGET) {
  failures.push(`entry chunk ${entryBytes.toLocaleString()} B exceeds budget ${ENTRY_BUDGET.toLocaleString()} B (${entryFile})`);
}
if (initialBytes > LANDING_BUDGET) {
  failures.push(`landing JS ${initialBytes.toLocaleString()} B exceeds budget ${LANDING_BUDGET.toLocaleString()} B across ${jsFiles.length} chunk(s)`);
}
for (const { name, re } of MUST_BE_DEFERRED) {
  const leaked = jsFiles.filter((f) => re.test(f));
  if (leaked.length > 0) {
    failures.push(`${name} is in the entry's static import graph again: ${leaked.join(", ")}`);
  }
}

console.log(`entry    ${entryBytes.toLocaleString().padStart(10)} B  (budget ${ENTRY_BUDGET.toLocaleString()})`);
console.log(`landing  ${initialBytes.toLocaleString().padStart(10)} B  (budget ${LANDING_BUDGET.toLocaleString()}, ${jsFiles.length} chunks)`);
for (const { name } of MUST_BE_DEFERRED) console.log(`  deferred: ${name}`);

if (failures.length > 0) {
  console.error("\nbundle budget failed:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\nIf the growth is intended, update the budget in this file so the change is visible in review.");
  process.exit(1);
}

console.log("\nbundle budget ok");
