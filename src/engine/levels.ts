// The five PRISMA level rules. One control, one system, five ratings.
//
// This is the heart of the model and the part most likely to be argued with, so
// it is isolated: pure functions, no factory, no Graph. Each rule takes exactly
// the facts it needs and returns a LevelRating carrying both the rating and the
// sentence justifying it. Nothing here reaches for anything it was not handed.
//
// WHAT EACH LEVEL ASKS
// ---------------------
//   Policy       does ACME require this, in writing, currently
//   Procedure    has anyone been told how to do it
//   Implemented  is it actually in place, across everything it applies to
//   Measured     is its operation being measured
//   Managed      does somebody act on what is measured, on a cadence
//
// The distinction between Implemented and Measured is the one most easily lost.
// Measured does NOT ask whether the measurement passed — that is Implemented's
// job, and conflating them charges a failing control twice for one failure. A
// control can be badly implemented and well measured; that combination is
// informative, and a model that cannot express it is hiding something.
//
// ON THE LADDER
// --------------
// Literal HITRUST does not cap a level at the level below it, and these rules
// do not either. The five are rated independently and summed by weight. Where a
// level nonetheless rates above its predecessor the assessment reports it as a
// ladder inversion rather than silently clamping it — see engine/assessment.ts.
// The one exception is named MANAGED_REQUIRES_MEASUREMENT below, and argued for
// where it is used rather than buried in a constant.
import type { ControlId } from "../graph/ids";
import type { PolicyRecord, ProcedureRecord } from "../graph/nodes/programArtifacts";
import type { ProviderCertification } from "../graph/nodes/providerCertifications";
import type { ScheduledActivityRecord } from "../graph/nodes/scheduledActivities";
import type { Basis, ComplianceRating, PrismaLevel } from "../graph/nodes/taxonomy";
import { BASIS, COMPLIANCE_LABELS } from "../graph/nodes/taxonomy";
import {
  PRISMA_LEVEL_WEIGHTS, complianceForConfidence, evidenceBaseConfidence, meetsEvidence, nearestRating,
} from "./assurance";
import { VERIFYING_EVIDENCE_FLOOR, type ScoredEvidence } from "./evidence";

export interface LevelRating {
  level: PrismaLevel;
  // What the rule concluded from the facts, before any assessor override.
  derived: ComplianceRating;
  // What actually scores. Equal to `derived` unless an override displaced it.
  rating: ComplianceRating;
  weight: number;
  // weight x rating, unrounded. Summing these gives the control score.
  contribution: number;
  basis: Basis;
  // The sentence a reviewer needs, naming the facts the rule stood on.
  rationale: string;
}

export function rate(
  level: PrismaLevel,
  derived: ComplianceRating,
  basis: Basis,
  rationale: string
): LevelRating {
  const weight = PRISMA_LEVEL_WEIGHTS[level];
  return { level, derived, rating: derived, weight, contribution: weight * derived, basis, rationale };
}

export function label(rating: ComplianceRating): string {
  return COMPLIANCE_LABELS[rating];
}

// "Annual" is the cadence's name; "annually" is how a sentence says it. Mapped
// rather than suffixed, because "Monthly" + "ly" is not a word.
const CADENCE_ADVERB: Record<string, string> = { Monthly: "monthly", Quarterly: "quarterly", Annual: "annually" };
const cadence = (frequency: string) => CADENCE_ADVERB[frequency] ?? frequency.toLowerCase();

// ---- Level 1: Policy (15%) ------------------------------------------------------
// Reads the policy library two ways. A policy naming the control by id is the
// strong form; a policy claiming the control's DOMAIN is the weak one.
//
// The weak form matters because the alternative is worse. Fourteen of the
// sixteen controls no policy names by id are AI controls, and rating them zero
// would assert ACME has no written position on AI governance when POL-19 exists
// and claims that whole area. The gap is specificity, not existence, and the
// two deserve different numbers.
//
// A stale policy holds the bottom rung rather than losing it — the same
// reasoning STALE_FLOOR encodes for evidence. It was true once; nobody has
// confirmed it since.
export function ratePolicy(args: {
  controlId: ControlId;
  citing: readonly PolicyRecord[];
  stale: readonly PolicyRecord[];
  domainPolicies: readonly PolicyRecord[];
  domain: string;
}): LevelRating {
  const { controlId, citing, stale, domainPolicies, domain } = args;
  const codes = (ps: readonly PolicyRecord[]) => ps.map((p) => p.code).join(", ");
  const one = citing.length === 1;

  if (citing.length > 0) {
    const verb = one ? "requires" : "require";
    if (stale.length === 0) {
      return rate("Policy", 100, BASIS.MEASURED, `${codes(citing)} ${verb} ${controlId} by name, and ${one ? "it is" : "every one is"} inside its review interval.`);
    }
    if (stale.length === citing.length) {
      return rate("Policy", 25, BASIS.MEASURED, `${codes(citing)} ${verb} ${controlId} by name, but ${one ? "it is" : "every one is"} past its review interval — the requirement stands, its maintenance does not.`);
    }
    return rate("Policy", 75, BASIS.MEASURED, `${codes(citing)} ${verb} ${controlId} by name; ${codes(stale)} ${stale.length === 1 ? "is" : "are"} past review.`);
  }

  if (domainPolicies.length > 0) {
    return rate("Policy", 50, BASIS.ASSESSED, `No policy names ${controlId}, but ${codes(domainPolicies)} governs "${domain}" — the area is covered, this requirement is not enumerated.`);
  }

  // Unreachable while policy domains partition every SCF domain, which
  // graph/validate.ts enforces. Kept because the enforcement is the reason it
  // is unreachable, and a rule that relies on a check should say so.
  return rate("Policy", 0, BASIS.UNASSESSED, `Nothing in the policy library names ${controlId} or claims "${domain}".`);
}

