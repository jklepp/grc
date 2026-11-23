// Non-component helpers shared by the Governance Schedule's table
// (ScheduledActivities.tsx) and calendar (ScheduleCalendar.tsx) views.
import { C } from "../theme";
import { ACTIVITY_FIRST_YEAR, ACTIVITY_LAST_YEAR } from "../data/scheduledActivities";
import type { ActivityStatusColor } from "../data/scheduledActivities";
import { todayIso } from "../utils/calendarGrid";

export type ScheduleView = "table" | "month" | "year";

export function activityColor(color: ActivityStatusColor): string {
  return { green: C.green, accent: C.accent, muted: C.muted, amber: C.amber, red: C.red }[color];
}

// The month the calendar opens on: this month, or the nearest end of the
// recurring-activity data if today falls outside it.
export function initialCalendarMonth(): string {
  const current = todayIso().slice(0, 7);
  const first = `${ACTIVITY_FIRST_YEAR}-01`;
  const last = `${ACTIVITY_LAST_YEAR}-12`;
  if (current < first) return first;
  if (current > last) return last;
  return current;
}
