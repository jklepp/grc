import { CalendarClock, FileText, LayoutGrid, ListChecks, Shield, ShieldAlert } from "lucide-react";

export const GOVERNANCE_AREAS = [
  {
    id: "ccf",
    label: "Common Controls",
    shortLabel: "Common Controls",
    icon: LayoutGrid,
    description: "Browse the common control catalog, its domains, and the framework clauses each control satisfies.",
  },
  {
    id: "policy",
    label: "Policies",
    shortLabel: "Policies",
    icon: FileText,
    description: "Publish, review, and map the policies that establish ACME's governance requirements.",
  },
  {
    id: "procedures",
    label: "Procedures",
    shortLabel: "Procedures",
    icon: ListChecks,
    description: "Run evidence-bearing procedures and inspect the operational steps behind policy commitments.",
  },
  {
    id: "principles",
    label: "Security Principles",
    shortLabel: "Principles",
    icon: Shield,
    description: "Review ACME's design principles and where they are operationalized through procedures and controls.",
  },
  {
    id: "schedule",
    label: "Governance Schedule",
    shortLabel: "Schedule",
    icon: CalendarClock,
    description: "Track recurring governance activities, due dates, completion, and work at risk of becoming overdue.",
  },
  {
    id: "exceptions",
    label: "Exception Register",
    shortLabel: "Exceptions",
    icon: ShieldAlert,
    description: "Govern accepted security exceptions through ownership, review, expiration, and compensating controls.",
  },
] as const;

export type GovernanceAreaId = (typeof GOVERNANCE_AREAS)[number]["id"];
