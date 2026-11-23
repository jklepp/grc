// External obligations — security and data terms ACME owes someone outside
// the company (a customer, a regulator, a partner) that are STRICTER than
// ACME's own default for that control.
//
// WHY THIS IS NARROW ON PURPOSE
// -----------------------------
// Every framework ACME certifies against already reaches its controls through
// the common-control crosswalk (controls.ts). Registering each of those
// requirements again as an "obligation" would rebuild the crosswalk by hand and
// leave it to drift. So an obligation here is not "a thing someone requires".
// It is a DIFFERENCE: one parameter on a control ACME already runs, set tighter
// than ACME's default by someone who can hold ACME to it.
//
// That gives the two record types below:
//
//   ControlDefault      ACME's own value for one negotiable parameter on one
//                       control: breach-notice hours, deletion days, residency.
//   ExternalObligation  one outside party's stricter value for that parameter.
//
// A term that matches or is looser than the default is not an entry. It is
// already met by the control, and validate.ts refuses it so the register can't
// fill up with terms that ask nothing new. Contract terms outside security and
// data (liability, audit rights, insurance) belong to Legal, not here.
//
// WHAT IS DERIVED, NOT AUTHORED
// -----------------------------
// - Which systems an obligation reaches: the systems whose assets hold any of
//   its dataTypeIds (assetDataTypes edges). A new system holding customer data
//   comes into scope on its own; nobody has to remember to link it.
// - Whether it is met: each proof is checked against facts the graph already
//   holds (evidence records, tabletop participation). Status is never typed in.
import type { ControlId, DataTypeId, EvidenceId, OrgId } from "../ids";
import type { IrFunction } from "./irExercises";

// "hours" and "days" are clocks: a smaller number is stricter. "text" covers
// parameters that can't be ordered on a scale (where data lives, who holds the
// key), so the obligation has to say in `detail` what it adds.
export const PARAMETER_UNITS = ["hours", "days", "text"] as const;
export type ParameterUnit = (typeof PARAMETER_UNITS)[number];

export function isClockUnit(unit: ParameterUnit): unit is "hours" | "days" {
  return unit === "hours" || unit === "days";
}

export interface ControlDefault {
  id: string;
  controlId: ControlId;
  // The negotiable thing, in a few words: "Customer breach notice".
  parameter: string;
  // What the value measures: "Hours from confirming an incident … to notifying".
  description: string;
  unit: ParameterUnit;
  value: number | string;
  // Where ACME's default is written down — the plan, policy or standard terms
  // that set it.
  source: string;
  // Who decides whether ACME raises the default when several parties ask for
  // more. A security owner, not Legal.
  ownerId: OrgId;
}

export const OBLIGATION_PARTY_KINDS = ["customer", "regulator", "partner"] as const;
export type ObligationPartyKind = (typeof OBLIGATION_PARTY_KINDS)[number];

// One thing that has to be true for the stricter value to be met, and the fact
// that would show it. Exactly one basis per proof:
//
//   evidenceIds       met when every named record is active, passing and fresh
//   tabletopFunction  met when the latest tabletop on every in-scope system is
//                     within cadence and included this function
//
// A proof with neither basis is a claim with nothing behind it, and validate.ts
// refuses it.
export interface ObligationProof {
  title: string;
  evidenceIds?: EvidenceId[];
  tabletopFunction?: IrFunction;
}

export interface ExternalObligation {
  id: string;
  defaultId: string;
  // Who is owed. Demo customers are bracketed placeholders ("[CLIENT D]").
  party: string;
  partyKind: ObligationPartyKind;
  value: number | string;
  // What the term adds beyond the number — "Includes backups and embeddings".
  // Required when the unit is "text".
  detail?: string;
  // Whose data it covers, as data types. This is what scope is derived from.
  dataTypeIds: DataTypeId[];
  // Absent means already in force.
  effectiveAt?: string;
  proof: ObligationProof[];
}
