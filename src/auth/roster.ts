// Who can sign in, and what role they hold.
//
// This is app configuration, not part of the authored dataset. It is
// deliberately NOT a graph fact: src/graph/facts describes ACME's security
// posture, and who holds a login to this tool is not one of those facts. It
// also anticipates where this ends up — once an identity provider is connected,
// people arrive as token claims and this list shrinks to nothing, so putting it
// in the graph now would only be work to undo.
//
// Declared here rather than in a YAML file beside the facts, even though that
// is how facts are authored, because this module is reached from the ENTRY
// chunk: Boot renders Login before the dataset loads. A YAML roster would drag
// the `yaml` parser out of the dataset chunk and into the entry bundle — about
// 110 kB to parse forty lines, undoing a good part of what making the engine
// async bought. scripts/check-roster.mjs loads this module through Vite the
// same way check-validator-fires.mjs loads the graph, so it is still validated
// against orgs.yaml at build time.
//
// WHEN AN IDENTITY PROVIDER ARRIVES: roles come from the token, not from here,
// and this file shrinks to whatever mapping is still needed between a token
// subject and an Org person. Nothing outside src/auth reads it, so that change
// stays inside this directory.
import type { OrgId } from "../graph/ids";

export const ROLES = {
  ADMIN: "admin",
  ASSESSOR: "assessor",
  OWNER: "owner",
  AUDITOR: "auditor",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

// What each role is for, in one place, so the user menu and any future admin
// surface describe them the same way.
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  assessor: "Assessor",
  owner: "System Owner",
  auditor: "Auditor",
};

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  /**
   * Claims an Org row of kind "person" (src/graph/facts/orgs.yaml). One-
   * directional: a signed-in user claims an Org person, never the reverse. It
   * is what resolves the `owner` role — see gates.ts. Absent for someone who
   * owns nothing, which is correct for an assessor or an auditor.
   */
  orgId?: OrgId;
  /**
   * false when the account has been deactivated. Absent means active.
   *
   * Deactivated rather than deleted, because every assessment, review and SOP
   * step this person signed carries their NAME as a string. Removing the row
   * would not orphan those records, but it would leave a name on the register
   * that nothing explains. Someone who has left is inactive, not absent — the
   * same way the app models a dormant identity on any other system.
   */
  active?: boolean;
  /**
   * ISO date this account's access was last recertified. Absent means never.
   * ACME ASSURE asks every other system to recertify privileged access on a
   * cycle (SOP-04); this is the field that lets it answer the same question
   * about its own operators.
   */
  recertifiedAt?: string;
}

/** Active unless explicitly deactivated. */
export function isActive(user: User): boolean {
  return user.active !== false;
}

/**
 * The authored roster. The roster the APP reads is this plus whatever the
 * settings page has changed on top — see rosterStore.ts. Read that one
 * everywhere except here and scripts/check-roster.mjs, which validates the
 * authored rows because it cannot see a browser's local edits.
 */
export const AUTHORED_ROSTER: readonly User[] = [
  {
    id: "u-okafor",
    name: "A. Okafor",
    email: "a.okafor@acme.example",
    roles: ["admin"],
  },
  {
    id: "u-adeyemi",
    name: "M. Adeyemi",
    email: "m.adeyemi@acme.example",
    roles: ["assessor"],
  },
  // Holds both roles on purpose: R. Chen can assess Production AI Platform but
  // is blocked from assessing Workday, which HR Operations owns and they sit
  // under. That is the separation-of-duties rule with a face on it.
  {
    id: "u-chen",
    name: "R. Chen",
    email: "r.chen@acme.example",
    roles: ["assessor", "owner"],
    orgId: "r-chen" as OrgId,
  },
  {
    id: "u-patel",
    name: "S. Patel",
    email: "s.patel@acme.example",
    roles: ["owner"],
    orgId: "s-patel" as OrgId,
  },
  {
    id: "u-nakamura",
    name: "Y. Nakamura",
    email: "y.nakamura@acme.example",
    roles: ["auditor"],
  },
];

export function hasRole(user: User, role: Role): boolean {
  return user.roles.includes(role);
}

// "S. Patel" -> "SP", "R. Chen" -> "RC". Used for the avatar and for the SOP
// execution records, which have always recorded initials rather than a name.
export function initialsOf(user: User): string {
  return user.name
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, "").charAt(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
