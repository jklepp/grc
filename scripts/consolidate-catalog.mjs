import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GROUPS, DOMAIN_ORDER, buildRemap } from "./control-consolidation-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scfPath = path.join(root, "src/data/scfControls.json");
const scf = JSON.parse(fs.readFileSync(scfPath, "utf8"));

const { remap, seenAbsorbed } = buildRemap();

const byId = Object.fromEntries(scf.controls.map((c) => [c.id, c]));
const visible = scf.controls.filter((c) =>
  Object.values(c.frameworks || {}).some((v) => Array.isArray(v) && v.length > 0)
);

const missing = visible.filter((c) => !seenAbsorbed.has(c.id)).map((c) => c.id);
const extra = [...seenAbsorbed].filter((id) => !visible.some((c) => c.id === id));
if (missing.length || extra.length) {
  throw new Error(
    `Merge map coverage error.\nMissing visible: ${missing.join(", ") || "none"}\nAbsorbed but not visible: ${extra.join(", ") || "none"}`
  );
}
if (GROUPS.length !== 100) {
  throw new Error(`Expected 100 survivor groups, got ${GROUPS.length}`);
}
if (DOMAIN_ORDER.length !== 20) {
  throw new Error(`Expected 20 domains, got ${DOMAIN_ORDER.length}`);
}

function unionFrameworks(ids) {
  /** @type {Record<string, Set<string>>} */
  const byStd = {};
  for (const id of ids) {
    const control = byId[id];
    if (!control) throw new Error(`Unknown control ${id}`);
    for (const [std, clauses] of Object.entries(control.frameworks || {})) {
      if (!Array.isArray(clauses) || clauses.length === 0) continue;
      const set = (byStd[std] ||= new Set());
      for (const clause of clauses) set.add(clause);
    }
  }
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const std of scf.standards) {
    const clauses = [...(byStd[std] ?? [])].sort();
    if (clauses.length) out[std] = clauses;
  }
  return out;
}

const survivors = GROUPS.map((group) => {
  const source = byId[group.id];
  if (!source) throw new Error(`Survivor ${group.id} is not in the SCF import`);
  return {
    id: group.id,
    domain: group.domain,
    name: group.name ?? source.name,
    description: source.description,
    frameworks: unionFrameworks(group.absorbs),
  };
});

survivors.sort((a, b) => {
  const da = DOMAIN_ORDER.indexOf(a.domain);
  const db = DOMAIN_ORDER.indexOf(b.domain);
  if (da !== db) return da - db;
  return a.id.localeCompare(b.id);
});

const domains = DOMAIN_ORDER.map((name) => ({
  name,
  total: survivors.filter((c) => c.domain === name).length,
}));

const catalog = {
  standards: scf.standards,
  domains,
  stats: {
    totalControls: survivors.length,
    totalDomains: domains.length,
    noMatchCount: survivors.filter((c) => Object.keys(c.frameworks).length === 0).length,
  },
  controls: survivors,
};

