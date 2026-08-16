// Composes one Finding: resolves its owner, names the evidence and risks that
// touch it, and computes `overdue` against ctx.now instead of trusting a
// hand-typed flag (the old systems.ts remediation array had exactly that bug —
// SEC-2210 was still marked `overdue: false` a month past its due date).
//
// riskIds are derived, not hand-typed: a finding contributes to exactly the
// risks that already name both its asset and its control as carrying the
// scenario (riskContributors edges), which is the same reasoning engine/risk.ts
// already applies in the other direction (risk -> assurance). evidenceIds are
// read off evidence records that declare `findingId` themselves, matching the
// convention that a record declares its own scope rather than being pointed at
// from elsewhere.
import type { Graph } from "../graph/types";
import { FINDING_STATUSES, type Finding } from "../graph/nodes/findings";
import type { EngineContext } from "./context";
import type { AssetId, ControlId, SystemId, RiskId } from "../graph/ids";

const OPEN_STATUSES = new Set(["open", "accepted", "remediating"]);

export const FINDING_STATUS_META = {
  open: { label: "Open", color: "red" },
  accepted: { label: "Accepted", color: "amber" },
  remediating: { label: "Remediating", color: "accent" },
  verified: { label: "Verified", color: "green" },
  closed: { label: "Closed", color: "muted" },
};

export function createFindings(graph: Graph, ctx: EngineContext) {
  function riskIdsFor(assetId: AssetId, controlId: ControlId): RiskId[] {
    return graph.risks
      .filter(
        (r) =>
          (graph.controlsByRisk[r.id] ?? []).some((c) => c.controlId === controlId) &&
          (graph.assetsByRisk[r.id] ?? []).some((a) => a.assetId === assetId)
      )
      .map((r) => r.id);
  }

  function buildFinding(f: Finding) {
    const asset = graph.assetById[f.assetId];
    const control = graph.keyControlById[f.controlId];
    const owner = graph.orgById[f.ownerId];
    const evidenceIds = graph.evidence.filter((e) => e.findingId === f.id).map((e) => e.id);
    const riskIds = riskIdsFor(f.assetId, f.controlId);
    const overdue = OPEN_STATUSES.has(f.status) && new Date(f.due) < ctx.now;

    return {
      ...f,
      asset,
      control,
      owner,
      systemId: asset.systemId,
      evidenceIds,
      riskIds,
      overdue,
      ticket: f.id,
      jira: f.id,
      // Display strings alongside the resolved `owner`/`control` objects above —
      // POAM-style rendering wants a name and a label, not an object.
      ownerName: owner?.name ?? f.ownerId,
      controlName: control?.friendlyName ?? f.controlId,
    };
  }

  const allFindings = graph.findings.map(buildFinding);
  const findingById = Object.fromEntries(allFindings.map((f) => [f.id, f]));

  return {
    buildFinding,
    ALL_FINDINGS: allFindings,
    FINDING_BY_ID: findingById,
    findingsForSystem: (systemId: SystemId) => allFindings.filter((f) => f.systemId === systemId),
    findingsForAsset: (assetId: AssetId) => allFindings.filter((f) => f.assetId === assetId),
    findingsForRisk: (riskId: RiskId) => allFindings.filter((f) => f.riskIds.includes(riskId)),
  };
}

export type FindingsApi = ReturnType<typeof createFindings>;
export type EngineFinding = FindingsApi["ALL_FINDINGS"][number];

export { FINDING_STATUSES };
