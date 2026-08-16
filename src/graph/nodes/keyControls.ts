// Key controls — the subset of the SCF library ACME operates and evidences
// individually, rather than covering at the domain level through a procedure.
//
// This file is the answer to a sizing problem with a real integrity dimension.
// The full crosswalk is 518 controls; 323 are in scope for the standards ACME
// certifies against. Authoring an implementation record for every one of those
// against all 15 assets would mean ~4,800 rows that nobody assessed — the
// machine-generated posture this app has always refused to ship. So the model
// draws an explicit line instead:
//
//   - 26 key controls are implemented and evidenced PER ASSET (or per program,
//     see `scope`), and produce numbers with a "measured" basis.
//   - Every other in-scope control resolves through its domain's assurance
//     category to the asset's category-level assessment, and produces numbers
//     with an "assessed" basis.
//
// Both are honest; they're just different strengths of claim, and the engine
// reports which one you're looking at. engine/rollups.ts also emits
// controlBackedPct per asset, so "how much of this score rests on control-level
// evidence" is itself a visible number rather than an assumption.
//
// The six controls systemRegister.js previously tracked by array index
// (TRACKED_CONTROL_SCF_IDS, paired positionally with a CONTROLS name array)
// are all here, keeping continuity with the figures those pages showed. They're
// marked `legacyTracked` so the migration can be checked rather than trusted.
//
// `scope` matters more than it looks. Some controls are genuinely per-resource
// ("is this bucket encrypted"); others are program-level and asking each asset
// to answer them separately would be theatre ("does ACME run a risk assessment
// process"). Program-scoped controls carry exactly one implementation record
// for the enterprise. Getting this wrong in the other direction — treating a
// program control as per-asset — is how control matrices end up with hundreds
// of duplicate rows that all mean the same thing.
//
// `category` and `domain` are NOT typed here. They're read from the control's
// own SCF definition, so a key control can't claim a category its domain
// doesn't actually map to.
import type { ControlFramework } from "./controls";
import type { AssuranceCategory, ImplementationType } from "./taxonomy";
import type { ControlId } from "../ids";

export const CONTROL_SCOPES = { ASSET: "asset", PROGRAM: "program" } as const;
export type ControlScope = (typeof CONTROL_SCOPES)[keyof typeof CONTROL_SCOPES];

interface KeyControlDef {
  id: ControlId;
  friendlyName: string;
  scope: ControlScope;
  legacyTracked?: boolean;
}


export interface KeyControl extends KeyControlDef {
  domain: string;
  category: AssuranceCategory;
  name: string;
  description: string;
  frameworks: ControlFramework[];
  implementationType: ImplementationType;
  toolHint: string | null;
}
