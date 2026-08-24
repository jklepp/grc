import { LayoutDashboard, AlertTriangle, Database } from "lucide-react";

// `deprecated` areas stay in this list on purpose: their ids still type-check,
// their pages still build, and their routes still parse — they are simply not
// reachable. The nav dropdown skips them (TopNav) and an explicit route to one
// falls back to the dashboard (App.overviewTab). Both read visibility from
// here, so deleting the flag is the whole restore.
export const OVERVIEW_AREAS = [
  {
    id: "dashboard",
    label: "Assurance Overview",
    shortLabel: "Assurance Overview",
    icon: LayoutDashboard,
    description: "The board-level read on enterprise assurance and operational readiness.",
  },
  {
    id: "risk-register",
    label: "Risk Register",
    shortLabel: "Risk Register",
    icon: AlertTriangle,
    description: "The scenario-based risk register: exposure, appetite, and treatment.",
    deprecated: true,
  },
  {
    id: "footprint",
    label: "Enterprise Footprint",
    shortLabel: "Enterprise Footprint",
    icon: Database,
    description: "Where sensitive data lives across the enterprise, by system and type.",
    deprecated: true,
  },
] as const;

export type OverviewAreaId = (typeof OVERVIEW_AREAS)[number]["id"];

export const VISIBLE_OVERVIEW_AREAS = OVERVIEW_AREAS.filter(
  (area) => !("deprecated" in area && area.deprecated)
);

export function isVisibleOverviewArea(id: string): id is OverviewAreaId {
  return VISIBLE_OVERVIEW_AREAS.some((area) => area.id === id);
}