// ---- Level 2: Procedure (20%) ---------------------------------------------------
// Same two-tier shape, over SOPs. A step citing the control is somebody being
// told what to do about this specific requirement; an SOP owning the domain is
// a claim about the area. procedures.js already draws exactly this distinction
// and calls the difference `uncitedControlIds`; here it finally scores.
//
// The 100/75 split is owner-and-cadence. A procedure with neither is a document
// somebody wrote; with both it is a thing that happens.
export function rateProcedure(args: {
  controlId: ControlId;
  citingSteps: readonly { procedure: ProcedureRecord; stepTitle: string }[];
  owningProcedure: ProcedureRecord | null;
  domain: string;
}): LevelRating {
  const { controlId, citingSteps, owningProcedure, domain } = args;

  if (citingSteps.length > 0) {
    const first = citingSteps[0];
    const sop = first.procedure;
    const hasOwner = sop.owner.trim().length > 0;
    const hasCadence = sop.reviewCadence.trim().length > 0;
    if (hasOwner && hasCadence) {
      return rate("Procedure", 100, BASIS.MEASURED, `${sop.code} step "${first.stepTitle}" covers ${controlId}; owned by ${sop.owner}, ${lowerFirst(sop.reviewCadence)}.`);
    }
    return rate("Procedure", 75, BASIS.MEASURED, `${sop.code} step "${first.stepTitle}" covers ${controlId}, but the SOP names ${hasOwner ? "no review cadence" : "no owner"}.`);
  }

  if (owningProcedure) {
    return rate("Procedure", 50, BASIS.ASSESSED, `${owningProcedure.code} owns "${domain}" but no step cites ${controlId} — the area has a procedure, this requirement has no written step.`);
  }

  return rate("Procedure", 0, BASIS.UNASSESSED, `No SOP covers ${controlId}, and none claims "${domain}".`);
}

// reviewCadence is authored as a sentence ("Reviewed annually, or whenever a new
// data store is provisioned"), so only the first letter is lowered — a blanket
// toLowerCase would flatten the proper nouns inside it.
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// ---- Level 3: Implemented (40%) -------------------------------------------------
// The only level that samples. Every asset the control applies to in this
// boundary is one instance; the rating is the share of them that hold it.
//
// Partial credit is deliberate and sits at a half. Evidence that is stale, or
// below the grade at which ACME can verify anything itself, or that only looked
// at part of the population, is not nothing and is not proof. Rounding it to
// either would lose the distinction the whole evidence model exists to make.
export const INSTANCE_CREDIT = { implemented: 1, partial: 0.5, "not-implemented": 0, undetermined: 0 } as const;

export function rateImplemented(args: {
  controlId: ControlId;
  credit: number;
  population: number;
  implemented: number;
  partial: number;
  notImplemented: number;
  undetermined: number;
  governingSource: string | null;
}): LevelRating {
  const { controlId, credit, population, implemented, partial, notImplemented, undetermined, governingSource } = args;

  if (population === 0) {
    return rate("Implemented", 0, BASIS.UNASSESSED, `${controlId} applies to nothing in this boundary that could be sampled.`);
  }

  const ratio = credit / population;
  const derived = nearestRating(ratio);
  const parts = [
    `${implemented} of ${population} ${population === 1 ? "instance" : "instances"} verified`,
    partial > 0 ? `${partial} partial` : null,
    notImplemented > 0 ? `${notImplemented} not implemented` : null,
    undetermined > 0 ? `${undetermined} with no evidence collected` : null,
  ].filter(Boolean);

  const governing = governingSource ? ` Worst result from ${governingSource}.` : "";
  return rate("Implemented", derived, BASIS.MEASURED, `${parts.join(", ")}.${governing}`);
}

