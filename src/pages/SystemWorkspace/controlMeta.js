import { Cloud, CheckCircle2, MinusCircle, Circle, ScrollText, Zap, UserCog, Building2, Users, User, Ban, Clock } from "lucide-react";
import { C } from "../../theme";
import { IMPLEMENTATION_TYPES, RESPONSIBILITIES } from "../../engine";

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
  // Was "Not in Scope" — now that Control Applicability reports a real Not
  // Applicable bucket alongside this one, that label would read as the same
  // thing said twice. This status means applicable and unassessed; Not
  // Applicable (APPLICABILITY_META below) means the control was never in play
  // here at all. Different claims, so they need different words.
  unassessed: { label: "Not Assessed", color: C.ink, bg: C.panel2, Icon: ScrollText },
};
export const STATUS_ORDER = ["inherited", "satisfied", "partial", "deficient", "not-implemented", "unassessed"];

// Who runs the control, independent of the implementation status above — a
// System Owned control and a Vendor Inherited one can carry the same status,
// and conflating the two axes is exactly what made "most controls are out of
// scope" read as true when the honest story was "most controls are someone
// else's job, and that's still ACME's posture."
export const RESPONSIBILITY_META = {
  [RESPONSIBILITIES.INTERNAL]: { label: "System Owned", color: C.ink, bg: C.panel2, Icon: User },
  [RESPONSIBILITIES.SHARED]: { label: "Shared Responsibility", color: C.amber, bg: C.amberBg, Icon: Users },
  [RESPONSIBILITIES.ENTERPRISE]: { label: "Enterprise Inherited", color: C.green, bg: C.greenBg, Icon: Building2 },
  [RESPONSIBILITIES.VENDOR]: { label: "Vendor Inherited", color: C.accent, bg: C.accentBg, Icon: Cloud },
};

// Applicability, as opposed to implementation status — whether a control was
// ever in play for this system at all. Kept out of STATUS_META on purpose:
// mixing "not applicable" into the same ordinal scale as "deficient" would
// imply a system is worse off for having a control that doesn't apply to it.
export const APPLICABILITY_META = {
  "not-applicable": { label: "Not Applicable", color: C.muted, bg: C.panel2, Icon: Ban },
  pending: { label: "Pending", color: C.amber, bg: C.amberBg, Icon: Clock },
};

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

const HOSTING_TYPE_LABEL = { cloud: "Cloud", saas: "SaaS", "on-prem": "On-Prem" };

export function hostingTypeLabel(hostingType) {
  return HOSTING_TYPE_LABEL[hostingType] ?? (hostingType ? hostingType[0].toUpperCase() + hostingType.slice(1) : hostingType);
}
