// Risk scenarios. Facts only.
//
// Which assets carry a scenario and which controls hold it down live in
// edges/riskContributors.ts.
//
// The numeric weight of a severity or likelihood tier is its position in the
// ordered arrays, so weight and order cannot disagree.

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
