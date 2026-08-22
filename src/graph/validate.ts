// Structural integrity. Takes a Graph, throws on the first bad fact set.
//
// The point of a graph is that a fact lives in one place and everything else
// points at it. That only holds if a pointer that doesn't resolve is loud.
// Without this, a typo'd asset id in a data flow silently produces an edge to
// nowhere and a map that quietly omits a hop; a control id that doesn't exist
// silently produces a control with no framework mappings and a compliance page
// that undercounts. Both are worse than a crash, because both look fine.
//
// Structural checks only — anything needing a derived value lives in
// engine/validateDerivations.ts, since deriving it requires the engine and the
// graph must stay free of scoring.
//
// PORTED FROM validate.js: this used to run as an import side effect and assert
// against the ACME modules directly, which meant it could only ever check one
// dataset — the one it imported. Taking a Graph is what lets a YAML directory
// or a Postgres query be held to the identical standard, and it is why
// loadGraph() can promise that anything it returns has been checked.
//
// Note what is imported below and what isn't. The VOCABULARIES come in as
// modules (ASSET_KINDS, FLOW_KINDS, ORG_KINDS...) because they are schema —
// they describe what a fact is permitted to say, and every dataset shares them.
// Not one FACT is imported; those all arrive on the graph.
import {
  CLASSIFICATION_TIERS, ASSURANCE_CATEGORIES, EVIDENCE_TYPES,
  PRISMA_LEVELS, COMPLIANCE_RATINGS, isComplianceRating,
} from "./nodes/taxonomy";
import {
  HOSTING_TYPES, INHERITED_DOMAINS, AVAILABILITY_TIERS, DATA_SUBJECT_TYPES,
  SYSTEM_REGULATORY_CONTEXTS, NETWORK_EXPOSURES, SECURITY_OBJECTIVES, isImpactLevel,
  inheritsDomain,
} from "./nodes/systems";
import { ASSET_KINDS, IMPACT_LEVELS } from "./nodes/assets";
import { REGULATORY_FLAGS } from "./nodes/dataTypes";
import { DOMAINS, FRAMEWORKS } from "./nodes/controls";
import { CERTIFICATION_REPORT_TYPES, HITRUST_R2_STANDARD } from "./nodes/providerCertifications";
import { SHARED_RESPONSIBILITY_DOMAINS } from "./edges/controlImplementations";
import { REVIEW_BUCKETS, REVIEW_STANCES } from "./edges/controlReviews";
import { ACTIVITY_FREQUENCIES, PERIODS_PER_YEAR } from "./nodes/scheduledActivities";
import { EVIDENCE_COLLECTOR_TYPES, EVIDENCE_RECORD_STATUSES, EVIDENCE_RESULTS, INDEPENDENCE_LEVELS } from "./nodes/evidence";
import { ARTIFACT_SENSITIVITIES, EVIDENCE_REVIEW_DECISIONS } from "./nodes/evidenceProvenance";
import { SEVERITY_LEVELS, LIKELIHOOD_LEVELS } from "./nodes/risks";
import { DATA_ROLE_META } from "./edges/assetDataTypes";
import { FLOW_KINDS } from "./edges/dataFlows";
import { CONTRIBUTOR_ROLES } from "./edges/riskContributors";
import { ORG_KINDS } from "./nodes/orgs";
import { REMEDIATION_STATUSES, FINDING_SEVERITIES, FINDING_SOURCES } from "./nodes/findings";
import { ACTOR_KINDS } from "./nodes/actors";
import { ACTOR_DIRECTIONS } from "./edges/actorAccess";
import { IDENTITY_TYPES } from "./nodes/identity";
import {
  AGENT_AUTONOMY_LEVELS,
  AGENT_CREDENTIAL_TYPES,
  AGENT_PRIVILEGE_LEVELS,
  AGENT_REVOCATION_MECHANISMS,
} from "./nodes/agenticIdentities";
import { EGRESS_POSTURE, ADMIN_POSTURE, API_POSTURE, EXTERNAL_SERVICE_KINDS, DANGEROUS_CONDITIONS } from "./nodes/exposure";
import { SECURITY_TEST_TYPES } from "./nodes/securityTests";
import { IR_FUNCTIONS } from "./nodes/irExercises";
import { VENDOR_CATEGORIES, VENDOR_CRITICALITY } from "./nodes/vendors";
import type { Graph } from "./types";

