// Human review of a derived control call, and the audit-readiness posture
// that falls out of it.
//
// This is not a second scorer. Applicability, inheritance, and PRISMA ratings
// still live in their existing modules. This module:
//
//   1. answers whether a derived inheritance claim is actually claimed
//      (runtime systems start unconfirmed; YAML-authored systems are the
//      existing human judgment unless a review rejects them)
//   2. projects the four operator waves a system owner walks
//   3. derives per-framework audit readiness, kept separate from assurance
//      and from assessment coverage
import type { Graph } from "../graph/types";
import type { Control } from "../graph/nodes/controls";
import { RESPONSIBILITIES, type Responsibility } from "../graph/edges/controlImplementations";
import {
  controlReviewKey, type ControlReview, type ReviewBucket,
} from "../graph/edges/controlReviews";
import type { ControlId, SystemId } from "../graph/ids";
import type { ApplicabilityApi } from "./applicability";
import type { AssessmentApi } from "./assessment";
import type { ComplianceApi } from "./compliance";
import type { FindingsApi } from "./findings";

export function isRuntimeCreatedSystem(systemId: SystemId): boolean {
  return systemId.startsWith("SYS-USR-");
}

export function reviewFor(graph: Graph, systemId: SystemId, controlId: ControlId): ControlReview | null {
  return graph.controlReviewByKey[controlReviewKey(systemId, controlId)] ?? null;
}

// Runtime-created systems do not inherit a claimed score until a person
// confirms the split. YAML-authored systems keep today's claimed inheritance
// unless a review rejects it.
export function inheritanceClaimed(graph: Graph, systemId: SystemId, controlId: ControlId): boolean {
  const review = reviewFor(graph, systemId, controlId);
  if (review?.stance === "reject" && (review.bucket === "vendor-inherited" || review.bucket === "enterprise")) {
    return false;
  }
  if (review?.stance === "confirm" && (review.bucket === "vendor-inherited" || review.bucket === "enterprise")) {
    return true;
  }
  return !isRuntimeCreatedSystem(systemId);
}

export function isForcedApplicable(graph: Graph, systemId: SystemId, controlId: ControlId): boolean {
  const review = reviewFor(graph, systemId, controlId);
  return review?.stance === "reject" && review.bucket === "not-applicable";
}

// The symmetric override: an operator can pull a control that rules say
// applies back OUT of scope, same as isForcedApplicable pulls one IN. Both
// read the same ControlReview record — "not-applicable" confirmed is "out,"
// "not-applicable" rejected is "in" — so Scope Review can toggle
// any control's scope with one mutation (upsertControlReview) regardless of
// which way the underlying rules already called it.
export function isForcedNotApplicable(graph: Graph, systemId: SystemId, controlId: ControlId): boolean {
  const review = reviewFor(graph, systemId, controlId);
  return review?.stance === "confirm" && review.bucket === "not-applicable";
}

export function pendingResolvedAsApplicable(graph: Graph, systemId: SystemId, controlId: ControlId): boolean {
  const review = reviewFor(graph, systemId, controlId);
  if (!review) return false;
  return !(review.stance === "confirm" && review.bucket === "not-applicable");
}

export function pendingConfirmedNotApplicable(graph: Graph, systemId: SystemId, controlId: ControlId): boolean {
  const review = reviewFor(graph, systemId, controlId);
  return review?.stance === "confirm" && review.bucket === "not-applicable";
}

// Control statuses that represent a gap needing remediation — the population
// lane 4 counts and lane 3 expects a Finding for.
//
// Named GAP_CONTROL_STATUSES, not REMEDIATION_STATUSES, on purpose. That name
// is already taken by the finding CAP lifecycle (Planned/In Progress/Blocked/
// Complete) in graph/nodes/findings.ts, and two constants sharing a name across
// sibling modules is how a page ends up comparing control statuses against CAP
// statuses, matching nothing, and reporting "0 gaps" with no test failing.
export const GAP_CONTROL_STATUSES = ["partial", "deficient", "not-implemented"] as const;

