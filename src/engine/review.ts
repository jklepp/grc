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
// "not-applicable" rejected is "in" — so a Control Scope Wizard can toggle
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
// kind "provider" is a vendor certification, "enterprise" an internal program
// attestation, "program" a program-scoped domain no attestation names — the
// claim there rests on the central program itself.
export interface InheritanceGroup {
  id: string;
  kind: "provider" | "enterprise" | "program";
  bucket: "vendor-inherited" | "enterprise";
  title: string;
  reference: string;
  evidenceType: string | null;
  assessedAt: string | null;
  domains: readonly string[];
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

  // The inherited half of a system's in-scope controls, grouped by what the
  // claim actually stands on — a provider certification, an enterprise
  // attestation, or (for program-scoped controls with no attestation) the
  // central program for their domain. This is the review unit a person can
  // honestly evaluate: "do I accept this report for this boundary" is one
  // decision covering every control it backs, where the per-control fan-out
  // is bookkeeping the confirm writes for them.
  function inheritanceGroupsForSystem(systemId: SystemId): InheritanceGroup[] {
    const system = graph.systemById[systemId];
    const walk = wavesForSystem(systemId);
    const groups = new Map<string, InheritanceGroup>();

    const add = (key: string, seed: Omit<InheritanceGroup, "controls" | "remaining">, item: ReviewWaveControl) => {
      if (!groups.has(key)) groups.set(key, { ...seed, controls: [], remaining: [] });
      const group = groups.get(key)!;
      group.controls.push(item);
      if (!decisionMade(item.review, systemId, seed.bucket)) group.remaining.push(item);
    };

    const vendorWave = walk.waves["vendor-inherited"];
    [...vendorWave.remaining, ...vendorWave.decidedItems].forEach((item) => {
      const cert = graph.providerCertifications.find(
        (c) => c.provider === system.provider && c.domains.includes(item.control.domain)
      );
      if (cert) {
        add(cert.id, {
          id: cert.id, kind: "provider", bucket: "vendor-inherited",
          title: `${cert.provider} ${cert.standard} ${cert.reportType === "type-2" ? "Type II" : "Type I"}`,
          reference: cert.reference, evidenceType: cert.evidenceType,
          assessedAt: cert.issuedAt, domains: cert.domains,
        }, item);
      } else {
        add(`provider-uncovered`, {
          id: "provider-uncovered", kind: "provider", bucket: "vendor-inherited",
          title: `${system.provider} — no covering report on file`,
          reference: "", evidenceType: null, assessedAt: null, domains: [],
        }, item);
      }
    });

    const enterpriseWave = walk.waves.enterprise;
    [...enterpriseWave.remaining, ...enterpriseWave.decidedItems].forEach((item) => {
      const attestation = (graph.attestationsByDomain[item.control.domain] ?? [])[0];
      if (attestation) {
        add(attestation.id, {
          id: attestation.id, kind: "enterprise", bucket: "enterprise",
          title: attestation.program,
          reference: attestation.reference, evidenceType: attestation.evidenceType,
          assessedAt: attestation.assessedAt, domains: attestation.domains,
        }, item);
      } else {
        // Program-scoped controls whose domain no attestation names: the
        // claim rests on ACME's central program for that domain itself.
        add(`program::${item.control.domain}`, {
          id: `program::${item.control.domain}`, kind: "program", bucket: "enterprise",
          title: `ACME central program — ${item.control.domain}`,
          reference: "", evidenceType: null, assessedAt: null, domains: [item.control.domain],
        }, item);
      }
    });

    // Providers first, then attestations, then bare program domains, each
    // block alphabetical — the strongest-backed claims lead.
    const rank = { provider: 0, enterprise: 1, program: 2 } as const;
    return [...groups.values()].sort((a, b) =>
      rank[a.kind] === rank[b.kind] ? a.title.localeCompare(b.title) : rank[a.kind] - rank[b.kind]
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

  return {
    wavesForSystem,
    inheritanceGroupsForSystem,
    frameworkReadiness,
    auditReadinessForSystem,
    inheritanceClaimed: (systemId: SystemId, controlId: ControlId) => inheritanceClaimed(graph, systemId, controlId),
    reviewFor: (systemId: SystemId, controlId: ControlId) => reviewFor(graph, systemId, controlId),
  };
}

export type ReviewApi = ReturnType<typeof createReview>;
