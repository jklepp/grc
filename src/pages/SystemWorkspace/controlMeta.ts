import { Cloud, CheckCircle2, MinusCircle, Circle, ScrollText, Zap, UserCog, Building2, Users, User, Ban, Clock, ShieldCheck, ShieldAlert } from "lucide-react";
import { C } from "../../theme";
import { IMPLEMENTATION_TYPES, RESPONSIBILITIES, STATUS_RANK } from "../../engine";
import type { ComplianceApi } from "../../engine/compliance";
import type { AssetId } from "../../graph/ids";
import type { ComplianceRating } from "../../graph/nodes/taxonomy";
import type { HostingType } from "../../graph/nodes/systems";
import type { WorkspaceSystem } from "./types";

// C's values are reassigned in place by theme.js's applyTheme() on every
// render, but a plain `{ bg: C.panel2 }` literal below would copy today's
// value once, at module import — before the app has even applied its
// default theme — and never again. Every table in this file is read at
// render time across many pages, so route color/bg through live getters
// onto C instead of baking in whatever it held when this module first
// loaded. (theme.js's own CLASS_META hits the same problem and solves it
// the same way, by staying mutated in place rather than copied.)
type ThemeKey = keyof typeof C;

function meta<T extends object>(entry: T, colorKey: ThemeKey, bgKey: ThemeKey): T & { readonly color: string; readonly bg: string } {
  return {
    ...entry,
    get color() { return C[colorKey]; },
    get bg() { return C[bgKey]; },
  };
}

// Five states, and every one of them is derived from something real. See the
// git history for the reasoning — this matrix moved from "Assessed" as the
// majority answer to "Not in Scope," on purpose: the honest count of controls
// actually looked at out of what's required is uncomfortable by design.
export const STATUS_META = {
  inherited: meta({ label: "Inherited", Icon: Cloud }, "green", "greenBg"),
  satisfied: meta({ label: "Satisfied", Icon: CheckCircle2 }, "accent", "accentBg"),
  partial: meta({ label: "Partial", Icon: MinusCircle }, "amber", "amberBg"),
  deficient: meta({ label: "Deficient", Icon: Circle }, "red", "redBg"),
  "not-implemented": meta({ label: "Not Implemented", Icon: Circle }, "red", "redBg"),
  // Was "Not in Scope" — now that Control Applicability reports a real Not
  // Applicable bucket alongside this one, that label would read as the same
  // thing said twice. This status means applicable and unassessed; Not
  // Applicable (APPLICABILITY_META below) means the control was never in play
  // here at all. Different claims, so they need different words.
  unassessed: meta({ label: "Not Assessed", Icon: ScrollText }, "ink", "panel2"),
};
export const STATUS_ORDER = ["inherited", "satisfied", "partial", "deficient", "not-implemented", "unassessed"] as const;
// Re-exported so the table can sort a Status column worst-first without
// re-deriving the ranking engine/compliance.ts already computes it by.
export { STATUS_RANK };

// Who runs the control, independent of the implementation status above — a
// System Owned control and a Vendor Inherited one can carry the same status,
// and conflating the two axes is exactly what made "most controls are out of
// scope" read as true when the honest story was "most controls are someone
// else's job, and that's still ACME's posture."
export const RESPONSIBILITY_META = {
  [RESPONSIBILITIES.INTERNAL]: meta({ label: "System Owned", Icon: User }, "ink", "panel2"),
  [RESPONSIBILITIES.SHARED]: meta({ label: "Shared Responsibility", Icon: Users }, "amber", "amberBg"),
  [RESPONSIBILITIES.ENTERPRISE]: meta({ label: "Enterprise Inherited", Icon: Building2 }, "green", "greenBg"),
  [RESPONSIBILITIES.VENDOR]: meta({ label: "Vendor Inherited", Icon: Cloud }, "accent", "accentBg"),
};

// Applicability, as opposed to implementation status — whether a control was
// ever in play for this system at all. Kept out of STATUS_META on purpose:
// mixing "not applicable" into the same ordinal scale as "deficient" would
// imply a system is worse off for having a control that doesn't apply to it.
export const APPLICABILITY_META = {
  "not-applicable": meta({ label: "Not Applicable", Icon: Ban }, "muted", "panel2"),
  pending: meta({ label: "Pending", Icon: Clock }, "amber", "amberBg"),
};

