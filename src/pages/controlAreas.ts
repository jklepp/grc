import { LayoutGrid, SlidersHorizontal } from "lucide-react";

export const CONTROL_AREAS = [
  {
    id: "ccf",
    label: "Common Controls",
    shortLabel: "Common Controls",
    icon: LayoutGrid,
    description: "Browse the common control catalog, its domains, and the framework clauses each control satisfies.",
  },
  {
    id: "control-profile",
    label: "Control Profile",
    shortLabel: "Control Profile",
    icon: SlidersHorizontal,
    description: "Review the assurance requirements each classification tier expects and how systems evaluate against them.",
  },
] as const;

export type ControlAreaId = (typeof CONTROL_AREAS)[number]["id"];