// ---- Level 4: Measured (10%) ----------------------------------------------------
// Asks whether the control's operation is being measured — whether anybody
// knows the denominator. A record carrying population and exceptions counted
// something; one carrying only a pass/fail verdict asserted something.
//
// Best record across the population wins, rather than an average. A metric
// either exists for this control or it does not, and diluting it by the assets
// that happen to lack their own copy would report a measured control as
// partially measured because the measurement was centralized.
export function rateMeasured(args: {
  controlId: ControlId;
  prevalenceBearing: readonly ScoredEvidence[];
}): LevelRating {
  const { controlId, prevalenceBearing } = args;

  if (prevalenceBearing.length === 0) {
    return rate("Measured", 0, BASIS.UNASSESSED, `No collection against ${controlId} records a population and an exception count — its operation is verified but not measured.`);
  }

  const best = prevalenceBearing.reduce((b, r) => (gradeOf(r) > gradeOf(b) ? r : b));
  const rating = gradeOf(best);
  const detail = `${best.source} counted ${best.exceptions} exception${best.exceptions === 1 ? "" : "s"} in ${best.population} ${best.populationUnit ?? "items"}`;

  if (rating === 100) return rate("Measured", 100, BASIS.MEASURED, `${detail}, from a test that re-runs itself and is current.`);
  if (rating === 75) return rate("Measured", 75, BASIS.MEASURED, `${detail}, current, but the measurement does not re-run on its own.`);
  if (rating === 50) return rate("Measured", 50, BASIS.MEASURED, `${detail}, but the collection is past its validity window.`);
  return rate("Measured", 25, BASIS.MEASURED, `${detail} — counted by hand rather than by the system.`);
}

// Where one prevalence-bearing record lands. Self-rerunning and current is the
// only combination that supports a claim of continuous measurement; everything
// else is a measurement somebody took.
function gradeOf(record: ScoredEvidence): ComplianceRating {
  const verifying = meetsEvidence(record.evidenceType, VERIFYING_EVIDENCE_FLOOR);
  const selfRerunning = meetsEvidence(record.evidenceType, "Automated technical test");
  if (!verifying) return 25;
  if (record.stale) return 50;
  return selfRerunning ? 100 : 75;
}

// ---- Level 5: Managed (15%) -----------------------------------------------------
// Asks whether anybody acts on the control on a cadence. Reads the scheduled
// activity calendar the same two ways the documentation levels read their
// libraries: an activity citing the control directly, or one covering the SOP
// that owns the control's domain.
//
// MANAGED_REQUIRES_MEASUREMENT is the single place a level depends on a lower
// one, and it is not smuggled in. HITRUST's Managed rung is specifically about
// metrics being used to make decisions — you cannot manage from a metric you do
// not have. A review cycle running on schedule with nothing to review is real
// diligence and rates well, but it is not the top rung.
const MANAGED_REQUIRES_MEASUREMENT = true;

export interface ActivityStatus {
  activity: ScheduledActivityRecord;
  overdue: boolean;
}

export function rateManaged(args: {
  controlId: ControlId;
  citingActivities: readonly ActivityStatus[];
  domainActivities: readonly ActivityStatus[];
  pastDueFindings: readonly { id: string; due: string }[];
  measuredRating: ComplianceRating;
  domain: string;
}): LevelRating {
  const { controlId, citingActivities, domainActivities, pastDueFindings, measuredRating, domain } = args;

  const onSchedule = citingActivities.filter((a) => !a.overdue);
  const overdue = citingActivities.filter((a) => a.overdue);

  if (pastDueFindings.length > 0 && citingActivities.length > 0) {
    const ids = pastDueFindings.map((f) => f.id).join(", ");
    return rate("Managed", 25, BASIS.MEASURED, `${citingActivities[0].activity.title} covers ${controlId}, but ${ids} ${pastDueFindings.length === 1 ? "is" : "are"} past due against it — measured, not managed.`);
  }

  if (onSchedule.length > 0) {
    const a = onSchedule[0].activity;
    if (!MANAGED_REQUIRES_MEASUREMENT || measuredRating >= 50) {
      return rate("Managed", 100, BASIS.MEASURED, `${a.title} reviews ${controlId} ${cadence(a.frequency)} and is on schedule, with a measurement behind it.`);
    }
    return rate("Managed", 75, BASIS.MEASURED, `${a.title} reviews ${controlId} ${cadence(a.frequency)} and is on schedule, but there is no metric feeding the review.`);
  }

  if (overdue.length > 0) {
    const a = overdue[0].activity;
    return rate("Managed", 25, BASIS.MEASURED, `${a.title} covers ${controlId} but its current period is overdue.`);
  }

  const domainOnSchedule = domainActivities.filter((a) => !a.overdue);
  if (domainOnSchedule.length > 0) {
    const a = domainOnSchedule[0].activity;
    return rate("Managed", 50, BASIS.ASSESSED, `No activity cites ${controlId}, but ${a.title} runs ${cadence(a.frequency)} against the SOP owning "${domain}".`);
  }
  if (domainActivities.length > 0) {
    return rate("Managed", 25, BASIS.ASSESSED, `Only ${domainActivities[0].activity.title} reaches ${controlId}, through its domain, and it is overdue.`);
  }

  return rate("Managed", 0, BASIS.UNASSESSED, `No scheduled activity reaches ${controlId}, directly or through the SOP owning "${domain}".`);
}

