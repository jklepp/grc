// The recurring activities that prove a control is actively managed.
//
// PRISMA's top rung asks whether somebody acts on what the control produces, on
// a cadence — not whether the control exists, and not whether it was measured.
// A control nobody has looked at since it was switched on is implemented and
// unmanaged, and until now this app had no way to say so: the scheduled-activity
// calendar lived in src/data and was read by exactly one page.
//
// WHY THE SHAPE IS THIN
// ----------------------
// Same reason PolicyRecord is thin. The authored records in src/data carry
// employee-facing descriptions, an activity-type taxonomy, derived framework
// badges, and a deriveStatus() CLOSURE the page calls. A fact set has to be
// plain data — scripts/check-validator-fires.mjs structuredClone()s it to build
// deliberately broken variants, and a function in it makes that impossible. So
// the source adapter projects only the fields that score.
//
// Status is deliberately NOT projected. src/data derives it against a
// module-level `new Date()`, which would bake the build time into the graph; the
// engine re-derives it against ctx.now instead, so the same fact set scored at a
// different date gives a different — and correct — answer.
import type { ControlId } from "../ids";

export const ACTIVITY_FREQUENCIES = ["Monthly", "Quarterly", "Annual"] as const;
export type ActivityFrequency = (typeof ACTIVITY_FREQUENCIES)[number];

export const PERIODS_PER_YEAR: Record<ActivityFrequency, number> = {
  Monthly: 12,
  Quarterly: 4,
  Annual: 1,
};

export interface ScheduledActivityInstance {
  period: number;
  dueDate: string;
  completedAt?: string;
  inProgress?: boolean;
}

export interface ScheduledActivityRecord {
  id: string;
  title: string;
  frequency: ActivityFrequency;
  // Hand-curated in src/data and already validated there against the real SCF
  // catalogue; re-validated here against the assembled graph so the check
  // survives the projection.
  controlIds: ControlId[];
  // The SOP this activity operationalizes. It is what lets an activity reach a
  // control through domain ownership when no activity cites that control
  // directly — the difference between "this specific control is reviewed on a
  // schedule" and "the area it lives in is."
  procedureId: string;
  instances: ScheduledActivityInstance[];
}
