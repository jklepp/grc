// External obligations: which systems each one reaches, and whether it is met.
//
// Nothing here is authored. The facts (graph/nodes/externalObligations.ts) say
// what ACME's default is, what an outside party requires instead, whose data
// it covers, and which facts would prove it. This module answers the three
// questions those facts can't answer on their own:
//
//   scope    the systems whose assets hold any of the obligation's data types,
//            through the same assetDataTypes edges classification reads. Every
//            role counts, as it does there: a system that only processes or
//            accesses a customer's data still has to meet the customer's terms.
//   proof    each proof checked against the record it names. Evidence must be
//            active, passing and fresh; a tabletop must be within cadence and
//            have included the named function. Either way the reason is kept,
//            so the page can say why something is not proven, not just that.
//   status   proven only when there is at least one proof and every proof is
//            proven. An obligation with no proof says so ("no-proof") rather
//            than reading as met.
import type { Graph } from "../graph/types";
import type { SystemId, DataTypeId, EvidenceId } from "../graph/ids";
import type { System } from "../graph/nodes/systems";
import type { ExternalObligation, ObligationProof } from "../graph/nodes/externalObligations";
import { isClockUnit } from "../graph/nodes/externalObligations";
import type { EngineContext } from "./context";
import type { EvidenceApi } from "./evidence";
import type { IncidentResponseApi } from "./incidentResponse";
import type { FindingsApi } from "./findings";

export const OBLIGATION_STATUSES = ["proven", "not-proven", "no-proof"] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

const DAY_MS = 86_400_000;

// One thing a proof was checked against: an evidence record, or one in-scope
// system's tabletop history.
export interface ProofCheck {
  ref: string;
  label: string;
  ok: boolean;
  reason: string;
}

export interface EvaluatedProof {
  title: string;
  basis: "evidence" | "tabletop";
  proven: boolean;
  checks: ProofCheck[];
}

