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
// from elsewhere. closureEvidenceIds is the one place a Finding does hold its
// own forward pointer to Evidence — it's a hand-picked subset ("this is what
// proves it's closed"), not a rediscovery of the same evidenceIds reverse
// link, so it doesn't collapse into the convention above.
import type { Graph } from "../graph/types";
import { REMEDIATION_STATUSES, type Finding, type FindingSeverity, type FindingSource } from "../graph/nodes/findings";
import type { EngineContext } from "./context";
import type { AssetId, ControlId, SystemId, RiskId } from "../graph/ids";
import type { ComplianceRating } from "../graph/nodes/taxonomy";

export const FINDING_REMEDIATION_STATUS_META = {
  Planned: { label: "Planned", color: "na" },
  "In Progress": { label: "In Progress", color: "accent" },
  Blocked: { label: "Blocked", color: "red" },
  Complete: { label: "Complete", color: "green" },
};

export const FINDING_SEVERITY_META = {
  critical: { label: "Critical", color: "red" },
  high: { label: "High", color: "amber" },
  medium: { label: "Medium", color: "amber" },
  low: { label: "Low", color: "muted" },
};

// A lane rated at or below this is a gap worth flagging as a Finding — the
// same deterministic-threshold pattern applicability rules use, so the
// grading UI can nudge an assessor without making a silent judgment call.
export const GAP_RATING_THRESHOLD: ComplianceRating = 25;

export function isGapRating(rating: ComplianceRating): boolean {
  return rating <= GAP_RATING_THRESHOLD;
}

// A starting point the assessor sees and can still change in the form —
// not an auto-submitted decision.
export function suggestedFindingSeverity(rating: ComplianceRating): FindingSeverity {
  return rating === 0 ? "high" : "medium";
}

export function createFindings(graph: Graph, ctx: EngineContext) {
  // Which risks this finding contributes to.
  //
  // With an asset named, this is the precise intersection it always was: the
  // risk has to name BOTH this control and this asset as carrying the scenario.
  //
  // Without one, there is nothing to intersect on, so the match falls back to
  // the control alone — narrowed to risks that actually touch this finding's
  // own system, so an assetless finding on one boundary cannot claim a risk
  // carried entirely by another. Broader than the two-sided match by
  // construction, which is the honest reading: "this control is weak here" says
  // less about which asset is exposed than "this control is weak on that box".
  function riskIdsFor(controlId: ControlId, assetId: AssetId | undefined, systemId: SystemId): RiskId[] {
    return graph.risks
      .filter((r) => {
        if (!(graph.controlsByRisk[r.id] ?? []).some((c) => c.controlId === controlId)) return false;
        const riskAssets = graph.assetsByRisk[r.id] ?? [];
        if (assetId) return riskAssets.some((a) => a.assetId === assetId);
        return riskAssets.some((a) => (graph.assetById[a.assetId]?.systemIds ?? []).includes(systemId));
      })
      .map((r) => r.id);
  }

  function buildFinding(f: Finding) {
    const asset = f.assetId ? graph.assetById[f.assetId] ?? null : null;
    const control = graph.keyControlById[f.controlId];
    const owner = graph.orgById[f.ownerId];
    const remediationOwner = f.remediationOwnerId ? graph.orgById[f.remediationOwnerId] : null;
    const evidenceIds = graph.evidence.filter((e) => e.findingId === f.id).map((e) => e.id);
    const riskIds = riskIdsFor(f.controlId, f.assetId, f.systemId);
    // "Open" means anything short of Complete — the single predicate every
    // consumer (overdue, cockpit counts, the Managed-level penalty) should
    // read instead of re-deriving its own status check.
    const open = f.remediationStatus !== "Complete";
    const overdue = open && new Date(f.due) < ctx.now;
    // A CAP is the plan on the finding. Owner and target date both carry
    // honest fallbacks (ownerId, due), so the plan text is what separates a
    // recorded gap from a planned one — the single predicate lane 3 and the
    // remediation pipeline both read.
    const capRecorded = Boolean(f.remediationPlan?.trim());

    return {
      ...f,
      asset,
      control,
      owner,
      remediationOwner,
      // The finding's own boundary, not the asset's. These agreed for every
      // finding that existed when systemId was introduced (each was derived
      // from its asset), and they keep agreeing because validate.ts refuses an
      // asset that does not belong to the named system. Kept as an array so
      // every existing `systemIds.includes(...)` reader is unchanged.
      systemIds: [f.systemId],
      assetName: asset?.name ?? null,
      evidenceIds,
      riskIds,
      open,
      overdue,
      capRecorded,
      ticket: f.id,
      jira: f.id,
      // Display strings alongside the resolved `owner`/`control` objects above —
      // POAM-style rendering wants a name and a label, not an object.
      ownerName: owner?.name ?? f.ownerId,
      remediationOwnerName: remediationOwner?.name ?? f.remediationOwnerId ?? null,
      controlName: control?.friendlyName ?? f.controlId,
    };
  }

  const allFindings = graph.findings.map(buildFinding);
  const findingById = Object.fromEntries(allFindings.map((f) => [f.id, f]));

  return {
    buildFinding,
    ALL_FINDINGS: allFindings,
    FINDING_BY_ID: findingById,
    findingsForSystem: (systemId: SystemId) => allFindings.filter((f) => f.systemIds.includes(systemId)),
    findingsForAsset: (assetId: AssetId) => allFindings.filter((f) => f.assetId === assetId),
    findingsForControl: (systemId: SystemId, controlId: ControlId) =>
      allFindings.filter((f) => f.systemId === systemId && f.controlId === controlId),
    findingsForRisk: (riskId: RiskId) => allFindings.filter((f) => f.riskIds.includes(riskId)),
    // Open items raised by a specific domain (a pen test, a DR test, an IR
    // tabletop...) rather than a routine control-gap review — what the
    // cockpit's per-domain sections render instead of inventing their own
    // remediation tracking.
    openFindingsForSource: (systemId: SystemId, source: FindingSource) =>
      allFindings.filter((f) => f.systemIds.includes(systemId) && f.source === source && f.open),
  };
}

export type FindingsApi = ReturnType<typeof createFindings>;
export type EngineFinding = FindingsApi["ALL_FINDINGS"][number];

export { REMEDIATION_STATUSES };
