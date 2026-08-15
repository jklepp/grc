// RISK —[carried by]→ ASSET   and   RISK —[held down by]→ CONTROL
//
// What replaces `linkedControl`, the free-text string that used to be a risk's
// only connection to the rest of the model. That string was routed through a
// hand-typed map to an assurance category, and the category's PORTFOLIO-WIDE
// average was then reported as the risk's control assurance — so RISK-001,
// a cross-tenant defect in the retrieval path, reported a number computed
// across all fifteen assets including the payroll connector and the audit log
// feed. It could not move when the RAG service moved, because it was never
// reading the RAG service.
//
// With these edges, engine/risk.ts reads assurance from the assets that
// actually carry the scenario and the controls that actually hold it down. The
// consequence is the traceability the whole exercise is for: RISK-001's number
// moves when CLD-06 on the RAG service moves, and CLD-06 on the RAG service
// moves when its cross-tenant test result changes.
//
// `role` separates the asset the scenario is really about from the ones that
// participate in it. A primary contributor is weighted more heavily, because
// averaging the RAG service against five healthier assets would wash out
// exactly the signal the risk exists to carry.

import type { RiskId, AssetId, ControlId } from "../ids";

export const CONTRIBUTOR_ROLES = { PRIMARY: "primary", CONTRIBUTING: "contributing" } as const;
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[keyof typeof CONTRIBUTOR_ROLES];

export interface RiskAsset {
  riskId: RiskId;
  assetId: AssetId;
  role: ContributorRole;
  note?: string;
}

export const RISK_ASSETS: RiskAsset[] = [
  // RISK-001 — cross-tenant data exposure
  { riskId: "RISK-001", assetId: "AST-003-03", role: "primary", note: "Retrieval scoping is where the defect lives." },
  { riskId: "RISK-001", assetId: "AST-003-04", role: "primary", note: "Vector search applies tenant filtering only when the caller passes it." },
  { riskId: "RISK-001", assetId: "AST-003-01", role: "contributing", note: "Issues the session the defect is exercised through." },
  { riskId: "RISK-001", assetId: "AST-003-05", role: "contributing", note: "Holds the documents that would be disclosed." },

  // RISK-002 — privileged access persists beyond need
  { riskId: "RISK-002", assetId: "AST-003-07", role: "primary" },
  { riskId: "RISK-002", assetId: "AST-003-08", role: "primary" },
  { riskId: "RISK-002", assetId: "AST-003-05", role: "contributing" },
  { riskId: "RISK-002", assetId: "AST-003-06", role: "contributing" },

  // RISK-003 — deletion requests exceed regulatory timeline
  { riskId: "RISK-003", assetId: "AST-003-04", role: "primary", note: "No retention schedule exists for embeddings, so erasure has no defined propagation path here." },
  { riskId: "RISK-003", assetId: "AST-003-05", role: "contributing" },
  { riskId: "RISK-003", assetId: "AST-003-06", role: "contributing" },
  { riskId: "RISK-003", assetId: "AST-042-01", role: "contributing" },

  // RISK-005 — key rotation not automated
  { riskId: "RISK-005", assetId: "AST-003-07", role: "primary" },

  // RISK-006 — segmentation incomplete post migration
  { riskId: "RISK-006", assetId: "AST-003-02", role: "primary" },
  { riskId: "RISK-006", assetId: "AST-003-03", role: "primary" },
  { riskId: "RISK-006", assetId: "AST-003-01", role: "contributing" },

  // RISK-007 — PII exported without DLP enforcement
  { riskId: "RISK-007", assetId: "AST-042-06", role: "primary", note: "Bulk export runs with no content inspection at all." },
  { riskId: "RISK-007", assetId: "AST-003-05", role: "primary", note: "Ingestion path into the customer data store is equally uninspected." },
  { riskId: "RISK-007", assetId: "AST-003-01", role: "contributing" },
  { riskId: "RISK-007", assetId: "AST-042-04", role: "contributing" },

  // RISK-008 — single point of failure in backup restoration
  { riskId: "RISK-008", assetId: "AST-003-04", role: "primary", note: "Snapshots exist but have never been restore-tested." },
  { riskId: "RISK-008", assetId: "AST-003-05", role: "contributing" },
  { riskId: "RISK-008", assetId: "AST-003-06", role: "contributing" },

  // RISK-009 — third-party API integration lacks auth review
  { riskId: "RISK-009", assetId: "AST-003-01", role: "primary" },
  { riskId: "RISK-009", assetId: "AST-042-02", role: "contributing" },

  // RISK-010 — offboarding revocation delayed
  { riskId: "RISK-010", assetId: "AST-042-05", role: "primary", note: "Deprovisioning propagates from this feed." },
  { riskId: "RISK-010", assetId: "AST-042-01", role: "contributing" },

  // RISK-011 — AI outputs lack bias/security review
  { riskId: "RISK-011", assetId: "AST-003-02", role: "primary" },
  { riskId: "RISK-011", assetId: "AST-003-03", role: "contributing" },

  // RISK-014 — configuration drift in production
  { riskId: "RISK-014", assetId: "AST-003-02", role: "primary" },
  { riskId: "RISK-014", assetId: "AST-003-03", role: "primary" },

  // RISK-015 — model distillation & IP theft
  { riskId: "RISK-015", assetId: "AST-003-01", role: "primary", note: "Extraction happens through sustained querying of the public ingress." },
  { riskId: "RISK-015", assetId: "AST-003-02", role: "primary", note: "The model behaviour being distilled is served here." },

  // RISK-016 — AI agent causes unauthorized actions
  { riskId: "RISK-016", assetId: "AST-003-02", role: "primary", note: "Tool-calling decisions originate in the agent runtime." },
  { riskId: "RISK-016", assetId: "AST-003-03", role: "primary", note: "Injected content reaches the model through retrieved context." },
  { riskId: "RISK-016", assetId: "AST-003-01", role: "contributing" },

  // RISK-017 — model poisoning / corruption
  { riskId: "RISK-017", assetId: "AST-003-05", role: "primary", note: "Corrupted source documents enter here." },
  { riskId: "RISK-017", assetId: "AST-003-04", role: "primary", note: "And propagate into every embedding derived from them." },
  { riskId: "RISK-017", assetId: "AST-003-03", role: "contributing" },

  // RISK-018 — extended loss of the AI platform
  { riskId: "RISK-018", assetId: "AST-003-02", role: "primary" },
  { riskId: "RISK-018", assetId: "AST-003-04", role: "primary" },
  { riskId: "RISK-018", assetId: "AST-003-01", role: "contributing" },
  { riskId: "RISK-018", assetId: "AST-003-03", role: "contributing" },
];

