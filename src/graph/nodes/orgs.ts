// Org — who's accountable, as a node instead of a string.
//
// Scoped to the GRAPH layer only — controlImplementations.ts ownership,
// systems.ts roles, risks.ts owners, and findings.ts owners. SOP owners and
// scheduled activities are content, not graph, and stay separate on purpose.
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
// Individuals are Person nodes rather than Team. An Org person is who is ACCOUNTABLE for a
// control, risk or finding; that is not the same question as who is signed in,
// and src/auth keeps the two in separate registers (a signed-in user may claim
// an Org person by id, and most Org people never sign in at all).
// `parentId` on a person is that person's team. It is the same edge the team
// hierarchy uses and answers the same question — walk parents and you have
// everything an org or anyone inside it is accountable for — which is what lets
// a named person inherit what their team owns without a second membership
// relation.
//
// "Product Leadership" is a Business Unit rather than a Team, because
// systems.ts uses it as a Data Owner assignment at the leadership/business
// level, not an operating team.
import type { OrgId } from "../ids";

export const ORG_KINDS = { TEAM: "team", PERSON: "person", BUSINESS_UNIT: "business-unit" } as const;
export type OrgKind = (typeof ORG_KINDS)[keyof typeof ORG_KINDS];

export interface Org {
  id: OrgId;
  name: string;
  kind: OrgKind;
  parentId?: OrgId;
}
