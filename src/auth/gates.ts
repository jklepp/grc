// What a signed-in user may do.
//
// Named predicates rather than a permission matrix, because there are eight of
// them and each one reads as the sentence it enforces. Everything a gate needs
// is the user, the record, and the org hierarchy — no page passes permissions
// down, and no component decides policy locally.
//
// THE THREE VERDICTS, and why the middle one exists. CONTRACT.md 4.7 forbids a
// silently disabled button, and an auditor looking at forty greyed-out Assess
// buttons is worse than one who simply has none. So a gate distinguishes "your
// role can never do this" (hide it) from "your role can, but this record stops
// you" (show it, disabled, and say why). Only separation of duties produces the
// second kind: an assessor who owns the system expects to be able to grade it,
// and the refusal is the thing worth reading.
import { ORG_BY_ID } from "../engine";
import { ROLES, hasRole } from "./roster";
import type { Role, User } from "./roster";
import type { OrgId } from "../graph/ids";
import type { Finding } from "../graph/nodes/findings";

/**
 * The little a gate needs to know about a system: its name, for the sentence it
 * writes, and who owns it. Structural rather than the full `System`, so both an
 * authored system and the workspace's SystemRollup (which carries a superset of
 * roles[]) satisfy it without a cast.
 */
export interface OwnableSystem {
  name: string;
  roles: readonly { role: string; ownerId: OrgId }[];
}

export type Permission =
  | { verdict: "allowed" }
  | { verdict: "blocked"; reason: string }
  | { verdict: "unavailable" };

const ALLOWED: Permission = { verdict: "allowed" };
const UNAVAILABLE: Permission = { verdict: "unavailable" };
const blocked = (reason: string): Permission => ({ verdict: "blocked", reason });

/** True when the action may proceed. */
export function allows(permission: Permission): boolean {
  return permission.verdict === "allowed";
}

/** True when the action should not be rendered at all. */
export function isHidden(permission: Permission): boolean {
  return permission.verdict === "unavailable";
}

/** The sentence to show beside a disabled action, or null when there is none. */
export function reasonFor(permission: Permission): string | null {
  return permission.verdict === "blocked" ? permission.reason : null;
}

// ---- Ownership resolution -----------------------------------------------------

/**
 * The user's own org plus every org above it. A person's parentId is their team
 * (see graph/nodes/orgs.ts), so someone in ML Platform Team owns what that team
 * owns. Cycle-guarded because parentId is authored data.
 */
function orgAndAncestors(orgId: OrgId | undefined): Set<OrgId> {
  const chain = new Set<OrgId>();
  let next = orgId;
  while (next && !chain.has(next)) {
    chain.add(next);
    next = ORG_BY_ID[next]?.parentId;
  }
  return chain;
}

/** True when the user is, or sits under, the system's System Owner. */
export function ownsSystem(user: User | null, system: OwnableSystem): boolean {
  if (!user?.orgId) return false;
  const chain = orgAndAncestors(user.orgId);
  return system.roles.some((role) => role.role === "System Owner" && chain.has(role.ownerId));
}

/** True when the user is, or sits under, the finding's owner or remediation owner. */
export function ownsFinding(user: User | null, finding: Finding): boolean {
  if (!user?.orgId) return false;
  const chain = orgAndAncestors(user.orgId);
  return chain.has(finding.ownerId) || (!!finding.remediationOwnerId && chain.has(finding.remediationOwnerId));
}

// ---- Gates --------------------------------------------------------------------

const isAdmin = (user: User | null) => !!user && hasRole(user, ROLES.ADMIN);
const isAssessor = (user: User | null) => !!user && hasRole(user, ROLES.ASSESSOR);
const isOwner = (user: User | null) => !!user && hasRole(user, ROLES.OWNER);

export function canCreateSystem(user: User | null): Permission {
  return isAdmin(user) || isAssessor(user) ? ALLOWED : UNAVAILABLE;
}

export function canEditSystem(user: User | null, system: OwnableSystem): Permission {
  if (isAdmin(user) || isAssessor(user)) return ALLOWED;
  if (isOwner(user) && ownsSystem(user, system)) return ALLOWED;
  return UNAVAILABLE;
}

