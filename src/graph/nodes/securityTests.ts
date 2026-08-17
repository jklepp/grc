// Security testing — penetration tests and red-team exercises. The question
// a cockpit should answer isn't "does a pen-test program exist" but "when was
// this system last meaningfully attacked, and what's still open from it."
// Open findings from an exercise route through the widened Finding
// (source: "penetration-test" | "red-team") rather than a duplicate count
// here — this record is the exercise's own metadata.
import type { SystemId } from "../ids";

export const SECURITY_TEST_TYPES = ["penetration-test", "red-team"] as const;
export type SecurityTestType = (typeof SECURITY_TEST_TYPES)[number];

export interface SecurityTestExercise {
  id: string;
  systemId: SystemId;
  type: SecurityTestType;
  vendor: string;
  scope: string;
  completedAt: string;
  // The required re-test interval; the engine derives nextRequiredAt/overdue
  // from this rather than a stored due date that could drift from reality.
  cadenceDays: number;
  criticalFindingCount: number;
  highFindingCount: number;
  // Red-team only — a pen test doesn't have a single pass/fail objective.
  objectiveAchieved?: boolean;
  reportRef: string;
}
