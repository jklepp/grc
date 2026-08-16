// An assessor's rating where it differs from the derived one, and why.
//
// Same contract as ImplementationOverride, one level up: the derivation supplies
// the default, a person supplies the exception, and the gap between them is kept
// rather than silently resolved. What the derivation can see is what the facts
// record — a passing test, a current policy, an activity on schedule. What an
// assessor can see includes whether the evidence package was actually adequate,
// which no fact in this graph expresses.
//
// An override whose rating EQUALS the derived rating is dead text and fails the
// build. That is the same rule engine/validateDerivations.ts already applies to
// applicability exceptions: a stated exception that excuses nothing is a note
// somebody wrote and then made obsolete, and leaving it in place lets a reader
// believe a judgment was made where none is operative.
//
// WHY THIS IS A DIFFERENT FILE FROM implementation-overrides.yaml
// ----------------------------------------------------------------
// Different subjects. An implementation override is a statement about one ASSET
// — this bucket's least-privilege posture is worse than its evidence suggests.
// A PRISMA override is a statement about one LEVEL on one SYSTEM — the
// recertification cadence for this control across the boundary is not being
// managed to the standard the calendar implies. Collapsing them would force one
// of the two to lie about its own scope.
import type { ComplianceRating, PrismaLevel } from "../nodes/taxonomy";
import type { ControlId, FindingId, SystemId } from "../ids";

export interface PrismaLevelOverride {
  systemId: SystemId;
  controlId: ControlId;
  level: PrismaLevel;
  rating: ComplianceRating;
  note: string;
  assessedBy: string;
  assessedAt: string;
  findingId?: FindingId;
}
