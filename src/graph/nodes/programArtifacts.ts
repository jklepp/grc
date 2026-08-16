// Policies and procedures — the company-wide artifacts every implementation
// stands on.
//
// These existed before this file did, in src/data/policies.js and
// src/data/procedures.js, and were read only by the two pages that render them.
// That made them decorative: deleting every policy in the library moved no
// assurance number anywhere in the app, because nothing in graph/ or engine/
// imported either module.
//
// WHY THAT WAS WRONG, IN THE LIBRARY'S OWN WORDS
// -----------------------------------------------
// SOP-01's final step reads: "A Vanta automated test confirms encryption is
// actually active — at rest and in transit — before the asset's Data Protection
// category is marked Managed. A control that's configured but unverified
// doesn't count." The procedure library already stated the gating rule. The
// scoring engine didn't implement it: someone typed maturityStage: "Managed"
// into a category assessment and it scored 100 regardless.
//
// The maturity ladder's bottom two rungs — Policy (20) and Procedure (40) — are
// company-wide facts. There is one encryption policy and one SOP behind it, not
// twenty-six. But the stage encoding them was stored per asset per category and
// asserted 156 times over, checked zero times. engine/implementation.ts now
// derives a CEILING from these artifacts and caps the claim against it.
//
// WHY THE SHAPES ARE THIN
// ------------------------
// The authored records stay in src/data — they carry paragraphs of employee-
// facing prose that has nothing to do with scoring, and migrating them to YAML
// would move thousands of lines to make two fields reachable. The source
// adapter pulls them into GraphFacts instead. What's typed here is only what the
// engine actually reads; the pages keep consuming the richer originals.
import type { ControlId } from "../ids";

// ---- Policy ------------------------------------------------------------------
export interface PolicyRecord {
  id: string;
  code: string;
  title: string;
  // Real SCF control ids. Already hand-authored and already the basis of the
  // Policy Center's framework-clause derivation, so this is a link that was
  // being maintained anyway — it just had no reader in the engine.
  controlIds: ControlId[];
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
// the SOP's own derived controlIds, and that check now runs in graph/validate.ts
// against the assembled graph instead of as a module-load side effect.
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
  // Derived from the SCF crosswalk by domain, never hand-typed.
  controlIds: ControlId[];
  steps: ProcedureStepRecord[];
}
