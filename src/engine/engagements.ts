// Engagements, derived: the rows an audit works through, the requests it owes,
// the populations it samples from, and what closing it would publish.
//
// See graph/nodes/engagements.ts for the model. Nothing here writes; closing
// is computed as a plan (closePlan) that runtimeMutations.applyEngagementClose
// applies after someone has reviewed the diff.
import type { Graph } from "../graph/types";
import type { Control } from "../graph/nodes/controls";
import type { ControlId, SystemId } from "../graph/ids";
import type { EngineContext } from "./context";
import type { ApplicabilityApi } from "./applicability";
import type { ComplianceApi, ControlCoverage } from "./compliance";
import {
  CONTROL_RECORD_STATUS_META, recordTime, requiresCyberAssurance, systemRecordKey, versionsOf,
  type ControlFrequency, type ControlRecordStatus, type SystemControlRecord,
} from "../graph/nodes/controlRecords";
import {
  type AuditorResult, type Certification, type Engagement, type EngagementControl, type EngagementDraft,
  type EngagementSnapshot, type EngagementSnapshotRow,
} from "../graph/nodes/engagements";
import { HITRUST_R2_STANDARD } from "../graph/nodes/providerCertifications";

const key3 = (engagementId: string, systemId: string, controlId: string) => `${engagementId}::${systemId}::${controlId}`;

export type RowFlag =
  | "not-recorded"        // a system-owned row with nothing written yet
  | "missing-evidence"    // a framework in this engagement asks for evidence and there is none
  | "missing-frequency"   // SOC 2 sizes its sample from the frequency, and none is stated
  | "stale-for-period"    // Type II: reviewed before the period began; otherwise not reviewed in the past year
  | "changed-since-start" // the system of record moved after this engagement read it
  | "draft-conflict";     // ...and this engagement holds a draft of the same record

export const ROW_FLAG_LABELS: Record<RowFlag, string> = {
  "not-recorded": "Not recorded",
  "missing-evidence": "Evidence owed",
  "missing-frequency": "Frequency owed",
  "stale-for-period": "Review out of date for this audit",
  "changed-since-start": "Changed since the audit started",
  "draft-conflict": "Draft conflicts with a newer record",
};

export interface EngagementRow {
  key: string;
  engagementId: string;
  systemId: SystemId;
  systemName: string;
  controlId: ControlId;
  control: Control;
  /** Clauses of this engagement's frameworks that map the control. */
  clauses: { standard: string; clauses: string[] }[];
  coverage: ControlCoverage;
  source: string;
  implementationType: string;
  /** Whether a person can write this row's record here: a baseline system's own or hybrid part. */
  editable: boolean;
  /** Graded on the PRISMA levels (HITRUST system); read-only here. */
  prisma: boolean;
  /** The engagement's draft of the record, if it holds one. */
  draft: EngagementDraft | null;
  /** The system record currently in force. */
  record: SystemControlRecord | null;
  /** What the engagement reads: its draft if it has one, else the system of record. */
  effective: {
    statement: string;
    status: ControlRecordStatus | null;
    ownerId: string | null;
    frequency?: ControlFrequency;
    evidence: string[];
    reviewedAt: string | null;
  };
  row: EngagementControl | null;
  inScope: boolean;
  justification: string;
  result: AuditorResult;
  nonconformity?: EngagementControl["nonconformity"];
  resultNote: string;
  request: { label: string; accepted: boolean };
  flags: RowFlag[];
}

export interface PopulationSection {
  key: string;
  label: string;
  description: string;
  rows: { systemId: SystemId; systemName: string; label: string; count: number }[];
  total: number;
}