/** Deleting a wizard system, and restoring an edited authored one. */
export function canDeleteSystem(user: User | null): Permission {
  return isAdmin(user) ? ALLOWED : UNAVAILABLE;
}

export function canReviewScope(user: User | null): Permission {
  return isAdmin(user) || isAssessor(user) ? ALLOWED : UNAVAILABLE;
}

/**
 * Grading a control: scoring, PRISMA levels, evidence, the assessment walk.
 *
 * The separation-of-duties rule lives here. An assessor may not grade a system
 * they own, because an assessment signed by the party accountable for the thing
 * assessed is not independent — which is precisely what the evidence review's
 * independence declaration has always claimed and never checked.
 */
export function canAssess(user: User | null, system: OwnableSystem): Permission {
  if (isAdmin(user)) return ALLOWED;
  if (!isAssessor(user)) return UNAVAILABLE;
  if (ownsSystem(user, system)) {
    return blocked(`You are accountable for ${system.name}, so you cannot also assess it.`);
  }
  return ALLOWED;
}

export function canEditFinding(user: User | null, finding: Finding): Permission {
  if (isAdmin(user) || isAssessor(user)) return ALLOWED;
  if (isOwner(user) && ownsFinding(user, finding)) return ALLOWED;
  return UNAVAILABLE;
}

/** Raising a new finding, which has no owner to check yet. */
export function canRaiseFinding(user: User | null): Permission {
  return isAdmin(user) || isAssessor(user) || isOwner(user) ? ALLOWED : UNAVAILABLE;
}

/** Running an SOP and recording its steps. */
export function canRunProcedure(user: User | null): Permission {
  return isAdmin(user) || isAssessor(user) || isOwner(user) ? ALLOWED : UNAVAILABLE;
}

/** The Users settings page: who can sign in, and what they hold. */
export function canManageUsers(user: User | null): Permission {
  return isAdmin(user) ? ALLOWED : UNAVAILABLE;
}

/**
 * Whether an assessment this user signs is independent of the system's
 * accountable party. Derived, not declared: CONTRACT.md 3.1 forbids asking a
 * person to ratify something the app can work out.
 */
export function isIndependentOf(user: User | null, system: OwnableSystem): boolean {
  return !ownsSystem(user, system);
}

// ---- What each role can do, for the page that has to explain it ---------------
//
// This sits beside the predicates rather than in the settings page, because a
// permissions table written where it is displayed drifts from the code that
// enforces it and nothing catches the disagreement. Co-located, a change to a
// gate has its description in the same file, one screen away.
//
// Honest about what this is: a description, not a derivation. It can still
// disagree with the predicate above it — it just cannot do so in a file the
// person changing the predicate never opens.
export interface RoleCapability {
  /** What the user is doing, in the app's own words. */
  act: string;
  /** Roles that may do it. */
  roles: readonly Role[];
  /** A condition the role alone does not settle, when there is one. */
  qualifier?: string;
}

export const ROLE_CAPABILITIES: readonly RoleCapability[] = [
  { act: "Read every page and every number", roles: [ROLES.ADMIN, ROLES.ASSESSOR, ROLES.OWNER, ROLES.AUDITOR] },
  { act: "Add or duplicate a system", roles: [ROLES.ADMIN, ROLES.ASSESSOR] },
  { act: "Edit a system", roles: [ROLES.ADMIN, ROLES.ASSESSOR, ROLES.OWNER], qualifier: "System Owners, only systems they are accountable for" },
  { act: "Delete a system, restore the demo set", roles: [ROLES.ADMIN] },
  { act: "Record scope decisions", roles: [ROLES.ADMIN, ROLES.ASSESSOR] },
  { act: "Assess a control — grade, evidence, PRISMA levels", roles: [ROLES.ADMIN, ROLES.ASSESSOR], qualifier: "not on a system the assessor is accountable for" },
  { act: "Raise a finding", roles: [ROLES.ADMIN, ROLES.ASSESSOR, ROLES.OWNER] },
  { act: "Change a finding", roles: [ROLES.ADMIN, ROLES.ASSESSOR, ROLES.OWNER], qualifier: "System Owners, only their own findings" },
  { act: "Run a procedure", roles: [ROLES.ADMIN, ROLES.ASSESSOR, ROLES.OWNER] },
  { act: "Manage users and roles", roles: [ROLES.ADMIN] },
];
