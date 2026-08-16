// Control definitions — the universal half of the control model.
//
// A control's definition (what it requires, which domain it belongs to, which
// framework clauses cite it) is the same everywhere it appears. Its
// IMPLEMENTATION is contextual, and lives in edges/controlImplementations.ts.
// Keeping the two apart is the point: "Least Privilege" means one thing, but it
// works very well on the KMS key and poorly on the RAG service, and there is no
// single honest number for "how good is Least Privilege at ACME."
//
// This file owns no data. Every control comes from the real SCF import, and
// every framework clause comes from that import's crosswalk — the same source
// policies.js, procedures.js, and the Unified Compliance Matrix already read.
import scf from "../../data/scfControls.json";
import { categoryForDomain, getImplementationType, getToolHint, type AssuranceCategory, type ImplementationType } from "./taxonomy";
import type { ControlId } from "../ids";

interface ScfControl {
  id: string;
  domain: string;
  name: string;
  description: string;
  frameworks: Record<string, string[]>;
}

export const FRAMEWORKS: string[] = scf.standards;
export const DOMAINS: string[] = scf.domains.map((d) => d.name);

export interface ControlFramework {
  standard: string;
  clauses: string[];
}

export interface Control {
  id: ControlId;
  domain: string;
  name: string;
  description: string;
  frameworks: ControlFramework[];
  category: AssuranceCategory;
  implementationType: ImplementationType;
  toolHint: string | null;
}

export const CONTROLS: Control[] = (scf.controls as ScfControl[]).map((c) => {
  const frameworks = scf.standards
    .map((standard) => ({ standard, clauses: c.frameworks[standard] || [] }))
    .filter((f) => f.clauses.length > 0);
  return {
    id: c.id,
    domain: c.domain,
    name: c.name,
    description: c.description,
    frameworks,
    category: categoryForDomain(c.domain),
    implementationType: getImplementationType(c.domain),
    toolHint: getToolHint(c.domain),
  };
});
