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
import type { AssuranceCategory, MaturityStage, EvidenceType } from "../nodes/taxonomy";
import type { AssetId } from "../ids";

interface AssessmentEntry {
  maturityStage: MaturityStage;
  evidenceType: EvidenceType;
  effectivenessPct: number;
}


export interface CategoryAssessment extends AssessmentEntry {
  assetId: AssetId;
  category: AssuranceCategory;
  assessedBy: string;
  assessedAt: string;
}
