// ASSET —[assessed at]→ ASSURANCE CATEGORY
//
// The fallback layer, and the reason this model can be honest about its own
// coverage.
//
// 26 key controls are implemented and evidenced individually
// (controlImplementations.ts). The other ~300 in-scope controls are not, and
// pretending otherwise would mean generating thousands of implementation
// records nobody assessed. Instead each asset carries a judgment at the level
// those controls roll up to: for each of the six assurance categories, how
// mature is it, what kind of evidence backs it, and how well is it working.
//
// This is exactly the data that used to live as `categories{}` on the asset
// itself. Moving it to an edge changes nothing about the numbers and everything
// about what they claim. As an asset attribute it was indistinguishable from
// measured fact; as an edge it is visibly an assertion, with an assessor and a
// date, and the engine tags every number derived from it with an "assessed"
// basis so a reader can tell it apart from one backed by evidence.
//
// engine/rollups.ts blends the two: within a category, the controls that have
// real implementations contribute their measured scores, and the remainder
// contributes this baseline, weighted by how much of the category each covers.
// That blend is what controlBackedPct reports.
import { ASSURANCE_CATEGORIES, type AssuranceCategory, type MaturityStage, type EvidenceType } from "../nodes/taxonomy";
import type { AssetId } from "../ids";

interface AssessmentEntry {
  maturityStage: MaturityStage;
  evidenceType: EvidenceType;
  effectivenessPct: number;
}

const ASSESSMENTS: Record<AssetId, Record<AssuranceCategory, AssessmentEntry>> = {
  "AST-003-01": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 92 },
    Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 88 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
    Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 92 },
    Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 85 },
  },
  "AST-003-02": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 87 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 90 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 78 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
    Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 88 },
    Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 80 },
  },
  "AST-003-03": {
    "Data Protection": { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 72 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 70 },
    "Identity & Access": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 42 },
    Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
    Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
  },
  "AST-003-04": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 85 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 75 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 82 },
    Governance: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 48 },
    Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 50 },
  },
  "AST-003-05": {
    "Data Protection": { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 78 },
    Configuration: { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 95 },
    Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 85 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
    Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 90 },
    Resilience: { maturityStage: "Monitored", evidenceType: "Document", effectivenessPct: 78 },
  },
  "AST-003-06": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 86 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 76 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 84 },
    Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 80 },
    Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
  },
  "AST-003-07": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 95 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 96 },
    Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 92 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 94 },
    Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 96 },
    Resilience: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 90 },
  },
  "AST-003-08": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 92 },
    Detection: { maturityStage: "Managed", evidenceType: "Automated technical test", effectivenessPct: 85 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
    Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 90 },
    Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 80 },
  },
  "AST-003-09": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 85 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 74 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 82 },
    Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 76 },
    Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 72 },
  },
  "AST-042-01": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 92 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 90 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 82 },
    "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 70 },
    Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 90 },
    Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 70 },
  },
  "AST-042-02": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 88 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 90 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 80 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
    Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 78 },
    Resilience: { maturityStage: "Monitored", evidenceType: "Automated technical test", effectivenessPct: 78 },
  },
  "AST-042-03": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 88 },
    Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 75 },
    Detection: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 45 },
    "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 65 },
    Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 75 },
    Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
  },
  "AST-042-04": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 88 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 88 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 78 },
    "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 65 },
    Governance: { maturityStage: "Managed", evidenceType: "Auditor examination", effectivenessPct: 85 },
    Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
  },
  "AST-042-05": {
    "Data Protection": { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 82 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
    Detection: { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 75 },
    "Identity & Access": { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
    Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 78 },
    Resilience: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 65 },
  },
  "AST-042-06": {
    "Data Protection": { maturityStage: "Procedure", evidenceType: "Screenshot", effectivenessPct: 50 },
    Configuration: { maturityStage: "Implemented", evidenceType: "API configuration observation", effectivenessPct: 78 },
    Detection: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 42 },
    "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 62 },
    Governance: { maturityStage: "Implemented", evidenceType: "Document", effectivenessPct: 68 },
    Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 50 },
  },
  "AST-042-07": {
    "Data Protection": { maturityStage: "Implemented", evidenceType: "Automated technical test", effectivenessPct: 75 },
    Configuration: { maturityStage: "Managed", evidenceType: "API configuration observation", effectivenessPct: 85 },
    Detection: { maturityStage: "Managed", evidenceType: "Continuous telemetry", effectivenessPct: 90 },
    "Identity & Access": { maturityStage: "Implemented", evidenceType: "Screenshot", effectivenessPct: 60 },
    Governance: { maturityStage: "Implemented", evidenceType: "Auditor examination", effectivenessPct: 78 },
    Resilience: { maturityStage: "Procedure", evidenceType: "Document", effectivenessPct: 55 },
  },
};

export interface CategoryAssessment extends AssessmentEntry {
  assetId: AssetId;
  category: AssuranceCategory;
  assessedBy: string;
  assessedAt: string;
}

// Flattened into edge records so the graph has one shape everywhere. The nested
// literal above stays because a 6-key block per asset is far easier to read and
// keep consistent than 90 free-standing rows.
export const CATEGORY_ASSESSMENTS: CategoryAssessment[] = Object.entries(ASSESSMENTS).flatMap(([assetId, byCategory]) =>
  ASSURANCE_CATEGORIES.map((category) => ({
    assetId,
    category,
    ...byCategory[category],
    assessedBy: "IT Security — annual control self-assessment",
    assessedAt: "2026-04-30",
  }))
);

const BY_ASSET: Record<AssetId, Partial<Record<AssuranceCategory, CategoryAssessment>>> = {};
CATEGORY_ASSESSMENTS.forEach((a) => {
  (BY_ASSET[a.assetId] ||= {})[a.category] = a;
});

export function assessmentFor(assetId: AssetId, category: string): CategoryAssessment | null {
  return BY_ASSET[assetId]?.[category as AssuranceCategory] || null;
}

export function assessmentsForAsset(assetId: AssetId): Partial<Record<AssuranceCategory, CategoryAssessment>> {
  return BY_ASSET[assetId] || {};
}

export const ASSESSED_ASSET_IDS: AssetId[] = Object.keys(ASSESSMENTS) as AssetId[];
