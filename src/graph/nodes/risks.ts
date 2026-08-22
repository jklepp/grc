// Risk scenarios. Facts only.
//
// One field left: `linkedControl`, a free-text string ("Access Control", "AI
// Governance") that existed so the Risk Register could show a control family in
// a column. It was doing far more work than that. riskRegister.js mapped it
// through LINKED_CONTROL_CATEGORY to one of the six assurance categories, then
// looked up that category's ENTERPRISE-WIDE average, and presented the result as
// this risk's control assurance. So every risk mapping to "Identity & Access"
// reported the same number, computed across all fifteen assets — including
// assets that have nothing to do with the risk.
//
// It's now edges/riskContributors.ts: which assets actually carry the scenario,
// and which key controls actually hold it down. engine/risk.ts reads assurance
// from those, so RISK-001's number comes from the RAG service and the vector
// store rather than from an enterprise-wide average, and it moves when they move.
//
// The ordered level arrays replace SEVERITY_VALUE / LIKELIHOOD_VALUE. The
// numeric weight of a tier is its position in the ordering, so the two can't
// disagree — the old pair of hand-typed lookup objects could.

import type { RiskId, OrgId } from "../ids";

export const SEVERITY_LEVELS = ["Minor", "Moderate", "Major", "Severe"] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const LIKELIHOOD_LEVELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"] as const;
export type LikelihoodLevel = (typeof LIKELIHOOD_LEVELS)[number];

export interface RiskExposure {
  severity: SeverityLevel;
  likelihood: LikelihoodLevel;
}

export type MilestoneStatus = "not_started" | "in_progress" | "blocked" | "done";

export interface RiskMilestone {
  title: string;
  status: MilestoneStatus;
  due: string;
}

export interface Risk {
  id: RiskId;
  scenario: string;
  domain: string;
  subcategory: string;
  materialLabel?: string;
  ownerId: OrgId;
  appetite: number;
  treatment: string;
  treatmentAtRisk: boolean;
  escalated: boolean;
  exposure: number;
  inherent: RiskExposure;
  residual: RiskExposure;
  description: string;
  milestones: RiskMilestone[];
}
