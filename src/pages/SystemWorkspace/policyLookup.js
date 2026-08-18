import { POLICIES } from "../../data/policies";
import { PROCEDURES } from "../../data/procedures";

// Every visible SCF control belongs to exactly one policy's domain set (verified
// when Policy Center was built — the 307 visible controls split cleanly across
// the 19 policies with zero overlap), so this lookup is always a single hit.
export const POLICY_BY_CONTROL = {};
POLICIES.forEach((p) => p.controlIds.forEach((id) => { POLICY_BY_CONTROL[id] = p; }));

// Same guarantee as POLICY_BY_CONTROL, one level down: every visible control's
// domain belongs to exactly one SOP (see procedures.js's domain partition), so
// this is also always a single hit. Where a step additionally cites the
// control by id (step-level granularity, hand-curated and build-validated —
// see procedures.js), record that step's title too; otherwise the control is
// only covered at the SOP's domain level and `step` stays null.
export const PROCEDURE_BY_CONTROL = {};
PROCEDURES.forEach((p) => p.controlIds.forEach((id) => {
  const step = p.steps.find((s) => (s.controls || []).includes(id));
  PROCEDURE_BY_CONTROL[id] = { procedure: p, step: step?.title ?? null };
}));
