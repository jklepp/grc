import { POLICIES } from "../../data/policies";
import { PROCEDURES } from "../../data/procedures";

// Every in-scope common control is named by exactly one policy's controlIds
// (the 100 catalog controls split across the 17 policies with no ID overlap),
// so this lookup is always a single hit. Domain overlap is allowed — two
// policies may govern the same area — but a given control id is cited once.
export const POLICY_BY_CONTROL: Record<string, (typeof POLICIES)[number] | undefined> = {};
POLICIES.forEach((p) => p.controlIds.forEach((id) => { POLICY_BY_CONTROL[id] = p; }));

// Same guarantee as POLICY_BY_CONTROL, one level down: every visible control's
// domain belongs to exactly one SOP (see procedures.js's domain partition), so
// this is also always a single hit. Where a step additionally cites the
// control by id (step-level granularity, hand-curated and build-validated —
// see procedures.js), record that step's title too; otherwise the control is
// only covered at the SOP's domain level and `step` stays null.
export const PROCEDURE_BY_CONTROL: Record<string, { procedure: (typeof PROCEDURES)[number]; step: string | null } | undefined> = {};
PROCEDURES.forEach((p) => p.controlIds.forEach((id) => {
  const step = p.steps.find((s) => (s.controls || []).includes(id));
  PROCEDURE_BY_CONTROL[id] = { procedure: p, step: step?.title ?? null };
}));
