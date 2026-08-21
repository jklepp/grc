// One control, assessed against one system, across the five PRISMA levels.
//
// This is the unit the model is built on now. It used to be the (asset,
// control) pair: every asset was scored against every control that applied to
// it, and a system was the criticality-weighted average of its assets. That
// asserted something false about how assurance is actually established —
// nobody assesses twenty-six assets one at a time, let alone two thousand six
// hundred. A real assessment rates a requirement statement against a boundary
// ONCE and samples assets to decide whether it holds.
//
// So assets did not disappear; they moved. They are the sampling population for
// the Implemented level and the drill-down beneath it, which is what lets the
// model answer "was this S3 bucket shown compliant against encryption at rest"
// without ever giving the bucket a score of its own.
//
// SCORED, INHERITED, OR NEITHER
// ------------------------------
// Three states, and keeping them apart is the point.
//
//   assessed    the system's declared scope names this control. Rated on all
//               five levels from ACME's own facts.
//   inherited   the provider runs it, under a domain INHERITED_DOMAINS names
//               and a certification actually covers. Rated, but held below
//               what ACME could claim for something it verified itself.
//   neither     applicable and not assessed. rawScore is NULL, never 0.
//
// That last one carries the weight of the whole design. There are facts for 27
// of the in-scope common controls; rating the rest Non-Compliant would say
// ACME failed them when the truth is nobody looked. A null score and an honest
// coverage figure beside it is the difference between a gap map and a lie.
import type { Graph } from "../graph/types";
import type { Asset } from "../graph/nodes/assets";
import type { Control } from "../graph/nodes/controls";
import type { Org } from "../graph/nodes/orgs";
import { isHitrustR2Certification, type ProviderCertification } from "../graph/nodes/providerCertifications";
import type { ScheduledActivityRecord } from "../graph/nodes/scheduledActivities";
import type { ImplementationMechanism, NotImplemented } from "../graph/edges/controlImplementations";
import { inheritsDomain } from "../graph/nodes/systems";
import {
  BASIS, PRISMA_LEVELS, categoryForDomain,
  type AssuranceCategory, type Basis, type ComplianceRating, type PrismaLevel,
} from "../graph/nodes/taxonomy";
import {
  INHERITED_LEVEL_CAP, OPERATING_HISTORY_THRESHOLD_DAYS, IMMATURE_LEVEL_CAP,
  assuranceBand, display, meetsEvidence, prismaScore,
} from "./assurance";
import { DAY_MS, governingRecord, IMPLEMENTATION_EVIDENCE_FLOOR, type EvidenceApi, type ScoredEvidence } from "./evidence";
import {
  INSTANCE_CREDIT, capInherited, capImmature, rateImplemented, rateInheritedHitrustR2, rateInheritedImplemented, rateInheritedManaged,
  rateInheritedMeasured, rateManaged, rateMeasured,ratePolicy, rateProcedure,
  type LevelRating,
} from "./levels";
import type { ApplicabilityApi, ApplicabilityResolution } from "./applicability";
import type { FindingsApi } from "./findings";
import type { EngineContext } from "./context";
import type { AssetId, ControlId, SystemId } from "../graph/ids";
import { inheritanceClaimed } from "./review";

export const INSTANCE_STATUS_META = {
  implemented: { label: "Implemented", color: "green" },
  partial: { label: "Partial", color: "amber" },
  "not-implemented": { label: "Not implemented", color: "red" },
  undetermined: { label: "No evidence collected", color: "muted" },
  "not-applicable": { label: "Not applicable", color: "muted" },
};

export type InstanceStatus = keyof typeof INSTANCE_STATUS_META;

// established: at least the operational (90-day) threshold has elapsed since
// implementedAt. building: a date is on record but the window hasn't closed.
// A pair with no operating-history record at all carries `null` here, which
// engine/assessment.ts treats as untracked rather than as freshly implemented
// — the default that leaves the rest of the assessed estate unaffected.
export const OPERATING_HISTORY_STATUS_META = {
  established: { label: "Operating History Established", color: "green" },
  building: { label: "Building Operating History", color: "amber" },
};

