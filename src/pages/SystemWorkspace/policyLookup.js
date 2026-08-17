import { POLICIES } from "../../data/policies";

// Every visible SCF control belongs to exactly one policy's domain set (verified
// when Policy Center was built — the 307 visible controls split cleanly across
// the 19 policies with zero overlap), so this lookup is always a single hit.
export const POLICY_BY_CONTROL = {};
POLICIES.forEach((p) => p.controlIds.forEach((id) => { POLICY_BY_CONTROL[id] = p; }));

// Unique policies referenced by a system's control matrix, with how many of its
// controls each one governs — computed from the same governing-policy lookup the
// control drawer uses, not a separately maintained list.
export function getReferencedPolicies(matrix) {
  const counts = new Map();
  matrix.forEach((row) => {
    const policy = POLICY_BY_CONTROL[row.control.id];
    if (!policy) return;
    const existing = counts.get(policy.id);
    counts.set(policy.id, { policy, count: (existing ? existing.count : 0) + 1 });
  });
  return [...counts.values()].sort((a, b) => a.policy.code.localeCompare(b.policy.code));
}
