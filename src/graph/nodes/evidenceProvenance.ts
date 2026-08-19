import type { EvidenceArtifactId, EvidenceId, EvidenceReviewId } from "../ids";

export const ARTIFACT_SENSITIVITIES = ["Internal", "Confidential", "Restricted"] as const;
export type ArtifactSensitivity = (typeof ARTIFACT_SENSITIVITIES)[number];

export interface EvidenceArtifact {
  id: EvidenceArtifactId;
  name: string;
  mediaType: string;
  storageRef: string;
  sha256: string;
  createdAt: string;
  ingestedAt: string;
  createdBy: string;
  sensitivity: ArtifactSensitivity;
  retentionUntil?: string;
  version: string;
  supersedesId?: EvidenceArtifactId;
}

export const EVIDENCE_REVIEW_DECISIONS = ["accepted", "rejected", "clarification-required", "expired"] as const;
export type EvidenceReviewDecision = (typeof EVIDENCE_REVIEW_DECISIONS)[number];

export interface EvidenceReview {
  id: EvidenceReviewId;
  evidenceId: EvidenceId;
  reviewer: string;
  reviewedAt: string;
  decision: EvidenceReviewDecision;
  comments?: string;
  validThrough?: string;
  independenceDeclared: boolean;
  supersedesId?: EvidenceReviewId;
}
