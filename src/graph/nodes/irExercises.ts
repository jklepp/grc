// Incident response — plan currency, tabletop exercises, and production
// incident history. Having a plan is a different claim from having rehearsed
// it, and the cockpit is built to keep those two apart.
import type { SystemId, OrgId, SystemScope } from "../ids";
import type { SeverityLevel } from "./risks";

export const IR_FUNCTIONS = ["system-owner", "security", "legal", "customer-comms", "executive"] as const;
export type IrFunction = (typeof IR_FUNCTIONS)[number];

// scope is a SystemId for a system-specific playbook, or "program" for the
// enterprise-wide plan a system falls back to when it has no override.
export interface IrPlanCurrency {
  scope: SystemScope;
  lastReviewedAt: string;
  cadenceDays: number;
}

export interface TabletopExercise {
  id: string;
  scope: SystemScope;
  conductedAt: string;
  cadenceDays: number;
  scenario: string;
  participantOrgIds: OrgId[];
  participatingFunctions: IrFunction[];
  issuesIdentified: number;
}

export interface ProductionIncident {
  id: string;
  systemId: SystemId;
  occurredAt: string;
  severity: SeverityLevel;
  lessonsLearnedComplete: boolean;
}
