// A standard's own text, keyed by the clause citations the SCF crosswalk uses.
//
// The crosswalk (scfControls.json) says which clauses land on a control; this
// says what those clauses actually require, in the standard's own words. Only
// standards whose text is free to republish are here: HIPAA is a federal
// regulation (public domain). PCI DSS and the AICPA Trust Services Criteria
// are licensed text and ISO standards are sold, so their clauses show as
// citations only.
//
// Regenerate data/sourceText/hipaa.json with `node scripts/fetch-hipaa.mjs`.
import hipaa from "../data/sourceText/hipaa.json";
import { CONSOLIDATED_CONTROLS } from "../data/consolidatedControls";
import { REQUIREMENT_CLAUSES } from "../data/requirementClauses";
import { controlLensView } from "./frameworkLens";
import type { Control } from "../graph/nodes/controls";

export interface SourceParagraph {
  /** Full citation, e.g. "164.312(a)(2)(iv)". Matches crosswalk clause ids. */
  id: string;
  /** Depth under the section: (a)=1, (1)=2, (i)=3, (A)=4, italic (1)=5. */
  level: number;
  heading: string | null;
  text: string;
}

export interface SourceSection {
  id: string;
  title: string;
  /** Unnumbered text before the first paragraph (definitions, lead-ins). */
  intro: string[];
  paragraphs: SourceParagraph[];
}

export interface SourceDocument {
  standard: string;
  title: string;
  citation: string;
  source: string;
  asOf: string;
  license: string;
  sections: SourceSection[];
}

export const SOURCE_DOCUMENTS: Record<string, SourceDocument> = {
  HIPAA: hipaa as SourceDocument,
};

export function hasSourceText(standard: string): boolean {
  return standard in SOURCE_DOCUMENTS;
}

/** The marker a paragraph shows in place of its full citation: "(iv)". */
export function paragraphMarker(p: SourceParagraph): string {
  return p.id.match(/\([^)]+\)$/)?.[0] ?? p.id;
}

/** HIPAA labels each paragraph: a Standard, or a Required/Addressable implementation specification. */
export type Designation = "Standard" | "Required" | "Addressable";
export function designation(p: SourceParagraph): Designation | null {
  if (!p.heading) return null;
  if (/^Standard\b/.test(p.heading)) return "Standard";
  if (/\(Required\)/.test(p.heading)) return "Required";
  if (/\(Addressable\)/.test(p.heading)) return "Addressable";
  return null;
}

/** Structural parents ("(a)" of "(a)(1)") carry no words of their own. */
export function isStructural(p: SourceParagraph): boolean {
  return !p.heading && !p.text;
}

const INDEX = new Map<string, Map<string, { section: SourceSection; paragraph: SourceParagraph }>>(
  Object.entries(SOURCE_DOCUMENTS).map(([std, doc]) => [
    std,
    new Map(doc.sections.flatMap((section) => section.paragraphs.map((paragraph) => [paragraph.id, { section, paragraph }] as const))),
  ]),
);

export interface SourceClause {
  section: SourceSection;
  paragraph: SourceParagraph;
  /** Enclosing paragraphs with words of their own, outermost first, for context. */
  ancestors: SourceParagraph[];
}

export function sourceClause(standard: string, clause: string): SourceClause | null {
  const byId = INDEX.get(standard);
  const hit = byId?.get(clause);
  if (!byId || !hit) return null;
  const base = hit.section.id;
  const parts = clause.slice(base.length).match(/\([^)]+\)/g) ?? [];
  const ancestors = parts
    .slice(0, -1)
    .map((_, i) => byId.get(base + parts.slice(0, i + 1).join(""))?.paragraph)
    .filter((p): p is SourceParagraph => Boolean(p) && !isStructural(p!));
  return { ...hit, ancestors };
}

/** Position of every paragraph in its document, so clauses sort in regulation order. */
const ORDER = new Map<string, Map<string, number>>(
  Object.entries(SOURCE_DOCUMENTS).map(([std, doc]) => [
    std,
    new Map(doc.sections.flatMap((s) => s.paragraphs).map((p, i) => [p.id, i] as const)),
  ]),
);

export interface CrossCheckClause {
  clause: string;
  source: SourceClause | null;
  /** Consolidated requirement numbers (1-based) this clause lands on; empty when the control has no itemized requirements. */
  requirements: number[];
}

export interface CrossCheckView {
  standard: string;
  statement: string;
  /**
   * The itemized requirements a lens on `standard` shows (frameworkLens.ts), numbered
   * as everywhere else, so the pane matches the control page under that lens.
   * Empty when the control has none.
   */
  requirements: Array<{ number: number; title: string; detail: string }>;
  /** How many itemized requirements the control has in all; the rest fall outside `standard`. */
  totalRequirements: number;
  /** Every clause of `standard` mapped to the control, in the standard's own order. */
  clauses: CrossCheckClause[];
}

/**
 * One control beside one standard's mapped text: the reading view for checking
 * a common control against its source. Joins the crosswalk, the consolidated
 * requirements, and requirementClauses.ts; derives nothing new.
 */
export function crossCheck(control: Control, standard: string): CrossCheckView {
  const consolidated = CONSOLIDATED_CONTROLS[control.id];
  const lens = controlLensView(control, [standard]);
  const landing = REQUIREMENT_CLAUSES[control.id]?.[standard] ?? {};
  const order = ORDER.get(standard);
  const clauses = (control.frameworks.find((f) => f.standard === standard)?.clauses ?? [])
    .map((clause) => ({ clause, source: sourceClause(standard, clause), requirements: landing[clause] ?? [] }))
    .sort((a, b) => (order?.get(a.clause) ?? Infinity) - (order?.get(b.clause) ?? Infinity));
  return {
    standard,
    statement: consolidated?.statement ?? control.description,
    requirements: lens.shown.map(({ number, title, detail }) => ({ number, title, detail })),
    totalRequirements: lens.total,
    clauses,
  };
}

/** Reverse crosswalk: for one standard, the controls each clause lands on. */
export function controlsByClause(controls: readonly Control[], standard: string): Map<string, Control[]> {
  const out = new Map<string, Control[]>();
  for (const control of controls) {
    for (const clause of control.frameworks.find((f) => f.standard === standard)?.clauses ?? []) {
      const list = out.get(clause) ?? [];
      list.push(control);
      out.set(clause, list);
    }
  }
  return out;
}

/**
 * Every crosswalk clause for a standard with source text must name a real
 * paragraph, and paragraph ids must be unique. Inputs are parameters so the
 * fault-injection harness can hand it broken data.
 */
export function validateSourceText(controls: readonly Control[], documents: Record<string, SourceDocument>): string[] {
  const problems: string[] = [];
  for (const [std, doc] of Object.entries(documents)) {
    const seen = new Set<string>();
    for (const section of doc.sections) {
      for (const p of section.paragraphs) {
        if (seen.has(p.id)) problems.push(`${std} ${p.id}: duplicate paragraph id`);
        seen.add(p.id);
        if (!p.id.startsWith(section.id)) problems.push(`${std} ${p.id}: not under its section ${section.id}`);
      }
    }
    for (const control of controls) {
      for (const clause of control.frameworks.find((f) => f.standard === std)?.clauses ?? []) {
        if (!seen.has(clause)) problems.push(`${control.id} ${std} ${clause}: crosswalk clause with no source text`);
      }
    }
  }
  return problems;
}