export const REVIEW_WAVES = ["not-applicable", "vendor-inherited", "enterprise", "system-owned"] as const;
export type ReviewWave = (typeof REVIEW_WAVES)[number];

export const AUDIT_READINESS_BANDS = [
  "scope-unconfirmed",
  "scope-confirmed",
  "assessment-in-progress",
  "audit-ready",
  "blocked",
] as const;
export type AuditReadinessBand = (typeof AUDIT_READINESS_BANDS)[number];

export const AUDIT_READINESS_LABELS: Record<AuditReadinessBand, string> = {
  "scope-unconfirmed": "Scope unconfirmed",
  "scope-confirmed": "Scope confirmed",
  "assessment-in-progress": "Assessment in progress",
  "audit-ready": "Audit-ready",
  blocked: "Blocked",
};

export interface ReviewWaveControl {
  control: Control;
  reason: string;
  responsibility: Responsibility | null;
  review: ControlReview | null;
  proposed: boolean;
  // Set for graph.pendingApplicability items: an open question a rule
  // deliberately could not resolve. Unlike a routine derived call, an
  // authored system's YAML never stands in for a decision here — nothing
  // was "already judged" when the record was written pending in the first
  // place, so it always needs a review row of its own.
  forceReview?: boolean;
}

export interface ReviewWaveProjection {
  id: ReviewWave;
  label: string;
  remaining: ReviewWaveControl[];
  decidedItems: ReviewWaveControl[];
  decided: number;
  total: number;
}

// One inherited-coverage claim and everything it backs on this boundary.
// The claim is identified by WHAT is covered (a domain) and WHO covers it (the
// provider, or ACME's central program) — never by the paperwork. The two
// buckets are backed by different kinds of proof: external inheritance stands
// on a provider's report or certification (`report` below — the only proof
// ACME can ever hold about a control it cannot re-run), while internal
// inheritance stands on ACME's own program-level evidence, which the engine
// already tracks per control; a `report` on an internal claim is a program
// audit riding along as extra proof, never the claim's basis.
export interface InheritanceGroup {
  id: string;
  bucket: "vendor-inherited" | "enterprise";
  domain: string;
  coveredBy: string;
  report: {
    title: string;
    evidenceType: string;
    assessedAt: string;
    reference: string;
  } | null;
  controls: ReviewWaveControl[];
  remaining: ReviewWaveControl[];
}

export interface FrameworkReadiness {
  standard: string;
  band: AuditReadinessBand;
  mapped: number;
  defensible: number;
  unconfirmed: number;
  unassessed: number;
  blocked: number;
}

// The four System Readiness lanes, derived once. Consumers read this rather
// than recomputing it — gapControlsMissingFinding carries the controls behind
// lane 3's count so a surface can name them, not just tally them.
export interface FormalAssessmentStatus {
  scopeDecided: boolean;
  // The population behind scopeDecided: every out-of-scope exclusion, external
  // inheritance claim, and internal inheritance claim a human has to confirm or
  // reject. Kept separate from applicability's pendingControls, which is only
  // the narrower set a deterministic rule could not resolve on its own — a
  // runtime-created system can clear that set with nothing decided, because
  // every inheritance wave still starts unconfirmed (see isRuntimeCreatedSystem).
  scopeRemainingCount: number;
  scopeTotalCount: number;
  controlsAssessed: boolean;
  // The controls this product can assess directly: applicable key controls.
  // The full applicable catalog remains the denominator for coverage, but
  // non-key controls do not carry per-implementation evidence or Findings and
  // therefore cannot be completion work in the control assessment walk.
  assessmentRemainingCount: number;
  assessmentTotalCount: number;
  gapsRecorded: boolean;
  gapControlsMissingFinding: Array<{ controlId: ControlId; control: Control }>;
  // Lane 3's population: every control carrying a gap, recorded or not.
  remediationCount: number;
  // Lane 4's population, which is a different question and so a different
  // list: every control with something residual still open on it — a gap
  // status, an open Finding, or both. A control at partial/deficient stays
  // here until it is REASSESSED, so a CAP marked Complete cannot clear the
  // lane on its own; and a Finding raised by a pen test or a DR exercise
  // against an otherwise-clean control counts, which it did not when this
  // read control status alone.
  residualControls: Array<{ controlId: ControlId; control: Control }>;
  residualCount: number;
  openFindingCount: number;
  overdueFindingCount: number;
  complete: boolean;
}

