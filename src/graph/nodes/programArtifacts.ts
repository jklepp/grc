// Policies and procedures — the company-wide artifacts every implementation
// stands on.
//
// The PRISMA Policy and Procedure levels are company-wide facts: one
// encryption policy and one SOP behind it, not one per asset. The engine reads
// these artifacts rather than a per-asset claim.
//
// WHY THE SHAPES ARE THIN
// ------------------------
// The authored records stay in src/data — they carry paragraphs of employee-
// facing prose that has nothing to do with scoring, and migrating them to YAML
// would move thousands of lines to make two fields reachable. The source
// adapter pulls them into GraphFacts instead. What's typed here is only what the
// engine actually reads; the pages keep consuming the richer originals.
import type { ControlId } from "../ids";
import type { EvidenceType } from "./taxonomy";

// ---- Policy ------------------------------------------------------------------
export interface PolicyRecord {
  id: string;
  code: string;
  title: string;
  // Real SCF control ids. Already hand-authored and already the basis of the
  // Policy Center's framework-clause derivation, so this is a link that was
  // being maintained anyway — it just had no reader in the engine.
  controlIds: ControlId[];
  // The SCF domains this policy governs. Hand-authored alongside controlIds,
  // and across the library the two say different things: controlIds is a list
  // of statements this policy names, domains is the area it claims. The 19
  // policies' domains partition all 33 SCF domains with no overlap, so every
  // control has a policy covering its AREA even where none names the control
  // itself — which is the difference between "ACME has no policy on this" and
  // "ACME's policy on this doesn't enumerate it."
  domains: string[];
  // Added so GOV-03 ("Periodic Review & Update") has something to measure. A
  // policy nobody has revisited in three years is weaker support than one
  // reviewed last quarter, for the same reason stale evidence is weaker proof.
  created: string;
  lastReviewed: string;
}

// ACME reviews policies annually — POL-01's own text commits to it, and GOV-03
// is the control that requires it.
export const POLICY_REVIEW_INTERVAL_DAYS = 365;

// ---- Procedure ---------------------------------------------------------------
// A step's `controls` is the hand-curated part: someone judged "this step is
// what satisfies that control." procedures.js validates every cited id against
// the SOP's own derived controlIds, checked in graph/validate.ts.
export interface ProcedureStepRecord {
  title: string;
  controls?: ControlId[];
}

export interface ProcedureRecord {
  id: string;
  code: string;
  title: string;
  category: string;
  domains: string[];
  policyId: string;
  owner: string;
  // Both already authored on all 16 SOPs and, until now, unreachable from the
  // graph. reviewCadence is what separates a living procedure from a filed one:
  // an SOP with an owner and a stated cadence supports a stronger claim than an
  // identical document with neither. evidenceType is the grade of proof the SOP
  // itself expects its steps to produce, which is the floor a sampled
  // implementation is judged against.
  reviewCadence: string;
  evidenceType: EvidenceType;
  // Derived from the SCF crosswalk by domain, never hand-typed.
  controlIds: ControlId[];
  steps: ProcedureStepRecord[];
}