// A row's evidence, read as one health verdict instead of a pile of per-
// instance flags. Derived entirely from fields the evidence engine already
// scored (stale, coveragePct, result, source) — nothing new is measured here,
// this just buckets what's already on row.instances[].evidence so the table
// can show a single answer to "can I trust this control's proof?"
export const EVIDENCE_HEALTH_META = {
  strong: meta({ label: "Strong", Icon: ShieldCheck }, "green", "greenBg"),
  adequate: meta({ label: "Adequate", Icon: ShieldCheck }, "accent", "accentBg"),
  weak: meta({ label: "Weak", Icon: ShieldAlert }, "amber", "amberBg"),
  stale: meta({ label: "Stale", Icon: Clock }, "amber", "amberBg"),
  missing: meta({ label: "Missing", Icon: Ban }, "red", "redBg"),
};
// Worst-to-best, for the Evidence Health column sort.
export const EVIDENCE_HEALTH_ORDER = ["missing", "stale", "weak", "adequate", "strong"] as const;

export type EvidenceHealthLevel = (typeof EVIDENCE_HEALTH_ORDER)[number];
type ControlMatrixRow = ReturnType<ComplianceApi["systemControlMatrix"]>[number];

export function evidenceHealthForRow(row: ControlMatrixRow) {
  const evidence = (row.instances ?? []).flatMap((i) => i.evidence ?? []);
  if (evidence.length === 0) {
    const level: EvidenceHealthLevel = "missing";
    return { level, ...EVIDENCE_HEALTH_META.missing, detail: null };
  }

  const staleCount = evidence.filter((e) => e.stale).length;
  const failCount = evidence.filter((e) => e.result === "fail").length;
  const sources = new Set(evidence.map((e) => e.source)).size;
  const avgCoverage = evidence.reduce((sum, e) => sum + (e.coveragePct ?? 0), 0) / evidence.length;
  const maxAge = Math.max(...evidence.map((e) => e.ageDays ?? 0));

  let level: EvidenceHealthLevel;
  if (staleCount === evidence.length) level = "stale";
  else if (failCount > 0 || avgCoverage < 50) level = "weak";
  else if (staleCount > 0 || avgCoverage < 80) level = "adequate";
  else level = "strong";

  const detail = level === "stale" ? `${maxAge} days` : `${sources} source${sources === 1 ? "" : "s"}`;
  return { level, ...EVIDENCE_HEALTH_META[level], detail };
}

// Primary organizing structure for the control matrix — how a control
// actually gets satisfied, not just which domain it's filed under.
export const IMPLEMENTATION_META = [
  meta({ type: IMPLEMENTATION_TYPES.AUTOMATED, Icon: Zap, blurb: "Enforced continuously by tooling. Evidence is a system export or scan result, not a person's word." }, "accent", "accentBg"),
  meta({ type: IMPLEMENTATION_TYPES.MANUAL, Icon: UserCog, blurb: "Executed by a person on a recurring basis. Needs a named owner and a cadence, or it silently lapses." }, "amber", "amberBg"),
  meta({ type: IMPLEMENTATION_TYPES.PROCESS, Icon: ScrollText, blurb: "Governed by policy, contract, or documented process. Evidenced by the record, not a system." }, "green", "greenBg"),
];

// The compliance scale, coloured. Deliberately not assuranceBand's thresholds:
// this is a five-point ordinal rating, not a 0-100 score, and mapping it
// through a score band would imply a precision the rating does not carry.
export function ratingColor(rating: ComplianceRating): string {
  if (rating === 100) return C.green;
  if (rating === 75) return C.accent;
  if (rating === 50) return C.amber;
  if (rating === 25) return C.amber;
  return C.red;
}

export function assetName(system: WorkspaceSystem, assetId: AssetId): string {
  return system.assets.find((a) => a.id === assetId)?.name ?? assetId;
}

const HOSTING_TYPE_LABEL: Record<HostingType, string> = { cloud: "Cloud", saas: "SaaS", "on-prem": "On-Prem" };

export function hostingTypeLabel(hostingType: HostingType): string {
  return HOSTING_TYPE_LABEL[hostingType] ?? (hostingType ? hostingType[0].toUpperCase() + hostingType.slice(1) : hostingType);
}