export function createObligations(
  graph: Graph,
  ctx: EngineContext,
  evidence: EvidenceApi,
  incidentResponse: IncidentResponseApi,
  findings: FindingsApi,
) {
  function systemsHolding(dataTypeIds: readonly DataTypeId[]): Set<SystemId> {
    const systemIds = new Set<SystemId>();
    dataTypeIds.forEach((dataTypeId) => {
      (graph.assetsByDataType[dataTypeId] ?? []).forEach((edge) => {
        (graph.assetById[edge.assetId]?.systemIds ?? []).forEach((systemId) => systemIds.add(systemId));
      });
    });
    return systemIds;
  }

  function checkEvidence(ids: readonly EvidenceId[]): ProofCheck[] {
    return ids.map((id) => {
      const record = graph.evidenceById[id];
      if (!record) return { ref: id, label: id, ok: false, reason: "No such evidence record" };
      const scored = evidence.scoreEvidence(record);
      const status = scored.recordStatus ?? "active";
      let reason: string;
      if (status !== "active") reason = `Record is ${status}`;
      else if (scored.result !== "pass") reason = `Result ${scored.result}, collected ${scored.collectedAt}`;
      else if (scored.stale) reason = `Passed, but stale: collected ${scored.collectedAt}, valid ${scored.validForDays} days`;
      else reason = `Passed, collected ${scored.collectedAt}`;
      return {
        ref: id,
        label: scored.source,
        ok: status === "active" && scored.result === "pass" && !scored.stale,
        reason,
      };
    });
  }

  function checkTabletop(fn: NonNullable<ObligationProof["tabletopFunction"]>, systems: readonly System[]): ProofCheck[] {
    return systems.map((system) => {
      const { tabletops, lastTabletop } = incidentResponse.irForSystem(system.id);
      const current = tabletops.filter((t) => !t.cadence.overdue);
      const covering = current.find((t) => t.participatingFunctions.includes(fn));
      let reason: string;
      if (covering) reason = `${covering.id} (${covering.conductedAt}) included ${fn}`;
      else if (!lastTabletop) reason = "No tabletop on record";
      else if (current.length === 0) reason = `Last tabletop ${lastTabletop.id} is past its cadence`;
      else reason = `${lastTabletop.id} (${lastTabletop.conductedAt}) did not include ${fn}`;
      return { ref: system.id, label: system.name, ok: Boolean(covering), reason };
    });
  }

  function evaluateProof(proof: ObligationProof, systems: readonly System[]): EvaluatedProof {
    const basis = proof.tabletopFunction ? "tabletop" : "evidence";
    const checks = proof.tabletopFunction
      ? checkTabletop(proof.tabletopFunction, systems)
      : checkEvidence(proof.evidenceIds ?? []);
    return { title: proof.title, basis, proven: checks.length > 0 && checks.every((c) => c.ok), checks };
  }

  function buildObligation(o: ExternalObligation) {
    const inScopeIds = systemsHolding(o.dataTypeIds);
    const systems = graph.systems.filter((s) => inScopeIds.has(s.id));
    const ruledOutSystems = graph.systems.filter((s) => !inScopeIds.has(s.id));
    const proofs = o.proof.map((p) => evaluateProof(p, systems));
    const status: ObligationStatus = proofs.length === 0
      ? "no-proof"
      : proofs.every((p) => p.proven) ? "proven" : "not-proven";
    const daysUntilEffective = o.effectiveAt
      ? Math.ceil((new Date(o.effectiveAt).getTime() - ctx.now.getTime()) / DAY_MS)
      : null;

    return {
      ...o,
      dataTypes: o.dataTypeIds.map((id) => graph.dataTypeById[id]).filter(Boolean),
      systems,
      ruledOutSystems,
      proofs,
      status,
      inForce: daysUntilEffective === null || daysUntilEffective <= 0,
      daysUntilEffective,
    };
  }

  const parameters = graph.controlDefaults.map((def) => {
    const clock = isClockUnit(def.unit);
    const obligations = (graph.externalObligationsByDefault[def.id] ?? [])
      .map(buildObligation)
      .sort((a, b) => (clock ? Number(a.value) - Number(b.value) : a.party.localeCompare(b.party)));
    const strictest = clock ? obligations[0] ?? null : null;
    const reachedSystemIds = new Set(obligations.flatMap((o) => o.systems.map((s) => s.id)));
    // Open findings already filed against this control on a system the
    // obligations reach: the known gaps standing between ACME and the terms.
    const openFindings = findings.ALL_FINDINGS.filter(
      (f) => f.open && f.controlId === def.controlId && reachedSystemIds.has(f.systemId)
    );
    // When two or more parties need a stricter clock, one process run at the
    // strictest value meets all of them, instead of a separate clock per party.
    // An observation for the default's owner to weigh, not a decision.
    const raiseDefault = clock && strictest && obligations.length >= 2
      ? { value: Number(strictest.value), retires: obligations.length }
      : null;

    return {
      ...def,
      control: graph.controlById[def.controlId] ?? null,
      owner: graph.orgById[def.ownerId] ?? null,
      obligations,
      strictest,
      notProven: obligations.filter((o) => o.status !== "proven").length,
      openFindings,
      raiseDefault,
    };
  });

  const allObligations = parameters.flatMap((p) => p.obligations);
  const summary = {
    total: allObligations.length,
    proven: allObligations.filter((o) => o.status === "proven").length,
    notProven: allObligations.filter((o) => o.status === "not-proven").length,
    noProof: allObligations.filter((o) => o.status === "no-proof").length,
    parametersWithObligations: parameters.filter((p) => p.obligations.length > 0).length,
  };

  return { parameters, summary };
}

export type ObligationsApi = ReturnType<typeof createObligations>;
export type ObligationParameter = ObligationsApi["parameters"][number];
export type EvaluatedObligation = ObligationParameter["obligations"][number];
