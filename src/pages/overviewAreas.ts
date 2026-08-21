import { LayoutDashboard, AlertTriangle, Database } from "lucide-react";

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
  },
  {
    id: "footprint",
    label: "Enterprise Footprint",
    shortLabel: "Enterprise Footprint",
    icon: Database,
    description: "Where sensitive data lives across the enterprise, by system and type.",
  },
] as const;

export type OverviewAreaId = (typeof OVERVIEW_AREAS)[number]["id"];