fs.writeFileSync(scfPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${survivors.length} controls across ${domains.length} domains to scfControls.json`);

const CONTROL_ID = /[A-Z]{2,4}-\d+(?:\.\d+)?/g;

function remapQuotedControlIds(text) {
  return text.replace(/"([A-Z]{2,4}-\d+(?:\.\d+)?)"/g, (full, id) => (remap[id] ? `"${remap[id]}"` : full));
}

function dedupeControlIdArrays(text) {
  return text.replace(/\[((?:\s*"[A-Z]{2,4}-\d+"\s*,?\s*)+)\]/g, (full, inner) => {
    const ids = [...inner.matchAll(/"([A-Z]{2,4}-\d+)"/g)].map((m) => m[1]);
    if (ids.length === 0) return full;
    const unique = [...new Set(ids)];
    if (unique.length === ids.length) return full;
    const multiline = full.includes("\n");
    if (!multiline) return `[${unique.map((id) => `"${id}"`).join(",")}]`;
    const indentMatch = full.match(/\n(\s*)"/);
    const indent = indentMatch ? indentMatch[1] : "      ";
    return `[\n${unique.map((id) => `${indent}"${id}"`).join(",\n")},\n${indent.replace(/  $/, "")}]`;
  });
}

function rewriteIdFile(relPath) {
  const abs = path.join(root, relPath);
  const original = fs.readFileSync(abs, "utf8");
  const next = dedupeControlIdArrays(remapQuotedControlIds(original));
  if (next !== original) {
    fs.writeFileSync(abs, next);
    console.log(`Remapped control IDs in ${relPath}`);
  }
}

for (const rel of [
  "src/data/policies.ts",
  "src/data/procedures.ts",
  "src/data/scheduledActivities.ts",
]) {
  rewriteIdFile(rel);
}

function parseConsolidated(text) {
  const start = text.indexOf("export const CONSOLIDATED_CONTROLS");
  const brace = text.indexOf("{", start);
  /** @type {Record<string, { statement: string, requirements: Array<{title: string, detail: string}>, sourceControls: string[], raw: string }>} */
  const entries = {};
  let i = brace + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (text[i] === "}") break;
    const keyMatch = text.slice(i).match(/^"([A-Z]+-\d+)":\s*\{/);
    if (!keyMatch) break;
    const key = keyMatch[1];
    const blockStart = i + keyMatch[0].length - 1;
    let depth = 0;
    let j = blockStart;
    for (; j < text.length; j += 1) {
      if (text[j] === "{") depth += 1;
      else if (text[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    const raw = text.slice(i, j);
    const body = text.slice(blockStart, j);
    const statementMatch = body.match(/statement:\s*\n\s*"([\s\S]*?)",\n\s*requirements:/);
    const reqMatches = [...body.matchAll(/\{ title: "((?:\\.|[^"\\])*)", detail: "((?:\\.|[^"\\])*)" \}/g)];
    const sourceMatch = body.match(/sourceControls:\s*\[([^\]]*)\]/);
    const sourceControls = sourceMatch
      ? [...sourceMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
      : [key];
    entries[key] = {
      statement: statementMatch ? statementMatch[1] : "",
      requirements: reqMatches.map((m) => ({ title: m[1], detail: m[2] })),
      sourceControls,
      raw,
    };
    i = j;
  }
  return { header: text.slice(0, brace + 1), entries };
}

function tsString(value) {
  return JSON.stringify(value);
}

const consPath = path.join(root, "src/data/consolidatedControls.ts");
const consText = fs.readFileSync(consPath, "utf8");
const parsed = parseConsolidated(consText);

/** @type {Record<string, { statement: string, requirements: Array<{title: string, detail: string}>, sourceControls: string[] }>} */
const merged = {};
for (const [id, entry] of Object.entries(parsed.entries)) {
  const survivor = remap[id] ?? (GROUPS.some((g) => g.id === id) ? id : null);
  if (!survivor) continue;
  const bucket = (merged[survivor] ||= {
    statement: "",
    requirements: [],
    sourceControls: [],
  });
  if (id === survivor && entry.statement) bucket.statement = entry.statement;
  else if (!bucket.statement && entry.statement) bucket.statement = entry.statement;
  for (const req of entry.requirements) {
    if (!bucket.requirements.some((r) => r.title === req.title)) bucket.requirements.push(req);
  }
  for (const src of entry.sourceControls) {
    if (!bucket.sourceControls.includes(src)) bucket.sourceControls.push(src);
  }
}

for (const group of GROUPS) {
  const bucket = (merged[group.id] ||= { statement: "", requirements: [], sourceControls: [] });
  for (const id of group.absorbs) {
    if (!bucket.sourceControls.includes(id)) bucket.sourceControls.push(id);
  }
}

const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
const mergedIds = GROUPS.map((g) => g.id).filter((id) => merged[id]?.statement || merged[id]?.requirements.length);
const header = `// Hand-authored, policy-ready control statements that consolidate related SCF
// controls into one business-facing control. sourceControls lists every SCF id
// absorbed into the survivor, including historical sub-controls.
export interface ConsolidatedControl {
  statement: string;
  requirements: Array<{ title: string; detail: string }>;
  sourceControls: string[];
}

export const CONSOLIDATED_CONTROLS: Record<string, ConsolidatedControl> = {`;

const blocks = mergedIds.map((id) => {
  const entry = merged[id];
  const reqs = entry.requirements
    .map((r) => `      { title: ${tsString(r.title)}, detail: ${tsString(r.detail)} }`)
    .join(",\n");
  const sources = entry.sourceControls.map((s) => JSON.stringify(s)).join(", ");
  const statement = entry.statement || `${groupById[id]?.name ?? byId[id]?.name ?? id} is implemented as a single ACME common control covering the absorbed SCF requirements.`;
  return `  ${JSON.stringify(id)}: {
    statement:
      ${tsString(statement)},
    requirements: [
${reqs}
    ],
    sourceControls: [${sources}],
  }`;
});

fs.writeFileSync(consPath, `${header}\n${blocks.join(",\n\n")},\n};\n`);
console.log(`Wrote ${mergedIds.length} consolidated control statements`);

const yamlPath = path.join(root, "src/graph/facts/key-controls.yaml");
let yaml = fs.readFileSync(yamlPath, "utf8");
const domainSubs = [
  ["Artificial Intelligence & Autonomous Technologies", "AI & Autonomous Technologies"],
  ["Data Classification & Handling", "Data Protection"],
  ["Cryptographic Protections", "Data Protection"],
  ["Identification & Authentication", "Identity & Access"],
  ["Capacity & Performance Planning", "Capacity & Performance"],
  ["Business Continuity & Disaster Recovery", "Business Continuity"],
  ["Vulnerability & Patch Management", "Vulnerability Management"],
  ["Continuous Monitoring", "Detection & Monitoring"],
  ["Change Management", "Change & Cloud Security"],
  ["Cloud Security", "Change & Cloud Security"],
  ["Data Privacy", "Privacy"],
  ["Network Security", "Network & Web Security"],
];
for (const [from, to] of domainSubs) {
  yaml = yaml.replaceAll(`domain: "${from}"`, `domain: "${to}"`);
}

const catalogById = Object.fromEntries(survivors.map((c) => [c.id, c]));
yaml = yaml.replace(/- id: "([A-Z]+-\d+)"[\s\S]*?(?=\n- id: |\n?$)/g, (block, id) => {
  const catalogControl = catalogById[id];
  if (!catalogControl) return block;
  let next = block;
  next = next.replace(/\n  name: "[^"]*"/, `\n  name: ${JSON.stringify(catalogControl.name)}`);
  const desc = catalogControl.description.replace(/\s+/g, " ").trim();
  next = next.replace(/\n  description: "[\s\S]*?"(?=\n  frameworks:)/, `\n  description: ${JSON.stringify(desc)}`);
  const fwYaml = Object.entries(catalogControl.frameworks)
    .map(([standard, clauses]) => {
      const clauseLines = clauses.map((c) => `        - ${JSON.stringify(c)}`).join("\n");
      return `    - standard: ${JSON.stringify(standard)}\n      clauses:\n${clauseLines}`;
    })
    .join("\n");
  next = next.replace(/\n  frameworks:\n(?:    - standard:[\s\S]*?)(?=\n  implementationType:)/, `\n  frameworks:\n${fwYaml}\n`);
  return next;
});
fs.writeFileSync(yamlPath, yaml);
console.log("Updated key-controls.yaml domains, names, and framework unions");

const unused = [...consText.matchAll(CONTROL_ID)].map((m) => m[0]);
void unused;
console.log("Remap entries:", Object.keys(remap).length);