export function createEngagements(graph: Graph, ctx: EngineContext, applicability: ApplicabilityApi, compliance: ComplianceApi) {
  function controlsInEngagement(e: Engagement, systemId: SystemId): Control[] {
    const applicable = applicability.applicableControlsForSystem(systemId);
    // A HITRUST engagement assesses everything that applies; any other reads
    // the controls its frameworks map.
    if (e.frameworks.includes(HITRUST_R2_STANDARD)) return applicable;
    return applicable.filter((c) => c.frameworks.some((f) => e.frameworks.includes(f.standard)));
  }

  function requestLabel(e: Engagement, source: string, owesEvidence: boolean): string {
    if (source === "provider") return "Provider's report covering the period";
    if (source === "common" || source === "enterprise-attestation") return "Central evidence, tested once for the scope";
    if (owesEvidence || e.auditType === "type-2") return "Evidence covering the period";
    return "Evidence on request";
  }

  function rowFor(e: Engagement, systemId: SystemId, control: Control): EngagementRow {
    const system = graph.systemById[systemId];
    const k = key3(e.id, systemId, control.id);
    const coverage = compliance.controlCoverageForSystem(systemId, control.id);
    const baseline = coverage.baseline;
    const prisma = requiresCyberAssurance(system);
    const draft = graph.engagementDraftByKey[k] ?? null;
    const record = graph.systemRecordByPair[`${systemId}::${control.id}`] ?? null;
    const source = prisma ? "prisma" : baseline?.source ?? "none";
    const editable = !prisma && (source === "system" || source === "hybrid" || source === "none");
    const row = graph.engagementControlByKey[k] ?? null;

    const effectiveRecord = draft ?? record;
    const effective = {
      statement: effectiveRecord?.statement ?? (prisma || !editable ? coverage.explanation : ""),
      status: effectiveRecord?.status ?? null,
      ownerId: effectiveRecord?.ownerId ?? null,
      frequency: effectiveRecord?.frequency,
      evidence: effectiveRecord?.evidence ?? [],
      reviewedAt: effectiveRecord?.reviewedAt ?? null,
    };

    const frameworks = e.frameworks;
    const owesEvidence = frameworks.includes("SOC 2") || frameworks.includes("PCI DSS");
    const owesFrequency = frameworks.includes("SOC 2");

    const flags: RowFlag[] = [];
    if (editable) {
      if (!effectiveRecord) flags.push("not-recorded");
      else if (effectiveRecord.status !== "not-implemented") {
        if (owesEvidence && !(effectiveRecord.evidence?.length)) flags.push("missing-evidence");
        if (owesFrequency && !effectiveRecord.frequency) flags.push("missing-frequency");
      }
      // Staleness depends on the kind of audit. A Type II report covers a
      // period, so a record last reviewed before it began says nothing about
      // the period. A point-in-time audit only needs the record to be current:
      // reviewed within the twelve months before the audit.
      if (effectiveRecord) {
        const reviewed = Date.parse(effectiveRecord.reviewedAt);
        const stale = e.auditType === "type-2"
          ? reviewed < Date.parse(e.periodStart)
          : reviewed < Date.parse(e.periodEnd) - 365 * 86_400_000;
        if (stale) flags.push("stale-for-period");
      }
      if (record && recordTime(record) > Date.parse(e.startedAt) && record.engagementId !== e.id) {
        flags.push(draft ? "draft-conflict" : "changed-since-start");
      }
    }

    return {
      key: k,
      engagementId: e.id,
      systemId,
      systemName: system?.name ?? systemId,
      controlId: control.id,
      control,
      clauses: control.frameworks.filter((f) => frameworks.includes(f.standard)).map((f) => ({ standard: f.standard, clauses: f.clauses })),
      coverage,
      source,
      implementationType: prisma ? "PRISMA" : baseline?.implementationType ?? "system-specific",
      editable,
      prisma,
      draft,
      record,
      effective,
      row,
      inScope: row?.inScope ?? true,
      justification: row?.justification ?? "",
      result: row?.result ?? "not-assessed",
      nonconformity: row?.nonconformity,
      resultNote: row?.resultNote ?? "",
      request: { label: requestLabel(e, source, owesEvidence), accepted: Boolean(row?.requestAccepted) },
      flags,
    };
  }

  function rowsFor(engagementId: string): EngagementRow[] {
    const e = graph.engagementById[engagementId];
    if (!e) return [];
    return e.systemIds.flatMap((sid) => controlsInEngagement(e, sid).map((c) => rowFor(e, sid, c)))
      .sort((a, b) => a.controlId.localeCompare(b.controlId) || a.systemName.localeCompare(b.systemName));
  }

  function tracker(rows: EngagementRow[]) {
    const inScope = rows.filter((r) => r.inScope);
    const count = (result: AuditorResult) => inScope.filter((r) => r.result === result).length;
    return {
      total: rows.length,
      inScope: inScope.length,
      excluded: rows.length - inScope.length,
      notAssessed: count("not-assessed"),
      inPlace: count("in-place"),
      partial: count("partial"),
      notInPlace: count("not-in-place"),
      requestsAccepted: inScope.filter((r) => r.request.accepted).length,
      drafts: rows.filter((r) => r.draft).length,
      flagged: inScope.filter((r) => r.flags.length > 0).length,
      nonconformities: {
        major: inScope.filter((r) => r.nonconformity === "major").length,
        minor: inScope.filter((r) => r.nonconformity === "minor").length,
        ofi: inScope.filter((r) => r.nonconformity === "ofi").length,
      },
    };
  }

  function summary(engagementId: string) {
    const e = graph.engagementById[engagementId];
    const rows = rowsFor(engagementId);
    const daysToDue = Math.ceil((Date.parse(e.dueDate) - ctx.now.getTime()) / 86_400_000);
    return {
      engagement: e,
      systems: e.systemIds.map((id) => graph.systemById[id]).filter(Boolean),
      tracker: tracker(rows),
      daysToDue,
      snapshot: graph.snapshotByEngagement[engagementId] ?? null,
      certifications: graph.certifications.filter((c) => c.engagementId === engagementId),
    };
  }

  // ---- Populations -------------------------------------------------------------
  // What a SOC 2 auditor samples from, read straight off the graph for the
  // systems in scope. Period-bound sections count only what falls inside it.
  function populations(engagementId: string): PopulationSection[] {
    const e = graph.engagementById[engagementId];
    if (!e) return [];
    const inPeriod = (date: string) => {
      const t = Date.parse(date);
      return t >= Date.parse(e.periodStart) && t <= Date.parse(e.periodEnd) + 86_400_000;
    };
    const systems = e.systemIds.map((id) => graph.systemById[id]).filter(Boolean);
    const section = (key: string, label: string, description: string, per: (sid: SystemId) => { label: string; count: number }[]): PopulationSection => {
      const rows = systems.flatMap((s) => per(s.id).map((r) => ({ ...r, systemId: s.id, systemName: s.name })));
      return { key, label, description, rows, total: rows.reduce((n, r) => n + r.count, 0) };
    };
    return [
      section("personnel", "Personnel & account access", "Accounts by identity type — the population access reviews and provisioning are sampled from.", (sid) =>
        (graph.identityPopulationsBySystem[sid] ?? []).map((p) => ({ label: p.identityType, count: p.totalCount }))),
      section("access-reviews", "Access reviews in the period", "Completed user access reviews dated inside the audit period.", (sid) => {
        const n = (graph.accessReviewsBySystem[sid] ?? []).filter((r) => inPeriod(r.reviewedAt)).length;
        return [{ label: "Reviews", count: n }];
      }),
      section("assets", "Assets", "The system inventory in scope.", (sid) => [{ label: "Assets", count: (graph.assetsBySystem[sid] ?? []).length }]),
      section("vendors", "Vendors", "Vendors each system depends on, with the data they can reach.", (sid) =>
        [{ label: "Vendors", count: (graph.systemVendorsBySystem[sid] ?? []).length }]),
      section("issues", "Issues & findings", "Findings on each system — open and closed.", (sid) => {
        const f = graph.findings.filter((x) => x.systemId === sid);
        return [
          { label: "Open", count: f.filter((x) => x.remediationStatus !== "Complete").length },
          { label: "Closed", count: f.filter((x) => x.remediationStatus === "Complete").length },
        ];
      }),
      section("testing", "Security & recovery testing in the period", "Penetration tests, red-team exercises and DR tests completed inside the period.", (sid) => [
        { label: "Security tests", count: (graph.securityTestsBySystem[sid] ?? []).filter((t) => inPeriod(t.completedAt)).length },
        { label: "DR tests", count: (graph.drTestsBySystem[sid] ?? []).filter((t) => inPeriod(t.conductedAt)).length },
      ]),
      section("incidents", "Incidents in the period", "Production security incidents that occurred inside the period.", (sid) =>
        [{ label: "Incidents", count: (graph.productionIncidentsBySystem[sid] ?? []).filter((i) => inPeriod(i.occurredAt)).length }]),
    ];
  }

  // ---- Closing ---------------------------------------------------------------------
  // The plan the close dialog reviews. Each draft becomes a new version of its
  // system record, stamped with this engagement. A draft whose record moved
  // after the engagement started is a conflict: publishing it would override
  // a newer answer, so the plan names it and the person decides.
  function closePlan(engagementId: string, opts: { closedAt: string; recordedBy: string; certification?: Omit<Certification, "id" | "engagementId" | "systemIds" | "standard"> & { standard?: string } | null }) {
    const e = graph.engagementById[engagementId];
    const rows = rowsFor(engagementId);
    const diff = rows.filter((r) => r.draft).map((r) => ({
      row: r,
      before: r.record,
      after: r.draft as EngagementDraft,
      conflict: r.flags.includes("draft-conflict"),
      history: versionsOf(graph.systemControlRecordVersions, systemRecordKey, `${r.systemId}::${r.controlId}`),
    }));
    const published: SystemControlRecord[] = diff.map(({ after }) => ({
      systemId: after.systemId,
      controlId: after.controlId,
      statement: after.statement,
      status: after.status,
      ownerId: after.ownerId,
      ...(after.frequency ? { frequency: after.frequency } : {}),
      ...(after.evidence?.length ? { evidence: after.evidence } : {}),
      reviewedAt: after.reviewedAt,
      recordedAt: opts.closedAt,
      recordedBy: opts.recordedBy,
      engagementId,
    }));
    const snapshotRows: EngagementSnapshotRow[] = rows.map((r) => ({
      systemId: r.systemId,
      controlId: r.controlId,
      inScope: r.inScope,
      ...(r.justification ? { justification: r.justification } : {}),
      status: r.coverage.status,
      source: r.source,
      statement: r.effective.statement,
      evidence: r.effective.evidence,
      result: r.result,
      ...(r.nonconformity ? { nonconformity: r.nonconformity } : {}),
      ...(r.resultNote ? { resultNote: r.resultNote } : {}),
    }));
    const snapshot: EngagementSnapshot = {
      engagementId,
      closedAt: opts.closedAt,
      rows: snapshotRows,
      populations: Object.fromEntries(populations(engagementId).map((p) => [p.label, p.total])),
    };
    const certification: Certification | null = opts.certification
      ? {
        ...opts.certification,
        id: `CERT-${engagementId}`,
        standard: opts.certification.standard ?? e.frameworks[0],
        systemIds: [...e.systemIds],
        engagementId,
      }
      : null;
    return {
      engagement: { ...e, status: "closed" as const, closedAt: opts.closedAt },
      diff,
      conflicts: diff.filter((d) => d.conflict).length,
      published,
      snapshot,
      certification,
      tracker: tracker(rows),
    };
  }

  const all = () => [...graph.engagements].sort((a, b) =>
    (a.status === "closed" ? 1 : 0) - (b.status === "closed" ? 1 : 0) || a.dueDate.localeCompare(b.dueDate));

  /** Open engagements that include this system, for the Controls tab's "in audit" markers. */
  const openForSystem = (systemId: SystemId) =>
    graph.engagements.filter((e) => e.status !== "closed" && e.systemIds.includes(systemId));

  return { all, rowsFor, tracker, summary, populations, closePlan, openForSystem, statusMeta: CONTROL_RECORD_STATUS_META };
}

export type EngagementsApi = ReturnType<typeof createEngagements>;
