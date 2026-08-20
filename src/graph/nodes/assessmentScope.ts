// What one engagement actually assessed, on one system.
//
// The PRISMA model rates a control against a system boundary across five
// maturity levels. Rating every in-scope common control that way would require
// implementation facts for all of them, and ACME has them for 27 — so the honest
// answer is not to score the rest at zero, it is to say they were not
// assessed. That is also how a real engagement works: a HITRUST r2 assessment
// covers a chosen set of requirement statements, and the CSF has thousands.
//
// WHY THIS IS AUTHORED RATHER THAN DERIVED
// -----------------------------------------
// The control list COULD be derived — "every control with an implementation
// fact on this system" produces exactly these ids today. Three reasons it is
// declared instead:
//
//   1. An assessment has metadata no evidence row carries. Who assessed it,
//      over what period, and why these statements and not others are facts
//      about the engagement, and a coverage figure with no statement of who
//      produced it is precisely the unsourced number this app exists to
//      eliminate.
//   2. A derived scope moves its own denominator. Add one evidence record and
//      the coverage percentage silently changes because the scope grew to
//      include it. Declaring the scope makes expanding it a reviewed act.
//   3. Declared and derived are checked against each other in both directions
//      by engine/validateDerivations.ts. A scoped control with no facts behind
//      it is an empty claim; a control with facts that nobody scoped is either
//      scope creep or evidence filed against the wrong system. Both fail the
//      build, which is what makes hand-listing safe rather than fragile.
//
// This is the same pattern expected-classification.yaml and
// board-material-risks.yaml already use: a curated answer that exists to be
// checked, not to be trusted.
//
// WHAT IS NOT HERE: a list of what was omitted, and why. Omission is the
// default for the ~230 controls per system nobody assessed, and the coverage
// metric reports the count. Writing a reason for each would be several hundred
// rows of invented prose asserting more thought than actually went into them.
import type { ControlId, SystemId } from "../ids";

export interface AssessmentScope {
  systemId: SystemId;
  // The engagement this scope belongs to — what a reader should call it when
  // citing a score that came out of it.
  engagement: string;
  assessor: string;
  // The window the assessment covers. Evidence collected outside it is still
  // scored (freshness already handles age), but the period is what a reader
  // needs to know what "as of" means.
  periodStart: string;
  periodEnd: string;
  // Why these statements. The sampling approach is the part of an assessment
  // most likely to be argued with, so it travels with the scope rather than
  // living in a page's prose where it can drift away from the data.
  samplingRationale: string;
  controlIds: ControlId[];
}