// ---- Inherited controls ---------------------------------------------------------
// A control the provider runs. Policy and Procedure are rated by the normal
// rules and are NOT capped: a provider operating a control does not relieve
// ACME of requiring it in writing or of saying what it does about it — obtain
// the report, read the complementary user entity controls, act on the gaps.
//
// The three levels ACME cannot verify itself are rated from the report and held
// at INHERITED_LEVEL_CAP. That ceiling is derived from the evidence scale rather
// than declared: a SOC 2 is an auditor's examination, which sits below the grade
// at which this engine calls anything verified.
export function rateInheritedImplemented(args: {
  controlId: ControlId;
  certification: ProviderCertification | null;
  provider: string;
  expired: boolean;
  domain: string;
}): LevelRating {
  const { controlId, certification, provider, expired, domain } = args;

  if (!certification) {
    return rate("Implemented", 0, BASIS.UNASSESSED, `${provider} is expected to run ${controlId}, but ACME holds no report covering "${domain}".`);
  }

  // The grade of the report itself is what the claim can be worth, read off the
  // same scale everything else uses rather than a second copy of it.
  const full = complianceForConfidence(evidenceBaseConfidence(certification.evidenceType));
  const reportName = `${certification.standard} ${certification.reportType === "type-2" ? "Type II" : certification.reportType}`;

  if (expired) {
    const stepped = Math.max(0, full - 25) as ComplianceRating;
    return rate("Implemented", stepped, BASIS.INHERITED, `${provider}'s ${reportName} covers "${domain}", but it is past its validity window.`);
  }
  return rate("Implemented", full, BASIS.INHERITED, `${provider} operates ${controlId}; its ${reportName} covers "${domain}".`);
}

export function rateInheritedMeasured(args: {
  certification: ProviderCertification | null;
  domain: string;
}): LevelRating {
  const { certification, domain } = args;
  if (!certification) return rate("Measured", 0, BASIS.UNASSESSED, `No provider report covers "${domain}".`);
  if (certification.reportType === "type-2") {
    return rate("Measured", 50, BASIS.INHERITED, `A Type II report tests operating effectiveness across a period, so the control's operation is measured — by the provider's auditor, not by ACME.`);
  }
  return rate("Measured", 25, BASIS.INHERITED, `A ${certification.reportType} report observes the design at one moment and cannot speak to operation over time.`);
}

// ACME's own responsibility for an inherited control: reassessing the vendor.
// This is genuinely the Managed rung for something somebody else runs, and it
// is already on the calendar as the critical-vendor reassessment.
export function rateInheritedManaged(args: {
  provider: string;
  vendorReview: ActivityStatus | null;
}): LevelRating {
  const { provider, vendorReview } = args;
  if (!vendorReview) {
    return rate("Managed", 0, BASIS.UNASSESSED, `Nothing on the calendar reassesses ${provider} — an inherited control nobody revisits is an assumption with an expiry date.`);
  }
  if (vendorReview.overdue) {
    return rate("Managed", 25, BASIS.INHERITED, `${vendorReview.activity.title} covers ${provider}, but its current period is overdue.`);
  }
  return rate("Managed", 50, BASIS.INHERITED, `${vendorReview.activity.title} reassesses ${provider} ${cadence(vendorReview.activity.frequency)} and is on schedule.`);
}

// Applied to every level of an inherited control. Capping after the fact rather
// than inside each rule keeps the rules readable and puts the ceiling in one
// place where it can be argued with.
export function capInherited(rating: LevelRating, cap: ComplianceRating): LevelRating {
  if (rating.derived <= cap) return rating;
  return {
    ...rating,
    derived: cap,
    rating: cap,
    contribution: rating.weight * cap,
    rationale: `${rating.rationale} Held at ${COMPLIANCE_LABELS[cap]}: ACME cannot verify a provider-run control beyond the grade of the report.`,
  };
}
