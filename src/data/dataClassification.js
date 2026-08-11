import { SYSTEMS, controlBreakdown } from "./systemRegister";

// Rolls up the same real system register used by the Data Classification
// Register and System Security Plan pages into the two headline metrics the
// Executive Dashboard shows — required/covered controls across all systems, and
// a foundational-controls readiness rate — so all three pages agree by
// construction rather than needing to be kept in sync by hand.
const totals = SYSTEMS.reduce(
  (acc, sys) => {
    const b = controlBreakdown(sys);
    acc.required += b.required;
    acc.covered += b.inherited + b.satisfied;
    return acc;
  },
  { required: 0, covered: 0 }
);
export const DATA_PROTECTION_PCT = Math.round((totals.covered / totals.required) * 100);

// Operational Readiness: the four foundational checks (encryption at rest/in
// transit, Okta, MFA) tracked per system, rolled up into one compliant rate.
const keyControlChecks = SYSTEMS.flatMap((sys) => [sys.controls[0].status, sys.controls[1].status, sys.oktaEnforced, sys.mfaEnforced]);
export const OPERATIONAL_READINESS_PCT = Math.round(
  (keyControlChecks.filter((s) => s === "compliant").length / keyControlChecks.length) * 100
);
