// Composes one Finding: resolves its owner, names the evidence and risks that
// touch it, and computes `overdue` against the real clock instead of trusting
// a hand-typed flag (the old systems.js remediation array had exactly that
// bug — SEC-2210 was still marked `overdue: false` a month past its due date).
//
// riskIds are derived, not hand-typed: a finding contributes to exactly the
// risks that already name both its asset and its control as carrying the
// scenario (riskContributors.js edges), which is the same reasoning
// engine/risk.js already applies in the other direction (risk -> assurance).
// evidenceIds are read off evidence records that declare `findingId`
// themselves, matching evidence.js's existing convention that a record
// declares its own scope rather than being pointed at from elsewhere.
import { FINDINGS, FINDING_STATUSES } from "../graph/nodes/findings";
import { ASSET_BY_ID } from "../graph/nodes/assets";
import { KEY_CONTROL_BY_ID } from "../graph/nodes/keyControls";
import { EVIDENCE } from "../graph/nodes/evidence";
import { ORG_BY_ID } from "../graph/nodes/orgs";
import { RISKS } from "../graph/nodes/risks";
import { assetsForRisk, controlsForRisk } from "../graph/edges/riskContributors";

const NOW = new Date();
const OPEN_STATUSES = new Set(["open", "accepted", "remediating"]);

export const FINDING_STATUS_META = {
  open: { label: "Open", color: "red" },
  accepted: { label: "Accepted", color: "amber" },
  remediating: { label: "Remediating", color: "accent" },
  verified: { label: "Verified", color: "green" },
  closed: { label: "Closed", color: "muted" },
};

function riskIdsFor(assetId, controlId) {
  return RISKS.filter(
    (r) =>
      controlsForRisk(r.id).some((c) => c.controlId === controlId) &&
      assetsForRisk(r.id).some((a) => a.assetId === assetId)
  ).map((r) => r.id);
}

function buildFinding(f) {
  const asset = ASSET_BY_ID[f.assetId];
  const control = KEY_CONTROL_BY_ID[f.controlId];
  const owner = ORG_BY_ID[f.ownerId];
  const evidenceIds = EVIDENCE.filter((e) => e.findingId === f.id).map((e) => e.id);
  const riskIds = riskIdsFor(f.assetId, f.controlId);
  const overdue = OPEN_STATUSES.has(f.status) && new Date(f.due) < NOW;

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

export const ALL_FINDINGS = FINDINGS.map(buildFinding);
export const FINDING_BY_ID = Object.fromEntries(ALL_FINDINGS.map((f) => [f.id, f]));

export function findingsForSystem(systemId) {
  return ALL_FINDINGS.filter((f) => f.systemId === systemId);
}

export function findingsForAsset(assetId) {
  return ALL_FINDINGS.filter((f) => f.assetId === assetId);
}

export function findingsForRisk(riskId) {
  return ALL_FINDINGS.filter((f) => f.riskIds.includes(riskId));
}

export { FINDING_STATUSES };