export function validateGraph(graph: Graph, options: { throwOnFailure?: boolean } = {}): string[] {
  const { throwOnFailure = true } = options;
  const problems: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };

  const has = (index: Record<string, unknown>, key: string) => Object.hasOwn(index, key);

  // ---- Nodes -----------------------------------------------------------------
  const idsSeen = new Set<string>();
  [...graph.systems, ...graph.assets, ...graph.dataTypes, ...graph.evidence, ...graph.evidenceArtifacts, ...graph.evidenceReviews, ...graph.risks, ...graph.dataFlows, ...graph.agenticIdentities]
    .forEach((n) => {
      check(!idsSeen.has(n.id), `duplicate node id "${n.id}" — ids must be unique across the whole graph`);
      idsSeen.add(n.id);
    });

  graph.systems.forEach((s) => {
    check(HOSTING_TYPES.includes(s.hostingType), `system ${s.id}: hostingType "${s.hostingType}" is not one of ${HOSTING_TYPES.join(", ")}`);
    check(Object.hasOwn(INHERITED_DOMAINS, s.hostingType), `system ${s.id}: no inherited-domain list for hosting type "${s.hostingType}"`);

    (INHERITED_DOMAINS[s.hostingType] || []).forEach((d) =>
      check(DOMAINS.includes(d), `system ${s.id}: inherited domain "${d}" is not an SCF domain`)
    );
    s.roles.forEach((r) =>
      check(has(graph.orgById, r.ownerId), `system ${s.id} role "${r.role}": ownerId "${r.ownerId}" is not an org`)
    );
    check(AVAILABILITY_TIERS.includes(s.availabilityTier), `system ${s.id}: availabilityTier "${s.availabilityTier}" is not one of ${AVAILABILITY_TIERS.join(", ")}`);
    SECURITY_OBJECTIVES.forEach((objective) => {
      const entry = s.securityCategory?.[objective];
      check(Boolean(entry), `system ${s.id}: securityCategory.${objective} is missing`);
      if (!entry) return;
      check(isImpactLevel(entry.impact), `system ${s.id}: securityCategory.${objective}.impact "${String(entry.impact)}" is not one of ${IMPACT_LEVELS.join(", ")} (FIPS 199 Low / Moderate / High)`);
      check(typeof entry.reason === "string", `system ${s.id}: securityCategory.${objective}.reason must be a string`);
    });
    check(Number.isInteger(s.userCount) && s.userCount >= 0, `system ${s.id}: userCount must be a non-negative integer`);
    check(s.regions.length > 0, `system ${s.id}: regions must name at least one region`);
    check(s.dataProfile.approxRecords >= 0, `system ${s.id}: dataProfile.approxRecords must be non-negative`);
    check(s.dataProfile.residency.length > 0, `system ${s.id}: dataProfile.residency must name at least one jurisdiction`);
    check(Boolean(s.dataProfile.retention?.trim()), `system ${s.id}: dataProfile.retention needs a value`);
    s.dataProfile.subjects.forEach((subj) =>
      check(DATA_SUBJECT_TYPES.includes(subj), `system ${s.id}: dataProfile subject "${subj}" is not one of ${DATA_SUBJECT_TYPES.join(", ")}`)
    );
    s.regulatoryContext.forEach((r) =>
      check(SYSTEM_REGULATORY_CONTEXTS.includes(r), `system ${s.id}: regulatoryContext entry "${r}" is not one of ${SYSTEM_REGULATORY_CONTEXTS.join(", ")}`)
    );
    check(!(s.aiUsage.autonomousActions && !s.aiUsage.usesAI), `system ${s.id}: aiUsage.autonomousActions is true but aiUsage.usesAI is false — autonomous action implies AI usage`);
    s.onboardingProfile.identityTypes.forEach((t) =>
      check(IDENTITY_TYPES.includes(t), `system ${s.id}: onboardingProfile.identityTypes entry "${t}" is not one of ${IDENTITY_TYPES.join(", ")}`)
    );
    s.onboardingProfile.networkExposure.forEach((n) =>
      check(NETWORK_EXPOSURES.includes(n), `system ${s.id}: onboardingProfile.networkExposure entry "${n}" is not one of ${NETWORK_EXPOSURES.join(", ")}`)
    );
  });

  graph.assets.forEach((a) => {
    check(a.systemIds.length > 0, `asset ${a.id}: systemIds is empty — an asset in no system's boundary belongs to nobody's rollup`);
    a.systemIds.forEach((sid) => check(has(graph.systemById, sid), `asset ${a.id}: systemIds entry "${sid}" is not a system`));
    check(ASSET_KINDS.includes(a.kind), `asset ${a.id}: kind "${a.kind}" is not one of ASSET_KINDS — an unknown kind matches no applicability rule, which would silently exempt this asset from every control`);
    check(IMPACT_LEVELS.includes(a.impactLevel), `asset ${a.id}: impactLevel "${a.impactLevel}" is not one of ${IMPACT_LEVELS.join(", ")} (FIPS 199 Low / Moderate / High)`);
    check((graph.dataTypesByAsset[a.id] ?? []).length > 0, `asset ${a.id}: has no data-type edges, so its classification cannot be derived`);
  });

  graph.dataTypes.forEach((d) => {
    check(CLASSIFICATION_TIERS.includes(d.sensitivity), `data type ${d.id}: sensitivity "${d.sensitivity}" is not a classification tier`);
    d.regulatoryFlags.forEach((f) =>
      check(REGULATORY_FLAGS.includes(f), `data type ${d.id}: regulatoryFlags entry "${f}" is not one of ${REGULATORY_FLAGS.join(", ")}`)
    );
  });

  graph.keyControls.forEach((c) => {
    check(has(graph.controlById, c.id), `key control ${c.id}: not present in the control catalogue`);
    check(ASSURANCE_CATEGORIES.includes(c.category), `key control ${c.id}: resolves to category "${c.category}", which is not an assurance category`);
    check(c.frameworks.length > 0, `key control ${c.id}: has no framework clauses, so it is out of scope for every standard ACME certifies against and cannot be a key control`);
    check(["asset", "program"].includes(c.scope), `key control ${c.id}: scope "${c.scope}" must be "asset" or "program"`);
  });

  graph.evidence.forEach((e) => {
    check(has(graph.controlById, e.controlId), `evidence ${e.id}: controlId "${e.controlId}" is not a real control`);
    check(has(graph.keyControlById, e.controlId), `evidence ${e.id}: controlId "${e.controlId}" is not a key control — only key controls carry per-implementation evidence`);
    check(EVIDENCE_TYPES.includes(e.evidenceType), `evidence ${e.id}: evidenceType "${e.evidenceType}" is not a known evidence type`);
    if (e.prismaLevel) check(PRISMA_LEVELS.includes(e.prismaLevel), `evidence ${e.id}: prismaLevel "${e.prismaLevel}" is not a PRISMA level`);
    check(EVIDENCE_RESULTS.includes(e.result), `evidence ${e.id}: result "${e.result}" must be one of ${EVIDENCE_RESULTS.join(", ")}`);
    check(INDEPENDENCE_LEVELS.includes(e.independence), `evidence ${e.id}: independence "${e.independence}" is not a known level`);
    check(e.coveragePct >= 0 && e.coveragePct <= 100, `evidence ${e.id}: coveragePct ${e.coveragePct} is outside 0-100`);

    // Prevalence is optional, but half of it is worse than none: a population
    // with no exception count (or the reverse) would silently score as if no
    // counts were reported at all, which hides the fact that someone meant to
    // record one.
    const hasPop = e.population !== undefined;
    const hasExc = e.exceptions !== undefined;
    check(hasPop === hasExc, `evidence ${e.id}: population and exceptions must be given together — one without the other reads as no prevalence data at all`);
    if (hasPop && hasExc) {
      const population = e.population as number;
      const exceptions = e.exceptions as number;
      check(Number.isInteger(population) && population > 0, `evidence ${e.id}: population must be a positive integer`);
      check(Number.isInteger(exceptions) && exceptions >= 0, `evidence ${e.id}: exceptions must be a non-negative integer`);
      check(exceptions <= population, `evidence ${e.id}: ${exceptions} exceptions in a population of ${population} — more failures than members`);
      check(Boolean(e.populationUnit?.trim()), `evidence ${e.id}: needs a populationUnit so "${exceptions} of ${population}" says what is being counted`);
      // A passing collection that found exceptions is contradicting itself.
      check(!(e.result === "pass" && exceptions > 0), `evidence ${e.id}: result is "pass" but ${exceptions} exceptions were recorded — a collection that found breaches did not pass`);
      check(!(e.result !== "pass" && exceptions === 0), `evidence ${e.id}: result is "${e.result}" but zero exceptions were recorded — a failing collection has to name what failed`);
    }
    check(Number.isFinite(e.validForDays) && e.validForDays > 0, `evidence ${e.id}: validForDays must be a positive number`);
    check(!Number.isNaN(new Date(e.collectedAt).getTime()), `evidence ${e.id}: collectedAt "${e.collectedAt}" is not a parseable date`);
    if (e.periodStart) check(!Number.isNaN(new Date(e.periodStart).getTime()), `evidence ${e.id}: periodStart "${e.periodStart}" is not a parseable date`);
    if (e.periodEnd) check(!Number.isNaN(new Date(e.periodEnd).getTime()), `evidence ${e.id}: periodEnd "${e.periodEnd}" is not a parseable date`);
    if (e.periodStart && e.periodEnd) check(new Date(e.periodStart) <= new Date(e.periodEnd), `evidence ${e.id}: periodStart is after periodEnd`);
    if (e.ingestedAt) check(!Number.isNaN(new Date(e.ingestedAt).getTime()), `evidence ${e.id}: ingestedAt "${e.ingestedAt}" is not a parseable date`);
    if (e.collectorType) check(EVIDENCE_COLLECTOR_TYPES.includes(e.collectorType), `evidence ${e.id}: collectorType "${e.collectorType}" is not known`);
    if (e.recordStatus) check(EVIDENCE_RECORD_STATUSES.includes(e.recordStatus), `evidence ${e.id}: recordStatus "${e.recordStatus}" is not known`);
    (e.artifactIds ?? []).forEach((id) => check(has(graph.evidenceArtifactById, id), `evidence ${e.id}: artifactId "${id}" is not an evidence artifact`));
    if (e.supersedesId) {
      check(has(graph.evidenceById, e.supersedesId), `evidence ${e.id}: supersedesId "${e.supersedesId}" is not evidence`);
      check(e.supersedesId !== e.id, `evidence ${e.id}: cannot supersede itself`);
      const previous = graph.evidenceById[e.supersedesId];
      if (previous) {
        check(previous.controlId === e.controlId, `evidence ${e.id}: cannot supersede ${previous.id} for a different control`);
        check(previous.recordStatus === "superseded", `evidence ${e.id}: superseded record ${previous.id} must be marked superseded`);
      }
    }
    e.assetIds.forEach((id) => check(has(graph.assetById, id), `evidence ${e.id}: assetId "${id}" is not an asset`));

    const keyControl = graph.keyControlById[e.controlId];
    if (keyControl?.scope === "program") {
      check(e.assetIds.length === 0, `evidence ${e.id}: ${e.controlId} is program-scoped, so this record must not name assets`);
    } else if (keyControl) {
      check(e.assetIds.length > 0, `evidence ${e.id}: ${e.controlId} is asset-scoped, so this record must name the assets it was collected across`);
    }

    if (e.findingId) {
      const finding = graph.findings.find((f) => f.id === e.findingId);
      check(Boolean(finding), `evidence ${e.id}: findingId "${e.findingId}" is not a finding`);
      if (finding) {
        check(finding.controlId === e.controlId, `evidence ${e.id}: findingId "${e.findingId}" is filed against control ${finding.controlId}, but this record is for ${e.controlId}`);
        check(e.assetIds.includes(finding.assetId), `evidence ${e.id}: findingId "${e.findingId}" is filed against asset ${finding.assetId}, which this record doesn't name`);
      }
    }
  });

  // Two observations citing the same source name but disagreeing about what kind
  // of source it is: either two different tools sharing a name, or a typo.
  check(graph.sourceConflicts.length === 0, `evidence sources: ${graph.sourceConflicts.join("; ")}`);

  graph.risks.forEach((r) => {
    check(SEVERITY_LEVELS.includes(r.inherent.severity), `risk ${r.id}: inherent severity "${r.inherent.severity}" is not a severity level`);
    check(SEVERITY_LEVELS.includes(r.residual.severity), `risk ${r.id}: residual severity "${r.residual.severity}" is not a severity level`);
    check(LIKELIHOOD_LEVELS.includes(r.inherent.likelihood), `risk ${r.id}: inherent likelihood "${r.inherent.likelihood}" is not a likelihood level`);
    check(LIKELIHOOD_LEVELS.includes(r.residual.likelihood), `risk ${r.id}: residual likelihood "${r.residual.likelihood}" is not a likelihood level`);
    check(has(graph.orgById, r.ownerId), `risk ${r.id}: ownerId "${r.ownerId}" is not an org`);
  });

  graph.facts.boardMaterialRiskIds.forEach((id) =>
    check(has(graph.riskById, id), `boardMaterialRiskIds references "${id}", which is not in the risk register`)
  );

  // A tier whose weights quietly summed to 95 instead of 100 would rescale every
  // asset at that tier without anything looking wrong, so this is checked rather
  // than trusted.
  CLASSIFICATION_TIERS.forEach((tier) => {
    const weights = graph.categoryWeights[tier];
    check(Boolean(weights), `controlProfile: no category weights defined for tier "${tier}"`);
    if (!weights) return;
    ASSURANCE_CATEGORIES.forEach((c) =>
      check(Number.isFinite(weights[c]) && weights[c] > 0, `controlProfile: tier "${tier}" has no positive weight for "${c}" — a zero weight would silently exclude a category from the score`)
    );
    Object.keys(weights).forEach((c) =>
      check(ASSURANCE_CATEGORIES.includes(c as (typeof ASSURANCE_CATEGORIES)[number]), `controlProfile: tier "${tier}" weights an unknown category "${c}"`)
    );
    const total = ASSURANCE_CATEGORIES.reduce((a, c) => a + (weights[c] ?? 0), 0);
    check(total === 100, `controlProfile: tier "${tier}" weights sum to ${total}, not 100`);
  });

  // The tier baseline has to name a real maturity stage and evidence type for
  // every tier, or an asset at that tier is measured against nothing.
  CLASSIFICATION_TIERS.forEach((tier) => {
    const base = graph.facts.controlProfile.tierBaseline[tier];
    check(Boolean(base), `controlProfile: no tier baseline for "${tier}"`);
    if (!base) return;
    check(PRISMA_LEVELS.includes(base.maturity), `controlProfile: tier "${tier}" baseline maturity "${base.maturity}" is not a PRISMA level`);
    check(EVIDENCE_TYPES.includes(base.evidence), `controlProfile: tier "${tier}" baseline evidence "${base.evidence}" is not an evidence type`);
  });

  // ---- Edges -------------------------------------------------------------------
  graph.assetDataTypes.forEach((e, i) => {
    check(has(graph.assetById, e.assetId), `assetDataTypes[${i}]: assetId "${e.assetId}" is not an asset`);
    check(has(graph.dataTypeById, e.dataTypeId), `assetDataTypes[${i}]: dataTypeId "${e.dataTypeId}" is not a data type`);
    check(Object.hasOwn(DATA_ROLE_META, e.role), `assetDataTypes[${i}]: role "${e.role}" is not a known data role`);
  });

  graph.dataFlows.forEach((f) => {
    check(has(graph.assetById, f.from), `data flow ${f.id}: from "${f.from}" is not an asset`);
    check(has(graph.assetById, f.to), `data flow ${f.id}: to "${f.to}" is not an asset`);
    check(f.from !== f.to, `data flow ${f.id}: connects an asset to itself`);
    check(Object.values(FLOW_KINDS).includes(f.kind), `data flow ${f.id}: kind "${f.kind}" is not a known flow kind`);
    check(f.dataTypeIds.length > 0, `data flow ${f.id}: carries no data types — an edge with nothing on it is not a relationship`);
    f.dataTypeIds.forEach((id) => check(has(graph.dataTypeById, id), `data flow ${f.id}: dataTypeId "${id}" is not a data type`));

    const from = graph.assetById[f.from];
    const to = graph.assetById[f.to];
    if (from && to) {
      if (f.kind === FLOW_KINDS.BACKUP) {
        check(to.kind === "backup-vault", `backup flow ${f.id}: must terminate at a backup-vault asset`);
      }
      if (f.kind === FLOW_KINDS.RESTORE) {
        check(from.kind === "backup-vault", `restore flow ${f.id}: must originate from a backup-vault asset`);
      }
      check(
        from.systemIds.some((sid) => to.systemIds.includes(sid)),
        `data flow ${f.id}: crosses from {${from.systemIds}} to {${to.systemIds}} — no shared system boundary, and cross-system flows change what each boundary is responsible for and need to be modelled deliberately, not appear by accident`
      );
    }
  });

  // The category-assessment checks lived here: every asset had to carry a
  // maturity stage, an evidence type and an effectiveness percentage for all six
  // assurance categories, 156 rows in total, because the assessed baseline was
  // what every non-key control fell back to.
  //
  // Both the rows and the fallback are gone. A control is now rated once against
  // a system across the five PRISMA levels, from facts that already existed —
  // policy citations, SOP steps, evidence, the activity calendar — and a control
  // nobody assessed is reported as unassessed instead of inheriting a number
  // from a judgment typed against its category.

  graph.applicabilityRules.forEach((r, i) => {
    check(has(graph.keyControlById, r.controlId), `applicability rule[${i}]: controlId "${r.controlId}" is not a key control`);
    check(graph.keyControlById[r.controlId]?.scope === "asset", `applicability rule[${i}]: ${r.controlId} is program-scoped — program controls apply by definition and must not carry asset rules`);
    const { assetKinds, minClassification, hostingTypes } = r.requiredWhen;
    (assetKinds || []).forEach((k) => check(ASSET_KINDS.includes(k), `applicability rule[${i}] (${r.controlId}): assetKind "${k}" is not a known asset kind`));
    (hostingTypes || []).forEach((h) => check(HOSTING_TYPES.includes(h), `applicability rule[${i}] (${r.controlId}): hostingType "${h}" is not known`));
    check(!minClassification || CLASSIFICATION_TIERS.includes(minClassification), `applicability rule[${i}] (${r.controlId}): minClassification "${minClassification}" is not a tier`);
  });

  // Every asset-scoped key control needs at least one rule, or it silently
  // applies nowhere.
  graph.assetScopedControls.forEach((c) => {
    check(
      (graph.rulesByControl[c.id] ?? []).length > 0,
      `key control ${c.id} is asset-scoped but has no applicability rule, so it would apply to nothing`
    );
  });

  // The tier baselines are policy: every id must be a real, in-scope control,
  // and a lower tier must never require a control a higher tier drops — a
  // Restricted system relaxing below Confidential is a data-entry mistake,
  // not a tailoring decision.
  Object.entries(graph.controlBaselines).forEach(([tier, controlIds]) => {
    check(CLASSIFICATION_TIERS.includes(tier as (typeof CLASSIFICATION_TIERS)[number]), `control baseline "${tier}" is not a classification tier`);
    const seen = new Set<string>();
    (controlIds ?? []).forEach((id) => {
      check(has(graph.controlById, id), `control baseline ${tier}: "${id}" is not a control`);
      check((graph.controlById[id]?.frameworks.length ?? 0) > 0, `control baseline ${tier}: ${id} cites no framework clause, so it is out of scope everywhere and cannot be baselined`);
      check(!seen.has(id), `control baseline ${tier}: "${id}" is listed twice`);
      seen.add(id);
    });
  });
  for (let i = 0; i < CLASSIFICATION_TIERS.length - 1; i++) {
    const lower = graph.controlBaselines[CLASSIFICATION_TIERS[i]];
    const higher = graph.controlBaselines[CLASSIFICATION_TIERS[i + 1]];
    if (!lower || !higher) continue;
    const higherSet = new Set(higher);
    lower.forEach((id) => {
      check(higherSet.has(id), `control baseline: ${CLASSIFICATION_TIERS[i]} requires ${id} but ${CLASSIFICATION_TIERS[i + 1]} does not — baselines must be monotonic up the tier ladder`);
    });
  }

  graph.applicabilityExceptions.forEach((e) => {
    check(has(graph.assetById, e.assetId), `applicability exception: assetId "${e.assetId}" is not an asset`);
    check(has(graph.keyControlById, e.controlId), `applicability exception: controlId "${e.controlId}" is not a key control`);
    check(Boolean(e.reason?.trim()), `applicability exception ${e.assetId}/${e.controlId}: needs a reason — "not applicable" without one is indistinguishable from "nobody looked"`);
  });

  graph.implementationOverrides.forEach((o) => {
    check(has(graph.assetById, o.assetId), `implementation override: assetId "${o.assetId}" is not an asset`);
    check(has(graph.keyControlById, o.controlId), `implementation override: controlId "${o.controlId}" is not a key control`);
    check(PRISMA_LEVELS.includes(o.maturityStage), `implementation override ${o.assetId}/${o.controlId}: maturityStage "${o.maturityStage}" is not a PRISMA level`);
    check(Boolean(o.note?.trim()), `implementation override ${o.assetId}/${o.controlId}: needs a note explaining why it differs from the category baseline`);
    if (o.findingId) {
      const finding = graph.findings.find((f) => f.id === o.findingId);
      check(Boolean(finding), `implementation override ${o.assetId}/${o.controlId}: findingId "${o.findingId}" is not a finding`);
      if (finding) {
        check(
          finding.assetId === o.assetId && finding.controlId === o.controlId,
          `implementation override ${o.assetId}/${o.controlId}: findingId "${o.findingId}" points at a finding filed against ${finding.assetId}/${finding.controlId} instead`
        );
      }
    }
  });

  graph.notImplemented.forEach((n) => {
    check(has(graph.assetById, n.assetId), `not-implemented declaration: assetId "${n.assetId}" is not an asset`);
    check(has(graph.keyControlById, n.controlId), `not-implemented declaration: controlId "${n.controlId}" is not a key control`);
    check(Boolean(n.reason?.trim()), `not-implemented declaration ${n.assetId}/${n.controlId}: needs a reason`);
  });

  Object.entries(graph.ownership).forEach(([scope, byCategory]) => {
    check(scope === "program" || has(graph.systemById, scope), `ownership: "${scope}" is neither a system id nor "program"`);
    ASSURANCE_CATEGORIES.forEach((c) => {
      const ids = byCategory[c];
      check(Array.isArray(ids) && ids.length > 0, `ownership[${scope}]: no owner for "${c}"`);
      (ids || []).forEach((id) => check(has(graph.orgById, id), `ownership[${scope}][${c}]: ownerId "${id}" is not an org`));
    });
  });

  graph.ownerOverrides.forEach((o) => {
    check(has(graph.assetById, o.assetId), `owner override: assetId "${o.assetId}" is not an asset`);
    check(has(graph.keyControlById, o.controlId), `owner override: controlId "${o.controlId}" is not a key control`);
    check(Array.isArray(o.ownerIds) && o.ownerIds.length > 0, `owner override ${o.assetId}/${o.controlId}: needs at least one ownerId`);
    (o.ownerIds || []).forEach((id) => check(has(graph.orgById, id), `owner override ${o.assetId}/${o.controlId}: ownerId "${id}" is not an org`));
    check(Boolean(o.note?.trim()), `owner override ${o.assetId}/${o.controlId}: needs a note explaining why it differs from the system+category default`);
  });

  graph.orgs.forEach((o) => {
    check(Object.values(ORG_KINDS).includes(o.kind), `org ${o.id}: kind "${o.kind}" is not a known org kind`);
    check(!o.parentId || has(graph.orgById, o.parentId), `org ${o.id}: parentId "${o.parentId}" is not an org`);
  });
  check(new Set(graph.orgs.map((o) => o.id)).size === graph.orgs.length, `orgs: duplicate id`);

  graph.findings.forEach((f) => {
    check(has(graph.assetById, f.assetId), `finding ${f.id}: assetId "${f.assetId}" is not an asset`);
    check(has(graph.keyControlById, f.controlId), `finding ${f.id}: controlId "${f.controlId}" is not a key control`);
    check(has(graph.orgById, f.ownerId), `finding ${f.id}: ownerId "${f.ownerId}" is not an org`);
    check(REMEDIATION_STATUSES.includes(f.remediationStatus), `finding ${f.id}: remediationStatus "${f.remediationStatus}" is not one of ${REMEDIATION_STATUSES.join(", ")}`);
    check(!Number.isNaN(new Date(f.due).getTime()), `finding ${f.id}: due "${f.due}" is not a parseable date`);
    check(Boolean(f.title?.trim()), `finding ${f.id}: needs a title`);
    check(!f.severity || FINDING_SEVERITIES.includes(f.severity), `finding ${f.id}: severity "${f.severity}" is not one of ${FINDING_SEVERITIES.join(", ")}`);
    check(!f.source || FINDING_SOURCES.includes(f.source), `finding ${f.id}: source "${f.source}" is not one of ${FINDING_SOURCES.join(", ")}`);

    check(!f.remediationOwnerId || has(graph.orgById, f.remediationOwnerId), `finding ${f.id}: remediationOwnerId "${f.remediationOwnerId}" is not an org`);
    check(!f.targetDate || !Number.isNaN(new Date(f.targetDate).getTime()), `finding ${f.id}: targetDate "${f.targetDate}" is not a parseable date`);
    check(!f.closedDate || !Number.isNaN(new Date(f.closedDate).getTime()), `finding ${f.id}: closedDate "${f.closedDate}" is not a parseable date`);
    (f.closureEvidenceIds ?? []).forEach((id) => {
      check(has(graph.evidenceById, id), `finding ${f.id}: closureEvidenceIds references "${id}", which is not an evidence record`);
    });
    check(
      f.remediationStatus !== "Complete" || Boolean(f.closedDate),
      `finding ${f.id}: remediationStatus is Complete but closedDate is missing`
    );
  });
  check(new Set(graph.findings.map((f) => f.id)).size === graph.findings.length, `findings: duplicate id`);

  graph.actors.forEach((a) => {
    check(Object.values(ACTOR_KINDS).includes(a.kind), `actor ${a.id}: kind "${a.kind}" is not a known actor kind`);
    check(Boolean(a.description?.trim()), `actor ${a.id}: needs a description`);
  });
  check(new Set(graph.actors.map((a) => a.id)).size === graph.actors.length, `actors: duplicate id`);

  graph.actorAccess.forEach((a) => {
    check(has(graph.actorById, a.actorId), `actor access ${a.id}: actorId "${a.actorId}" is not an actor`);
    check(has(graph.assetById, a.assetId), `actor access ${a.id}: assetId "${a.assetId}" is not an asset`);
    check(Object.values(ACTOR_DIRECTIONS).includes(a.direction), `actor access ${a.id}: direction "${a.direction}" is not a known direction`);
  });
  check(new Set(graph.actorAccess.map((a) => a.id)).size === graph.actorAccess.length, `actor access: duplicate id`);

  graph.riskAssets.forEach((e, i) => {
    check(has(graph.riskById, e.riskId), `riskAssets[${i}]: riskId "${e.riskId}" is not a risk`);
    check(has(graph.assetById, e.assetId), `riskAssets[${i}]: assetId "${e.assetId}" is not an asset`);
    check(Object.values(CONTRIBUTOR_ROLES).includes(e.role), `riskAssets[${i}]: role "${e.role}" is not a contributor role`);
  });

  graph.riskControls.forEach((e, i) => {
    check(has(graph.riskById, e.riskId), `riskControls[${i}]: riskId "${e.riskId}" is not a risk`);
    check(has(graph.keyControlById, e.controlId), `riskControls[${i}]: controlId "${e.controlId}" is not a key control`);
  });

  // A risk with no edges has to say why. Silence here would leave a risk floating
  // exactly the way linkedControl used to, just without the string.
  graph.risks.forEach((r) => {
    const hasAssets = (graph.assetsByRisk[r.id] ?? []).length > 0;
    const hasControls = (graph.controlsByRisk[r.id] ?? []).length > 0;
    check(hasAssets || Object.hasOwn(graph.risksWithoutAssets, r.id), `risk ${r.id}: has no contributing assets and no entry in risksWithoutAssets explaining why`);
    check(hasControls || Object.hasOwn(graph.risksWithoutControls, r.id), `risk ${r.id}: has no linked controls and no entry in risksWithoutControls explaining why`);
  });

  // Explanations for edges that do exist are stale documentation pretending to be
  // a gap note.
  Object.keys(graph.risksWithoutAssets).forEach((id) =>
    check((graph.assetsByRisk[id] ?? []).length === 0, `risksWithoutAssets explains "${id}", but that risk now has asset edges — remove the stale explanation`)
  );
  Object.keys(graph.risksWithoutControls).forEach((id) =>
    check((graph.controlsByRisk[id] ?? []).length === 0, `risksWithoutControls explains "${id}", but that risk now has control edges — remove the stale explanation`)
  );

  // ---- Program artifacts --------------------------------------------------------
  // These three checks used to run inside src/data/procedures.js as a module-load
  // side effect, which meant they fired on import of a page rather than on
  // construction of a graph — and could not be exercised against a deliberately
  // broken fact set, because there was only ever one. They belong here now that
  // policies and SOPs are facts like any other.
  graph.procedures.forEach((p) => {
    const owned = new Set(p.controlIds);
    p.steps.forEach((step) => {
      (step.controls ?? []).forEach((id) =>
        check(
          owned.has(id),
          `procedure ${p.code} step "${step.title}" cites control ${id}, which isn't one of ${p.code}'s own derived controlIds — check the id or the step's SOP assignment`
        )
      );
    });
    check(
      graph.policies.some((pol) => pol.id === p.policyId),
      `procedure ${p.code}: policyId "${p.policyId}" doesn't match any policy in the library`
    );
  });

  // Every SCF domain belongs to exactly one SOP. Two SOPs claiming a domain would
  // double-count its controls in any coverage figure derived from procedures.
  const domainOwners: Record<string, string[]> = {};
  graph.procedures.forEach((p) => p.domains.forEach((d) => (domainOwners[d] ||= []).push(p.code)));
  Object.entries(domainOwners).forEach(([domain, owners]) =>
    check(owners.length === 1, `SCF domain "${domain}" is claimed by more than one SOP (${owners.join(", ")}) — the partition is what makes procedural coverage countable`)
  );

  // Review dates are what GOV-03 is measured from and what gates the maturity
  // ladder's bottom rung, so a malformed one silently grants a ceiling it
  // shouldn't.
  graph.policies.forEach((p) => {
    check(!Number.isNaN(Date.parse(p.created)), `policy ${p.code}: created "${p.created}" is not a parseable date`);
    check(!Number.isNaN(Date.parse(p.lastReviewed)), `policy ${p.code}: lastReviewed "${p.lastReviewed}" is not a parseable date`);
    check(
      Date.parse(p.lastReviewed) >= Date.parse(p.created),
      `policy ${p.code}: lastReviewed (${p.lastReviewed}) is before created (${p.created})`
    );
  });

  // A policy's `domains` is the other half of its `controlIds`, and the PRISMA
  // Policy level reads both: a control no policy names is still governed if the
  // library claims its area. That distinction only means something if the areas
  // are exhaustive, so an SCF domain no policy claims is a hole in the library
  // rather than a low score on one control.
  graph.policies.forEach((p) =>
    p.domains.forEach((d) => check(DOMAINS.includes(d), `policy ${p.code}: domain "${d}" is not an SCF domain`))
  );
  DOMAINS.forEach((d) =>
    check(
      (graph.policiesByDomain[d] ?? []).length > 0,
      `SCF domain "${d}" is claimed by no policy — every domain needs a policy governing it, or controls in it have no documented basis at all`
    )
  );

  graph.procedures.forEach((p) => {
    check(p.reviewCadence.trim().length > 0, `procedure ${p.code}: needs a review cadence — an SOP nobody revisits supports a weaker claim than one that is maintained, and the Procedure level reads this`);
    check(EVIDENCE_TYPES.includes(p.evidenceType), `procedure ${p.code}: evidenceType "${p.evidenceType}" is not one of ${EVIDENCE_TYPES.join(", ")}`);
  });

  // ---- Scheduled activities -------------------------------------------------
  // The Managed level stands entirely on these, so a citation pointing at
  // nothing silently reads as "this control is not managed" rather than as the
  // typo it is.
  graph.scheduledActivities.forEach((a) => {
    check(ACTIVITY_FREQUENCIES.includes(a.frequency), `scheduled activity "${a.id}": frequency "${a.frequency}" is not one of ${ACTIVITY_FREQUENCIES.join(", ")}`);
    a.controlIds.forEach((id) =>
      check(has(graph.controlById, id), `scheduled activity "${a.id}": cites control "${id}", which is not a real control`)
    );
    check(
      graph.procedures.some((p) => p.id === a.procedureId),
      `scheduled activity "${a.id}": procedureId "${a.procedureId}" doesn't match any procedure`
    );
    check(a.instances.length > 0, `scheduled activity "${a.id}": has no instances — a cadence with no calendar behind it is a claim, not a schedule`);
    const expected = PERIODS_PER_YEAR[a.frequency];
    check(
      expected === undefined || a.instances.length === expected,
      `scheduled activity "${a.id}": is ${a.frequency} but has ${a.instances.length} instances, expected ${expected}`
    );
    a.instances.forEach((inst) => {
      check(!Number.isNaN(Date.parse(inst.dueDate)), `scheduled activity "${a.id}" period ${inst.period}: dueDate "${inst.dueDate}" is not a parseable date`);
      check(
        expected === undefined || (inst.period >= 1 && inst.period <= expected),
        `scheduled activity "${a.id}": period ${inst.period} is outside 1..${expected} for a ${a.frequency} cadence`
      );
    });
  });

  // ---- Assessment scope -----------------------------------------------------
  // The declared scope is checked against the facts in both directions by
  // engine/validateDerivations.ts. What is checkable here is that it is
  // well-formed and that it covers every system: a system with no scope would
  // score against nothing and report a coverage of zero, which reads as a
  // catastrophic finding when it is actually a missing file.
  const scopedSystems: Record<string, number> = {};
  graph.assessmentScopes.forEach((s, i) => {
    check(has(graph.systemById, s.systemId), `assessmentScopes[${i}]: systemId "${s.systemId}" is not a system`);
    scopedSystems[s.systemId] = (scopedSystems[s.systemId] ?? 0) + 1;

    check(s.engagement.trim().length > 0, `assessment scope for ${s.systemId}: needs an engagement name`);
    check(s.assessor.trim().length > 0, `assessment scope for ${s.systemId}: needs an assessor — a coverage figure nobody signed is not an assessment`);
    check(s.samplingRationale.trim().length > 0, `assessment scope for ${s.systemId}: needs a sampling rationale — why these statements and not others is the part most likely to be argued with`);
    check(!Number.isNaN(Date.parse(s.periodStart)), `assessment scope for ${s.systemId}: periodStart "${s.periodStart}" is not a parseable date`);
    check(!Number.isNaN(Date.parse(s.periodEnd)), `assessment scope for ${s.systemId}: periodEnd "${s.periodEnd}" is not a parseable date`);
    check(Date.parse(s.periodEnd) >= Date.parse(s.periodStart), `assessment scope for ${s.systemId}: periodEnd (${s.periodEnd}) is before periodStart (${s.periodStart})`);

    const seen = new Set<string>();
    s.controlIds.forEach((id) => {
      check(has(graph.controlById, id), `assessment scope for ${s.systemId}: control "${id}" is not a real control`);
      check(
        graph.inScopeControls.some((c) => c.id === id),
        `assessment scope for ${s.systemId}: control "${id}" cites no framework clause, so it is out of scope for every standard ACME certifies against and cannot be assessed`
      );
      check(!seen.has(id), `assessment scope for ${s.systemId}: duplicate control "${id}" — it would be counted twice in the coverage denominator`);
      seen.add(id);
    });
  });
  graph.systems.forEach((s) =>
    check(scopedSystems[s.id] === 1, `system ${s.id}: has ${scopedSystems[s.id] ?? 0} assessment scopes, expected exactly 1`)
  );

  // ---- Provider certifications ----------------------------------------------
  graph.providerCertifications.forEach((c) => {
    check(
      graph.systems.some((s) => s.provider === c.provider),
      `certification ${c.id}: provider "${c.provider}" does not match any system's provider`
    );
    check(
      FRAMEWORKS.includes(c.standard) || c.standard === HITRUST_R2_STANDARD,
      `certification ${c.id}: standard "${c.standard}" is not one of ${[...FRAMEWORKS, HITRUST_R2_STANDARD].join(", ")}`
    );
    check(CERTIFICATION_REPORT_TYPES.includes(c.reportType), `certification ${c.id}: reportType "${c.reportType}" is not one of ${CERTIFICATION_REPORT_TYPES.join(", ")}`);
    check(EVIDENCE_TYPES.includes(c.evidenceType), `certification ${c.id}: evidenceType "${c.evidenceType}" is not one of ${EVIDENCE_TYPES.join(", ")}`);
    check(!Number.isNaN(Date.parse(c.issuedAt)), `certification ${c.id}: issuedAt "${c.issuedAt}" is not a parseable date`);
    check(c.validForDays > 0, `certification ${c.id}: validForDays must be positive`);
    check(c.reference.trim().length > 0, `certification ${c.id}: needs a reference naming the actual report`);
    c.domains.forEach((d) => check(DOMAINS.includes(d), `certification ${c.id}: domain "${d}" is not an SCF domain`));
  });

  // The check this file exists for. INHERITED_DOMAINS lets a system decline to
  // assess a whole domain on the grounds that its provider handles it; that is
  // only an assurance position if there is a report behind it. Without this,
  // adding a domain to INHERITED_DOMAINS silently converts unassessed controls
  // into scored ones backed by nothing.
  graph.systems.forEach((s) => {
    const covered = new Set((graph.certificationsByProvider[s.provider] ?? []).flatMap((c) => c.domains));
    (INHERITED_DOMAINS[s.hostingType] || []).forEach((d) =>
      check(
        covered.has(d),
        `system ${s.id} inherits "${d}" from ${s.provider}, but no certification held by ${s.provider} covers that domain — inheritance without a report is an unbacked claim`
      )
    );
  });

  // ---- Enterprise attestations ------------------------------------------------
  // No "claimed but unbacked" check is needed here the way provider
  // certifications need one: graph.enterpriseInheritedDomains is DERIVED from
  // these records (assemble.ts), so a domain can't be claimed inherited
  // without one already backing it — the drift the provider-certification
  // check exists to catch structurally cannot happen on this side.
  graph.enterpriseAttestations.forEach((a) => {
    check(has(graph.orgById, a.ownerOrgId), `enterprise attestation ${a.id}: ownerOrgId "${a.ownerOrgId}" is not an org`);
    check(CERTIFICATION_REPORT_TYPES.includes(a.reportType), `enterprise attestation ${a.id}: reportType "${a.reportType}" is not one of ${CERTIFICATION_REPORT_TYPES.join(", ")}`);
    check(EVIDENCE_TYPES.includes(a.evidenceType), `enterprise attestation ${a.id}: evidenceType "${a.evidenceType}" is not one of ${EVIDENCE_TYPES.join(", ")}`);
    check(!Number.isNaN(Date.parse(a.assessedAt)), `enterprise attestation ${a.id}: assessedAt "${a.assessedAt}" is not a parseable date`);
    check(a.validForDays > 0, `enterprise attestation ${a.id}: validForDays must be positive`);
    check(a.reference.trim().length > 0, `enterprise attestation ${a.id}: needs a reference naming the actual review`);
    check(a.domains.length > 0, `enterprise attestation ${a.id}: names no domains — an attestation covering nothing inherits nothing`);
    a.domains.forEach((d) => check(DOMAINS.includes(d), `enterprise attestation ${a.id}: domain "${d}" is not an SCF domain`));
  });

  // ---- Shared-responsibility domains -------------------------------------------
  SHARED_RESPONSIBILITY_DOMAINS.forEach((d) =>
    check(DOMAINS.includes(d), `SHARED_RESPONSIBILITY_DOMAINS names "${d}", which is not an SCF domain`)
  );

  // ---- Pending applicability ---------------------------------------------------
  graph.pendingApplicability.forEach((p, i) => {
    check(has(graph.systemById, p.systemId), `pendingApplicability[${i}]: systemId "${p.systemId}" is not a system`);
    check(has(graph.controlById, p.controlId), `pendingApplicability[${i}]: controlId "${p.controlId}" is not a real control`);
    check(p.reason.trim().length > 0, `pendingApplicability[${i}]: needs a reason — pending without a stated question isn't distinguishable from forgotten`);
    check(
      !graph.exceptionByPair[`${p.systemId}::${p.controlId}`],
      `pendingApplicability[${i}]: ${p.systemId}/${p.controlId} is also recorded as an applicability exception — a control can't be both an already-made decision and an open one`
    );
  });
  const pendingKeys: Record<string, number> = {};
  graph.pendingApplicability.forEach((p) => {
    const k = `${p.systemId}::${p.controlId}`;
    pendingKeys[k] = (pendingKeys[k] ?? 0) + 1;
  });
  Object.entries(pendingKeys).forEach(([k, n]) => check(n === 1, `pendingApplicability: ${k} listed ${n} times, expected at most once`));

  // ---- PRISMA overrides ------------------------------------------------------
  const overrideKeys: Record<string, number> = {};
  graph.prismaOverrides.forEach((o, i) => {
    check(has(graph.systemById, o.systemId), `prismaOverrides[${i}]: systemId "${o.systemId}" is not a system`);
    check(has(graph.controlById, o.controlId), `prismaOverrides[${i}]: controlId "${o.controlId}" is not a real control`);
    check(PRISMA_LEVELS.includes(o.level), `prismaOverrides[${i}]: level "${o.level}" is not a PRISMA level (${PRISMA_LEVELS.join(", ")})`);
    check(isComplianceRating(o.rating), `prismaOverrides[${i}]: rating ${o.rating} is not a compliance rating (${COMPLIANCE_RATINGS.join(", ")})`);
    check(o.note.trim().length > 0, `prismaOverrides[${i}]: needs a note — an override with no argument behind it is just a different number`);
    check(o.assessedBy.trim().length > 0, `prismaOverrides[${i}]: needs an assessedBy`);
    check(!Number.isNaN(Date.parse(o.assessedAt)), `prismaOverrides[${i}]: assessedAt "${o.assessedAt}" is not a parseable date`);

    if (o.findingId !== undefined) {
      const finding = graph.findings.find((f) => f.id === o.findingId);
      check(finding !== undefined, `prismaOverrides[${i}]: findingId "${o.findingId}" is not a finding`);
      check(
        finding === undefined || finding.controlId === o.controlId,
        `prismaOverrides[${i}]: cites finding ${o.findingId}, which is filed against ${finding?.controlId} rather than ${o.controlId}`
      );
    }

    const key = `${o.systemId}::${o.controlId}::${o.level}`;
    overrideKeys[key] = (overrideKeys[key] ?? 0) + 1;
    check(overrideKeys[key] === 1, `prismaOverrides: more than one override for ${o.systemId}/${o.controlId} at level ${o.level} — which one wins would be an accident of file order`);
  });

  // ---- Control reviews -------------------------------------------------------
  const reviewKeys: Record<string, number> = {};
  graph.controlReviews.forEach((r, i) => {
    check(has(graph.systemById, r.systemId), `controlReviews[${i}]: systemId "${r.systemId}" is not a system`);
    check(has(graph.controlById, r.controlId), `controlReviews[${i}]: controlId "${r.controlId}" is not a real control`);
    check((REVIEW_BUCKETS as readonly string[]).includes(r.bucket), `controlReviews[${i}]: bucket "${r.bucket}" is not a review bucket (${REVIEW_BUCKETS.join(", ")})`);
    check((REVIEW_STANCES as readonly string[]).includes(r.stance), `controlReviews[${i}]: stance "${r.stance}" is not a review stance (${REVIEW_STANCES.join(", ")})`);
    check(r.reviewedBy.trim().length > 0, `controlReviews[${i}]: needs a reviewedBy`);
    check(!Number.isNaN(Date.parse(r.reviewedAt)), `controlReviews[${i}]: reviewedAt "${r.reviewedAt}" is not a parseable date`);
    check(
      r.stance === "confirm" || r.note.trim().length > 0,
      `controlReviews[${i}]: a reject needs a note — otherwise the derived call still stands and the disagreement is invisible`
    );

    const system = graph.systemById[r.systemId];
    const control = graph.controlById[r.controlId];
    if (system && control && r.stance === "confirm") {
      if (r.bucket === "vendor-inherited") {
        check(
          inheritsDomain(system.hostingType, control.domain),
          `controlReviews[${i}]: confirming external inheritance for ${r.controlId} but ${system.hostingType} does not inherit "${control.domain}"`
        );
      }
      if (r.bucket === "enterprise") {
        const programScoped = Boolean(graph.keyControlById[r.controlId] && graph.keyControlById[r.controlId].scope === "program");
        check(
          graph.enterpriseInheritedDomains.has(control.domain) || programScoped,
          `controlReviews[${i}]: confirming internal-inherited incorporation for ${r.controlId} but "${control.domain}" is not an internal-inherited domain and the control is not program-scoped`
        );
      }
    }

    const key = `${r.systemId}::${r.controlId}`;
    reviewKeys[key] = (reviewKeys[key] ?? 0) + 1;
    check(reviewKeys[key] === 1, `controlReviews: more than one review for ${r.systemId}/${r.controlId} — which one wins would be an accident of file order`);
  });

  graph.programApplicabilityRules.forEach((r, i) =>
    check(has(graph.keyControlById, r.controlId), `programApplicabilityRules[${i}]: controlId "${r.controlId}" is not a key control`)
  );
  graph.implementationMechanisms.forEach((m, i) => {
    check(has(graph.assetById, m.assetId), `implementationMechanisms[${i}]: assetId "${m.assetId}" is not an asset`);
    check(has(graph.keyControlById, m.controlId), `implementationMechanisms[${i}]: controlId "${m.controlId}" is not a key control`);
  });
  graph.operatingHistory.forEach((h, i) => {
    check(has(graph.assetById, h.assetId), `operatingHistory[${i}]: assetId "${h.assetId}" is not an asset`);
    check(has(graph.keyControlById, h.controlId), `operatingHistory[${i}]: controlId "${h.controlId}" is not a key control`);
    check(!Number.isNaN(Date.parse(h.implementedAt)), `operatingHistory[${i}]: implementedAt "${h.implementedAt}" is not a valid date`);
  });

  // ---- System Register cockpit domains ---------------------------------------
  const idPopKeysSeen = new Set<string>();
  graph.identityPopulations.forEach((p) => {
    check(has(graph.systemById, p.systemId), `identity population ${p.id}: systemId "${p.systemId}" is not a system`);
    check(IDENTITY_TYPES.includes(p.identityType), `identity population ${p.id}: identityType "${p.identityType}" is not one of ${IDENTITY_TYPES.join(", ")}`);
    const key = `${p.systemId}::${p.identityType}`;
    check(!idPopKeysSeen.has(key), `identity population ${p.id}: duplicate row for ${key}`);
    idPopKeysSeen.add(key);
    [p.ssoEnforcedCount, p.mfaEnforcedCount, p.dormantCount, p.localBypassCount, p.sharedCount, p.awaitingTerminationCount].forEach((n) =>
      check(n >= 0 && n <= p.totalCount, `identity population ${p.id}: a sub-count exceeds totalCount (${p.totalCount})`)
    );
    check(p.strongMfaCount <= p.mfaEnforcedCount, `identity population ${p.id}: strongMfaCount (${p.strongMfaCount}) exceeds mfaEnforcedCount (${p.mfaEnforcedCount})`);
  });

  graph.accessReviews.forEach((r) => {
    check(has(graph.systemById, r.systemId), `access review ${r.id}: systemId "${r.systemId}" is not a system`);
    check(has(graph.orgById, r.reviewerOrgId), `access review ${r.id}: reviewerOrgId "${r.reviewerOrgId}" is not an org`);
    check(r.reviewedCount <= r.totalCount, `access review ${r.id}: reviewedCount (${r.reviewedCount}) exceeds totalCount (${r.totalCount})`);
    check(r.exceptionsOpen <= r.exceptionsIdentified, `access review ${r.id}: exceptionsOpen (${r.exceptionsOpen}) exceeds exceptionsIdentified (${r.exceptionsIdentified})`);
    check(!Number.isNaN(Date.parse(r.reviewedAt)), `access review ${r.id}: reviewedAt "${r.reviewedAt}" is not a parseable date`);
  });

  graph.evidenceArtifacts.forEach((artifact) => {
    check(Boolean(artifact.name.trim()), `evidence artifact ${artifact.id}: name is required`);
    check(Boolean(artifact.mediaType.trim()), `evidence artifact ${artifact.id}: mediaType is required`);
    check(Boolean(artifact.storageRef.trim()), `evidence artifact ${artifact.id}: storageRef is required`);
    check(Boolean(artifact.createdBy.trim()), `evidence artifact ${artifact.id}: createdBy is required`);
    check(Boolean(artifact.version.trim()), `evidence artifact ${artifact.id}: version is required`);
    check(/^[a-f0-9]{64}$/i.test(artifact.sha256), `evidence artifact ${artifact.id}: sha256 must contain 64 hexadecimal characters`);
    check(!Number.isNaN(new Date(artifact.createdAt).getTime()), `evidence artifact ${artifact.id}: createdAt is not a parseable date`);
    check(!Number.isNaN(new Date(artifact.ingestedAt).getTime()), `evidence artifact ${artifact.id}: ingestedAt is not a parseable date`);
    check(ARTIFACT_SENSITIVITIES.includes(artifact.sensitivity), `evidence artifact ${artifact.id}: sensitivity "${artifact.sensitivity}" is not known`);
    if (artifact.retentionUntil) check(!Number.isNaN(new Date(artifact.retentionUntil).getTime()), `evidence artifact ${artifact.id}: retentionUntil is not a parseable date`);
    if (artifact.supersedesId) {
      check(has(graph.evidenceArtifactById, artifact.supersedesId), `evidence artifact ${artifact.id}: supersedesId "${artifact.supersedesId}" is not an artifact`);
      check(artifact.supersedesId !== artifact.id, `evidence artifact ${artifact.id}: cannot supersede itself`);
    }
    check(graph.evidence.some((evidence) => evidence.artifactIds?.includes(artifact.id)), `evidence artifact ${artifact.id}: no evidence observation references it`);
  });

  graph.evidenceReviews.forEach((review) => {
    check(has(graph.evidenceById, review.evidenceId), `evidence review ${review.id}: evidenceId "${review.evidenceId}" is not evidence`);
    check(Boolean(review.reviewer.trim()), `evidence review ${review.id}: reviewer is required`);
    check(!Number.isNaN(new Date(review.reviewedAt).getTime()), `evidence review ${review.id}: reviewedAt is not a parseable date`);
    check(EVIDENCE_REVIEW_DECISIONS.includes(review.decision), `evidence review ${review.id}: decision "${review.decision}" is not known`);
    check(typeof review.independenceDeclared === "boolean", `evidence review ${review.id}: independenceDeclared must be true or false`);
    if (review.validThrough) check(!Number.isNaN(new Date(review.validThrough).getTime()), `evidence review ${review.id}: validThrough is not a parseable date`);
    if (review.supersedesId) {
      check(has(graph.evidenceReviewById, review.supersedesId), `evidence review ${review.id}: supersedesId "${review.supersedesId}" is not a review`);
      check(review.supersedesId !== review.id, `evidence review ${review.id}: cannot supersede itself`);
    }
  });

  const agentPrincipalKeys = new Set<string>();
  graph.agenticIdentities.forEach((agent) => {
    check(has(graph.systemById, agent.systemId), `agentic identity ${agent.id}: systemId "${agent.systemId}" is not a system`);
    check(Boolean(agent.name.trim()), `agentic identity ${agent.id}: name is required`);
    check(Boolean(agent.purpose.trim()), `agentic identity ${agent.id}: purpose is required`);
    check(Boolean(agent.servicePrincipal.trim()), `agentic identity ${agent.id}: servicePrincipal is required`);
    check(AGENT_AUTONOMY_LEVELS.includes(agent.autonomyLevel), `agentic identity ${agent.id}: autonomyLevel "${agent.autonomyLevel}" is not one of ${AGENT_AUTONOMY_LEVELS.join(", ")}`);
    check(AGENT_CREDENTIAL_TYPES.includes(agent.credentialType), `agentic identity ${agent.id}: credentialType "${agent.credentialType}" is not one of ${AGENT_CREDENTIAL_TYPES.join(", ")}`);
    check(AGENT_PRIVILEGE_LEVELS.includes(agent.privilegeLevel), `agentic identity ${agent.id}: privilegeLevel "${agent.privilegeLevel}" is not one of ${AGENT_PRIVILEGE_LEVELS.join(", ")}`);
    check(AGENT_REVOCATION_MECHANISMS.includes(agent.revocationMechanism), `agentic identity ${agent.id}: revocationMechanism "${agent.revocationMechanism}" is not one of ${AGENT_REVOCATION_MECHANISMS.join(", ")}`);
    if (agent.ownerOrgId) check(has(graph.orgById, agent.ownerOrgId), `agentic identity ${agent.id}: ownerOrgId "${agent.ownerOrgId}" is not an org`);
    const system = graph.systemById[agent.systemId];
    check(Boolean(system?.aiUsage.usesAI), `agentic identity ${agent.id}: system ${agent.systemId} does not declare AI usage`);
    check(agent.autonomyLevel !== "autonomous" || Boolean(system?.aiUsage.autonomousActions), `agentic identity ${agent.id}: autonomous agent belongs to a system that does not declare autonomous actions`);
    check(agent.autonomyLevel !== "recommend" || !agent.externalActions, `agentic identity ${agent.id}: recommendation-only agent cannot perform external actions`);
    check(agent.autonomyLevel !== "approval-gated" || agent.humanApprovalRequired, `agentic identity ${agent.id}: approval-gated agent must require human approval`);
    check(agent.autonomyLevel !== "autonomous" || !agent.humanApprovalRequired, `agentic identity ${agent.id}: autonomous agent cannot also require human approval`);
    check(agent.tools.length > 0, `agentic identity ${agent.id}: must name at least one accessible tool or resource`);
    const principalKey = `${agent.systemId}::${agent.servicePrincipal}`;
    check(!agentPrincipalKeys.has(principalKey), `agentic identity ${agent.id}: duplicate service principal "${agent.servicePrincipal}" in system ${agent.systemId}`);
    agentPrincipalKeys.add(principalKey);
    (["credentialCreatedAt", "lastRotatedAt", "credentialExpiresAt", "lastUsedAt"] as const).forEach((field) => {
      const value = agent[field];
      if (value) check(!Number.isNaN(Date.parse(value)), `agentic identity ${agent.id}: ${field} "${value}" is not a parseable date`);
    });
  });

  graph.exposurePostures.forEach((p) => {
    check(has(graph.systemById, p.systemId), `exposure posture: systemId "${p.systemId}" is not a system`);
    check(EGRESS_POSTURE.includes(p.egressPosture), `exposure posture ${p.systemId}: egressPosture "${p.egressPosture}" is not one of ${EGRESS_POSTURE.join(", ")}`);
    check(ADMIN_POSTURE.includes(p.adminPosture), `exposure posture ${p.systemId}: adminPosture "${p.adminPosture}" is not one of ${ADMIN_POSTURE.join(", ")}`);
    check(API_POSTURE.includes(p.apiPosture), `exposure posture ${p.systemId}: apiPosture "${p.apiPosture}" is not one of ${API_POSTURE.join(", ")}`);
  });
  const exposurePostureSystems = new Set<string>();
  graph.exposurePostures.forEach((p) => {
    check(!exposurePostureSystems.has(p.systemId), `exposure posture: more than one row for system ${p.systemId}`);
    exposurePostureSystems.add(p.systemId);
  });

  graph.externalServices.forEach((e) => {
    check(has(graph.systemById, e.systemId), `external service ${e.id}: systemId "${e.systemId}" is not a system`);
    check(EXTERNAL_SERVICE_KINDS.includes(e.kind), `external service ${e.id}: kind "${e.kind}" is not one of ${EXTERNAL_SERVICE_KINDS.join(", ")}`);
    check(!e.externallyReachable || e.internetFacing, `external service ${e.id}: externallyReachable is true but internetFacing is false — a service can't be reachable from the internet without being internet-facing`);
  });

  graph.exposureExceptions.forEach((e) => {
    check(has(graph.systemById, e.systemId), `exposure exception ${e.id}: systemId "${e.systemId}" is not a system`);
    check(DANGEROUS_CONDITIONS.includes(e.condition), `exposure exception ${e.id}: condition "${e.condition}" is not one of ${DANGEROUS_CONDITIONS.join(", ")}`);
    check(Boolean(e.title?.trim()), `exposure exception ${e.id}: needs a title`);
    check(Boolean(e.reason?.trim()), `exposure exception ${e.id}: needs a reason — an accepted dangerous condition without one is indistinguishable from nobody looking`);
    check(has(graph.orgById, e.approvedBy), `exposure exception ${e.id}: approvedBy "${e.approvedBy}" is not an org`);
    check(has(graph.orgById, e.ownerId), `exposure exception ${e.id}: ownerId "${e.ownerId}" is not an org`);
    check(!Number.isNaN(Date.parse(e.approvedAt)), `exposure exception ${e.id}: approvedAt "${e.approvedAt}" is not a date`);
    check(!e.expiresAt || !Number.isNaN(Date.parse(e.expiresAt)), `exposure exception ${e.id}: expiresAt "${e.expiresAt}" is not a date`);
    check(Number.isInteger(e.reviewCadenceDays) && e.reviewCadenceDays > 0, `exposure exception ${e.id}: reviewCadenceDays must be a positive integer`);
    check(e.affectedAssetIds.length > 0, `exposure exception ${e.id}: must identify at least one affected asset`);
    e.affectedAssetIds.forEach((assetId) => check(has(graph.assetById, assetId), `exposure exception ${e.id}: affected asset "${assetId}" does not exist`));
    e.controlIds.forEach((controlId) => check(has(graph.controlById, controlId), `exposure exception ${e.id}: control "${controlId}" does not exist`));
    check(e.compensatingControls.length > 0 && e.compensatingControls.every((item) => Boolean(item.trim())), `exposure exception ${e.id}: must identify at least one compensating control`);
  });

  graph.vulnSnapshots.forEach((v) => {
    check(has(graph.systemById, v.systemId), `vuln snapshot: systemId "${v.systemId}" is not a system`);
    [v.criticalCount, v.highCount, v.pastSlaCount, v.configFindingCount, v.unsupportedComponentCount, v.internetFacingCriticalCount].forEach((n) =>
      check(n >= 0, `vuln snapshot ${v.systemId}: counts must be non-negative`)
    );
    check(v.patchSlaCompliancePct >= 0 && v.patchSlaCompliancePct <= 100, `vuln snapshot ${v.systemId}: patchSlaCompliancePct must be 0-100`);
  });
  const vulnSnapshotSystems = new Set<string>();
  graph.vulnSnapshots.forEach((v) => {
    check(!vulnSnapshotSystems.has(v.systemId), `vuln snapshot: more than one row for system ${v.systemId}`);
    vulnSnapshotSystems.add(v.systemId);
  });

  graph.securityTests.forEach((t) => {
    check(has(graph.systemById, t.systemId), `security test ${t.id}: systemId "${t.systemId}" is not a system`);
    check(SECURITY_TEST_TYPES.includes(t.type), `security test ${t.id}: type "${t.type}" is not one of ${SECURITY_TEST_TYPES.join(", ")}`);
    check(t.cadenceDays > 0, `security test ${t.id}: cadenceDays must be positive`);
    check(t.criticalFindingCount >= 0 && t.highFindingCount >= 0, `security test ${t.id}: finding counts must be non-negative`);
    check(!Number.isNaN(Date.parse(t.completedAt)), `security test ${t.id}: completedAt "${t.completedAt}" is not a parseable date`);
    check(t.objectiveAchieved === undefined || t.type === "red-team", `security test ${t.id}: objectiveAchieved is only meaningful for a red-team exercise`);
  });

  graph.backupConfigs.forEach((b) => {
    check(has(graph.systemById, b.systemId), `backup config: systemId "${b.systemId}" is not a system`);
    check(b.coveragePct >= 0 && b.coveragePct <= 100, `backup config ${b.systemId}: coveragePct must be 0-100`);
    check(b.rpoTargetMinutes > 0 && b.rtoTargetMinutes > 0, `backup config ${b.systemId}: RPO/RTO targets must be positive`);
  });

  graph.drTests.forEach((t) => {
    check(has(graph.systemById, t.systemId), `DR test ${t.id}: systemId "${t.systemId}" is not a system`);
    check(t.cadenceDays > 0, `DR test ${t.id}: cadenceDays must be positive`);
    check(t.actualRpoMinutes >= 0 && t.actualRtoMinutes >= 0, `DR test ${t.id}: actual RPO/RTO must be non-negative`);
    check(!Number.isNaN(Date.parse(t.conductedAt)), `DR test ${t.id}: conductedAt "${t.conductedAt}" is not a parseable date`);
    check(t.restoreSuccessful || Boolean(t.issues?.trim()), `DR test ${t.id}: restoreSuccessful is false but no issues are recorded — a failed restore has to say what went wrong`);
  });

  graph.irPlanCurrency.forEach((p) => {
    check(p.scope === "program" || has(graph.systemById, p.scope), `IR plan currency: scope "${p.scope}" is neither "program" nor a system`);
    check(p.cadenceDays > 0, `IR plan currency ${p.scope}: cadenceDays must be positive`);
    check(!Number.isNaN(Date.parse(p.lastReviewedAt)), `IR plan currency ${p.scope}: lastReviewedAt "${p.lastReviewedAt}" is not a parseable date`);
  });

  graph.tabletopExercises.forEach((t) => {
    check(t.scope === "program" || has(graph.systemById, t.scope), `tabletop exercise ${t.id}: scope "${t.scope}" is neither "program" nor a system`);
    check(t.cadenceDays > 0, `tabletop exercise ${t.id}: cadenceDays must be positive`);
    check(t.issuesIdentified >= 0, `tabletop exercise ${t.id}: issuesIdentified must be non-negative`);
    t.participantOrgIds.forEach((id) => check(has(graph.orgById, id), `tabletop exercise ${t.id}: participantOrgId "${id}" is not an org`));
    t.participatingFunctions.forEach((f) => check(IR_FUNCTIONS.includes(f), `tabletop exercise ${t.id}: participating function "${f}" is not one of ${IR_FUNCTIONS.join(", ")}`));
  });

  graph.productionIncidents.forEach((i) => {
    check(has(graph.systemById, i.systemId), `production incident ${i.id}: systemId "${i.systemId}" is not a system`);
    check(SEVERITY_LEVELS.includes(i.severity), `production incident ${i.id}: severity "${i.severity}" is not a severity level`);
  });

  graph.vendors.forEach((v) => {
    check(VENDOR_CATEGORIES.includes(v.category), `vendor ${v.id}: category "${v.category}" is not one of ${VENDOR_CATEGORIES.join(", ")}`);
  });
  check(new Set(graph.vendors.map((v) => v.id)).size === graph.vendors.length, `vendors: duplicate id`);

  graph.vendorAssurance.forEach((a) => {
    check(has(graph.vendorById, a.vendorId), `vendor assurance ${a.id}: vendorId "${a.vendorId}" is not a vendor`);
    check(a.cadenceDays > 0, `vendor assurance ${a.id}: cadenceDays must be positive`);
    check(!Number.isNaN(Date.parse(a.reassessedAt)), `vendor assurance ${a.id}: reassessedAt "${a.reassessedAt}" is not a parseable date`);
    if (a.certificationId) {
      check(graph.providerCertifications.some((c) => c.id === a.certificationId), `vendor assurance ${a.id}: certificationId "${a.certificationId}" is not a provider certification`);
    }
  });

  graph.systemVendors.forEach((sv, i) => {
    check(has(graph.systemById, sv.systemId), `systemVendors[${i}]: systemId "${sv.systemId}" is not a system`);
    check(has(graph.vendorById, sv.vendorId), `systemVendors[${i}]: vendorId "${sv.vendorId}" is not a vendor`);
    check(VENDOR_CRITICALITY.includes(sv.criticality), `systemVendors[${i}]: criticality "${sv.criticality}" is not one of ${VENDOR_CRITICALITY.join(", ")}`);
    sv.dataAccessible.forEach((id) => check(has(graph.dataTypeById, id), `systemVendors[${i}]: dataAccessible id "${id}" is not a data type`));
  });

  // The tie between the narrow provider-certification mechanism and the
  // broader vendor register: every system's hosting provider has to be a
  // registered vendor, or the two registers have silently diverged about who
  // a vendor is.
  graph.systems.forEach((s) => {
    check(graph.vendors.some((v) => v.name === s.provider), `system ${s.id}: provider "${s.provider}" does not match any registered vendor — add it to vendors.yaml`);
  });

  graph.sdlcPostures.forEach((p) => {
    check(has(graph.systemById, p.systemId), `SDLC posture: systemId "${p.systemId}" is not a system`);
    check(p.applicable || Boolean(p.notApplicableReason?.trim()), `SDLC posture ${p.systemId}: applicable is false but no notApplicableReason is given`);
    check(p.lastThreatModelAt === undefined || !Number.isNaN(Date.parse(p.lastThreatModelAt)), `SDLC posture ${p.systemId}: lastThreatModelAt "${p.lastThreatModelAt}" is not a parseable date`);
  });
  const sdlcSystems = new Set<string>();
  graph.sdlcPostures.forEach((p) => {
    check(!sdlcSystems.has(p.systemId), `SDLC posture: more than one row for system ${p.systemId}`);
    sdlcSystems.add(p.systemId);
  });

  if (problems.length > 0 && throwOnFailure) {
    throw new Error(
      `Graph integrity check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n  - ${problems.join("\n  - ")}`
    );
  }
  return problems;
}