// One asset's answer to one control. Carries a STATUS and a CREDIT, never a
// score — the moment this holds a number of its own, assets are being scored
// again through the back door.
export interface ControlInstance {
  assetId: AssetId;
  asset: Asset;
  systemId: SystemId;
  controlId: ControlId;
  status: InstanceStatus;
  credit: number;
  applicability: ApplicabilityResolution;
  evidence: ScoredEvidence[];
  governing: ScoredEvidence | null;
  mechanism: ImplementationMechanism | null;
  notImplemented: NotImplemented | null;
  // The one sentence this asset can say about this control.
  statement: string;
  // Operating history — see ControlOperatingHistory (graph/edges/controlImplementations.ts)
  // and OPERATING_HISTORY_THRESHOLD_DAYS (engine/assurance.ts). Null when
  // untracked. Distinct from `status`/`credit` above on purpose: this is a
  // track-record question, not a verification question, and the two can
  // disagree — see capImmature() in engine/levels.ts.
  implementedAt: string | null;
  operatingDays: number | null;
  maturityEligibleAt: string | null;
  operatingHistoryStatus: keyof typeof OPERATING_HISTORY_STATUS_META | null;
}

export interface ControlAssessment {
  id: string;
  systemId: SystemId;
  controlId: ControlId;
  control: Control;
  domain: string;
  category: AssuranceCategory;
  // Applicable and assessed are different questions and both get reported.
  applicable: boolean;
  assessed: boolean;
  inherited: boolean;
  certification: ProviderCertification | null;
  basis: Basis;
  levels: Record<PrismaLevel, LevelRating>;
  // Null when not assessed. Never zero — see the header.
  rawScore: number | null;
  score: number | null;
  band: ReturnType<typeof assuranceBand>;
  instances: ControlInstance[];
  // Levels rated above the level below them. HITRUST does not cap, so this is
  // reported rather than enforced.
  ladderInversions: PrismaLevel[];
  owners: Org[];
  explanation: string;
}