// A control this system assessed and then scoped out — the history behind an
// exclusion, which the exclusion itself does not carry.
//
// Everything here is read from raw facts rather than from assessment.
// assessmentFor() returns null the moment a control leaves the applicable set,
// which is correct (there is no live score any more) but means the record it
// was computed from is the only thing left to report. That is also why the
// counts below are counts and not a rating: what survives is the material an
// assessor filed, not a number the engine still stands behind.
export interface DormantAssessment {
  control: Control;
  // The exclusion: why it went out, and who said so.
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
  // What is still on record underneath it.
  //
  // inDeclaredScope is the one part of the record that does not always survive,
  // and that is pre-existing behaviour rather than a gap here: liveGraph prunes
  // a RUNTIME-owned scope down to what currently applies, so excluding a control
  // drops its scope entry. A YAML-curated engagement's declared list is never
  // pruned, so there the entry stays and this reads true. Either way the
  // evidence, mechanisms, findings and overrides below are untouched.
  inDeclaredScope: boolean;
  evidenceCount: number;
  findingCount: number;
  mechanismCount: number;
  overrides: Array<{ level: string; rating: number; assessedBy: string; assessedAt: string; note: string }>;
}

function proposedBucket(
  graph: Graph,
  systemId: SystemId,
  controlId: ControlId,
  responsibility: Responsibility | null,
  notApplicable: boolean,
): ReviewBucket {
  if (notApplicable) return "not-applicable";
  if (responsibility === RESPONSIBILITIES.VENDOR) return "vendor-inherited";
  const programScoped = graph.keyControlById[controlId]?.scope === "program";
  if (responsibility === RESPONSIBILITIES.ENTERPRISE || programScoped) return "enterprise";
  return "system-owned";
}

function decisionMade(review: ControlReview | null, systemId: SystemId, wave: ReviewWave, forceReview = false): boolean {
  if (review) return true;
  if (wave === "system-owned" || forceReview) return false;
  return !isRuntimeCreatedSystem(systemId);
}

