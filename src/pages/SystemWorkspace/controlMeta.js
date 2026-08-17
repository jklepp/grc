import { Cloud, CheckCircle2, MinusCircle, Circle, ScrollText, Zap, UserCog } from "lucide-react";
import { C } from "../../theme";
import { IMPLEMENTATION_TYPES } from "../../engine";

// Five states, and every one of them is derived from something real. See the
// git history for the reasoning — this matrix moved from "Assessed" as the
// majority answer to "Not in Scope," on purpose: the honest count of controls
// actually looked at out of what's required is uncomfortable by design.
export const STATUS_META = {
  inherited: { label: "Inherited", color: C.green, bg: C.greenBg, Icon: Cloud },
  satisfied: { label: "Satisfied", color: C.accent, bg: C.accentBg, Icon: CheckCircle2 },
  partial: { label: "Partial", color: C.amber, bg: C.amberBg, Icon: MinusCircle },
  deficient: { label: "Deficient", color: C.red, bg: C.redBg, Icon: Circle },
  "not-implemented": { label: "Not Implemented", color: C.red, bg: C.redBg, Icon: Circle },
  unassessed: { label: "Not in Scope", color: C.muted, bg: C.panel2, Icon: ScrollText },
};
export const STATUS_ORDER = ["inherited", "satisfied", "partial", "deficient", "not-implemented", "unassessed"];

// Primary organizing structure for the control matrix — how a control
// actually gets satisfied, not just which domain it's filed under.
export const IMPLEMENTATION_META = [
  { type: IMPLEMENTATION_TYPES.AUTOMATED, Icon: Zap, color: C.accent, bg: C.accentBg, blurb: "Enforced continuously by tooling. Evidence is a system export or scan result, not a person's word." },
  { type: IMPLEMENTATION_TYPES.MANUAL, Icon: UserCog, color: C.amber, bg: C.amberBg, blurb: "Executed by a person on a recurring basis. Needs a named owner and a cadence, or it silently lapses." },
  { type: IMPLEMENTATION_TYPES.PROCESS, Icon: ScrollText, color: C.green, bg: C.greenBg, blurb: "Governed by policy, contract, or documented process. Evidenced by the record, not a system." },
];

// The compliance scale, coloured. Deliberately not assuranceBand's thresholds:
// this is a five-point ordinal rating, not a 0-100 score, and mapping it
// through a score band would imply a precision the rating does not carry.
export function ratingColor(rating) {
  if (rating === 100) return C.green;
  if (rating === 75) return C.accent;
  if (rating === 50) return C.amber;
  if (rating === 25) return C.amber;
  return C.red;
}

export function assetName(system, assetId) {
  return system.assets.find((a) => a.id === assetId)?.name ?? assetId;
}
