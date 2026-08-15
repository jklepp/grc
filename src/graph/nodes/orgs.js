// Org — who's accountable, as a node instead of a string.
//
// Every "owner" in this app used to be free text: OWNERSHIP kept one
// vocabulary, systems.js's roles[] kept a second, risks.js kept a third —
// three registers that happened to overlap on some names ("IT Security") and
// diverge on others ("IT Security — SOC function" vs. a sibling spelling
// elsewhere) with nothing forcing them to agree, and no way to ask "show me
// everything ML Platform Team owns" without grepping strings.
//
// This file is deliberately scoped to the GRAPH layer only — controlImplementations.js
// ownership, systems.js roles, risks.js owners, and findings.js owners. It does
// NOT touch procedures.js's SOP owners or scheduledActivities.js: those are
// content, not graph (see the canonical-graph-model rearchitecture), and stay
// their own thing on purpose.
//
// DEDUPLICATION, AND WHERE IT STOPS
// ----------------------------------
// Two strings were folded into one team only where they were plainly the same
// team under a different qualifier with no new information in the
// difference: "ML Platform Team (AWS)" is ML Platform Team scoped to AWS
// administration (kept as a `note` on that specific role assignment, not a
// second team), and "ML Eng" in the risk register is read as the same
// engineering group that already owns every asset those risks sit on.
//
// Everywhere else, a distinct qualifier was kept as a distinct team rather
// than collapsed, because collapsing it would destroy real information this
// data is expressing: "IT Security", "IT Security — SOC Function", "IT
// Security (SaaS Administration)", and "Cloud Security" are four different
// functions that happen to sit under the same security org, not four
// spellings of one team. `parentId` records that relationship without
// pretending the functions are interchangeable — "every control IT Security
// or one of its functions owns" is still answerable by walking parents.
//
// Two individuals (systems.js remediation, now findings.js) are User nodes
// rather than Team, because that's what they are — a person, not a function.
// "Product Leadership" is a Business Unit rather than a Team, because
// systems.js uses it as a Data Owner assignment at the leadership/business
// level, not an operating team.
export const ORG_KINDS = { TEAM: "team", USER: "user", BUSINESS_UNIT: "business-unit" };

export const ORGS = [
  { id: "it-security", name: "IT Security", kind: ORG_KINDS.TEAM },
  { id: "it-security-soc", name: "IT Security — SOC Function", kind: ORG_KINDS.TEAM, parentId: "it-security" },
  { id: "it-security-saas-admin", name: "IT Security (SaaS Administration)", kind: ORG_KINDS.TEAM, parentId: "it-security" },
  { id: "cloud-security", name: "Cloud Security", kind: ORG_KINDS.TEAM, parentId: "it-security" },

  { id: "ml-platform-team", name: "ML Platform Team", kind: ORG_KINDS.TEAM },
  { id: "data-platform", name: "Data Platform", kind: ORG_KINDS.TEAM },
  { id: "infrastructure", name: "Infrastructure", kind: ORG_KINDS.TEAM },
  { id: "platform-eng", name: "Platform Eng", kind: ORG_KINDS.TEAM },
  { id: "product-security", name: "Product Security", kind: ORG_KINDS.TEAM },
  { id: "engineering", name: "Engineering", kind: ORG_KINDS.TEAM },
  { id: "secops", name: "SecOps", kind: ORG_KINDS.TEAM },
  { id: "facilities", name: "Facilities", kind: ORG_KINDS.TEAM },
  { id: "hr-operations", name: "HR Operations", kind: ORG_KINDS.TEAM },
  { id: "it", name: "IT", kind: ORG_KINDS.TEAM },
  { id: "grc", name: "GRC", kind: ORG_KINDS.TEAM },

  { id: "product-leadership", name: "Product Leadership", kind: ORG_KINDS.BUSINESS_UNIT },

  { id: "s-patel", name: "S. Patel", kind: ORG_KINDS.USER },
  { id: "r-chen", name: "R. Chen", kind: ORG_KINDS.USER },
];

export const ORG_BY_ID = Object.fromEntries(ORGS.map((o) => [o.id, o]));

// Resolves an id to a display name; falls back to the raw id so a bad
// reference is visible in the UI instead of rendering blank (validate.js is
// what actually catches the bad reference — this is just a display fallback).
export function orgName(id) {
  return ORG_BY_ID[id]?.name ?? id;
}

export function orgNames(ids) {
  return (ids || []).map(orgName).join(" / ");
}
