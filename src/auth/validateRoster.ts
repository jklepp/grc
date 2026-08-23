// The roster's rules, in one place.
//
// These are checked twice, on purpose, and it matters that both checks read the
// same function: scripts/check-roster.mjs runs them over the AUTHORED roster at
// build time, and the Users settings page runs them over the roster as edited
// before it will save. A rule that lived in the script only would let the
// settings page write something the next `npm run check` refuses; a rule that
// lived in the page only would not survive someone editing roster.ts by hand.
//
// Deliberately dependency-free apart from types: the build script loads this
// module through Vite, so anything it imports it must be able to evaluate
// outside a browser.
import { ROLES, isActive } from "./roster";
import type { Role, User } from "./roster";

/** An org row, reduced to what a roster rule needs to know about it. */
export interface OrgLike {
  id: string;
  kind: string;
}

export interface RosterProblem {
  /** The user the problem belongs to, or null for a problem with the set. */
  userId: string | null;
  /** Which field to mark, when the problem belongs to one. */
  field?: "id" | "name" | "email" | "roles" | "orgId";
  message: string;
}

const ROLE_VALUES = Object.values(ROLES) as string[];

/**
 * Every rule the roster has to satisfy. `orgs` is optional: the settings page
 * has the Org register loaded, the build script reads it off orgs.yaml, and a
 * caller that has neither still gets every rule that does not need it.
 */
export function validateRoster(roster: readonly User[], orgs?: readonly OrgLike[]): RosterProblem[] {
  const problems: RosterProblem[] = [];
  const orgById = orgs ? new Map(orgs.map((o) => [o.id, o])) : null;
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const claimed = new Map<string, string>();

  if (roster.length === 0) {
    problems.push({ userId: null, message: "The roster is empty — nobody could sign in." });
  }

  for (const user of roster) {
    const id = user.id ?? "";

    if (!id.trim()) {
      problems.push({ userId: null, field: "id", message: "A user has no id." });
    } else if (seenIds.has(id)) {
      problems.push({ userId: id, field: "id", message: `Duplicate id "${id}".` });
    } else {
      seenIds.add(id);
    }

    if (!user.name?.trim()) {
      problems.push({ userId: id, field: "name", message: "A name is required — it signs every record this user writes." });
    }

    const email = user.email?.trim().toLowerCase() ?? "";
    if (!email) {
      problems.push({ userId: id, field: "email", message: "An email is required — sign-in matches on it." });
    } else if (seenEmails.has(email)) {
      problems.push({ userId: id, field: "email", message: `Another user already signs in with "${user.email.trim()}".` });
    } else {
      seenEmails.add(email);
    }

    if (!Array.isArray(user.roles) || user.roles.length === 0) {
      problems.push({ userId: id, field: "roles", message: "Pick at least one role — signing in would otherwise grant nothing." });
    } else {
      for (const role of user.roles) {
        if (!ROLE_VALUES.includes(role)) {
          problems.push({ userId: id, field: "roles", message: `"${role}" is not a known role (${ROLE_VALUES.join(", ")}).` });
        }
      }
    }

    if (user.orgId !== undefined && String(user.orgId).trim() !== "") {
      const org = orgById?.get(String(user.orgId));
      if (orgById && !org) {
        problems.push({ userId: id, field: "orgId", message: `"${user.orgId}" is not an org in the register.` });
      } else if (org && org.kind !== "person") {
        problems.push({ userId: id, field: "orgId", message: `"${user.orgId}" is a ${org.kind}, and a user may only claim a person.` });
      }

      const already = claimed.get(String(user.orgId));
      if (already && already !== id) {
        problems.push({
          userId: id,
          field: "orgId",
          message: `${already} already claims this person — two logins signing as one accountable party.`,
        });
      } else {
        claimed.set(String(user.orgId), id);
      }
    } else if (user.roles?.includes(ROLES.OWNER)) {
      // An owner with nothing to own holds a role that can never fire.
      problems.push({
        userId: id,
        field: "orgId",
        message: "A System Owner has to claim a person, or it owns nothing.",
      });
    }
  }

  if (!roster.some((u) => isActive(u) && u.roles?.includes(ROLES.ADMIN))) {
    problems.push({ userId: null, message: "No active user holds Admin — the settings page would be unreachable." });
  }

  return problems;
}

/** Problems attached to one user, for a form that marks its own fields. */
export function problemsForUser(problems: readonly RosterProblem[], userId: string): RosterProblem[] {
  return problems.filter((p) => p.userId === userId);
}

/** Every role, in the order the UI lists them. */
export const ALL_ROLES: readonly Role[] = [ROLES.ADMIN, ROLES.ASSESSOR, ROLES.OWNER, ROLES.AUDITOR];