export function createReview(
  graph: Graph,
  applicability: ApplicabilityApi,
  assessment: AssessmentApi,
  compliance: ComplianceApi,
  findings: FindingsApi,
) {
  function wavesForSystem(systemId: SystemId) {
    const summary = compliance.controlApplicabilitySummary(systemId);
    const matrix = compliance.systemControlMatrix(systemId).map((row) => ({
      ...row,
      responsibility: compliance.responsibilityForControl(systemId, row.controlId),
    }));
    const responsibilityOf = (controlId: ControlId) => compliance.responsibilityForControl(systemId, controlId);

    const naItems: ReviewWaveControl[] = [
      ...summary.pendingControls.map((item) => ({
        control: item.control,
        reason: item.reason,
        responsibility: null,
        review: reviewFor(graph, systemId, item.control.id),
        proposed: true,
        forceReview: true,
      })),
      ...summary.notApplicableControls.map((item) => ({
        control: item.control,
        reason: item.reason,
        responsibility: null,
        review: reviewFor(graph, systemId, item.control.id),
        proposed: true,
      })),
    ];

    const vendorItems: ReviewWaveControl[] = matrix
      .filter((row) => row.responsibility === RESPONSIBILITIES.VENDOR)
      .map((row) => ({
        control: row.control,
        reason: row.explanation,
        responsibility: row.responsibility,
        review: reviewFor(graph, systemId, row.controlId),
        proposed: Boolean(row.assessment && !row.assessment.assessed) || (row.status === "unassessed"),
      }));

    const companyItems: ReviewWaveControl[] = matrix
      .filter((row) => {
        if (row.responsibility === RESPONSIBILITIES.VENDOR) return false;
        const programScoped = Boolean(row.keyControl?.scope === "program");
        return row.responsibility === RESPONSIBILITIES.ENTERPRISE || programScoped;
      })
      .map((row) => ({
        control: row.control,
        reason: row.explanation,
        responsibility: row.responsibility,
        review: reviewFor(graph, systemId, row.controlId),
        proposed: row.status === "unassessed" || Boolean(row.assessment && !row.assessment.assessed),
      }));

    const remainingItems: ReviewWaveControl[] = matrix
      .filter((row) => {
        if (row.responsibility === RESPONSIBILITIES.VENDOR) return false;
        const programScoped = Boolean(row.keyControl?.scope === "program");
        if (row.responsibility === RESPONSIBILITIES.ENTERPRISE || programScoped) return false;
        // Only key controls can be individually evidenced today — the rest of
        // the applicable catalog stays unassessed by design, not as a walk item.
        return row.status === "unassessed" && Boolean(row.keyControl);
      })
      .map((row) => ({
        control: row.control,
        reason: row.explanation,
        responsibility: row.responsibility,
        review: reviewFor(graph, systemId, row.controlId),
        proposed: true,
      }));

    const project = (
      id: ReviewWave,
      label: string,
      items: ReviewWaveControl[],
    ): ReviewWaveProjection => {
      const remaining: ReviewWaveControl[] = [];
      const decidedItems: ReviewWaveControl[] = [];
      items.forEach((item) => {
        (decisionMade(item.review, systemId, id, item.forceReview) ? decidedItems : remaining).push(item);
      });
      return { id, label, remaining, decidedItems, decided: decidedItems.length, total: items.length };
    };

    const waves = {
      "not-applicable": project("not-applicable", "Not applicable", naItems),
      "vendor-inherited": project("vendor-inherited", "External inherited", vendorItems),
      enterprise: project("enterprise", "Internal inherited", companyItems),
      "system-owned": project("system-owned", "Remaining technical", remainingItems),
    };

    const firstIncomplete = REVIEW_WAVES.find((id) => waves[id].remaining.length > 0) ?? "system-owned";

    return {
      waves,
      firstIncomplete,
      remainingCount: REVIEW_WAVES.reduce((sum, id) => sum + waves[id].remaining.length, 0),
      proposedBucket: (controlId: ControlId, notApplicable = false) =>
        proposedBucket(graph, systemId, controlId, notApplicable ? null : responsibilityOf(controlId), notApplicable),
    };
  }

  // The inherited half of a system's in-scope controls, grouped by claim:
  // one row per (who covers it, which domain). This is the review unit a
  // person can honestly evaluate — "do I accept that AWS runs Physical &
  // Maintenance for this boundary" — where the per-control fan-out is
  // bookkeeping the confirm writes for them. The certification or attestation
  // backing a claim rides along as evidence; a claim with none is the same
  // kind of row, visibly weaker, which is exactly the gap worth seeing.
  function inheritanceGroupsForSystem(systemId: SystemId): InheritanceGroup[] {
    const system = graph.systemById[systemId];
    const walk = wavesForSystem(systemId);
    const groups = new Map<string, InheritanceGroup>();

    const add = (bucket: InheritanceGroup["bucket"], coveredBy: string, report: InheritanceGroup["report"], item: ReviewWaveControl) => {
      const key = `${bucket}::${item.control.domain}`;
      if (!groups.has(key)) {
        groups.set(key, { id: key, bucket, domain: item.control.domain, coveredBy, report, controls: [], remaining: [] });
      }
      const group = groups.get(key)!;
      group.controls.push(item);
      if (!decisionMade(item.review, systemId, bucket)) group.remaining.push(item);
    };

    const vendorWave = walk.waves["vendor-inherited"];
    [...vendorWave.remaining, ...vendorWave.decidedItems].forEach((item) => {
      const cert = graph.providerCertifications.find(
        (c) => c.provider === system.provider && c.domains.includes(item.control.domain)
      );
      add("vendor-inherited", system.provider, cert ? {
        title: `${cert.provider} ${cert.standard} ${cert.reportType === "type-2" ? "Type II" : "Type I"}`,
        evidenceType: cert.evidenceType, assessedAt: cert.issuedAt, reference: cert.reference,
      } : null, item);
    });

    const enterpriseWave = walk.waves.enterprise;
    [...enterpriseWave.remaining, ...enterpriseWave.decidedItems].forEach((item) => {
      const attestation = (graph.attestationsByDomain[item.control.domain] ?? [])[0];
      add("enterprise", "ACME central program", attestation ? {
        title: attestation.program,
        evidenceType: attestation.evidenceType, assessedAt: attestation.assessedAt, reference: attestation.reference,
      } : null, item);
    });

    // Provider claims first, then central-program claims, alphabetical by
    // domain within each — a stable order that owes nothing to which claims
    // happen to hold evidence.
    return [...groups.values()].sort((a, b) =>
      a.bucket === b.bucket ? a.domain.localeCompare(b.domain) : a.bucket === "vendor-inherited" ? -1 : 1
    );
  }

  function frameworkReadiness(systemId: SystemId, standard: string): FrameworkReadiness {
    const mapped = graph.inScopeControls.filter((c) => c.frameworks.some((f) => f.standard === standard));
    const applicableIds = new Set(applicability.applicableControlsForSystem(systemId).map((c) => c.id));
    const pendingIds = new Set(applicability.pendingControlsForSystem(systemId).map((p) => p.control.id));
    const naIds = new Set(
      compliance.notApplicableControlsForSystem(systemId).map((item) => item.control.id)
    );
    const openHigh = new Set(
      findings.findingsForSystem(systemId)
        .filter((f) => f.open && (f.severity === "critical" || f.severity === "high"))
        .map((f) => f.controlId)
    );

    let defensible = 0;
    let unconfirmed = 0;
    let unassessed = 0;
    let blocked = 0;

    mapped.forEach((control) => {
      const review = reviewFor(graph, systemId, control.id);
      const authored = !isRuntimeCreatedSystem(systemId);

      // Routine, rule-derived exclusions inherit an authored system's
      // existing judgment same as inheritance claims do. A pending item
      // never does — it was flagged pending precisely because nothing was
      // already decided, so it needs an actual review record.
      if (naIds.has(control.id)) {
        if (review || authored) defensible += 1;
        else unconfirmed += 1;
        return;
      }
      if (pendingIds.has(control.id)) {
        if (review) defensible += 1;
        else unconfirmed += 1;
        return;
      }

      if (!applicableIds.has(control.id)) {
        if (review?.stance === "confirm" && review.bucket === "not-applicable") defensible += 1;
        else unconfirmed += 1;
        return;
      }

      const a = assessment.assessmentFor(systemId, control.id);
      const status = a ? compliance.controlCoverageForSystem(systemId, control.id).status : "unassessed";
      const bucket = proposedBucket(graph, systemId, control.id, compliance.responsibilityForControl(systemId, control.id), false);
      const waveDone = decisionMade(review, systemId, bucket);
      if (!waveDone && bucket !== "system-owned") {
        unconfirmed += 1;
        return;
      }
      if (openHigh.has(control.id) || status === "deficient" || status === "not-implemented") {
        blocked += 1;
        return;
      }
      if (!a?.assessed) {
        unassessed += 1;
        return;
      }
      defensible += 1;
    });

    const band: AuditReadinessBand =
      blocked > 0 ? "blocked"
        : unconfirmed > 0 ? "scope-unconfirmed"
          : unassessed > 0 ? "assessment-in-progress"
            : mapped.length === 0 ? "scope-unconfirmed"
              : "audit-ready";

    return {
      standard,
      band,
      mapped: mapped.length,
      defensible,
      unconfirmed,
      unassessed,
      blocked,
    };
  }

  function auditReadinessForSystem(systemId: SystemId) {
    const standards = graph.systemById[systemId]?.standards ?? [];
    const frameworks = standards.map((standard) => frameworkReadiness(systemId, standard));
    const worstRank: Record<AuditReadinessBand, number> = {
      blocked: 0,
      "scope-unconfirmed": 1,
      "assessment-in-progress": 2,
      "scope-confirmed": 3,
      "audit-ready": 4,
    };
    const overall = frameworks.reduce<AuditReadinessBand>((worst, item) => (
      worstRank[item.band] < worstRank[worst] ? item.band : worst
    ), "audit-ready");
    const walk = wavesForSystem(systemId);
    const scopeConfirmed = walk.waves["not-applicable"].remaining.length === 0
      && walk.waves["vendor-inherited"].remaining.length === 0
      && walk.waves.enterprise.remaining.length === 0;
    return {
      overall: scopeConfirmed && overall === "scope-unconfirmed" ? "assessment-in-progress" as AuditReadinessBand : overall,
      frameworks,
      waves: walk,
    };
  }

  // Controls scoped out by a confirmed review that still carry assessment
  // facts. The same pairs validateDerivations exempts under DORMANT
  // ASSESSMENTS — that exemption is what keeps these facts loadable, and this
  // is what makes them visible instead of merely tolerated.
  //
  // A control excluded before anyone assessed it has nothing underneath and is
  // not listed: it is an ordinary exclusion, already shown as one.
  function dormantAssessmentsForSystem(systemId: SystemId): DormantAssessment[] {
    const assetIds = new Set((graph.assetsBySystem[systemId] ?? []).map((a) => a.id));
    const scope = graph.assessmentScopeBySystem[systemId];
    const inScopeList = new Set<string>(scope?.controlIds ?? []);

    return graph.controls
      .filter((control) => isForcedNotApplicable(graph, systemId, control.id))
      .map((control) => {
        const evidenceCount = graph.evidence.filter(
          (e) => e.controlId === control.id && e.assetIds.some((id) => assetIds.has(id))
        ).length;
        const findingCount = graph.findings.filter(
          (f) => f.controlId === control.id && f.systemId === systemId
        ).length;
        const mechanismCount = graph.implementationMechanisms.filter(
          (m) => m.controlId === control.id && assetIds.has(m.assetId)
        ).length;
        const overrides = graph.prismaOverrides
          .filter((o) => o.systemId === systemId && o.controlId === control.id)
          .map((o) => ({
            level: o.level, rating: o.rating, assessedBy: o.assessedBy, assessedAt: o.assessedAt, note: o.note ?? "",
          }));
        const review = reviewFor(graph, systemId, control.id);
        return {
          control,
          reason: review?.note ?? "",
          reviewedBy: review?.reviewedBy ?? "",
          reviewedAt: review?.reviewedAt ?? "",
          inDeclaredScope: inScopeList.has(control.id),
          evidenceCount,
          findingCount,
          mechanismCount,
          overrides,
        };
      })
      .filter((d) => (
        d.inDeclaredScope || d.evidenceCount > 0 || d.findingCount > 0
        || d.mechanismCount > 0 || d.overrides.length > 0
      ))
      .sort((a, b) => a.control.id.localeCompare(b.control.id));
  }

  // "Formally assessed" — the completion bar for an assessment engagement, and
  // what the System Readiness card's four lanes read.
  //
  // Deliberately a LOWER bar than audit-ready: it does not require the gaps to
  // be fixed, only that scope is decided, every applicable key control is graded,
  // and everything still sitting at partial/deficient/not-implemented has a
  // Finding on record. That is how an engagement actually completes.
  //
  // This lived in SystemWorkspace.tsx, which put a derivation in a page and
  // meant the readiness lanes could not be read by anything else — the export,
  // the cockpit, or a second surface — without recomputing them.
  function formalAssessmentForSystem(systemId: SystemId): FormalAssessmentStatus {
    const matrix = compliance.systemControlMatrix(systemId);
    const assessmentRows = matrix.filter((row) => Boolean(row.keyControl));
    const systemFindings = findings.findingsForSystem(systemId);
    const findingControlIds = new Set(systemFindings.map((f) => f.controlId));

    // Controls carrying a gap, whether or not anybody has written it down.
    const gapControls = matrix.filter((row) => (GAP_CONTROL_STATUSES as readonly string[]).includes(row.status));
    const gapControlsMissingFinding = gapControls.filter((row) => !findingControlIds.has(row.controlId));

    // Scope is decided once a human has confirmed or rejected every
    // out-of-scope exclusion and inheritance claim Scope Review presents —
    // the same three waves auditReadinessForSystem's scopeConfirmed checks,
    // not applicability's narrower pendingControls (a rule-ambiguity count
    // that a fresh runtime system can already read as zero).
    const walk = wavesForSystem(systemId);
    const scopeWaves = [walk.waves["not-applicable"], walk.waves["vendor-inherited"], walk.waves.enterprise];
    const scopeRemainingCount = scopeWaves.reduce((sum, w) => sum + w.remaining.length, 0);
    const scopeTotalCount = scopeWaves.reduce((sum, w) => sum + w.total, 0);
    const scopeDecided = scopeRemainingCount === 0;
    const assessmentRemainingCount = assessmentRows.filter((row) => row.status === "unassessed").length;
    const controlsAssessed = assessmentRemainingCount === 0;
    const gapsRecorded = gapControlsMissingFinding.length === 0;

    // Lane 4: residual position — what is still to fix, from BOTH sides of the
    // record. A gap status is the assessed reading; an open Finding is the
    // tracked one. Neither alone is the whole answer: a control can be graded
    // clean and still carry an open pen-test finding, and a control can be
    // graded deficient before anyone has written the finding down. Unioned by
    // control so a gap with three findings on it is one item to fix, not four.
    const gapControlIds = new Set(gapControls.map((row) => row.controlId));
    const openFindingControlIds = new Set(systemFindings.filter((f) => f.open).map((f) => f.controlId));
    const residualControls = matrix
      .filter((row) => gapControlIds.has(row.controlId) || openFindingControlIds.has(row.controlId))
      .map((row) => ({ controlId: row.controlId, control: row.control }))
      .sort((a, b) => a.controlId.localeCompare(b.controlId));

    return {
      scopeDecided,
      scopeRemainingCount,
      scopeTotalCount,
      controlsAssessed,
      assessmentRemainingCount,
      assessmentTotalCount: assessmentRows.length,
      gapsRecorded,
      gapControlsMissingFinding,
      remediationCount: gapControls.length,
      residualControls,
      residualCount: residualControls.length,
      openFindingCount: systemFindings.filter((f) => f.open).length,
      overdueFindingCount: systemFindings.filter((f) => f.overdue).length,
      complete: scopeDecided && controlsAssessed && gapsRecorded,
    };
  }

  return {
    wavesForSystem,
    inheritanceGroupsForSystem,
    dormantAssessmentsForSystem,
    formalAssessmentForSystem,
    frameworkReadiness,
    auditReadinessForSystem,
    inheritanceClaimed: (systemId: SystemId, controlId: ControlId) => inheritanceClaimed(graph, systemId, controlId),
    reviewFor: (systemId: SystemId, controlId: ControlId) => reviewFor(graph, systemId, controlId),
  };
}

export type ReviewApi = ReturnType<typeof createReview>;
