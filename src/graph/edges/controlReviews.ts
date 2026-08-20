// An assessor's confirmation or rejection of a derived control call.
//
// Same contract as PrismaLevelOverride: the derivation supplies the default,
// a person records agreement or disagreement, and the gap stays visible.
// Applicability, vendor inheritance, and enterprise program coverage are
// proposals until a human stands behind them. An auditor will not accept
// "the hosting-type map said this is inherited."
//
// Confirming the derived rating is a review, not a prisma override — an
// override whose rating equals the derived one is already dead text.
import type { ControlId, SystemId } from "../ids";

export const REVIEW_BUCKETS = ["not-applicable", "vendor-inherited", "enterprise", "system-owned"] as const;
export type ReviewBucket = (typeof REVIEW_BUCKETS)[number];

export const REVIEW_STANCES = ["confirm", "reject"] as const;
export type ReviewStance = (typeof REVIEW_STANCES)[number];

export interface ControlReview {
  systemId: SystemId;
  controlId: ControlId;
  bucket: ReviewBucket;
  stance: ReviewStance;
  note: string;
  reviewedBy: string;
  reviewedAt: string;
}

export function controlReviewKey(systemId: SystemId, controlId: ControlId): string {
  return `${systemId}::${controlId}`;
}
