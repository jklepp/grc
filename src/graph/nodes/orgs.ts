// Org — who's accountable, as a node instead of a string.
//
// Every "owner" in this app used to be free text: OWNERSHIP kept one
// vocabulary, systems.ts's roles[] kept a second, risks.ts kept a third —
// three registers that happened to overlap on some names ("IT Security") and
// diverge on others ("IT Security — SOC function" vs. a sibling spelling
// elsewhere) with nothing forcing them to agree, and no way to ask "show me
// everything ML Platform Team owns" without grepping strings.
//
// This file is deliberately scoped to the GRAPH layer only — controlImplementations.ts
// ownership, systems.ts roles, risks.ts owners, and findings.ts owners. It does
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
// Two individuals (systems.ts remediation, now findings.ts) are User nodes
// rather than Team, because that's what they are — a person, not a function.
// "Product Leadership" is a Business Unit rather than a Team, because
// systems.ts uses it as a Data Owner assignment at the leadership/business
// level, not an operating team.
import type { OrgId } from "../ids";

export const ORG_KINDS = { TEAM: "team", USER: "user", BUSINESS_UNIT: "business-unit" } as const;
export type OrgKind = (typeof ORG_KINDS)[keyof typeof ORG_KINDS];

export interface Org {
  id: OrgId;
  name: string;
  kind: OrgKind;
  parentId?: OrgId;
}