export function createAssessment(
  graph: Graph,
  applicability: ApplicabilityApi,
  evidenceApi: EvidenceApi,
  findings: FindingsApi,
  ctx: EngineContext
) {
  const { scoreEvidence, evidenceFor, policyOverdue } = evidenceApi;

  // ---- Scheduled activities, resolved against ctx.now ------------------------
  // src/data derives status against a module-level clock. The graph carries only
  // the calendar, so "is the current period overdue" is re-answered here — which
  // is what makes the Managed level a function of when you ask.
  function currentPeriod(frequency: ScheduledActivityRecord["frequency"]): number {
    const month = ctx.now.getMonth();
    if (frequency === "Monthly") return month + 1;
    if (frequency === "Quarterly") return Math.floor(month / 3) + 1;
    return 1;
  }

  function activityOverdue(activity: ScheduledActivityRecord): boolean {
    const instance = activity.instances.find((i) => i.period === currentPeriod(activity.frequency));
    if (!instance) return false;
    if (instance.completedAt) return false;
    return Date.parse(instance.dueDate) < ctx.now.getTime();
  }

  const withOverdue = (activities: readonly ScheduledActivityRecord[]) =>
    activities.map((activity) => ({ activity, overdue: activityOverdue(activity) }));

  // ---- Operating history, resolved against ctx.now ----------------------------
  // Same idiom as activityOverdue/certificationExpired above: the graph carries
  // only the go-live date, "how many days has that been" is re-answered here so
  // it moves with ctx.now instead of the date the graph was built.
  function operatingDaysSince(dateStr: string): number {
    return Math.floor((ctx.now.getTime() - Date.parse(dateStr)) / DAY_MS);
  }
  function maturityEligibleDate(implementedAt: string, days: number): string {
    const d = new Date(implementedAt);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // The activities that reassess a vendor, identified by the domain of the
  // controls they cite. Computed once — it is the same answer for every
  // inherited control on every system.
  const VENDOR_DOMAIN = "Third-Party Management";
  const vendorReviewActivities = withOverdue(
    graph.scheduledActivities.filter((a) =>
      a.controlIds.some((cid) => graph.controlById[cid]?.domain === VENDOR_DOMAIN)
    )
  );

  // ---- One asset's answer -----------------------------------------------------
  function buildInstance(systemId: SystemId, assetId: AssetId, controlId: ControlId): ControlInstance {
    const asset = graph.assetById[assetId];
    const resolution = applicability.resolveApplicability(assetId, controlId);
    const records = evidenceFor(assetId, controlId).map(scoreEvidence);
    const governing = governingRecord(records);
    const mechanism = graph.mechanismByPair[`${assetId}::${controlId}`] ?? null;
    const declaredMissing = graph.notImplementedByPair[`${assetId}::${controlId}`] ?? null;

    const history = graph.operatingHistoryByPair[`${assetId}::${controlId}`] ?? null;
    const operatingDays = history ? operatingDaysSince(history.implementedAt) : null;
    const maturityEligibleAt = history
      ? maturityEligibleDate(history.implementedAt, OPERATING_HISTORY_THRESHOLD_DAYS.Implemented)
      : null;
    const operatingHistoryStatus = history === null
      ? null
      : (operatingDays as number) >= OPERATING_HISTORY_THRESHOLD_DAYS.Implemented ? "established" as const : "building" as const;

    const base = {
      assetId, asset, systemId, controlId, applicability: resolution, evidence: records, governing, mechanism, notImplemented: declaredMissing,
      implementedAt: history?.implementedAt ?? null, operatingDays, maturityEligibleAt, operatingHistoryStatus,
    };

    if (!resolution.required) {
      return {
        ...base, status: "not-applicable", credit: 0,
        statement: resolution.notRequiredBecause ?? `${controlId} does not apply to ${asset.name}.`,
      };
    }
    if (declaredMissing) {
      return { ...base, status: "not-implemented", credit: 0, statement: declaredMissing.reason };
    }
    if (records.length === 0) {
      return {
        ...base, status: "undetermined", credit: 0,
        statement: `${controlId} is required on ${asset.name}, and nothing has been collected against it.`,
      };
    }

    // Implemented asks whether the control was actually TESTED, not
    // whether someone was asked about it — HITRUST gives no credit for
    // inquiry alone. A record establishes implementation only if it is
    // current, passing, looked at the whole population, AND meets
    // IMPLEMENTATION_EVIDENCE_FLOOR (evidence.ts): a Screenshot or stronger
    // is somebody looking directly at the control's state; a
    // Self-attestation or a Document is somebody's account of it, which
    // caps out at "partial" below regardless of how clean the claim reads.
    // Whether that look was a one-off or a continuously re-run
    // interrogation is a separate, stricter question — see
    // rateMeasured/gradeOf and VERIFYING_EVIDENCE_FLOOR in levels.ts.
    const verified =
      governing !== null &&
      governing.result === "pass" &&
      !governing.stale &&
      governing.coveragePct >= 100 &&
      meetsEvidence(governing.evidenceType, IMPLEMENTATION_EVIDENCE_FLOOR);

    if (verified) {
      return {
        ...base, status: "implemented", credit: INSTANCE_CREDIT.implemented,
        statement: `${governing.source} confirms ${controlId} on ${asset.name}.`,
      };
    }
    if (governing !== null && governing.result === "fail") {
      return {
        ...base, status: "not-implemented", credit: INSTANCE_CREDIT["not-implemented"],
        statement: `${governing.source} found ${controlId} failing on ${asset.name}.`,
      };
    }

    const why = governing === null
      ? "no governing record"
      : governing.stale
        ? `${governing.source} is past its validity window`
        : governing.coveragePct < 100
          ? `${governing.source} covered ${governing.coveragePct}% of the population`
          : !meetsEvidence(governing.evidenceType, IMPLEMENTATION_EVIDENCE_FLOOR)
            ? `${governing.source} is a ${governing.evidenceType.toLowerCase()} — below the testing floor Implemented requires`
            : `${governing.source} returned ${governing.result}`;
    return {
      ...base, status: "partial", credit: INSTANCE_CREDIT.partial,
      statement: `${controlId} on ${asset.name} is evidenced but not confirmed — ${why}.`,
    };
  }

  // The assets a control is sampled across in one boundary.
  //
  // A program-scoped control is tested once for the boundary rather than asset
  // by asset — asking nineteen assets whether ACME runs a risk-assessment
  // process tests nothing nineteen times. `scope` on a key control stopped being
  // the scoring axis in this change and became exactly this: the sampling axis.
  function populationFor(systemId: SystemId, controlId: ControlId): AssetId[] {
    const keyControl = graph.keyControlById[controlId];
    if (keyControl?.scope === "program") return [];
    return (graph.assetsBySystem[systemId] ?? [])
      .filter((a) => applicability.resolveApplicability(a.id, controlId).required)
      .map((a) => a.id);
  }

  function certificationExpired(cert: ProviderCertification): boolean {
    const age = Math.floor((ctx.now.getTime() - Date.parse(cert.issuedAt)) / DAY_MS);
    return age > cert.validForDays;
  }

  // Prefer a current HITRUST r2 over a SOC 2 covering the same domain. An
  // expired r2 is ignored so scoring falls back to the SOC 2 path.
  function certificationFor(systemId: SystemId, domain: string): ProviderCertification | null {
    const provider = graph.systemById[systemId].provider;
    const covering = (graph.certificationsByProvider[provider] ?? []).filter((c) => c.domains.includes(domain));
    if (covering.length === 0) return null;
    const current = covering.filter((c) => !certificationExpired(c));
    return current.find(isHitrustR2Certification) ?? current[0] ?? covering[0];
  }

  // An enterprise attestation adapted to the exact shape a provider
  // certification carries, so the inherited rating functions in engine/levels.ts
  // — written once, for a vendor's report — need no awareness that this
  // source is a central ACME program rather than a vendor's auditor. Same
  // scale, same decay, same ceiling; only who ran the review differs, and that
  // lives in `provider` either way.
  function enterpriseCertificationFor(domain: string): ProviderCertification | null {
    const attestation = (graph.attestationsByDomain[domain] ?? [])[0];
    if (!attestation) return null;
    return {
      id: attestation.id,
      provider: attestation.program,
      standard: "Internal attestation",
      reportType: attestation.reportType,
      evidenceType: attestation.evidenceType,
      issuedAt: attestation.assessedAt,
      validForDays: attestation.validForDays,
      domains: attestation.domains,
      reference: attestation.reference,
    };
  }

  // The Managed rung for a vendor-run domain asks "is the vendor relationship
  // itself on a reassessment cadence" (vendorReviewActivities, below). For an
  // enterprise-run domain there is no vendor to reassess — the equivalent
  // question is whether anything on the calendar actually revisits the
  // domain the central program covers, so an enterprise-inherited control
  // isn't "Managed" purely because a review happened once at attestation time.
  function domainReviewActivity(domain: string) {
    return withOverdue(
      graph.scheduledActivities.filter((a) => a.controlIds.some((cid) => graph.controlById[cid]?.domain === domain))
    )[0] ?? null;
  }

  function ownersFor(systemId: SystemId, category: AssuranceCategory): Org[] {
    const scoped = graph.ownership[systemId]?.[category] ?? graph.ownership.program?.[category] ?? [];
    return scoped.map((id) => graph.orgById[id]).filter(Boolean);
  }

  // ---- The assessment ---------------------------------------------------------
  function assessControl(systemId: SystemId, controlId: ControlId): ControlAssessment {
    const control = graph.controlById[controlId];
    const system = graph.systemById[systemId];
    const domain = control.domain;
    const category = categoryForDomain(domain);

    const applicable = applicability.applicableControlsForSystem(systemId).some((c) => c.id === controlId);
    // External inheritance first — a domain a system's own hosting arrangement
    // hands to its provider. Internal inheritance only applies where external
    // inheritance doesn't, so a domain can't claim two inheritance sources at
    // once.
    const vendorInherited = inheritsDomain(system.hostingType, domain);
    const enterpriseInherited = !vendorInherited && graph.enterpriseInheritedDomains.has(domain);
    const inherited = vendorInherited || enterpriseInherited;
    const inScope = graph.assessedPairs.has(`${systemId}::${controlId}`);
    // Inheritance is a proposal until a human confirms it. Runtime-created
    // systems start unclaimed; YAML-authored systems keep the curated claim
    // unless a review rejects it. See engine/review.ts.
    const claimed = inherited && inheritanceClaimed(graph, systemId, controlId);
    const assessed = inScope || claimed;

    const owners = ownersFor(systemId, category);
    const id = `ASM-${systemId}-${controlId}`;

    // The documentation levels are rated the same way whether ACME or its
    // provider operates the control, and are not capped for inheritance: a
    // vendor running something does not relieve ACME of requiring it in writing.
    const citing = graph.policiesByControl[controlId] ?? [];
    const domainPolicies = graph.policiesByDomain[domain] ?? [];
    let policyLevel = ratePolicy({
      controlId, citing, stale: citing.filter(policyOverdue),
      domainPolicies, domain,
    });
    const citingSteps = graph.procedureStepsByControl[controlId] ?? [];
    const owningProcedure = graph.procedureByDomain[domain] ?? null;
    let procedureLevel = rateProcedure({
      controlId, citingSteps, owningProcedure, domain,
    });

    // Policy/Procedure's 60-day operating-history window, governed by the
    // policy behind each — the same PolicyRecord.created already used for
    // review-cadence staleness, read here for a different question: not "is it
    // current" but "has it been in effect long enough to count." A procedure
    // borrows its owning policy's date rather than needing one of its own — one
    // founding-date concept, not two.
    const citingPolicies = citing.length > 0 ? citing : domainPolicies;
    const policyAges = citingPolicies.map((p) => operatingDaysSince(p.created));
    if (policyAges.length > 0) {
      policyLevel = capImmature(policyLevel, IMMATURE_LEVEL_CAP, Math.min(...policyAges), OPERATING_HISTORY_THRESHOLD_DAYS.Policy);
    }
    const procedurePolicyIds = citingSteps.length > 0
      ? citingSteps.map((s) => s.procedure.policyId)
      : owningProcedure ? [owningProcedure.policyId] : [];
    const procedureAges = procedurePolicyIds
      .map((pid) => graph.policyById[pid]?.created)
      .filter((d): d is string => Boolean(d))
      .map(operatingDaysSince);
    if (procedureAges.length > 0) {
      procedureLevel = capImmature(procedureLevel, IMMATURE_LEVEL_CAP, Math.min(...procedureAges), OPERATING_HISTORY_THRESHOLD_DAYS.Procedure);
    }

    const instances = inScope
      ? populationFor(systemId, controlId).map((assetId) => buildInstance(systemId, assetId, controlId))
      : [];

    if (!assessed) {
      // Applicable, not assessed. Every level is unrated and the score is null.
      const levels = Object.fromEntries(
        PRISMA_LEVELS.map((level) => [
          level,
          {
            level, derived: 0 as ComplianceRating, rating: 0 as ComplianceRating,
            weight: 0, contribution: 0, basis: BASIS.UNASSESSED,
            rationale: `${controlId} applies to ${systemId} but is outside the declared assessment scope — not rated, not scored as zero.`,
          },
        ])
      ) as Record<PrismaLevel, LevelRating>;

      return {
        id, systemId, controlId, control, domain, category,
        applicable, assessed: false, inherited: false, certification: null,
        basis: BASIS.UNASSESSED, levels, rawScore: null, score: null,
        band: assuranceBand(null), instances: [], ladderInversions: [], owners,
        explanation: `${controlId} applies to ${system.name} and was not part of the ${graph.assessmentScopeBySystem[systemId]?.engagement ?? "current"} scope. It is reported as unassessed rather than scored.`,
      };
    }

    let implementedLevel: LevelRating;
    let measuredLevel: LevelRating;
    let managedLevel: LevelRating;
    let certification: ProviderCertification | null = null;
    let hitrustR2Inheritance = false;

    if (inherited && !inScope) {
      certification = vendorInherited ? certificationFor(systemId, domain) : enterpriseCertificationFor(domain);
      const expired = certification ? certificationExpired(certification) : false;
      const inheritedProvider = certification?.provider ?? system.provider;
      const hitrustR2 = isHitrustR2Certification(certification) && !expired;
      hitrustR2Inheritance = hitrustR2;
      if (hitrustR2) {
        implementedLevel = rateInheritedHitrustR2("Implemented", inheritedProvider, domain);
        measuredLevel = rateInheritedHitrustR2("Measured", inheritedProvider, domain);
        managedLevel = rateInheritedHitrustR2("Managed", inheritedProvider, domain);
      } else {
        implementedLevel = rateInheritedImplemented({ controlId, certification, provider: inheritedProvider, expired, domain });
        measuredLevel = rateInheritedMeasured({ certification, domain });

        // ACME's own Managed responsibility for something a vendor runs is
        // reassessing the vendor, which is already on the calendar. Found by the
        // DOMAIN of the controls an activity cites rather than by an id prefix —
        // "TPM-" happens to spell third-party management today, and a model that
        // reads meaning out of an id string breaks the first time one is renamed.
        //
        // An enterprise-run domain has no vendor relationship to reassess — its
        // Managed rung reads whether anything on the calendar actually revisits
        // the domain the central program covers (domainReviewActivity) instead.
        managedLevel = rateInheritedManaged({
          provider: inheritedProvider,
          vendorReview: vendorInherited ? (vendorReviewActivities[0] ?? null) : domainReviewActivity(domain),
        });
      }
    } else {
      const counted = instances.filter((i) => i.status !== "not-applicable");
      const credit = counted.reduce((sum, i) => sum + i.credit, 0);
      const worst = counted
        .map((i) => i.governing)
        .filter((g): g is ScoredEvidence => g !== null);
      const governing = governingRecord(worst);

      implementedLevel = rateImplemented({
        controlId, credit, population: counted.length,
        implemented: counted.filter((i) => i.status === "implemented").length,
        partial: counted.filter((i) => i.status === "partial").length,
        notImplemented: counted.filter((i) => i.status === "not-implemented").length,
        undetermined: counted.filter((i) => i.status === "undetermined").length,
        governingSource: governing && governing.result !== "pass" ? governing.source : null,
      });

      // Program-scoped controls have no asset population, so their evidence
      // arrives through the "program" sentinel instead.
      const pool = counted.length > 0
        ? counted.flatMap((i) => i.evidence)
        : evidenceFor(null, controlId).map(scoreEvidence);

      if (counted.length === 0 && pool.length > 0) {
        const governingProgram = governingRecord(pool);
        const passing = governingProgram?.result === "pass" && !governingProgram.stale
          && meetsEvidence(governingProgram.evidenceType, IMPLEMENTATION_EVIDENCE_FLOOR);
        implementedLevel = rateImplemented({
          controlId, credit: passing ? 1 : 0.5, population: 1,
          implemented: passing ? 1 : 0, partial: passing ? 0 : 1,
          notImplemented: 0, undetermined: 0,
          governingSource: governingProgram?.source ?? null,
        });
      }

      measuredLevel = rateMeasured({
        controlId,
        prevalenceBearing: pool.filter((r) => r.exceptionRate !== null),
      });

      const openPastDue = findings
        .findingsForSystem(systemId)
        .filter((f) => f.controlId === controlId && f.open && Date.parse(f.due) < ctx.now.getTime())
        .map((f) => ({ id: f.id, due: f.due }));

      managedLevel = rateManaged({
        controlId,
        citingActivities: withOverdue(graph.activitiesByControl[controlId] ?? []),
        domainActivities: owningProcedure ? withOverdue(graph.activitiesByProcedure[owningProcedure.id] ?? []) : [],
        pastDueFindings: openPastDue,
        measuredRating: measuredLevel.derived,
        domain,
      });

      // Implemented/Measured/Managed's 90-day operating-history window,
      // governed by the youngest (least-mature) instance that carries a real
      // go-live date — most instances carry none and are ignored, which is
      // what keeps this a no-op across the untracked majority of the estate.
      // Measured and Managed share Implemented's population on purpose: you
      // cannot have measured a control's operation, or managed it on a
      // cadence, over a track record that doesn't exist yet.
      const dated = counted
        .map((i) => i.operatingDays)
        .filter((d): d is number => d !== null);
      if (dated.length > 0) {
        const youngest = Math.min(...dated);
        implementedLevel = capImmature(implementedLevel, IMMATURE_LEVEL_CAP, youngest, OPERATING_HISTORY_THRESHOLD_DAYS.Implemented);
        measuredLevel = capImmature(measuredLevel, IMMATURE_LEVEL_CAP, youngest, OPERATING_HISTORY_THRESHOLD_DAYS.Measured);
        managedLevel = capImmature(managedLevel, IMMATURE_LEVEL_CAP, youngest, OPERATING_HISTORY_THRESHOLD_DAYS.Managed);
      }
    }

    let levels: Record<PrismaLevel, LevelRating> = {
      Policy: policyLevel,
      Procedure: procedureLevel,
      Implemented: implementedLevel,
      Measured: measuredLevel,
      Managed: managedLevel,
    };

    if (inherited && !inScope && !hitrustR2Inheritance) {
      levels = {
        ...levels,
        Implemented: capInherited(levels.Implemented, INHERITED_LEVEL_CAP),
        Measured: capInherited(levels.Measured, INHERITED_LEVEL_CAP),
        Managed: capInherited(levels.Managed, INHERITED_LEVEL_CAP),
      };
    }

    // An assessor's rating displaces the derived one. The derived value survives
    // on the same object so the disagreement stays visible instead of being
    // resolved into a number nobody can trace.
    PRISMA_LEVELS.forEach((level) => {
      const override = graph.prismaOverrideByKey[`${systemId}::${controlId}::${level}`];
      if (!override) return;
      levels[level] = {
        ...levels[level],
        rating: override.rating,
        contribution: levels[level].weight * override.rating,
        rationale: `${override.note.trim()} (${override.assessedBy}, ${override.assessedAt}; derived rating was ${levels[level].derived}.)`,
      };
    });

    const raw = prismaScore(
      Object.fromEntries(PRISMA_LEVELS.map((l) => [l, levels[l].rating])) as Record<PrismaLevel, ComplianceRating>
    );

    const ladderInversions = PRISMA_LEVELS.filter(
      (level, i) => i > 0 && levels[level].rating > levels[PRISMA_LEVELS[i - 1]].rating
    );

    const basis = inherited && !inScope ? BASIS.INHERITED : BASIS.MEASURED;

    return {
      id, systemId, controlId, control, domain, category,
      applicable, assessed: true, inherited: inherited && !inScope, certification,
      basis, levels, rawScore: raw, score: display(raw), band: assuranceBand(display(raw)),
      instances, ladderInversions, owners,
      explanation: PRISMA_LEVELS.map((l) => `${l} ${levels[l].rating}: ${levels[l].rationale}`).join(" "),
    };
  }

  // Built once per system. Every coverage figure, rollup and control matrix
  // reads these rather than recomputing, so there is exactly one assessment of
  // any control on any system.
  const assessmentsBySystem: Record<string, ControlAssessment[]> = {};
  graph.systems.forEach((s) => {
    assessmentsBySystem[s.id] = applicability
      .applicableControlsForSystem(s.id)
      .map((c) => assessControl(s.id, c.id));
  });

  const assessmentByPair: Record<string, ControlAssessment> = {};
  Object.values(assessmentsBySystem).forEach((list) =>
    list.forEach((a) => (assessmentByPair[`${a.systemId}::${a.controlId}`] = a))
  );

  function assessmentsForSystem(systemId: SystemId): ControlAssessment[] {
    return assessmentsBySystem[systemId] ?? [];
  }

  function assessmentFor(systemId: SystemId, controlId: ControlId): ControlAssessment | null {
    return assessmentByPair[`${systemId}::${controlId}`] ?? null;
  }

  // Every instance touching one asset, across every control assessed on its
  // system. This is the asset diagnostic — what an asset carries instead of a
  // score, and the reverse of the drill-down.
  const instancesByAsset: Record<string, ControlInstance[]> = {};
  Object.values(assessmentsBySystem).forEach((list) =>
    list.forEach((a) => a.instances.forEach((i) => (instancesByAsset[i.assetId] ||= []).push(i)))
  );

  function instancesForAsset(assetId: AssetId): ControlInstance[] {
    return instancesByAsset[assetId] ?? [];
  }

  return {
    assessControl,
    assessmentsForSystem,
    assessmentFor,
    instancesForAsset,
    activityOverdue,
  };
}

export type AssessmentApi = ReturnType<typeof createAssessment>;
