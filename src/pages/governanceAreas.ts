import { BookOpen, CalendarClock, FileText, Handshake, LayoutGrid, ListChecks, Shield, ShieldAlert } from "lucide-react";

export const GOVERNANCE_AREAS = [
  {
    id: "ccf",
    label: "Common Controls",
    shortLabel: "Common Controls",
    icon: LayoutGrid,
    description: "Browse the common control catalog, its domains, and the framework clauses each control satisfies.",
  },
  {
    id: "frameworks",
    label: "Compliance Frameworks",
    shortLabel: "Frameworks",
    icon: BookOpen,
    description: "Read each framework's requirements in its own words, and see which common controls map to each one.",
  },
  {
    id: "obligations",
    label: "External Obligations",
    shortLabel: "Obligations",
    icon: Handshake,
    description: "Track security and data terms owed to customers and other outside parties that are stricter than ACME's defaults, and whether evidence shows they're met.",
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
