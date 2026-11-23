// Pulls the HIPAA Security Rule (45 CFR Part 164, Subpart C) from the eCFR API
// and writes it, paragraph by paragraph, to src/data/sourceText/hipaa.json.
//
// The output is the regulation's own text, keyed by the same citations the SCF
// crosswalk uses (e.g. "164.312(a)(2)(iv)"), so a control's HIPAA mapping can
// show what the rule actually says. US federal regulations are public domain,
// which is why this one standard's text is committed to the repo.
//
// Usage: node scripts/fetch-hipaa.mjs [YYYY-MM-DD]
//   With no date, uses the latest eCFR issue date for Title 45.
// Fails if any HIPAA clause in the crosswalk doesn't resolve to a paragraph.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "src/data/sourceText/hipaa.json");
const scf = JSON.parse(fs.readFileSync(path.join(root, "src/data/scfControls.json"), "utf8"));

const API = "https://www.ecfr.gov/api/versioner/v1";

async function get(url) {
  const res = await fetch(url, { headers: { "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function latestIssueDate() {
  const { titles } = JSON.parse(await get(`${API}/titles.json`));
  const t45 = titles.find((t) => t.number === 45);
  if (!t45) throw new Error("eCFR titles.json has no Title 45");
  return t45.latest_issue_date;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);
}
const plain = (s) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// Paragraph levels in the CFR: (a) → (1) → (i) → (A) → (1) in italics.
// A lone roman-looking letter is a roman numeral unless it follows (h).
function levelOf(marker, italic, path) {
  if (/^\d+$/.test(marker)) return italic ? 5 : 2;
  if (/^[A-Z]$/.test(marker)) return 4;
  if (/^[ivx]+$/.test(marker) && !(marker === "i" && path[0] === "h")) return 3;
  if (/^[a-z]$/.test(marker)) return 1;
  throw new Error(`Unrecognized paragraph marker (${marker})`);
}

// Leading run of markers: "(a)(1)(i) ", "$(<I>1</I>) " (eCFR's italic level 5).
const MARKERS = /^\s*((?:\$?\((?:<I>)?[A-Za-z0-9]+(?:<\/I>)?\))+)\s*/;
const ONE_MARKER = /\$?\((<I>)?([A-Za-z0-9]+)(?:<\/I>)?\)/g;
const HEADING = /^<I>([\s\S]*?)<\/I>\s*/;

function parseSection(xml) {
  const n = xml.match(/<DIV8 N="([^"]+)"/)[1];
  const title = plain(xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/)[1]).replace(/^§\s*[\d.]+\s*/, "");
  const intro = [];
  const paragraphs = [];
  let pathParts = [];

  const push = (markers, heading, body) => {
    let first = null;
    for (const { marker, italic } of markers) {
      const level = levelOf(marker, italic, pathParts);
      if (pathParts.length < level - 1) throw new Error(`${n}: (${marker}) has no parent paragraph`);
      pathParts = [...pathParts.slice(0, level - 1), marker];
      const id = n + pathParts.map((m) => `(${m})`).join("");
      const p = { id, level, heading: null, text: "" };
      paragraphs.push(p);
      first ??= p;
    }
    // Heading and text belong to the deepest marker in the run: "(1)(i) <I>Standard…</I> text".
    const target = paragraphs[paragraphs.length - 1];
    target.heading = heading;
    target.text = body;
    return first;
  };

  for (const [, raw] of xml.matchAll(/<P>([\s\S]*?)<\/P>/g)) {
    const m = raw.match(MARKERS);
    if (!m) {
      const text = plain(raw);
      if (paragraphs.length === 0) intro.push(text);
      else paragraphs[paragraphs.length - 1].text += `\n\n${text}`;
      continue;
    }
    const markers = [...m[1].matchAll(ONE_MARKER)].map((x) => ({ marker: x[2], italic: Boolean(x[1]) || m[1].includes("$") }));
    let rest = raw.slice(m[0].length);
    const h = rest.match(HEADING);
    const heading = h ? plain(h[1]) : null;
    if (h) rest = rest.slice(h[0].length);
    // "(b) <I>Flexibility of approach.</I> (1) Covered entities…" or
    // "(2) <I>Implementation specifications (Required)</I>—(i) <I>Business…</I>":
    // a second paragraph starts inline after the heading.
    const afterDash = heading ? rest.replace(/^(?:&#x2014;|—)/, "") : rest;
    const inline = heading ? afterDash.match(MARKERS) : null;
    if (inline) {
      push(markers, heading, "");
      const more = [...inline[1].matchAll(ONE_MARKER)].map((x) => ({ marker: x[2], italic: Boolean(x[1]) }));
      let tail = afterDash.slice(inline[0].length);
      const h2 = tail.match(HEADING);
      if (h2) tail = tail.slice(h2[0].length);
      push(more, h2 ? plain(h2[1]) : null, plain(tail));
    } else {
      push(markers, heading, plain(rest));
    }
  }
  return { id: n, title, intro, paragraphs };
}

const date = process.argv[2] ?? (await latestIssueDate());
const url = `${API}/full/${date}/title-45.xml?part=164&subpart=C`;
const xml = await get(url);
const subpartTitle = plain(xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/)[1]);
const sections = [...xml.matchAll(/<DIV8 [\s\S]*?<\/DIV8>/g)].map(([s]) => parseSection(s));

const known = new Set(sections.flatMap((s) => s.paragraphs.map((p) => p.id)));
const crosswalk = new Set(scf.controls.flatMap((c) => c.frameworks.HIPAA ?? []));
const missing = [...crosswalk].filter((id) => !known.has(id));
if (missing.length) throw new Error(`Crosswalk HIPAA clauses with no paragraph in the fetched text: ${missing.join(", ")}`);
const dupes = sections.flatMap((s) => s.paragraphs.map((p) => p.id)).filter((id, i, all) => all.indexOf(id) !== i);
if (dupes.length) throw new Error(`Duplicate paragraph ids: ${dupes.join(", ")}`);

const out = {
  standard: "HIPAA",
  title: "HIPAA Security Rule",
  citation: "45 CFR Part 164, Subpart C",
  subpart: subpartTitle,
  source: `https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C`,
  asOf: date,
  license: "Public domain (US federal regulation).",
  sections,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outPath)}: ${sections.length} sections, ${known.size} paragraphs, eCFR as of ${date}; all ${crosswalk.size} crosswalk clauses resolve.`);