export interface RiskControl {
  riskId: RiskId;
  controlId: ControlId;
}

export const RISK_CONTROLS: RiskControl[] = [
  { riskId: "RISK-001", controlId: "CLD-06" },
  { riskId: "RISK-001", controlId: "IAC-20" },
  { riskId: "RISK-001", controlId: "IAC-21" },
  { riskId: "RISK-002", controlId: "IAC-21" },
  { riskId: "RISK-002", controlId: "IAC-17" },
  { riskId: "RISK-003", controlId: "DCH-18" },
  { riskId: "RISK-003", controlId: "PRI-05" },
  { riskId: "RISK-004", controlId: "TPM-04" },
  { riskId: "RISK-005", controlId: "CRY-09" },
  { riskId: "RISK-006", controlId: "NET-03" },
  { riskId: "RISK-007", controlId: "NET-17" },
  { riskId: "RISK-008", controlId: "BCD-11" },
  { riskId: "RISK-009", controlId: "IAC-20" },
  { riskId: "RISK-009", controlId: "NET-03" },
  { riskId: "RISK-010", controlId: "IAC-17" },
  { riskId: "RISK-011", controlId: "AAT-01" },
  { riskId: "RISK-012", controlId: "IRO-02" },
  { riskId: "RISK-014", controlId: "CFG-02" },
  { riskId: "RISK-014", controlId: "CHG-02" },
  { riskId: "RISK-015", controlId: "AAT-01" },
  { riskId: "RISK-015", controlId: "NET-03" },
  { riskId: "RISK-016", controlId: "AAT-01" },
  { riskId: "RISK-016", controlId: "IAC-20" },
  { riskId: "RISK-016", controlId: "IAC-21" },
  { riskId: "RISK-017", controlId: "AAT-01" },
  { riskId: "RISK-017", controlId: "MON-03" },
  { riskId: "RISK-018", controlId: "BCD-11" },
  { riskId: "RISK-018", controlId: "CAP-01" },
];

// Risks with no asset edges, and why. Four of the eighteen are genuinely not
// about any resource in this register, and saying so explicitly is the point —
// an unexplained absence of edges reads identically to an unfinished one.
export const RISKS_WITHOUT_ASSETS: Record<string, string> = {
  "RISK-004": "A vendor-reassessment backlog is a program condition, not a property of any asset. It's held down by TPM-04 at program scope.",
  "RISK-012": "An untested runbook is a program condition. Held down by IRO-02 at program scope.",
  "RISK-013": "Physical badge systems at a satellite office are outside this register's boundary — no asset here represents them, and inventing one to give the risk an edge would be worse than the gap.",
};

// Risks with no control edges, and why.
export const RISKS_WITHOUT_CONTROLS: Record<string, string> = {
  "RISK-013": "No key control covers physical access. Physical & Environmental Security is governed at the domain level by SOP-13 rather than tracked as a key control, so this risk's assurance is reported as unassessed rather than borrowed from an unrelated control.",
};

const ASSETS_BY_RISK: Record<RiskId, RiskAsset[]> = {};
const CONTROLS_BY_RISK: Record<RiskId, RiskControl[]> = {};
const RISKS_BY_ASSET: Record<AssetId, RiskAsset[]> = {};
const RISKS_BY_CONTROL: Record<ControlId, RiskControl[]> = {};
RISK_ASSETS.forEach((e) => {
  (ASSETS_BY_RISK[e.riskId] ||= []).push(e);
  (RISKS_BY_ASSET[e.assetId] ||= []).push(e);
});
RISK_CONTROLS.forEach((e) => {
  (CONTROLS_BY_RISK[e.riskId] ||= []).push(e);
  (RISKS_BY_CONTROL[e.controlId] ||= []).push(e);
});

export function assetsForRisk(riskId: RiskId): RiskAsset[] {
  return ASSETS_BY_RISK[riskId] || [];
}

export function controlsForRisk(riskId: RiskId): RiskControl[] {
  return CONTROLS_BY_RISK[riskId] || [];
}

export function risksForAsset(assetId: AssetId): RiskAsset[] {
  return RISKS_BY_ASSET[assetId] || [];
}

export function risksForControl(controlId: ControlId): RiskControl[] {
  return RISKS_BY_CONTROL[controlId] || [];
}
